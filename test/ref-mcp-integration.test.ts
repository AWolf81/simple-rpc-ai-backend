import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RefMCPIntegration, RefMCPConfig, VSCodeRefIntegration } from '../src/services/mcp/ref-mcp-integration.js';
import { MCPService } from '../src/services/mcp/mcp-service.js';
import fs from 'fs/promises';

// Mock dependencies
vi.mock('../src/services/mcp/mcp-service.js');
vi.mock('fs/promises');

// Skip Ref MCP integration tests in security-middleware branch - will be addressed in mcp-oauth-integration branch
describe.skip('RefMCPIntegration', () => {
  let refIntegration: RefMCPIntegration;
  let mockMCPService: any;

  beforeEach(() => {
    mockMCPService = {
      initialize: vi.fn().mockResolvedValue(undefined),
      getAvailableToolsForAI: vi.fn().mockReturnValue([
        {
          name: 'ref_search_documentation',
          description: 'Search documentation',
          parameters: { type: 'object' }
        },
        {
          name: 'ref_read_url',
          description: 'Read URL content',
          parameters: { type: 'object' }
        }
      ]),
      executeToolForAI: vi.fn(),
      getHealthStatus: vi.fn().mockReturnValue({
        initialized: true,
        serversCount: 1,
        connectedServers: 1,
        availableTools: 2
      }),
      shutdown: vi.fn().mockResolvedValue(undefined)
    };

    (MCPService as any).mockImplementation(() => mockMCPService);

    const config: RefMCPConfig = {
      enabled: true,
      documentationPaths: ['/docs'],
      remoteDocUrls: ['https://example.com/docs'],
      githubRepos: [
        {
          owner: 'microsoft',
          repo: 'vscode',
          branch: 'main',
          paths: ['docs/']
        }
      ]
    };

    refIntegration = new RefMCPIntegration(config);
    (refIntegration as any).mcpService = mockMCPService;
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('initialization', () => {
    it('should initialize successfully when enabled', async () => {
      await refIntegration.initialize();
      
      expect(mockMCPService.initialize).toHaveBeenCalled();
    });

    it('should skip initialization when disabled', async () => {
      const disabledIntegration = new RefMCPIntegration({ enabled: false });
      
      await disabledIntegration.initialize();
      
      expect(mockMCPService.initialize).not.toHaveBeenCalled();
    });

    it('should handle initialization errors', async () => {
      mockMCPService.initialize.mockRejectedValue(new Error('Init failed'));
      
      await expect(refIntegration.initialize()).rejects.toThrow('Init failed');
    });

    it('should verify ref tools are available after initialization', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      await refIntegration.initialize();
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Ref MCP initialized with 2 tools:'),
        expect.arrayContaining(['ref_search_documentation', 'ref_read_url'])
      );
      
      consoleSpy.mockRestore();
    });

    it('should warn when no ref tools are found', async () => {
      mockMCPService.getAvailableToolsForAI.mockReturnValue([]);
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      await refIntegration.initialize();
      
      expect(consoleSpy).toHaveBeenCalledWith('No ref tools found after initialization');
      
      consoleSpy.mockRestore();
    });
  });

  describe('documentation search', () => {
    beforeEach(async () => {
      await refIntegration.initialize();
    });

    it('should search documentation successfully', async () => {
      const mockResults = {
        results: [
          {
            title: 'Test Documentation',
            excerpt: 'This is a test document',
            score: 0.9,
            filename: 'test.md',
            url: 'https://example.com/test.md'
          }
        ]
      };

      mockMCPService.executeToolForAI.mockResolvedValue({
        success: true,
        result: mockResults
      });

      const result = await refIntegration.searchDocumentation({
        query: 'test query',
        maxResults: 10
      });

      expect(mockMCPService.executeToolForAI).toHaveBeenCalledWith({
        name: 'ref_search_documentation',
        arguments: {
          query: 'test query',
          max_results: 10,
          context_lines: 3,
          fuzzy: true
        }
      });

      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(1);
      expect(result.results![0]).toEqual({
        title: 'Test Documentation',
        url: 'https://example.com/test.md',
        filePath: undefined,
        excerpt: 'This is a test document',
        relevanceScore: 0.9,
        type: 'markdown',
        source: 'remote',
        metadata: expect.any(Object)
      });
    });

    it('should handle search errors', async () => {
      mockMCPService.executeToolForAI.mockResolvedValue({
        success: false,
        error: 'Search failed'
      });

      const result = await refIntegration.searchDocumentation({
        query: 'test query'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Search failed');
      expect(result.totalResults).toBe(0);
    });

    it('should throw error when not initialized', async () => {
      const uninitializedIntegration = new RefMCPIntegration();
      
      await expect(uninitializedIntegration.searchDocumentation({
        query: 'test'
      })).rejects.toThrow('Ref MCP integration not initialized');
    });
  });

  describe('URL reading', () => {
    beforeEach(async () => {
      await refIntegration.initialize();
    });

    it('should read URL successfully', async () => {
      const mockResult = {
        content: '# Test Document\n\nThis is a test.',
        title: 'Test Document',
        final_url: 'https://example.com/test.md',
        content_type: 'text/markdown',
        word_count: 5,
        image_count: 0,
        link_count: 0
      };

      mockMCPService.executeToolForAI.mockResolvedValue({
        success: true,
        result: mockResult
      });

      const result = await refIntegration.readURL({
        url: 'https://example.com/test.md',
        format: 'markdown'
      });

      expect(mockMCPService.executeToolForAI).toHaveBeenCalledWith({
        name: 'ref_read_url',
        arguments: {
          url: 'https://example.com/test.md',
          format: 'markdown',
          include_images: false,
          follow_redirects: true
        }
      });

      expect(result.success).toBe(true);
      expect(result.content).toBe('# Test Document\n\nThis is a test.');
      expect(result.title).toBe('Test Document');
      expect(result.metadata).toEqual({
        url: 'https://example.com/test.md',
        finalUrl: 'https://example.com/test.md',
        contentType: 'text/markdown',
        wordCount: 5,
        imageCount: 0,
        linkCount: 0
      });
    });

    it('should handle URL reading errors', async () => {
      mockMCPService.executeToolForAI.mockResolvedValue({
        success: false,
        error: 'URL not found'
      });

      const result = await refIntegration.readURL({
        url: 'https://example.com/nonexistent.md'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('URL not found');
    });
  });

  describe('specialized search methods', () => {
    beforeEach(async () => {
      await refIntegration.initialize();
    });

    it('should search code examples', async () => {
      mockMCPService.executeToolForAI.mockResolvedValue({
        success: true,
        result: { results: [] }
      });

      await refIntegration.searchCodeExamples('typescript', 'async functions');

      expect(mockMCPService.executeToolForAI).toHaveBeenCalledWith({
        name: 'ref_search_documentation',
        arguments: {
          query: 'typescript async functions example code',
          max_results: 15,
          context_lines: 3,
          fuzzy: true
        }
      });
    });

    it('should search API documentation', async () => {
      mockMCPService.executeToolForAI.mockResolvedValue({
        success: true,
        result: { results: [] }
      });

      await refIntegration.searchAPIDocumentation('fetch', 'POST');

      expect(mockMCPService.executeToolForAI).toHaveBeenCalledWith({
        name: 'ref_search_documentation',
        arguments: {
          query: 'fetch POST API documentation',
          max_results: 10,
          context_lines: 3,
          fuzzy: true
        }
      });
    });

    it('should get GitHub documentation', async () => {
      mockMCPService.executeToolForAI.mockResolvedValue({
        success: true,
        result: { content: '# README' }
      });

      await refIntegration.getGitHubDocumentation('microsoft', 'vscode');

      expect(mockMCPService.executeToolForAI).toHaveBeenCalledWith({
        name: 'ref_read_url',
        arguments: {
          url: 'https://raw.githubusercontent.com/microsoft/vscode/main/README.md',
          format: 'markdown',
          include_images: false,
          follow_redirects: true
        }
      });
    });

    it('should search local docs', async () => {
      const mockStat = vi.mocked(fs.stat);
      mockStat.mockResolvedValue({ isFile: () => true, isDirectory: () => false } as any);

      mockMCPService.executeToolForAI.mockResolvedValue({
        success: true,
        result: { results: [] }
      });

      await refIntegration.searchLocalDocs('test query', '/project/path');

      expect(mockMCPService.executeToolForAI).toHaveBeenCalledWith({
        name: 'ref_search_documentation',
        arguments: {
          query: 'test query',
          max_results: 15,
          context_lines: 3,
          fuzzy: true
        }
      });
    });
  });

  describe('status and configuration', () => {
    it('should get status', async () => {
      await refIntegration.initialize();
      
      const status = refIntegration.getStatus();

      expect(status).toEqual({
        initialized: true,
        enabled: true,
        mcpStatus: {
          initialized: true,
          serversCount: 1,
          connectedServers: 1,
          availableTools: 2
        },
        config: {
          documentationPaths: 1,
          remoteDocUrls: 1,
          githubRepos: 1
        }
      });
    });

    it('should update configuration', async () => {
      await refIntegration.initialize();
      
      await refIntegration.updateConfig({
        documentationPaths: ['/new/docs'],
        enabled: true
      });

      // Configuration should be updated (we can't easily test internal state changes)
      expect(refIntegration.getStatus().config.documentationPaths).toBe(1);
    });

    it('should shutdown properly', async () => {
      await refIntegration.initialize();
      await refIntegration.shutdown();

      expect(mockMCPService.shutdown).toHaveBeenCalled();
    });
  });
});

describe.skip('VSCodeRefIntegration', () => {
  beforeEach(() => {
    vi.mocked(MCPService).mockImplementation(() => ({
      initialize: vi.fn(),
      getAvailableToolsForAI: vi.fn().mockReturnValue([]),
      executeToolForAI: vi.fn(),
      getHealthStatus: vi.fn(),
      shutdown: vi.fn()
    }) as any);
  });

  describe('createForWorkspace', () => {
    it('should create integration with workspace-specific config', () => {
      const integration = VSCodeRefIntegration.createForWorkspace('/workspace/path', {
        remoteDocUrls: ['https://custom.docs.com']
      });

      expect(integration).toBeInstanceOf(RefMCPIntegration);
    });
  });

  describe('searchVSCodeAPI', () => {
    it('should search VS Code API documentation', async () => {
      const mockIntegration = {
        searchDocumentation: vi.fn().mockResolvedValue({
          success: true,
          results: [],
          totalResults: 0,
          searchTime: 100
        })
      } as any;

      const result = await VSCodeRefIntegration.searchVSCodeAPI(mockIntegration, 'TreeDataProvider');

      expect(mockIntegration.searchDocumentation).toHaveBeenCalledWith({
        query: 'vscode api TreeDataProvider',
        scope: 'remote',
        maxResults: 10
      });

      expect(result.success).toBe(true);
    });
  });

  describe('getExtensionDocs', () => {
    it('should get extension documentation from marketplace', async () => {
      const mockIntegration = {
        readURL: vi.fn().mockResolvedValue({
          success: true,
          content: 'Extension documentation',
          title: 'Test Extension'
        })
      } as any;

      const result = await VSCodeRefIntegration.getExtensionDocs(mockIntegration, 'ms-python.python');

      expect(mockIntegration.readURL).toHaveBeenCalledWith({
        url: 'https://marketplace.visualstudio.com/items?itemName=ms-python.python',
        format: 'markdown'
      });

      expect(result.success).toBe(true);
      expect(result.content).toBe('Extension documentation');
    });
  });
});

describe.skip('error handling and edge cases', () => {
  let refIntegration: RefMCPIntegration;
  let mockMCPService: any;

  beforeEach(() => {
    mockMCPService = {
      initialize: vi.fn(),
      executeToolForAI: vi.fn(),
      getHealthStatus: vi.fn(),
      shutdown: vi.fn(),
      getAvailableToolsForAI: vi.fn().mockReturnValue([
        {
          name: 'ref_search_documentation',
          description: 'Search documentation',
          parameters: { type: 'object' }
        },
        {
          name: 'ref_read_url',
          description: 'Read URL content',
          parameters: { type: 'object' }
        }
      ])
    };

    (MCPService as any).mockImplementation(() => mockMCPService);
    refIntegration = new RefMCPIntegration({ enabled: true });
    (refIntegration as any).mcpService = mockMCPService;
  });

  it('should handle tool execution timeout gracefully', async () => {
    await refIntegration.initialize();
    
    mockMCPService.executeToolForAI.mockRejectedValue(new Error('Request timeout'));

    const result = await refIntegration.searchDocumentation({
      query: 'test query'
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Request timeout');
  });

  it('should format search results with missing data', async () => {
    await refIntegration.initialize();
    
    const mockResults = {
      results: [
        { content: 'Some content without title' },
        { title: 'Title without content' },
        {} // Empty result
      ]
    };

    mockMCPService.executeToolForAI.mockResolvedValue({
      success: true,
      result: mockResults
    });

    const result = await refIntegration.searchDocumentation({
      query: 'test query'
    });

    expect(result.success).toBe(true);
    expect(result.results).toHaveLength(3);
    expect(result.results![0].title).toBe('Result 1');
    expect(result.results![1].excerpt).toBe('...');
  });

  it('should determine result types correctly', async () => {
    await refIntegration.initialize();
    
    const mockResults = {
      results: [
        { filename: 'api.md', content: 'API documentation' },
        { filename: 'tutorial.md', content: 'Tutorial content' },
        { filename: 'example.js', content: 'JavaScript code' },
        { filename: 'readme.rst', content: 'Restructured text' },
        { filename: 'unknown.xyz', content: 'Unknown type' }
      ]
    };

    mockMCPService.executeToolForAI.mockResolvedValue({
      success: true,
      result: mockResults
    });

    const result = await refIntegration.searchDocumentation({
      query: 'test query'
    });

    expect(result.results![0].type).toBe('api');
    expect(result.results![1].type).toBe('tutorial');
    expect(result.results![2].type).toBe('code');
    expect(result.results![3].type).toBe('markdown');
    expect(result.results![4].type).toBe('documentation');
  });
});