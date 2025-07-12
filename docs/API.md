# RSS Amplifier API Documentation

This document provides comprehensive API documentation for the RSS Amplifier CLI tool and its core modules.

## Table of Contents

- [Core Modules](#core-modules)
- [Configuration Manager](#configuration-manager)
- [Feed Manager](#feed-manager)
- [Feed Scheduler](#feed-scheduler)
- [AI Snippet Generator](#ai-snippet-generator)
- [Snippet Manager](#snippet-manager)
- [Social Poster](#social-poster)
- [Analytics Logger](#analytics-logger)
- [Setup Wizard](#setup-wizard)
- [CLI Commands](#cli-commands)

## Core Modules

### Configuration Manager

**File**: `src/config-manager.js`

Manages RSS Amplifier configuration settings with validation and persistence.

#### Class: `ConfigManager`

```javascript
import { ConfigManager } from './src/config-manager.js';

const config = new ConfigManager(options);
```

**Constructor Options:**
- `configDir` (string): Configuration directory path
- `configFile` (string): Configuration file name (default: 'config.json')

**Methods:**

##### `async load()`
Loads configuration from file.
- **Returns**: `Promise<Object>` - Configuration object
- **Throws**: Error if configuration is invalid

##### `async save(config)`
Saves configuration to file.
- **Parameters**: 
  - `config` (Object): Configuration object to save
- **Returns**: `Promise<void>`

##### `async get(key, defaultValue)`
Gets a configuration value.
- **Parameters**:
  - `key` (string): Configuration key (supports dot notation)
  - `defaultValue` (any): Default value if key not found
- **Returns**: `Promise<any>` - Configuration value

##### `async set(key, value)`
Sets a configuration value.
- **Parameters**:
  - `key` (string): Configuration key (supports dot notation)
  - `value` (any): Value to set
- **Returns**: `Promise<void>`

##### `async merge(newConfig)`
Merges new configuration with existing.
- **Parameters**:
  - `newConfig` (Object): Configuration object to merge
- **Returns**: `Promise<void>`

##### `validate(config)`
Validates configuration object.
- **Parameters**:
  - `config` (Object): Configuration to validate
- **Returns**: `Object` - Validation result with `valid` and `errors` properties

---

### Feed Manager

**File**: `src/feed-manager.js`

Manages RSS/OPML feed imports and CRUD operations.

#### Class: `FeedManager`

```javascript
import { FeedManager } from './src/feed-manager.js';

const feedManager = new FeedManager(options);
```

**Constructor Options:**
- `dataDir` (string): Data directory path
- `configManager` (ConfigManager): Configuration manager instance

**Methods:**

##### `async importOPML(opmlPath)`
Imports feeds from OPML file.
- **Parameters**:
  - `opmlPath` (string): Path to OPML file
- **Returns**: `Promise<Object>` - Import result with counts and errors

##### `async addFeed(feedData)`
Adds a new RSS feed.
- **Parameters**:
  - `feedData` (Object): Feed configuration object
- **Returns**: `Promise<string>` - Feed ID

##### `async getFeed(feedId)`
Gets feed by ID.
- **Parameters**:
  - `feedId` (string): Feed identifier
- **Returns**: `Promise<Object|null>` - Feed object or null

##### `async updateFeed(feedId, updates)`
Updates existing feed.
- **Parameters**:
  - `feedId` (string): Feed identifier
  - `updates` (Object): Updates to apply
- **Returns**: `Promise<boolean>` - Success status

##### `async deleteFeed(feedId)`
Deletes a feed.
- **Parameters**:
  - `feedId` (string): Feed identifier
- **Returns**: `Promise<boolean>` - Success status

##### `async listFeeds(options)`
Lists all feeds with optional filtering.
- **Parameters**:
  - `options` (Object): Filter options
- **Returns**: `Promise<Array>` - Array of feed objects

##### `async validateFeed(feedUrl)`
Validates RSS feed URL.
- **Parameters**:
  - `feedUrl` (string): RSS feed URL
- **Returns**: `Promise<Object>` - Validation result

---

### Feed Scheduler

**File**: `src/feed-scheduler.js`

Manages scheduled RSS feed fetching and processing.

#### Class: `FeedScheduler`

```javascript
import { FeedScheduler } from './src/feed-scheduler.js';

const scheduler = new FeedScheduler(options);
```

**Constructor Options:**
- `feedManager` (FeedManager): Feed manager instance
- `snippetGenerator` (AISnippetGenerator): AI snippet generator instance
- `analyticsLogger` (AnalyticsLogger): Analytics logger instance

**Methods:**

##### `async start()`
Starts the scheduler.
- **Returns**: `Promise<void>`

##### `async stop()`
Stops the scheduler.
- **Returns**: `Promise<void>`

##### `async addSchedule(feedId, cronExpression, options)`
Adds a scheduled job for a feed.
- **Parameters**:
  - `feedId` (string): Feed identifier
  - `cronExpression` (string): Cron expression for scheduling
  - `options` (Object): Schedule options
- **Returns**: `Promise<string>` - Schedule ID

##### `async removeSchedule(scheduleId)`
Removes a scheduled job.
- **Parameters**:
  - `scheduleId` (string): Schedule identifier
- **Returns**: `Promise<boolean>` - Success status

##### `async processFeed(feedId, options)`
Manually processes a feed.
- **Parameters**:
  - `feedId` (string): Feed identifier
  - `options` (Object): Processing options
- **Returns**: `Promise<Object>` - Processing result

##### `getStatus()`
Gets scheduler status.
- **Returns**: `Object` - Status information

---

### AI Snippet Generator

**File**: `src/ai-snippet-generator.js`

Generates AI-powered social media snippets from RSS content.

#### Class: `AISnippetGenerator`

```javascript
import { AISnippetGenerator } from './src/ai-snippet-generator.js';

const generator = new AISnippetGenerator(options);
```

**Constructor Options:**
- `openaiApiKey` (string): OpenAI API key
- `model` (string): OpenAI model to use (default: 'gpt-4')
- `mockMode` (boolean): Enable mock mode for testing

**Methods:**

##### `async generateSnippets(article, platforms, options)`
Generates social media snippets for an article.
- **Parameters**:
  - `article` (Object): Article object with title, content, url
  - `platforms` (Array): Target platforms ['twitter', 'linkedin', etc.]
  - `options` (Object): Generation options
- **Returns**: `Promise<Array>` - Array of generated snippets

##### `async batchGenerate(articles, platforms, options)`
Generates snippets for multiple articles.
- **Parameters**:
  - `articles` (Array): Array of article objects
  - `platforms` (Array): Target platforms
  - `options` (Object): Generation options
- **Returns**: `Promise<Array>` - Array of generation results

##### `async analyzeContent(content)`
Analyzes content for keywords and sentiment.
- **Parameters**:
  - `content` (string): Content to analyze
- **Returns**: `Promise<Object>` - Analysis result

##### `validateSnippet(snippet, platform)`
Validates snippet for platform requirements.
- **Parameters**:
  - `snippet` (string): Snippet text
  - `platform` (string): Target platform
- **Returns**: `Object` - Validation result

---

### Snippet Manager

**File**: `src/snippet-manager.js`

Manages generated snippets with CRUD operations and approval workflows.

#### Class: `SnippetManager`

```javascript
import { SnippetManager } from './src/snippet-manager.js';

const snippetManager = new SnippetManager(options);
```

**Constructor Options:**
- `dataDir` (string): Data directory path
- `autoSave` (boolean): Enable auto-save (default: true)

**Methods:**

##### `async createSnippet(snippetData)`
Creates a new snippet.
- **Parameters**:
  - `snippetData` (Object): Snippet data object
- **Returns**: `Promise<string>` - Snippet ID

##### `async getSnippet(snippetId)`
Gets snippet by ID.
- **Parameters**:
  - `snippetId` (string): Snippet identifier
- **Returns**: `Promise<Object|null>` - Snippet object or null

##### `async updateSnippet(snippetId, updates)`
Updates existing snippet.
- **Parameters**:
  - `snippetId` (string): Snippet identifier
  - `updates` (Object): Updates to apply
- **Returns**: `Promise<boolean>` - Success status

##### `async deleteSnippet(snippetId)`
Deletes a snippet.
- **Parameters**:
  - `snippetId` (string): Snippet identifier
- **Returns**: `Promise<boolean>` - Success status

##### `async listSnippets(options)`
Lists snippets with filtering and pagination.
- **Parameters**:
  - `options` (Object): Filter and pagination options
- **Returns**: `Promise<Object>` - Paginated results

##### `async searchSnippets(query, options)`
Searches snippets by content.
- **Parameters**:
  - `query` (string): Search query
  - `options` (Object): Search options
- **Returns**: `Promise<Array>` - Search results

##### `async approveSnippet(snippetId, approved)`
Approves or rejects a snippet.
- **Parameters**:
  - `snippetId` (string): Snippet identifier
  - `approved` (boolean): Approval status
- **Returns**: `Promise<boolean>` - Success status

##### `async batchApprove(snippetIds, approved)`
Batch approve/reject snippets.
- **Parameters**:
  - `snippetIds` (Array): Array of snippet IDs
  - `approved` (boolean): Approval status
- **Returns**: `Promise<Object>` - Batch operation result

##### `async exportSnippets(filePath, format, options)`
Exports snippets to file.
- **Parameters**:
  - `filePath` (string): Export file path
  - `format` (string): Export format ('json' or 'csv')
  - `options` (Object): Export options
- **Returns**: `Promise<boolean>` - Success status

##### `getStatistics()`
Gets snippet statistics.
- **Returns**: `Object` - Statistics object

---

### Social Poster

**File**: `src/social-poster.js`

Handles posting to various social media platforms.

#### Class: `SocialPoster`

```javascript
import { SocialPoster } from './src/social-poster.js';

const poster = new SocialPoster(options);
```

**Constructor Options:**
- `platforms` (Object): Platform configurations
- `dryRun` (boolean): Enable dry run mode

**Methods:**

##### `async post(snippet, platform, options)`
Posts snippet to specified platform.
- **Parameters**:
  - `snippet` (Object): Snippet object
  - `platform` (string): Target platform
  - `options` (Object): Posting options
- **Returns**: `Promise<Object>` - Posting result

##### `async batchPost(snippets, options)`
Posts multiple snippets.
- **Parameters**:
  - `snippets` (Array): Array of snippet objects
  - `options` (Object): Posting options
- **Returns**: `Promise<Array>` - Array of posting results

##### `async schedulePost(snippet, platform, scheduledTime, options)`
Schedules a post for later.
- **Parameters**:
  - `snippet` (Object): Snippet object
  - `platform` (string): Target platform
  - `scheduledTime` (Date): When to post
  - `options` (Object): Scheduling options
- **Returns**: `Promise<string>` - Schedule ID

##### `validatePlatformConfig(platform)`
Validates platform configuration.
- **Parameters**:
  - `platform` (string): Platform name
- **Returns**: `Object` - Validation result

##### `getSupportedPlatforms()`
Gets list of supported platforms.
- **Returns**: `Array` - Array of platform names

---

### Analytics Logger

**File**: `src/analytics-logger.js`

Comprehensive logging and analytics system with Supabase integration.

#### Class: `AnalyticsLogger`

```javascript
import { AnalyticsLogger } from './src/analytics-logger.js';

const analytics = new AnalyticsLogger(options);
```

**Constructor Options:**
- `dataDir` (string): Data directory path
- `enableSupabase` (boolean): Enable Supabase integration
- `enableLocalLogging` (boolean): Enable local file logging
- `supabase` (Object): Supabase client instance

**Methods:**

##### `async logEvent(eventType, eventData, metadata)`
Logs an analytics event.
- **Parameters**:
  - `eventType` (string): Type of event
  - `eventData` (Object): Event-specific data
  - `metadata` (Object): Additional metadata
- **Returns**: `Promise<boolean>` - Success status

##### `async getAnalytics(startDate, endDate, eventType)`
Retrieves analytics data for date range.
- **Parameters**:
  - `startDate` (Date): Start date
  - `endDate` (Date): End date
  - `eventType` (string): Optional event type filter
- **Returns**: `Promise<Array|null>` - Analytics data

##### `async getMetrics(eventType, startDate, endDate)`
Calculates metrics for event type.
- **Parameters**:
  - `eventType` (string): Event type to analyze
  - `startDate` (Date): Optional start date
  - `endDate` (Date): Optional end date
- **Returns**: `Promise<Object>` - Calculated metrics

##### `async getDashboardData(startDate, endDate)`
Gets comprehensive dashboard data.
- **Parameters**:
  - `startDate` (Date): Optional start date
  - `endDate` (Date): Optional end date
- **Returns**: `Promise<Object>` - Dashboard data

##### `async exportAnalytics(filePath, format, startDate, endDate)`
Exports analytics data to file.
- **Parameters**:
  - `filePath` (string): Export file path
  - `format` (string): Export format ('json' or 'csv')
  - `startDate` (Date): Optional start date
  - `endDate` (Date): Optional end date
- **Returns**: `Promise<boolean>` - Success status

##### `async clearOldLogs(retentionDays)`
Clears old logs based on retention policy.
- **Parameters**:
  - `retentionDays` (number): Number of days to retain
- **Returns**: `Promise<boolean>` - Success status

---

### Setup Wizard

**File**: `src/setup-wizard.js`

Interactive setup wizard for initial configuration.

#### Class: `SetupWizard`

```javascript
import { SetupWizard } from './src/setup-wizard.js';

const wizard = new SetupWizard(options);
```

**Constructor Options:**
- `configManager` (ConfigManager): Configuration manager instance

**Methods:**

##### `async run()`
Runs the interactive setup wizard.
- **Returns**: `Promise<Object>` - Setup result

##### `async setupPlatforms()`
Sets up social media platform configurations.
- **Returns**: `Promise<Object>` - Platform configurations

##### `async setupOpenAI()`
Sets up OpenAI API configuration.
- **Returns**: `Promise<Object>` - OpenAI configuration

##### `async setupSupabase()`
Sets up Supabase integration.
- **Returns**: `Promise<Object>` - Supabase configuration

##### `async testConfiguration(config)`
Tests the provided configuration.
- **Parameters**:
  - `config` (Object): Configuration to test
- **Returns**: `Promise<Object>` - Test results

---

## CLI Commands

The RSS Amplifier CLI provides the following commands:

### Setup Commands

```bash
# Run initial setup wizard
rss-amplifier setup

# Setup specific platform
rss-amplifier setup --platform twitter
```

### Feed Management

```bash
# Import feeds from OPML
rss-amplifier import feeds.opml

# Add a new feed
rss-amplifier feeds add --url "https://example.com/feed.xml" --name "Example Feed"

# List all feeds
rss-amplifier feeds list

# Update a feed
rss-amplifier feeds update <feed-id> --name "New Name"

# Delete a feed
rss-amplifier feeds delete <feed-id>
```

### Snippet Management

```bash
# Generate snippets for a feed
rss-amplifier snippets generate <feed-id> --platforms twitter,linkedin

# List snippets
rss-amplifier snippets list --status pending

# Approve snippets
rss-amplifier snippets approve <snippet-id>

# Batch approve snippets
rss-amplifier snippets approve --all --status pending

# Export snippets
rss-amplifier snippets export --format csv --output snippets.csv
```

### Scheduling

```bash
# Start the scheduler
rss-amplifier schedule start

# Stop the scheduler
rss-amplifier schedule stop

# Add a scheduled job
rss-amplifier schedule add <feed-id> --cron "0 */6 * * *"

# List scheduled jobs
rss-amplifier schedule list

# Remove a scheduled job
rss-amplifier schedule remove <schedule-id>
```

### Analytics

```bash
# View analytics dashboard
rss-amplifier analytics dashboard

# Export analytics data
rss-amplifier analytics export --format json --output analytics.json

# Clear old logs
rss-amplifier analytics cleanup --days 30
```

## Error Handling

All API methods follow consistent error handling patterns:

- **Validation Errors**: Thrown for invalid input parameters
- **Configuration Errors**: Thrown for missing or invalid configuration
- **Network Errors**: Handled gracefully with retry logic where appropriate
- **File System Errors**: Handled with appropriate fallbacks

## Event Types

The analytics system tracks the following event types:

- `snippet_generation`: AI snippet generation events
- `social_posting`: Social media posting events
- `feed_processing`: RSS feed processing events
- `user_action`: User interaction events
- `system_error`: System error events

## Platform Support

Currently supported social media platforms:

- **Twitter**: Full posting and scheduling support
- **LinkedIn**: Full posting and scheduling support
- **Mastodon**: Basic posting support
- **Bluesky**: Basic posting support
- **Reddit**: Basic posting support
- **Facebook**: Basic posting support (via social-poster)

## Configuration Schema

See the [Configuration Guide](./CONFIGURATION.md) for detailed configuration schema and examples.

## Examples

See the `examples/` directory for comprehensive usage examples:

- `basic-setup.js`: Basic setup and configuration
- `feed-scheduler-demo.js`: Feed scheduling demonstration
- `analytics-demo.js`: Analytics and logging demonstration