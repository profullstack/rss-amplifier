/**
 * Feed Scheduler
 * Handles automatic RSS feed fetching and scheduling for RSS Amplifier
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import cron from 'node-cron';
import { FeedManager, importRSSFeed } from './feed-manager.js';

/**
 * Feed Scheduler class for managing automatic feed updates
 */
export class FeedScheduler {
  constructor(options = {}) {
    this.options = {
      feedManager: options.feedManager || new FeedManager(),
      dataPath: options.dataPath || path.join(os.homedir(), '.config', 'rss-amplifier', 'scheduler'),
      defaultInterval: options.defaultInterval || '*/30 * * * *', // Every 30 minutes
      maxConcurrent: options.maxConcurrent || 5,
      retryAttempts: options.retryAttempts || 3,
      retryDelay: options.retryDelay || 5000, // 5 seconds
      ...options,
    };

    this.scheduledFeeds = new Map();
    this.activeJobs = new Map();
    this.running = false;
    this.paused = false;
    this.stats = {
      totalFeeds: 0,
      successfulUpdates: 0,
      failedUpdates: 0,
      lastUpdateTime: null,
    };

    this.ensureDataDirectory();
    this.loadScheduledFeeds();
  }

  /**
   * Ensure data directory exists
   */
  ensureDataDirectory() {
    if (!fs.existsSync(this.options.dataPath)) {
      fs.mkdirSync(this.options.dataPath, { recursive: true });
    }
  }

  /**
   * Load scheduled feeds from storage
   */
  loadScheduledFeeds() {
    try {
      const schedulerFile = path.join(this.options.dataPath, 'scheduled-feeds.json');
      if (fs.existsSync(schedulerFile)) {
        const scheduledData = JSON.parse(fs.readFileSync(schedulerFile, 'utf8'));
        this.scheduledFeeds = new Map(Object.entries(scheduledData.feeds || {}));
        this.stats = { ...this.stats, ...scheduledData.stats };
      }
    } catch (error) {
      console.warn('Failed to load scheduled feeds:', error.message);
    }
  }

  /**
   * Save scheduled feeds to storage
   */
  saveScheduledFeeds() {
    try {
      const schedulerFile = path.join(this.options.dataPath, 'scheduled-feeds.json');
      const scheduledData = {
        feeds: Object.fromEntries(this.scheduledFeeds),
        stats: this.stats,
        lastSaved: new Date().toISOString(),
      };
      fs.writeFileSync(schedulerFile, JSON.stringify(scheduledData, null, 2));
    } catch (error) {
      console.error('Failed to save scheduled feeds:', error.message);
    }
  }

  /**
   * Add a feed to the scheduler
   * @param {string} url - Feed URL
   * @param {object} options - Feed options
   * @returns {Promise<object>} Result with feedId and nextRun
   */
  async addFeed(url, options = {}) {
    try {
      const feedId = this.generateFeedId(url);
      const interval = options.interval || this.options.defaultInterval;
      
      // Validate cron expression
      const validation = validateCronExpression(interval);
      if (!validation.valid) {
        return {
          success: false,
          error: `Invalid cron expression: ${validation.errors.join(', ')}`,
        };
      }

      // Add feed to feed manager first
      const feedResult = await this.options.feedManager.addFeed(url, options);
      if (!feedResult.success) {
        return feedResult;
      }

      const nextRun = getNextRunTime(interval);
      const scheduledFeed = {
        id: feedId,
        url,
        title: options.title || '',
        interval,
        nextRun: nextRun.toISOString(),
        lastRun: null,
        lastSuccess: null,
        failureCount: 0,
        enabled: true,
        ...options,
      };

      this.scheduledFeeds.set(feedId, scheduledFeed);
      this.saveScheduledFeeds();

      // Create cron job if scheduler is running
      if (this.running && !this.paused) {
        this.createCronJob(feedId, scheduledFeed);
      }

      this.stats.totalFeeds = this.scheduledFeeds.size;

      return {
        success: true,
        feedId,
        nextRun,
        feed: scheduledFeed,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Remove a feed from the scheduler
   * @param {string} feedId - Feed ID
   * @returns {Promise<object>} Result
   */
  async removeFeed(feedId) {
    try {
      if (!this.scheduledFeeds.has(feedId)) {
        return {
          success: false,
          error: 'Scheduled feed not found',
        };
      }

      // Stop cron job if running
      if (this.activeJobs.has(feedId)) {
        this.activeJobs.get(feedId).stop();
        this.activeJobs.delete(feedId);
      }

      // Remove from feed manager
      await this.options.feedManager.removeFeed(feedId);

      // Remove from scheduler
      this.scheduledFeeds.delete(feedId);
      this.saveScheduledFeeds();

      this.stats.totalFeeds = this.scheduledFeeds.size;

      return {
        success: true,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Update feed schedule
   * @param {string} feedId - Feed ID
   * @param {string} newInterval - New cron interval
   * @returns {Promise<object>} Result
   */
  async updateFeedSchedule(feedId, newInterval) {
    try {
      if (!this.scheduledFeeds.has(feedId)) {
        return {
          success: false,
          error: 'Scheduled feed not found',
        };
      }

      // Validate new cron expression
      const validation = validateCronExpression(newInterval);
      if (!validation.valid) {
        return {
          success: false,
          error: `Invalid cron expression: ${validation.errors.join(', ')}`,
        };
      }

      const scheduledFeed = this.scheduledFeeds.get(feedId);
      scheduledFeed.interval = newInterval;
      scheduledFeed.nextRun = getNextRunTime(newInterval).toISOString();

      this.scheduledFeeds.set(feedId, scheduledFeed);
      this.saveScheduledFeeds();

      // Recreate cron job if running
      if (this.running && !this.paused) {
        if (this.activeJobs.has(feedId)) {
          this.activeJobs.get(feedId).stop();
          this.activeJobs.delete(feedId);
        }
        this.createCronJob(feedId, scheduledFeed);
      }

      return {
        success: true,
        nextRun: new Date(scheduledFeed.nextRun),
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * List all scheduled feeds
   * @returns {Promise<Array>} Array of scheduled feeds
   */
  async listScheduledFeeds() {
    return Array.from(this.scheduledFeeds.values());
  }

  /**
   * Get scheduler status
   * @returns {Promise<object>} Status information
   */
  async getStatus() {
    return {
      scheduledFeeds: this.scheduledFeeds.size,
      activeJobs: this.activeJobs.size,
      isRunning: this.running,
      isPaused: this.paused,
      lastUpdate: this.stats.lastUpdateTime,
      stats: { ...this.stats },
    };
  }

  /**
   * Get update statistics
   * @returns {Promise<object>} Update statistics
   */
  async getUpdateStats() {
    return { ...this.stats };
  }

  /**
   * Start the scheduler
   * @returns {Promise<void>}
   */
  async start() {
    if (this.running) {
      return; // Already running
    }

    this.running = true;
    this.paused = false;

    // Create cron jobs for all scheduled feeds
    for (const [feedId, scheduledFeed] of this.scheduledFeeds) {
      if (scheduledFeed.enabled) {
        this.createCronJob(feedId, scheduledFeed);
      }
    }

    console.log(`Feed scheduler started with ${this.scheduledFeeds.size} feeds`);
  }

  /**
   * Stop the scheduler
   * @returns {Promise<void>}
   */
  async stop() {
    if (!this.running) {
      return; // Already stopped
    }

    this.running = false;
    this.paused = false;

    // Stop all cron jobs
    for (const job of this.activeJobs.values()) {
      job.stop();
    }
    this.activeJobs.clear();

    console.log('Feed scheduler stopped');
  }

  /**
   * Pause the scheduler
   * @returns {Promise<void>}
   */
  async pause() {
    if (!this.running || this.paused) {
      return;
    }

    this.paused = true;

    // Stop all cron jobs but keep scheduler running
    for (const job of this.activeJobs.values()) {
      job.stop();
    }

    console.log('Feed scheduler paused');
  }

  /**
   * Resume the scheduler
   * @returns {Promise<void>}
   */
  async resume() {
    if (!this.running || !this.paused) {
      return;
    }

    this.paused = false;

    // Restart all cron jobs
    for (const job of this.activeJobs.values()) {
      job.start();
    }

    console.log('Feed scheduler resumed');
  }

  /**
   * Check if scheduler is running
   * @returns {boolean} Running status
   */
  isRunning() {
    return this.running;
  }

  /**
   * Check if scheduler is paused
   * @returns {boolean} Paused status
   */
  isPaused() {
    return this.paused;
  }

  /**
   * Fetch and update a feed
   * @param {string} url - Feed URL
   * @param {object} options - Fetch options
   * @returns {Promise<object>} Update result
   */
  async fetchAndUpdateFeed(url, options = {}) {
    const maxRetries = options.retryAttempts || this.options.retryAttempts;
    const retryDelay = options.retryDelay || this.options.retryDelay;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Import fresh feed data
        const importResult = await importRSSFeed(url, options);
        if (!importResult.success) {
          throw new Error(importResult.error);
        }

        // Update feed in manager
        const feedId = this.generateFeedId(url);
        const updateResult = await this.options.feedManager.addFeed(url, {
          ...importResult.feed,
          lastUpdated: new Date().toISOString(),
        });

        if (!updateResult.success) {
          throw new Error(updateResult.error);
        }

        // Update statistics
        this.stats.successfulUpdates++;
        this.stats.lastUpdateTime = new Date().toISOString();

        // Update scheduled feed info
        if (this.scheduledFeeds.has(feedId)) {
          const scheduledFeed = this.scheduledFeeds.get(feedId);
          scheduledFeed.lastRun = new Date().toISOString();
          scheduledFeed.lastSuccess = new Date().toISOString();
          scheduledFeed.failureCount = 0;
          scheduledFeed.nextRun = getNextRunTime(scheduledFeed.interval).toISOString();
          this.scheduledFeeds.set(feedId, scheduledFeed);
          this.saveScheduledFeeds();
        }

        return {
          success: true,
          feed: importResult.feed,
          itemsAdded: importResult.feed.items?.length || 0,
          attempt,
        };
      } catch (error) {
        console.warn(`Feed fetch attempt ${attempt}/${maxRetries} failed for ${url}:`, error.message);
        
        if (attempt === maxRetries) {
          // Final attempt failed
          this.stats.failedUpdates++;
          
          // Update scheduled feed failure info
          const feedId = this.generateFeedId(url);
          if (this.scheduledFeeds.has(feedId)) {
            const scheduledFeed = this.scheduledFeeds.get(feedId);
            scheduledFeed.lastRun = new Date().toISOString();
            scheduledFeed.failureCount++;
            scheduledFeed.nextRun = getNextRunTime(scheduledFeed.interval).toISOString();
            this.scheduledFeeds.set(feedId, scheduledFeed);
            this.saveScheduledFeeds();
          }

          return {
            success: false,
            error: error.message,
            attempts: maxRetries,
          };
        }

        // Wait before retry
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
      }
    }
  }

  /**
   * Create a cron job for a scheduled feed
   * @param {string} feedId - Feed ID
   * @param {object} scheduledFeed - Scheduled feed data
   */
  createCronJob(feedId, scheduledFeed) {
    try {
      const job = createScheduledJob(scheduledFeed.interval, async () => {
        if (this.paused) return;

        console.log(`Updating feed: ${scheduledFeed.title || scheduledFeed.url}`);
        await this.fetchAndUpdateFeed(scheduledFeed.url);
      });

      this.activeJobs.set(feedId, job);
    } catch (error) {
      console.error(`Failed to create cron job for feed ${feedId}:`, error.message);
    }
  }

  /**
   * Generate a unique feed ID from URL
   * @param {string} url - Feed URL
   * @returns {string} Feed ID
   */
  generateFeedId(url) {
    return Buffer.from(url).toString('base64').replace(/[^a-zA-Z0-9]/g, '');
  }

  /**
   * Close and clean up resources
   */
  async close() {
    await this.stop();
    this.saveScheduledFeeds();
  }
}

/**
 * Validate cron expression
 * @param {string} expression - Cron expression to validate
 * @returns {object} Validation result
 */
export function validateCronExpression(expression) {
  const errors = [];

  if (!expression || typeof expression !== 'string') {
    errors.push('Cron expression is required and must be a string');
    return { valid: false, errors };
  }

  try {
    // Use node-cron's validate function
    const isValid = cron.validate(expression);
    if (!isValid) {
      errors.push('Invalid cron expression format');
    }
  } catch (error) {
    errors.push(`Cron validation error: ${error.message}`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Get next run time for cron expression
 * @param {string} cronExpression - Cron expression
 * @returns {Date} Next run time
 */
export function getNextRunTime(cronExpression) {
  try {
    // For simplicity, calculate next run based on common patterns
    const now = new Date();
    
    // Parse common cron patterns
    if (cronExpression.startsWith('*/')) {
      // Every X minutes pattern: */5 * * * *
      const minutes = parseInt(cronExpression.split(' ')[0].substring(2));
      return new Date(now.getTime() + (minutes * 60000));
    } else if (cronExpression.startsWith('0 */')) {
      // Every X hours pattern: 0 */2 * * *
      const hours = parseInt(cronExpression.split(' ')[1].substring(2));
      return new Date(now.getTime() + (hours * 3600000));
    } else if (cronExpression === '0 0 * * *') {
      // Daily at midnight
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      return tomorrow;
    }
    
    // Default fallback: 30 minutes from now
    return new Date(now.getTime() + 1800000);
  } catch (error) {
    // Fallback to 1 hour from now
    return new Date(Date.now() + 3600000);
  }
}

/**
 * Create a scheduled job with error handling
 * @param {string} cronExpression - Cron expression
 * @param {Function} callback - Job callback function
 * @returns {object} Cron job instance
 */
export function createScheduledJob(cronExpression, callback) {
  const wrappedCallback = async () => {
    try {
      await callback();
    } catch (error) {
      console.error('Scheduled job error:', error.message);
    }
  };

  return cron.schedule(cronExpression, wrappedCallback, {
    scheduled: true,
    timezone: 'UTC',
  });
}

export default {
  FeedScheduler,
  createScheduledJob,
  validateCronExpression,
  getNextRunTime,
};