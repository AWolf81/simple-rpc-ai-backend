/**
 * OAuth 2.0 Scope System for MCP Tools
 *
 * Provides a flexible, hierarchical scope system for controlling access to MCP tools.
 * Supports common OAuth patterns and MCP-specific requirements.
 */
/**
 * Scope Helper Functions
 * Provides convenient builders for common scope patterns
 */
export class ScopeHelpers {
    /** Read-only access to a resource */
    static read(resource) {
        return {
            required: resource ? [`${resource}:read`] : ['read'],
            description: `Read access${resource ? ` to ${resource}` : ''}`,
            namespace: resource
        };
    }
    /** Write access to a resource */
    static write(resource) {
        return {
            required: resource ? [`${resource}:write`] : ['write'],
            description: `Write access${resource ? ` to ${resource}` : ''}`,
            namespace: resource
        };
    }
    /** Full access (read + write) to a resource */
    static readWrite(resource) {
        const base = resource || '';
        return {
            required: resource ? [`${resource}:read`, `${resource}:write`] : ['read', 'write'],
            description: `Full access${resource ? ` to ${resource}` : ''}`,
            namespace: resource
        };
    }
    /** Execute/call access for tools and APIs */
    static execute(resource) {
        return {
            required: resource ? [`${resource}:execute`] : ['mcp:call'],
            description: `Execute access${resource ? ` to ${resource}` : ' to tools'}`,
            namespace: resource || 'mcp'
        };
    }
    /** Administrative access */
    static admin(resource) {
        return {
            required: resource ? [`${resource}:admin`] : ['admin'],
            description: `Administrative access${resource ? ` to ${resource}` : ''}`,
            namespace: resource || 'system',
            privileged: true
        };
    }
    /** MCP tool access (list tools) */
    static mcpList() {
        return {
            anyOf: ['mcp:list', 'mcp:tools', 'mcp'],
            description: 'List available MCP tools',
            namespace: 'mcp'
        };
    }
    /** MCP tool execution */
    static mcpCall() {
        return {
            anyOf: ['mcp:call', 'mcp:tools', 'mcp'],
            description: 'Execute MCP tools',
            namespace: 'mcp'
        };
    }
    /** Public tool (no authentication required) */
    static public() {
        return {
            description: 'Public access - no authentication required'
        };
    }
    /** AI service access */
    static ai(action = 'execute') {
        return {
            required: [`ai:${action}`],
            description: `AI service ${action} access`,
            namespace: 'ai'
        };
    }
    /** User profile access */
    static profile(action = 'read') {
        return {
            required: [`profile:${action}`],
            description: `Profile ${action} access`,
            namespace: 'profile'
        };
    }
    /** Billing/subscription access */
    static billing(action = 'read') {
        return {
            required: [`billing:${action}`],
            description: `Billing ${action} access`,
            namespace: 'billing'
        };
    }
    /** System health and status */
    static system(action = 'read') {
        return {
            required: [`system:${action}`],
            description: `System ${action} access`,
            namespace: 'system',
            privileged: action === 'admin'
        };
    }
    /** Custom scope requirement */
    static custom(scopes, description, options) {
        return {
            ...(options?.anyOf ? { anyOf: scopes } : { required: scopes }),
            description,
            namespace: options?.namespace,
            privileged: options?.privileged
        };
    }
}
/**
 * Scope Validation and Checking
 */
export class ScopeValidator {
    /**
     * Check if user scopes satisfy the requirement
     */
    static hasScope(userScopes, requirement) {
        // Public access - no scopes required
        if (!requirement.required && !requirement.anyOf) {
            return true;
        }
        // Expand user scopes to include hierarchical scopes
        const expandedUserScopes = ScopeValidator.expandScopes(userScopes);
        // Check required scopes (ALL must be present)
        if (requirement.required) {
            const hasAllRequired = requirement.required.every(scope => expandedUserScopes.includes(scope));
            if (!hasAllRequired) {
                return false;
            }
        }
        // Check anyOf scopes (AT LEAST ONE must be present)
        if (requirement.anyOf) {
            const hasAnyOf = requirement.anyOf.some(scope => expandedUserScopes.includes(scope));
            if (!hasAnyOf) {
                return false;
            }
        }
        return true;
    }
    /**
     * Check if a scope pattern matches a user scope (supports wildcards)
     */
    static matchesPattern(userScope, pattern) {
        // Exact match
        if (userScope === pattern) {
            return true;
        }
        // Wildcard support (e.g., "mcp:*" matches "mcp:call", "mcp:list")
        if (pattern.endsWith(':*')) {
            const prefix = pattern.slice(0, -2);
            return userScope.startsWith(`${prefix}:`);
        }
        // Hierarchical scope support (e.g., "admin" grants "user", "write" grants "read")
        const hierarchies = {
            'admin': ['user', 'read', 'write'],
            'write': ['read'],
            'mcp': ['mcp:list', 'mcp:call', 'mcp:tools'],
            'mcp:tools': ['mcp:list', 'mcp:call'],
            'ai:admin': ['ai:execute', 'ai:configure', 'ai:read'],
            'ai:configure': ['ai:read'],
            'system:admin': ['system:read', 'system:health']
        };
        if (hierarchies[userScope]) {
            return hierarchies[userScope].includes(pattern);
        }
        return false;
    }
    /**
     * Get missing scopes for a requirement
     */
    static getMissingScopes(userScopes, requirement) {
        if (this.hasScope(userScopes, requirement)) {
            return { missing: [], type: 'none' };
        }
        // Expand user scopes to include hierarchical scopes
        const expandedUserScopes = ScopeValidator.expandScopes(userScopes);
        // Check which required scopes are missing
        if (requirement.required) {
            const missing = requirement.required.filter(scope => !expandedUserScopes.some(userScope => this.matchesPattern(userScope, scope)));
            if (missing.length > 0) {
                return { missing, type: 'required' };
            }
        }
        // Check if anyOf requirements are not met
        if (requirement.anyOf) {
            const hasAny = requirement.anyOf.some(scope => expandedUserScopes.some(userScope => this.matchesPattern(userScope, scope)));
            if (!hasAny) {
                return { missing: requirement.anyOf, type: 'anyOf' };
            }
        }
        return { missing: [], type: 'none' };
    }
    /**
     * Filter tools based on user scopes
     */
    static filterToolsByScope(tools, userScopes) {
        return tools.filter(tool => {
            if (!tool.scopes) {
                return true; // No scope requirement = public access
            }
            return this.hasScope(userScopes, tool.scopes);
        });
    }
    /**
     * Get effective scopes after applying hierarchy rules
     */
    static expandScopes(userScopes) {
        const expanded = new Set(userScopes);
        for (const scope of userScopes) {
            // Add hierarchical permissions
            if (scope === 'admin') {
                expanded.add('user').add('read').add('write');
            }
            else if (scope === 'write') {
                expanded.add('read');
            }
            else if (scope === 'mcp') {
                expanded.add('mcp:list').add('mcp:call').add('mcp:tools');
            }
            else if (scope === 'mcp:tools') {
                expanded.add('mcp:list').add('mcp:call');
            }
            // Add more hierarchies as needed
        }
        return Array.from(expanded);
    }
}
/**
 * Default scope configurations for common use cases
 */
export const DefaultScopes = {
    // Public tools - no authentication
    PUBLIC: ScopeHelpers.public(),
    // Basic MCP access
    MCP_LIST: ScopeHelpers.mcpList(),
    MCP_CALL: ScopeHelpers.mcpCall(),
    // AI service access
    AI_EXECUTE: ScopeHelpers.ai('execute'),
    AI_CONFIGURE: ScopeHelpers.ai('configure'),
    AI_READ: ScopeHelpers.ai('read'),
    // System access
    SYSTEM_READ: ScopeHelpers.system('read'),
    SYSTEM_ADMIN: ScopeHelpers.system('admin'),
    // User data access
    PROFILE_READ: ScopeHelpers.profile('read'),
    PROFILE_WRITE: ScopeHelpers.profile('write'),
    BILLING_READ: ScopeHelpers.billing('read'),
    BILLING_WRITE: ScopeHelpers.billing('write'),
    // Administrative access
    ADMIN: ScopeHelpers.admin(),
    USER: ScopeHelpers.custom(['user'], 'Standard user access'),
    READ_ONLY: ScopeHelpers.read(),
};
/**
 * Utility function to create MCP metadata with scopes
 */
export function createMCPTool(config) {
    return {
        mcp: {
            ...config,
            // If marked as public, ensure no scope requirements
            ...(config.public && { scopes: DefaultScopes.PUBLIC })
        }
    };
}
