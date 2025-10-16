/**
 * OAuth 2.0 Scope System for MCP Tools
 *
 * Provides a flexible, hierarchical scope system for controlling access to MCP tools.
 * Supports common OAuth patterns and MCP-specific requirements.
 */
export type ScopePattern = 'read' | 'write' | 'admin' | 'user' | 'mcp' | 'mcp:tools' | 'mcp:call' | 'mcp:list' | 'ai:execute' | 'ai:configure' | 'ai:read' | 'tools:call' | 'tools:list' | 'tools:admin' | 'billing:read' | 'billing:write' | 'profile:read' | 'profile:write' | 'system:admin' | 'system:read' | 'system:health' | string;
export type ScopeRequirement = {
    /** Required scopes - user must have ALL of these */
    required?: ScopePattern[];
    /** Optional scopes - user must have AT LEAST ONE of these */
    anyOf?: ScopePattern[];
    /** Scope namespace for grouping related permissions */
    namespace?: string;
    /** Human-readable description of what this scope grants */
    description?: string;
    /** Whether this is a privileged scope requiring explicit consent */
    privileged?: boolean;
    /** Whether admin user validation is required (checked against adminUsers config) */
    requireAdminUser?: boolean;
};
/**
 * MCP Tool Scope Configuration
 * Extended metadata for MCP tools with scope-based access control
 */
export interface MCPToolScope {
    /** Tool name/identifier */
    name?: string;
    /** Tool description */
    description: string;
    /** Scope requirements for this tool */
    scopes?: ScopeRequirement;
    /** Tool category for organization */
    category?: 'utility' | 'ai' | 'data' | 'admin' | 'system' | string;
    /** Whether tool is public (no auth required) */
    public?: boolean;
    /** Custom permissions beyond scopes */
    permissions?: string[];
    /** Admin user restrictions - only these users can access the tool */
    adminUsers?: string[] | 'any';
    /** Whether to require admin user validation in addition to scopes */
    requireAdminUser?: boolean;
}
/**
 * Scope Helper Functions
 * Provides convenient builders for common scope patterns
 */
export declare class ScopeHelpers {
    /** Read-only access to a resource */
    static read(resource?: string): ScopeRequirement;
    /** Write access to a resource */
    static write(resource?: string): ScopeRequirement;
    /** Full access (read + write) to a resource */
    static readWrite(resource?: string): ScopeRequirement;
    /** Execute/call access for tools and APIs */
    static execute(resource?: string): ScopeRequirement;
    /** Administrative access */
    static admin(resource?: string): ScopeRequirement;
    /** MCP tool access (list tools) */
    static mcpList(): ScopeRequirement;
    /** MCP tool execution */
    static mcpCall(): ScopeRequirement;
    /** Public tool (no authentication required) */
    static public(): ScopeRequirement;
    /** AI service access */
    static ai(action?: 'execute' | 'configure' | 'read'): ScopeRequirement;
    /** User profile access */
    static profile(action?: 'read' | 'write'): ScopeRequirement;
    /** Billing/subscription access */
    static billing(action?: 'read' | 'write'): ScopeRequirement;
    /** System health and status */
    static system(action?: 'read' | 'admin'): ScopeRequirement;
    /** Custom scope requirement */
    static custom(scopes: ScopePattern[], description: string, options?: {
        anyOf?: boolean;
        namespace?: string;
        privileged?: boolean;
    }): ScopeRequirement;
    /** Admin-only tool - requires admin scope + specific user validation */
    static adminOnly(adminUsers?: string[] | 'any', description?: string): ScopeRequirement & {
        adminUsers: string[] | 'any';
    };
}
/**
 * Scope Validation and Checking
 */
export declare class ScopeValidator {
    /**
     * Check if user scopes satisfy the requirement
     */
    static hasScope(userScopes: string[], requirement: ScopeRequirement, userInfo?: {
        email?: string;
        id?: string;
    }): boolean;
    /**
     * Check if a scope pattern matches a user scope (supports wildcards)
     */
    static matchesPattern(userScope: string, pattern: string): boolean;
    /**
     * Get missing scopes for a requirement
     */
    static getMissingScopes(userScopes: string[], requirement: ScopeRequirement): {
        missing: string[];
        type: 'required' | 'anyOf' | 'none';
    };
    /**
     * Filter tools based on user scopes and admin restrictions
     */
    static filterToolsByScope(tools: Array<{
        name: string;
        scopes?: ScopeRequirement;
    }>, userScopes: string[], userInfo?: {
        email?: string;
        id?: string;
    }): Array<{
        name: string;
        scopes?: ScopeRequirement;
    }>;
    /**
     * Get effective scopes after applying hierarchy rules
     */
    static expandScopes(userScopes: string[]): string[];
}
/**
 * Default scope configurations for common use cases
 */
export declare const DefaultScopes: {
    readonly PUBLIC: ScopeRequirement;
    readonly MCP_LIST: ScopeRequirement;
    readonly MCP_CALL: ScopeRequirement;
    readonly AI_EXECUTE: ScopeRequirement;
    readonly AI_CONFIGURE: ScopeRequirement;
    readonly AI_READ: ScopeRequirement;
    readonly SYSTEM_READ: ScopeRequirement;
    readonly SYSTEM_ADMIN: ScopeRequirement;
    readonly PROFILE_READ: ScopeRequirement;
    readonly PROFILE_WRITE: ScopeRequirement;
    readonly BILLING_READ: ScopeRequirement;
    readonly BILLING_WRITE: ScopeRequirement;
    readonly ADMIN: ScopeRequirement;
    readonly USER: ScopeRequirement;
    readonly READ_ONLY: ScopeRequirement;
};
/**
 * Utility function to create MCP metadata with scopes
 */
export declare function createMCPTool(config: MCPToolScope): {
    mcp: MCPToolScope;
};
/**
 * Utility function to create admin-restricted MCP tool
 */
export declare function createAdminMCPTool(config: Omit<MCPToolScope, 'scopes'> & {
    adminUsers: string[] | 'any';
    baseScopes?: ScopeRequirement;
}): {
    mcp: MCPToolScope;
};
/**
 * MCP Prompt Configuration
 * User-facing prompt templates for AI workflows (distinct from internal system prompts)
 */
export interface MCPPromptArgument {
    name: string;
    description?: string;
    required?: boolean;
    type?: 'string' | 'number' | 'boolean' | 'enum' | 'json' | 'object' | 'array';
    options?: Array<string | number | boolean>;
    default?: string | number | boolean | null;
    example?: string;
}
export interface MCPPromptVariableDefinition {
    type?: 'string' | 'number' | 'boolean' | 'enum' | 'json' | 'object' | 'array';
    description?: string;
    required?: boolean;
    options?: Array<string | number | boolean>;
    default?: string | number | boolean | null;
    example?: string;
    format?: string;
}
export interface MCPPromptConfig {
    /** Prompt name/identifier */
    name: string;
    /** Prompt description - what this prompt helps with */
    description: string;
    /** Arguments that users can provide to customize the prompt */
    arguments?: MCPPromptArgument[];
    /** Optional reusable template with placeholder variables */
    template?: string;
    /** Structured variable definitions for dynamic prompts */
    variables?: Record<string, MCPPromptVariableDefinition>;
    /** Category for organization */
    category?: 'coding' | 'documentation' | 'review' | 'analysis' | 'general' | string;
    /** Whether prompt is public (no auth required) */
    public?: boolean;
    /** Scope requirements for accessing this prompt */
    scopes?: ScopeRequirement;
}
/**
 * Utility function to create MCP-compatible prompt metadata for tRPC procedures
 *
 * **IMPORTANT:** This is for MCP prompt templates (user-facing workflows),
 * NOT for internal system prompts used by AIService.
 *
 * @example
 * ```typescript
 * // Add to tRPC procedure
 * codeReview: publicProcedure
 *   .meta(createMCPPrompt({
 *     name: 'code-review',
 *     description: 'Generate comprehensive code review feedback',
 *     arguments: [
 *       { name: 'language', description: 'Programming language', required: true },
 *       { name: 'focusArea', description: 'Specific area to focus on', required: false }
 *     ],
 *     category: 'review'
 *   }))
 *   .input(z.object({ language: z.string(), focusArea: z.string().optional() }))
 *   .query(({ input }) => {
 *     // Return the prompt text with interpolated arguments
 *     return generatePromptText(input);
 *   })
 * ```
 */
export declare function createMCPPrompt(config: MCPPromptConfig): {
    mcpPrompt: MCPPromptConfig;
};
//# sourceMappingURL=scopes.d.ts.map