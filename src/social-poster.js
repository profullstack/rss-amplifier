/**
 * Social Poster Integration
 * Wrapper around @profullstack/social-poster for RSS Amplifier
 */

import { SocialPoster as BaseSocialPoster, quickPost } from '@profullstack/social-poster';
import colors from 'ansi-colors';

/**
 * RSS Amplifier Social Poster
 * Integrates with @profullstack/social-poster for multi-platform posting
 */
export class SocialPoster {
  constructor(config = {}) {
    this.config = config;
    this.socialPoster = new BaseSocialPoster({
      headless: config.headless ?? true,
      timeout: config.timeout ?? 30000,
      configPath: config.socialPosterConfigPath,
    });
  }

  /**
   * Post content to social platforms
   * @param {object} content - Content to post
   * @param {string[]} platforms - Target platforms
   * @returns {Promise<object>} Post results
   */
  async post(content, platforms = []) {
    try {
      // Convert RSS Amplifier content format to social-poster format
      const socialContent = this.convertContentFormat(content);
      
      // Use social-poster to handle the actual posting
      const result = await this.socialPoster.post(socialContent, platforms);
      
      return {
        success: true,
        results: result.results || {},
        platforms: platforms,
        content: socialContent,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        platforms: platforms,
        content,
      };
    }
  }

  /**
   * Convert RSS Amplifier content format to social-poster format
   * @param {object} content - RSS Amplifier content
   * @returns {object} Social-poster compatible content
   */
  convertContentFormat(content) {
    // Handle different content types from RSS Amplifier
    if (typeof content === 'string') {
      return { text: content, type: 'text' };
    }

    if (content.text) {
      const socialContent = {
        text: content.text,
        type: content.link ? 'link' : 'text',
      };

      // Add link if present (but RSS Amplifier typically avoids direct links)
      if (content.link && content.includeLinks) {
        socialContent.link = content.link;
      }

      // Add media if present
      if (content.media) {
        socialContent.file = content.media.path || content.media.file;
        socialContent.type = socialContent.link ? 'media-link' : 'media';
      }

      return socialContent;
    }

    throw new Error('Invalid content format for social posting');
  }

  /**
   * Get available platforms from social-poster
   * @returns {string[]} Array of platform names
   */
  getAvailablePlatforms() {
    return this.socialPoster.getAvailablePlatforms();
  }

  /**
   * Get authentication status for all platforms
   * @returns {object} Status for each platform
   */
  getAuthStatus() {
    return this.socialPoster.getAuthStatus();
  }

  /**
   * Login to a specific platform
   * @param {string} platform - Platform name
   * @param {object} options - Login options
   * @returns {Promise<boolean>} Success status
   */
  async login(platform, options = {}) {
    return await this.socialPoster.login(platform, options);
  }

  /**
   * Get platform status for RSS Amplifier
   * @returns {object} Platform status information
   */
  getStatus() {
    const authStatus = this.getAuthStatus();
    const availablePlatforms = this.getAvailablePlatforms();

    return {
      available: availablePlatforms,
      authenticated: Object.keys(authStatus).filter(
        platform => authStatus[platform].loggedIn
      ),
      configured: Object.keys(authStatus).filter(
        platform => authStatus[platform].enabled
      ),
      ready: Object.keys(authStatus).filter(
        platform => authStatus[platform].enabled && authStatus[platform].loggedIn
      ),
    };
  }

  /**
   * Close and clean up resources
   */
  async close() {
    await this.socialPoster.close();
  }
}

/**
 * Quick post function using social-poster
 * @param {object} content - Content to post
 * @param {object} options - Posting options
 * @returns {Promise<object>} Post results
 */
export async function postToSocial(content, options = {}) {
  try {
    // Convert content format
    const socialContent = typeof content === 'string' 
      ? { text: content, type: 'text' }
      : content;

    // Use social-poster's quickPost function
    const result = await quickPost(socialContent, {
      platforms: options.platforms,
      headless: options.headless ?? true,
    });

    return {
      success: true,
      results: result.results || {},
      content: socialContent,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      content,
    };
  }
}

/**
 * Platform-specific posting functions
 */

export async function postToX(content, options = {}) {
  return await postToSocial(content, { ...options, platforms: ['x'] });
}

export async function postToLinkedIn(content, options = {}) {
  return await postToSocial(content, { ...options, platforms: ['linkedin'] });
}

export async function postToReddit(content, options = {}) {
  return await postToSocial(content, { ...options, platforms: ['reddit'] });
}

export async function postToFacebook(content, options = {}) {
  return await postToSocial(content, { ...options, platforms: ['facebook'] });
}

export async function postToHackerNews(content, options = {}) {
  return await postToSocial(content, { ...options, platforms: ['hacker-news'] });
}

export async function postToStackerNews(content, options = {}) {
  return await postToSocial(content, { ...options, platforms: ['stacker-news'] });
}

export async function postToPrimal(content, options = {}) {
  return await postToSocial(content, { ...options, platforms: ['primal'] });
}

/**
 * Batch posting to multiple platforms
 * @param {object} content - Content to post
 * @param {string[]} platforms - Target platforms
 * @param {object} options - Posting options
 * @returns {Promise<object>} Batch post results
 */
export async function batchPost(content, platforms, options = {}) {
  const poster = new SocialPoster(options);
  
  try {
    const result = await poster.post(content, platforms);
    return result;
  } finally {
    await poster.close();
  }
}

/**
 * Get supported platforms from social-poster
 * @returns {string[]} Array of supported platform names
 */
export function getSupportedPlatforms() {
  // These are the platforms supported by @profullstack/social-poster
  return ['x', 'linkedin', 'reddit', 'facebook', 'hacker-news', 'stacker-news', 'primal'];
}

/**
 * Map RSS Amplifier platform names to social-poster platform names
 * @param {string} platform - RSS Amplifier platform name
 * @returns {string} Social-poster platform name
 */
export function mapPlatformName(platform) {
  const platformMap = {
    'twitter': 'x',
    'x-twitter': 'x',
    'hackernews': 'hacker-news',
    'stackernews': 'stacker-news',
    'nostr': 'primal', // Use Primal as Nostr client
  };

  return platformMap[platform] || platform;
}

/**
 * Validate content for social posting
 * @param {object} content - Content to validate
 * @returns {object} Validation result
 */
export function validateSocialContent(content) {
  const errors = [];

  if (!content) {
    errors.push('Content is required');
    return { valid: false, errors };
  }

  if (typeof content === 'string') {
    if (content.trim().length === 0) {
      errors.push('Content text cannot be empty');
    }
    if (content.length > 280) {
      errors.push('Content text is too long (maximum 280 characters)');
    }
  } else if (typeof content === 'object') {
    if (!content.text || content.text.trim().length === 0) {
      errors.push('Content text is required');
    }
    if (content.text && content.text.length > 280) {
      errors.push('Content text is too long (maximum 280 characters)');
    }
    if (content.link) {
      try {
        new URL(content.link);
      } catch {
        errors.push('Invalid URL format in content link');
      }
    }
  } else {
    errors.push('Content must be a string or object');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export default {
  SocialPoster,
  postToSocial,
  postToX,
  postToLinkedIn,
  postToReddit,
  postToFacebook,
  postToHackerNews,
  postToStackerNews,
  postToPrimal,
  batchPost,
  getSupportedPlatforms,
  mapPlatformName,
  validateSocialContent,
};