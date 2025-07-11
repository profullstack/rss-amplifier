/**
 * Feed Manager
 * Handles RSS/OPML feed import and management for RSS Amplifier
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import Parser from 'rss-parser';
import { parseString as parseXML } from 'xml2js';
import { promisify } from 'util';

const parseXMLAsync = promisify(parseXML);

/**
 * Feed Manager class for handling RSS/OPML operations
 */
export class FeedManager {
  constructor(options = {}) {
    this.options = {
      dataPath: options.dataPath || path.join(os.homedir(), '.config', 'rss-amplifier', 'feeds'),
      maxItems: options.maxItems || 100,
      refreshInterval: options.refreshInterval || 3600000, // 1 hour
      ...options,
    };

    this.parser = new Parser({
      timeout: 10000,
      headers: {
        'User-Agent': 'RSS-Amplifier/1.0',
      },
    });

    this.feeds = new Map();
    this.ensureDataDirectory();
    // Load feeds synchronously in constructor
    this.loadFeedsSync();
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
   * Load feeds from storage (synchronous version for constructor)
   */
  loadFeedsSync() {
    try {
      const feedsFile = path.join(this.options.dataPath, 'feeds.json');
      if (fs.existsSync(feedsFile)) {
        const feedsData = JSON.parse(fs.readFileSync(feedsFile, 'utf8'));
        this.feeds = new Map(Object.entries(feedsData));
      }
    } catch (error) {
      console.warn('Failed to load feeds:', error.message);
    }
  }

  /**
   * Load feeds from storage (async version)
   */
  async loadFeeds() {
    this.loadFeedsSync();
  }

  /**
   * Save feeds to storage (synchronous version)
   */
  saveFeedsSync() {
    try {
      const feedsFile = path.join(this.options.dataPath, 'feeds.json');
      const feedsData = Object.fromEntries(this.feeds);
      fs.writeFileSync(feedsFile, JSON.stringify(feedsData, null, 2));
    } catch (error) {
      console.error('Failed to save feeds:', error.message);
    }
  }

  /**
   * Save feeds to storage (async version)
   */
  async saveFeeds() {
    this.saveFeedsSync();
  }

  /**
   * Add a feed to the manager
   * @param {string} url - Feed URL
   * @param {object} metadata - Feed metadata
   * @returns {Promise<object>} Result with feedId
   */
  async addFeed(url, metadata = {}) {
    try {
      const feedId = this.generateFeedId(url);
      const feedData = {
        id: feedId,
        url,
        title: metadata.title || '',
        description: metadata.description || '',
        items: metadata.items || [],
        lastUpdated: new Date().toISOString(),
        ...metadata,
      };

      this.feeds.set(feedId, feedData);
      await this.saveFeeds();

      return {
        success: true,
        feedId,
        feed: feedData,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Remove a feed from the manager
   * @param {string} feedId - Feed ID
   * @returns {Promise<object>} Result
   */
  async removeFeed(feedId) {
    try {
      if (!this.feeds.has(feedId)) {
        return {
          success: false,
          error: 'Feed not found',
        };
      }

      this.feeds.delete(feedId);
      await this.saveFeeds();

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
   * List all managed feeds
   * @returns {Promise<Array>} Array of feed objects
   */
  async listFeeds() {
    return Array.from(this.feeds.values());
  }

  /**
   * Get items from a specific feed
   * @param {string} feedId - Feed ID
   * @returns {Promise<Array>} Array of feed items
   */
  async getFeedItems(feedId) {
    const feed = this.feeds.get(feedId);
    return feed ? feed.items || [] : [];
  }

  /**
   * Get recent items across all feeds
   * @param {number} limit - Maximum number of items to return
   * @returns {Promise<Array>} Array of recent items
   */
  async getRecentItems(limit = 10) {
    const allItems = [];
    
    for (const feed of this.feeds.values()) {
      if (feed.items) {
        feed.items.forEach(item => {
          allItems.push({
            ...item,
            feedId: feed.id,
            feedTitle: feed.title,
          });
        });
      }
    }

    // Sort by publication date, newest first
    allItems.sort((a, b) => {
      const dateA = new Date(a.pubDate || a.isoDate || 0);
      const dateB = new Date(b.pubDate || b.isoDate || 0);
      return dateB - dateA;
    });

    return allItems.slice(0, limit);
  }

  /**
   * Generate a unique feed ID from URL
   * @param {string} url - Feed URL
   * @returns {string} Feed ID
   */
  generateFeedId(url) {
    // Use full base64 encoding to ensure uniqueness
    return Buffer.from(url).toString('base64').replace(/[^a-zA-Z0-9]/g, '');
  }

  /**
   * Get manager status
   * @returns {object} Status information
   */
  getStatus() {
    return {
      feedCount: this.feeds.size,
      totalItems: Array.from(this.feeds.values()).reduce((sum, feed) => sum + (feed.items?.length || 0), 0),
      dataPath: this.options.dataPath,
      lastUpdated: new Date().toISOString(),
    };
  }

  /**
   * Close and clean up resources
   */
  async close() {
    await this.saveFeeds();
  }
}

/**
 * Validate feed URL
 * @param {string} url - URL to validate
 * @returns {object} Validation result
 */
export function validateFeedUrl(url) {
  const errors = [];

  if (!url || typeof url !== 'string') {
    errors.push('URL is required and must be a string');
    return { valid: false, errors };
  }

  try {
    const urlObj = new URL(url);
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      errors.push('URL must use HTTP or HTTPS protocol');
    }
  } catch {
    errors.push('Invalid URL format');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Parse feed content from string
 * @param {string} content - Feed content
 * @returns {Promise<object>} Parse result
 */
export async function parseFeedContent(content) {
  try {
    const parser = new Parser();
    const feed = await parser.parseString(content);
    
    return {
      success: true,
      feed,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Extract metadata from feed object
 * @param {object} feedData - Feed data object
 * @returns {object} Extracted metadata
 */
export function extractFeedMetadata(feedData) {
  return {
    title: feedData.title || '',
    description: feedData.description || '',
    url: feedData.link || feedData.feedUrl || '',
    language: feedData.language || '',
    lastUpdated: feedData.lastBuildDate || feedData.updated || new Date().toISOString(),
    itemCount: feedData.items ? feedData.items.length : 0,
    generator: feedData.generator || '',
    copyright: feedData.copyright || '',
  };
}

/**
 * Import RSS feed from URL
 * @param {string} url - RSS feed URL
 * @param {object} options - Import options
 * @returns {Promise<object>} Import result
 */
export async function importRSSFeed(url, options = {}) {
  try {
    // Validate URL
    const validation = validateFeedUrl(url);
    if (!validation.valid) {
      return {
        success: false,
        error: `Invalid URL: ${validation.errors.join(', ')}`,
      };
    }

    let feedContent;
    
    // Use mock content for testing
    if (options.mockContent) {
      feedContent = options.mockContent;
    } else {
      // Fetch feed content
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'RSS-Amplifier/1.0',
        },
        timeout: 10000,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      feedContent = await response.text();
    }

    // Parse feed content
    const parseResult = await parseFeedContent(feedContent);
    if (!parseResult.success) {
      return parseResult;
    }

    const feed = parseResult.feed;
    const metadata = extractFeedMetadata(feed);

    return {
      success: true,
      feed: {
        ...metadata,
        url,
        items: feed.items || [],
        originalData: feed,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Import feeds from OPML file
 * @param {string} filePath - Path to OPML file
 * @returns {Promise<object>} Import result
 */
export async function importOPML(filePath) {
  try {
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return {
        success: false,
        error: 'File not found',
      };
    }

    // Read OPML file
    const opmlContent = fs.readFileSync(filePath, 'utf8');
    
    // Parse OPML XML
    const opmlData = await parseXMLAsync(opmlContent);
    
    if (!opmlData.opml || !opmlData.opml.body) {
      return {
        success: false,
        error: 'Invalid OPML format',
      };
    }

    const feeds = [];
    
    // Extract feeds from OPML structure
    const extractFeeds = (outlines) => {
      if (!Array.isArray(outlines)) return;
      
      for (const outline of outlines) {
        const attrs = outline.$ || {};
        
        // If this outline has an xmlUrl, it's a feed
        if (attrs.xmlUrl) {
          feeds.push({
            title: attrs.title || attrs.text || '',
            xmlUrl: attrs.xmlUrl,
            htmlUrl: attrs.htmlUrl || '',
            description: attrs.description || '',
            category: attrs.category || '',
          });
        }
        
        // Recursively process nested outlines
        if (outline.outline) {
          extractFeeds(outline.outline);
        }
      }
    };

    // Process all outlines
    if (opmlData.opml.body[0].outline) {
      extractFeeds(opmlData.opml.body[0].outline);
    }

    return {
      success: true,
      feeds,
      metadata: {
        title: opmlData.opml.head?.[0]?.title?.[0] || 'Imported Feeds',
        dateCreated: opmlData.opml.head?.[0]?.dateCreated?.[0] || new Date().toISOString(),
        feedCount: feeds.length,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Fetch feed items from URL
 * @param {string} url - Feed URL
 * @param {object} options - Fetch options
 * @returns {Promise<object>} Fetch result
 */
export async function fetchFeedItems(url, options = {}) {
  try {
    const maxItems = options.maxItems || 10;
    
    // Import the feed
    const importResult = await importRSSFeed(url, options);
    if (!importResult.success) {
      return importResult;
    }

    const items = importResult.feed.items.slice(0, maxItems);

    return {
      success: true,
      items,
      feed: importResult.feed,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

export default {
  FeedManager,
  importOPML,
  importRSSFeed,
  fetchFeedItems,
  validateFeedUrl,
  parseFeedContent,
  extractFeedMetadata,
};