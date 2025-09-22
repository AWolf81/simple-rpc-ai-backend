import { publicProcedure } from "../../index.js";
import z from "zod";
import { createMCPTool } from '../../../auth/scopes.js';
import fs from 'fs';
import path from 'path';
/**
 * Resource management procedures for MCP
 */
export const resourceProcedures = {
    // Get available resources
    getResources: publicProcedure
        .meta({
        ...createMCPTool({
            name: 'getResources',
            description: 'List available MCP resources with metadata',
            category: 'resource',
            public: true
        }),
        openapi: {
            method: 'GET',
            path: '/mcp/resources',
            tags: ['MCP', 'Resources'],
            summary: 'List MCP resources'
        }
    })
        .input(z.object({
        category: z.string().optional().describe('Filter resources by category'),
        search: z.string().optional().describe('Search resources by name or description'),
    }))
        .output(z.object({
        resources: z.array(z.object({
            uri: z.string(),
            name: z.string(),
            description: z.string(),
            mimeType: z.string(),
            category: z.string().optional()
        })),
        total: z.number()
    }))
        .query(({ input, ctx }) => {
        // Define available resources
        let resources = [
            {
                uri: 'mcp://status',
                name: 'Server Status',
                description: 'Current server status and health information',
                mimeType: 'application/json',
                category: 'system'
            },
            {
                uri: 'mcp://config',
                name: 'Server Configuration',
                description: 'Server configuration and capabilities',
                mimeType: 'application/json',
                category: 'system'
            },
            {
                uri: 'mcp://tasks',
                name: 'Active Tasks',
                description: 'List of currently running tasks',
                mimeType: 'application/json',
                category: 'task'
            },
            {
                uri: 'file://package.json',
                name: 'Package Configuration',
                description: 'Node.js package.json file with dependencies',
                mimeType: 'application/json',
                category: 'config'
            },
            {
                uri: 'file://README.md',
                name: 'Project Documentation',
                description: 'Main project documentation and usage instructions',
                mimeType: 'text/markdown',
                category: 'documentation'
            }
        ];
        // Add custom resources from extensions if available
        const mcpConfig = ctx?.mcpConfig;
        if (mcpConfig?.extensions?.resources?.customResources) {
            const customResources = mcpConfig.extensions.resources.customResources.map((resource) => ({
                uri: resource.uri || `custom://${resource.name}`,
                name: resource.name,
                description: resource.description || 'Custom resource',
                mimeType: resource.mimeType || 'application/json',
                category: resource.category || 'custom'
            }));
            resources = [...resources, ...customResources];
        }
        // Apply filters
        if (input.category) {
            resources = resources.filter(r => r.category === input.category);
        }
        if (input.search) {
            const searchLower = input.search.toLowerCase();
            resources = resources.filter(r => r.name.toLowerCase().includes(searchLower) ||
                r.description.toLowerCase().includes(searchLower));
        }
        return {
            resources,
            total: resources.length
        };
    }),
    // Read a specific resource
    readResource: publicProcedure
        .meta({
        ...createMCPTool({
            name: 'readResource',
            description: 'Read the content of a specific MCP resource',
            category: 'resource'
        }),
        openapi: {
            method: 'GET',
            path: '/mcp/resources/{uri}',
            tags: ['MCP', 'Resources'],
            summary: 'Read resource content'
        }
    })
        .input(z.object({
        uri: z.string().min(1).describe('URI of the resource to read'),
    }))
        .output(z.object({
        content: z.any(),
        mimeType: z.string(),
        uri: z.string()
    }))
        .query(async ({ input, ctx }) => {
        const uri = input.uri;
        try {
            // Handle different URI schemes
            if (uri.startsWith('mcp://')) {
                return await handleMCPResource(uri, ctx);
            }
            else if (uri.startsWith('file://')) {
                return await handleFileResource(uri);
            }
            else if (uri.startsWith('custom://')) {
                return await handleCustomResource(uri, ctx);
            }
            else {
                throw new Error(`Unsupported URI scheme: ${uri}`);
            }
        }
        catch (error) {
            throw new Error(`Failed to read resource ${uri}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }),
};
async function handleMCPResource(uri, ctx) {
    const resourceName = uri.replace('mcp://', '');
    switch (resourceName) {
        case 'status':
            return {
                content: {
                    status: 'healthy',
                    uptime: process.uptime(),
                    memory: process.memoryUsage(),
                    version: process.version,
                    timestamp: new Date().toISOString()
                },
                mimeType: 'application/json',
                uri
            };
        case 'config':
            return {
                content: {
                    mcpEnabled: true,
                    protocols: ['http'],
                    capabilities: ['tools', 'resources', 'prompts'],
                    version: '2024-11-05',
                    server: 'simple-rpc-ai-backend'
                },
                mimeType: 'application/json',
                uri
            };
        case 'tasks':
            // This would integrate with the task management system
            return {
                content: {
                    activeTasks: 0,
                    totalTasks: 0,
                    lastUpdate: new Date().toISOString()
                },
                mimeType: 'application/json',
                uri
            };
        default:
            throw new Error(`Unknown MCP resource: ${resourceName}`);
    }
}
async function handleFileResource(uri) {
    const filePath = uri.replace('file://', '');
    const fullPath = path.resolve(process.cwd(), filePath);
    // Security check - ensure file is within project directory
    const projectRoot = process.cwd();
    if (!fullPath.startsWith(projectRoot)) {
        throw new Error('Access denied: File outside project directory');
    }
    try {
        const stats = await fs.promises.stat(fullPath);
        if (!stats.isFile()) {
            throw new Error('Path is not a file');
        }
        const content = await fs.promises.readFile(fullPath, 'utf8');
        const ext = path.extname(filePath).toLowerCase();
        let mimeType = 'text/plain';
        switch (ext) {
            case '.json':
                mimeType = 'application/json';
                break;
            case '.md':
                mimeType = 'text/markdown';
                break;
            case '.js':
            case '.ts':
                mimeType = 'text/javascript';
                break;
            case '.html':
                mimeType = 'text/html';
                break;
        }
        return {
            content: ext === '.json' ? JSON.parse(content) : content,
            mimeType,
            uri
        };
    }
    catch (error) {
        throw new Error(`File read error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}
async function handleCustomResource(uri, ctx) {
    const resourceName = uri.replace('custom://', '');
    const mcpConfig = ctx?.mcpConfig;
    if (!mcpConfig?.extensions?.resources?.customHandlers) {
        throw new Error('No custom resource handlers configured');
    }
    const handler = mcpConfig.extensions.resources.customHandlers[resourceName];
    if (!handler) {
        throw new Error(`No handler found for custom resource: ${resourceName}`);
    }
    if (typeof handler !== 'function') {
        throw new Error(`Invalid handler for custom resource: ${resourceName}`);
    }
    try {
        const result = await handler();
        return {
            content: result,
            mimeType: 'application/json',
            uri
        };
    }
    catch (error) {
        throw new Error(`Custom resource handler error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}
