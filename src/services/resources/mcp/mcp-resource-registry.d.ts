/**
 * MCP Resource Registry - Flexible system for registering and managing MCP resources
 *
 * Allows package users to register custom resources with template helpers and dynamic content.
 */
export interface MCPResource {
    /** Unique identifier for the resource */
    id: string;
    /** Human-readable name */
    name: string;
    /** Description of the resource */
    description: string;
    /** MIME type of the resource content */
    mimeType: string;
    /** URI scheme (defaults to mcp://internal/{id}) */
    uri?: string;
    /** Resource category for organization */
    category?: 'documentation' | 'api' | 'security' | 'config' | 'data' | string;
    /** Whether authentication is required */
    requireAuth?: boolean;
    /** Required scopes for access */
    scopes?: string[];
    /** Whether this is a built-in resource */
    builtin?: boolean;
}
export interface MCPResourceProvider {
    /** Function to generate the resource content */
    generateContent: (resourceId: string, context?: any) => Promise<string | {
        content: string;
        mimeType?: string;
    }> | string | {
        content: string;
        mimeType?: string;
    };
    /** Optional function to validate access permissions */
    checkAccess?: (resourceId: string, userInfo?: {
        email?: string;
        scopes?: string[];
    }) => boolean;
    /** Template variables available in this resource */
    templateVars?: Record<string, any>;
}
export interface MCPResourceTemplate {
    /** Template string with placeholders */
    template: string;
    /** Default variables for the template */
    defaultVars?: Record<string, any>;
    /** Variable validation function */
    validateVars?: (vars: Record<string, any>) => boolean;
    /** URI template from Template Engine (RFC 6570) */
    uriTemplate?: string;
    /** Template parameters from Template Engine */
    parameters?: Record<string, {
        type?: string;
        description?: string;
        enum?: string[];
        required?: boolean;
        default?: any;
        min?: number;
        max?: number;
    }>;
}
export interface MCPResourceRegistryConfig {
    /** Enable/disable built-in resources */
    enableBuiltinResources?: boolean;
    /** Specific built-in resources to enable (overrides enableBuiltinResources if set) */
    builtinResources?: {
        apiSchemas?: boolean;
        securityGuidelines?: boolean;
    };
}
/**
 * Flexible MCP Resource Registry
 * Allows registration of resources, providers, and templates
 */
export declare class MCPResourceRegistry {
    private resources;
    private providers;
    private templates;
    private config;
    constructor(config?: MCPResourceRegistryConfig);
    /**
     * Register a new MCP resource
     */
    registerResource(resource: MCPResource, provider?: MCPResourceProvider): void;
    /**
     * Register a resource template for dynamic content generation
     */
    registerTemplate(resourceId: string, template: MCPResourceTemplate): void;
    /**
     * Register a resource provider function
     */
    registerProvider(resourceId: string, provider: MCPResourceProvider): void;
    /**
     * Get all registered resources
     */
    getAllResources(): MCPResource[];
    /**
     * Get resources filtered by category or other criteria
     */
    getResourcesByCategory(category?: string, requireAuth?: boolean): MCPResource[];
    /**
     * Get a specific resource by ID
     */
    getResource(resourceId: string): MCPResource | undefined;
    /**
     * Get all registered templates
     */
    getAllTemplates(): Map<string, MCPResourceTemplate>;
    /**
     * Get template information for a specific resource
     */
    getTemplate(resourceId: string): MCPResourceTemplate | undefined;
    /**
     * Get resource content by ID with context
     */
    getResourceContent(resourceId: string, context?: any): Promise<{
        content: string;
        mimeType: string;
    } | null>;
    /**
     * Check if user has access to a resource
     */
    checkResourceAccess(resourceId: string, userInfo?: {
        email?: string;
        scopes?: string[];
    }): boolean;
    /**
     * Remove a resource from the registry
     */
    unregisterResource(resourceId: string): boolean;
    /**
     * Clear all non-builtin resources
     */
    clearCustomResources(): void;
    /**
     * Get resource statistics
     */
    getStats(): {
        totalResources: number;
        builtinResources: number;
        customResources: number;
        categoryCounts: Record<string, number>;
    };
    /**
     * Simple template rendering with variable substitution
     */
    private renderTemplate;
    /**
     * Register global filesystem resources if rootManager is available
     */
    registerGlobalResources(rootManager?: any): void;
    /**
     * Register built-in resources that come with the system
     */
    private registerBuiltinResources;
}
export declare const mcpResourceRegistry: MCPResourceRegistry;
export declare function registerMCPResource(resource: MCPResource, provider?: MCPResourceProvider): void;
export declare function registerMCPTemplate(resourceId: string, template: MCPResourceTemplate): void;
export declare function registerMCPProvider(resourceId: string, provider: MCPResourceProvider): void;
/**
 * Global Resource Templates - Pre-built resource templates for common use cases
 */
export declare class GlobalResourceTemplates {
    /**
     * Create a secure file-reader resource that respects rootsManager
     */
    static createFileReader(rootManager: any): void;
    /**
     * Create a root folders listing resource
     */
    static createRootFoldersLister(rootManager: any): void;
    /**
     * Create a directory listing resource
     */
    static createDirectoryLister(rootManager: any): void;
    /**
     * Register all global resource templates
     */
    static registerAll(rootManager: any): void;
}
export declare const MCPResourceHelpers: {
    /**
     * Create a simple static text resource
     */
    createStaticResource(id: string, name: string, content: string, options?: Partial<MCPResource>): MCPResource;
    /**
     * Create a dynamic resource from a function
     */
    createDynamicResource(id: string, name: string, generator: (context?: any) => Promise<string> | string, options?: Partial<MCPResource>): MCPResource;
    /**
     * Create a template-based resource
     */
    createTemplateResource(id: string, name: string, template: string, options?: Partial<MCPResource & {
        defaultVars?: Record<string, any>;
    }>): MCPResource;
};
//# sourceMappingURL=mcp-resource-registry.d.ts.map