import { expect, use } from 'chai';
import { describe, it, beforeEach, afterEach } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import fs from 'fs/promises';
import path from 'path';
import { AnalyticsLogger } from '../src/analytics-logger.js';

use(sinonChai);

describe('AnalyticsLogger', () => {
  let analyticsLogger;
  let mockSupabase;
  let tempDir;

  beforeEach(async () => {
    // Create temporary directory for test data
    tempDir = path.join(process.cwd(), 'test-data', 'analytics-test');
    await fs.mkdir(tempDir, { recursive: true });

    // Mock Supabase client with proper chaining
    const createMockQuery = () => ({
      select: sinon.stub().returnsThis(),
      insert: sinon.stub().resolves({ data: [{ id: 1 }], error: null }),
      update: sinon.stub().resolves({ data: [{ id: 1 }], error: null }),
      delete: sinon.stub().returnsThis(),
      eq: sinon.stub().returnsThis(),
      gte: sinon.stub().returnsThis(),
      lte: sinon.stub().returnsThis(),
      lt: sinon.stub().returnsThis(),
      order: sinon.stub().returnsThis(),
      limit: sinon.stub().returnsThis()
    });

    mockSupabase = {
      from: sinon.stub().returns(createMockQuery())
    };

    analyticsLogger = new AnalyticsLogger({
      dataDir: tempDir,
      supabase: mockSupabase,
      enableSupabase: true
    });
  });

  afterEach(async () => {
    // Clean up test data
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
    sinon.restore();
  });

  describe('constructor', () => {
    it('should initialize with default configuration', () => {
      const logger = new AnalyticsLogger();
      expect(logger.config).to.be.an('object');
      expect(logger.config.enableSupabase).to.be.false;
      expect(logger.config.enableLocalLogging).to.be.true;
    });

    it('should initialize with custom configuration', () => {
      const config = {
        dataDir: '/custom/path',
        enableSupabase: true,
        enableLocalLogging: false,
        supabase: mockSupabase
      };
      const logger = new AnalyticsLogger(config);
      expect(logger.config.dataDir).to.equal('/custom/path');
      expect(logger.config.enableSupabase).to.be.true;
      expect(logger.config.enableLocalLogging).to.be.false;
    });
  });

  describe('logEvent', () => {
    it('should log snippet generation event', async () => {
      const eventData = {
        feedId: 'feed-123',
        articleId: 'article-456',
        platform: 'twitter',
        snippetCount: 3,
        processingTime: 1500,
        success: true
      };

      const result = await analyticsLogger.logEvent('snippet_generation', eventData);
      expect(result).to.be.true;
      expect(mockSupabase.from).to.have.been.calledWith('analytics_events');
    });

    it('should log social posting event', async () => {
      const eventData = {
        snippetId: 'snippet-789',
        platform: 'linkedin',
        postId: 'post-123',
        success: true,
        engagement: {
          likes: 5,
          shares: 2,
          comments: 1
        }
      };

      const result = await analyticsLogger.logEvent('social_posting', eventData);
      expect(result).to.be.true;
    });

    it('should log feed processing event', async () => {
      const eventData = {
        feedId: 'feed-123',
        articlesProcessed: 10,
        newArticles: 3,
        processingTime: 5000,
        success: true
      };

      const result = await analyticsLogger.logEvent('feed_processing', eventData);
      expect(result).to.be.true;
    });

    it('should handle Supabase errors gracefully', async () => {
      // Create a mock that returns an error
      const errorMock = {
        select: sinon.stub().returnsThis(),
        insert: sinon.stub().resolves({ data: null, error: { message: 'Database error' } }),
        update: sinon.stub().resolves({ data: [{ id: 1 }], error: null }),
        delete: sinon.stub().returnsThis(),
        eq: sinon.stub().returnsThis(),
        gte: sinon.stub().returnsThis(),
        lte: sinon.stub().returnsThis(),
        lt: sinon.stub().returnsThis(),
        order: sinon.stub().returnsThis(),
        limit: sinon.stub().returnsThis()
      };
      mockSupabase.from.returns(errorMock);

      const eventData = { test: 'data' };
      const result = await analyticsLogger.logEvent('test_event', eventData);
      expect(result).to.be.true; // Should succeed with local fallback
    });

    it('should log locally when Supabase is disabled', async () => {
      const logger = new AnalyticsLogger({
        dataDir: tempDir,
        enableSupabase: false,
        enableLocalLogging: true
      });

      const eventData = { test: 'data' };
      const result = await logger.logEvent('test_event', eventData);
      expect(result).to.be.true;

      // Check if local log file was created
      const logFile = path.join(tempDir, 'analytics.log');
      const logExists = await fs.access(logFile).then(() => true).catch(() => false);
      expect(logExists).to.be.true;
    });
  });

  describe('getAnalytics', () => {
    it('should retrieve analytics for date range', async () => {
      const mockData = [
        { id: 1, event_type: 'snippet_generation', created_at: '2024-01-01T00:00:00Z' },
        { id: 2, event_type: 'social_posting', created_at: '2024-01-02T00:00:00Z' }
      ];
      
      const queryMock = {
        select: sinon.stub().returnsThis(),
        gte: sinon.stub().returnsThis(),
        lte: sinon.stub().returnsThis(),
        order: sinon.stub().resolves({ data: mockData, error: null }),
        eq: sinon.stub().returnsThis()
      };
      mockSupabase.from.returns(queryMock);

      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');
      const result = await analyticsLogger.getAnalytics(startDate, endDate);

      expect(result).to.deep.equal(mockData);
      expect(mockSupabase.from).to.have.been.calledWith('analytics_events');
    });

    it('should filter analytics by event type', async () => {
      const mockData = [
        { id: 1, event_type: 'snippet_generation', created_at: '2024-01-01T00:00:00Z' }
      ];
      
      const queryMock = {
        select: sinon.stub().returnsThis(),
        gte: sinon.stub().returnsThis(),
        lte: sinon.stub().returnsThis(),
        eq: sinon.stub().returnsThis(),
        order: sinon.stub().resolves({ data: mockData, error: null })
      };
      mockSupabase.from.returns(queryMock);

      const result = await analyticsLogger.getAnalytics(
        new Date('2024-01-01'),
        new Date('2024-01-31'),
        'snippet_generation'
      );

      expect(result).to.deep.equal(mockData);
      expect(queryMock.eq).to.have.been.calledWith('event_type', 'snippet_generation');
    });

    it('should handle Supabase query errors', async () => {
      const queryMock = {
        select: sinon.stub().returnsThis(),
        gte: sinon.stub().returnsThis(),
        lte: sinon.stub().returnsThis(),
        order: sinon.stub().resolves({ data: null, error: { message: 'Query error' } })
      };
      mockSupabase.from.returns(queryMock);

      const result = await analyticsLogger.getAnalytics(
        new Date('2024-01-01'),
        new Date('2024-01-31')
      );

      expect(result).to.be.null;
    });
  });

  describe('getMetrics', () => {
    it('should calculate snippet generation metrics', async () => {
      const mockData = [
        { event_type: 'snippet_generation', event_data: { success: true, processingTime: 1000 } },
        { event_type: 'snippet_generation', event_data: { success: true, processingTime: 1500 } },
        { event_type: 'snippet_generation', event_data: { success: false, processingTime: 500 } }
      ];
      
      const queryMock = {
        select: sinon.stub().returnsThis(),
        gte: sinon.stub().returnsThis(),
        lte: sinon.stub().returnsThis(),
        eq: sinon.stub().returnsThis(),
        order: sinon.stub().resolves({ data: mockData, error: null })
      };
      mockSupabase.from.returns(queryMock);

      const metrics = await analyticsLogger.getMetrics('snippet_generation');

      expect(metrics).to.have.property('totalEvents', 3);
      expect(metrics).to.have.property('successRate');
      expect(metrics.successRate).to.be.closeTo(0.67, 0.01);
      expect(metrics).to.have.property('averageProcessingTime', 1000);
    });

    it('should calculate social posting metrics', async () => {
      const mockData = [
        { event_type: 'social_posting', event_data: { success: true, platform: 'twitter' } },
        { event_type: 'social_posting', event_data: { success: true, platform: 'linkedin' } },
        { event_type: 'social_posting', event_data: { success: false, platform: 'twitter' } }
      ];
      
      const queryMock = {
        select: sinon.stub().returnsThis(),
        gte: sinon.stub().returnsThis(),
        lte: sinon.stub().returnsThis(),
        eq: sinon.stub().returnsThis(),
        order: sinon.stub().resolves({ data: mockData, error: null })
      };
      mockSupabase.from.returns(queryMock);

      const metrics = await analyticsLogger.getMetrics('social_posting');

      expect(metrics).to.have.property('totalEvents', 3);
      expect(metrics).to.have.property('successRate');
      expect(metrics.successRate).to.be.closeTo(0.67, 0.01);
      expect(metrics).to.have.property('platformBreakdown');
      expect(metrics.platformBreakdown.twitter).to.equal(2);
      expect(metrics.platformBreakdown.linkedin).to.equal(1);
    });

    it('should return empty metrics for no data', async () => {
      const queryMock = {
        select: sinon.stub().returnsThis(),
        gte: sinon.stub().returnsThis(),
        lte: sinon.stub().returnsThis(),
        eq: sinon.stub().returnsThis(),
        order: sinon.stub().resolves({ data: [], error: null })
      };
      mockSupabase.from.returns(queryMock);

      const metrics = await analyticsLogger.getMetrics('snippet_generation');

      expect(metrics).to.have.property('totalEvents', 0);
      expect(metrics).to.have.property('successRate', 0);
    });
  });

  describe('getDashboardData', () => {
    it('should return comprehensive dashboard data', async () => {
      const mockEvents = [
        { event_type: 'snippet_generation', event_data: { success: true }, created_at: '2024-01-01T00:00:00Z' },
        { event_type: 'social_posting', event_data: { success: true, platform: 'twitter' }, created_at: '2024-01-01T01:00:00Z' },
        { event_type: 'feed_processing', event_data: { success: true, articlesProcessed: 5 }, created_at: '2024-01-01T02:00:00Z' }
      ];
      
      const queryMock = {
        select: sinon.stub().returnsThis(),
        gte: sinon.stub().returnsThis(),
        lte: sinon.stub().returnsThis(),
        eq: sinon.stub().returnsThis(),
        order: sinon.stub().resolves({ data: mockEvents, error: null })
      };
      mockSupabase.from.returns(queryMock);

      const dashboardData = await analyticsLogger.getDashboardData();

      expect(dashboardData).to.have.property('overview');
      expect(dashboardData).to.have.property('snippetGeneration');
      expect(dashboardData).to.have.property('socialPosting');
      expect(dashboardData).to.have.property('feedProcessing');
      expect(dashboardData).to.have.property('recentActivity');

      expect(dashboardData.overview.totalEvents).to.equal(3);
      expect(dashboardData.recentActivity).to.have.length(3);
    });

    it('should handle custom date range for dashboard', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      const queryMock = {
        select: sinon.stub().returnsThis(),
        gte: sinon.stub().returnsThis(),
        lte: sinon.stub().returnsThis(),
        eq: sinon.stub().returnsThis(),
        order: sinon.stub().resolves({ data: [], error: null })
      };
      mockSupabase.from.returns(queryMock);

      await analyticsLogger.getDashboardData(startDate, endDate);

      expect(queryMock.gte).to.have.been.calledWith('created_at', startDate.toISOString());
      expect(queryMock.lte).to.have.been.calledWith('created_at', endDate.toISOString());
    });
  });

  describe('exportAnalytics', () => {
    it('should export analytics to JSON file', async () => {
      const mockData = [
        { id: 1, event_type: 'snippet_generation', created_at: '2024-01-01T00:00:00Z' }
      ];
      
      const queryMock = {
        select: sinon.stub().returnsThis(),
        gte: sinon.stub().returnsThis(),
        lte: sinon.stub().returnsThis(),
        order: sinon.stub().resolves({ data: mockData, error: null })
      };
      mockSupabase.from.returns(queryMock);

      const exportPath = path.join(tempDir, 'export.json');
      const result = await analyticsLogger.exportAnalytics(exportPath, 'json');

      expect(result).to.be.true;

      // Verify file was created and contains correct data
      const exportedData = JSON.parse(await fs.readFile(exportPath, 'utf8'));
      expect(exportedData).to.deep.equal(mockData);
    });

    it('should export analytics to CSV file', async () => {
      const mockData = [
        { id: 1, event_type: 'snippet_generation', created_at: '2024-01-01T00:00:00Z' }
      ];
      
      const queryMock = {
        select: sinon.stub().returnsThis(),
        gte: sinon.stub().returnsThis(),
        lte: sinon.stub().returnsThis(),
        order: sinon.stub().resolves({ data: mockData, error: null })
      };
      mockSupabase.from.returns(queryMock);

      const exportPath = path.join(tempDir, 'export.csv');
      const result = await analyticsLogger.exportAnalytics(exportPath, 'csv');

      expect(result).to.be.true;

      // Verify file was created
      const fileExists = await fs.access(exportPath).then(() => true).catch(() => false);
      expect(fileExists).to.be.true;
    });

    it('should handle export errors gracefully', async () => {
      const queryMock = {
        select: sinon.stub().returnsThis(),
        gte: sinon.stub().returnsThis(),
        lte: sinon.stub().returnsThis(),
        order: sinon.stub().resolves({ data: null, error: { message: 'Export error' } })
      };
      mockSupabase.from.returns(queryMock);

      const exportPath = path.join(tempDir, 'export.json');
      const result = await analyticsLogger.exportAnalytics(exportPath, 'json');

      expect(result).to.be.false;
    });
  });

  describe('clearOldLogs', () => {
    it('should clear logs older than specified days', async () => {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 30);

      const deleteMock = {
        delete: sinon.stub().returnsThis(),
        lt: sinon.stub().resolves({ data: [], error: null })
      };
      mockSupabase.from.returns(deleteMock);

      const result = await analyticsLogger.clearOldLogs(30);

      expect(result).to.be.true;
      expect(mockSupabase.from).to.have.been.calledWith('analytics_events');
    });

    it('should handle cleanup errors gracefully', async () => {
      const deleteMock = {
        delete: sinon.stub().returnsThis(),
        lt: sinon.stub().resolves({ data: null, error: { message: 'Delete error' } })
      };
      mockSupabase.from.returns(deleteMock);

      const result = await analyticsLogger.clearOldLogs(30);

      expect(result).to.be.false;
    });
  });

  describe('local logging fallback', () => {
    it('should write to local log file when Supabase fails', async () => {
      const errorMock = {
        select: sinon.stub().returnsThis(),
        insert: sinon.stub().resolves({ data: null, error: { message: 'Connection error' } }),
        update: sinon.stub().resolves({ data: [{ id: 1 }], error: null }),
        delete: sinon.stub().returnsThis(),
        eq: sinon.stub().returnsThis(),
        gte: sinon.stub().returnsThis(),
        lte: sinon.stub().returnsThis(),
        lt: sinon.stub().returnsThis(),
        order: sinon.stub().returnsThis(),
        limit: sinon.stub().returnsThis()
      };
      mockSupabase.from.returns(errorMock);

      const eventData = { test: 'data' };
      const result = await analyticsLogger.logEvent('test_event', eventData);

      expect(result).to.be.true; // Should still succeed with local logging

      // Check if local log file was created
      const logFile = path.join(tempDir, 'analytics.log');
      const logExists = await fs.access(logFile).then(() => true).catch(() => false);
      expect(logExists).to.be.true;
    });

    it('should read from local logs when Supabase is unavailable', async () => {
      const logger = new AnalyticsLogger({
        dataDir: tempDir,
        enableSupabase: false,
        enableLocalLogging: true
      });

      // Log some events locally
      await logger.logEvent('test_event_1', { data: 'test1' });
      await logger.logEvent('test_event_2', { data: 'test2' });

      // Use a wide date range that includes today
      const startDate = new Date();
      startDate.setFullYear(startDate.getFullYear() - 1); // 1 year ago
      const endDate = new Date();
      endDate.setFullYear(endDate.getFullYear() + 1); // 1 year from now

      const analytics = await logger.getAnalytics(startDate, endDate);

      expect(analytics).to.be.an('array');
      expect(analytics.length).to.be.greaterThan(0);
    });
  });
});