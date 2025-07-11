/**
 * Snippet Manager Tests
 * Testing snippet CRUD operations, approval workflows, and management features
 */

import { expect } from 'chai';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  SnippetManager,
  createSnippet,
  listSnippets,
  getSnippet,
  updateSnippet,
  deleteSnippet,
  approveSnippet,
  rejectSnippet,
  getSnippetsByStatus,
  searchSnippets,
} from '../src/snippet-manager.js';

describe('Snippet Manager', () => {
  let tempDataPath;
  let snippetManager;
  let sampleSnippet;

  beforeEach(() => {
    // Create temporary data path for testing
    tempDataPath = path.join(os.tmpdir(), `rss-amplifier-snippets-test-${Date.now()}`);
    fs.mkdirSync(tempDataPath, { recursive: true });
    
    // Create snippet manager instance
    snippetManager = new SnippetManager({
      dataPath: tempDataPath,
    });

    // Sample snippet for testing
    sampleSnippet = {
      content: "🚀 The future of web development is here! New framework promises 50% faster builds and zero-config setup. What's your take on the endless cycle of JavaScript frameworks?",
      platform: 'twitter',
      insights: ['Performance optimization', 'Developer experience', 'Framework fatigue'],
      tone: 'engaging',
      sourceUrl: 'https://example.com/js-framework',
      sourceTitle: 'New JavaScript Framework Announced',
      generatedAt: new Date().toISOString(),
      metadata: {
        analysis: {
          wordCount: 25,
          technicalLevel: 'intermediate',
          sentiment: 'positive',
        },
        originalContent: 'A revolutionary new JavaScript framework...',
      },
    };
  });

  afterEach(() => {
    // Clean up temporary data
    if (fs.existsSync(tempDataPath)) {
      fs.rmSync(tempDataPath, { recursive: true, force: true });
    }
  });

  describe('SnippetManager constructor', () => {
    it('should create instance with default options', () => {
      const manager = new SnippetManager();
      expect(manager).to.be.instanceOf(SnippetManager);
      expect(manager.options).to.have.property('dataPath');
    });

    it('should create instance with custom options', () => {
      const options = {
        dataPath: tempDataPath,
        autoSave: false,
      };
      const manager = new SnippetManager(options);
      expect(manager.options.dataPath).to.equal(tempDataPath);
      expect(manager.options.autoSave).to.be.false;
    });

    it('should create data directory if it does not exist', () => {
      const newPath = path.join(tempDataPath, 'new-dir');
      new SnippetManager({ dataPath: newPath });
      expect(fs.existsSync(newPath)).to.be.true;
    });
  });

  describe('createSnippet', () => {
    it('should create a new snippet with generated ID', async () => {
      const result = await snippetManager.createSnippet(sampleSnippet);
      
      expect(result.success).to.be.true;
      expect(result.snippet).to.have.property('id');
      expect(result.snippet.status).to.equal('pending');
      expect(result.snippet.content).to.equal(sampleSnippet.content);
      expect(result.snippet.createdAt).to.exist;
      expect(result.snippet.updatedAt).to.exist;
    });

    it('should validate required fields', async () => {
      const invalidSnippet = { platform: 'twitter' };
      const result = await snippetManager.createSnippet(invalidSnippet);
      
      expect(result.success).to.be.false;
      expect(result.error).to.include('Content');
    });

    it('should save snippet to file system', async () => {
      const result = await snippetManager.createSnippet(sampleSnippet);
      const snippetsFile = path.join(tempDataPath, 'snippets.json');
      
      expect(fs.existsSync(snippetsFile)).to.be.true;
      const savedData = JSON.parse(fs.readFileSync(snippetsFile, 'utf8'));
      expect(savedData).to.have.length(1);
      expect(savedData[0].id).to.equal(result.snippet.id);
    });

    it('should handle duplicate content detection', async () => {
      await snippetManager.createSnippet(sampleSnippet);
      const result = await snippetManager.createSnippet(sampleSnippet);
      
      expect(result.success).to.be.false;
      expect(result.error).to.include('Duplicate');
    });
  });

  describe('listSnippets', () => {
    beforeEach(async () => {
      // Create test snippets
      await snippetManager.createSnippet({ ...sampleSnippet, content: 'First snippet' });
      await snippetManager.createSnippet({ ...sampleSnippet, content: 'Second snippet', platform: 'linkedin' });
      await snippetManager.createSnippet({ ...sampleSnippet, content: 'Third snippet', platform: 'reddit' });
    });

    it('should list all snippets', async () => {
      const result = await snippetManager.listSnippets();
      
      expect(result.success).to.be.true;
      expect(result.snippets).to.have.length(3);
      expect(result.total).to.equal(3);
    });

    it('should support pagination', async () => {
      const result = await snippetManager.listSnippets({ limit: 2, offset: 1 });
      
      expect(result.success).to.be.true;
      expect(result.snippets).to.have.length(2);
      expect(result.total).to.equal(3);
      expect(result.offset).to.equal(1);
      expect(result.limit).to.equal(2);
    });

    it('should filter by platform', async () => {
      const result = await snippetManager.listSnippets({ platform: 'linkedin' });
      
      expect(result.success).to.be.true;
      expect(result.snippets).to.have.length(1);
      expect(result.snippets[0].platform).to.equal('linkedin');
    });

    it('should filter by status', async () => {
      const result = await snippetManager.listSnippets({ status: 'pending' });
      
      expect(result.success).to.be.true;
      expect(result.snippets).to.have.length(3);
      expect(result.snippets.every(s => s.status === 'pending')).to.be.true;
    });

    it('should sort snippets', async () => {
      const result = await snippetManager.listSnippets({ 
        sortBy: 'createdAt', 
        sortOrder: 'desc' 
      });
      
      expect(result.success).to.be.true;
      expect(result.snippets).to.have.length(3);
      // Check that snippets are sorted by creation date (newest first)
      const dates = result.snippets.map(s => new Date(s.createdAt));
      expect(dates[0] >= dates[1]).to.be.true;
      expect(dates[1] >= dates[2]).to.be.true;
    });
  });

  describe('getSnippet', () => {
    let snippetId;

    beforeEach(async () => {
      const result = await snippetManager.createSnippet(sampleSnippet);
      snippetId = result.snippet.id;
    });

    it('should retrieve snippet by ID', async () => {
      const result = await snippetManager.getSnippet(snippetId);
      
      expect(result.success).to.be.true;
      expect(result.snippet.id).to.equal(snippetId);
      expect(result.snippet.content).to.equal(sampleSnippet.content);
    });

    it('should return error for non-existent snippet', async () => {
      const result = await snippetManager.getSnippet('non-existent-id');
      
      expect(result.success).to.be.false;
      expect(result.error).to.include('not found');
    });
  });

  describe('updateSnippet', () => {
    let snippetId;

    beforeEach(async () => {
      const result = await snippetManager.createSnippet(sampleSnippet);
      snippetId = result.snippet.id;
    });

    it('should update snippet content', async () => {
      // Add small delay to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 10));
      const updates = { content: 'Updated content' };
      const result = await snippetManager.updateSnippet(snippetId, updates);
      
      expect(result.success).to.be.true;
      expect(result.snippet.content).to.equal('Updated content');
      expect(result.snippet.updatedAt).to.not.equal(result.snippet.createdAt);
    });

    it('should update snippet platform', async () => {
      const updates = { platform: 'linkedin' };
      const result = await snippetManager.updateSnippet(snippetId, updates);
      
      expect(result.success).to.be.true;
      expect(result.snippet.platform).to.equal('linkedin');
    });

    it('should not allow updating read-only fields', async () => {
      // Add small delay to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 10));
      const updates = { id: 'new-id', createdAt: new Date().toISOString() };
      const result = await snippetManager.updateSnippet(snippetId, updates);
      
      expect(result.success).to.be.true;
      expect(result.snippet.id).to.equal(snippetId); // Should not change
      expect(result.snippet.createdAt).to.not.equal(updates.createdAt);
    });

    it('should return error for non-existent snippet', async () => {
      const result = await snippetManager.updateSnippet('non-existent-id', { content: 'test' });
      
      expect(result.success).to.be.false;
      expect(result.error).to.include('not found');
    });
  });

  describe('deleteSnippet', () => {
    let snippetId;

    beforeEach(async () => {
      const result = await snippetManager.createSnippet(sampleSnippet);
      snippetId = result.snippet.id;
    });

    it('should delete snippet by ID', async () => {
      const result = await snippetManager.deleteSnippet(snippetId);
      
      expect(result.success).to.be.true;
      expect(result.message).to.include('deleted');
      
      // Verify snippet is actually deleted
      const getResult = await snippetManager.getSnippet(snippetId);
      expect(getResult.success).to.be.false;
    });

    it('should return error for non-existent snippet', async () => {
      const result = await snippetManager.deleteSnippet('non-existent-id');
      
      expect(result.success).to.be.false;
      expect(result.error).to.include('not found');
    });

    it('should prevent deletion of posted snippets', async () => {
      // First approve and mark as posted
      await snippetManager.approveSnippet(snippetId);
      await snippetManager.updateSnippet(snippetId, { status: 'posted' });
      
      const result = await snippetManager.deleteSnippet(snippetId);
      
      expect(result.success).to.be.false;
      expect(result.error).to.include('posted');
    });
  });

  describe('approveSnippet', () => {
    let snippetId;

    beforeEach(async () => {
      const result = await snippetManager.createSnippet(sampleSnippet);
      snippetId = result.snippet.id;
    });

    it('should approve pending snippet', async () => {
      const result = await snippetManager.approveSnippet(snippetId);
      
      expect(result.success).to.be.true;
      expect(result.snippet.status).to.equal('approved');
      expect(result.snippet.approvedAt).to.exist;
    });

    it('should allow approval with notes', async () => {
      const notes = 'Approved with minor edits';
      const result = await snippetManager.approveSnippet(snippetId, notes);
      
      expect(result.success).to.be.true;
      expect(result.snippet.approvalNotes).to.equal(notes);
    });

    it('should return error for non-existent snippet', async () => {
      const result = await snippetManager.approveSnippet('non-existent-id');
      
      expect(result.success).to.be.false;
      expect(result.error).to.include('not found');
    });

    it('should prevent approval of already posted snippets', async () => {
      await snippetManager.updateSnippet(snippetId, { status: 'posted' });
      const result = await snippetManager.approveSnippet(snippetId);
      
      expect(result.success).to.be.false;
      expect(result.error).to.include('posted');
    });
  });

  describe('rejectSnippet', () => {
    let snippetId;

    beforeEach(async () => {
      const result = await snippetManager.createSnippet(sampleSnippet);
      snippetId = result.snippet.id;
    });

    it('should reject pending snippet', async () => {
      const reason = 'Content not relevant';
      const result = await snippetManager.rejectSnippet(snippetId, reason);
      
      expect(result.success).to.be.true;
      expect(result.snippet.status).to.equal('rejected');
      expect(result.snippet.rejectionReason).to.equal(reason);
      expect(result.snippet.rejectedAt).to.exist;
    });

    it('should require rejection reason', async () => {
      const result = await snippetManager.rejectSnippet(snippetId);
      
      expect(result.success).to.be.false;
      expect(result.error).to.include('reason');
    });
  });

  describe('getSnippetsByStatus', () => {
    beforeEach(async () => {
      // Create snippets with different statuses
      const snippet1 = await snippetManager.createSnippet({ ...sampleSnippet, content: 'Pending 1' });
      const snippet2 = await snippetManager.createSnippet({ ...sampleSnippet, content: 'Pending 2' });
      const snippet3 = await snippetManager.createSnippet({ ...sampleSnippet, content: 'To approve' });
      
      await snippetManager.approveSnippet(snippet3.snippet.id);
      await snippetManager.rejectSnippet(snippet2.snippet.id, 'Test rejection');
    });

    it('should get pending snippets', async () => {
      const result = await snippetManager.getSnippetsByStatus('pending');
      
      expect(result.success).to.be.true;
      expect(result.snippets).to.have.length(1);
      expect(result.snippets[0].status).to.equal('pending');
    });

    it('should get approved snippets', async () => {
      const result = await snippetManager.getSnippetsByStatus('approved');
      
      expect(result.success).to.be.true;
      expect(result.snippets).to.have.length(1);
      expect(result.snippets[0].status).to.equal('approved');
    });

    it('should get rejected snippets', async () => {
      const result = await snippetManager.getSnippetsByStatus('rejected');
      
      expect(result.success).to.be.true;
      expect(result.snippets).to.have.length(1);
      expect(result.snippets[0].status).to.equal('rejected');
    });
  });

  describe('searchSnippets', () => {
    beforeEach(async () => {
      // Clear any existing snippets first
      snippetManager.snippets = [];
      await snippetManager.createSnippet({ ...sampleSnippet, content: 'JavaScript framework performance' });
      await snippetManager.createSnippet({ ...sampleSnippet, content: 'React hooks tutorial' });
      await snippetManager.createSnippet({ ...sampleSnippet, content: 'Vue.js component design' });
    });

    it('should search snippets by content', async () => {
      const result = await snippetManager.searchSnippets('JavaScript', { fields: ['content'] });
      
      expect(result.success).to.be.true;
      expect(result.snippets).to.have.length(1);
      expect(result.snippets[0].content).to.include('JavaScript');
    });

    it('should search snippets case-insensitively', async () => {
      const result = await snippetManager.searchSnippets('react');
      
      expect(result.success).to.be.true;
      expect(result.snippets).to.have.length(1);
      expect(result.snippets[0].content).to.include('React');
    });

    it('should return empty results for no matches', async () => {
      const result = await snippetManager.searchSnippets('nonexistent');
      
      expect(result.success).to.be.true;
      expect(result.snippets).to.have.length(0);
    });

    it('should search in multiple fields', async () => {
      const result = await snippetManager.searchSnippets('component');
      
      expect(result.success).to.be.true;
      expect(result.snippets).to.have.length(1);
    });
  });

  describe('Batch operations', () => {
    let snippetIds;

    beforeEach(async () => {
      const results = await Promise.all([
        snippetManager.createSnippet({ ...sampleSnippet, content: 'Batch 1' }),
        snippetManager.createSnippet({ ...sampleSnippet, content: 'Batch 2' }),
        snippetManager.createSnippet({ ...sampleSnippet, content: 'Batch 3' }),
      ]);
      snippetIds = results.map(r => r.snippet.id);
    });

    it('should approve multiple snippets', async () => {
      const result = await snippetManager.batchApproveSnippets(snippetIds);
      
      expect(result.success).to.be.true;
      expect(result.approved).to.have.length(3);
      expect(result.failed).to.have.length(0);
    });

    it('should delete multiple snippets', async () => {
      const result = await snippetManager.batchDeleteSnippets(snippetIds);
      
      expect(result.success).to.be.true;
      expect(result.deleted).to.have.length(3);
      expect(result.failed).to.have.length(0);
    });

    it('should handle partial failures in batch operations', async () => {
      // Approve one snippet first, then try to delete all (should fail for approved one)
      await snippetManager.approveSnippet(snippetIds[0]);
      await snippetManager.updateSnippet(snippetIds[0], { status: 'posted' });
      
      const result = await snippetManager.batchDeleteSnippets(snippetIds);
      
      expect(result.success).to.be.true;
      expect(result.deleted).to.have.length(2);
      expect(result.failed).to.have.length(1);
    });
  });

  describe('Statistics and analytics', () => {
    beforeEach(async () => {
      // Clear any existing snippets first
      snippetManager.snippets = [];
      // Create snippets with different statuses and platforms
      const snippet1 = await snippetManager.createSnippet({ ...sampleSnippet, content: 'Twitter snippet', platform: 'twitter' });
      const snippet2 = await snippetManager.createSnippet({ ...sampleSnippet, content: 'LinkedIn snippet', platform: 'linkedin' });
      const snippet3 = await snippetManager.createSnippet({ ...sampleSnippet, content: 'Another Twitter snippet', platform: 'twitter' });
      
      await snippetManager.approveSnippet(snippet1.snippet.id);
      await snippetManager.rejectSnippet(snippet2.snippet.id, 'Test');
    });

    it('should get snippet statistics', async () => {
      const result = await snippetManager.getStatistics();
      
      expect(result.success).to.be.true;
      expect(result.stats).to.have.property('total', 3);
      expect(result.stats).to.have.property('pending', 1);
      expect(result.stats).to.have.property('approved', 1);
      expect(result.stats).to.have.property('rejected', 1);
      expect(result.stats).to.have.property('posted', 0);
    });

    it('should get platform breakdown', async () => {
      const result = await snippetManager.getStatistics();
      
      expect(result.stats.platformBreakdown).to.have.property('twitter', 2);
      expect(result.stats.platformBreakdown).to.have.property('linkedin', 1);
    });
  });

  describe('Standalone functions', () => {
    it('should create snippet using standalone function', async () => {
      const result = await createSnippet(sampleSnippet, { dataPath: tempDataPath });
      
      expect(result.success).to.be.true;
      expect(result.snippet).to.have.property('id');
    });

    it('should list snippets using standalone function', async () => {
      await createSnippet(sampleSnippet, { dataPath: tempDataPath });
      const result = await listSnippets({ dataPath: tempDataPath });
      
      expect(result.success).to.be.true;
      expect(result.snippets).to.have.length(1);
    });
  });

  describe('Error handling and edge cases', () => {
    it('should handle corrupted data file', async () => {
      const snippetsFile = path.join(tempDataPath, 'snippets.json');
      fs.writeFileSync(snippetsFile, 'invalid json');
      
      const result = await snippetManager.listSnippets();
      
      expect(result.success).to.be.true;
      expect(result.snippets).to.have.length(0);
    });

    it('should handle missing data directory', async () => {
      const missingPath = path.join(tempDataPath, 'missing');
      const manager = new SnippetManager({ dataPath: missingPath });
      
      const result = await manager.createSnippet(sampleSnippet);
      
      expect(result.success).to.be.true;
      expect(fs.existsSync(missingPath)).to.be.true;
    });

    it('should validate snippet data structure', async () => {
      const invalidSnippet = {
        content: 'Valid content',
        platform: 'invalid-platform',
      };
      
      const result = await snippetManager.createSnippet(invalidSnippet);
      
      expect(result.success).to.be.false;
      expect(result.error).to.include('Platform');
    });
  });
});