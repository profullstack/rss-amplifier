/**
 * Feed Scheduler Tests
 * Testing automatic feed fetching and scheduling functionality
 */

import { expect } from 'chai';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  FeedScheduler,
  createScheduledJob,
  validateCronExpression,
  getNextRunTime,
} from '../src/feed-scheduler.js';
import { FeedManager } from '../src/feed-manager.js';

describe('Feed Scheduler', () => {
  let tempDataPath;
  let feedManager;
  let scheduler;

  beforeEach(() => {
    // Create temporary data path for testing
    tempDataPath = path.join(os.tmpdir(), `rss-amplifier-scheduler-test-${Date.now()}`);
    fs.mkdirSync(tempDataPath, { recursive: true });
    
    // Create feed manager instance
    feedManager = new FeedManager({
      dataPath: tempDataPath,
      maxItems: 10,
      refreshInterval: 60000,
    });

    // Create scheduler instance
    scheduler = new FeedScheduler({
      feedManager,
      dataPath: tempDataPath,
      defaultInterval: '*/5 * * * *', // Every 5 minutes
    });
  });

  afterEach(async () => {
    // Stop scheduler and clean up
    if (scheduler) {
      await scheduler.stop();
    }
    
    // Clean up temporary data
    if (fs.existsSync(tempDataPath)) {
      fs.rmSync(tempDataPath, { recursive: true, force: true });
    }
  });

  describe('FeedScheduler constructor', () => {
    it('should create instance with default options', () => {
      const testScheduler = new FeedScheduler({ feedManager });
      expect(testScheduler).to.be.instanceOf(FeedScheduler);
      expect(testScheduler.options).to.have.property('defaultInterval');
      expect(testScheduler.options).to.have.property('maxConcurrent');
    });

    it('should create instance with custom options', () => {
      const options = {
        feedManager,
        defaultInterval: '0 */2 * * *', // Every 2 hours
        maxConcurrent: 10,
        retryAttempts: 5,
        retryDelay: 2000,
      };
      const testScheduler = new FeedScheduler(options);
      expect(testScheduler.options.defaultInterval).to.equal('0 */2 * * *');
      expect(testScheduler.options.maxConcurrent).to.equal(10);
      expect(testScheduler.options.retryAttempts).to.equal(5);
    });
  });

  describe('validateCronExpression', () => {
    it('should validate correct cron expressions', () => {
      const validExpressions = [
        '0 0 * * *',        // Daily at midnight
        '*/15 * * * *',     // Every 15 minutes
        '0 9-17 * * 1-5',   // Weekdays 9-5
        '0 0 1 * *',        // First day of month
        '0 0 * * 0',        // Every Sunday
      ];

      validExpressions.forEach(expr => {
        const result = validateCronExpression(expr);
        expect(result.valid).to.be.true;
        expect(result.errors).to.be.empty;
      });
    });

    it('should reject invalid cron expressions', () => {
      const invalidExpressions = [
        '60 * * * *',       // Invalid minute
        '* 25 * * *',       // Invalid hour
        '* * 32 * *',       // Invalid day
        '* * * 13 *',       // Invalid month
        '* * * * 8',        // Invalid weekday
        'invalid',          // Not a cron expression
        '',                 // Empty string
      ];

      invalidExpressions.forEach(expr => {
        const result = validateCronExpression(expr);
        expect(result.valid).to.be.false;
        expect(result.errors).to.not.be.empty;
      });
    });
  });

  describe('getNextRunTime', () => {
    it('should calculate next run time for cron expression', () => {
      const cronExpr = '0 0 * * *'; // Daily at midnight
      const nextRun = getNextRunTime(cronExpr);
      
      expect(nextRun).to.be.instanceOf(Date);
      expect(nextRun.getTime()).to.be.greaterThan(Date.now());
    });

    it('should handle different cron expressions', () => {
      const expressions = [
        '*/5 * * * *',      // Every 5 minutes
        '0 */2 * * *',      // Every 2 hours
        '0 0 1 * *',        // Monthly
      ];

      expressions.forEach(expr => {
        const nextRun = getNextRunTime(expr);
        expect(nextRun).to.be.instanceOf(Date);
        expect(nextRun.getTime()).to.be.greaterThan(Date.now());
      });
    });
  });

  describe('createScheduledJob', () => {
    it('should create a scheduled job with callback', (done) => {
      let callbackExecuted = false;
      
      const job = createScheduledJob('*/1 * * * * *', () => { // Every second for testing
        callbackExecuted = true;
        job.stop();
        expect(callbackExecuted).to.be.true;
        done();
      });

      expect(job).to.have.property('start');
      expect(job).to.have.property('stop');
    });

    it('should handle job errors gracefully', (done) => {
      const job = createScheduledJob('*/1 * * * * *', () => {
        job.stop();
        throw new Error('Test error');
      });

      // Job should not crash the process
      setTimeout(() => {
        expect(true).to.be.true; // If we get here, error was handled
        done();
      }, 1500);
    });
  });

  describe('FeedScheduler methods', () => {
    it('should add feed to scheduler', async () => {
      const feedUrl = 'https://example.com/feed.xml';
      const result = await scheduler.addFeed(feedUrl, {
        title: 'Test Feed',
        interval: '*/10 * * * *', // Every 10 minutes
      });

      expect(result.success).to.be.true;
      expect(result.feedId).to.exist;
      expect(result.nextRun).to.be.instanceOf(Date);
    });

    it('should list scheduled feeds', async () => {
      await scheduler.addFeed('https://example1.com/feed.xml', { 
        title: 'Feed 1',
        interval: '*/5 * * * *',
      });
      await scheduler.addFeed('https://example2.com/feed.xml', { 
        title: 'Feed 2',
        interval: '*/15 * * * *',
      });

      const scheduledFeeds = await scheduler.listScheduledFeeds();
      expect(scheduledFeeds).to.have.length(2);
      expect(scheduledFeeds[0]).to.have.property('title', 'Feed 1');
      expect(scheduledFeeds[0]).to.have.property('interval', '*/5 * * * *');
      expect(scheduledFeeds[0]).to.have.property('nextRun');
    });

    it('should remove feed from scheduler', async () => {
      const result = await scheduler.addFeed('https://example.com/feed.xml', { 
        title: 'Test Feed',
        interval: '*/10 * * * *',
      });
      const feedId = result.feedId;

      const removeResult = await scheduler.removeFeed(feedId);
      expect(removeResult.success).to.be.true;

      const scheduledFeeds = await scheduler.listScheduledFeeds();
      expect(scheduledFeeds).to.have.length(0);
    });

    it('should update feed schedule', async () => {
      const result = await scheduler.addFeed('https://example.com/feed.xml', { 
        title: 'Test Feed',
        interval: '*/10 * * * *',
      });
      const feedId = result.feedId;

      const updateResult = await scheduler.updateFeedSchedule(feedId, '*/30 * * * *');
      expect(updateResult.success).to.be.true;

      const scheduledFeeds = await scheduler.listScheduledFeeds();
      expect(scheduledFeeds[0]).to.have.property('interval', '*/30 * * * *');
    });

    it('should get scheduler status', async () => {
      await scheduler.addFeed('https://example1.com/feed.xml', { title: 'Feed 1' });
      await scheduler.addFeed('https://example2.com/feed.xml', { title: 'Feed 2' });

      const status = await scheduler.getStatus();
      expect(status).to.have.property('scheduledFeeds', 2);
      expect(status).to.have.property('activeJobs');
      expect(status).to.have.property('isRunning');
      expect(status).to.have.property('lastUpdate');
    });
  });

  describe('Feed fetching and updating', () => {
    it('should fetch and update feed content', async () => {
      const mockRssContent = `<?xml version="1.0" encoding="UTF-8"?>
        <rss version="2.0">
          <channel>
            <title>Updated Feed</title>
            <description>Updated RSS feed for testing</description>
            <link>https://updated.example.com</link>
            <item>
              <title>New Article</title>
              <description>New article description</description>
              <link>https://updated.example.com/article1</link>
              <pubDate>Wed, 01 Jan 2025 12:00:00 GMT</pubDate>
            </item>
          </channel>
        </rss>`;

      const result = await scheduler.fetchAndUpdateFeed('https://example.com/feed.xml', {
        mockContent: mockRssContent,
      });

      expect(result.success).to.be.true;
      expect(result.feed).to.have.property('title', 'Updated Feed');
      expect(result.itemsAdded).to.be.a('number');
    });

    it('should handle fetch errors gracefully', async () => {
      const result = await scheduler.fetchAndUpdateFeed('https://nonexistent.example.com/feed.xml');
      expect(result.success).to.be.false;
      expect(result.error).to.exist;
    });

    it('should retry failed fetches', async () => {
      let attemptCount = 0;
      const originalFetch = global.fetch;
      
      // Mock fetch to fail first few times
      global.fetch = async () => {
        attemptCount++;
        if (attemptCount < 3) {
          throw new Error('Network error');
        }
        return {
          ok: true,
          text: async () => `<?xml version="1.0"?><rss><channel><title>Success</title></channel></rss>`,
        };
      };

      const result = await scheduler.fetchAndUpdateFeed('https://example.com/feed.xml', {
        retryAttempts: 3,
        retryDelay: 100,
      });

      global.fetch = originalFetch;
      
      expect(result.success).to.be.true;
      expect(attemptCount).to.equal(3);
    });
  });

  describe('Scheduler lifecycle', () => {
    it('should start and stop scheduler', async () => {
      expect(scheduler.isRunning()).to.be.false;

      await scheduler.start();
      expect(scheduler.isRunning()).to.be.true;

      await scheduler.stop();
      expect(scheduler.isRunning()).to.be.false;
    });

    it('should pause and resume scheduler', async () => {
      await scheduler.start();
      expect(scheduler.isRunning()).to.be.true;

      await scheduler.pause();
      expect(scheduler.isPaused()).to.be.true;

      await scheduler.resume();
      expect(scheduler.isPaused()).to.be.false;
      expect(scheduler.isRunning()).to.be.true;

      await scheduler.stop();
    });

    it('should handle multiple start/stop calls', async () => {
      await scheduler.start();
      await scheduler.start(); // Should not cause issues
      expect(scheduler.isRunning()).to.be.true;

      await scheduler.stop();
      await scheduler.stop(); // Should not cause issues
      expect(scheduler.isRunning()).to.be.false;
    });
  });

  describe('Error handling and recovery', () => {
    it('should handle individual feed fetch failures without stopping scheduler', async () => {
      await scheduler.addFeed('https://good.example.com/feed.xml', { title: 'Good Feed' });
      await scheduler.addFeed('https://bad.example.com/feed.xml', { title: 'Bad Feed' });

      // Mock one feed to fail
      const originalFetchAndUpdate = scheduler.fetchAndUpdateFeed;
      scheduler.fetchAndUpdateFeed = async (url, options) => {
        if (url.includes('bad.example.com')) {
          return { success: false, error: 'Simulated failure' };
        }
        return originalFetchAndUpdate.call(scheduler, url, options);
      };

      await scheduler.start();
      expect(scheduler.isRunning()).to.be.true;

      // Scheduler should continue running despite individual failures
      const status = await scheduler.getStatus();
      expect(status.isRunning).to.be.true;

      await scheduler.stop();
    });

    it('should track feed update statistics', async () => {
      await scheduler.addFeed('https://example.com/feed.xml', { title: 'Test Feed' });
      
      const stats = await scheduler.getUpdateStats();
      expect(stats).to.have.property('totalFeeds');
      expect(stats).to.have.property('successfulUpdates');
      expect(stats).to.have.property('failedUpdates');
      expect(stats).to.have.property('lastUpdateTime');
    });
  });
});