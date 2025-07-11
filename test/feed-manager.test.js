/**
 * Feed Manager Tests
 * Testing RSS/OPML feed import and management functionality
 */

import { expect } from 'chai';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  FeedManager,
  importOPML,
  importRSSFeed,
  fetchFeedItems,
  validateFeedUrl,
  parseFeedContent,
  extractFeedMetadata,
} from '../src/feed-manager.js';

describe('Feed Manager', () => {
  let tempDataPath;
  let feedManager;

  beforeEach(() => {
    // Create temporary data path for testing
    tempDataPath = path.join(os.tmpdir(), `rss-amplifier-feeds-test-${Date.now()}`);
    fs.mkdirSync(tempDataPath, { recursive: true });
    
    // Create feed manager instance
    feedManager = new FeedManager({
      dataPath: tempDataPath,
      maxItems: 10,
      refreshInterval: 60000,
    });
  });

  afterEach(() => {
    // Clean up temporary data
    if (fs.existsSync(tempDataPath)) {
      fs.rmSync(tempDataPath, { recursive: true, force: true });
    }
  });

  describe('FeedManager constructor', () => {
    it('should create instance with default options', () => {
      const manager = new FeedManager();
      expect(manager).to.be.instanceOf(FeedManager);
      expect(manager.options).to.have.property('maxItems');
      expect(manager.options).to.have.property('refreshInterval');
    });

    it('should create instance with custom options', () => {
      const options = {
        maxItems: 50,
        refreshInterval: 120000,
        dataPath: tempDataPath,
      };
      const manager = new FeedManager(options);
      expect(manager.options.maxItems).to.equal(50);
      expect(manager.options.refreshInterval).to.equal(120000);
      expect(manager.options.dataPath).to.equal(tempDataPath);
    });
  });

  describe('validateFeedUrl', () => {
    it('should validate correct RSS URLs', () => {
      const validUrls = [
        'https://example.com/feed.xml',
        'http://blog.example.com/rss',
        'https://feeds.example.com/posts.rss',
      ];

      validUrls.forEach(url => {
        const result = validateFeedUrl(url);
        expect(result.valid).to.be.true;
        expect(result.errors).to.be.empty;
      });
    });

    it('should reject invalid URLs', () => {
      const invalidUrls = [
        'not-a-url',
        'ftp://example.com/feed.xml',
        '',
        null,
        undefined,
      ];

      invalidUrls.forEach(url => {
        const result = validateFeedUrl(url);
        expect(result.valid).to.be.false;
        expect(result.errors).to.not.be.empty;
      });
    });
  });

  describe('parseFeedContent', () => {
    it('should parse valid RSS content', async () => {
      const rssContent = `<?xml version="1.0" encoding="UTF-8"?>
        <rss version="2.0">
          <channel>
            <title>Test Feed</title>
            <description>A test RSS feed</description>
            <link>https://example.com</link>
            <item>
              <title>Test Article</title>
              <description>Test article description</description>
              <link>https://example.com/article1</link>
              <pubDate>Wed, 01 Jan 2025 12:00:00 GMT</pubDate>
            </item>
          </channel>
        </rss>`;

      const result = await parseFeedContent(rssContent);
      expect(result.success).to.be.true;
      expect(result.feed).to.have.property('title', 'Test Feed');
      expect(result.feed).to.have.property('description', 'A test RSS feed');
      expect(result.feed.items).to.have.length(1);
      expect(result.feed.items[0]).to.have.property('title', 'Test Article');
    });

    it('should handle invalid RSS content', async () => {
      const invalidContent = 'This is not valid RSS content';
      
      const result = await parseFeedContent(invalidContent);
      expect(result.success).to.be.false;
      expect(result.error).to.exist;
    });

    it('should parse Atom feeds', async () => {
      const atomContent = `<?xml version="1.0" encoding="UTF-8"?>
        <feed xmlns="http://www.w3.org/2005/Atom">
          <title>Test Atom Feed</title>
          <subtitle>A test Atom feed</subtitle>
          <link href="https://example.com"/>
          <entry>
            <title>Test Entry</title>
            <summary>Test entry summary</summary>
            <link href="https://example.com/entry1"/>
            <updated>2025-01-01T12:00:00Z</updated>
          </entry>
        </feed>`;

      const result = await parseFeedContent(atomContent);
      expect(result.success).to.be.true;
      expect(result.feed).to.have.property('title', 'Test Atom Feed');
      expect(result.feed.items).to.have.length(1);
    });
  });

  describe('extractFeedMetadata', () => {
    it('should extract metadata from feed object', () => {
      const feedData = {
        title: 'Example Blog',
        description: 'A blog about examples',
        link: 'https://example.com',
        language: 'en',
        lastBuildDate: '2025-01-01T12:00:00Z',
        items: [
          { title: 'Post 1', pubDate: '2025-01-01T10:00:00Z' },
          { title: 'Post 2', pubDate: '2025-01-01T11:00:00Z' },
        ],
      };

      const metadata = extractFeedMetadata(feedData);
      expect(metadata).to.have.property('title', 'Example Blog');
      expect(metadata).to.have.property('description', 'A blog about examples');
      expect(metadata).to.have.property('url', 'https://example.com');
      expect(metadata).to.have.property('language', 'en');
      expect(metadata).to.have.property('itemCount', 2);
      expect(metadata).to.have.property('lastUpdated');
    });

    it('should handle missing metadata fields', () => {
      const feedData = {
        title: 'Minimal Feed',
        items: [],
      };

      const metadata = extractFeedMetadata(feedData);
      expect(metadata).to.have.property('title', 'Minimal Feed');
      expect(metadata).to.have.property('description', '');
      expect(metadata).to.have.property('itemCount', 0);
    });
  });

  describe('importRSSFeed', () => {
    it('should import RSS feed from URL', async () => {
      // Mock RSS content for testing
      const mockRssContent = `<?xml version="1.0" encoding="UTF-8"?>
        <rss version="2.0">
          <channel>
            <title>Mock Feed</title>
            <description>Mock RSS feed for testing</description>
            <link>https://mock.example.com</link>
            <item>
              <title>Mock Article</title>
              <description>Mock article description</description>
              <link>https://mock.example.com/article1</link>
              <pubDate>Wed, 01 Jan 2025 12:00:00 GMT</pubDate>
            </item>
          </channel>
        </rss>`;

      // Test with mock content (actual HTTP requests would be mocked in real tests)
      const result = await importRSSFeed('https://mock.example.com/feed.xml', {
        mockContent: mockRssContent,
      });

      expect(result.success).to.be.true;
      expect(result.feed).to.have.property('title', 'Mock Feed');
      expect(result.feed.items).to.have.length(1);
    });

    it('should handle network errors gracefully', async () => {
      const result = await importRSSFeed('https://nonexistent.example.com/feed.xml');
      expect(result.success).to.be.false;
      expect(result.error).to.exist;
    });
  });

  describe('importOPML', () => {
    it('should import feeds from OPML file', async () => {
      const opmlContent = `<?xml version="1.0" encoding="UTF-8"?>
        <opml version="2.0">
          <head>
            <title>My Feeds</title>
          </head>
          <body>
            <outline text="Tech News" title="Tech News">
              <outline type="rss" text="Example Tech" title="Example Tech" 
                       xmlUrl="https://example.com/tech/feed.xml" 
                       htmlUrl="https://example.com/tech"/>
              <outline type="rss" text="Another Tech Blog" title="Another Tech Blog"
                       xmlUrl="https://another.example.com/feed.rss"
                       htmlUrl="https://another.example.com"/>
            </outline>
            <outline type="rss" text="Personal Blog" title="Personal Blog"
                     xmlUrl="https://personal.example.com/rss"
                     htmlUrl="https://personal.example.com"/>
          </body>
        </opml>`;

      // Create temporary OPML file
      const opmlPath = path.join(tempDataPath, 'test-feeds.opml');
      fs.writeFileSync(opmlPath, opmlContent);

      const result = await importOPML(opmlPath);
      expect(result.success).to.be.true;
      expect(result.feeds).to.have.length(3);
      expect(result.feeds[0]).to.have.property('title', 'Example Tech');
      expect(result.feeds[0]).to.have.property('xmlUrl', 'https://example.com/tech/feed.xml');
    });

    it('should handle invalid OPML files', async () => {
      const invalidOpmlPath = path.join(tempDataPath, 'invalid.opml');
      fs.writeFileSync(invalidOpmlPath, 'This is not valid OPML content');

      const result = await importOPML(invalidOpmlPath);
      expect(result.success).to.be.false;
      expect(result.error).to.exist;
    });

    it('should handle missing OPML files', async () => {
      const missingPath = path.join(tempDataPath, 'nonexistent.opml');
      
      const result = await importOPML(missingPath);
      expect(result.success).to.be.false;
      expect(result.error).to.include('File not found');
    });
  });

  describe('FeedManager methods', () => {
    it('should add feed to manager', async () => {
      const feedUrl = 'https://example.com/feed.xml';
      const result = await feedManager.addFeed(feedUrl, {
        title: 'Test Feed',
        description: 'A test feed',
      });

      expect(result.success).to.be.true;
      expect(result.feedId).to.exist;
    });

    it('should list managed feeds', async () => {
      await feedManager.addFeed('https://example1.com/feed.xml', { title: 'Feed 1' });
      await feedManager.addFeed('https://example2.com/feed.xml', { title: 'Feed 2' });

      const feeds = await feedManager.listFeeds();
      expect(feeds).to.have.length(2);
      expect(feeds[0]).to.have.property('title', 'Feed 1');
      expect(feeds[1]).to.have.property('title', 'Feed 2');
    });

    it('should remove feed from manager', async () => {
      const result = await feedManager.addFeed('https://example.com/feed.xml', { title: 'Test Feed' });
      const feedId = result.feedId;

      const removeResult = await feedManager.removeFeed(feedId);
      expect(removeResult.success).to.be.true;

      const feeds = await feedManager.listFeeds();
      expect(feeds).to.have.length(0);
    });

    it('should get feed items', async () => {
      const result = await feedManager.addFeed('https://example.com/feed.xml', { 
        title: 'Test Feed',
        items: [
          { title: 'Item 1', link: 'https://example.com/1' },
          { title: 'Item 2', link: 'https://example.com/2' },
        ],
      });

      const items = await feedManager.getFeedItems(result.feedId);
      expect(items).to.have.length(2);
      expect(items[0]).to.have.property('title', 'Item 1');
    });

    it('should get recent items across all feeds', async () => {
      await feedManager.addFeed('https://example1.com/feed.xml', {
        title: 'Feed 1',
        items: [
          { title: 'Item 1', pubDate: '2025-01-01T12:00:00Z' },
          { title: 'Item 2', pubDate: '2025-01-01T11:00:00Z' },
        ],
      });

      await feedManager.addFeed('https://example2.com/feed.xml', {
        title: 'Feed 2',
        items: [
          { title: 'Item 3', pubDate: '2025-01-01T13:00:00Z' },
        ],
      });

      const recentItems = await feedManager.getRecentItems(5);
      expect(recentItems).to.have.length(3);
      // Should be sorted by date, newest first
      expect(recentItems[0]).to.have.property('title', 'Item 3');
    });
  });

  describe('fetchFeedItems', () => {
    it('should fetch and parse feed items from URL', async () => {
      const mockContent = `<?xml version="1.0" encoding="UTF-8"?>
        <rss version="2.0">
          <channel>
            <title>Fetch Test Feed</title>
            <item>
              <title>Fetched Item</title>
              <description>Fetched item description</description>
              <link>https://example.com/fetched</link>
              <pubDate>Wed, 01 Jan 2025 12:00:00 GMT</pubDate>
            </item>
          </channel>
        </rss>`;

      const result = await fetchFeedItems('https://example.com/feed.xml', {
        mockContent,
        maxItems: 10,
      });

      expect(result.success).to.be.true;
      expect(result.items).to.have.length(1);
      expect(result.items[0]).to.have.property('title', 'Fetched Item');
    });

    it('should limit number of items returned', async () => {
      const mockContent = `<?xml version="1.0" encoding="UTF-8"?>
        <rss version="2.0">
          <channel>
            <title>Limit Test Feed</title>
            <item><title>Item 1</title></item>
            <item><title>Item 2</title></item>
            <item><title>Item 3</title></item>
            <item><title>Item 4</title></item>
            <item><title>Item 5</title></item>
          </channel>
        </rss>`;

      const result = await fetchFeedItems('https://example.com/feed.xml', {
        mockContent,
        maxItems: 3,
      });

      expect(result.success).to.be.true;
      expect(result.items).to.have.length(3);
    });
  });
});