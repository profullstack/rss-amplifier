# RSS Amplifier Setup Guide

This guide will help you set up the RSS Amplifier CLI tool for contextual RSS amplification with AI-driven snippet generation.

## Prerequisites

- Node.js 20.0.0 or higher
- pnpm package manager
- OpenAI API key (required for AI snippet generation)

## Installation

1. **Clone or install the package:**
   ```bash
   # If installing from npm
   pnpm add -g @profullstack/rss-amplifier
   
   # Or if cloning from repository
   git clone https://github.com/profullstack/rss-amplifier.git
   cd rss-amplifier
   pnpm install
   ```

2. **Set up environment variables:**
   ```bash
   # Copy the sample environment file
   cp .env.sample .env
   
   # Edit the .env file with your actual values
   nano .env  # or use your preferred editor
   ```

## Required Configuration

### 1. OpenAI API Key (Required)

The RSS Amplifier requires an OpenAI API key for AI snippet generation:

1. Go to [OpenAI Platform](https://platform.openai.com/api-keys)
2. Create a new API key
3. Add it to your `.env` file:
   ```env
   OPENAI_API_KEY=sk-your-openai-api-key-here
   ```

### 2. Social Media Platforms (Optional)

Configure the social media platforms you want to post to:

#### Twitter/X
1. Go to [Twitter Developer Portal](https://developer.twitter.com/en/portal/dashboard)
2. Create an app and get your credentials
3. Add to `.env`:
   ```env
   TWITTER_API_KEY=your-twitter-api-key
   TWITTER_API_SECRET=your-twitter-api-secret
   TWITTER_ACCESS_TOKEN=your-twitter-access-token
   TWITTER_ACCESS_TOKEN_SECRET=your-twitter-access-token-secret
   ```

#### LinkedIn
1. Go to [LinkedIn Developers](https://www.linkedin.com/developers/apps)
2. Create an app and get your credentials
3. Add to `.env`:
   ```env
   LINKEDIN_CLIENT_ID=your-linkedin-client-id
   LINKEDIN_CLIENT_SECRET=your-linkedin-client-secret
   LINKEDIN_ACCESS_TOKEN=your-linkedin-access-token
   ```

#### Mastodon
1. Go to your Mastodon instance settings
2. Create an application and get your access token
3. Add to `.env`:
   ```env
   MASTODON_INSTANCE_URL=https://mastodon.social
   MASTODON_ACCESS_TOKEN=your-mastodon-access-token
   ```

#### Bluesky
1. Go to your Bluesky settings
2. Create an app password
3. Add to `.env`:
   ```env
   BLUESKY_HANDLE=your-handle.bsky.social
   BLUESKY_APP_PASSWORD=your-bluesky-app-password
   ```

### 3. Supabase (Optional - for analytics)

If you want to track analytics and logging:

1. Go to [Supabase](https://supabase.com/dashboard)
2. Create a new project
3. Get your project URL and anon key
4. Add to `.env`:
   ```env
   SUPABASE_URL=https://your-project-id.supabase.co
   SUPABASE_ANON_KEY=your-supabase-anon-key-here
   ```

## Quick Start

1. **Run the setup wizard:**
   ```bash
   rss-amplifier setup
   ```

2. **Import RSS feeds:**
   ```bash
   # Import from OPML file
   rss-amplifier import --opml feeds.opml
   
   # Or add individual feeds
   rss-amplifier feeds add https://example.com/feed.xml
   ```

3. **Generate snippets:**
   ```bash
   # Generate snippets for all feeds
   rss-amplifier snippets generate
   
   # Generate for specific platform
   rss-amplifier snippets generate --platform twitter
   ```

4. **Start automatic scheduling:**
   ```bash
   rss-amplifier schedule start
   ```

## Configuration Options

### AI Settings

Customize AI behavior in your `.env`:

```env
# Use GPT-3.5 instead of GPT-4 (cheaper)
OPENAI_MODEL=gpt-3.5-turbo

# Adjust creativity (0.0 = deterministic, 2.0 = very creative)
OPENAI_TEMPERATURE=0.7

# Limit response length
OPENAI_MAX_TOKENS=500
```

### Feed Processing

Control how feeds are processed:

```env
# Check feeds every 30 minutes
FEED_UPDATE_INTERVAL=30

# Process up to 5 items per feed
MAX_ITEMS_PER_FEED=5

# Enable content relevance filtering
AI_FILTER_RELEVANCE=true
```

### Rate Limiting

Prevent hitting API limits:

```env
# Limit API calls per minute
API_RATE_LIMIT=60

# Limit social media posts per hour
POSTING_RATE_LIMIT=10
```

## Testing

Test your configuration without making real API calls:

```env
# Enable mock mode for testing
MOCK_MODE=true
```

Then run:
```bash
rss-amplifier snippets generate --mock
```

## Troubleshooting

### Common Issues

1. **"OpenAI API key is required" error:**
   - Make sure `OPENAI_API_KEY` is set in your `.env` file
   - Verify the API key is valid and has credits

2. **"Feed not recognized as RSS" error:**
   - Check that the RSS feed URL is valid
   - Some feeds may require user-agent headers

3. **Social media posting fails:**
   - Verify your platform credentials are correct
   - Check rate limits and API quotas

### Debug Mode

Enable verbose logging:

```env
DEBUG=true
VERBOSE=true
LOG_LEVEL=debug
```

### Getting Help

- Check the [documentation](https://github.com/profullstack/rss-amplifier/docs)
- Open an [issue](https://github.com/profullstack/rss-amplifier/issues)
- Run `rss-amplifier --help` for command help

## Security Notes

- Never commit your `.env` file to version control
- Use environment-specific `.env` files for different deployments
- Regularly rotate your API keys
- Use the principle of least privilege for API permissions

## Next Steps

Once you have the basic setup working:

1. Customize your snippet templates
2. Set up automated scheduling
3. Configure analytics and monitoring
4. Explore advanced AI settings
5. Set up multiple social media accounts

Happy amplifying! 🚀