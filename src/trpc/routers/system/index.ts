/**
 * System Router - Basic system utilities and root folder management
 */

import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, publicProcedure } from '@src-trpc/index';
import { createMCPTool } from '../../../auth/scopes';
import { WorkspaceManager } from '../../../services/resources/workspace-manager';

export function createSystemRouter(workspaceManager?: WorkspaceManager): ReturnType<typeof router> {
  const workspaceAPIEnabled = Boolean(workspaceManager);

  const disabledWorkspaceManager: WorkspaceManager = {
    getClientWorkspaceFolders: () => ({}),
    listFiles: async () => [],
    readFile: async () => Buffer.from(''),
    writeFile: async () => undefined,
    pathExists: async () => false,
    getWorkspaceConfig: () => undefined,
    getWorkspaceIds: () => [],
    addWorkspace: () => {
      throw new Error('Server workspace API is disabled');
    },
    removeWorkspace: () => false,
  } as unknown as WorkspaceManager;

  const manager = workspaceManager ?? disabledWorkspaceManager;

  const ensureWorkspaceAPIEnabled = () => {
    if (!workspaceAPIEnabled) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Server workspace API is disabled. Configure serverWorkspaces to enable file access.',
      });
    }
  };

  // Get dynamic workspace folder IDs for enum constraints
  const getWorkspaceIds = () => {
    const workspaceFolders = manager.getClientWorkspaceFolders();
    const workspaceIds = Object.keys(workspaceFolders);
    return workspaceIds.length > 0 ? workspaceIds : ['default']; // Fallback to 'default' if no workspaces configured
  };

  // Create dynamic enum schema for workspace folders
  const createWorkspaceIdSchema = () => {
    const workspaceIds = getWorkspaceIds();
    return z.enum(workspaceIds as [string, ...string[]]).describe('Server workspace ID');
  };

  return router({
    /**
     * Simple test procedure with minimal Zod schema
     */
    test: publicProcedure
      .input(z.object({ message: z.string().optional().default('Hello from test tool!') }))
      .output(z.object({ message: z.string() }))
      .meta({
        mcp: { enabled: true, description: "Just a echo test endpoint" }
      })
      .mutation(async ({ input }) => {
        return { message: `Hello ${input.message}` };
      }),

    /**
     * Health check procedure
     */
    health: publicProcedure
      .input(z.void())
      .query(async () => {
        return {
          status: 'healthy' as const,
          timestamp: new Date().toISOString(),
          uptime: process.uptime(),
          version: '0.1.0',
        };
      }),

    /**
     * Get configured server workspaces for client applications
     */
    getServerWorkspaces: publicProcedure
      .meta({
        ...createMCPTool({
          name: 'getServerWorkspaces',
          description: 'Get all configured server workspaces with accessibility status',
          category: 'filesystem'
        })
      })
      .input(z.void())
      .output(z.record(z.string(), z.object({
        id: z.string(),
        name: z.string(),
        description: z.string().optional(),
        accessible: z.boolean(),
        lastAccessed: z.date().optional(),
        stats: z.object({
          totalFiles: z.number(),
          totalSize: z.number(),
          lastModified: z.date()
        }).optional(),
        clientHints: z.object({
          preferredExtensions: z.array(z.string()).optional(),
          searchPatterns: z.array(z.string()).optional(),
          supportsWatching: z.boolean().optional()
        }).optional()
      })))
      .query(async () => {
        if (!workspaceAPIEnabled) {
          return {};
        }
        return manager.getClientWorkspaceFolders();
      }),

    /**
     * List files in a root folder
     */
    listFiles: publicProcedure
      .meta({
        ...createMCPTool({
          name: 'listFiles',
          description: 'List files and directories in a configured root folder',
          category: 'filesystem'
        })
      })
      .input(z.object({
        workspaceId: createWorkspaceIdSchema(),
        path: z.string().default('').describe('Relative path within workspace folder'),
        recursive: z.boolean().default(false).describe('Include subdirectories recursively'),
        includeDirectories: z.boolean().default(true).describe('Include directories in results')
      }))
      .output(z.array(z.object({
        path: z.string(),
        relativePath: z.string(),
        name: z.string(),
        extension: z.string(),
        size: z.number(),
        lastModified: z.date(),
        isDirectory: z.boolean(),
        mimeType: z.string().optional(),
        readable: z.boolean(),
        writable: z.boolean()
      })))
      .query(async ({ input }) => {
        ensureWorkspaceAPIEnabled();
        return await manager.listFiles(input.workspaceId, input.path, {
          recursive: input.recursive,
          includeDirectories: input.includeDirectories
        });
      }),

    /**
     * Read file content from a root folder
     */
    readFile: publicProcedure
      .meta({
        ...createMCPTool({
          name: 'readFile',
          description: 'Read the content of a file from a configured root folder',
          category: 'filesystem'
        })
      })
      .input(z.object({
        workspaceId: createWorkspaceIdSchema(),
        path: z.string().describe('Relative file path within workspace folder'),
        encoding: z.enum(['utf8', 'base64', 'binary']).default('utf8').describe('File encoding')
      }))
      .output(z.object({
        content: z.string(),
        size: z.number(),
        encoding: z.string(),
        mimeType: z.string().optional()
      }))
      .query(async ({ input }) => {
        ensureWorkspaceAPIEnabled();
        const content = await manager.readFile(input.workspaceId, input.path, {
          encoding: input.encoding as any
        });

        // Get file info for additional metadata by listing the parent directory
        let fileInfo;
        try {
          const pathParts = input.path.split('/').filter(p => p);
          const fileName = pathParts.pop() || input.path;
          const parentPath = pathParts.length > 0 ? pathParts.join('/') : '';

          const files = await manager.listFiles(input.workspaceId, parentPath);
          fileInfo = files.find(f => f.name === fileName || f.relativePath === input.path);
        } catch (error) {
          // If listing fails, continue without metadata
          fileInfo = null;
        }

        return {
          content: content.toString(),
          size: fileInfo?.size || 0,
          encoding: input.encoding,
          mimeType: fileInfo?.mimeType
        };
      }),

    /**
     * Write file content to a root folder
     */
    writeFile: publicProcedure
      .meta({
        ...createMCPTool({
          name: 'writeFile',
          description: 'Write content to a file in a configured root folder',
          category: 'filesystem'
        })
      })
      .input(z.object({
        workspaceId: createWorkspaceIdSchema(),
        path: z.string().describe('Relative file path within workspace folder'),
        content: z.string().describe('File content to write'),
        encoding: z.enum(['utf8', 'base64', 'binary']).default('utf8').describe('Content encoding')
      }))
      .output(z.object({
        success: z.boolean(),
        path: z.string(),
        size: z.number()
      }))
      .mutation(async ({ input }) => {
        ensureWorkspaceAPIEnabled();
        let contentBuffer: string | Buffer = input.content;

        if (input.encoding === 'base64') {
          contentBuffer = Buffer.from(input.content, 'base64');
        } else if (input.encoding === 'binary') {
          contentBuffer = Buffer.from(input.content, 'binary');
        }

        await manager.writeFile(input.workspaceId, input.path, contentBuffer);

        return {
          success: true,
          path: input.path,
          size: contentBuffer.length
        };
      }),

    /**
     * Check if a path exists in a root folder
     */
    pathExists: publicProcedure
      .meta({
        ...createMCPTool({
          name: 'pathExists',
          description: 'Check if a file or directory exists in a configured root folder',
          category: 'filesystem'
        })
      })
      .input(z.object({
        workspaceId: createWorkspaceIdSchema(),
        path: z.string().describe('Relative path within workspace folder')
      }))
      .output(z.object({
        exists: z.boolean(),
        path: z.string()
      }))
      .query(async ({ input }) => {
        ensureWorkspaceAPIEnabled();
        const exists = await manager.pathExists(input.workspaceId, input.path);
        return {
          exists,
          path: input.path
        };
      }),

    /**
     * Add a new server workspace configuration
     */
    addServerWorkspace: publicProcedure
      .meta({
        ...createMCPTool({
          name: 'addServerWorkspace',
          description: 'Add a new server workspace configuration for file operations',
          category: 'filesystem'
        })
      })
      .input(z.object({
        id: z.string().describe('Unique identifier for the workspace folder'),
        config: z.object({
          path: z.string().min(1).describe('Absolute path to the workspace folder'),
          name: z.string().optional().describe('Display name for the workspace folder'),
          description: z.string().optional().describe('Description of the workspace folder purpose'),
          readOnly: z.boolean().default(false).describe('Whether this server workspace is read-only'),
          allowedPaths: z.array(z.string()).optional().describe('Allowed path patterns (glob)'),
          blockedPaths: z.array(z.string()).optional().describe('Blocked path patterns (glob)'),
          maxFileSize: z.number().optional().describe('Maximum file size in bytes'),
          allowedExtensions: z.array(z.string()).optional().describe('Allowed file extensions'),
          blockedExtensions: z.array(z.string()).optional().describe('Blocked file extensions'),
          followSymlinks: z.boolean().default(false).describe('Whether to follow symbolic links'),
          enableWatching: z.boolean().default(false).describe('Whether to watch for file changes')
        })
      }))
      .output(z.object({
        success: z.boolean(),
        id: z.string(),
        message: z.string()
      }))
      .mutation(async ({ input }) => {
        ensureWorkspaceAPIEnabled();
        try {
          manager.addWorkspace(input.id, input.config as any);
          return {
            success: true,
            id: input.id,
            message: `Server workspace '${input.id}' added successfully`
          };
        } catch (error) {
          return {
            success: false,
            id: input.id,
            message: error instanceof Error ? error.message : 'Unknown error'
          };
        }
      }),

    /**
     * Remove a server workspace configuration
     */
    removeServerWorkspace: publicProcedure
      .meta({
        ...createMCPTool({
          name: 'removeServerWorkspace',
          description: 'Remove a server workspace configuration',
          category: 'filesystem'
        })
      })
      .input(z.object({
        id: z.string().describe('Server workspace ID to remove')
      }))
      .output(z.object({
        success: z.boolean(),
        id: z.string(),
        message: z.string()
      }))
      .mutation(async ({ input }) => {
        ensureWorkspaceAPIEnabled();
        const removed = manager.removeWorkspace(input.id);
        return {
          success: removed,
          id: input.id,
          message: removed
            ? `Server workspace '${input.id}' removed successfully`
            : `Server workspace '${input.id}' not found`
        };
      }),

    /**
     * Register a client workspace (MCP client root)
     * This allows MCP clients to dynamically register their workspace folders
     */
    registerClientWorkspace: publicProcedure
      .meta({
        ...createMCPTool({
          name: 'registerClientWorkspace',
          description: 'Register a client workspace folder for MCP access',
          category: 'filesystem'
        })
      })
      .input(z.object({
        id: z.string().describe('Unique identifier for the client workspace'),
        uri: z.string().describe('File URI of the client workspace (e.g., file:///path/to/folder)'),
        name: z.string().optional().describe('Display name for the workspace'),
        description: z.string().optional().describe('Description of the workspace')
      }))
      .output(z.object({
        success: z.boolean(),
        id: z.string(),
        message: z.string()
      }))
      .mutation(async ({ input }) => {
        // Note: This is a placeholder for client workspace registration
        // In a full implementation, this would store client workspace info
        // for use by MCP clients, but keep it separate from server workspaces

        console.log(`📋 Client workspace registered: ${input.id} -> ${input.uri}`);

        return {
          success: true,
          id: input.id,
          message: `Client workspace '${input.id}' registered successfully`
        };
      }),

    /**
     * Unregister a client workspace (MCP client root)
     */
    unregisterClientWorkspace: publicProcedure
      .meta({
        ...createMCPTool({
          name: 'unregisterClientWorkspace',
          description: 'Unregister a client workspace folder',
          category: 'filesystem'
        })
      })
      .input(z.object({
        id: z.string().describe('Client workspace ID to unregister')
      }))
      .output(z.object({
        success: z.boolean(),
        id: z.string(),
        message: z.string()
      }))
      .mutation(async ({ input }) => {
        console.log(`📋 Client workspace unregistered: ${input.id}`);

        return {
          success: true,
          id: input.id,
          message: `Client workspace '${input.id}' unregistered successfully`
        };
      }),

    /**
     * List registered client workspaces (MCP client roots)
     * This is separate from server workspaces and MCP roots/list
     */
    listClientWorkspaces: publicProcedure
      .meta({
        ...createMCPTool({
          name: 'listClientWorkspaces',
          description: 'List all registered client workspace folders',
          category: 'filesystem'
        })
      })
      .input(z.void())
      .output(z.array(z.object({
        id: z.string(),
        uri: z.string(),
        name: z.string().optional(),
        description: z.string().optional(),
        registeredAt: z.date()
      })))
      .query(async () => {
        // Note: This is a placeholder implementation
        // In a full implementation, this would return stored client workspace info

        console.log('📋 Listing registered client workspaces (placeholder)');

        return []; // Empty list for now
      })
  });
}

export const systemRouter: ReturnType<typeof createSystemRouter> = createSystemRouter();
