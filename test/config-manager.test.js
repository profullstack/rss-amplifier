/**
 * Configuration Manager Tests
 * Testing RSS Amplifier configuration management functionality
 */

import { expect } from 'chai';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
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
  validateOpenAIApiKey,
} from '../src/config-manager.js';

describe('Configuration Manager', () => {
  let tempConfigPath;

  beforeEach(() => {
    // Create temporary config path for testing
    tempConfigPath = path.join(os.tmpdir(), `rss-amplifier-test-${Date.now()}.json`);
  });

  afterEach(() => {
    // Clean up temporary config file
    if (fs.existsSync(tempConfigPath)) {
      fs.unlinkSync(tempConfigPath);
    }
  });

  describe('getConfigPath', () => {
    it('should return correct config path', () => {
      const configPath = getConfigPath();
      expect(configPath).to.include('.config');
      expect(configPath).to.include('rss-amplifier');
      expect(configPath).to.include('config.json');
    });
  });

  describe('getDefaultConfig', () => {
    it('should return valid default configuration', () => {
      const config = getDefaultConfig();
      
      expect(config).to.be.an('object');
      expect(config).to.have.property('platforms');
      expect(config).to.have.property('general');
      expect(config).to.have.property('ai');
      expect(config).to.have.property('feeds');
      expect(config).to.have.property('snippets');
      expect(config).to.have.property('supabase');
    });

    it('should include all required platform configurations', () => {
      const config = getDefaultConfig();
      const expectedPlatforms = ['mastodon', 'bluesky', 'x', 'linkedin', 'nostr'];
      
      for (const platform of expectedPlatforms) {
        expect(config.platforms).to.have.property(platform);
        expect(config.platforms[platform]).to.have.property('enabled');
      }
    });

    it('should have proper AI configuration defaults', () => {
      const config = getDefaultConfig();
      
      expect(config.ai).to.have.property('enabled', false);
      expect(config.ai).to.have.property('provider', 'openai');
      expect(config.ai).to.have.property('model');
      expect(config.ai).to.have.property('temperature');
      expect(config.ai).to.have.property('maxTokens');
    });
  });

  describe('validateConfig', () => {
    it('should validate correct configuration', () => {
      const config = getDefaultConfig();
      const result = validateConfig(config);
      
      expect(result).to.have.property('valid', true);
      expect(result).to.have.property('errors');
      expect(result.errors).to.be.an('array').that.is.empty;
    });

    it('should reject invalid configuration object', () => {
      const result = validateConfig(null);
      
      expect(result).to.have.property('valid', false);
      expect(result.errors).to.include('Configuration must be an object');
    });

    it('should validate AI configuration when enabled', () => {
      const config = getDefaultConfig();
      config.ai.enabled = true;
      config.ai.openaiApiKey = 'invalid-key';
      
      const result = validateConfig(config);
      
      expect(result).to.have.property('valid', false);
      expect(result.errors).to.include('OpenAI API key format is invalid (should start with "sk-")');
    });

    it('should validate platform configurations when enabled', () => {
      const config = getDefaultConfig();
      config.platforms.mastodon.enabled = true;
      // Missing required fields
      
      const result = validateConfig(config);
      
      expect(result).to.have.property('valid', false);
      expect(result.errors.length).to.be.greaterThan(0);
    });
  });

  describe('loadConfig', () => {
    it('should return default config when file does not exist', () => {
      const config = loadConfig('/nonexistent/path/config.json');
      const defaultConfig = getDefaultConfig();
      
      expect(config).to.deep.equal(defaultConfig);
    });

    it('should load and merge existing config', () => {
      const customConfig = {
        general: {
          brandContext: 'Test Brand Context',
        },
        ai: {
          enabled: true,
          openaiApiKey: 'sk-test123',
        },
      };
      
      fs.writeFileSync(tempConfigPath, JSON.stringify(customConfig));
      const loadedConfig = loadConfig(tempConfigPath);
      
      expect(loadedConfig.general.brandContext).to.equal('Test Brand Context');
      expect(loadedConfig.ai.enabled).to.equal(true);
      expect(loadedConfig.ai.openaiApiKey).to.equal('sk-test123');
      // Should still have default values
      expect(loadedConfig.platforms).to.exist;
    });
  });

  describe('saveConfig', () => {
    it('should save configuration to file', () => {
      const config = getDefaultConfig();
      config.general.brandContext = 'Test Save';
      
      const result = saveConfig(config, tempConfigPath);
      
      expect(result).to.have.property('success', true);
      expect(fs.existsSync(tempConfigPath)).to.be.true;
      
      const savedData = JSON.parse(fs.readFileSync(tempConfigPath, 'utf8'));
      expect(savedData.general.brandContext).to.equal('Test Save');
    });

    it('should handle save errors gracefully', () => {
      const config = getDefaultConfig();
      const invalidPath = '/invalid/path/config.json';
      
      const result = saveConfig(config, invalidPath);
      
      expect(result).to.have.property('success', false);
      expect(result).to.have.property('error');
    });
  });

  describe('mergeConfig', () => {
    it('should merge configurations deeply', () => {
      const defaultConfig = getDefaultConfig();
      const userConfig = {
        general: {
          brandContext: 'Custom Brand',
        },
        platforms: {
          mastodon: {
            enabled: true,
            instanceUrl: 'https://mastodon.social',
          },
        },
      };
      
      const merged = mergeConfig(defaultConfig, userConfig);
      
      expect(merged.general.brandContext).to.equal('Custom Brand');
      expect(merged.platforms.mastodon.enabled).to.equal(true);
      expect(merged.platforms.mastodon.instanceUrl).to.equal('https://mastodon.social');
      // Should preserve other default values
      expect(merged.platforms.bluesky).to.exist;
      expect(merged.ai).to.exist;
    });
  });

  describe('getConfigValue and setConfigValue', () => {
    it('should get configuration value by dot notation', () => {
      const config = getDefaultConfig();
      config.platforms.mastodon.enabled = true;
      
      const value = getConfigValue(config, 'platforms.mastodon.enabled');
      expect(value).to.equal(true);
    });

    it('should return default value when path not found', () => {
      const config = getDefaultConfig();
      
      const value = getConfigValue(config, 'nonexistent.path', 'default');
      expect(value).to.equal('default');
    });

    it('should set configuration value by dot notation', () => {
      const config = getDefaultConfig();
      
      setConfigValue(config, 'platforms.mastodon.enabled', true);
      expect(config.platforms.mastodon.enabled).to.equal(true);
    });
  });

  describe('isPlatformReady', () => {
    it('should return false for disabled platform', () => {
      const config = getDefaultConfig();
      
      const ready = isPlatformReady(config, 'mastodon');
      expect(ready).to.equal(false);
    });

    it('should return false for enabled platform without required config', () => {
      const config = getDefaultConfig();
      config.platforms.mastodon.enabled = true;
      
      const ready = isPlatformReady(config, 'mastodon');
      expect(ready).to.equal(false);
    });

    it('should return true for properly configured platform', () => {
      const config = getDefaultConfig();
      config.platforms.mastodon.enabled = true;
      config.platforms.mastodon.instanceUrl = 'https://mastodon.social';
      config.platforms.mastodon.accessToken = 'valid-token';
      
      const ready = isPlatformReady(config, 'mastodon');
      expect(ready).to.equal(true);
    });
  });

  describe('getReadyPlatforms', () => {
    it('should return empty array when no platforms are ready', () => {
      const config = getDefaultConfig();
      
      const ready = getReadyPlatforms(config);
      expect(ready).to.be.an('array').that.is.empty;
    });

    it('should return array of ready platforms', () => {
      const config = getDefaultConfig();
      config.platforms.mastodon.enabled = true;
      config.platforms.mastodon.instanceUrl = 'https://mastodon.social';
      config.platforms.mastodon.accessToken = 'valid-token';
      
      const ready = getReadyPlatforms(config);
      expect(ready).to.include('mastodon');
    });
  });

  describe('getPlatformDisplayName', () => {
    it('should return correct display names', () => {
      expect(getPlatformDisplayName('mastodon')).to.equal('Mastodon');
      expect(getPlatformDisplayName('bluesky')).to.equal('Bluesky');
      expect(getPlatformDisplayName('x')).to.equal('X (Twitter)');
      expect(getPlatformDisplayName('linkedin')).to.equal('LinkedIn');
      expect(getPlatformDisplayName('nostr')).to.equal('Nostr');
    });

    it('should return original name for unknown platforms', () => {
      expect(getPlatformDisplayName('unknown')).to.equal('unknown');
    });
  });

  describe('validateOpenAIApiKey', () => {
    it('should validate correct OpenAI API key format', () => {
      expect(validateOpenAIApiKey('sk-1234567890abcdef')).to.equal(true);
      expect(validateOpenAIApiKey('sk-proj-1234567890abcdef')).to.equal(true);
    });

    it('should reject invalid API key formats', () => {
      expect(validateOpenAIApiKey('invalid-key')).to.equal(false);
      expect(validateOpenAIApiKey('ak-1234567890abcdef')).to.equal(false);
      expect(validateOpenAIApiKey('')).to.equal(false);
      expect(validateOpenAIApiKey(null)).to.equal(false);
    });
  });

  describe('isAIReady', () => {
    it('should return false when AI is disabled', () => {
      const config = getDefaultConfig();
      
      const ready = isAIReady(config);
      expect(ready).to.equal(false);
    });

    it('should return false when AI is enabled but no API key', () => {
      const config = getDefaultConfig();
      config.ai.enabled = true;
      
      const ready = isAIReady(config);
      expect(ready).to.equal(false);
    });

    it('should return true when AI is properly configured', () => {
      const config = getDefaultConfig();
      config.ai.enabled = true;
      config.ai.openaiApiKey = 'sk-1234567890abcdef';
      
      const ready = isAIReady(config);
      expect(ready).to.equal(true);
    });
  });

  describe('getAIConfig', () => {
    it('should return null when AI is not ready', () => {
      const config = getDefaultConfig();
      
      const aiConfig = getAIConfig(config);
      expect(aiConfig).to.equal(null);
    });

    it('should return AI configuration when ready', () => {
      const config = getDefaultConfig();
      config.ai.enabled = true;
      config.ai.openaiApiKey = 'sk-1234567890abcdef';
      
      const aiConfig = getAIConfig(config);
      expect(aiConfig).to.be.an('object');
      expect(aiConfig).to.have.property('apiKey', 'sk-1234567890abcdef');
      expect(aiConfig).to.have.property('provider');
      expect(aiConfig).to.have.property('model');
    });
  });
});