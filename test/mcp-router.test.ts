import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMCPRouter } from '../src/trpc/routers/mcp.js';
import { MCPService } from '../src/services/mcp-service.js';
import { RefMCPIntegration } from '../src/services/ref-mcp-integration.js';
import { TRPCError } from '@trpc/server';

// Mock dependencies
vi.mock('../src/services/mcp-service.js');
vi.mock('../src/services/ref-mcp-integration.js');

describe('MCP Router', () => {
  let mcpRouter: any;
  let mockMCPService: any;
  let mockRefIntegration: any;
  let mockContext: any;

  beforeEach(() => {
    mockMCPService = {
      initialize: vi.fn().mockResolvedValue(undefined),
      getHealthStatus: vi.fn().mockReturnValue({
        initialized: true,
        serversCount: 1,
        connectedServers: 1,
        availableTools: 2
      }),
      getServerConfigs: vi.fn().mockReturnValue([
        {
          id: 'ref-tools',
          name: 'Ref Tools',
          type: 'stdio',
          enabled: true
        }
      ]),
      getServerStatus: vi.fn().mockReturnValue([
        {
          id: 'ref-tools',
          status: 'connected',
          lastSeen: new Date(),
          error: undefined,
          tools: [{ name: 'ref_search' }, { name: 'ref_read' }]
        }
      ]),
      getAvailableToolsForAI: vi.fn().mockReturnValue([
        {
          name: 'ref_search_documentation',
          description: 'Search documentation',
          parameters: { type: 'object' },
          serverId: 'ref-tools'
        }
      ]),
      executeToolForAI: vi.fn().mockResolvedValue({
        success: true,
        result: { message: 'Tool executed' },
        toolName: 'ref_search_documentation',
        duration: 100,
        serverId: 'ref-tools'
      }),
      addServer: vi.fn().mockResolvedValue(undefined),
      removeServer: vi.fn().mockResolvedValue(undefined)
    };

    mockRefIntegration = {
      initialize: vi.fn().mockResolvedValue(undefined),
      updateConfig: vi.fn().mockResolvedValue(undefined),
      getStatus: vi.fn().mockReturnValue({
        initialized: true,
        enabled: true,
        mcpStatus: { initialized: true },
        config: { documentationPaths: 1 }
      }),
      searchDocumentation: vi.fn().mockResolvedValue({
        success: true,
        results: [
          {
            title: 'Test Doc',
            excerpt: 'Test excerpt',
            type: 'documentation',
            source: 'local'
          }
        ],
        totalResults: 1,
        searchTime: 150
      }),
      readURL: vi.fn().mockResolvedValue({
        success: true,
        content: '# Test Document',
        title: 'Test Document',
        metadata: {
          url: 'https://example.com/test',
          wordCount: 2
        }
      }),
      searchCodeExamples: vi.fn().mockResolvedValue({
        success: true,
        results: [],
        totalResults: 0,
        searchTime: 100
      }),
      searchAPIDocumentation: vi.fn().mockResolvedValue({
        success: true,
        results: [],
        totalResults: 0,
        searchTime: 100
      }),
      getGitHubDocumentation: vi.fn().mockResolvedValue({
        success: true,
        content: '# README',
        title: 'README'
      }),
      searchLocalDocs: vi.fn().mockResolvedValue({
        success: true,
        results: [],
        totalResults: 0,
        searchTime: 100
      })
    };

    (MCPService as any).mockImplementation(() => mockMCPService);
    (RefMCPIntegration as any).mockImplementation(() => mockRefIntegration);

    mockContext = {
      user: {
        userId: 'test-user-123',
        email: 'test@example.com'
      },
      req: {
        headers: {}
      }
    };

    mcpRouter = createMCPRouter({
      enableMCP: true,
      mcpService: mockMCPService,
      refIntegration: mockRefIntegration
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('health endpoint', () => {
    it('should return healthy status when MCP is enabled and initialized', async () => {
      const result = await mcpRouter.createCaller({}).health();

      expect(result).toEqual({
        enabled: true,
        status: 'healthy',
        initialized: true,
        serversCount: 1,
        connectedServers: 1,
        availableTools: 2,
        timestamp: expect.any(String)
      });
    });

    it('should return disabled status when MCP is disabled', async () => {
      const disabledRouter = createMCPRouter({ enableMCP: false });
      const result = await disabledRouter.createCaller({}).health();

      expect(result).toEqual({
        enabled: false,
        status: 'disabled',
        message: 'MCP functionality is disabled'
      });
    });

    it('should handle health check errors', async () => {
      mockMCPService.getHealthStatus.mockImplementation(() => {
        throw new Error('Health check failed');
      });

      const result = await mcpRouter.createCaller({}).health();

      expect(result).toEqual({
        enabled: true,
        status: 'error',
        error: 'Health check failed',
        timestamp: expect.any(String)
      });
    });
  });

  describe('initialization endpoint', () => {
    it('should initialize MCP and Ref services', async () => {
      const result = await mcpRouter.createCaller({}).initialize({
        mcpConfig: {
          enableRefTools: true,
          autoRegisterPredefined: true
        },
        refConfig: {
          enabled: true,
          documentationPaths: ['/docs']
        }
      });

      expect(mockMCPService.initialize).toHaveBeenCalled();
      expect(mockRefIntegration.updateConfig).toHaveBeenCalledWith({
        enabled: true,
        documentationPaths: ['/docs']
      });
      expect(mockRefIntegration.initialize).toHaveBeenCalled();

      expect(result).toEqual({
        success: true,
        message: 'MCP services initialized successfully',
        mcpStatus: expect.any(Object),
        refStatus: expect.any(Object)
      });
    });

    it('should throw error when MCP is disabled', async () => {
      const disabledRouter = createMCPRouter({ enableMCP: false });

      await expect(disabledRouter.createCaller({}).initialize({}))
        .rejects.toThrow('MCP functionality is disabled');
    });

    it('should handle initialization errors', async () => {
      mockMCPService.initialize.mockRejectedValue(new Error('Init failed'));

      await expect(mcpRouter.createCaller({}).initialize({}))
        .rejects.toThrow('MCP initialization failed: Init failed');
    });
  });

  describe('server management endpoints', () => {
    describe('listServers', () => {
      it('should list all MCP servers', async () => {
        const result = await mcpRouter.createCaller({}).listServers();

        expect(result.servers).toHaveLength(1);
        expect(result.servers[0]).toEqual({
          id: 'ref-tools',
          name: 'Ref Tools',
          type: 'stdio',
          enabled: true,
          status: 'connected',
          lastSeen: expect.any(Date),
          error: undefined,
          toolsCount: 2
        });
      });

      it('should return empty list when MCP is disabled', async () => {
        const disabledRouter = createMCPRouter({ enableMCP: false });
        const result = await disabledRouter.createCaller({}).listServers();

        expect(result.servers).toEqual([]);
      });
    });

    describe('addServer', () => {
      it('should add a new MCP server', async () => {
        const serverConfig = {
          id: 'test-server',
          name: 'Test Server',
          type: 'http' as const,
          url: 'http://localhost:3000',
          enabled: true
        };

        const result = await mcpRouter.createCaller(mockContext).addServer(serverConfig);

        expect(mockMCPService.addServer).toHaveBeenCalledWith(serverConfig);
        expect(result).toEqual({
          success: true,
          message: "Server 'Test Server' added successfully",
          serverId: 'test-server'
        });
      });

      it('should require authentication', async () => {
        const serverConfig = {
          id: 'test-server',
          name: 'Test Server',
          type: 'http' as const,
          url: 'http://localhost:3000'
        };

        // Test without authentication context
        await expect(mcpRouter.createCaller({}).addServer(serverConfig))
          .rejects.toThrow(); // Should throw authentication error
      });
    });

    describe('removeServer', () => {
      it('should remove an MCP server', async () => {
        const result = await mcpRouter.createCaller(mockContext).removeServer({
          serverId: 'test-server'
        });

        expect(mockMCPService.removeServer).toHaveBeenCalledWith('test-server');
        expect(result).toEqual({
          success: true,
          message: "Server 'test-server' removed successfully"
        });
      });
    });
  });

  describe('tool management endpoints', () => {
    describe('listTools', () => {
      it('should list all available tools', async () => {
        const result = await mcpRouter.createCaller({}).listTools({});

        expect(result.tools).toHaveLength(1);
        expect(result.tools[0]).toEqual({
          name: 'ref_search_documentation',
          description: 'Search documentation',
          parameters: { type: 'object' },
          serverId: 'ref-tools'
        });
      });

      it('should filter tools by server ID', async () => {
        const result = await mcpRouter.createCaller({}).listTools({
          serverId: 'ref-tools'
        });

        expect(mockMCPService.getAvailableToolsForAI).toHaveBeenCalled();
        expect(result.tools).toHaveLength(1);
      });

      it('should search tools by name/description', async () => {
        const result = await mcpRouter.createCaller({}).listTools({
          search: 'documentation'
        });

        expect(result.tools).toHaveLength(1);
      });
    });

    describe('executeTool', () => {
      it('should execute a tool successfully', async () => {
        const result = await mcpRouter.createCaller(mockContext).executeTool({
          name: 'ref_search_documentation',
          arguments: { query: 'test' }
        });

        expect(mockMCPService.executeToolForAI).toHaveBeenCalledWith({
          name: 'ref_search_documentation',
          arguments: { query: 'test' },
          context: {
            userId: 'test-user-123',
            requestId: expect.stringMatching(/^tool-\d+$/),
          }
        });

        expect(result).toEqual({
          success: true,
          result: { message: 'Tool executed' },
          error: undefined,
          toolName: 'ref_search_documentation',
          duration: 100,
          serverId: 'ref-tools',
          metadata: undefined
        });
      });

      it('should handle tool execution errors', async () => {
        mockMCPService.executeToolForAI.mockRejectedValue(new Error('Tool failed'));

        await expect(mcpRouter.createCaller(mockContext).executeTool({
          name: 'failing-tool',
          arguments: {}
        })).rejects.toThrow('Tool execution failed: Tool failed');
      });
    });

    describe('testTool', () => {
      it('should test tool execution', async () => {
        const result = await mcpRouter.createCaller(mockContext).testTool({
          toolName: 'ref_search_documentation',
          args: { query: 'test' }
        });

        expect(result).toEqual({
          success: true,
          result: { message: 'Tool executed' },
          error: undefined,
          duration: 100,
          serverId: 'ref-tools'
        });
      });
    });
  });

  describe('Ref MCP integration endpoints', () => {
    describe('searchDocumentation', () => {
      it('should search documentation', async () => {
        const result = await mcpRouter.createCaller({}).searchDocumentation({
          query: 'test query',
          scope: 'local',
          maxResults: 10
        });

        expect(mockRefIntegration.searchDocumentation).toHaveBeenCalledWith({
          query: 'test query',
          scope: 'local',
          maxResults: 10
        });

        expect(result).toEqual({
          success: true,
          results: [
            {
              title: 'Test Doc',
              excerpt: 'Test excerpt',
              type: 'documentation',
              source: 'local'
            }
          ],
          totalResults: 1,
          searchTime: 150
        });
      });

      it('should throw error when Ref integration is unavailable', async () => {
        const routerWithoutRef = createMCPRouter({
          enableMCP: true,
          refIntegration: null
        });

        await expect(routerWithoutRef.createCaller({}).searchDocumentation({
          query: 'test'
        })).rejects.toThrow('Ref MCP integration is not available');
      });
    });

    describe('readURL', () => {
      it('should read URL content', async () => {
        const result = await mcpRouter.createCaller({}).readURL({
          url: 'https://example.com/test',
          format: 'markdown'
        });

        expect(mockRefIntegration.readURL).toHaveBeenCalledWith({
          url: 'https://example.com/test',
          format: 'markdown'
        });

        expect(result).toEqual({
          success: true,
          content: '# Test Document',
          title: 'Test Document',
          metadata: {
            url: 'https://example.com/test',
            wordCount: 2
          }
        });
      });
    });

    describe('searchCodeExamples', () => {
      it('should search code examples', async () => {
        const result = await mcpRouter.createCaller({}).searchCodeExamples({
          language: 'typescript',
          topic: 'async functions'
        });

        expect(mockRefIntegration.searchCodeExamples).toHaveBeenCalledWith(
          'typescript',
          'async functions'
        );

        expect(result.success).toBe(true);
      });
    });

    describe('searchAPIDocumentation', () => {
      it('should search API documentation', async () => {
        const result = await mcpRouter.createCaller({}).searchAPIDocumentation({
          apiName: 'fetch',
          method: 'POST'
        });

        expect(mockRefIntegration.searchAPIDocumentation).toHaveBeenCalledWith(
          'fetch',
          'POST'
        );

        expect(result.success).toBe(true);
      });
    });

    describe('getGitHubDocumentation', () => {
      it('should get GitHub repository documentation', async () => {
        const result = await mcpRouter.createCaller({}).getGitHubDocumentation({
          owner: 'microsoft',
          repo: 'vscode',
          path: 'README.md'
        });

        expect(mockRefIntegration.getGitHubDocumentation).toHaveBeenCalledWith(
          'microsoft',
          'vscode',
          'README.md'
        );

        expect(result).toEqual({
          success: true,
          content: '# README',
          title: 'README'
        });
      });
    });

    describe('searchLocalDocs', () => {
      it('should search local documentation', async () => {
        const result = await mcpRouter.createCaller({}).searchLocalDocs({
          query: 'test query',
          projectPath: '/project/path'
        });

        expect(mockRefIntegration.searchLocalDocs).toHaveBeenCalledWith(
          'test query',
          '/project/path'
        );

        expect(result.success).toBe(true);
      });
    });

    describe('getRefStatus', () => {
      it('should get Ref integration status', async () => {
        const result = await mcpRouter.createCaller({}).getRefStatus();

        expect(result).toEqual({
          available: true,
          initialized: true,
          enabled: true,
          mcpStatus: { initialized: true },
          config: { documentationPaths: 1 }
        });
      });

      it('should return unavailable when Ref integration is not enabled', async () => {
        const routerWithoutRef = createMCPRouter({
          enableMCP: true,
          refIntegration: null
        });

        const result = await routerWithoutRef.createCaller({}).getRefStatus();

        expect(result).toEqual({
          available: false,
          message: 'Ref MCP integration is not available'
        });
      });
    });
  });

  describe('input validation', () => {
    it('should validate server configuration input', async () => {
      const invalidServerConfig = {
        id: '', // Invalid: empty string
        name: 'Test Server',
        type: 'invalid' as any, // Invalid type
      };

      await expect(mcpRouter.createCaller(mockContext).addServer(invalidServerConfig))
        .rejects.toThrow(); // Should throw validation error
    });

    it('should validate tool execution input', async () => {
      const invalidToolRequest = {
        name: '', // Invalid: empty string
        arguments: {}
      };

      await expect(mcpRouter.createCaller(mockContext).executeTool(invalidToolRequest))
        .rejects.toThrow(); // Should throw validation error
    });

    it('should validate URL input', async () => {
      const invalidUrlRequest = {
        url: 'not-a-valid-url', // Invalid URL format
      };

      await expect(mcpRouter.createCaller({}).readURL(invalidUrlRequest))
        .rejects.toThrow(); // Should throw validation error
    });
  });

  describe('error handling', () => {
    it('should handle service unavailable errors gracefully', async () => {
      mockRefIntegration.searchDocumentation.mockRejectedValue(new Error('Service unavailable'));

      await expect(mcpRouter.createCaller({}).searchDocumentation({
        query: 'test'
      })).rejects.toThrow('Documentation search failed: Service unavailable');
    });

    it('should handle tool execution timeouts', async () => {
      mockMCPService.executeToolForAI.mockRejectedValue(new Error('Request timeout'));

      await expect(mcpRouter.createCaller(mockContext).executeTool({
        name: 'slow-tool',
        arguments: {}
      })).rejects.toThrow('Tool execution failed: Request timeout');
    });
  });
});