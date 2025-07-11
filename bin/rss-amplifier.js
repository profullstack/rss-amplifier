#!/usr/bin/env node

/**
 * @profullstack/rss-amplifier - Command-line interface
 * Contextual RSS amplification with AI-driven snippet generation
 */

import colors from 'ansi-colors';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Import core modules
import { loadConfig, getConfigPath, getPlatformDisplayName, getAIConfig, isAIReady } from '../src/config-manager.js';
import { SetupWizard } from '../src/setup-wizard.js';

/**
 * Handle setup command
 */
async function handleSetupCommand(argv) {
  try {
    const configPath = argv.configPath || getConfigPath();
    const setupWizard = new SetupWizard(configPath);
    
    console.log(colors.green('🚀 Welcome to RSS Amplifier Setup!'));
    console.log(colors.cyan('This wizard will help you configure RSS Amplifier for your needs.\n'));
    
    await setupWizard.run();
    
    console.log(colors.green('\n✅ Setup completed successfully!'));
    console.log(colors.cyan(`Configuration saved to: ${configPath}`));
    console.log(colors.yellow('\nNext steps:'));
    console.log(colors.gray('  1. Import your RSS feeds: rssamp import ./feeds.opml'));
    console.log(colors.gray('  2. Generate snippets: rssamp snippets generate --brand "Your Brand"'));
    console.log(colors.gray('  3. Check status: rssamp status'));
    
  } catch (error) {
    console.error(colors.red('❌ Setup failed:'), error.message);
    if (argv.verbose) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

/**
 * Handle config command
 */
async function handleConfigCommand(argv) {
  try {
    const configPath = argv.configPath || getConfigPath();
    const config = loadConfig(configPath);

    console.log(colors.green('⚙️  Current Configuration:'));
    console.log('');
    console.log(colors.cyan(`Config file: ${configPath}`));
    console.log('');

    // Show platform configuration
    console.log(colors.yellow('Platforms:'));
    for (const [platform, platformConfig] of Object.entries(config.platforms)) {
      const displayName = getPlatformDisplayName(platform);
      const status = platformConfig.enabled ? colors.green('enabled') : colors.gray('disabled');
      console.log(`  ${displayName}: ${status}`);
    }

    console.log('');
    console.log(colors.yellow('General Settings:'));
    console.log(`  Brand context: ${config.general.brandContext || 'not set'}`);
    console.log(`  Default platforms: ${config.general.defaultPlatforms.join(', ') || 'none'}`);
    console.log(`  Retry attempts: ${config.general.retryAttempts}`);
    console.log(`  Timeout: ${config.general.timeout}ms`);
    console.log(`  Log level: ${config.general.logLevel}`);

    console.log('');
    console.log(colors.yellow('AI Settings:'));
    if (config.ai?.enabled && config.ai?.openaiApiKey) {
      console.log(`  Status: ${colors.green('enabled')}`);
      console.log(`  Provider: ${config.ai.provider}`);
      console.log(`  Model: ${config.ai.model}`);
      console.log(`  Temperature: ${config.ai.temperature}`);
      console.log(`  Max tokens: ${config.ai.maxTokens}`);
      const maskedKey = `${config.ai.openaiApiKey.substring(0, 7)}...${config.ai.openaiApiKey.substring(config.ai.openaiApiKey.length - 4)}`;
      console.log(`  API key: ${maskedKey}`);
    } else {
      console.log(`  Status: ${colors.gray('disabled')}`);
      console.log('  Run \'rssamp setup\' to configure AI features');
    }

    console.log('');
    console.log(colors.yellow('Feed Settings:'));
    console.log(`  Refresh interval: ${config.feeds.refreshInterval / 1000 / 60} minutes`);
    console.log(`  Max items: ${config.feeds.maxItems}`);
    console.log(`  Scheduling: ${config.feeds.enableScheduling ? 'enabled' : 'disabled'}`);

  } catch (error) {
    console.error(colors.red('❌ Config display failed:'), error.message);
    process.exit(1);
  }
}

/**
 * Handle status command
 */
async function handleStatusCommand(argv) {
  try {
    console.log(colors.green('📊 RSS Amplifier Status:'));
    console.log('');

    const config = loadConfig(argv.configPath);
    const platforms = ['x', 'linkedin', 'reddit', 'facebook', 'hacker-news', 'stacker-news', 'primal'];
    
    console.log(colors.yellow('Platform Status:'));
    for (const platform of platforms) {
      const displayName = getPlatformDisplayName(platform);
      const enabled = config?.platforms?.[platform]?.enabled ?? false;
      
      let status;
      if (!enabled) {
        status = colors.gray('⚪ Disabled');
      } else {
        // TODO: Check actual authentication status when platform integrations are implemented
        status = colors.yellow('⚠️  Configured (auth status unknown)');
      }

      console.log(`  ${displayName}: ${status}`);
    }

    console.log('');
    console.log(colors.yellow('AI Status:'));
    if (isAIReady(config)) {
      console.log(`  ${colors.green('✅ Ready')} - ${config.ai.provider} (${config.ai.model})`);
    } else {
      console.log(`  ${colors.red('❌ Not configured')} - Run 'rssamp setup' to configure AI`);
    }

    console.log('');
    console.log(colors.yellow('Feed Status:'));
    console.log(`  ${colors.gray('📡 No feeds imported yet')} - Run 'rssamp import' to add feeds`);

    console.log('');
    console.log(colors.yellow('Snippet Status:'));
    console.log(`  ${colors.gray('📝 No snippets generated yet')} - Run 'rssamp snippets generate' to create snippets`);

  } catch (error) {
    console.error(colors.red('❌ Status check failed:'), error.message);
    process.exit(1);
  }
}

/**
 * Handle import command (placeholder)
 */
async function handleImportCommand(argv) {
  console.log(colors.yellow('📡 Import functionality coming soon...'));
  console.log(colors.gray(`Would import: ${argv.file || argv._[1]}`));
  console.log(colors.cyan('This feature will be implemented in the next development phase.'));
}

/**
 * Handle feeds command (placeholder)
 */
async function handleFeedsCommand(argv) {
  console.log(colors.yellow('📰 Feed management coming soon...'));
  console.log(colors.cyan('This feature will be implemented in the next development phase.'));
}

/**
 * Handle snippets command (placeholder)
 */
async function handleSnippetsCommand(argv) {
  console.log(colors.yellow('✂️ Snippet management coming soon...'));
  console.log(colors.cyan('This feature will be implemented in the next development phase.'));
}

/**
 * Handle schedule command (placeholder)
 */
async function handleScheduleCommand(argv) {
  console.log(colors.yellow('📅 Scheduling functionality coming soon...'));
  console.log(colors.cyan('This feature will be implemented in the next development phase.'));
}

/**
 * Configure command line arguments
 */
function configureCommandLine() {
  return yargs(hideBin(process.argv))
    .scriptName('rssamp')
    .usage('$0 <command> [options]')
    .command('setup', 'Configure RSS Amplifier settings', (yargs) => {
      return yargs
        .option('config-path', {
          describe: 'Path to configuration file',
          type: 'string'
        });
    })
    .command('config', 'Show current configuration', (yargs) => {
      return yargs
        .option('config-path', {
          describe: 'Path to configuration file',
          type: 'string'
        });
    })
    .command('status', 'Show system status', (yargs) => {
      return yargs
        .option('config-path', {
          describe: 'Path to configuration file',
          type: 'string'
        });
    })
    .command('import <file>', 'Import OPML/RSS feeds', (yargs) => {
      return yargs
        .positional('file', {
          describe: 'Path to OPML file or RSS feed URL',
          type: 'string'
        })
        .option('type', {
          describe: 'Import type (opml or rss)',
          type: 'string',
          choices: ['opml', 'rss'],
          default: 'opml'
        });
    })
    .command('feeds <action>', 'Manage RSS feeds', (yargs) => {
      return yargs
        .positional('action', {
          describe: 'Action to perform',
          type: 'string',
          choices: ['list', 'refresh', 'add', 'remove']
        });
    })
    .command('snippets <action>', 'Manage snippets', (yargs) => {
      return yargs
        .positional('action', {
          describe: 'Action to perform',
          type: 'string',
          choices: ['generate', 'list', 'approve', 'edit', 'delete', 'post']
        })
        .option('brand', {
          describe: 'Brand context for snippet generation',
          type: 'string'
        })
        .option('style', {
          describe: 'Content style for AI generation',
          type: 'string',
          choices: ['viral', 'professional', 'casual'],
          default: 'viral'
        })
        .option('id', {
          describe: 'Snippet ID for operations',
          type: 'string'
        })
        .option('platform', {
          describe: 'Target platform for posting',
          type: 'string',
          choices: ['mastodon', 'bluesky', 'x', 'linkedin', 'nostr']
        });
    })
    .command('schedule <action>', 'Manage scheduled tasks', (yargs) => {
      return yargs
        .positional('action', {
          describe: 'Action to perform',
          type: 'string',
          choices: ['auto-post', 'list', 'stop']
        })
        .option('platform', {
          describe: 'Target platform',
          type: 'string',
          choices: ['mastodon', 'bluesky', 'x', 'linkedin', 'nostr']
        })
        .option('interval', {
          describe: 'Posting interval',
          type: 'string',
          choices: ['hourly', 'daily', 'weekly']
        });
    })
    .option('verbose', {
      alias: 'v',
      describe: 'Enable verbose logging',
      type: 'boolean',
      default: false
    })
    .option('config-path', {
      describe: 'Path to configuration file',
      type: 'string'
    })
    .help()
    .alias('help', 'h')
    .version()
    .alias('version', 'V')
    .demandCommand(1, 'You must specify a command')
    .strict();
}

/**
 * Main function
 */
async function main() {
  try {
    const {argv} = configureCommandLine();

    // Handle different commands
    switch (argv._[0]) {
    case 'setup':
      await handleSetupCommand(argv);
      break;
    case 'config':
      await handleConfigCommand(argv);
      break;
    case 'status':
      await handleStatusCommand(argv);
      break;
    case 'import':
      await handleImportCommand(argv);
      break;
    case 'feeds':
      await handleFeedsCommand(argv);
      break;
    case 'snippets':
      await handleSnippetsCommand(argv);
      break;
    case 'schedule':
      await handleScheduleCommand(argv);
      break;
    default:
      console.error(colors.red('Unknown command'));
      process.exit(1);
    }

  } catch (error) {
    console.error(colors.red('Unhandled error:'), error.message);
    if (process.env.NODE_ENV === 'development') {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Run the main function only if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error(colors.red('Fatal error:'), error);
    process.exit(1);
  });
}