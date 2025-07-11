# RSS Amplifier Development TODO

## Phase 0 - Project Setup ✅
- [x] Create package.json with dependencies and CLI configuration
- [x] Set up ESLint, Prettier, and Mocha configuration
- [x] Create .gitignore file
- [ ] Create directory structure (src/, test/, bin/, examples/)
- [ ] Create main index.js entry point

## Phase 1 - Core Configuration System
- [ ] Create config-manager.js for RSS Amplifier settings
- [ ] Implement configuration validation and defaults
- [ ] Add support for brand context configuration
- [ ] Create setup wizard for initial configuration
- [ ] Write comprehensive tests for configuration system

## Phase 2 - RSS/OPML Feed Management
- [ ] Implement OPML file parsing and import
- [ ] Create RSS feed fetching functionality
- [ ] Add feed validation and error handling
- [ ] Implement feed storage and management
- [ ] Create scheduled feed fetching with cron jobs
- [ ] Write tests for feed management system

## Phase 3 - AI Snippet Generation
- [ ] Create AI service integration (OpenAI/Ollama)
- [ ] Implement contextual snippet generation
- [ ] Add brand context injection into snippets
- [ ] Create snippet validation and filtering
- [ ] Add support for different content styles
- [ ] Write comprehensive AI service tests

## Phase 4 - Snippet Management System
- [ ] Create snippet storage and retrieval
- [ ] Implement snippet approval workflow
- [ ] Add snippet editing capabilities
- [ ] Create snippet deletion functionality
- [ ] Add snippet scheduling features
- [ ] Write tests for snippet management

## Phase 5 - Social Platform Integration
- [ ] Integrate with Mastodon API
- [ ] Add Bluesky posting support
- [ ] Implement X/Twitter integration
- [ ] Add LinkedIn posting capabilities
- [ ] Create Nostr protocol support
- [ ] Write tests for social platform integrations

## Phase 6 - CLI Interface
- [ ] Create main CLI entry point (bin/rss-amplifier.js)
- [ ] Implement import command for OPML/RSS
- [ ] Add feeds management commands
- [ ] Create snippets management commands
- [ ] Implement scheduling commands
- [ ] Add status and configuration commands
- [ ] Write CLI integration tests

## Phase 7 - Database Integration
- [ ] Set up Supabase client configuration
- [ ] Create database schema for feeds and snippets
- [ ] Implement data persistence layer
- [ ] Add analytics and logging
- [ ] Create data migration utilities
- [ ] Write database integration tests

## Phase 8 - Advanced Features
- [ ] Add batch processing capabilities
- [ ] Implement content filtering and moderation
- [ ] Create performance monitoring
- [ ] Add retry mechanisms and error recovery
- [ ] Implement rate limiting for APIs
- [ ] Write performance and integration tests

## Phase 9 - Documentation and Examples
- [ ] Create comprehensive README.md
- [ ] Add usage examples and tutorials
- [ ] Create API documentation
- [ ] Add troubleshooting guide
- [ ] Create example configuration files
- [ ] Write example scripts

## Phase 10 - Release Preparation
- [ ] Final testing and bug fixes
- [ ] Performance optimization
- [ ] Security audit and improvements
- [ ] Create release notes
- [ ] Prepare npm package for publication
- [ ] Set up CI/CD pipeline

---

## Development Notes

### Key Requirements from PRD:
- CLI/npm module for technical marketers and developers
- RSS/OPML import from local files or URLs
- Scheduled RSS feed fetching via cron tasks
- AI-driven snippet generation with brand context
- Social posting to Mastodon, Bluesky, X/Twitter, LinkedIn, Nostr
- Snippet management (list, approve, edit, delete, schedule)
- Supabase integration for storage and analytics

### Architecture:
```
[ CLI Interface ] ↔ [ Config Manager ]
                 ↔ [ Feed Manager ] ↔ [ RSS Parser ]
                 ↔ [ AI Service ] ↔ [ OpenAI/Ollama ]
                 ↔ [ Snippet Manager ] ↔ [ Supabase DB ]
                 ↔ [ Social Poster ] ↔ [ Platform APIs ]
```

### Dependencies:
- **Core**: yargs, dotenv, ansi-colors, cli-progress
- **RSS/OPML**: rss-parser, opml-parser
- **AI**: openai
- **Scheduling**: node-cron
- **Database**: @supabase/supabase-js
- **Social**: puppeteer (for platforms without direct API)
- **Testing**: mocha, chai, sinon, esmock

### CLI Commands Structure:
```bash
rssamp import ./feeds.opml
rssamp feeds list
rssamp snippets generate --brand "SmashLang"
rssamp snippets list
rssamp snippets approve [id]
rssamp snippets post --id [id] --platform mastodon
rssamp schedule auto-post --platform bluesky --interval daily
rssamp setup
rssamp config
rssamp status