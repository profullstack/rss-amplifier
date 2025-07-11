/**
 * Setup Wizard
 * Interactive configuration wizard for RSS Amplifier
 */

import inquirer from 'inquirer';
import colors from 'ansi-colors';
import { 
  loadConfig, 
  saveConfig, 
  getDefaultConfig, 
  validateConfig,
  validateOpenAIApiKey 
} from './config-manager.js';

export class SetupWizard {
  constructor(configPath) {
    this.configPath = configPath;
    this.config = loadConfig(configPath);
  }

  /**
   * Run the complete setup wizard
   */
  async run() {
    console.log(colors.cyan('Let\'s configure RSS Amplifier step by step...\n'));

    // Step 1: General Settings
    await this.setupGeneral();

    // Step 2: AI Configuration
    await this.setupAI();

    // Step 3: Platform Configuration
    await this.setupPlatforms();

    // Step 4: Feed Settings
    await this.setupFeeds();

    // Step 5: Supabase (optional)
    await this.setupSupabase();

    // Validate and save configuration
    await this.validateAndSave();
  }

  /**
   * Setup general settings
   */
  async setupGeneral() {
    console.log(colors.yellow('📋 General Settings'));
    console.log(colors.gray('Configure basic RSS Amplifier settings\n'));

    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'brandContext',
        message: 'Enter your brand context (this will be used for AI snippet generation):',
        default: this.config.general.brandContext,
        validate: (input) => {
          if (!input.trim()) {
            return 'Brand context is required for effective snippet generation';
          }
          return true;
        }
      },
      {
        type: 'checkbox',
        name: 'defaultPlatforms',
        message: 'Select default platforms for posting:',
        choices: [
          { name: 'Mastodon', value: 'mastodon' },
          { name: 'Bluesky', value: 'bluesky' },
          { name: 'X (Twitter)', value: 'x' },
          { name: 'LinkedIn', value: 'linkedin' },
          { name: 'Nostr', value: 'nostr' }
        ],
        default: this.config.general.defaultPlatforms
      },
      {
        type: 'list',
        name: 'logLevel',
        message: 'Select log level:',
        choices: ['error', 'warn', 'info', 'debug'],
        default: this.config.general.logLevel
      }
    ]);

    this.config.general.brandContext = answers.brandContext;
    this.config.general.defaultPlatforms = answers.defaultPlatforms;
    this.config.general.logLevel = answers.logLevel;

    console.log(colors.green('✅ General settings configured\n'));
  }

  /**
   * Setup AI configuration
   */
  async setupAI() {
    console.log(colors.yellow('🤖 AI Configuration'));
    console.log(colors.gray('Configure AI providers for snippet generation\n'));

    const { enableAI } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'enableAI',
        message: 'Enable AI-powered snippet generation?',
        default: this.config.ai.enabled
      }
    ]);

    if (!enableAI) {
      this.config.ai.enabled = false;
      console.log(colors.yellow('⚠️  AI disabled - you can enable it later by running setup again\n'));
      return;
    }

    const aiAnswers = await inquirer.prompt([
      {
        type: 'list',
        name: 'provider',
        message: 'Select AI provider:',
        choices: [
          { name: 'OpenAI (GPT models)', value: 'openai' },
          { name: 'Ollama (Local models)', value: 'ollama' }
        ],
        default: this.config.ai.provider
      }
    ]);

    this.config.ai.provider = aiAnswers.provider;

    if (aiAnswers.provider === 'openai') {
      const openaiAnswers = await inquirer.prompt([
        {
          type: 'password',
          name: 'apiKey',
          message: 'Enter your OpenAI API key (starts with sk-):',
          default: this.config.ai.openaiApiKey,
          validate: (input) => {
            if (!input.trim()) {
              return 'OpenAI API key is required';
            }
            if (!validateOpenAIApiKey(input)) {
              return 'Invalid OpenAI API key format (should start with "sk-")';
            }
            return true;
          }
        },
        {
          type: 'list',
          name: 'model',
          message: 'Select OpenAI model:',
          choices: [
            { name: 'GPT-4o Mini (Recommended)', value: 'gpt-4o-mini' },
            { name: 'GPT-4o', value: 'gpt-4o' },
            { name: 'GPT-4 Turbo', value: 'gpt-4-turbo' },
            { name: 'GPT-3.5 Turbo', value: 'gpt-3.5-turbo' }
          ],
          default: this.config.ai.model
        },
        {
          type: 'number',
          name: 'temperature',
          message: 'Set creativity level (0.0 = focused, 1.0 = creative):',
          default: this.config.ai.temperature,
          validate: (input) => {
            if (input < 0 || input > 2) {
              return 'Temperature must be between 0 and 2';
            }
            return true;
          }
        }
      ]);

      this.config.ai.openaiApiKey = openaiAnswers.apiKey;
      this.config.ai.model = openaiAnswers.model;
      this.config.ai.temperature = openaiAnswers.temperature;
    } else {
      const ollamaAnswers = await inquirer.prompt([
        {
          type: 'input',
          name: 'ollamaUrl',
          message: 'Enter Ollama server URL:',
          default: this.config.ai.ollamaUrl || 'http://localhost:11434',
          validate: (input) => {
            try {
              new URL(input);
              return true;
            } catch {
              return 'Please enter a valid URL';
            }
          }
        },
        {
          type: 'input',
          name: 'model',
          message: 'Enter Ollama model name:',
          default: this.config.ai.model || 'llama2',
          validate: (input) => {
            if (!input.trim()) {
              return 'Model name is required';
            }
            return true;
          }
        }
      ]);

      this.config.ai.ollamaUrl = ollamaAnswers.ollamaUrl;
      this.config.ai.model = ollamaAnswers.model;
    }

    this.config.ai.enabled = true;
    console.log(colors.green('✅ AI configuration completed\n'));
  }

  /**
   * Setup platform configurations
   */
  async setupPlatforms() {
    console.log(colors.yellow('🌐 Platform Configuration'));
    console.log(colors.gray('Configure social media platforms for posting\n'));

    const { selectedPlatforms } = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'selectedPlatforms',
        message: 'Select platforms to configure:',
        choices: [
          { name: 'Mastodon', value: 'mastodon' },
          { name: 'Bluesky', value: 'bluesky' },
          { name: 'X (Twitter)', value: 'x' },
          { name: 'LinkedIn', value: 'linkedin' },
          { name: 'Nostr', value: 'nostr' }
        ]
      }
    ]);

    for (const platform of selectedPlatforms) {
      await this.setupPlatform(platform);
    }

    if (selectedPlatforms.length === 0) {
      console.log(colors.yellow('⚠️  No platforms configured - you can configure them later\n'));
    }
  }

  /**
   * Setup individual platform
   */
  async setupPlatform(platform) {
    console.log(colors.cyan(`\n📱 Configuring ${platform.charAt(0).toUpperCase() + platform.slice(1)}...`));

    switch (platform) {
    case 'mastodon':
      await this.setupMastodon();
      break;
    case 'bluesky':
      await this.setupBluesky();
      break;
    case 'x':
      await this.setupX();
      break;
    case 'linkedin':
      await this.setupLinkedIn();
      break;
    case 'nostr':
      await this.setupNostr();
      break;
    }
  }

  /**
   * Setup Mastodon configuration
   */
  async setupMastodon() {
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'instanceUrl',
        message: 'Enter your Mastodon instance URL (e.g., https://mastodon.social):',
        default: this.config.platforms.mastodon.instanceUrl,
        validate: (input) => {
          try {
            new URL(input);
            return true;
          } catch {
            return 'Please enter a valid URL';
          }
        }
      },
      {
        type: 'password',
        name: 'accessToken',
        message: 'Enter your Mastodon access token:',
        default: this.config.platforms.mastodon.accessToken,
        validate: (input) => input.trim() ? true : 'Access token is required'
      }
    ]);

    this.config.platforms.mastodon.enabled = true;
    this.config.platforms.mastodon.instanceUrl = answers.instanceUrl;
    this.config.platforms.mastodon.accessToken = answers.accessToken;
  }

  /**
   * Setup Bluesky configuration
   */
  async setupBluesky() {
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'handle',
        message: 'Enter your Bluesky handle (e.g., user.bsky.social):',
        default: this.config.platforms.bluesky.handle,
        validate: (input) => input.trim() ? true : 'Handle is required'
      },
      {
        type: 'password',
        name: 'appPassword',
        message: 'Enter your Bluesky app password:',
        default: this.config.platforms.bluesky.appPassword,
        validate: (input) => input.trim() ? true : 'App password is required'
      }
    ]);

    this.config.platforms.bluesky.enabled = true;
    this.config.platforms.bluesky.handle = answers.handle;
    this.config.platforms.bluesky.appPassword = answers.appPassword;
  }

  /**
   * Setup X (Twitter) configuration
   */
  async setupX() {
    console.log(colors.gray('Note: X/Twitter requires OAuth setup. You\'ll need API credentials.'));
    
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'clientId',
        message: 'Enter your X API Client ID:',
        default: this.config.platforms.x.clientId,
        validate: (input) => input.trim() ? true : 'Client ID is required'
      },
      {
        type: 'password',
        name: 'clientSecret',
        message: 'Enter your X API Client Secret:',
        default: this.config.platforms.x.clientSecret,
        validate: (input) => input.trim() ? true : 'Client Secret is required'
      }
    ]);

    this.config.platforms.x.enabled = true;
    this.config.platforms.x.clientId = answers.clientId;
    this.config.platforms.x.clientSecret = answers.clientSecret;
    
    console.log(colors.yellow('⚠️  You\'ll need to complete OAuth authentication later'));
  }

  /**
   * Setup LinkedIn configuration
   */
  async setupLinkedIn() {
    console.log(colors.gray('Note: LinkedIn requires OAuth setup. You\'ll need API credentials.'));
    
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'clientId',
        message: 'Enter your LinkedIn API Client ID:',
        default: this.config.platforms.linkedin.clientId,
        validate: (input) => input.trim() ? true : 'Client ID is required'
      },
      {
        type: 'password',
        name: 'clientSecret',
        message: 'Enter your LinkedIn API Client Secret:',
        default: this.config.platforms.linkedin.clientSecret,
        validate: (input) => input.trim() ? true : 'Client Secret is required'
      }
    ]);

    this.config.platforms.linkedin.enabled = true;
    this.config.platforms.linkedin.clientId = answers.clientId;
    this.config.platforms.linkedin.clientSecret = answers.clientSecret;
    
    console.log(colors.yellow('⚠️  You\'ll need to complete OAuth authentication later'));
  }

  /**
   * Setup Nostr configuration
   */
  async setupNostr() {
    const answers = await inquirer.prompt([
      {
        type: 'password',
        name: 'privateKey',
        message: 'Enter your Nostr private key (hex format):',
        default: this.config.platforms.nostr.privateKey,
        validate: (input) => {
          if (!input.trim()) {
            return 'Private key is required';
          }
          if (!/^[a-fA-F0-9]{64}$/.test(input.trim())) {
            return 'Private key must be 64 hex characters';
          }
          return true;
        }
      },
      {
        type: 'input',
        name: 'relays',
        message: 'Enter relay URLs (comma-separated):',
        default: this.config.platforms.nostr.relays.join(', '),
        validate: (input) => {
          const relays = input.split(',').map(r => r.trim());
          for (const relay of relays) {
            try {
              new URL(relay);
            } catch {
              return `Invalid relay URL: ${relay}`;
            }
          }
          return true;
        }
      }
    ]);

    this.config.platforms.nostr.enabled = true;
    this.config.platforms.nostr.privateKey = answers.privateKey.trim();
    this.config.platforms.nostr.relays = answers.relays.split(',').map(r => r.trim());
  }

  /**
   * Setup feed settings
   */
  async setupFeeds() {
    console.log(colors.yellow('📡 Feed Settings'));
    console.log(colors.gray('Configure RSS feed management\n'));

    const answers = await inquirer.prompt([
      {
        type: 'number',
        name: 'refreshInterval',
        message: 'Feed refresh interval (minutes):',
        default: this.config.feeds.refreshInterval / 1000 / 60,
        validate: (input) => {
          if (input <= 0) {
            return 'Refresh interval must be positive';
          }
          return true;
        }
      },
      {
        type: 'number',
        name: 'maxItems',
        message: 'Maximum items per feed:',
        default: this.config.feeds.maxItems,
        validate: (input) => {
          if (input <= 0) {
            return 'Max items must be positive';
          }
          return true;
        }
      },
      {
        type: 'confirm',
        name: 'enableScheduling',
        message: 'Enable automatic feed scheduling?',
        default: this.config.feeds.enableScheduling
      }
    ]);

    this.config.feeds.refreshInterval = answers.refreshInterval * 60 * 1000; // Convert to milliseconds
    this.config.feeds.maxItems = answers.maxItems;
    this.config.feeds.enableScheduling = answers.enableScheduling;

    console.log(colors.green('✅ Feed settings configured\n'));
  }

  /**
   * Setup Supabase (optional)
   */
  async setupSupabase() {
    console.log(colors.yellow('📊 Supabase Integration (Optional)'));
    console.log(colors.gray('Configure Supabase for analytics and data storage\n'));

    const { enableSupabase } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'enableSupabase',
        message: 'Enable Supabase integration for analytics?',
        default: this.config.supabase.enabled
      }
    ]);

    if (!enableSupabase) {
      this.config.supabase.enabled = false;
      console.log(colors.yellow('⚠️  Supabase disabled - analytics will be limited\n'));
      return;
    }

    const supabaseAnswers = await inquirer.prompt([
      {
        type: 'input',
        name: 'url',
        message: 'Enter your Supabase project URL:',
        default: this.config.supabase.url,
        validate: (input) => {
          try {
            new URL(input);
            return true;
          } catch {
            return 'Please enter a valid URL';
          }
        }
      },
      {
        type: 'password',
        name: 'anonKey',
        message: 'Enter your Supabase anonymous key:',
        default: this.config.supabase.anonKey,
        validate: (input) => input.trim() ? true : 'Anonymous key is required'
      }
    ]);

    this.config.supabase.enabled = true;
    this.config.supabase.url = supabaseAnswers.url;
    this.config.supabase.anonKey = supabaseAnswers.anonKey;

    console.log(colors.green('✅ Supabase integration configured\n'));
  }

  /**
   * Validate and save configuration
   */
  async validateAndSave() {
    console.log(colors.yellow('🔍 Validating configuration...'));

    const validation = validateConfig(this.config);
    
    if (!validation.valid) {
      console.log(colors.red('❌ Configuration validation failed:'));
      validation.errors.forEach(error => {
        console.log(colors.red(`   • ${error}`));
      });
      
      const { continueAnyway } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'continueAnyway',
          message: 'Save configuration anyway? (Some features may not work)',
          default: false
        }
      ]);

      if (!continueAnyway) {
        throw new Error('Setup cancelled due to validation errors');
      }
    }

    console.log(colors.green('✅ Configuration validated'));
    console.log(colors.yellow('💾 Saving configuration...'));

    const saveResult = saveConfig(this.config, this.configPath);
    
    if (!saveResult.success) {
      throw new Error(`Failed to save configuration: ${saveResult.error}`);
    }

    console.log(colors.green('✅ Configuration saved successfully'));
  }
}