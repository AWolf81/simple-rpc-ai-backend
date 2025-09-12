/**
 * Scope Integration Layer for RPC AI Server
 * 
 * Provides seamless integration between the configurable scope system
 * and the existing RPC server infrastructure.
 */

import { ConfigurableScopeManager, type ConfigurableScopeConfig, type ScopeConfigurationPreset, DefaultScopeConfigurations } from './configurable-scopes';
import { ScopeHelpers, type ScopeRequirement, type MCPToolScope } from './scopes';

/**
 * Server scope configuration
 */
export interface ServerScopeConfig {
  /** Use a preset configuration */
  preset?: ScopeConfigurationPreset;
  
  /** Custom configuration (merged with preset if both provided) */
  custom?: ConfigurableScopeConfig;
  
  /** Whether to enable the configurable scope system */
  enabled?: boolean;
  
  /** Fallback to default scopes if configurable system fails */
  fallbackToDefault?: boolean;
}

/**
 * Scope Integration Manager
 * Bridges the configurable scope system with the RPC server
 */
export class ScopeIntegrationManager {
  private scopeManager?: ConfigurableScopeManager;
  private config: ServerScopeConfig;
  private enabled: boolean;

  constructor(config: ServerScopeConfig = {}) {
    this.config = config;
    this.enabled = config.enabled !== false; // Default to enabled
    
    if (this.enabled) {
      this.initializeScopeManager();
    }
  }

  /**
   * Initialize the configurable scope manager
   */
  private initializeScopeManager(): void {
    let finalConfig: ConfigurableScopeConfig = {};

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
  private mergeConfigs(base: ConfigurableScopeConfig, custom: ConfigurableScopeConfig): ConfigurableScopeConfig {
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
  getToolScopes(toolName: string, defaultScopes?: ScopeRequirement): ScopeRequirement | undefined {
    if (!this.enabled || !this.scopeManager) {
      return defaultScopes;
    }

    try {
      return this.scopeManager.getToolScopes(toolName, defaultScopes);
    } catch (error) {
      console.warn(`Failed to get custom scopes for tool ${toolName}:`, error);
      return this.config.fallbackToDefault !== false ? defaultScopes : undefined;
    }
  }

  /**
   * Validate user scopes (with fallback to default validation)
   */
  validateScopes(userScopes: string[], requiredScopes: ScopeRequirement, context?: any): boolean {
    if (!this.enabled || !this.scopeManager) {
      // Fallback to default validation
      return this.defaultValidateScopes(userScopes, requiredScopes, context);
    }

    try {
      return this.scopeManager.validateScopes(userScopes, requiredScopes, context);
    } catch (error) {
      console.warn('Custom scope validation failed:', error);
      return this.config.fallbackToDefault !== false 
        ? this.defaultValidateScopes(userScopes, requiredScopes, context)
        : false;
    }
  }

  /**
   * Default scope validation (fallback)
   */
  private defaultValidateScopes(userScopes: string[], requiredScopes: ScopeRequirement, context?: any): boolean {
    const { ScopeValidator } = require('./scopes');
    return ScopeValidator.hasScope(userScopes, requiredScopes, context);
  }

  /**
   * Get default scopes for user type
   */
  getDefaultScopes(userType: 'unauthenticated' | 'authenticated' | 'admin'): string[] {
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
  createMCPTool(toolName: string, config: MCPToolScope): { mcp: MCPToolScope } {
    if (!this.enabled || !this.scopeManager) {
      // Fallback to default creation
      const { createMCPTool } = require('./scopes');
      return createMCPTool(config);
    }

    return this.scopeManager.createMCPTool({ ...config, toolName });
  }

  /**
   * Create admin MCP tool with configurable scopes
   */
  createAdminMCPTool(toolName: string, config: Omit<MCPToolScope, 'scopes'> & {
    adminUsers: string[] | 'any';
    baseScopes?: ScopeRequirement;
  }): { mcp: MCPToolScope } {
    if (!this.enabled || !this.scopeManager) {
      // Fallback to default creation
      const { createAdminMCPTool } = require('./scopes');
      return createAdminMCPTool(config);
    }

    return this.scopeManager.createAdminMCPTool({ ...config, toolName });
  }

  /**
   * Add custom scope at runtime
   */
  addCustomScope(scope: { name: string; description: string; includes?: string[]; privileged?: boolean }): void {
    if (this.enabled && this.scopeManager) {
      this.scopeManager.addCustomScope(scope);
    }
  }

  /**
   * Override tool scopes at runtime
   */
  overrideToolScopes(toolName: string, scopes: ScopeRequirement): void {
    if (this.enabled && this.scopeManager) {
      this.scopeManager.overrideToolScopes(toolName, scopes);
    }
  }

  /**
   * Get all available scopes
   */
  getAllScopes(): Record<string, ScopeRequirement> {
    if (!this.enabled || !this.scopeManager) {
      const { DefaultScopes } = require('./scopes');
      return DefaultScopes;
    }

    return this.scopeManager.getAllScopes();
  }

  /**
   * Check if configurable scopes are enabled
   */
  isEnabled(): boolean {
    return this.enabled && !!this.scopeManager;
  }

  /**
   * Get the underlying scope manager (for advanced usage)
   */
  getScopeManager(): ConfigurableScopeManager | undefined {
    return this.scopeManager;
  }
}

/**
 * Scope helper factory that uses configurable scopes
 */
export class ConfigurableScopeHelpers {
  constructor(private integrationManager: ScopeIntegrationManager) {}

  /**
   * Create MCP call scope (configurable)
   */
  mcpCall(toolName?: string): ScopeRequirement {
    const defaultScope = ScopeHelpers.mcpCall();
    return toolName 
      ? this.integrationManager.getToolScopes(toolName, defaultScope) || defaultScope
      : defaultScope;
  }

  /**
   * Create MCP list scope (configurable)
   */
  mcpList(toolName?: string): ScopeRequirement {
    const defaultScope = ScopeHelpers.mcpList();
    return toolName 
      ? this.integrationManager.getToolScopes(toolName, defaultScope) || defaultScope
      : defaultScope;
  }

  /**
   * Create admin scope (configurable)
   */
  admin(toolName?: string): ScopeRequirement {
    const defaultScope = ScopeHelpers.admin();
    return toolName 
      ? this.integrationManager.getToolScopes(toolName, defaultScope) || defaultScope
      : defaultScope;
  }

  /**
   * Create system scope (configurable)
   */
  system(action: 'read' | 'admin', toolName?: string): ScopeRequirement {
    const defaultScope = ScopeHelpers.system(action);
    return toolName 
      ? this.integrationManager.getToolScopes(toolName, defaultScope) || defaultScope
      : defaultScope;
  }

  /**
   * Create custom scope (configurable)
   */
  custom(scopes: string[], description?: string, toolName?: string): ScopeRequirement {
    const defaultScope = ScopeHelpers.custom(scopes, description);
    return toolName 
      ? this.integrationManager.getToolScopes(toolName, defaultScope) || defaultScope
      : defaultScope;
  }

  /**
   * Create public scope (no authentication required)
   */
  public(): ScopeRequirement {
    return ScopeHelpers.public();
  }
}

/**
 * Global scope integration instance
 */
let globalScopeIntegration: ScopeIntegrationManager | undefined;

/**
 * Initialize global scope integration
 */
export function initializeScopeIntegration(config?: ServerScopeConfig): ScopeIntegrationManager {
  globalScopeIntegration = new ScopeIntegrationManager(config);
  return globalScopeIntegration;
}

/**
 * Get the global scope integration instance
 */
export function getScopeIntegration(): ScopeIntegrationManager {
  if (!globalScopeIntegration) {
    globalScopeIntegration = new ScopeIntegrationManager();
  }
  return globalScopeIntegration;
}

/**
 * Get configurable scope helpers
 */
export function getConfigurableScopeHelpers(): ConfigurableScopeHelpers {
  return new ConfigurableScopeHelpers(getScopeIntegration());
}

/**
 * Utility function to create scope requirements with configuration support
 */
export function createScopeRequirement(
  toolName: string,
  defaultScopes: string[],
  options?: {
    description?: string;
    privileged?: boolean;
    requireAdminUser?: boolean;
    adminUsers?: string[] | 'any';
  }
): ScopeRequirement {
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