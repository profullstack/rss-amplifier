/**
 * Basic Setup Example
 * Demonstrates how to use RSS Amplifier programmatically
 */

import { RSSAmplifier, loadConfig, getConfigPath } from '../index.js';
import colors from 'ansi-colors';

async function basicSetupExample() {
  console.log(colors.green('🚀 RSS Amplifier Basic Setup Example\n'));

  try {
    // Check if configuration exists
    const configPath = getConfigPath();
    const config = loadConfig(configPath);
    
    console.log(colors.cyan('📋 Current Configuration Status:'));
    console.log(`Config file: ${configPath}`);
    console.log(`Brand context: ${config.general.brandContext || 'Not set'}`);
    console.log(`AI enabled: ${config.ai.enabled ? 'Yes' : 'No'}`);
    console.log(`Platforms configured: ${Object.values(config.platforms).filter(p => p.enabled).length}`);
    console.log('');

    // Create RSS Amplifier instance
    const amplifier = new RSSAmplifier({
      brandContext: config.general.brandContext || 'Example Brand Context'
    });

    // Get system status
    const status = amplifier.getStatus();
    console.log(colors.yellow('📊 System Status:'));
    console.log('Feeds:', status.feeds || 'Not implemented yet');
    console.log('Snippets:', status.snippets || 'Not implemented yet');
    console.log('AI:', status.ai || 'Not implemented yet');
    console.log('Social:', status.social || 'Not implemented yet');
    console.log('');

    // Get available platforms
    const platforms = amplifier.getAvailablePlatforms();
    console.log(colors.magenta('🌐 Available Platforms:'));
    if (platforms && platforms.length > 0) {
      platforms.forEach(platform => console.log(`  • ${platform}`));
    } else {
      console.log('  No platforms configured yet');
    }
    console.log('');

    console.log(colors.green('✅ Example completed successfully!'));
    console.log(colors.cyan('Next steps:'));
    console.log('  1. Run: ./bin/rss-amplifier.js setup');
    console.log('  2. Configure your platforms and AI settings');
    console.log('  3. Import RSS feeds and start generating snippets');

    // Clean up
    await amplifier.close();

  } catch (error) {
    console.error(colors.red('❌ Example failed:'), error.message);
    process.exit(1);
  }
}

// Run the example
if (import.meta.url === `file://${process.argv[1]}`) {
  basicSetupExample().catch(console.error);
}

export { basicSetupExample };