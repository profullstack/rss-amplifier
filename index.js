/**
 * @profullstack/rss-amplifier - Main module export
 * Contextual RSS amplification with AI-driven snippet generation
 */

// Core modules
export {
  getConfigPath,
  getDefaultConfig,
  validateConfig,
  loadConfig,
  saveConfig,
  mergeConfig,
  getConfigValue,
  setConfigValue,
  isPlatformReady,
  getReadyPlatforms,
  getPlatformDisplayName,
  isAIReady,
  getAIConfig,
} from './src/config-manager.js';

export {
  FeedManager,
  importOPML,
  importRSSFeed,
  fetchFeedItems,
  scheduleFeedFetching,
} from './src/feed-manager.js';

export {
  SnippetManager,
  generateSnippet,
  approveSnippet,
  editSnippet,
  deleteSnippet,
  listSnippets,
} from './src/snippet-manager.js';

export {
  AIService,
  initializeAIService,
  generateContextualSnippet,
} from './src/ai-service.js';

export {
  SocialPoster,
  postToMastodon,
  postToBluesky,
  postToTwitter,
  postToLinkedIn,
  postToNostr,
} from './src/social-poster.js';

/**
 * RSS Amplifier class - Main orchestrator
 */
export class RSSAmplifier {
  constructor(options = {}) {
    this.options = {
      configPath: null,
      brandContext: '',
      aiProvider: 'openai', // 'openai' or 'ollama'
      ...options,
    };

    this.config = loadConfig(this.options.configPath);
    this.feedManager = new FeedManager(this.config);
    this.snippetManager = new SnippetManager(this.config);
    this.aiService = initializeAIService(this.config);
    this.socialPoster = new SocialPoster(this.config);
  }

  /**
   * Import OPML file and add feeds
   * @param {string} opmlPath - Path to OPML file
   * @returns {Promise<object>} Import result
   */
  async importOPML(opmlPath) {
    return await this.feedManager.importOPML(opmlPath);
  }

  /**
   * Import single RSS feed
   * @param {string} feedUrl - RSS feed URL
   * @returns {Promise<object>} Import result
   */
  async importRSSFeed(feedUrl) {
    return await this.feedManager.importRSSFeed(feedUrl);
  }

  /**
   * Generate contextual snippets from recent feed items
   * @param {object} options - Generation options
   * @returns {Promise<object[]>} Generated snippets
   */
  async generateSnippets(options = {}) {
    const feedItems = await this.feedManager.getRecentItems(options.limit || 10);
    const snippets = [];

    for (const item of feedItems) {
      const snippet = await this.aiService.generateContextualSnippet({
        content: item,
        brandContext: this.options.brandContext,
        style: options.style || 'viral',
      });
      
      if (snippet.success) {
        snippets.push(snippet.data);
      }
    }

    return snippets;
  }

  /**
   * Post approved snippets to social platforms
   * @param {string} snippetId - Snippet ID to post
   * @param {string[]} platforms - Target platforms
   * @returns {Promise<object>} Post results
   */
  async postSnippet(snippetId, platforms = []) {
    const snippet = await this.snippetManager.getSnippet(snippetId);
    if (!snippet) {
      throw new Error(`Snippet ${snippetId} not found`);
    }

    return await this.socialPoster.post(snippet.content, platforms);
  }

  /**
   * Get available platforms for posting
   * @returns {string[]} Array of platform names
   */
  getAvailablePlatforms() {
    return this.socialPoster.getAvailablePlatforms();
  }

  /**
   * Get system status
   * @returns {object} Status information
   */
  getStatus() {
    return {
      feeds: this.feedManager.getStatus(),
      snippets: this.snippetManager.getStatus(),
      ai: this.aiService.getStatus(),
      social: this.socialPoster.getStatus(),
    };
  }

  /**
   * Close and clean up resources
   */
  async close() {
    await this.feedManager.close();
    await this.snippetManager.close();
    await this.socialPoster.close();
  }
}

/**
 * Quick start function for simple RSS amplification
 * @param {string} opmlPath - Path to OPML file
 * @param {object} options - Configuration options
 * @returns {Promise<object>} Amplification results
 */
export async function quickAmplify(opmlPath, options = {}) {
  const amplifier = new RSSAmplifier(options);

  try {
    // Import feeds
    await amplifier.importOPML(opmlPath);
    
    // Generate snippets
    const snippets = await amplifier.generateSnippets(options);
    
    // Auto-approve if specified
    if (options.autoApprove) {
      for (const snippet of snippets) {
        await amplifier.snippetManager.approveSnippet(snippet.id);
      }
    }

    return { success: true, snippets };
  } finally {
    await amplifier.close();
  }
}

/**
 * Validate RSS Amplifier configuration
 * @param {object} config - Configuration to validate
 * @returns {object} Validation result
 */
export function validateAmplifierConfig(config) {
  return validateConfig(config);
}

// Default export
export default {
  RSSAmplifier,
  quickAmplify,
  validateAmplifierConfig,
  loadConfig,
  FeedManager,
  SnippetManager,
  AIService,
  SocialPoster,
};