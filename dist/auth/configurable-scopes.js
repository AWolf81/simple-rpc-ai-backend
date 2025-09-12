/**
 * Configurable Scope System for RPC AI Server
 *
 * Provides extensible and replaceable scope management that allows users to:
 * - Override default scopes
 * - Add custom scopes
 * - Configure tool-specific scope requirements
 * - Replace the entire scope system
 */
import { ScopeHelpers, ScopeValidator, DefaultScopes } from './scopes.js';
/**
 * Configurable Scope Manager
 * Manages custom and default scopes with extensibility
 */
export class ConfigurableScopeManager {
    config;
    customScopes = new Map();
    scopeOverrides = new Map();
    toolOverrides = new Map();
    scopeHelpers;
    scopeValidator;
    constructor(config = {}) {
        this.config = config;
        this.scopeHelpers = ScopeHelpers;
        this.scopeValidator = ScopeValidator;
        this.initializeCustomScopes();
        this.initializeScopeOverrides();
        this.initializeToolOverrides();
    }
    /**
     * Initialize custom scope definitions
     */
    initializeCustomScopes() {
        if (this.config.customScopes) {
            for (const scope of this.config.customScopes) {
                this.customScopes.set(scope.name, scope);
            }
        }
    }
    /**
     * Initialize scope overrides
     */
    initializeScopeOverrides() {
        if (this.config.scopeOverrides) {
            for (const [scopeName, requirement] of Object.entries(this.config.scopeOverrides)) {
                this.scopeOverrides.set(scopeName, requirement);
            }
        }
    }
    /**
     * Initialize tool-specific scope overrides
     */
    initializeToolOverrides() {
        if (this.config.toolOverrides) {
            for (const override of this.config.toolOverrides) {
                this.toolOverrides.set(override.toolName, override.scopes);
            }
        }
    }
    /**
     * Get scope requirements for a specific tool
     */
    getToolScopes(toolName, defaultScopes) {
        // Check for tool-specific overrides first
        if (this.toolOverrides.has(toolName)) {
            return this.toolOverrides.get(toolName);
        }
        // Check for scope overrides by scope name
        if (defaultScopes && typeof defaultScopes === 'object' && 'required' in defaultScopes) {
            const scopeName = defaultScopes.required?.[0];
            if (scopeName && this.scopeOverrides.has(scopeName)) {
                return this.scopeOverrides.get(scopeName);
            }
        }
        // Return default scopes
        return defaultScopes;
    }
    /**
     * Validate user scopes against requirements
     */
    validateScopes(userScopes, requiredScopes, context) {
        // Use custom validator if provided
        if (this.config.customValidator) {
            try {
                return this.config.customValidator(userScopes, requiredScopes, context);
            }
            catch (error) {
                console.warn('Custom scope validator failed:', error);
                if (!this.config.allowFallback) {
                    return false;
                }
            }
        }
        // Expand user scopes to include custom scope hierarchies
        const expandedUserScopes = this.expandUserScopes(userScopes);
        // Use default validation with expanded scopes
        return this.scopeValidator.hasScope(expandedUserScopes, requiredScopes, context);
    }
    /**
     * Expand user scopes to include custom scope hierarchies
     */
    expandUserScopes(userScopes) {
        const expanded = new Set(userScopes);
        for (const scope of userScopes) {
            const customScope = this.customScopes.get(scope);
            if (customScope && customScope.includes) {
                for (const includedScope of customScope.includes) {
                    expanded.add(includedScope);
                }
            }
        }
        return Array.from(expanded);
    }
    /**
     * Get default scopes for user type
     */
    getDefaultScopes(userType) {
        switch (userType) {
            case 'unauthenticated':
                return this.config.defaultUserScopes || [];
            case 'authenticated':
                return this.config.authenticatedUserScopes || ['read', 'mcp:list'];
            case 'admin':
                return this.config.adminScopes || ['admin', 'mcp', 'mcp:call', 'mcp:list'];
            default:
                return [];
        }
    }
    /**
     * Create a scope requirement using the configurable system
     */
    createScopeRequirement(scopeNames, options) {
        return {
            required: scopeNames,
            description: options?.description,
            privileged: options?.privileged,
            requireAdminUser: options?.requireAdminUser,
            ...(options?.adminUsers && { adminUsers: options.adminUsers })
        };
    }
    /**
     * Add a custom scope definition at runtime
     */
    addCustomScope(scope) {
        this.customScopes.set(scope.name, scope);
    }
    /**
     * Override a tool's scope requirements at runtime
     */
    overrideToolScopes(toolName, scopes) {
        this.toolOverrides.set(toolName, scopes);
    }
    /**
     * Get all available scopes (default + custom)
     */
    getAllScopes() {
        const allScopes = { ...DefaultScopes };
        // Add custom scopes
        for (const [name, definition] of this.customScopes) {
            allScopes[name] = {
                required: [name],
                description: definition.description,
                privileged: definition.privileged
            };
        }
        // Apply overrides
        for (const [name, requirement] of this.scopeOverrides) {
            allScopes[name] = requirement;
        }
        return allScopes;
    }
    /**
     * Create MCP tool with configurable scopes
     */
    createMCPTool(config) {
        const toolScopes = config.toolName
            ? this.getToolScopes(config.toolName, config.scopes)
            : config.scopes;
        return {
            mcp: {
                ...config,
                scopes: toolScopes
            }
        };
    }
    /**
     * Create admin MCP tool with configurable scopes
     */
    createAdminMCPTool(config) {
        const { adminUsers, baseScopes, toolName, ...toolConfig } = config;
        // Get base scopes (custom or default)
        const effectiveBaseScopes = toolName
            ? this.getToolScopes(toolName, baseScopes) || this.scopeHelpers.mcpCall()
            : baseScopes || this.scopeHelpers.mcpCall();
        const adminScopeRequirement = {
            ...effectiveBaseScopes,
            adminUsers,
            requireAdminUser: true
        };
        return {
            mcp: {
                ...toolConfig,
                scopes: adminScopeRequirement,
                requireAdminUser: true
            }
        };
    }
}
/**
 * Factory function to create a configurable scope manager
 */
export function createConfigurableScopeManager(config) {
    return new ConfigurableScopeManager(config);
}
/**
 * Default scope configurations for common use cases
 */
export const DefaultScopeConfigurations = {
    /**
     * Minimal configuration - only basic MCP access
     */
    minimal: () => ({
        defaultUserScopes: [],
        authenticatedUserScopes: ['mcp:list'],
        adminScopes: ['admin', 'mcp'],
        allowFallback: true
    }),
    /**
     * Standard configuration - balanced permissions
     */
    standard: () => ({
        defaultUserScopes: [],
        authenticatedUserScopes: ['read', 'mcp:list'],
        adminScopes: ['admin', 'mcp', 'mcp:call', 'mcp:list'],
        allowFallback: true
    }),
    /**
     * Enterprise configuration - fine-grained permissions
     */
    enterprise: () => ({
        customScopes: [
            {
                name: 'enterprise:read',
                description: 'Enterprise read access',
                includes: ['read', 'mcp:list']
            },
            {
                name: 'enterprise:write',
                description: 'Enterprise write access',
                includes: ['write', 'mcp:call', 'enterprise:read']
            },
            {
                name: 'enterprise:admin',
                description: 'Enterprise admin access',
                includes: ['admin', 'enterprise:write'],
                privileged: true
            }
        ],
        defaultUserScopes: [],
        authenticatedUserScopes: ['enterprise:read'],
        adminScopes: ['enterprise:admin'],
        allowFallback: true
    }),
    /**
     * Custom API configuration - for external API integrations
     */
    apiIntegration: () => ({
        customScopes: [
            {
                name: 'api:read',
                description: 'API read access',
                includes: ['read']
            },
            {
                name: 'api:write',
                description: 'API write access',
                includes: ['write', 'api:read']
            },
            {
                name: 'api:admin',
                description: 'API admin access',
                includes: ['admin', 'api:write'],
                privileged: true
            }
        ],
        toolOverrides: [
            {
                toolName: 'greeting',
                scopes: { required: [] }, // Public tool
                replace: true
            }
        ],
        defaultUserScopes: ['api:read'],
        authenticatedUserScopes: ['api:read'],
        adminScopes: ['api:admin'],
        allowFallback: false
    })
};
