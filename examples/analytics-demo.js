#!/usr/bin/env node

/**
 * Analytics Demo - Demonstrates the AnalyticsLogger functionality
 * 
 * This example shows how to:
 * - Initialize the analytics logger
 * - Log various types of events
 * - Retrieve analytics data and metrics
 * - Generate dashboard data
 * - Export analytics data
 */

import { AnalyticsLogger } from '../src/analytics-logger.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runAnalyticsDemo() {
  console.log('🔍 RSS Amplifier Analytics Demo\n');

  // Initialize analytics logger with local logging only
  const analytics = new AnalyticsLogger({
    dataDir: path.join(__dirname, '..', 'demo-data', 'analytics'),
    enableSupabase: false, // Using local logging for demo
    enableLocalLogging: true
  });

  console.log('📊 Logging sample events...\n');

  // Log snippet generation events
  await analytics.logEvent('snippet_generation', {
    feedId: 'tech-news-feed',
    articleId: 'article-123',
    platform: 'twitter',
    snippetCount: 3,
    processingTime: 1200,
    success: true
  });

  await analytics.logEvent('snippet_generation', {
    feedId: 'startup-feed',
    articleId: 'article-456',
    platform: 'linkedin',
    snippetCount: 2,
    processingTime: 800,
    success: true
  });

  await analytics.logEvent('snippet_generation', {
    feedId: 'ai-feed',
    articleId: 'article-789',
    platform: 'twitter',
    snippetCount: 4,
    processingTime: 1500,
    success: false // Failed generation
  });

  // Log social posting events
  await analytics.logEvent('social_posting', {
    snippetId: 'snippet-123',
    platform: 'twitter',
    postId: 'tweet-456',
    success: true,
    engagement: {
      likes: 15,
      shares: 3,
      comments: 2
    }
  });

  await analytics.logEvent('social_posting', {
    snippetId: 'snippet-456',
    platform: 'linkedin',
    postId: 'post-789',
    success: true,
    engagement: {
      likes: 8,
      shares: 1,
      comments: 0
    }
  });

  await analytics.logEvent('social_posting', {
    snippetId: 'snippet-789',
    platform: 'reddit',
    success: false // Failed posting
  });

  // Log feed processing events
  await analytics.logEvent('feed_processing', {
    feedId: 'tech-news-feed',
    articlesProcessed: 25,
    newArticles: 5,
    processingTime: 3000,
    success: true
  });

  await analytics.logEvent('feed_processing', {
    feedId: 'startup-feed',
    articlesProcessed: 18,
    newArticles: 3,
    processingTime: 2200,
    success: true
  });

  console.log('✅ Sample events logged successfully!\n');

  // Retrieve analytics data
  console.log('📈 Retrieving analytics data...\n');

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 7); // Last 7 days
  const endDate = new Date();

  const allEvents = await analytics.getAnalytics(startDate, endDate);
  console.log(`📋 Total events in last 7 days: ${allEvents.length}`);

  // Get metrics for each event type
  const snippetMetrics = await analytics.getMetrics('snippet_generation');
  console.log('\n🎯 Snippet Generation Metrics:');
  console.log(`  • Total events: ${snippetMetrics.totalEvents}`);
  console.log(`  • Success rate: ${(snippetMetrics.successRate * 100).toFixed(1)}%`);
  console.log(`  • Average processing time: ${snippetMetrics.averageProcessingTime}ms`);
  console.log(`  • Platform breakdown:`, snippetMetrics.platformBreakdown);

  const postingMetrics = await analytics.getMetrics('social_posting');
  console.log('\n📱 Social Posting Metrics:');
  console.log(`  • Total events: ${postingMetrics.totalEvents}`);
  console.log(`  • Success rate: ${(postingMetrics.successRate * 100).toFixed(1)}%`);
  console.log(`  • Platform breakdown:`, postingMetrics.platformBreakdown);
  if (postingMetrics.totalLikes) {
    console.log(`  • Total engagement: ${postingMetrics.totalLikes} likes, ${postingMetrics.totalShares} shares, ${postingMetrics.totalComments} comments`);
  }

  const feedMetrics = await analytics.getMetrics('feed_processing');
  console.log('\n📰 Feed Processing Metrics:');
  console.log(`  • Total events: ${feedMetrics.totalEvents}`);
  console.log(`  • Success rate: ${(feedMetrics.successRate * 100).toFixed(1)}%`);
  if (feedMetrics.totalArticlesProcessed) {
    console.log(`  • Articles processed: ${feedMetrics.totalArticlesProcessed}`);
    console.log(`  • New articles: ${feedMetrics.totalNewArticles}`);
    console.log(`  • Average processing time: ${feedMetrics.averageProcessingTime}ms`);
  }

  // Generate dashboard data
  console.log('\n📊 Generating dashboard data...\n');
  const dashboardData = await analytics.getDashboardData();
  
  console.log('🎛️ Dashboard Overview:');
  console.log(`  • Total events: ${dashboardData.overview.totalEvents}`);
  console.log(`  • Overall success rate: ${(dashboardData.overview.successRate * 100).toFixed(1)}%`);
  console.log(`  • Successful events: ${dashboardData.overview.successfulEvents}`);
  console.log(`  • Failed events: ${dashboardData.overview.failedEvents}`);

  console.log('\n📝 Recent Activity:');
  dashboardData.recentActivity.slice(0, 5).forEach((activity, index) => {
    const status = activity.success ? '✅' : '❌';
    console.log(`  ${index + 1}. ${status} ${activity.summary}`);
  });

  // Export analytics data
  console.log('\n💾 Exporting analytics data...\n');
  
  const exportDir = path.join(__dirname, '..', 'demo-data', 'exports');
  const jsonExportPath = path.join(exportDir, 'analytics-export.json');
  const csvExportPath = path.join(exportDir, 'analytics-export.csv');

  const jsonExported = await analytics.exportAnalytics(jsonExportPath, 'json');
  const csvExported = await analytics.exportAnalytics(csvExportPath, 'csv');

  if (jsonExported) {
    console.log(`📄 JSON export saved to: ${jsonExportPath}`);
  }
  if (csvExported) {
    console.log(`📊 CSV export saved to: ${csvExportPath}`);
  }

  // Demonstrate cleanup functionality
  console.log('\n🧹 Cleanup functionality available:');
  console.log('  • Use clearOldLogs(days) to remove old log entries');
  console.log('  • Automatic log rotation when files exceed size limit');
  console.log('  • Metrics caching for improved performance');

  console.log('\n✨ Analytics demo completed successfully!');
  console.log('\n💡 Integration Tips:');
  console.log('  • Enable Supabase integration for cloud storage and advanced analytics');
  console.log('  • Set up automated log cleanup with retention policies');
  console.log('  • Use metrics caching for high-frequency analytics queries');
  console.log('  • Export data regularly for backup and external analysis');
}

// Run the demo
runAnalyticsDemo().catch(error => {
  console.error('❌ Demo failed:', error.message);
  process.exit(1);
});