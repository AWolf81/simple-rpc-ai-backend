/**
 * MCP Resource Registry - Flexible system for registering and managing MCP resources
 *
 * Allows package users to register custom resources with template helpers and dynamic content.
 */
import { createMCPResourceHandler } from './mcp-resource-helpers.js';
import { logger } from '../../../utils/logger.js';
/**
 * Flexible MCP Resource Registry
 * Allows registration of resources, providers, and templates
 */
export class MCPResourceRegistry {
    resources = new Map();
    providers = new Map();
    templates = new Map();
    config;
    constructor(config = {}) {
        this.config = {
            enableBuiltinResources: config.enableBuiltinResources ?? true,
            builtinResources: config.builtinResources ?? {}
        };
        // Register built-in resources if enabled
        if (this.config.enableBuiltinResources) {
            this.registerBuiltinResources();
        }
    }
    /**
     * Register a new MCP resource
     */
    registerResource(resource, provider) {
        // Generate URI if not provided
        if (!resource.uri) {
            resource.uri = `mcp://internal/${resource.id}`;
        }
        // Validate resource
        if (!resource.id || !resource.name || !resource.description) {
            throw new Error('Resource must have id, name, and description');
        }
        this.resources.set(resource.id, resource);
        if (provider) {
            this.providers.set(resource.id, provider);
        }
        logger.debug(`📝 Registered MCP resource: ${resource.id} (${resource.mimeType})`);
    }
    /**
     * Register a resource template for dynamic content generation
     */
    registerTemplate(resourceId, template) {
        this.templates.set(resourceId, template);
        logger.debug(`📋 Registered MCP template: ${resourceId}`);
    }
    /**
     * Register a resource provider function
     */
    registerProvider(resourceId, provider) {
        this.providers.set(resourceId, provider);
        logger.debug(`🏭 Registered MCP provider: ${resourceId}`);
    }
    /**
     * Get all registered resources
     */
    getAllResources() {
        return Array.from(this.resources.values());
    }
    /**
     * Get resources filtered by category or other criteria
     */
    getResourcesByCategory(category, requireAuth) {
        const resources = this.getAllResources();
        return resources.filter(resource => {
            if (category && resource.category !== category) {
                return false;
            }
            if (requireAuth !== undefined && resource.requireAuth !== requireAuth) {
                return false;
            }
            return true;
        });
    }
    /**
     * Get a specific resource by ID
     */
    getResource(resourceId) {
        return this.resources.get(resourceId);
    }
    /**
     * Get all registered templates
     */
    getAllTemplates() {
        return new Map(this.templates);
    }
    /**
     * Get template information for a specific resource
     */
    getTemplate(resourceId) {
        return this.templates.get(resourceId);
    }
    /**
     * Get resource content by ID with context
     */
    async getResourceContent(resourceId, context) {
        const resource = this.resources.get(resourceId);
        if (!resource) {
            return null;
        }
        // Try provider first
        const provider = this.providers.get(resourceId);
        if (provider) {
            try {
                const result = await provider.generateContent(resourceId, context);
                // Provider can return string or object with content and mimeType
                if (typeof result === 'string') {
                    return { content: result, mimeType: resource.mimeType };
                }
                else if (result && typeof result === 'object' && result.content) {
                    return {
                        content: result.content,
                        mimeType: result.mimeType || resource.mimeType
                    };
                }
                else {
                    return { content: String(result), mimeType: resource.mimeType };
                }
            }
            catch (error) {
                // Log the error but don't swallow it - let caller handle
                console.error(`❌ Error generating content for ${resourceId}:`, error);
                throw error;
            }
        }
        // Try template
        const template = this.templates.get(resourceId);
        if (template) {
            try {
                const content = this.renderTemplate(template, context);
                return { content, mimeType: resource.mimeType };
            }
            catch (error) {
                console.error(`❌ Error rendering template for ${resourceId}:`, error);
                return null;
            }
        }
        // No provider or template - return error
        console.warn(`⚠️ No provider or template found for resource: ${resourceId}`);
        return null;
    }
    /**
     * Check if user has access to a resource
     */
    checkResourceAccess(resourceId, userInfo) {
        const resource = this.resources.get(resourceId);
        if (!resource) {
            return false;
        }
        // Check custom access function
        const provider = this.providers.get(resourceId);
        if (provider?.checkAccess) {
            return provider.checkAccess(resourceId, userInfo);
        }
        // Check basic auth requirements
        if (resource.requireAuth && !userInfo?.email) {
            return false;
        }
        // Check scopes
        if (resource.scopes && resource.scopes.length > 0) {
            if (!userInfo?.scopes || !resource.scopes.some(scope => userInfo.scopes.includes(scope))) {
                return false;
            }
        }
        return true;
    }
    /**
     * Remove a resource from the registry
     */
    unregisterResource(resourceId) {
        const removed = this.resources.delete(resourceId);
        this.providers.delete(resourceId);
        this.templates.delete(resourceId);
        if (removed) {
            logger.debug(`🗑️ Unregistered MCP resource: ${resourceId}`);
        }
        return removed;
    }
    /**
     * Clear all non-builtin resources
     */
    clearCustomResources() {
        const customResources = Array.from(this.resources.values())
            .filter(r => !r.builtin)
            .map(r => r.id);
        customResources.forEach(id => this.unregisterResource(id));
        logger.debug(`🧹 Cleared ${customResources.length} custom resources`);
    }
    /**
     * Get resource statistics
     */
    getStats() {
        const resources = this.getAllResources();
        const categoryCounts = {};
        resources.forEach(resource => {
            const category = resource.category || 'uncategorized';
            categoryCounts[category] = (categoryCounts[category] || 0) + 1;
        });
        return {
            totalResources: resources.length,
            builtinResources: resources.filter(r => r.builtin).length,
            customResources: resources.filter(r => !r.builtin).length,
            categoryCounts
        };
    }
    /**
     * Simple template rendering with variable substitution
     */
    renderTemplate(template, context = {}) {
        const vars = {
            ...template.defaultVars,
            ...context,
            // Add some useful built-in variables
            timestamp: new Date().toISOString(),
            date: new Date().toLocaleDateString(),
            time: new Date().toLocaleTimeString()
        };
        // Validate variables if validator exists
        if (template.validateVars && !template.validateVars(vars)) {
            throw new Error('Template variable validation failed');
        }
        // Simple template substitution ({{variable}} format)
        return template.template.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
            return vars[varName] !== undefined ? String(vars[varName]) : match;
        });
    }
    /**
     * Register global filesystem resources if rootManager is available
     */
    registerGlobalResources(rootManager) {
        if (rootManager) {
            GlobalResourceTemplates.registerAll(rootManager);
        }
    }
    /**
     * Register built-in resources that come with the system
     */
    registerBuiltinResources() {
        // Note: Built-in resources should be minimal and non-opinionated
        // Users can create their own resources using the Template Engine API
        // Check if specific resources are enabled
        const { builtinResources } = this.config;
        const apiSchemasEnabled = builtinResources?.apiSchemas ?? true;
        const securityGuidelinesEnabled = builtinResources?.securityGuidelines ?? true;
        // API Schemas
        if (apiSchemasEnabled) {
            this.registerResource({
                id: 'api-schemas',
                name: 'API Schema Definitions',
                description: 'OpenAPI/JSON Schema definitions for all internal APIs and services',
                mimeType: 'application/json',
                category: 'api',
                requireAuth: false,
                builtin: true
            });
            this.registerProvider('api-schemas', {
                generateContent: async () => {
                    return JSON.stringify({
                        "openapi": "3.0.0",
                        "info": {
                            "title": "Simple RPC AI Backend API",
                            "version": "1.0.0",
                            "description": "Comprehensive API schemas for all service endpoints"
                        },
                        "servers": [
                            {
                                "url": "http://localhost:8001",
                                "description": "Development server"
                            }
                        ],
                        "paths": {
                            "/rpc": {
                                "post": {
                                    "summary": "JSON-RPC 2.0 Endpoint",
                                    "requestBody": {
                                        "content": {
                                            "application/json": {
                                                "schema": {
                                                    "type": "object",
                                                    "properties": {
                                                        "jsonrpc": { "type": "string", "enum": ["2.0"] },
                                                        "method": { "type": "string" },
                                                        "params": { "type": "object" },
                                                        "id": { "type": ["string", "number"] }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }, null, 2);
                }
            });
        }
        // Security Guidelines
        if (securityGuidelinesEnabled) {
            this.registerResource({
                id: 'security-guidelines',
                name: 'Security Guidelines',
                description: 'Comprehensive security policies, procedures, and implementation guidelines',
                mimeType: 'text/markdown',
                category: 'security',
                requireAuth: true,
                scopes: ['security:read', 'admin'],
                builtin: true
            });
            this.registerTemplate('security-guidelines', {
                template: `# Security Guidelines

## Authentication & Authorization
- Use JWT tokens for API authentication
- Implement proper scope-based access control
- Regular token rotation (24-hour expiration recommended)
- Multi-factor authentication for admin access

## Data Protection
- Encrypt sensitive data at rest using AES-256
- Use HTTPS for all network communications
- Implement proper input validation and sanitization
- Regular security audits and penetration testing

## Incident Response
1. **Detection**: Monitor for security anomalies
2. **Containment**: Isolate affected systems
3. **Investigation**: Document and analyze the incident
4. **Recovery**: Restore normal operations
5. **Lessons Learned**: Update procedures based on findings

## Compliance Requirements
- GDPR compliance for user data handling
- SOC 2 Type II certification requirements
- Regular security training for all developers
- Vulnerability disclosure program

---
*Last updated: {{timestamp}}*
*Classification: Internal Use Only*
`
            });
        }
        // Log what was registered
        const registeredCount = (apiSchemasEnabled ? 1 : 0) + (securityGuidelinesEnabled ? 1 : 0);
        if (registeredCount > 0) {
            logger.debug(`✅ Registered ${registeredCount} built-in MCP resource${registeredCount > 1 ? 's' : ''}`);
        }
    }
}
// Global registry instance
export const mcpResourceRegistry = new MCPResourceRegistry();
// Helper functions for easy registration
export function registerMCPResource(resource, provider) {
    mcpResourceRegistry.registerResource(resource, provider);
}
export function registerMCPTemplate(resourceId, template) {
    mcpResourceRegistry.registerTemplate(resourceId, template);
}
export function registerMCPProvider(resourceId, provider) {
    mcpResourceRegistry.registerProvider(resourceId, provider);
}
/**
 * Global Resource Templates - Pre-built resource templates for common use cases
 */
export class GlobalResourceTemplates {
    /**
     * Create a secure file-reader resource that respects rootsManager
     */
    static createFileReader(rootManager) {
        mcpResourceRegistry.registerResource({
            id: 'file-reader',
            name: 'Secure File Reader',
            description: 'Read files securely from configured root folders',
            mimeType: 'application/json',
            category: 'filesystem',
            requireAuth: false,
            builtin: true
        });
        mcpResourceRegistry.registerProvider('file-reader', {
            generateContent: async (resourceId, context) => {
                const { rootId, path, encoding = 'utf8' } = context || {};
                // If no parameters provided, return usage documentation
                if (!rootId || !path) {
                    const availableRoots = rootManager.getClientRootFolders();
                    return JSON.stringify({
                        description: 'Secure File Reader - Usage Information',
                        error: 'This resource requires parameters that must be provided via MCP tools, not direct resource access',
                        usage: 'Use the readFile MCP tool instead of accessing this resource directly',
                        availableRoots: Object.keys(availableRoots),
                        example: {
                            method: 'tools/call',
                            params: {
                                name: 'readFile',
                                arguments: {
                                    rootId: Object.keys(availableRoots)[0] || 'default',
                                    path: 'README.md'
                                }
                            }
                        }
                    }, null, 2);
                }
                try {
                    // Use rootManager for secure file access
                    const content = await rootManager.readFile(rootId, path, {
                        encoding: encoding
                    });
                    // Get additional file info
                    const fileInfo = await rootManager.getFileInfo(rootId, path);
                    return JSON.stringify({
                        rootId,
                        path,
                        encoding,
                        content,
                        size: fileInfo.size,
                        lastModified: fileInfo.lastModified,
                        mimeType: fileInfo.mimeType
                    }, null, 2);
                }
                catch (error) {
                    return JSON.stringify({
                        error: `Failed to read file: ${error instanceof Error ? error.message : String(error)}`,
                        rootId,
                        path,
                        encoding
                    }, null, 2);
                }
            },
            checkAccess: (resourceId, userInfo) => {
                // File reader can be public, but individual files are protected by rootManager
                return true;
            }
        });
        logger.debug('📁 Registered global file-reader resource with rootsManager integration');
    }
    /**
     * Create a root folders listing resource
     */
    static createRootFoldersLister(rootManager) {
        mcpResourceRegistry.registerResource({
            id: 'root-folders',
            name: 'Available Root Folders',
            description: 'List all configured root folders and their access permissions',
            mimeType: 'application/json',
            category: 'filesystem',
            requireAuth: false,
            builtin: true
        });
        mcpResourceRegistry.registerProvider('root-folders', {
            generateContent: async (resourceId, context) => {
                try {
                    const rootFolders = rootManager.getClientRootFolders();
                    return JSON.stringify({
                        timestamp: new Date().toISOString(),
                        count: rootFolders.length,
                        rootFolders: rootFolders
                    }, null, 2);
                }
                catch (error) {
                    return JSON.stringify({
                        error: `Failed to list root folders: ${error instanceof Error ? error.message : String(error)}`,
                        timestamp: new Date().toISOString()
                    }, null, 2);
                }
            }
        });
        logger.debug('📂 Registered global root-folders resource');
    }
    /**
     * Create a directory listing resource
     */
    static createDirectoryLister(rootManager) {
        mcpResourceRegistry.registerResource({
            id: 'directory-listing',
            name: 'Directory Contents',
            description: 'List files and directories within configured root folders',
            mimeType: 'application/json',
            category: 'filesystem',
            requireAuth: false,
            builtin: true
        });
        mcpResourceRegistry.registerProvider('directory-listing', {
            generateContent: createMCPResourceHandler({
                id: 'directory-listing',
                name: 'Directory Contents',
                description: 'List files and directories within configured root folders',
                parameters: {
                    rootId: {
                        type: 'string',
                        description: 'Root folder ID',
                        required: true,
                        availableValues: Object.keys(rootManager.getClientRootFolders())
                    },
                    path: {
                        type: 'string',
                        description: 'Directory path relative to root folder',
                        default: ''
                    },
                    recursive: {
                        type: 'boolean',
                        description: 'Include subdirectories recursively',
                        default: false
                    }
                },
                additionalData: {
                    availableRoots: rootManager.getClientRootFolders()
                }
            }, async (params) => {
                const { rootId, path = '', recursive = false } = params;
                try {
                    const files = await rootManager.listFiles(rootId, path, {
                        recursive,
                        includeDirectories: true
                    });
                    return JSON.stringify({
                        rootId,
                        path,
                        recursive,
                        timestamp: new Date().toISOString(),
                        count: files.length,
                        files: files.map((file) => ({
                            name: file.name,
                            path: file.relativePath,
                            size: file.size,
                            lastModified: file.lastModified,
                            isDirectory: file.isDirectory,
                            mimeType: file.mimeType,
                            readable: file.readable,
                            writable: file.writable
                        }))
                    }, null, 2);
                }
                catch (error) {
                    return JSON.stringify({
                        error: `Failed to list directory: ${error instanceof Error ? error.message : String(error)}`,
                        rootId,
                        path,
                        recursive
                    }, null, 2);
                }
            })
        });
        logger.debug('📋 Registered global directory-listing resource');
    }
    /**
     * Register all global resource templates
     */
    static registerAll(rootManager) {
        this.createFileReader(rootManager);
        this.createRootFoldersLister(rootManager);
        this.createDirectoryLister(rootManager);
        logger.debug('✅ Registered all global resource templates');
    }
}
// Export helper for creating resources
export const MCPResourceHelpers = {
    /**
     * Create a simple static text resource
     */
    createStaticResource(id, name, content, options = {}) {
        const resource = {
            id,
            name,
            description: options.description || `Static resource: ${name}`,
            mimeType: options.mimeType || 'text/plain',
            category: options.category || 'data',
            requireAuth: options.requireAuth || false,
            scopes: options.scopes || [],
            ...options
        };
        mcpResourceRegistry.registerResource(resource);
        mcpResourceRegistry.registerProvider(id, {
            generateContent: () => content
        });
        return resource;
    },
    /**
     * Create a dynamic resource from a function
     */
    createDynamicResource(id, name, generator, options = {}) {
        const resource = {
            id,
            name,
            description: options.description || `Dynamic resource: ${name}`,
            mimeType: options.mimeType || 'text/plain',
            category: options.category || 'data',
            requireAuth: options.requireAuth || false,
            scopes: options.scopes || [],
            ...options
        };
        mcpResourceRegistry.registerResource(resource);
        mcpResourceRegistry.registerProvider(id, {
            generateContent: generator
        });
        return resource;
    },
    /**
     * Create a template-based resource
     */
    createTemplateResource(id, name, template, options = {}) {
        const { defaultVars, ...resourceOptions } = options;
        const resource = {
            id,
            name,
            description: resourceOptions.description || `Template resource: ${name}`,
            mimeType: resourceOptions.mimeType || 'text/plain',
            category: resourceOptions.category || 'data',
            requireAuth: resourceOptions.requireAuth || false,
            scopes: resourceOptions.scopes || [],
            ...resourceOptions
        };
        mcpResourceRegistry.registerResource(resource);
        mcpResourceRegistry.registerTemplate(id, {
            template,
            defaultVars
        });
        return resource;
    }
};
//# sourceMappingURL=mcp-resource-registry.js.map