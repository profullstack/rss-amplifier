# RSS Amplifier Troubleshooting Guide

This guide helps you diagnose and resolve common issues with the RSS Amplifier CLI tool.

## Table of Contents

- [Installation Issues](#installation-issues)
- [Configuration Problems](#configuration-problems)
- [Authentication Errors](#authentication-errors)
- [Feed Processing Issues](#feed-processing-issues)
- [AI Generation Problems](#ai-generation-problems)
- [Social Media Posting Errors](#social-media-posting-errors)
- [Scheduling Issues](#scheduling-issues)
- [Analytics Problems](#analytics-problems)
- [Performance Issues](#performance-issues)
- [Debug Mode](#debug-mode)
- [Common Error Messages](#common-error-messages)
- [Getting Help](#getting-help)

## Installation Issues

### Node.js Version Compatibility

**Problem**: RSS Amplifier requires Node.js 20 or newer.

**Solution**:
```bash
# Check your Node.js version
node --version

# If version is < 20, update Node.js
# Using nvm (recommended)
nvm install 20
nvm use 20

# Or download from nodejs.org
```

### Package Installation Failures

**Problem**: `pnpm install` fails with dependency errors.

**Solutions**:
```bash
# Clear package manager cache
pnpm store prune

# Delete node_modules and reinstall
rm -rf node_modules pnpm-lock.yaml
pnpm install

# Use npm as fallback
npm install
```

### Permission Errors

**Problem**: Permission denied when installing globally.

**Solutions**:
```bash
# Install without sudo (recommended)
pnpm config set prefix ~/.local
export PATH="$HOME/.local/bin:$PATH"
pnpm install -g @profullstack/rss-amplifier

# Or use npx to run without installing
npx @profullstack/rss-amplifier setup
```

## Configuration Problems

### Configuration File Not Found

**Problem**: `Configuration file not found` error.

**Solutions**:
```bash
# Run setup wizard to create configuration
rss-amplifier setup

# Manually create config directory
mkdir -p ~/.config/rss-amplifier

# Check file permissions
ls -la ~/.config/rss-amplifier/
```

### Invalid JSON Configuration

**Problem**: `Invalid JSON in configuration file` error.

**Solutions**:
```bash
# Validate JSON syntax
cat ~/.config/rss-amplifier/config.json | jq .

# Reset configuration
rm ~/.config/rss-amplifier/config.json
rss-amplifier setup

# Use online JSON validator
# Copy config content to jsonlint.com
```

### Environment Variables Not Working

**Problem**: Environment variables not overriding config values.

**Solutions**:
```bash
# Check if variables are set
env | grep RSS_AMPLIFIER
env | grep OPENAI
env | grep TWITTER

# Export variables in current shell
export OPENAI_API_KEY="your-key"

# Add to shell profile for persistence
echo 'export OPENAI_API_KEY="your-key"' >> ~/.bashrc
source ~/.bashrc
```

## Authentication Errors

### OpenAI API Authentication

**Problem**: `OpenAI API authentication failed` error.

**Solutions**:
1. **Verify API Key**:
   ```bash
   # Test API key directly
   curl -H "Authorization: Bearer $OPENAI_API_KEY" \
        https://api.openai.com/v1/models
   ```

2. **Check API Key Format**:
   - Should start with `sk-`
   - Should be 51 characters long
   - No extra spaces or characters

3. **Verify Account Status**:
   - Check OpenAI account billing
   - Ensure API access is enabled
   - Check usage limits

### Twitter API Authentication

**Problem**: `Twitter API authentication failed` error.

**Solutions**:
1. **Verify Credentials**:
   ```bash
   # All four credentials are required
   echo $TWITTER_API_KEY
   echo $TWITTER_API_SECRET
   echo $TWITTER_ACCESS_TOKEN
   echo $TWITTER_ACCESS_TOKEN_SECRET
   ```

2. **Check App Permissions**:
   - Ensure app has read/write permissions
   - Regenerate tokens if needed
   - Verify callback URLs

3. **API Version Issues**:
   - Use Twitter API v2 endpoints
   - Update to latest API version
   - Check deprecated endpoints

### LinkedIn API Authentication

**Problem**: `LinkedIn API authentication failed` error.

**Solutions**:
1. **Token Expiration**:
   ```bash
   # LinkedIn tokens expire after 60 days
   # Refresh token using OAuth flow
   rss-amplifier setup --platform linkedin
   ```

2. **Scope Issues**:
   - Ensure correct OAuth scopes
   - Required: `w_member_social`, `r_liteprofile`
   - Check app permissions

## Feed Processing Issues

### RSS Feed Not Accessible

**Problem**: `Failed to fetch RSS feed` error.

**Solutions**:
1. **Verify Feed URL**:
   ```bash
   # Test feed URL directly
   curl -I "https://example.com/feed.xml"
   
   # Check feed validity
   curl "https://example.com/feed.xml" | head -20
   ```

2. **Network Issues**:
   ```bash
   # Check DNS resolution
   nslookup example.com
   
   # Test with different user agent
   curl -H "User-Agent: RSS Amplifier/1.0" "https://example.com/feed.xml"
   ```

3. **SSL/TLS Issues**:
   ```bash
   # Test SSL certificate
   openssl s_client -connect example.com:443 -servername example.com
   
   # Skip SSL verification (temporary)
   export NODE_TLS_REJECT_UNAUTHORIZED=0
   ```

### OPML Import Failures

**Problem**: `Failed to import OPML file` error.

**Solutions**:
1. **File Format Issues**:
   ```bash
   # Validate OPML format
   xmllint --noout feeds.opml
   
   # Check file encoding
   file feeds.opml
   ```

2. **Large File Issues**:
   ```bash
   # Split large OPML files
   # Import in smaller batches
   rss-amplifier import feeds-part1.opml
   ```

### Feed Parsing Errors

**Problem**: `Failed to parse RSS feed` error.

**Solutions**:
1. **Invalid XML**:
   ```bash
   # Validate XML structure
   xmllint --noout feed.xml
   
   # Check for encoding issues
   iconv -f utf-8 -t utf-8 feed.xml
   ```

2. **Unsupported Feed Format**:
   - RSS 2.0 and Atom feeds supported
   - JSON feeds not currently supported
   - Check feed specification compliance

## AI Generation Problems

### OpenAI Rate Limits

**Problem**: `Rate limit exceeded` error.

**Solutions**:
1. **Reduce Request Frequency**:
   ```bash
   # Increase delay between requests
   rss-amplifier snippets generate --delay 2000
   ```

2. **Batch Processing**:
   ```bash
   # Process fewer articles at once
   rss-amplifier snippets generate --batch-size 5
   ```

3. **Upgrade API Plan**:
   - Check OpenAI usage dashboard
   - Upgrade to higher tier plan
   - Monitor usage patterns

### Poor Quality Snippets

**Problem**: Generated snippets are low quality or irrelevant.

**Solutions**:
1. **Adjust AI Parameters**:
   ```json
   {
     "ai": {
       "openai": {
         "temperature": 0.7,
         "maxTokens": 150,
         "model": "gpt-4"
       }
     }
   }
   ```

2. **Custom Prompts**:
   ```json
   {
     "ai": {
       "openai": {
         "options": {
           "systemPrompt": "Create engaging social media posts that..."
         }
       }
     }
   }
   ```

3. **Content Filtering**:
   - Enable content analysis
   - Filter by keywords
   - Set minimum content length

### AI Service Timeouts

**Problem**: `AI request timeout` error.

**Solutions**:
```json
{
  "ai": {
    "openai": {
      "options": {
        "timeout": 60000,
        "retryAttempts": 3
      }
    }
  }
}
```

## Social Media Posting Errors

### Platform-Specific Issues

**Twitter Posting Failures**:
```bash
# Check tweet length
rss-amplifier snippets validate --platform twitter

# Test with simple text
rss-amplifier post "Test tweet" --platform twitter --dry-run
```

**LinkedIn Posting Failures**:
```bash
# Verify company page permissions
# Check content guidelines compliance
# Test with personal profile first
```

### Content Validation Errors

**Problem**: `Content validation failed` error.

**Solutions**:
1. **Length Limits**:
   ```bash
   # Check platform limits
   rss-amplifier platforms info twitter
   
   # Truncate content automatically
   rss-amplifier snippets generate --auto-truncate
   ```

2. **Forbidden Content**:
   - Remove URLs if not allowed
   - Check for banned keywords
   - Verify image formats

### Posting Rate Limits

**Problem**: `Posting rate limit exceeded` error.

**Solutions**:
```bash
# Add delays between posts
rss-amplifier post --delay 60000

# Schedule posts instead of immediate posting
rss-amplifier schedule add --cron "0 */2 * * *"
```

## Scheduling Issues

### Cron Jobs Not Running

**Problem**: Scheduled jobs not executing.

**Solutions**:
1. **Verify Cron Expression**:
   ```bash
   # Test cron expression
   # Use online cron validator
   
   # Check timezone settings
   rss-amplifier config get scheduling.timezone
   ```

2. **Process Issues**:
   ```bash
   # Check if scheduler is running
   rss-amplifier schedule status
   
   # Restart scheduler
   rss-amplifier schedule restart
   ```

3. **Permission Issues**:
   ```bash
   # Check log files
   tail -f ~/.local/share/rss-amplifier/logs/scheduler.log
   
   # Verify file permissions
   ls -la ~/.local/share/rss-amplifier/
   ```

### Job Failures

**Problem**: Scheduled jobs failing silently.

**Solutions**:
```bash
# Enable verbose logging
export DEBUG=rss-amplifier:scheduler

# Check job history
rss-amplifier schedule history

# Test job manually
rss-amplifier schedule run <job-id>
```

## Analytics Problems

### Supabase Connection Issues

**Problem**: `Failed to connect to Supabase` error.

**Solutions**:
1. **Verify Credentials**:
   ```bash
   # Test connection
   curl -H "apikey: $SUPABASE_ANON_KEY" \
        "$SUPABASE_URL/rest/v1/"
   ```

2. **Network Issues**:
   ```bash
   # Check firewall settings
   # Verify DNS resolution
   nslookup your-project.supabase.co
   ```

3. **Database Schema**:
   ```sql
   -- Verify table exists
   SELECT * FROM analytics_events LIMIT 1;
   
   -- Check permissions
   SELECT * FROM information_schema.tables 
   WHERE table_name = 'analytics_events';
   ```

### Local Analytics Issues

**Problem**: Local analytics not working.

**Solutions**:
```bash
# Check data directory permissions
ls -la ~/.local/share/rss-amplifier/analytics/

# Verify disk space
df -h ~/.local/share/rss-amplifier/

# Check log file integrity
tail ~/.local/share/rss-amplifier/analytics/analytics.log
```

## Performance Issues

### Slow Feed Processing

**Problem**: Feed processing takes too long.

**Solutions**:
1. **Optimize Settings**:
   ```json
   {
     "feeds": {
       "maxArticlesPerFeed": 25,
       "contentAnalysis": false,
       "parallelProcessing": true
     }
   }
   ```

2. **Resource Limits**:
   ```bash
   # Monitor memory usage
   top -p $(pgrep -f rss-amplifier)
   
   # Check available memory
   free -h
   ```

### High Memory Usage

**Problem**: RSS Amplifier consuming too much memory.

**Solutions**:
```bash
# Reduce batch sizes
rss-amplifier config set feeds.maxArticlesPerFeed 10

# Enable garbage collection
node --max-old-space-size=512 $(which rss-amplifier)

# Process feeds individually
rss-amplifier feeds process --sequential
```

## Debug Mode

Enable debug mode for detailed logging:

```bash
# Enable all debug output
export DEBUG=rss-amplifier:*

# Enable specific modules
export DEBUG=rss-amplifier:config,rss-amplifier:feeds

# Save debug output to file
DEBUG=rss-amplifier:* rss-amplifier setup 2>&1 | tee debug.log
```

### Debug Categories

- `rss-amplifier:config` - Configuration loading and validation
- `rss-amplifier:feeds` - Feed processing and parsing
- `rss-amplifier:ai` - AI snippet generation
- `rss-amplifier:social` - Social media posting
- `rss-amplifier:scheduler` - Job scheduling
- `rss-amplifier:analytics` - Analytics and logging

## Common Error Messages

### `ENOENT: no such file or directory`

**Cause**: Missing configuration or data files.

**Solution**:
```bash
# Run setup to create missing files
rss-amplifier setup

# Create directories manually
mkdir -p ~/.config/rss-amplifier
mkdir -p ~/.local/share/rss-amplifier
```

### `EACCES: permission denied`

**Cause**: Insufficient file permissions.

**Solution**:
```bash
# Fix permissions
chmod 755 ~/.config/rss-amplifier
chmod 644 ~/.config/rss-amplifier/config.json

# Change ownership if needed
chown -R $USER:$USER ~/.config/rss-amplifier
```

### `Invalid JSON in configuration file`

**Cause**: Malformed JSON configuration.

**Solution**:
```bash
# Validate and fix JSON
cat ~/.config/rss-amplifier/config.json | jq .

# Reset configuration
rm ~/.config/rss-amplifier/config.json
rss-amplifier setup
```

### `Network request failed`

**Cause**: Network connectivity issues.

**Solution**:
```bash
# Test internet connection
ping google.com

# Check proxy settings
echo $HTTP_PROXY
echo $HTTPS_PROXY

# Test specific endpoints
curl -I https://api.openai.com
curl -I https://api.twitter.com
```

### `Rate limit exceeded`

**Cause**: API rate limits reached.

**Solution**:
```bash
# Wait and retry
sleep 60
rss-amplifier retry-failed

# Reduce request frequency
rss-amplifier config set ai.options.retryDelay 5000
```

## Getting Help

### Log Files

Check log files for detailed error information:

```bash
# Application logs
tail -f ~/.local/share/rss-amplifier/logs/app.log

# Scheduler logs
tail -f ~/.local/share/rss-amplifier/logs/scheduler.log

# Error logs
tail -f ~/.local/share/rss-amplifier/logs/error.log
```

### System Information

Gather system information for bug reports:

```bash
# System info
uname -a
node --version
npm --version

# RSS Amplifier version
rss-amplifier --version

# Configuration summary
rss-amplifier config summary
```

### Support Channels

1. **GitHub Issues**: Report bugs and feature requests
2. **Documentation**: Check API and configuration docs
3. **Community**: Join discussions and get help
4. **Debug Logs**: Include debug output in reports

### Creating Bug Reports

Include the following information:

1. **Environment**:
   - Operating system and version
   - Node.js version
   - RSS Amplifier version

2. **Configuration**:
   - Sanitized configuration file
   - Environment variables (without secrets)

3. **Error Details**:
   - Complete error message
   - Debug logs
   - Steps to reproduce

4. **Expected vs Actual**:
   - What you expected to happen
   - What actually happened
   - Screenshots if applicable

### Performance Monitoring

Monitor RSS Amplifier performance:

```bash
# CPU and memory usage
top -p $(pgrep -f rss-amplifier)

# Network activity
netstat -an | grep $(pgrep -f rss-amplifier)

# File descriptor usage
lsof -p $(pgrep -f rss-amplifier)
```

Remember to check the [API Documentation](./API.md) and [Configuration Guide](./CONFIGURATION.md) for detailed information about specific features and settings.