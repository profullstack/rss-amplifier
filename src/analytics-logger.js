import fs from 'fs/promises';
import path from 'path';
import os from 'os';

/**
 * AnalyticsLogger - Comprehensive logging and analytics system with Supabase integration
 * 
 * Features:
 * - Event logging with structured data
 * - Supabase integration for cloud storage
 * - Local file fallback for offline operation
 * - Analytics and metrics calculation
 * - Dashboard data aggregation
 * - Data export capabilities
 * - Automatic log cleanup
 */
export class AnalyticsLogger {
  constructor(config = {}) {
    this.config = {
      dataDir: config.dataDir || path.join(os.homedir(), '.config', 'rss-amplifier', 'analytics'),
      enableSupabase: config.enableSupabase || false,
      enableLocalLogging: config.enableLocalLogging !== false, // Default to true
      supabase: config.supabase || null,
      logLevel: config.logLevel || 'info',
      maxLogSize: config.maxLogSize || 10 * 1024 * 1024, // 10MB
      retentionDays: config.retentionDays || 90,
      ...config
    };

    this.supabase = this.config.supabase;
    this.localLogPath = path.join(this.config.dataDir, 'analytics.log');
    this.metricsCache = new Map();
    this.cacheExpiry = 5 * 60 * 1000; // 5 minutes

    // Ensure data directory exists
    this._ensureDataDir();
  }

  /**
   * Ensure the data directory exists
   */
  async _ensureDataDir() {
    try {
      await fs.mkdir(this.config.dataDir, { recursive: true });
    } catch (error) {
      console.warn(`Failed to create analytics data directory: ${error.message}`);
    }
  }

  /**
   * Log an analytics event
   * @param {string} eventType - Type of event (e.g., 'snippet_generation', 'social_posting')
   * @param {Object} eventData - Event-specific data
   * @param {Object} metadata - Additional metadata
   * @returns {Promise<boolean>} Success status
   */
  async logEvent(eventType, eventData = {}, metadata = {}) {
    const event = {
      id: this._generateId(),
      event_type: eventType,
      event_data: eventData,
      metadata: {
        timestamp: new Date().toISOString(),
        user_agent: process.env.npm_config_user_agent || 'rss-amplifier-cli',
        node_version: process.version,
        platform: process.platform,
        ...metadata
      },
      created_at: new Date().toISOString()
    };

    let success = false;

    // Try Supabase first if enabled
    if (this.config.enableSupabase && this.supabase) {
      success = await this._logToSupabase(event);
    }

    // Fallback to local logging if Supabase failed or is disabled
    if (!success && this.config.enableLocalLogging) {
      success = await this._logToFile(event);
    }

    // Clear metrics cache when new events are logged
    this.metricsCache.clear();

    return success;
  }

  /**
   * Log event to Supabase
   * @param {Object} event - Event object
   * @returns {Promise<boolean>} Success status
   */
  async _logToSupabase(event) {
    try {
      const { data, error } = await this.supabase
        .from('analytics_events')
        .insert([event]);

      if (error) {
        console.warn(`Supabase logging failed: ${error.message}`);
        return false;
      }

      return true;
    } catch (error) {
      console.warn(`Supabase logging error: ${error.message}`);
      return false;
    }
  }

  /**
   * Log event to local file
   * @param {Object} event - Event object
   * @returns {Promise<boolean>} Success status
   */
  async _logToFile(event) {
    try {
      await this._ensureDataDir();
      
      const logLine = JSON.stringify(event) + '\n';
      await fs.appendFile(this.localLogPath, logLine, 'utf8');
      
      // Check file size and rotate if necessary
      await this._rotateLogIfNeeded();
      
      return true;
    } catch (error) {
      console.warn(`Local logging failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Rotate log file if it exceeds max size
   */
  async _rotateLogIfNeeded() {
    try {
      const stats = await fs.stat(this.localLogPath);
      if (stats.size > this.config.maxLogSize) {
        const backupPath = `${this.localLogPath}.${Date.now()}.bak`;
        await fs.rename(this.localLogPath, backupPath);
      }
    } catch (error) {
      // Ignore rotation errors
    }
  }

  /**
   * Get analytics data for a date range
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @param {string} eventType - Optional event type filter
   * @returns {Promise<Array|null>} Analytics data or null on error
   */
  async getAnalytics(startDate, endDate, eventType = null) {
    if (this.config.enableSupabase && this.supabase) {
      return await this._getAnalyticsFromSupabase(startDate, endDate, eventType);
    } else if (this.config.enableLocalLogging) {
      return await this._getAnalyticsFromFile(startDate, endDate, eventType);
    }
    
    return null;
  }

  /**
   * Get analytics from Supabase
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @param {string} eventType - Optional event type filter
   * @returns {Promise<Array|null>} Analytics data or null on error
   */
  async _getAnalyticsFromSupabase(startDate, endDate, eventType = null) {
    try {
      let query = this.supabase
        .from('analytics_events')
        .select('*')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());

      if (eventType) {
        query = query.eq('event_type', eventType);
      }

      query = query.order('created_at', { ascending: false });

      const result = await query;
      const { data, error } = result;

      if (error) {
        console.warn(`Supabase query failed: ${error.message}`);
        return null;
      }

      return data || [];
    } catch (error) {
      console.warn(`Supabase analytics error: ${error.message}`);
      return null;
    }
  }

  /**
   * Get analytics from local file
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @param {string} eventType - Optional event type filter
   * @returns {Promise<Array>} Analytics data
   */
  async _getAnalyticsFromFile(startDate, endDate, eventType = null) {
    try {
      const logContent = await fs.readFile(this.localLogPath, 'utf8');
      const lines = logContent.trim().split('\n').filter(line => line.trim());
      
      const events = lines
        .map(line => {
          try {
            return JSON.parse(line);
          } catch {
            return null;
          }
        })
        .filter(event => {
          if (!event) return false;
          
          const eventDate = new Date(event.created_at);
          const inDateRange = eventDate >= startDate && eventDate <= endDate;
          const matchesType = !eventType || event.event_type === eventType;
          
          return inDateRange && matchesType;
        })
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

      return events;
    } catch (error) {
      console.warn(`Local analytics read error: ${error.message}`);
      return [];
    }
  }

  /**
   * Calculate metrics for a specific event type
   * @param {string} eventType - Event type to analyze
   * @param {Date} startDate - Optional start date (defaults to 30 days ago)
   * @param {Date} endDate - Optional end date (defaults to now)
   * @returns {Promise<Object>} Calculated metrics
   */
  async getMetrics(eventType, startDate = null, endDate = null) {
    const cacheKey = `${eventType}-${startDate?.toISOString()}-${endDate?.toISOString()}`;
    
    // Check cache first
    const cached = this.metricsCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
      return cached.data;
    }

    // Set default date range if not provided
    if (!startDate) {
      startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);
    }
    if (!endDate) {
      endDate = new Date();
    }

    const events = await this.getAnalytics(startDate, endDate, eventType);
    if (!events) {
      return this._getEmptyMetrics();
    }

    const metrics = this._calculateMetrics(events, eventType);
    
    // Cache the results
    this.metricsCache.set(cacheKey, {
      data: metrics,
      timestamp: Date.now()
    });

    return metrics;
  }

  /**
   * Calculate metrics from events data
   * @param {Array} events - Events array
   * @param {string} eventType - Event type
   * @returns {Object} Calculated metrics
   */
  _calculateMetrics(events, eventType) {
    if (!events.length) {
      return this._getEmptyMetrics();
    }

    const totalEvents = events.length;
    const successfulEvents = events.filter(e => e.event_data?.success === true).length;
    const successRate = totalEvents > 0 ? successfulEvents / totalEvents : 0;

    const metrics = {
      totalEvents,
      successfulEvents,
      failedEvents: totalEvents - successfulEvents,
      successRate: Math.round(successRate * 10000) / 10000, // Round to 4 decimal places
      timeRange: {
        start: events[events.length - 1]?.created_at,
        end: events[0]?.created_at
      }
    };

    // Event-specific metrics
    switch (eventType) {
      case 'snippet_generation':
        this._addSnippetGenerationMetrics(metrics, events);
        break;
      case 'social_posting':
        this._addSocialPostingMetrics(metrics, events);
        break;
      case 'feed_processing':
        this._addFeedProcessingMetrics(metrics, events);
        break;
    }

    return metrics;
  }

  /**
   * Add snippet generation specific metrics
   * @param {Object} metrics - Metrics object to modify
   * @param {Array} events - Events array
   */
  _addSnippetGenerationMetrics(metrics, events) {
    const processingTimes = events
      .map(e => e.event_data?.processingTime)
      .filter(time => typeof time === 'number');

    if (processingTimes.length > 0) {
      metrics.averageProcessingTime = Math.round(
        processingTimes.reduce((sum, time) => sum + time, 0) / processingTimes.length
      );
      metrics.minProcessingTime = Math.min(...processingTimes);
      metrics.maxProcessingTime = Math.max(...processingTimes);
    }

    const snippetCounts = events
      .map(e => e.event_data?.snippetCount)
      .filter(count => typeof count === 'number');

    if (snippetCounts.length > 0) {
      metrics.totalSnippetsGenerated = snippetCounts.reduce((sum, count) => sum + count, 0);
      metrics.averageSnippetsPerGeneration = Math.round(
        metrics.totalSnippetsGenerated / snippetCounts.length * 100
      ) / 100;
    }

    // Platform breakdown
    const platformCounts = {};
    events.forEach(event => {
      const platform = event.event_data?.platform;
      if (platform) {
        platformCounts[platform] = (platformCounts[platform] || 0) + 1;
      }
    });
    metrics.platformBreakdown = platformCounts;
  }

  /**
   * Add social posting specific metrics
   * @param {Object} metrics - Metrics object to modify
   * @param {Array} events - Events array
   */
  _addSocialPostingMetrics(metrics, events) {
    // Platform breakdown
    const platformCounts = {};
    events.forEach(event => {
      const platform = event.event_data?.platform;
      if (platform) {
        platformCounts[platform] = (platformCounts[platform] || 0) + 1;
      }
    });
    metrics.platformBreakdown = platformCounts;

    // Engagement metrics
    const engagementData = events
      .map(e => e.event_data?.engagement)
      .filter(engagement => engagement && typeof engagement === 'object');

    if (engagementData.length > 0) {
      metrics.totalLikes = engagementData.reduce((sum, e) => sum + (e.likes || 0), 0);
      metrics.totalShares = engagementData.reduce((sum, e) => sum + (e.shares || 0), 0);
      metrics.totalComments = engagementData.reduce((sum, e) => sum + (e.comments || 0), 0);
      metrics.averageEngagement = {
        likes: Math.round(metrics.totalLikes / engagementData.length * 100) / 100,
        shares: Math.round(metrics.totalShares / engagementData.length * 100) / 100,
        comments: Math.round(metrics.totalComments / engagementData.length * 100) / 100
      };
    }
  }

  /**
   * Add feed processing specific metrics
   * @param {Object} metrics - Metrics object to modify
   * @param {Array} events - Events array
   */
  _addFeedProcessingMetrics(metrics, events) {
    const processingTimes = events
      .map(e => e.event_data?.processingTime)
      .filter(time => typeof time === 'number');

    if (processingTimes.length > 0) {
      metrics.averageProcessingTime = Math.round(
        processingTimes.reduce((sum, time) => sum + time, 0) / processingTimes.length
      );
    }

    const articlesProcessed = events
      .map(e => e.event_data?.articlesProcessed)
      .filter(count => typeof count === 'number');

    if (articlesProcessed.length > 0) {
      metrics.totalArticlesProcessed = articlesProcessed.reduce((sum, count) => sum + count, 0);
      metrics.averageArticlesPerRun = Math.round(
        metrics.totalArticlesProcessed / articlesProcessed.length * 100
      ) / 100;
    }

    const newArticles = events
      .map(e => e.event_data?.newArticles)
      .filter(count => typeof count === 'number');

    if (newArticles.length > 0) {
      metrics.totalNewArticles = newArticles.reduce((sum, count) => sum + count, 0);
    }
  }

  /**
   * Get empty metrics object
   * @returns {Object} Empty metrics
   */
  _getEmptyMetrics() {
    return {
      totalEvents: 0,
      successfulEvents: 0,
      failedEvents: 0,
      successRate: 0,
      timeRange: {
        start: null,
        end: null
      }
    };
  }

  /**
   * Get comprehensive dashboard data
   * @param {Date} startDate - Optional start date (defaults to 30 days ago)
   * @param {Date} endDate - Optional end date (defaults to now)
   * @returns {Promise<Object>} Dashboard data
   */
  async getDashboardData(startDate = null, endDate = null) {
    // Set default date range if not provided
    if (!startDate) {
      startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);
    }
    if (!endDate) {
      endDate = new Date();
    }

    const allEvents = await this.getAnalytics(startDate, endDate);
    if (!allEvents) {
      return this._getEmptyDashboard();
    }

    // Get metrics for each event type
    const [snippetMetrics, postingMetrics, feedMetrics] = await Promise.all([
      this.getMetrics('snippet_generation', startDate, endDate),
      this.getMetrics('social_posting', startDate, endDate),
      this.getMetrics('feed_processing', startDate, endDate)
    ]);

    // Calculate overview metrics
    const overview = {
      totalEvents: allEvents.length,
      successfulEvents: allEvents.filter(e => e.event_data?.success === true).length,
      failedEvents: allEvents.filter(e => e.event_data?.success === false).length,
      successRate: allEvents.length > 0 ? 
        allEvents.filter(e => e.event_data?.success === true).length / allEvents.length : 0,
      timeRange: {
        start: startDate.toISOString(),
        end: endDate.toISOString()
      }
    };

    // Get recent activity (last 10 events)
    const recentActivity = allEvents.slice(0, 10).map(event => ({
      id: event.id,
      type: event.event_type,
      timestamp: event.created_at,
      success: event.event_data?.success,
      summary: this._generateEventSummary(event)
    }));

    return {
      overview,
      snippetGeneration: snippetMetrics,
      socialPosting: postingMetrics,
      feedProcessing: feedMetrics,
      recentActivity,
      generatedAt: new Date().toISOString()
    };
  }

  /**
   * Generate a human-readable summary for an event
   * @param {Object} event - Event object
   * @returns {string} Event summary
   */
  _generateEventSummary(event) {
    const { event_type, event_data } = event;
    
    switch (event_type) {
      case 'snippet_generation':
        return `Generated ${event_data.snippetCount || 0} snippets for ${event_data.platform || 'unknown platform'}`;
      case 'social_posting':
        return `Posted to ${event_data.platform || 'unknown platform'}${event_data.success ? ' successfully' : ' (failed)'}`;
      case 'feed_processing':
        return `Processed ${event_data.articlesProcessed || 0} articles, ${event_data.newArticles || 0} new`;
      default:
        return `${event_type} event`;
    }
  }

  /**
   * Get empty dashboard data
   * @returns {Object} Empty dashboard
   */
  _getEmptyDashboard() {
    return {
      overview: {
        totalEvents: 0,
        successfulEvents: 0,
        failedEvents: 0,
        successRate: 0,
        timeRange: { start: null, end: null }
      },
      snippetGeneration: this._getEmptyMetrics(),
      socialPosting: this._getEmptyMetrics(),
      feedProcessing: this._getEmptyMetrics(),
      recentActivity: [],
      generatedAt: new Date().toISOString()
    };
  }

  /**
   * Export analytics data to file
   * @param {string} filePath - Export file path
   * @param {string} format - Export format ('json' or 'csv')
   * @param {Date} startDate - Optional start date
   * @param {Date} endDate - Optional end date
   * @returns {Promise<boolean>} Success status
   */
  async exportAnalytics(filePath, format = 'json', startDate = null, endDate = null) {
    try {
      // Set default date range if not provided
      if (!startDate) {
        startDate = new Date();
        startDate.setDate(startDate.getDate() - 30);
      }
      if (!endDate) {
        endDate = new Date();
      }

      const events = await this.getAnalytics(startDate, endDate);
      if (!events) {
        return false;
      }

      // Ensure export directory exists
      const exportDir = path.dirname(filePath);
      await fs.mkdir(exportDir, { recursive: true });

      if (format === 'json') {
        await fs.writeFile(filePath, JSON.stringify(events, null, 2), 'utf8');
      } else if (format === 'csv') {
        const csv = this._convertToCSV(events);
        await fs.writeFile(filePath, csv, 'utf8');
      } else {
        throw new Error(`Unsupported export format: ${format}`);
      }

      return true;
    } catch (error) {
      console.warn(`Export failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Convert events to CSV format
   * @param {Array} events - Events array
   * @returns {string} CSV content
   */
  _convertToCSV(events) {
    if (!events.length) {
      return 'id,event_type,created_at,success,data\n';
    }

    const headers = ['id', 'event_type', 'created_at', 'success', 'data'];
    const csvLines = [headers.join(',')];

    events.forEach(event => {
      const row = [
        event.id || '',
        event.event_type || '',
        event.created_at || '',
        event.event_data?.success || false,
        JSON.stringify(event.event_data || {}).replace(/"/g, '""')
      ];
      csvLines.push(row.map(field => `"${field}"`).join(','));
    });

    return csvLines.join('\n');
  }

  /**
   * Clear old logs based on retention policy
   * @param {number} retentionDays - Number of days to retain logs
   * @returns {Promise<boolean>} Success status
   */
  async clearOldLogs(retentionDays = null) {
    const days = retentionDays || this.config.retentionDays;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    let success = false;

    // Clear from Supabase if enabled
    if (this.config.enableSupabase && this.supabase) {
      try {
        const result = await this.supabase
          .from('analytics_events')
          .delete()
          .lt('created_at', cutoffDate.toISOString());

        const { error } = result;

        if (error) {
          console.warn(`Supabase cleanup failed: ${error.message}`);
        } else {
          success = true;
        }
      } catch (error) {
        console.warn(`Supabase cleanup error: ${error.message}`);
      }
    }

    // Clear local logs if enabled
    if (this.config.enableLocalLogging) {
      success = await this._clearLocalLogs(cutoffDate) || success;
    }

    // Clear metrics cache
    this.metricsCache.clear();

    return success;
  }

  /**
   * Clear old local logs
   * @param {Date} cutoffDate - Cutoff date
   * @returns {Promise<boolean>} Success status
   */
  async _clearLocalLogs(cutoffDate) {
    try {
      const logContent = await fs.readFile(this.localLogPath, 'utf8');
      const lines = logContent.trim().split('\n').filter(line => line.trim());
      
      const filteredLines = lines.filter(line => {
        try {
          const event = JSON.parse(line);
          const eventDate = new Date(event.created_at);
          return eventDate >= cutoffDate;
        } catch {
          return false; // Remove invalid lines
        }
      });

      await fs.writeFile(this.localLogPath, filteredLines.join('\n') + '\n', 'utf8');
      return true;
    } catch (error) {
      console.warn(`Local log cleanup failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Generate a unique ID for events
   * @returns {string} Unique ID
   */
  _generateId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

export default AnalyticsLogger;