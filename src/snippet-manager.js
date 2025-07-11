/**
 * Snippet Manager
 * Manages AI-generated snippets with CRUD operations, approval workflows, and analytics
 */

import fs from 'fs';
import path from 'path';
import os from 'os';

/**
 * Snippet Manager class for managing AI-generated social media snippets
 */
export class SnippetManager {
  constructor(options = {}) {
    this.options = {
      dataPath: options.dataPath || path.join(os.homedir(), '.config', 'rss-amplifier', 'snippets'),
      autoSave: options.autoSave !== false,
      maxSnippets: options.maxSnippets || 10000,
      ...options,
    };

    this.snippets = [];
    this.ensureDataDirectory();
    this.loadSnippets();
  }

  /**
   * Ensure data directory exists
   */
  ensureDataDirectory() {
    if (!fs.existsSync(this.options.dataPath)) {
      fs.mkdirSync(this.options.dataPath, { recursive: true });
    }
  }

  /**
   * Load snippets from storage
   */
  loadSnippets() {
    try {
      const snippetsFile = path.join(this.options.dataPath, 'snippets.json');
      if (fs.existsSync(snippetsFile)) {
        const data = fs.readFileSync(snippetsFile, 'utf8');
        this.snippets = JSON.parse(data);
      }
    } catch (error) {
      console.warn('Failed to load snippets, starting with empty collection:', error.message);
      this.snippets = [];
    }
  }

  /**
   * Save snippets to storage
   */
  saveSnippets() {
    try {
      const snippetsFile = path.join(this.options.dataPath, 'snippets.json');
      fs.writeFileSync(snippetsFile, JSON.stringify(this.snippets, null, 2));
    } catch (error) {
      console.error('Failed to save snippets:', error.message);
      throw error;
    }
  }

  /**
   * Generate unique snippet ID
   * @returns {string} Unique ID
   */
  generateSnippetId() {
    return `snippet_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Validate snippet data
   * @param {object} snippet - Snippet to validate
   * @returns {object} Validation result
   */
  validateSnippet(snippet) {
    const errors = [];

    if (!snippet.content || typeof snippet.content !== 'string') {
      errors.push('Content is required and must be a string');
    }

    if (snippet.content && snippet.content.length > 5000) {
      errors.push('Content must be less than 5000 characters');
    }

    const validPlatforms = ['twitter', 'linkedin', 'reddit', 'facebook', 'mastodon', 'bluesky', 'general'];
    if (snippet.platform && !validPlatforms.includes(snippet.platform)) {
      errors.push(`Platform must be one of: ${validPlatforms.join(', ')}`);
    }

    const validStatuses = ['pending', 'approved', 'rejected', 'posted', 'scheduled'];
    if (snippet.status && !validStatuses.includes(snippet.status)) {
      errors.push(`Status must be one of: ${validStatuses.join(', ')}`);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Check for duplicate content
   * @param {string} content - Content to check
   * @param {string} excludeId - ID to exclude from check
   * @returns {boolean} True if duplicate found
   */
  isDuplicateContent(content, excludeId = null) {
    return this.snippets.some(snippet => 
      snippet.content === content && snippet.id !== excludeId
    );
  }

  /**
   * Create a new snippet
   * @param {object} snippetData - Snippet data
   * @returns {Promise<object>} Creation result
   */
  async createSnippet(snippetData) {
    try {
      // Validate snippet data
      const validation = this.validateSnippet(snippetData);
      if (!validation.valid) {
        return {
          success: false,
          error: `Validation failed: ${validation.errors.join(', ')}`,
        };
      }

      // Check for duplicate content
      if (this.isDuplicateContent(snippetData.content)) {
        return {
          success: false,
          error: 'Duplicate content detected',
        };
      }

      // Create snippet with metadata
      const now = new Date().toISOString();
      const snippet = {
        id: this.generateSnippetId(),
        content: snippetData.content,
        platform: snippetData.platform || 'general',
        status: 'pending',
        insights: snippetData.insights || [],
        tone: snippetData.tone || 'engaging',
        sourceUrl: snippetData.sourceUrl || null,
        sourceTitle: snippetData.sourceTitle || null,
        generatedAt: snippetData.generatedAt || now,
        createdAt: now,
        updatedAt: now,
        metadata: snippetData.metadata || {},
        ...snippetData,
        // Override read-only fields
        id: this.generateSnippetId(),
        status: 'pending',
        createdAt: now,
        updatedAt: now,
      };

      // Add to collection
      this.snippets.push(snippet);

      // Save if auto-save is enabled
      if (this.options.autoSave) {
        this.saveSnippets();
      }

      return {
        success: true,
        snippet,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * List snippets with filtering and pagination
   * @param {object} options - List options
   * @returns {Promise<object>} List result
   */
  async listSnippets(options = {}) {
    try {
      let filteredSnippets = [...this.snippets];

      // Apply filters
      if (options.platform) {
        filteredSnippets = filteredSnippets.filter(s => s.platform === options.platform);
      }

      if (options.status) {
        filteredSnippets = filteredSnippets.filter(s => s.status === options.status);
      }

      if (options.sourceUrl) {
        filteredSnippets = filteredSnippets.filter(s => s.sourceUrl === options.sourceUrl);
      }

      // Apply sorting
      const sortBy = options.sortBy || 'createdAt';
      const sortOrder = options.sortOrder || 'desc';
      
      filteredSnippets.sort((a, b) => {
        let aVal = a[sortBy];
        let bVal = b[sortBy];
        
        // Handle date sorting
        if (sortBy.includes('At')) {
          aVal = new Date(aVal);
          bVal = new Date(bVal);
        }
        
        if (sortOrder === 'desc') {
          return bVal > aVal ? 1 : -1;
        } else {
          return aVal > bVal ? 1 : -1;
        }
      });

      // Apply pagination
      const total = filteredSnippets.length;
      const offset = options.offset || 0;
      const limit = options.limit || total;
      
      const paginatedSnippets = filteredSnippets.slice(offset, offset + limit);

      return {
        success: true,
        snippets: paginatedSnippets,
        total,
        offset,
        limit,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get snippet by ID
   * @param {string} id - Snippet ID
   * @returns {Promise<object>} Get result
   */
  async getSnippet(id) {
    try {
      const snippet = this.snippets.find(s => s.id === id);
      
      if (!snippet) {
        return {
          success: false,
          error: 'Snippet not found',
        };
      }

      return {
        success: true,
        snippet,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Update snippet
   * @param {string} id - Snippet ID
   * @param {object} updates - Updates to apply
   * @returns {Promise<object>} Update result
   */
  async updateSnippet(id, updates) {
    try {
      const snippetIndex = this.snippets.findIndex(s => s.id === id);
      
      if (snippetIndex === -1) {
        return {
          success: false,
          error: 'Snippet not found',
        };
      }

      const snippet = this.snippets[snippetIndex];
      
      // Validate updates
      const updatedSnippet = { ...snippet, ...updates };
      const validation = this.validateSnippet(updatedSnippet);
      if (!validation.valid) {
        return {
          success: false,
          error: `Validation failed: ${validation.errors.join(', ')}`,
        };
      }

      // Check for duplicate content if content is being updated
      if (updates.content && this.isDuplicateContent(updates.content, id)) {
        return {
          success: false,
          error: 'Duplicate content detected',
        };
      }

      // Apply updates (excluding read-only fields)
      const readOnlyFields = ['id', 'createdAt'];
      const allowedUpdates = Object.keys(updates).reduce((acc, key) => {
        if (!readOnlyFields.includes(key)) {
          acc[key] = updates[key];
        }
        return acc;
      }, {});

      // Update snippet
      this.snippets[snippetIndex] = {
        ...snippet,
        ...allowedUpdates,
        updatedAt: new Date().toISOString(),
      };

      // Save if auto-save is enabled
      if (this.options.autoSave) {
        this.saveSnippets();
      }

      return {
        success: true,
        snippet: this.snippets[snippetIndex],
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Delete snippet
   * @param {string} id - Snippet ID
   * @returns {Promise<object>} Delete result
   */
  async deleteSnippet(id) {
    try {
      const snippetIndex = this.snippets.findIndex(s => s.id === id);
      
      if (snippetIndex === -1) {
        return {
          success: false,
          error: 'Snippet not found',
        };
      }

      const snippet = this.snippets[snippetIndex];
      
      // Prevent deletion of posted snippets
      if (snippet.status === 'posted') {
        return {
          success: false,
          error: 'Cannot delete posted snippets',
        };
      }

      // Remove snippet
      this.snippets.splice(snippetIndex, 1);

      // Save if auto-save is enabled
      if (this.options.autoSave) {
        this.saveSnippets();
      }

      return {
        success: true,
        message: 'Snippet deleted successfully',
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Approve snippet
   * @param {string} id - Snippet ID
   * @param {string} notes - Approval notes
   * @returns {Promise<object>} Approval result
   */
  async approveSnippet(id, notes = null) {
    try {
      const snippet = this.snippets.find(s => s.id === id);
      
      if (!snippet) {
        return {
          success: false,
          error: 'Snippet not found',
        };
      }

      // Prevent approval of posted snippets
      if (snippet.status === 'posted') {
        return {
          success: false,
          error: 'Cannot approve posted snippets',
        };
      }

      // Update snippet status
      const updates = {
        status: 'approved',
        approvedAt: new Date().toISOString(),
      };

      if (notes) {
        updates.approvalNotes = notes;
      }

      return await this.updateSnippet(id, updates);
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Reject snippet
   * @param {string} id - Snippet ID
   * @param {string} reason - Rejection reason
   * @returns {Promise<object>} Rejection result
   */
  async rejectSnippet(id, reason) {
    try {
      if (!reason || typeof reason !== 'string') {
        return {
          success: false,
          error: 'Rejection reason is required',
        };
      }

      const snippet = this.snippets.find(s => s.id === id);
      
      if (!snippet) {
        return {
          success: false,
          error: 'Snippet not found',
        };
      }

      // Update snippet status
      const updates = {
        status: 'rejected',
        rejectionReason: reason,
        rejectedAt: new Date().toISOString(),
      };

      return await this.updateSnippet(id, updates);
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get snippets by status
   * @param {string} status - Status to filter by
   * @returns {Promise<object>} Filtered snippets
   */
  async getSnippetsByStatus(status) {
    return await this.listSnippets({ status });
  }

  /**
   * Search snippets
   * @param {string} query - Search query
   * @param {object} options - Search options
   * @returns {Promise<object>} Search results
   */
  async searchSnippets(query, options = {}) {
    try {
      const searchFields = options.fields || ['content', 'sourceTitle', 'insights'];
      const caseSensitive = options.caseSensitive || false;
      
      const searchQuery = caseSensitive ? query : query.toLowerCase();
      
      const matchingSnippets = this.snippets.filter(snippet => {
        return searchFields.some(field => {
          let fieldValue = snippet[field];
          
          if (Array.isArray(fieldValue)) {
            fieldValue = fieldValue.join(' ');
          }
          
          if (typeof fieldValue === 'string') {
            const searchValue = caseSensitive ? fieldValue : fieldValue.toLowerCase();
            return searchValue.includes(searchQuery);
          }
          
          return false;
        });
      });

      return {
        success: true,
        snippets: matchingSnippets,
        total: matchingSnippets.length,
        query,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Batch approve snippets
   * @param {Array} ids - Array of snippet IDs
   * @param {string} notes - Approval notes
   * @returns {Promise<object>} Batch approval result
   */
  async batchApproveSnippets(ids, notes = null) {
    const results = {
      success: true,
      approved: [],
      failed: [],
    };

    for (const id of ids) {
      const result = await this.approveSnippet(id, notes);
      if (result.success) {
        results.approved.push(id);
      } else {
        results.failed.push({ id, error: result.error });
      }
    }

    return results;
  }

  /**
   * Batch delete snippets
   * @param {Array} ids - Array of snippet IDs
   * @returns {Promise<object>} Batch delete result
   */
  async batchDeleteSnippets(ids) {
    const results = {
      success: true,
      deleted: [],
      failed: [],
    };

    for (const id of ids) {
      const result = await this.deleteSnippet(id);
      if (result.success) {
        results.deleted.push(id);
      } else {
        results.failed.push({ id, error: result.error });
      }
    }

    return results;
  }

  /**
   * Get snippet statistics
   * @returns {Promise<object>} Statistics
   */
  async getStatistics() {
    try {
      const stats = {
        total: this.snippets.length,
        pending: 0,
        approved: 0,
        rejected: 0,
        posted: 0,
        scheduled: 0,
        platformBreakdown: {},
        toneBreakdown: {},
        recentActivity: [],
      };

      // Count by status
      this.snippets.forEach(snippet => {
        stats[snippet.status] = (stats[snippet.status] || 0) + 1;
        
        // Platform breakdown
        stats.platformBreakdown[snippet.platform] = 
          (stats.platformBreakdown[snippet.platform] || 0) + 1;
        
        // Tone breakdown
        if (snippet.tone) {
          stats.toneBreakdown[snippet.tone] = 
            (stats.toneBreakdown[snippet.tone] || 0) + 1;
        }
      });

      // Recent activity (last 10 snippets)
      stats.recentActivity = this.snippets
        .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
        .slice(0, 10)
        .map(snippet => ({
          id: snippet.id,
          content: snippet.content.substring(0, 100) + '...',
          status: snippet.status,
          platform: snippet.platform,
          updatedAt: snippet.updatedAt,
        }));

      return {
        success: true,
        stats,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Export snippets
   * @param {object} options - Export options
   * @returns {Promise<object>} Export result
   */
  async exportSnippets(options = {}) {
    try {
      const format = options.format || 'json';
      const status = options.status || null;
      const platform = options.platform || null;
      
      let snippetsToExport = this.snippets;
      
      // Apply filters
      if (status) {
        snippetsToExport = snippetsToExport.filter(s => s.status === status);
      }
      
      if (platform) {
        snippetsToExport = snippetsToExport.filter(s => s.platform === platform);
      }

      let exportData;
      
      switch (format) {
        case 'json':
          exportData = JSON.stringify(snippetsToExport, null, 2);
          break;
        case 'csv':
          const headers = ['id', 'content', 'platform', 'status', 'createdAt', 'sourceUrl'];
          const csvRows = [headers.join(',')];
          snippetsToExport.forEach(snippet => {
            const row = headers.map(header => {
              const value = snippet[header] || '';
              return `"${value.toString().replace(/"/g, '""')}"`;
            });
            csvRows.push(row.join(','));
          });
          exportData = csvRows.join('\n');
          break;
        default:
          throw new Error(`Unsupported export format: ${format}`);
      }

      return {
        success: true,
        data: exportData,
        count: snippetsToExport.length,
        format,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Clean up old snippets
   * @param {object} options - Cleanup options
   * @returns {Promise<object>} Cleanup result
   */
  async cleanupSnippets(options = {}) {
    try {
      const maxAge = options.maxAge || 30; // days
      const statuses = options.statuses || ['rejected'];
      const dryRun = options.dryRun || false;
      
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - maxAge);
      
      const snippetsToDelete = this.snippets.filter(snippet => {
        const snippetDate = new Date(snippet.createdAt);
        return statuses.includes(snippet.status) && snippetDate < cutoffDate;
      });

      if (!dryRun) {
        for (const snippet of snippetsToDelete) {
          await this.deleteSnippet(snippet.id);
        }
      }

      return {
        success: true,
        deleted: dryRun ? 0 : snippetsToDelete.length,
        wouldDelete: snippetsToDelete.length,
        dryRun,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }
}

/**
 * Standalone functions for snippet management
 */

/**
 * Create snippet using standalone function
 * @param {object} snippetData - Snippet data
 * @param {object} options - Manager options
 * @returns {Promise<object>} Creation result
 */
export async function createSnippet(snippetData, options = {}) {
  const manager = new SnippetManager(options);
  return await manager.createSnippet(snippetData);
}

/**
 * List snippets using standalone function
 * @param {object} options - List and manager options
 * @returns {Promise<object>} List result
 */
export async function listSnippets(options = {}) {
  const { dataPath, ...listOptions } = options;
  const manager = new SnippetManager({ dataPath });
  return await manager.listSnippets(listOptions);
}

/**
 * Get snippet using standalone function
 * @param {string} id - Snippet ID
 * @param {object} options - Manager options
 * @returns {Promise<object>} Get result
 */
export async function getSnippet(id, options = {}) {
  const manager = new SnippetManager(options);
  return await manager.getSnippet(id);
}

/**
 * Update snippet using standalone function
 * @param {string} id - Snippet ID
 * @param {object} updates - Updates to apply
 * @param {object} options - Manager options
 * @returns {Promise<object>} Update result
 */
export async function updateSnippet(id, updates, options = {}) {
  const manager = new SnippetManager(options);
  return await manager.updateSnippet(id, updates);
}

/**
 * Delete snippet using standalone function
 * @param {string} id - Snippet ID
 * @param {object} options - Manager options
 * @returns {Promise<object>} Delete result
 */
export async function deleteSnippet(id, options = {}) {
  const manager = new SnippetManager(options);
  return await manager.deleteSnippet(id);
}

/**
 * Approve snippet using standalone function
 * @param {string} id - Snippet ID
 * @param {string} notes - Approval notes
 * @param {object} options - Manager options
 * @returns {Promise<object>} Approval result
 */
export async function approveSnippet(id, notes, options = {}) {
  const manager = new SnippetManager(options);
  return await manager.approveSnippet(id, notes);
}

/**
 * Reject snippet using standalone function
 * @param {string} id - Snippet ID
 * @param {string} reason - Rejection reason
 * @param {object} options - Manager options
 * @returns {Promise<object>} Rejection result
 */
export async function rejectSnippet(id, reason, options = {}) {
  const manager = new SnippetManager(options);
  return await manager.rejectSnippet(id, reason);
}

/**
 * Get snippets by status using standalone function
 * @param {string} status - Status to filter by
 * @param {object} options - Manager options
 * @returns {Promise<object>} Filtered snippets
 */
export async function getSnippetsByStatus(status, options = {}) {
  const manager = new SnippetManager(options);
  return await manager.getSnippetsByStatus(status);
}

/**
 * Search snippets using standalone function
 * @param {string} query - Search query
 * @param {object} options - Search and manager options
 * @returns {Promise<object>} Search results
 */
export async function searchSnippets(query, options = {}) {
  const { dataPath, ...searchOptions } = options;
  const manager = new SnippetManager({ dataPath });
  return await manager.searchSnippets(query, searchOptions);
}

export default {
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
};