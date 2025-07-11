/**
 * AI Snippet Generator Tests
 * Testing AI-powered snippet generation from RSS feed content
 */

import { expect } from 'chai';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  AISnippetGenerator,
  generateSnippet,
  analyzeContent,
  validateSnippetRequest,
  formatSnippetForPlatform,
  extractKeyInsights,
} from '../src/ai-snippet-generator.js';

describe('AI Snippet Generator', () => {
  let tempDataPath;
  let generator;
  let mockOpenAIResponse;

  beforeEach(() => {
    // Create temporary data path for testing
    tempDataPath = path.join(os.tmpdir(), `rss-amplifier-ai-test-${Date.now()}`);
    fs.mkdirSync(tempDataPath, { recursive: true });
    
    // Mock OpenAI response
    mockOpenAIResponse = {
      choices: [{
        message: {
          content: JSON.stringify({
            snippet: "🚀 The future of web development is here! New framework promises 50% faster builds and zero-config setup. What's your take on the endless cycle of JavaScript frameworks?",
            insights: ["Performance optimization", "Developer experience", "Framework fatigue"],
            tone: "engaging",
            platform_optimized: {
              twitter: "🚀 The future of web development is here! New framework promises 50% faster builds and zero-config setup. What's your take on the endless cycle of JS frameworks? #WebDev #JavaScript",
              linkedin: "The web development landscape continues to evolve with a new framework promising 50% faster builds and zero-configuration setup. This raises interesting questions about the balance between innovation and framework fatigue in our industry. What are your thoughts on adopting new tools versus mastering existing ones?",
              reddit: "Just saw this new JS framework that claims 50% faster builds with zero config. Are we solving real problems or just creating new ones? Curious what other devs think about the constant churn in our tooling."
            }
          })
        }
      }]
    };
    
    // Create generator instance with mock
    generator = new AISnippetGenerator({
      dataPath: tempDataPath,
      openaiApiKey: 'test-api-key',
      model: 'gpt-4',
      maxTokens: 500,
      temperature: 0.7,
      mockMode: true,
      mockResponse: mockOpenAIResponse,
    });
  });

  afterEach(() => {
    // Clean up temporary data
    if (fs.existsSync(tempDataPath)) {
      fs.rmSync(tempDataPath, { recursive: true, force: true });
    }
  });

  describe('AISnippetGenerator constructor', () => {
    it('should create instance with default options', () => {
      const testGenerator = new AISnippetGenerator({
        openaiApiKey: 'test-key',
      });
      expect(testGenerator).to.be.instanceOf(AISnippetGenerator);
      expect(testGenerator.options).to.have.property('model', 'gpt-4');
      expect(testGenerator.options).to.have.property('maxTokens', 500);
      expect(testGenerator.options).to.have.property('temperature', 0.7);
    });

    it('should create instance with custom options', () => {
      const options = {
        openaiApiKey: 'custom-key',
        model: 'gpt-3.5-turbo',
        maxTokens: 300,
        temperature: 0.5,
        dataPath: tempDataPath,
      };
      const testGenerator = new AISnippetGenerator(options);
      expect(testGenerator.options.model).to.equal('gpt-3.5-turbo');
      expect(testGenerator.options.maxTokens).to.equal(300);
      expect(testGenerator.options.temperature).to.equal(0.5);
    });

    it('should throw error without API key', () => {
      expect(() => new AISnippetGenerator({})).to.throw('OpenAI API key is required');
    });
  });

  describe('validateSnippetRequest', () => {
    it('should validate correct snippet request', () => {
      const validRequest = {
        content: 'This is a test article about web development',
        title: 'Test Article',
        url: 'https://example.com/article',
        platform: 'twitter',
        tone: 'engaging',
      };

      const result = validateSnippetRequest(validRequest);
      expect(result.valid).to.be.true;
      expect(result.errors).to.be.empty;
    });

    it('should reject request without required fields', () => {
      const invalidRequests = [
        {}, // Empty request
        { content: 'Test' }, // Missing title
        { title: 'Test' }, // Missing content
        { content: 'Test', title: 'Test', platform: 'invalid' }, // Invalid platform
        { content: 'Test', title: 'Test', tone: 'invalid' }, // Invalid tone
      ];

      invalidRequests.forEach(request => {
        const result = validateSnippetRequest(request);
        expect(result.valid).to.be.false;
        expect(result.errors).to.not.be.empty;
      });
    });

    it('should validate platform options', () => {
      const validPlatforms = ['twitter', 'linkedin', 'reddit', 'facebook', 'general'];
      const invalidPlatforms = ['instagram', 'tiktok', 'invalid'];

      validPlatforms.forEach(platform => {
        const result = validateSnippetRequest({
          content: 'Test content',
          title: 'Test title',
          platform,
        });
        expect(result.valid).to.be.true;
      });

      invalidPlatforms.forEach(platform => {
        const result = validateSnippetRequest({
          content: 'Test content',
          title: 'Test title',
          platform,
        });
        expect(result.valid).to.be.false;
      });
    });
  });

  describe('extractKeyInsights', () => {
    it('should extract insights from technical content', () => {
      const content = `
        This article discusses the new React 18 features including concurrent rendering,
        automatic batching, and Suspense improvements. The performance gains are significant,
        with 30% faster rendering in complex applications. However, migration requires
        careful consideration of breaking changes in the concurrent features.
      `;

      const insights = extractKeyInsights(content);
      expect(insights).to.be.an('array');
      expect(insights.length).to.be.greaterThan(0);
      expect(insights.some(insight => insight.toLowerCase().includes('react'))).to.be.true;
    });

    it('should handle empty or short content', () => {
      const shortContent = 'Short text';
      const insights = extractKeyInsights(shortContent);
      expect(insights).to.be.an('array');
      expect(insights.length).to.be.at.least(0);
    });

    it('should extract marketing-relevant insights', () => {
      const marketingContent = `
        The latest developer survey shows that 67% of developers prefer TypeScript over JavaScript.
        This trend indicates a shift towards type safety and better developer experience.
        Companies adopting TypeScript report 40% fewer runtime errors and improved code maintainability.
      `;

      const insights = extractKeyInsights(marketingContent);
      expect(insights).to.include.members(['Developer preferences', 'Type safety', 'Code quality']);
    });
  });

  describe('analyzeContent', () => {
    it('should analyze content and extract metadata', () => {
      const content = `
        Artificial Intelligence is revolutionizing software development with tools like GitHub Copilot
        and ChatGPT. These AI assistants help developers write code faster, debug issues, and learn
        new technologies. However, concerns about code quality and over-reliance on AI persist.
      `;

      const analysis = analyzeContent(content, 'AI in Software Development');
      expect(analysis).to.have.property('wordCount');
      expect(analysis).to.have.property('readingTime');
      expect(analysis).to.have.property('topics');
      expect(analysis).to.have.property('sentiment');
      expect(analysis).to.have.property('technicalLevel');
      expect(analysis.topics).to.include('AI');
      expect(analysis.wordCount).to.be.greaterThan(0);
    });

    it('should determine technical level', () => {
      const technicalContent = `
        The implementation uses a recursive descent parser with memoization to handle
        left-recursive grammars. The algorithm complexity is O(n³) in the worst case
        but performs well with typical programming language syntax.
      `;

      const casualContent = `
        This new app makes it easy to organize your photos. Just drag and drop
        your images and the app automatically sorts them by date and location.
      `;

      const technicalAnalysis = analyzeContent(technicalContent, 'Parser Implementation');
      const casualAnalysis = analyzeContent(casualContent, 'Photo App Review');

      expect(technicalAnalysis.technicalLevel).to.equal('advanced');
      expect(casualAnalysis.technicalLevel).to.equal('beginner');
    });
  });

  describe('formatSnippetForPlatform', () => {
    const baseSnippet = {
      content: "New JavaScript framework promises better performance and developer experience.",
      insights: ["Performance", "Developer experience"],
      tone: "engaging",
    };

    it('should format snippet for Twitter', () => {
      const formatted = formatSnippetForPlatform(baseSnippet, 'twitter');
      expect(formatted.content.length).to.be.at.most(280);
      expect(formatted.content).to.include('#');
      expect(formatted.platform).to.equal('twitter');
    });

    it('should format snippet for LinkedIn', () => {
      const formatted = formatSnippetForPlatform(baseSnippet, 'linkedin');
      expect(formatted.content.length).to.be.at.most(3000);
      expect(formatted.content).to.not.include('#');
      expect(formatted.platform).to.equal('linkedin');
      expect(formatted.content).to.not.include('#');
    });

    it('should format snippet for Reddit', () => {
      const formatted = formatSnippetForPlatform(baseSnippet, 'reddit');
      expect(formatted.content).to.include('?');
      expect(formatted.platform).to.equal('reddit');
    });

    it('should handle general platform', () => {
      const formatted = formatSnippetForPlatform(baseSnippet, 'general');
      expect(formatted.platform).to.equal('general');
      expect(formatted.content).to.exist;
    });
  });

  describe('generateSnippet function', () => {
    it('should generate snippet from RSS item', async () => {
      const rssItem = {
        title: 'New JavaScript Framework Announced',
        content: 'A revolutionary new JavaScript framework has been announced that promises to solve all our development problems with zero configuration and lightning-fast performance.',
        link: 'https://example.com/js-framework',
        pubDate: '2025-01-01T12:00:00Z',
      };

      const options = {
        platform: 'twitter',
        tone: 'engaging',
        mockMode: true,
        mockResponse: mockOpenAIResponse,
      };

      const result = await generateSnippet(rssItem, options);
      expect(result.success).to.be.true;
      expect(result.snippet).to.have.property('content');
      expect(result.snippet).to.have.property('insights');
      expect(result.snippet).to.have.property('platform', 'twitter');
      expect(result.snippet.content).to.include('🚀');
    });

    it('should handle API errors gracefully', async () => {
      const rssItem = {
        title: 'Test Article',
        content: 'Test content',
        link: 'https://example.com/test',
      };

      const options = {
        platform: 'twitter',
        mockMode: true,
        mockResponse: { error: 'API Error' },
      };

      const result = await generateSnippet(rssItem, options);
      expect(result.success).to.be.false;
      expect(result.error).to.exist;
    });

    it('should respect rate limits', async () => {
      const rssItem = {
        title: 'Test Article',
        content: 'Test content',
        link: 'https://example.com/test',
      };

      // Simulate multiple rapid requests
      const promises = Array(5).fill().map(() => 
        generateSnippet(rssItem, { 
          platform: 'twitter',
          mockMode: true,
          mockResponse: mockOpenAIResponse,
        })
      );

      const results = await Promise.all(promises);
      expect(results.every(r => r.success)).to.be.true;
    });
  });

  describe('AISnippetGenerator methods', () => {
    it('should generate snippet for RSS item', async () => {
      const rssItem = {
        title: 'AI Revolution in Development',
        content: 'Artificial intelligence is transforming how we write code, with new tools emerging daily.',
        link: 'https://example.com/ai-dev',
        pubDate: '2025-01-01T12:00:00Z',
      };

      const result = await generator.generateSnippet(rssItem, {
        platform: 'linkedin',
        tone: 'professional',
      });

      expect(result.success).to.be.true;
      expect(result.snippet).to.have.property('content');
      expect(result.snippet).to.have.property('platform', 'linkedin');
      expect(result.snippet).to.have.property('metadata');
    });

    it('should batch generate snippets', async () => {
      const rssItems = [
        {
          title: 'Article 1',
          content: 'Content 1 about web development',
          link: 'https://example.com/1',
        },
        {
          title: 'Article 2', 
          content: 'Content 2 about mobile development',
          link: 'https://example.com/2',
        },
      ];

      const results = await generator.batchGenerateSnippets(rssItems, {
        platform: 'twitter',
        tone: 'engaging',
      });

      expect(results).to.have.length(2);
      expect(results.every(r => r.success)).to.be.true;
    });

    it('should get generation statistics', async () => {
      // Generate a few snippets first
      const rssItem = {
        title: 'Test Article',
        content: 'Test content for statistics',
        link: 'https://example.com/test',
      };

      await generator.generateSnippet(rssItem, { platform: 'twitter' });
      await generator.generateSnippet(rssItem, { platform: 'linkedin' });

      const stats = await generator.getGenerationStats();
      expect(stats).to.have.property('totalGenerated');
      expect(stats).to.have.property('successfulGenerations');
      expect(stats).to.have.property('failedGenerations');
      expect(stats).to.have.property('platformBreakdown');
      expect(stats.totalGenerated).to.be.at.least(2);
    });

    it('should save and load generated snippets', async () => {
      const rssItem = {
        title: 'Saved Article',
        content: 'Content to be saved',
        link: 'https://example.com/saved',
      };

      const result = await generator.generateSnippet(rssItem, {
        platform: 'twitter',
        saveToFile: true,
      });

      expect(result.success).to.be.true;
      expect(result.snippet).to.have.property('id');

      // Load saved snippets
      const savedSnippets = await generator.loadSavedSnippets();
      expect(savedSnippets).to.have.length.at.least(1);
      expect(savedSnippets.some(s => s.id === result.snippet.id)).to.be.true;
    });

    it('should filter content by relevance', async () => {
      const irrelevantItem = {
        title: 'Celebrity Gossip News',
        content: 'Latest celebrity drama and entertainment news',
        link: 'https://example.com/gossip',
      };

      const relevantItem = {
        title: 'New React Hooks Released',
        content: 'React team announces new hooks for better state management',
        link: 'https://example.com/react-hooks',
      };

      const irrelevantResult = await generator.generateSnippet(irrelevantItem, {
        platform: 'twitter',
        filterRelevance: true,
      });

      const relevantResult = await generator.generateSnippet(relevantItem, {
        platform: 'twitter', 
        filterRelevance: true,
      });

      expect(irrelevantResult.success).to.be.false;
      expect(irrelevantResult.reason).to.include('relevance');
      expect(relevantResult.success).to.be.true;
    });
  });

  describe('Error handling and edge cases', () => {
    it('should handle malformed RSS content', async () => {
      const malformedItem = {
        title: null,
        content: undefined,
        link: 'not-a-url',
      };

      const result = await generator.generateSnippet(malformedItem, {
        platform: 'twitter',
      });

      expect(result.success).to.be.false;
      expect(result.error).to.include('Validation');
    });

    it('should handle very long content', async () => {
      const longContent = 'A'.repeat(10000);
      const longItem = {
        title: 'Very Long Article',
        content: longContent,
        link: 'https://example.com/long',
      };

      const result = await generator.generateSnippet(longItem, {
        platform: 'twitter',
      });

      expect(result.success).to.be.true;
      expect(result.snippet.content.length).to.be.at.most(280);
    });

    it('should handle network timeouts', async () => {
      const generator = new AISnippetGenerator({
        openaiApiKey: 'test-key',
        timeout: 1, // Very short timeout
        mockMode: true,
        mockDelay: 100, // Longer than timeout
      });

      const rssItem = {
        title: 'Timeout Test',
        content: 'This should timeout',
        link: 'https://example.com/timeout',
      };

      const result = await generator.generateSnippet(rssItem, {
        platform: 'twitter',
      });

      expect(result.success).to.be.false;
      expect(result.error).to.include('timeout');
    });
  });
});