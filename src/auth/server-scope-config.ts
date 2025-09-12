/**
 * Server Scope Configuration
 * 
 * Configuration interface for integrating configurable scopes into the RPC AI Server
 */

import type { ServerScopeConfig } from './scope-integration';

/**
 * Extended server configuration with scope management
 */
export interface ServerConfigWithScopes {
  /**
   * Scope configuration for the server
   */
  scopes?: ServerScopeConfig;
}

/**
 * Example configurations for different use cases
 */
export const ExampleScopeConfigurations = {
  /**
   * Development configuration - permissive for testing
   */
  development: (): ServerScopeConfig => ({
    preset: 'minimal',
    custom: {
      defaultUserScopes: ['read'],
      authenticatedUserScopes: ['read', 'write', 'mcp:list', 'mcp:call'],
      adminScopes: ['admin'],
      allowFallback: true
    },
    enabled: true,
    fallbackToDefault: true
  }),

  /**
   * Production configuration - secure defaults
   */
  production: (): ServerScopeConfig => ({
    preset: 'standard',
    custom: {
      customScopes: [
        {
          name: 'prod:read',
          description: 'Production read access',
          includes: ['read']
        },
        {
          name: 'prod:write',
          description: 'Production write access',
          includes: ['write', 'prod:read'],
          privileged: true
        }
      ],
      defaultUserScopes: [],
      authenticatedUserScopes: ['prod:read', 'mcp:list'],
      adminScopes: ['admin', 'prod:write', 'mcp'],
      allowFallback: false
    },
    enabled: true,
    fallbackToDefault: false
  }),

  /**
   * Enterprise configuration - fine-grained control
   */
  enterprise: (): ServerScopeConfig => ({
    preset: 'enterprise',
    custom: {
      toolOverrides: [
        {
          toolName: 'greeting',
          scopes: { required: [] }, // Public
          replace: true
        },
        {
          toolName: 'echo',
          scopes: { required: ['enterprise:read'] },
          replace: true
        },
        {
          toolName: 'system_info',
          scopes: { 
            required: ['enterprise:admin'],
            requireAdminUser: true
          },
          replace: true
        }
      ],
      customValidator: (userScopes, requiredScopes, context) => {
        // Custom enterprise validation logic
        if (requiredScopes.requireAdminUser && context?.user?.role !== 'admin') {
          return false;
        }
        
        // Check if user has required scopes
        const required = requiredScopes.required || [];
        return required.every(scope => userScopes.includes(scope));
      }
    },
    enabled: true,
    fallbackToDefault: true
  }),

  /**
   * API-only configuration - for headless API usage
   */
  apiOnly: (): ServerScopeConfig => ({
    preset: 'apiIntegration',
    custom: {
      customScopes: [
        {
          name: 'api:tools',
          description: 'API tool access',
          includes: ['mcp:call', 'mcp:list']
        },
        {
          name: 'api:system',
          description: 'API system access',
          includes: ['system:read', 'api:tools'],
          privileged: true
        }
      ],
      toolOverrides: [
        {
          toolName: 'greeting',
          scopes: { required: [] },
          replace: true
        },
        {
          toolName: 'echo',
          scopes: { required: ['api:tools'] },
          replace: true
        },
        {
          toolName: 'system_info',
          scopes: { required: ['api:system'] },
          replace: true
        }
      ],
      defaultUserScopes: [],
      authenticatedUserScopes: ['api:tools'],
      adminScopes: ['api:system', 'admin']
    },
    enabled: true,
    fallbackToDefault: false
  }),

  /**
   * Multi-tenant configuration - tenant-specific scopes
   */
  multiTenant: (): ServerScopeConfig => ({
    custom: {
      customScopes: [
        {
          name: 'tenant:read',
          description: 'Tenant read access',
          includes: ['read']
        },
        {
          name: 'tenant:write',
          description: 'Tenant write access',
          includes: ['write', 'tenant:read']
        },
        {
          name: 'tenant:admin',
          description: 'Tenant admin access',
          includes: ['tenant:write', 'mcp'],
          privileged: true
        }
      ],
      customValidator: (userScopes, requiredScopes, context) => {
        // Multi-tenant validation
        const userTenant = context?.user?.tenantId;
        const requiredTenant = context?.tool?.tenantId;
        
        // Check tenant isolation
        if (requiredTenant && userTenant !== requiredTenant) {
          return false;
        }
        
        // Standard scope validation
        const required = requiredScopes.required || [];
        return required.every(scope => userScopes.includes(scope));
      },
      defaultUserScopes: [],
      authenticatedUserScopes: ['tenant:read'],
      adminScopes: ['tenant:admin']
    },
    enabled: true,
    fallbackToDefault: true
  }),

  /**
   * Disabled configuration - use default hardcoded scopes
   */
  disabled: (): ServerScopeConfig => ({
    enabled: false,
    fallbackToDefault: true
  })
};

/**
 * Configuration validation
 */
export function validateScopeConfig(config: ServerScopeConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check for conflicting settings
  if (config.enabled === false && config.preset) {
    errors.push('Cannot specify preset when scopes are disabled');
  }

  if (config.enabled === false && config.custom) {
    errors.push('Cannot specify custom config when scopes are disabled');
  }

  // Validate custom scopes
  if (config.custom?.customScopes) {
    for (const scope of config.custom.customScopes) {
      if (!scope.name || !scope.description) {
        errors.push(`Custom scope missing required fields: ${JSON.stringify(scope)}`);
      }
      
      if (scope.name.includes(' ')) {
        errors.push(`Custom scope name cannot contain spaces: ${scope.name}`);
      }
    }
  }

  // Validate tool overrides
  if (config.custom?.toolOverrides) {
    for (const override of config.custom.toolOverrides) {
      if (!override.toolName || !override.scopes) {
        errors.push(`Tool override missing required fields: ${JSON.stringify(override)}`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Helper to merge scope configurations
 */
export function mergeScopeConfigs(base: ServerScopeConfig, override: ServerScopeConfig): ServerScopeConfig {
  return {
    ...base,
    ...override,
    custom: base.custom || override.custom ? {
      ...base.custom,
      ...override.custom,
      customScopes: [
        ...(base.custom?.customScopes || []),
        ...(override.custom?.customScopes || [])
      ],
      scopeOverrides: {
        ...base.custom?.scopeOverrides,
        ...override.custom?.scopeOverrides
      },
      toolOverrides: [
        ...(base.custom?.toolOverrides || []),
        ...(override.custom?.toolOverrides || [])
      ]
    } : undefined
  };
}

/**
 * Environment-based configuration loader
 */
export function loadScopeConfigFromEnv(): ServerScopeConfig {
  const preset = process.env.SCOPE_PRESET as keyof typeof ExampleScopeConfigurations;
  const enabled = process.env.SCOPE_ENABLED !== 'false';
  const fallback = process.env.SCOPE_FALLBACK !== 'false';

  if (preset && ExampleScopeConfigurations[preset]) {
    return {
      ...ExampleScopeConfigurations[preset](),
      enabled,
      fallbackToDefault: fallback
    };
  }

  return {
    enabled,
    fallbackToDefault: fallback
  };
}

export type ScopeConfigurationExample = keyof typeof ExampleScopeConfigurations;