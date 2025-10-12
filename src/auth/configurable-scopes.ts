/**
 * Configurable Scope System for RPC AI Server
 * 
 * Provides extensible and replaceable scope management that allows users to:
 * - Override default scopes
 * - Add custom scopes
 * - Configure tool-specific scope requirements
 * - Replace the entire scope system
 */

import { ScopeHelpers, ScopeValidator, DefaultScopes, type ScopeRequirement, type MCPToolScope } from './scopes.js';

/**
 * Configuration for custom scope definitions
 */
export interface CustomScopeDefinition {
  /** Scope identifier (e.g., 'custom:read') */
  name: string;
  /** Human-readable description */
  description: string;
  /** Required parent scopes that this scope includes */
  includes?: string[];
  /** Whether this is a privileged scope requiring explicit consent */
  privileged?: boolean;
  /** Custom validation function */
  validator?: (userScopes: string[], context?: any) => boolean;
}

/**
 * Tool scope override configuration
 */
export interface ToolScopeOverride {
  /** Tool name to override */
  toolName: string;
  /** New scope requirements */
  scopes: ScopeRequirement;
  /** Whether to completely replace or merge with existing scopes */
  replace?: boolean;
}

/**
 * Configurable scope system configuration
 */
export interface ConfigurableScopeConfig {
  /** Custom scope definitions to add */
  customScopes?: CustomScopeDefinition[];
  
  /** Override default scope definitions */
  scopeOverrides?: Record<string, ScopeRequirement>;
  
  /** Tool-specific scope overrides */
  toolOverrides?: ToolScopeOverride[];
  
  /** Default scopes for unauthenticated users */
  defaultUserScopes?: string[];
  
  /** Default scopes for authenticated users */
  authenticatedUserScopes?: string[];
  
  /** Admin user scopes */
  adminScopes?: string[];
  
  /** Whether to allow fallback to default scopes if custom ones fail */
  allowFallback?: boolean;
  
  /** Custom scope validation function */
  customValidator?: (userScopes: string[], requiredScopes: ScopeRequirement, context?: any) => boolean;
}

/**
 * Configurable Scope Manager
 * Manages custom and default scopes with extensibility
 */
export class ConfigurableScopeManager {
  private config: ConfigurableScopeConfig;
  private customScopes: Map<string, CustomScopeDefinition> = new Map();
  private scopeOverrides: Map<string, ScopeRequirement> = new Map();
  private toolOverrides: Map<string, ScopeRequirement> = new Map();
  private scopeHelpers: typeof ScopeHelpers;
  private scopeValidator: typeof ScopeValidator;

  constructor(config: ConfigurableScopeConfig = {}) {
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
  private initializeCustomScopes(): void {
    if (this.config.customScopes) {
      for (const scope of this.config.customScopes) {
        this.customScopes.set(scope.name, scope);
      }
    }
  }

  /**
   * Initialize scope overrides
   */
  private initializeScopeOverrides(): void {
    if (this.config.scopeOverrides) {
      for (const [scopeName, requirement] of Object.entries(this.config.scopeOverrides)) {
        this.scopeOverrides.set(scopeName, requirement);
      }
    }
  }

  /**
   * Initialize tool-specific scope overrides
   */
  private initializeToolOverrides(): void {
    if (this.config.toolOverrides) {
      for (const override of this.config.toolOverrides) {
        this.toolOverrides.set(override.toolName, override.scopes);
      }
    }
  }

  /**
   * Get scope requirements for a specific tool
   */
  getToolScopes(toolName: string, defaultScopes?: ScopeRequirement): ScopeRequirement | undefined {
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
  validateScopes(userScopes: string[], requiredScopes: ScopeRequirement, context?: any): boolean {
    // Use custom validator if provided
    if (this.config.customValidator) {
      try {
        return this.config.customValidator(userScopes, requiredScopes, context);
      } catch (error) {
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
  private expandUserScopes(userScopes: string[]): string[] {
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
  getDefaultScopes(userType: 'unauthenticated' | 'authenticated' | 'admin'): string[] {
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
  createScopeRequirement(scopeNames: string[], options?: {
    description?: string;
    privileged?: boolean;
    requireAdminUser?: boolean;
    adminUsers?: string[] | 'any';
  }): ScopeRequirement {
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
  addCustomScope(scope: CustomScopeDefinition): void {
    this.customScopes.set(scope.name, scope);
  }

  /**
   * Override a tool's scope requirements at runtime
   */
  overrideToolScopes(toolName: string, scopes: ScopeRequirement): void {
    this.toolOverrides.set(toolName, scopes);
  }

  /**
   * Get all available scopes (default + custom)
   */
  getAllScopes(): Record<string, ScopeRequirement> {
    const allScopes: Record<string, ScopeRequirement> = { ...DefaultScopes };

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
  createMCPTool(config: MCPToolScope & { toolName?: string }): { mcp: MCPToolScope } {
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
  createAdminMCPTool(config: Omit<MCPToolScope, 'scopes'> & {
    toolName?: string;
    adminUsers: string[] | 'any';
    baseScopes?: ScopeRequirement;
  }): { mcp: MCPToolScope } {
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
export function createConfigurableScopeManager(config?: ConfigurableScopeConfig): ConfigurableScopeManager {
  return new ConfigurableScopeManager(config);
}

/**
 * Default scope configurations for common use cases
 */
export const DefaultScopeConfigurations = {
  /**
   * Minimal configuration - only basic MCP access
   */
  minimal: (): ConfigurableScopeConfig => ({
    defaultUserScopes: [],
    authenticatedUserScopes: ['mcp:list'],
    adminScopes: ['admin', 'mcp'],
    allowFallback: true
  }),

  /**
   * Standard configuration - balanced permissions
   */
  standard: (): ConfigurableScopeConfig => ({
    defaultUserScopes: [],
    authenticatedUserScopes: ['read', 'mcp:list'],
    adminScopes: ['admin', 'mcp', 'mcp:call', 'mcp:list'],
    allowFallback: true
  }),

  /**
   * Enterprise configuration - fine-grained permissions
   */
  enterprise: (): ConfigurableScopeConfig => ({
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
  apiIntegration: (): ConfigurableScopeConfig => ({
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

export type ScopeConfigurationPreset = keyof typeof DefaultScopeConfigurations;