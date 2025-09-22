/**
 * System Router - Basic system utilities and root folder management
 */
import { z } from 'zod';
import { router, publicProcedure } from '../../index.js';
import { createMCPTool } from '../../../auth/scopes.js';
import { RootManager } from '../../../services/root-manager.js';
export function createSystemRouter(rootManager) {
    // Use provided rootManager or create a default one
    const manager = rootManager || new RootManager();
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
                status: 'healthy',
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                version: '0.1.0',
            };
        }),
        /**
         * Get configured root folders for client applications
         */
        getRootFolders: publicProcedure
            .meta({
            ...createMCPTool({
                name: 'getRootFolders',
                description: 'Get all configured root folders with accessibility status',
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
            return manager.getClientRootFolders();
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
            rootId: z.string().describe('Root folder ID'),
            path: z.string().default('').describe('Relative path within root folder'),
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
            return await manager.listFiles(input.rootId, input.path, {
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
            rootId: z.string().describe('Root folder ID'),
            path: z.string().describe('Relative file path within root folder'),
            encoding: z.enum(['utf8', 'base64', 'binary']).default('utf8').describe('File encoding')
        }))
            .output(z.object({
            content: z.string(),
            size: z.number(),
            encoding: z.string(),
            mimeType: z.string().optional()
        }))
            .query(async ({ input }) => {
            const content = await manager.readFile(input.rootId, input.path, {
                encoding: input.encoding
            });
            // Get file info for additional metadata
            const files = await manager.listFiles(input.rootId, input.path);
            const fileInfo = files.find(f => f.relativePath === input.path);
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
            rootId: z.string().describe('Root folder ID'),
            path: z.string().describe('Relative file path within root folder'),
            content: z.string().describe('File content to write'),
            encoding: z.enum(['utf8', 'base64', 'binary']).default('utf8').describe('Content encoding')
        }))
            .output(z.object({
            success: z.boolean(),
            path: z.string(),
            size: z.number()
        }))
            .mutation(async ({ input }) => {
            let contentBuffer = input.content;
            if (input.encoding === 'base64') {
                contentBuffer = Buffer.from(input.content, 'base64');
            }
            else if (input.encoding === 'binary') {
                contentBuffer = Buffer.from(input.content, 'binary');
            }
            await manager.writeFile(input.rootId, input.path, contentBuffer);
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
            rootId: z.string().describe('Root folder ID'),
            path: z.string().describe('Relative path within root folder')
        }))
            .output(z.object({
            exists: z.boolean(),
            path: z.string()
        }))
            .query(async ({ input }) => {
            const exists = await manager.pathExists(input.rootId, input.path);
            return {
                exists,
                path: input.path
            };
        }),
        /**
         * Add a new root folder configuration
         */
        addRootFolder: publicProcedure
            .meta({
            ...createMCPTool({
                name: 'addRootFolder',
                description: 'Add a new root folder configuration for file operations',
                category: 'filesystem'
            })
        })
            .input(z.object({
            id: z.string().describe('Unique identifier for the root folder'),
            config: z.object({
                path: z.string().min(1).describe('Absolute path to the root folder'),
                name: z.string().optional().describe('Display name for the root folder'),
                description: z.string().optional().describe('Description of the root folder purpose'),
                readOnly: z.boolean().default(false).describe('Whether this root folder is read-only'),
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
            try {
                manager.addRoot(input.id, input.config);
                return {
                    success: true,
                    id: input.id,
                    message: `Root folder '${input.id}' added successfully`
                };
            }
            catch (error) {
                return {
                    success: false,
                    id: input.id,
                    message: error instanceof Error ? error.message : 'Unknown error'
                };
            }
        }),
        /**
         * Remove a root folder configuration
         */
        removeRootFolder: publicProcedure
            .meta({
            ...createMCPTool({
                name: 'removeRootFolder',
                description: 'Remove a root folder configuration',
                category: 'filesystem'
            })
        })
            .input(z.object({
            id: z.string().describe('Root folder ID to remove')
        }))
            .output(z.object({
            success: z.boolean(),
            id: z.string(),
            message: z.string()
        }))
            .mutation(async ({ input }) => {
            const removed = manager.removeRoot(input.id);
            return {
                success: removed,
                id: input.id,
                message: removed
                    ? `Root folder '${input.id}' removed successfully`
                    : `Root folder '${input.id}' not found`
            };
        })
    });
}
export const systemRouter = createSystemRouter();
