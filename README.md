# RSS Amplifier

A CLI tool for contextual RSS amplification with AI-driven snippet generation and social media posting.

## Overview

RSS Amplifier helps technical marketers, indie developers, and SaaS founders share their content organically across social platforms without explicit links. It imports RSS/OPML feeds, generates AI-driven snippets with contextual brand mentions, and posts to multiple social platforms automatically or via manual approval.

## Features

- 📡 **RSS/OPML Import**: Import feeds from local files or URLs
- 🤖 **AI-Powered Snippets**: Generate contextual content with brand mentions
- 📅 **Scheduled Fetching**: Automatic RSS feed updates via cron jobs
- ✅ **Snippet Management**: Approve, edit, delete, and schedule snippets
- 🌐 **Multi-Platform Posting**: Support for Mastodon, Bluesky, X/Twitter, LinkedIn, Nostr
- 📊 **Analytics**: Track performance with Supabase integration
- ⚙️ **Flexible Configuration**: Comprehensive settings management

## Installation

```bash
# Install globally via npm
npm install -g @profullstack/rss-amplifier

# Or install via pnpm
pnpm add -g @profullstack/rss-amplifier
```

## Quick Start

```bash
# Set up configuration
rssamp setup

# Import OPML file
rssamp import ./feeds.opml

# List imported feeds
rssamp feeds list

# Generate snippets with brand context
rssamp snippets generate --brand "SmashLang, async-first JS alternative"

# List generated snippets
rssamp snippets list

# Approve a snippet
rssamp snippets approve [snippet-id]

# Post to social platforms
rssamp snippets post --id [snippet-id] --platform mastodon

# Schedule automatic posting
rssamp schedule auto-post --platform bluesky --interval daily
```

## CLI Commands

### Configuration
- `rssamp setup` - Interactive setup wizard
- `rssamp config` - Show current configuration
- `rssamp status` - Show platform authentication status

### Feed Management
- `rssamp import <file>` - Import OPML/RSS feeds
- `rssamp feeds list` - List all feeds
- `rssamp feeds refresh` - Manually refresh feeds

### Snippet Management
- `rssamp snippets generate [options]` - Generate AI snippets
- `rssamp snippets list` - List all snippets
- `rssamp snippets approve <id>` - Approve snippet for posting
- `rssamp snippets edit <id>` - Edit snippet content
- `rssamp snippets delete <id>` - Delete snippet
- `rssamp snippets post <id> [options]` - Post snippet to platforms

### Scheduling
- `rssamp schedule auto-post [options]` - Set up automatic posting
- `rssamp schedule list` - List scheduled tasks
- `rssamp schedule stop <id>` - Stop scheduled task

## Configuration

RSS Amplifier stores configuration in `~/.config/rss-amplifier/config.json`. Key sections include:

### Platforms
Configure social media platforms:
```json
{
  "platforms": {
    "mastodon": {
      "enabled": true,
      "instanceUrl": "https://mastodon.social",
      "accessToken": "your-token"
    },
    "bluesky": {
      "enabled": true,
      "handle": "your-handle.bsky.social",
      "appPassword": "your-app-password"
    }
  }
}
```

### AI Configuration
Set up AI providers:
```json
{
  "ai": {
    "enabled": true,
    "provider": "openai",
    "openaiApiKey": "sk-your-api-key",
    "model": "gpt-4o-mini",
    "temperature": 0.7
  }
}
```

### Brand Context
Define your brand context for AI generation:
```json
{
  "general": {
    "brandContext": "SmashLang, an async-first JavaScript alternative focused on performance and developer experience"
  }
}
```

## Development

### Prerequisites
- Node.js 20+
- pnpm (recommended)

### Setup
```bash
# Clone repository
git clone https://github.com/profullstack/rss-amplifier.git
cd rss-amplifier

# Install dependencies
pnpm install

# Run tests
pnpm test

# Run specific test suite
pnpm test:config
pnpm test:feeds
pnpm test:snippets

# Lint and format
pnpm lint
pnpm format
```

### Project Structure
```
rss-amplifier/
├── src/                    # Source code
│   ├── config-manager.js   # Configuration management
│   ├── feed-manager.js     # RSS/OPML handling
│   ├── snippet-manager.js  # Snippet operations
│   ├── ai-service.js       # AI integration
│   └── social-poster.js    # Social platform posting
├── test/                   # Test files
├── bin/                    # CLI executables
├── examples/               # Usage examples
└── index.js               # Main module export
```

## Architecture

```
[ CLI Interface ] ↔ [ Config Manager ]
                 ↔ [ Feed Manager ] ↔ [ RSS Parser ]
                 ↔ [ AI Service ] ↔ [ OpenAI/Ollama ]
                 ↔ [ Snippet Manager ] ↔ [ Supabase DB ]
                 ↔ [ Social Poster ] ↔ [ Platform APIs ]
```

## Supported Platforms

- **Mastodon**: ActivityPub-based decentralized social network
- **Bluesky**: AT Protocol-based social network
- **X (Twitter)**: Microblogging platform
- **LinkedIn**: Professional networking platform
- **Nostr**: Decentralized social protocol

## AI Providers

- **OpenAI**: GPT models for content generation
- **Ollama**: Local AI model hosting (planned)

## Contributing

1. Fork the repository
2. Create a feature branch
3. Write tests for new functionality
4. Implement the feature
5. Ensure all tests pass
6. Submit a pull request

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Support

- 📖 [Documentation](https://profullstack.com/rss-amplifier)
- 🐛 [Issue Tracker](https://github.com/profullstack/rss-amplifier/issues)
- 💬 [Discussions](https://github.com/profullstack/rss-amplifier/discussions)

---

Built with ❤️ by [Profullstack](https://profullstack.com)