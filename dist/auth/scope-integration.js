/**
 * Scope Integration Layer for RPC AI Server
 *
 * Provides seamless integration between the configurable scope system
 * and the existing RPC server infrastructure.
 */
import { ConfigurableScopeManager, DefaultScopeConfigurations } from './configurable-scopes.js';
import { ScopeHelpers } from './scopes.js';
/**
 * Scope Integration Manager
 * Bridges the configurable scope system with the RPC server
 */
export class ScopeIntegrationManager {
    scopeManager;
    config;
    enabled;
    constructor(config = {}) {
        this.config = config;
        this.enabled = config.enabled !== false; // Default to enabled
        if (this.enabled) {
            this.initializeScopeManager();
        }
    }
    /**
     * Initialize the configurable scope manager
     */
    initializeScopeManager() {
        let finalConfig = {};
        // Start with preset if specified
        if (this.config.preset) {
            const presetConfig = DefaultScopeConfigurations[this.config.preset]();
            finalConfig = { ...presetConfig };
        }
        // Merge with custom config
        if (this.config.custom) {
            finalConfig = this.mergeConfigs(finalConfig, this.config.custom);
        }
        // Set fallback option
        finalConfig.allowFallback = this.config.fallbackToDefault !== false;
        this.scopeManager = new ConfigurableScopeManager(finalConfig);
    }
    /**
     * Merge two scope configurations
     */
    mergeConfigs(base, custom) {
        return {
            ...base,
            ...custom,
            customScopes: [
                ...(base.customScopes || []),
                ...(custom.customScopes || [])
            ],
            scopeOverrides: {
                ...base.scopeOverrides,
                ...custom.scopeOverrides
            },
            toolOverrides: [
                ...(base.toolOverrides || []),
                ...(custom.toolOverrides || [])
            ]
        };
    }
    /**
     * Get scope requirements for a tool (with fallback to default)
     */
    getToolScopes(toolName, defaultScopes) {
        if (!this.enabled || !this.scopeManager) {
            return defaultScopes;
        }
        try {
            return this.scopeManager.getToolScopes(toolName, defaultScopes);
        }
        catch (error) {
            console.warn(`Failed to get custom scopes for tool ${toolName}:`, error);
            return this.config.fallbackToDefault !== false ? defaultScopes : undefined;
        }
    }
    /**
     * Validate user scopes (with fallback to default validation)
     */
    validateScopes(userScopes, requiredScopes, context) {
        if (!this.enabled || !this.scopeManager) {
            // Fallback to default validation
            return this.defaultValidateScopes(userScopes, requiredScopes, context);
        }
        try {
            return this.scopeManager.validateScopes(userScopes, requiredScopes, context);
        }
        catch (error) {
            console.warn('Custom scope validation failed:', error);
            return this.config.fallbackToDefault !== false
                ? this.defaultValidateScopes(userScopes, requiredScopes, context)
                : false;
        }
    }
    /**
     * Default scope validation (fallback)
     */
    defaultValidateScopes(userScopes, requiredScopes, context) {
        const { ScopeValidator } = require('./scopes.js');
        return ScopeValidator.hasScope(userScopes, requiredScopes, context);
    }
    /**
     * Get default scopes for user type
     */
    getDefaultScopes(userType) {
        if (!this.enabled || !this.scopeManager) {
            // Return hardcoded defaults
            switch (userType) {
                case 'unauthenticated': return [];
                case 'authenticated': return ['read', 'mcp:list'];
                case 'admin': return ['admin', 'mcp', 'mcp:call', 'mcp:list'];
                default: return [];
            }
        }
        return this.scopeManager.getDefaultScopes(userType);
    }
    /**
     * Create MCP tool with configurable scopes
     */
    createMCPTool(toolName, config) {
        if (!this.enabled || !this.scopeManager) {
            // Fallback to default creation
            const { createMCPTool } = require('./scopes.js');
            return createMCPTool(config);
        }
        return this.scopeManager.createMCPTool({ ...config, toolName });
    }
    /**
     * Create admin MCP tool with configurable scopes
     */
    createAdminMCPTool(toolName, config) {
        if (!this.enabled || !this.scopeManager) {
            // Fallback to default creation
            const { createAdminMCPTool } = require('./scopes.js');
            return createAdminMCPTool(config);
        }
        return this.scopeManager.createAdminMCPTool({ ...config, toolName });
    }
    /**
     * Add custom scope at runtime
     */
    addCustomScope(scope) {
        if (this.enabled && this.scopeManager) {
            this.scopeManager.addCustomScope(scope);
        }
    }
    /**
     * Override tool scopes at runtime
     */
    overrideToolScopes(toolName, scopes) {
        if (this.enabled && this.scopeManager) {
            this.scopeManager.overrideToolScopes(toolName, scopes);
        }
    }
    /**
     * Get all available scopes
     */
    getAllScopes() {
        if (!this.enabled || !this.scopeManager) {
            const { DefaultScopes } = require('./scopes.js');
            return DefaultScopes;
        }
        return this.scopeManager.getAllScopes();
    }
    /**
     * Check if configurable scopes are enabled
     */
    isEnabled() {
        return this.enabled && !!this.scopeManager;
    }
    /**
     * Get the underlying scope manager (for advanced usage)
     */
    getScopeManager() {
        return this.scopeManager;
    }
}
/**
 * Scope helper factory that uses configurable scopes
 */
export class ConfigurableScopeHelpers {
    integrationManager;
    constructor(integrationManager) {
        this.integrationManager = integrationManager;
    }
    /**
     * Create MCP call scope (configurable)
     */
    mcpCall(toolName) {
        const defaultScope = ScopeHelpers.mcpCall();
        return toolName
            ? this.integrationManager.getToolScopes(toolName, defaultScope) || defaultScope
            : defaultScope;
    }
    /**
     * Create MCP list scope (configurable)
     */
    mcpList(toolName) {
        const defaultScope = ScopeHelpers.mcpList();
        return toolName
            ? this.integrationManager.getToolScopes(toolName, defaultScope) || defaultScope
            : defaultScope;
    }
    /**
     * Create admin scope (configurable)
     */
    admin(toolName) {
        const defaultScope = ScopeHelpers.admin();
        return toolName
            ? this.integrationManager.getToolScopes(toolName, defaultScope) || defaultScope
            : defaultScope;
    }
    /**
     * Create system scope (configurable)
     */
    system(action, toolName) {
        const defaultScope = ScopeHelpers.system(action);
        return toolName
            ? this.integrationManager.getToolScopes(toolName, defaultScope) || defaultScope
            : defaultScope;
    }
    /**
     * Create custom scope (configurable)
     */
    custom(scopes, description, toolName) {
        const defaultScope = ScopeHelpers.custom(scopes, description);
        return toolName
            ? this.integrationManager.getToolScopes(toolName, defaultScope) || defaultScope
            : defaultScope;
    }
    /**
     * Create public scope (no authentication required)
     */
    public() {
        return ScopeHelpers.public();
    }
}
/**
 * Global scope integration instance
 */
let globalScopeIntegration;
/**
 * Initialize global scope integration
 */
export function initializeScopeIntegration(config) {
    globalScopeIntegration = new ScopeIntegrationManager(config);
    return globalScopeIntegration;
}
/**
 * Get the global scope integration instance
 */
export function getScopeIntegration() {
    if (!globalScopeIntegration) {
        globalScopeIntegration = new ScopeIntegrationManager();
    }
    return globalScopeIntegration;
}
/**
 * Get configurable scope helpers
 */
export function getConfigurableScopeHelpers() {
    return new ConfigurableScopeHelpers(getScopeIntegration());
}
/**
 * Utility function to create scope requirements with configuration support
 */
export function createScopeRequirement(toolName, defaultScopes, options) {
    const integration = getScopeIntegration();
    const defaultRequirement = {
        required: defaultScopes,
        description: options?.description,
        privileged: options?.privileged,
        requireAdminUser: options?.requireAdminUser,
        ...(options?.adminUsers && { adminUsers: options.adminUsers })
    };
    return integration.getToolScopes(toolName, defaultRequirement) || defaultRequirement;
}
