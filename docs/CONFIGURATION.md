# RSS Amplifier Configuration Guide

This guide covers all configuration options for the RSS Amplifier CLI tool.

## Table of Contents

- [Configuration File Structure](#configuration-file-structure)
- [Platform Configurations](#platform-configurations)
- [AI Configuration](#ai-configuration)
- [Analytics Configuration](#analytics-configuration)
- [Scheduling Configuration](#scheduling-configuration)
- [Environment Variables](#environment-variables)
- [Configuration Examples](#configuration-examples)
- [Validation](#validation)

## Configuration File Structure

The RSS Amplifier uses a JSON configuration file located at `~/.config/rss-amplifier/config.json` by default.

### Basic Structure

```json
{
  "version": "1.0.0",
  "platforms": {
    "twitter": { /* Twitter config */ },
    "linkedin": { /* LinkedIn config */ },
    "mastodon": { /* Mastodon config */ },
    "bluesky": { /* Bluesky config */ },
    "reddit": { /* Reddit config */ },
    "facebook": { /* Facebook config */ }
  },
  "ai": {
    "openai": { /* OpenAI config */ }
  },
  "analytics": {
    "supabase": { /* Supabase config */ },
    "local": { /* Local analytics config */ }
  },
  "scheduling": {
    "enabled": true,
    "timezone": "UTC",
    "defaultCron": "0 */6 * * *"
  },
  "feeds": {
    "defaultUpdateInterval": "6h",
    "maxArticlesPerFeed": 50,
    "contentAnalysis": true
  },
  "snippets": {
    "autoApprove": false,
    "maxLength": {
      "twitter": 280,
      "linkedin": 3000
    },
    "templates": { /* Custom templates */ }
  }
}
```

## Platform Configurations

### Twitter

```json
{
  "platforms": {
    "twitter": {
      "enabled": true,
      "apiKey": "your-api-key",
      "apiSecret": "your-api-secret",
      "accessToken": "your-access-token",
      "accessTokenSecret": "your-access-token-secret",
      "bearerToken": "your-bearer-token",
      "options": {
        "maxLength": 280,
        "includeHashtags": true,
        "defaultHashtags": ["#tech", "#news"],
        "threadSupport": true,
        "mediaUpload": true
      }
    }
  }
}
```

**Required Fields:**
- `apiKey`: Twitter API key
- `apiSecret`: Twitter API secret
- `accessToken`: Twitter access token
- `accessTokenSecret`: Twitter access token secret

**Optional Fields:**
- `bearerToken`: Bearer token for v2 API features
- `options.maxLength`: Maximum tweet length (default: 280)
- `options.includeHashtags`: Include hashtags in tweets
- `options.defaultHashtags`: Default hashtags to include
- `options.threadSupport`: Enable thread creation for long content
- `options.mediaUpload`: Enable media upload support

### LinkedIn

```json
{
  "platforms": {
    "linkedin": {
      "enabled": true,
      "clientId": "your-client-id",
      "clientSecret": "your-client-secret",
      "accessToken": "your-access-token",
      "refreshToken": "your-refresh-token",
      "options": {
        "maxLength": 3000,
        "includeCompanyPage": false,
        "companyPageId": "your-company-page-id",
        "visibility": "PUBLIC"
      }
    }
  }
}
```

**Required Fields:**
- `clientId`: LinkedIn app client ID
- `clientSecret`: LinkedIn app client secret
- `accessToken`: LinkedIn access token

**Optional Fields:**
- `refreshToken`: Refresh token for token renewal
- `options.maxLength`: Maximum post length (default: 3000)
- `options.includeCompanyPage`: Post to company page
- `options.companyPageId`: Company page ID for posting
- `options.visibility`: Post visibility (PUBLIC, CONNECTIONS, LOGGED_IN_MEMBERS)

### Mastodon

```json
{
  "platforms": {
    "mastodon": {
      "enabled": true,
      "instanceUrl": "https://mastodon.social",
      "accessToken": "your-access-token",
      "options": {
        "maxLength": 500,
        "visibility": "public",
        "sensitive": false,
        "spoilerText": ""
      }
    }
  }
}
```

**Required Fields:**
- `instanceUrl`: Mastodon instance URL
- `accessToken`: Mastodon access token

**Optional Fields:**
- `options.maxLength`: Maximum toot length (default: 500)
- `options.visibility`: Post visibility (public, unlisted, private, direct)
- `options.sensitive`: Mark content as sensitive
- `options.spoilerText`: Content warning text

### Bluesky

```json
{
  "platforms": {
    "bluesky": {
      "enabled": true,
      "identifier": "your-handle.bsky.social",
      "password": "your-app-password",
      "options": {
        "maxLength": 300,
        "includeLinks": true
      }
    }
  }
}
```

**Required Fields:**
- `identifier`: Bluesky handle or email
- `password`: App password (not account password)

### Reddit

```json
{
  "platforms": {
    "reddit": {
      "enabled": true,
      "clientId": "your-client-id",
      "clientSecret": "your-client-secret",
      "username": "your-username",
      "password": "your-password",
      "userAgent": "RSS Amplifier v1.0.0",
      "options": {
        "defaultSubreddits": ["technology", "programming"],
        "titleMaxLength": 300,
        "flairText": "News"
      }
    }
  }
}
```

### Facebook

```json
{
  "platforms": {
    "facebook": {
      "enabled": true,
      "pageAccessToken": "your-page-access-token",
      "pageId": "your-page-id",
      "options": {
        "maxLength": 63206,
        "includeLink": true,
        "published": true
      }
    }
  }
}
```

## AI Configuration

### OpenAI

```json
{
  "ai": {
    "openai": {
      "apiKey": "your-openai-api-key",
      "model": "gpt-4",
      "maxTokens": 1000,
      "temperature": 0.7,
      "options": {
        "systemPrompt": "You are a social media content creator...",
        "retryAttempts": 3,
        "timeout": 30000,
        "mockMode": false
      }
    }
  }
}
```

**Required Fields:**
- `apiKey`: OpenAI API key

**Optional Fields:**
- `model`: OpenAI model to use (default: "gpt-4")
- `maxTokens`: Maximum tokens per request (default: 1000)
- `temperature`: Creativity level 0-1 (default: 0.7)
- `options.systemPrompt`: Custom system prompt
- `options.retryAttempts`: Number of retry attempts (default: 3)
- `options.timeout`: Request timeout in milliseconds (default: 30000)
- `options.mockMode`: Enable mock mode for testing (default: false)

## Analytics Configuration

### Supabase

```json
{
  "analytics": {
    "supabase": {
      "enabled": true,
      "url": "your-supabase-url",
      "anonKey": "your-anon-key",
      "serviceRoleKey": "your-service-role-key",
      "options": {
        "tableName": "analytics_events",
        "retentionDays": 90,
        "batchSize": 100
      }
    }
  }
}
```

**Required Fields (if enabled):**
- `url`: Supabase project URL
- `anonKey`: Supabase anonymous key

**Optional Fields:**
- `serviceRoleKey`: Service role key for admin operations
- `options.tableName`: Analytics table name (default: "analytics_events")
- `options.retentionDays`: Data retention period (default: 90)
- `options.batchSize`: Batch size for bulk operations (default: 100)

### Local Analytics

```json
{
  "analytics": {
    "local": {
      "enabled": true,
      "dataDir": "~/.config/rss-amplifier/analytics",
      "maxLogSize": 10485760,
      "retentionDays": 30,
      "options": {
        "compression": true,
        "rotation": true
      }
    }
  }
}
```

**Optional Fields:**
- `dataDir`: Local analytics data directory
- `maxLogSize`: Maximum log file size in bytes (default: 10MB)
- `retentionDays`: Local data retention period (default: 30)
- `options.compression`: Enable log compression
- `options.rotation`: Enable log rotation

## Scheduling Configuration

```json
{
  "scheduling": {
    "enabled": true,
    "timezone": "America/New_York",
    "defaultCron": "0 */6 * * *",
    "maxConcurrentJobs": 5,
    "options": {
      "retryFailedJobs": true,
      "maxRetries": 3,
      "retryDelay": 300000,
      "jobTimeout": 600000
    }
  }
}
```

**Optional Fields:**
- `enabled`: Enable scheduling system (default: true)
- `timezone`: Timezone for cron jobs (default: "UTC")
- `defaultCron`: Default cron expression (default: "0 */6 * * *")
- `maxConcurrentJobs`: Maximum concurrent jobs (default: 5)
- `options.retryFailedJobs`: Retry failed jobs (default: true)
- `options.maxRetries`: Maximum retry attempts (default: 3)
- `options.retryDelay`: Delay between retries in ms (default: 300000)
- `options.jobTimeout`: Job timeout in ms (default: 600000)

## Environment Variables

You can override configuration values using environment variables:

```bash
# OpenAI Configuration
export OPENAI_API_KEY="your-openai-api-key"
export OPENAI_MODEL="gpt-4"

# Twitter Configuration
export TWITTER_API_KEY="your-twitter-api-key"
export TWITTER_API_SECRET="your-twitter-api-secret"
export TWITTER_ACCESS_TOKEN="your-access-token"
export TWITTER_ACCESS_TOKEN_SECRET="your-access-token-secret"

# LinkedIn Configuration
export LINKEDIN_CLIENT_ID="your-linkedin-client-id"
export LINKEDIN_CLIENT_SECRET="your-linkedin-client-secret"
export LINKEDIN_ACCESS_TOKEN="your-linkedin-access-token"

# Supabase Configuration
export SUPABASE_URL="your-supabase-url"
export SUPABASE_ANON_KEY="your-supabase-anon-key"
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"

# General Configuration
export RSS_AMPLIFIER_CONFIG_DIR="~/.config/rss-amplifier"
export RSS_AMPLIFIER_DATA_DIR="~/.local/share/rss-amplifier"
```

## Configuration Examples

### Minimal Configuration

```json
{
  "version": "1.0.0",
  "platforms": {
    "twitter": {
      "enabled": true,
      "apiKey": "your-api-key",
      "apiSecret": "your-api-secret",
      "accessToken": "your-access-token",
      "accessTokenSecret": "your-access-token-secret"
    }
  },
  "ai": {
    "openai": {
      "apiKey": "your-openai-api-key"
    }
  }
}
```

### Development Configuration

```json
{
  "version": "1.0.0",
  "platforms": {
    "twitter": {
      "enabled": false
    },
    "linkedin": {
      "enabled": false
    }
  },
  "ai": {
    "openai": {
      "apiKey": "your-openai-api-key",
      "options": {
        "mockMode": true
      }
    }
  },
  "analytics": {
    "local": {
      "enabled": true
    },
    "supabase": {
      "enabled": false
    }
  },
  "scheduling": {
    "enabled": false
  }
}
```

### Production Configuration

```json
{
  "version": "1.0.0",
  "platforms": {
    "twitter": {
      "enabled": true,
      "apiKey": "your-api-key",
      "apiSecret": "your-api-secret",
      "accessToken": "your-access-token",
      "accessTokenSecret": "your-access-token-secret",
      "options": {
        "includeHashtags": true,
        "defaultHashtags": ["#tech", "#ai"],
        "threadSupport": true
      }
    },
    "linkedin": {
      "enabled": true,
      "clientId": "your-client-id",
      "clientSecret": "your-client-secret",
      "accessToken": "your-access-token",
      "options": {
        "visibility": "PUBLIC"
      }
    }
  },
  "ai": {
    "openai": {
      "apiKey": "your-openai-api-key",
      "model": "gpt-4",
      "temperature": 0.7,
      "options": {
        "retryAttempts": 3,
        "timeout": 30000
      }
    }
  },
  "analytics": {
    "supabase": {
      "enabled": true,
      "url": "your-supabase-url",
      "anonKey": "your-anon-key",
      "options": {
        "retentionDays": 90
      }
    },
    "local": {
      "enabled": true,
      "retentionDays": 7
    }
  },
  "scheduling": {
    "enabled": true,
    "timezone": "America/New_York",
    "defaultCron": "0 */4 * * *",
    "maxConcurrentJobs": 3
  },
  "feeds": {
    "defaultUpdateInterval": "4h",
    "maxArticlesPerFeed": 25,
    "contentAnalysis": true
  },
  "snippets": {
    "autoApprove": false,
    "maxLength": {
      "twitter": 280,
      "linkedin": 2000
    }
  }
}
```

## Validation

The configuration is automatically validated when loaded. Common validation errors include:

### Required Fields Missing

```
Error: Missing required field 'platforms.twitter.apiKey'
```

### Invalid Values

```
Error: Invalid value for 'scheduling.timezone': 'Invalid/Timezone'
```

### Platform-Specific Validation

```
Error: Twitter API key must be a non-empty string
Error: LinkedIn access token is required when LinkedIn is enabled
```

### AI Configuration Validation

```
Error: OpenAI API key is required when AI features are enabled
Error: Invalid OpenAI model: 'gpt-invalid'
```

## Configuration Management

### Loading Configuration

```javascript
import { ConfigManager } from './src/config-manager.js';

const config = new ConfigManager();
const settings = await config.load();
```

### Updating Configuration

```javascript
// Update a single value
await config.set('platforms.twitter.enabled', true);

// Merge new configuration
await config.merge({
  platforms: {
    linkedin: {
      enabled: true,
      clientId: 'new-client-id'
    }
  }
});
```

### Environment Override

Environment variables automatically override configuration file values:

```bash
# This overrides the config file setting
export TWITTER_API_KEY="override-key"
```

## Security Best Practices

1. **Never commit API keys** to version control
2. **Use environment variables** for sensitive data in production
3. **Restrict file permissions** on configuration files (600)
4. **Rotate API keys** regularly
5. **Use app passwords** instead of account passwords where possible
6. **Enable 2FA** on all connected accounts

## Troubleshooting

### Common Issues

1. **Configuration not found**: Ensure the config file exists and is readable
2. **Invalid JSON**: Validate JSON syntax using a JSON validator
3. **Permission denied**: Check file permissions on config directory
4. **API authentication failed**: Verify API keys and tokens are correct
5. **Platform disabled**: Check that the platform is enabled in configuration

### Debug Mode

Enable debug mode to see detailed configuration loading:

```bash
DEBUG=rss-amplifier:config rss-amplifier setup
```

### Configuration Validation

Validate your configuration manually:

```bash
rss-amplifier config validate