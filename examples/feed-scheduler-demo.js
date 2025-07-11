/**
 * Feed Scheduler Demo
 * Demonstrates RSS/OPML feed import and scheduling functionality
 */

import { FeedManager, importOPML } from '../src/feed-manager.js';
import { FeedScheduler } from '../src/feed-scheduler.js';

async function demonstrateFeedScheduler() {
  console.log('🚀 RSS Amplifier Feed Scheduler Demo\n');

  try {
    // Create feed manager and scheduler
    const feedManager = new FeedManager({
      dataPath: './demo-data/feeds',
      maxItems: 5,
    });

    const scheduler = new FeedScheduler({
      feedManager,
      dataPath: './demo-data/scheduler',
      defaultInterval: '*/30 * * * *', // Every 30 minutes
    });

    console.log('📥 Importing OPML feeds from TrendingCTO...');
    
    // Import OPML feeds from the provided URL
    // Note: In a real scenario, you'd first download the OPML file
    // For demo purposes, we'll simulate with a sample OPML structure
    const sampleFeeds = [
      {
        title: 'TechCrunch',
        xmlUrl: 'https://techcrunch.com/feed/',
        htmlUrl: 'https://techcrunch.com',
        description: 'Technology news and analysis',
      },
      {
        title: 'Hacker News',
        xmlUrl: 'https://hnrss.org/frontpage',
        htmlUrl: 'https://news.ycombinator.com',
        description: 'Hacker News front page',
      },
      {
        title: 'Dev.to',
        xmlUrl: 'https://dev.to/feed',
        htmlUrl: 'https://dev.to',
        description: 'Developer community posts',
      },
    ];

    // Add feeds to scheduler
    console.log('📋 Adding feeds to scheduler...');
    for (const feed of sampleFeeds) {
      const result = await scheduler.addFeed(feed.xmlUrl, {
        title: feed.title,
        description: feed.description,
        interval: '*/15 * * * *', // Every 15 minutes
      });

      if (result.success) {
        console.log(`✅ Added: ${feed.title}`);
        console.log(`   Next run: ${result.nextRun.toLocaleString()}`);
      } else {
        console.log(`❌ Failed to add ${feed.title}: ${result.error}`);
      }
    }

    // List scheduled feeds
    console.log('\n📊 Scheduled Feeds:');
    const scheduledFeeds = await scheduler.listScheduledFeeds();
    scheduledFeeds.forEach((feed, index) => {
      console.log(`${index + 1}. ${feed.title}`);
      console.log(`   URL: ${feed.url}`);
      console.log(`   Interval: ${feed.interval}`);
      console.log(`   Next Run: ${new Date(feed.nextRun).toLocaleString()}`);
      console.log(`   Status: ${feed.enabled ? 'Enabled' : 'Disabled'}`);
      console.log('');
    });

    // Get scheduler status
    const status = await scheduler.getStatus();
    console.log('📈 Scheduler Status:');
    console.log(`   Scheduled Feeds: ${status.scheduledFeeds}`);
    console.log(`   Active Jobs: ${status.activeJobs}`);
    console.log(`   Running: ${status.isRunning}`);
    console.log(`   Paused: ${status.isPaused}`);

    // Demonstrate feed fetching (with mock content to avoid network calls)
    console.log('\n🔄 Testing feed fetch...');
    const mockRssContent = `<?xml version="1.0" encoding="UTF-8"?>
      <rss version="2.0">
        <channel>
          <title>Demo Feed</title>
          <description>A demo RSS feed</description>
          <link>https://demo.example.com</link>
          <item>
            <title>Demo Article 1</title>
            <description>This is a demo article</description>
            <link>https://demo.example.com/article1</link>
            <pubDate>Wed, 01 Jan 2025 12:00:00 GMT</pubDate>
          </item>
          <item>
            <title>Demo Article 2</title>
            <description>Another demo article</description>
            <link>https://demo.example.com/article2</link>
            <pubDate>Wed, 01 Jan 2025 11:00:00 GMT</pubDate>
          </item>
        </channel>
      </rss>`;

    const fetchResult = await scheduler.fetchAndUpdateFeed('https://demo.example.com/feed.xml', {
      mockContent: mockRssContent,
    });

    if (fetchResult.success) {
      console.log(`✅ Feed fetched successfully`);
      console.log(`   Items added: ${fetchResult.itemsAdded}`);
      console.log(`   Feed title: ${fetchResult.feed.title}`);
    } else {
      console.log(`❌ Feed fetch failed: ${fetchResult.error}`);
    }

    // Get update statistics
    const stats = await scheduler.getUpdateStats();
    console.log('\n📊 Update Statistics:');
    console.log(`   Total Feeds: ${stats.totalFeeds}`);
    console.log(`   Successful Updates: ${stats.successfulUpdates}`);
    console.log(`   Failed Updates: ${stats.failedUpdates}`);
    console.log(`   Last Update: ${stats.lastUpdateTime || 'Never'}`);

    // Clean up
    await scheduler.close();
    await feedManager.close();

    console.log('\n✨ Demo completed successfully!');
    console.log('\n💡 Next steps:');
    console.log('   - Start the scheduler with: await scheduler.start()');
    console.log('   - Feeds will be automatically updated based on their intervals');
    console.log('   - Use the CLI commands to manage feeds and view status');

  } catch (error) {
    console.error('❌ Demo failed:', error.message);
    console.error(error.stack);
  }
}

// Run the demo
if (import.meta.url === `file://${process.argv[1]}`) {
  demonstrateFeedScheduler();
}

export { demonstrateFeedScheduler };