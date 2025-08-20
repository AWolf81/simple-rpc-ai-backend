/**
 * MCP Router - tRPC implementation for Model Context Protocol
 * 
 * Provides type-safe MCP server management and tool execution endpoints.
 * Integrates with the existing AI service for enhanced functionality.
 */

import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { createTRPCRouter, publicProcedure, protectedProcedure } from '../index.js';
import { MCPService, MCPServiceConfig } from '../../services/mcp-service.js';
import { RefMCPIntegration, RefMCPConfig } from '../../services/ref-mcp-integration.js';
import { MCPServerConfig } from '../../services/mcp-registry.js';

// Input validation schemas
const mcpServerConfigSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  type: z.enum(['stdio', 'http']),
  command: z.string().optional(),
  args: z.array(z.string()).optional(),
  env: z.record(z.string()).optional(),
  url: z.string().url().optional(),
  headers: z.record(z.string()).optional(),
  timeout: z.number().positive().optional(),
  retryAttempts: z.number().min(0).optional(),
  autoRestart: z.boolean().optional(),
  enabled: z.boolean().optional()
});

const toolExecutionSchema = z.object({
  name: z.string().min(1),
  arguments: z.record(z.any()).optional(),
  serverId: z.string().optional(),
  context: z.object({
    userId: z.string().optional(),
    requestId: z.string().optional(),
    systemPrompt: z.string().optional()
  }).optional()
});

const documentationSearchSchema = z.object({
  query: z.string().min(1),
  scope: z.enum(['local', 'remote', 'github', 'all']).optional(),
  fileTypes: z.array(z.string()).optional(),
  maxResults: z.number().min(1).max(100).optional()
});

const urlReadSchema = z.object({
  url: z.string().url(),
  format: z.enum(['markdown', 'text', 'html']).optional(),
  includeImages: z.boolean().optional(),
  followRedirects: z.boolean().optional()
});

const refMCPConfigSchema = z.object({
  enabled: z.boolean().optional(),
  documentationPaths: z.array(z.string()).optional(),
  remoteDocUrls: z.array(z.string().url()).optional(),
  githubRepos: z.array(z.object({
    owner: z.string(),
    repo: z.string(),
    branch: z.string().optional(),
    paths: z.array(z.string()).optional()
  })).optional(),
  indexingOptions: z.object({
    includeMarkdown: z.boolean().optional(),
    includeCode: z.boolean().optional(),
    includeImages: z.boolean().optional(),
    maxFileSize: z.number().optional()
  }).optional(),
  searchOptions: z.object({
    fuzzySearch: z.boolean().optional(),
    contextLines: z.number().optional(),
    maxResults: z.number().optional()
  }).optional()
});

export interface MCPRouterConfig {
  enableMCP?: boolean;
  mcpService?: MCPService;
  refIntegration?: RefMCPIntegration;
  defaultConfig?: MCPServiceConfig;
}

/**
 * Create configurable MCP router
 */
export function createMCPRouter(config: MCPRouterConfig = {}): ReturnType<typeof createTRPCRouter> {
  const {
    enableMCP = true,
    mcpService = enableMCP ? new MCPService(config.defaultConfig) : null,
    refIntegration = enableMCP ? new RefMCPIntegration() : null
  } = config;

  return createTRPCRouter({
    /**
     * Get MCP service health status
     */
    health: publicProcedure
      .query(async () => {
        if (!enableMCP || !mcpService) {
          return {
            enabled: false,
            status: 'disabled',
            message: 'MCP functionality is disabled'
          };
        }

        try {
          const healthStatus = mcpService.getHealthStatus();
          return {
            enabled: true,
            status: healthStatus.initialized ? 'healthy' : 'initializing',
            ...healthStatus,
            timestamp: new Date().toISOString()
          };
        } catch (error) {
          return {
            enabled: true,
            status: 'error',
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString()
          };
        }
      }),

    /**
     * Initialize MCP service
     */
    initialize: publicProcedure
      .input(z.object({
        mcpConfig: z.object({
          enabledServers: z.array(z.string()).optional(),
          customServers: z.array(mcpServerConfigSchema).optional(),
          autoRegisterPredefined: z.boolean().optional(),
          enableRefTools: z.boolean().optional(),
          enableFilesystemTools: z.boolean().optional()
        }).optional(),
        refConfig: refMCPConfigSchema.optional()
      }))
      .mutation(async ({ input }) => {
        if (!enableMCP) {
          throw new TRPCError({
            code: 'NOT_IMPLEMENTED',
            message: 'MCP functionality is disabled'
          });
        }

        try {
          // Initialize MCP service if provided config
          if (input.mcpConfig && mcpService) {
            // Update service configuration (would need to be implemented)
            await mcpService.initialize();
          }

          // Initialize Ref integration if provided config
          if (input.refConfig && refIntegration) {
            await refIntegration.updateConfig(input.refConfig);
            if (!refIntegration.getStatus().initialized) {
              await refIntegration.initialize();
            }
          }

          return {
            success: true,
            message: 'MCP services initialized successfully',
            mcpStatus: mcpService?.getHealthStatus(),
            refStatus: refIntegration?.getStatus()
          };
        } catch (error) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `MCP initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`
          });
        }
      }),

    /**
     * List available MCP servers
     */
    listServers: publicProcedure
      .query(async () => {
        if (!enableMCP || !mcpService) {
          return { servers: [] };
        }

        try {
          const configs = mcpService.getServerConfigs();
          const statuses = mcpService.getServerStatus() as any[];
          
          const servers = configs.map(config => {
            const status = statuses.find(s => s.id === config.id);
            return {
              ...config,
              status: status?.status || 'unknown',
              lastSeen: status?.lastSeen,
              error: status?.error,
              toolsCount: status?.tools?.length || 0
            };
          });

          return { servers };
        } catch (error) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Failed to list servers: ${error instanceof Error ? error.message : 'Unknown error'}`
          });
        }
      }),

    /**
     * Add a new MCP server
     */
    addServer: protectedProcedure
      .input(mcpServerConfigSchema)
      .mutation(async ({ input }) => {
        if (!enableMCP || !mcpService) {
          throw new TRPCError({
            code: 'NOT_IMPLEMENTED',
            message: 'MCP functionality is disabled'
          });
        }

        try {
          await mcpService.addServer(input as MCPServerConfig);
          
          return {
            success: true,
            message: `Server '${input.name}' added successfully`,
            serverId: input.id
          };
        } catch (error) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Failed to add server: ${error instanceof Error ? error.message : 'Unknown error'}`
          });
        }
      }),

    /**
     * Remove an MCP server
     */
    removeServer: protectedProcedure
      .input(z.object({
        serverId: z.string().min(1)
      }))
      .mutation(async ({ input }) => {
        if (!enableMCP || !mcpService) {
          throw new TRPCError({
            code: 'NOT_IMPLEMENTED',
            message: 'MCP functionality is disabled'
          });
        }

        try {
          await mcpService.removeServer(input.serverId);
          
          return {
            success: true,
            message: `Server '${input.serverId}' removed successfully`
          };
        } catch (error) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Failed to remove server: ${error instanceof Error ? error.message : 'Unknown error'}`
          });
        }
      }),

    /**
     * List available MCP tools
     */
    listTools: publicProcedure
      .input(z.object({
        serverId: z.string().optional(),
        search: z.string().optional()
      }))
      .query(async ({ input }) => {
        if (!enableMCP || !mcpService) {
          return { tools: [] };
        }

        try {
          let tools = mcpService.getAvailableToolsForAI();
          
          // Filter by server if specified
          if (input.serverId) {
            tools = tools.filter(tool => tool.serverId === input.serverId);
          }
          
          // Search in tool names and descriptions
          if (input.search) {
            const searchLower = input.search.toLowerCase();
            tools = tools.filter(tool => 
              tool.name.toLowerCase().includes(searchLower) ||
              tool.description.toLowerCase().includes(searchLower)
            );
          }

          return { tools };
        } catch (error) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Failed to list tools: ${error instanceof Error ? error.message : 'Unknown error'}`
          });
        }
      }),

    /**
     * Execute a tool
     */
    executeTool: protectedProcedure
      .input(toolExecutionSchema)
      .mutation(async ({ input, ctx }) => {
        if (!enableMCP || !mcpService) {
          throw new TRPCError({
            code: 'NOT_IMPLEMENTED',
            message: 'MCP functionality is disabled'
          });
        }

        try {
          const toolRequest = {
            name: input.name,
            arguments: input.arguments,
            context: {
              userId: ctx.user?.userId,
              requestId: `tool-${Date.now()}`,
              ...input.context
            }
          };

          const result = await mcpService.executeToolForAI(toolRequest);
          
          return {
            success: result.success,
            result: result.result,
            error: result.error,
            toolName: result.toolName,
            duration: result.duration,
            serverId: result.serverId,
            metadata: result.metadata
          };
        } catch (error) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Tool execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`
          });
        }
      }),

    /**
     * Search documentation using Ref MCP
     */
    searchDocumentation: publicProcedure
      .input(documentationSearchSchema)
      .mutation(async ({ input }) => {
        if (!enableMCP || !refIntegration) {
          throw new TRPCError({
            code: 'NOT_IMPLEMENTED',
            message: 'Ref MCP integration is not available'
          });
        }

        try {
          const result = await refIntegration.searchDocumentation(input);
          return result;
        } catch (error) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Documentation search failed: ${error instanceof Error ? error.message : 'Unknown error'}`
          });
        }
      }),

    /**
     * Read URL content using Ref MCP
     */
    readURL: publicProcedure
      .input(urlReadSchema)
      .mutation(async ({ input }) => {
        if (!enableMCP || !refIntegration) {
          throw new TRPCError({
            code: 'NOT_IMPLEMENTED',
            message: 'Ref MCP integration is not available'
          });
        }

        try {
          const result = await refIntegration.readURL(input);
          return result;
        } catch (error) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `URL reading failed: ${error instanceof Error ? error.message : 'Unknown error'}`
          });
        }
      }),

    /**
     * Search for code examples
     */
    searchCodeExamples: publicProcedure
      .input(z.object({
        language: z.string().min(1),
        topic: z.string().min(1)
      }))
      .mutation(async ({ input }) => {
        if (!enableMCP || !refIntegration) {
          throw new TRPCError({
            code: 'NOT_IMPLEMENTED',
            message: 'Ref MCP integration is not available'
          });
        }

        try {
          const result = await refIntegration.searchCodeExamples(input.language, input.topic);
          return result;
        } catch (error) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Code example search failed: ${error instanceof Error ? error.message : 'Unknown error'}`
          });
        }
      }),

    /**
     * Search API documentation
     */
    searchAPIDocumentation: publicProcedure
      .input(z.object({
        apiName: z.string().min(1),
        method: z.string().optional()
      }))
      .mutation(async ({ input }) => {
        if (!enableMCP || !refIntegration) {
          throw new TRPCError({
            code: 'NOT_IMPLEMENTED',
            message: 'Ref MCP integration is not available'
          });
        }

        try {
          const result = await refIntegration.searchAPIDocumentation(input.apiName, input.method);
          return result;
        } catch (error) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `API documentation search failed: ${error instanceof Error ? error.message : 'Unknown error'}`
          });
        }
      }),

    /**
     * Get GitHub repository documentation
     */
    getGitHubDocumentation: publicProcedure
      .input(z.object({
        owner: z.string().min(1),
        repo: z.string().min(1),
        path: z.string().optional()
      }))
      .mutation(async ({ input }) => {
        if (!enableMCP || !refIntegration) {
          throw new TRPCError({
            code: 'NOT_IMPLEMENTED',
            message: 'Ref MCP integration is not available'
          });
        }

        try {
          const result = await refIntegration.getGitHubDocumentation(input.owner, input.repo, input.path);
          return result;
        } catch (error) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `GitHub documentation retrieval failed: ${error instanceof Error ? error.message : 'Unknown error'}`
          });
        }
      }),

    /**
     * Search local project documentation
     */
    searchLocalDocs: publicProcedure
      .input(z.object({
        query: z.string().min(1),
        projectPath: z.string().optional()
      }))
      .mutation(async ({ input }) => {
        if (!enableMCP || !refIntegration) {
          throw new TRPCError({
            code: 'NOT_IMPLEMENTED',
            message: 'Ref MCP integration is not available'
          });
        }

        try {
          const result = await refIntegration.searchLocalDocs(input.query, input.projectPath);
          return result;
        } catch (error) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Local documentation search failed: ${error instanceof Error ? error.message : 'Unknown error'}`
          });
        }
      }),

    /**
     * Get Ref MCP integration status
     */
    getRefStatus: publicProcedure
      .query(async () => {
        if (!enableMCP || !refIntegration) {
          return {
            available: false,
            message: 'Ref MCP integration is not available'
          };
        }

        try {
          const status = refIntegration.getStatus();
          return {
            available: true,
            ...status
          };
        } catch (error) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Failed to get Ref status: ${error instanceof Error ? error.message : 'Unknown error'}`
          });
        }
      }),

    /**
     * Test tool execution
     */
    testTool: protectedProcedure
      .input(z.object({
        toolName: z.string().min(1),
        args: z.record(z.any()).optional()
      }))
      .mutation(async ({ input }) => {
        if (!enableMCP || !mcpService) {
          throw new TRPCError({
            code: 'NOT_IMPLEMENTED',
            message: 'MCP functionality is disabled'
          });
        }

        try {
          const result = await mcpService.executeToolForAI({
            name: input.toolName,
            arguments: input.args || {}
          });

          return {
            success: result.success,
            result: result.result,
            error: result.error,
            duration: result.duration,
            serverId: result.serverId
          };
        } catch (error) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Tool test failed: ${error instanceof Error ? error.message : 'Unknown error'}`
          });
        }
      })
  });
}

// Default MCP router instance
export const mcpRouter: ReturnType<typeof createMCPRouter> = createMCPRouter();

/**
 * Static type definition for the MCP router
 */
export type MCPRouterType = ReturnType<typeof createMCPRouter>;