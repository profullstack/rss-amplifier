/**
 * Configuration Manager
 * Handles user configuration for RSS Amplifier
 */

import fs from 'fs';
import path from 'path';
import os from 'os';

/**
 * Get the path to the configuration file
 * @returns {string} Full path to config.json
 */
export function getConfigPath() {
  return path.join(os.homedir(), '.config', 'rss-amplifier', 'config.json');
}

/**
 * Get default configuration structure
 * @returns {object} Default configuration object
 */
export function getDefaultConfig() {
  return {
    platforms: {
      x: {
        enabled: false,
        accessToken: '',
        refreshToken: '',
        expiresAt: '',
        clientId: '',
        clientSecret: '',
      },
      linkedin: {
        enabled: false,
        accessToken: '',
        refreshToken: '',
        expiresAt: '',
        clientId: '',
        clientSecret: '',
      },
      reddit: {
        enabled: false,
        accessToken: '',
        refreshToken: '',
        expiresAt: '',
        clientId: '',
        clientSecret: '',
        username: '',
      },
      facebook: {
        enabled: false,
        accessToken: '',
        refreshToken: '',
        expiresAt: '',
        clientId: '',
        clientSecret: '',
        pageId: '',
      },
      'hacker-news': {
        enabled: false,
        username: '',
        password: '',
        sessionCookie: '',
      },
      'stacker-news': {
        enabled: false,
        apiKey: '',
        accessToken: '',
        refreshToken: '',
        expiresAt: '',
      },
      primal: {
        enabled: false,
        privateKey: '',
        publicKey: '',
        relays: ['wss://relay.primal.net'],
      },
    },
    general: {
      brandContext: '',
      defaultPlatforms: [],
      retryAttempts: 3,
      timeout: 30000,
      logLevel: 'info',
      rateLimitDelay: 1000,
    },
    ai: {
      enabled: false,
      provider: 'openai', // 'openai' or 'ollama'
      openaiApiKey: '',
      ollamaUrl: 'http://localhost:11434',
      model: 'gpt-4o-mini',
      maxTokens: 500,
      temperature: 0.7,
    },
    feeds: {
      refreshInterval: 3600000, // 1 hour in milliseconds
      maxItems: 100,
      enableScheduling: true,
      scheduleCron: '0 */6 * * *', // Every 6 hours
    },
    snippets: {
      autoApprove: false,
      maxLength: 280,
      includeHashtags: true,
      includeLinks: false, // Don't include direct links for contextual posting
      styles: ['viral', 'professional', 'casual'],
      defaultStyle: 'viral',
    },
    supabase: {
      url: '',
      anonKey: '',
      enabled: false,
    },
  };
}

/**
 * Validate configuration object
 * @param {object} config - Configuration to validate
 * @returns {object} Validation result with valid flag and errors array
 */
export function validateConfig(config) {
  const errors = [];

  if (!config || typeof config !== 'object') {
    errors.push('Configuration must be an object');
    return { valid: false, errors };
  }

  // Validate platforms
  if (config.platforms) {
    for (const [platformName, platformConfig] of Object.entries(config.platforms)) {
      if (platformConfig?.enabled) {
        // Validate Mastodon
        if (platformName === 'mastodon') {
          if (!platformConfig.instanceUrl?.trim()) {
            errors.push('Mastodon platform is enabled but missing instance URL');
          }
          if (!platformConfig.accessToken?.trim()) {
            errors.push('Mastodon platform is enabled but missing access token');
          }
        }

        // Validate Bluesky
        if (platformName === 'bluesky') {
          if (!platformConfig.handle?.trim()) {
            errors.push('Bluesky platform is enabled but missing handle');
          }
          if (!platformConfig.appPassword?.trim()) {
            errors.push('Bluesky platform is enabled but missing app password');
          }
        }

        // Validate X/Twitter
        if (platformName === 'x') {
          if (!platformConfig.accessToken?.trim()) {
            errors.push('X platform is enabled but missing access token');
          }
          // Check token expiration
          if (platformConfig.expiresAt) {
            const expiryDate = new Date(platformConfig.expiresAt);
            if (expiryDate < new Date()) {
              errors.push('X platform access token has expired');
            }
          }
        }

        // Validate LinkedIn
        if (platformName === 'linkedin') {
          if (!platformConfig.accessToken?.trim()) {
            errors.push('LinkedIn platform is enabled but missing access token');
          }
          // Check token expiration
          if (platformConfig.expiresAt) {
            const expiryDate = new Date(platformConfig.expiresAt);
            if (expiryDate < new Date()) {
              errors.push('LinkedIn platform access token has expired');
            }
          }
        }

        // Validate Nostr
        if (platformName === 'nostr') {
          if (!platformConfig.privateKey?.trim()) {
            errors.push('Nostr platform is enabled but missing private key');
          }
          if (!Array.isArray(platformConfig.relays) || platformConfig.relays.length === 0) {
            errors.push('Nostr platform is enabled but missing relay URLs');
          }
        }
      }
    }
  }

  // Validate general settings
  if (config.general) {
    const { retryAttempts, timeout, rateLimitDelay } = config.general;

    if (retryAttempts !== undefined) {
      if (!Number.isInteger(retryAttempts) || retryAttempts < 0) {
        errors.push('Retry attempts must be a non-negative integer');
      }
    }

    if (timeout !== undefined) {
      if (!Number.isInteger(timeout) || timeout <= 0) {
        errors.push('Timeout must be a positive integer');
      }
    }

    if (rateLimitDelay !== undefined) {
      if (!Number.isInteger(rateLimitDelay) || rateLimitDelay < 0) {
        errors.push('Rate limit delay must be a non-negative integer');
      }
    }
  }

  // Validate AI settings
  if (config.ai) {
    const { enabled, provider, openaiApiKey, model, maxTokens, temperature } = config.ai;

    if (enabled && provider === 'openai' && !openaiApiKey?.trim()) {
      errors.push('AI is enabled with OpenAI provider but API key is missing');
    }

    if (openaiApiKey && !validateOpenAIApiKey(openaiApiKey)) {
      errors.push('OpenAI API key format is invalid (should start with "sk-")');
    }

    if (maxTokens !== undefined) {
      if (!Number.isInteger(maxTokens) || maxTokens <= 0 || maxTokens > 4096) {
        errors.push('Max tokens must be a positive integer between 1 and 4096');
      }
    }

    if (temperature !== undefined) {
      if (typeof temperature !== 'number' || temperature < 0 || temperature > 2) {
        errors.push('Temperature must be a number between 0 and 2');
      }
    }

    if (model !== undefined && typeof model !== 'string') {
      errors.push('Model must be a string');
    }

    if (provider !== undefined && !['openai', 'ollama'].includes(provider)) {
      errors.push('AI provider must be either "openai" or "ollama"');
    }
  }

  // Validate feeds settings
  if (config.feeds) {
    const { refreshInterval, maxItems } = config.feeds;

    if (refreshInterval !== undefined) {
      if (!Number.isInteger(refreshInterval) || refreshInterval <= 0) {
        errors.push('Feed refresh interval must be a positive integer');
      }
    }

    if (maxItems !== undefined) {
      if (!Number.isInteger(maxItems) || maxItems <= 0) {
        errors.push('Max feed items must be a positive integer');
      }
    }
  }

  // Validate Supabase settings
  if (config.supabase?.enabled) {
    if (!config.supabase.url?.trim()) {
      errors.push('Supabase is enabled but URL is missing');
    }
    if (!config.supabase.anonKey?.trim()) {
      errors.push('Supabase is enabled but anonymous key is missing');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Load configuration from file
 * @param {string} [configPath] - Optional custom config path
 * @returns {object} Configuration object
 */
export function loadConfig(configPath = getConfigPath()) {
  try {
    if (!fs.existsSync(configPath)) {
      return getDefaultConfig();
    }

    const configData = fs.readFileSync(configPath, 'utf8');
    const config = JSON.parse(configData);

    // Merge with defaults to ensure all fields exist
    return mergeConfig(getDefaultConfig(), config);
  } catch (error) {
    console.warn(`Failed to load config from ${configPath}: ${error.message}`);
    return getDefaultConfig();
  }
}

/**
 * Save configuration to file
 * @param {object} config - Configuration object to save
 * @param {string} [configPath] - Optional custom config path
 * @returns {object} Result with success flag and optional error message
 */
export function saveConfig(config, configPath = getConfigPath()) {
  try {
    // Ensure directory exists
    const configDir = path.dirname(configPath);
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    // Save config (validation is optional and done elsewhere)
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: `Failed to save config: ${error.message}`,
    };
  }
}

/**
 * Merge configuration objects (deep merge)
 * @param {object} defaultConfig - Default configuration
 * @param {object} userConfig - User configuration to merge
 * @returns {object} Merged configuration
 */
export function mergeConfig(defaultConfig, userConfig) {
  const merged = JSON.parse(JSON.stringify(defaultConfig)); // Deep clone

  function deepMerge(target, source) {
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        if (!target[key]) target[key] = {};
        deepMerge(target[key], source[key]);
      } else {
        target[key] = source[key];
      }
    }
  }

  deepMerge(merged, userConfig);
  return merged;
}

/**
 * Get configuration value by dot notation path
 * @param {object} config - Configuration object
 * @param {string} path - Dot notation path (e.g., 'platforms.mastodon.enabled')
 * @param {*} defaultValue - Default value if path not found
 * @returns {*} Configuration value
 */
export function getConfigValue(config, path, defaultValue = null) {
  return path.split('.').reduce((obj, key) => obj?.[key], config) ?? defaultValue;
}

/**
 * Set configuration value by dot notation path
 * @param {object} config - Configuration object to modify
 * @param {string} path - Dot notation path (e.g., 'platforms.mastodon.enabled')
 * @param {*} value - Value to set
 * @returns {object} Modified configuration object
 */
export function setConfigValue(config, path, value) {
  const keys = path.split('.');
  const lastKey = keys.pop();
  const target = keys.reduce((obj, key) => {
    if (!obj[key]) obj[key] = {};
    return obj[key];
  }, config);

  target[lastKey] = value;
  return config;
}

/**
 * Check if platform is enabled and properly configured
 * @param {object} config - Configuration object
 * @param {string} platformName - Platform name
 * @returns {boolean} True if platform is ready to use
 */
export function isPlatformReady(config, platformName) {
  const platform = config?.platforms?.[platformName];
  if (!platform?.enabled) {
    return false;
  }

  const validation = validateConfig({ platforms: { [platformName]: platform } });
  return validation.valid;
}

/**
 * Get list of enabled and ready platforms
 * @param {object} config - Configuration object
 * @returns {string[]} Array of platform names that are ready
 */
export function getReadyPlatforms(config) {
  const platforms = [];

  if (config?.platforms) {
    for (const platformName of Object.keys(config.platforms)) {
      if (isPlatformReady(config, platformName)) {
        platforms.push(platformName);
      }
    }
  }

  return platforms;
}

/**
 * Get platform display name
 * @param {string} platformName - Internal platform name
 * @returns {string} Display name
 */
export function getPlatformDisplayName(platformName) {
  const displayNames = {
    x: 'X (Twitter)',
    linkedin: 'LinkedIn',
    reddit: 'Reddit',
    facebook: 'Facebook',
    'hacker-news': 'Hacker News',
    'stacker-news': 'Stacker News',
    primal: 'Primal (Nostr)',
  };

  return displayNames[platformName] || platformName;
}

/**
 * Validate OpenAI API key format
 * @param {string} apiKey - API key to validate
 * @returns {boolean} True if valid format
 */
export function validateOpenAIApiKey(apiKey) {
  if (!apiKey || typeof apiKey !== 'string') {
    return false;
  }

  // OpenAI API keys start with 'sk-' and are followed by alphanumeric characters
  // Also support project keys that start with 'sk-proj-'
  return /^sk-[a-zA-Z0-9-]+$/.test(apiKey);
}

/**
 * Check if AI is enabled and properly configured
 * @param {object} config - Configuration object
 * @returns {boolean} True if AI is ready to use
 */
export function isAIReady(config) {
  const ai = config?.ai;
  if (!ai?.enabled) {
    return false;
  }

  if (ai.provider === 'openai') {
    return !!(ai.openaiApiKey?.trim() && validateOpenAIApiKey(ai.openaiApiKey));
  }

  if (ai.provider === 'ollama') {
    return !!(ai.ollamaUrl?.trim());
  }

  return false;
}

/**
 * Get AI configuration
 * @param {object} config - Configuration object
 * @returns {object|null} AI configuration or null if not available
 */
export function getAIConfig(config) {
  if (!isAIReady(config)) {
    return null;
  }

  const ai = config.ai;
  return {
    provider: ai.provider,
    apiKey: ai.openaiApiKey,
    ollamaUrl: ai.ollamaUrl,
    model: ai.model || 'gpt-4o-mini',
    maxTokens: ai.maxTokens || 500,
    temperature: ai.temperature || 0.7,
  };
}