/**
 * Ref MCP Integration - Specialized integration for documentation queries
 * 
 * This module provides a high-level interface for integrating the Ref MCP server
 * for documentation search and URL reading capabilities, specifically optimized
 * for VS Code extensions and development workflows.
 */

import { MCPService, MCPServiceConfig, MCPUtils } from './mcp-service.js';
import { MCPServerConfig } from './mcp-registry.js';
import path from 'path';
import fs from 'fs/promises';

export interface RefMCPConfig {
  enabled?: boolean;
  documentationPaths?: string[];
  remoteDocUrls?: string[];
  githubRepos?: {
    owner: string;
    repo: string;
    branch?: string;
    paths?: string[];
  }[];
  indexingOptions?: {
    includeMarkdown?: boolean;
    includeCode?: boolean;
    includeImages?: boolean;
    maxFileSize?: number;
  };
  searchOptions?: {
    fuzzySearch?: boolean;
    contextLines?: number;
    maxResults?: number;
  };
}

export interface DocumentationSearchRequest {
  query: string;
  scope?: 'local' | 'remote' | 'github' | 'all';
  fileTypes?: string[];
  maxResults?: number;
}

export interface DocumentationSearchResult {
  success: boolean;
  results?: {
    title: string;
    url?: string;
    filePath?: string;
    excerpt: string;
    relevanceScore?: number;
    type: 'markdown' | 'code' | 'documentation' | 'api' | 'tutorial';
    source: 'local' | 'remote' | 'github';
    metadata?: Record<string, any>;
  }[];
  totalResults: number;
  searchTime: number;
  error?: string;
}

export interface URLReadRequest {
  url: string;
  format?: 'markdown' | 'text' | 'html';
  includeImages?: boolean;
  followRedirects?: boolean;
}

export interface URLReadResult {
  success: boolean;
  content?: string;
  title?: string;
  metadata?: {
    url: string;
    finalUrl?: string;
    contentType?: string;
    wordCount?: number;
    imageCount?: number;
    linkCount?: number;
  };
  error?: string;
}

/**
 * Ref MCP Integration Service
 * 
 * Provides a high-level interface for documentation search and URL reading
 * using the Ref MCP server, with VS Code-specific optimizations.
 */
export class RefMCPIntegration {
  private mcpService: MCPService;
  private config: Required<RefMCPConfig>;
  private initialized = false;

  constructor(config: RefMCPConfig = {}) {
    this.config = {
      enabled: true,
      documentationPaths: [],
      remoteDocUrls: [],
      githubRepos: [],
      indexingOptions: {
        includeMarkdown: true,
        includeCode: true,
        includeImages: false,
        maxFileSize: 1024 * 1024 // 1MB
      },
      searchOptions: {
        fuzzySearch: true,
        contextLines: 3,
        maxResults: 20
      },
      ...config
    };

    // Configure MCP service with Ref tools
    const mcpConfig: MCPServiceConfig = {
      enableRefTools: this.config.enabled,
      enableFilesystemTools: false,
      customServers: this.config.enabled ? [this.createRefMCPServerConfig()] : []
    };

    this.mcpService = new MCPService(mcpConfig);
  }

  /**
   * Initialize the Ref MCP integration
   */
  async initialize(): Promise<void> {
    if (!this.config.enabled) {
      console.log('Ref MCP integration is disabled');
      return;
    }

    try {
      await this.mcpService.initialize();
      
      // Verify that ref tools are available
      const tools = this.mcpService.getAvailableToolsForAI();
      const refTools = tools.filter(tool => 
        tool.name.startsWith('ref_') || 
        tool.name.includes('search') || 
        tool.name.includes('read')
      );

      if (refTools.length === 0) {
        console.warn('No ref tools found after initialization');
      } else {
        console.log(`Ref MCP initialized with ${refTools.length} tools:`, refTools.map(t => t.name));
      }

      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize Ref MCP integration:', error);
      throw error;
    }
  }

  /**
   * Search documentation using various sources
   */
  async searchDocumentation(request: DocumentationSearchRequest): Promise<DocumentationSearchResult> {
    if (!this.initialized) {
      throw new Error('Ref MCP integration not initialized. Call initialize() first.');
    }

    const startTime = Date.now();
    
    try {
      // Use ref_search_documentation tool
      const toolResponse = await this.mcpService.executeToolForAI({
        name: 'ref_search_documentation',
        arguments: {
          query: request.query,
          max_results: request.maxResults || this.config.searchOptions.maxResults,
          context_lines: this.config.searchOptions.contextLines,
          fuzzy: this.config.searchOptions.fuzzySearch
        }
      });

      if (!toolResponse.success) {
        return {
          success: false,
          totalResults: 0,
          searchTime: Date.now() - startTime,
          error: toolResponse.error
        };
      }

      // Process and format results
      const rawResults = toolResponse.result?.results || [];
      const formattedResults = this.formatSearchResults(rawResults, request.scope);

      return {
        success: true,
        results: formattedResults,
        totalResults: formattedResults?.length || 0,
        searchTime: Date.now() - startTime
      };

    } catch (error) {
      return {
        success: false,
        totalResults: 0,
        searchTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Read and convert a URL to markdown
   */
  async readURL(request: URLReadRequest): Promise<URLReadResult> {
    if (!this.initialized) {
      throw new Error('Ref MCP integration not initialized. Call initialize() first.');
    }

    try {
      // Use ref_read_url tool
      const toolResponse = await this.mcpService.executeToolForAI({
        name: 'ref_read_url',
        arguments: {
          url: request.url,
          format: request.format || 'markdown',
          include_images: request.includeImages || false,
          follow_redirects: request.followRedirects !== false
        }
      });

      if (!toolResponse.success) {
        return {
          success: false,
          error: toolResponse.error
        };
      }

      const result = toolResponse.result;
      
      return {
        success: true,
        content: result.content,
        title: result.title,
        metadata: {
          url: request.url,
          finalUrl: result.final_url,
          contentType: result.content_type,
          wordCount: result.word_count,
          imageCount: result.image_count,
          linkCount: result.link_count
        }
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Search for code examples in documentation
   */
  async searchCodeExamples(language: string, topic: string): Promise<DocumentationSearchResult> {
    const query = `${language} ${topic} example code`;
    
    return this.searchDocumentation({
      query,
      scope: 'all',
      fileTypes: ['md', 'rst', 'txt'],
      maxResults: 15
    });
  }

  /**
   * Search for API documentation
   */
  async searchAPIDocumentation(apiName: string, method?: string): Promise<DocumentationSearchResult> {
    const query = method ? `${apiName} ${method} API documentation` : `${apiName} API documentation`;
    
    return this.searchDocumentation({
      query,
      scope: 'all',
      maxResults: 10
    });
  }

  /**
   * Get documentation for a specific GitHub repository
   */
  async getGitHubDocumentation(owner: string, repo: string, path?: string): Promise<URLReadResult> {
    const baseUrl = `https://raw.githubusercontent.com/${owner}/${repo}/main`;
    const docPath = path || 'README.md';
    const url = `${baseUrl}/${docPath}`;
    
    return this.readURL({ url, format: 'markdown' });
  }

  /**
   * Search local project documentation
   */
  async searchLocalDocs(query: string, projectPath?: string): Promise<DocumentationSearchResult> {
    if (projectPath) {
      // Add project path to search if not already included
      const projectDocs = await this.findProjectDocumentation(projectPath);
      // This would ideally update the MCP server configuration with new paths
    }

    return this.searchDocumentation({
      query,
      scope: 'local',
      maxResults: 15
    });
  }

  /**
   * Create the Ref MCP server configuration
   */
  private createRefMCPServerConfig(): MCPServerConfig {
    const env: Record<string, string> = {};
    
    // Add documentation paths
    if (this.config.documentationPaths.length > 0) {
      env.REF_DOCS_PATHS = this.config.documentationPaths.join(':');
    }
    
    // Add remote documentation URLs
    if (this.config.remoteDocUrls.length > 0) {
      env.REF_REMOTE_URLS = this.config.remoteDocUrls.join(',');
    }
    
    // Add GitHub repositories
    if (this.config.githubRepos.length > 0) {
      env.REF_GITHUB_REPOS = JSON.stringify(this.config.githubRepos);
    }

    // Add indexing options
    env.REF_INCLUDE_MARKDOWN = this.config.indexingOptions.includeMarkdown ? 'true' : 'false';
    env.REF_INCLUDE_CODE = this.config.indexingOptions.includeCode ? 'true' : 'false';
    env.REF_INCLUDE_IMAGES = this.config.indexingOptions.includeImages ? 'true' : 'false';
    env.REF_MAX_FILE_SIZE = this.config.indexingOptions.maxFileSize?.toString() || '1048576';

    return MCPUtils.createRefMCPConfig({
      id: 'ref-tools-enhanced',
      documentationPaths: this.config.documentationPaths,
      remoteDocUrls: this.config.remoteDocUrls
    });
  }

  /**
   * Format search results from raw MCP response
   */
  private formatSearchResults(rawResults: any[], scope?: string): DocumentationSearchResult['results'] {
    if (!rawResults || !Array.isArray(rawResults)) {
      return [];
    }
    
    return rawResults.map((result, index) => ({
      title: result.title || result.filename || `Result ${index + 1}`,
      url: result.url,
      filePath: result.file_path,
      excerpt: result.excerpt || result.content?.substring(0, 200) + '...',
      relevanceScore: result.score || (1 - index * 0.1),
      type: this.determineResultType(result),
      source: this.determineResultSource(result, scope),
      metadata: {
        lineNumber: result.line_number,
        fileSize: result.file_size,
        lastModified: result.last_modified,
        ...result.metadata
      }
    }));
  }

  /**
   * Determine the type of documentation result
   */
  private determineResultType(result: any): 'markdown' | 'code' | 'documentation' | 'api' | 'tutorial' {
    const filename = result.filename || result.file_path || '';
    const content = result.content || result.excerpt || '';
    
    if (filename.includes('api') || content.includes('API')) return 'api';
    if (filename.includes('tutorial') || content.includes('tutorial')) return 'tutorial';
    if (filename.endsWith('.md') || filename.endsWith('.rst')) return 'markdown';
    if (filename.match(/\.(js|ts|py|java|go|rs|c|cpp)$/)) return 'code';
    
    return 'documentation';
  }

  /**
   * Determine the source of the result
   */
  private determineResultSource(result: any, scope?: string): 'local' | 'remote' | 'github' {
    if (scope && scope !== 'all') return scope as any;
    
    if (result.url?.includes('github.com')) return 'github';
    if (result.url?.startsWith('http')) return 'remote';
    
    return 'local';
  }

  /**
   * Find documentation files in a project directory
   */
  private async findProjectDocumentation(projectPath: string): Promise<string[]> {
    const docFiles: string[] = [];
    const commonDocFiles = [
      'README.md', 'README.rst', 'README.txt',
      'CHANGELOG.md', 'CONTRIBUTING.md', 'LICENSE.md',
      'docs/', 'documentation/', 'guide/', 'examples/'
    ];

    try {
      for (const docFile of commonDocFiles) {
        const fullPath = path.join(projectPath, docFile);
        try {
          const stat = await fs.stat(fullPath);
          if (stat.isFile() || stat.isDirectory()) {
            docFiles.push(fullPath);
          }
        } catch {
          // File doesn't exist, continue
        }
      }
    } catch (error) {
      console.warn('Error scanning project documentation:', error);
    }

    return docFiles;
  }

  /**
   * Get the status of the Ref MCP integration
   */
  getStatus() {
    return {
      initialized: this.initialized,
      enabled: this.config.enabled,
      mcpStatus: this.mcpService.getHealthStatus(),
      config: {
        documentationPaths: this.config.documentationPaths.length,
        remoteDocUrls: this.config.remoteDocUrls.length,
        githubRepos: this.config.githubRepos.length
      }
    };
  }

  /**
   * Update configuration
   */
  async updateConfig(newConfig: Partial<RefMCPConfig>): Promise<void> {
    Object.assign(this.config, newConfig);
    
    // Reinitialize if enabled state changed
    if (newConfig.enabled !== undefined && this.initialized) {
      await this.shutdown();
      if (newConfig.enabled) {
        await this.initialize();
      }
    }
  }

  /**
   * Shutdown the integration
   */
  async shutdown(): Promise<void> {
    await this.mcpService.shutdown();
    this.initialized = false;
  }
}

/**
 * Utility functions for VS Code-specific integrations
 */
export class VSCodeRefIntegration {
  /**
   * Create a Ref MCP integration configured for VS Code workspace
   */
  static createForWorkspace(workspacePath: string, config: RefMCPConfig = {}): RefMCPIntegration {
    const workspaceConfig: RefMCPConfig = {
      ...config,
      documentationPaths: [
        workspacePath,
        path.join(workspacePath, 'docs'),
        path.join(workspacePath, 'documentation'),
        ...(config.documentationPaths || [])
      ],
      remoteDocUrls: [
        'https://code.visualstudio.com/api',
        'https://code.visualstudio.com/docs',
        ...(config.remoteDocUrls || [])
      ]
    };

    return new RefMCPIntegration(workspaceConfig);
  }

  /**
   * Search for VS Code API documentation
   */
  static async searchVSCodeAPI(integration: RefMCPIntegration, query: string): Promise<DocumentationSearchResult> {
    return integration.searchDocumentation({
      query: `vscode api ${query}`,
      scope: 'remote',
      maxResults: 10
    });
  }

  /**
   * Get documentation for a VS Code extension
   */
  static async getExtensionDocs(integration: RefMCPIntegration, extensionId: string): Promise<URLReadResult> {
    const url = `https://marketplace.visualstudio.com/items?itemName=${extensionId}`;
    return integration.readURL({ url, format: 'markdown' });
  }
}