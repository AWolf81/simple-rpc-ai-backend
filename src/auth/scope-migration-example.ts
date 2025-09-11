/**
 * Scope Migration Example
 * 
 * Shows how to migrate from hardcoded scopes to configurable scopes
 * in the RPC AI Server
 */

import { initializeScopeIntegration, getConfigurableScopeHelpers, createScopeRequirement } from './scope-integration';
import { ExampleScopeConfigurations } from './server-scope-config';
import type { ServerScopeConfig } from './scope-integration';

/**
 * BEFORE: Hardcoded scopes in tRPC procedures
 */
export const beforeMigrationExample = {
  // Old way - hardcoded in tRPC router
  greetingProcedure: `
    .meta({
      mcp: {
        name: 'greeting',
        description: 'Generate a greeting',
        scopes: ScopeHelpers.public() // Hardcoded
      }
    })
  `,

  echoProcedure: `
    .meta({
      mcp: {
        name: 'echo',
        description: 'Echo a message',
        scopes: ScopeHelpers.mcpCall() // Hardcoded
      }
    })
  `,

  systemInfoProcedure: `
    .meta({
      mcp: {
        name: 'system_info',
        description: 'Get system information',
        scopes: ScopeHelpers.system('read') // Hardcoded
      }
    })
  `
};

/**
 * AFTER: Configurable scopes
 */
export const afterMigrationExample = {
  // New way - configurable
  greetingProcedure: `
    .meta({
      mcp: {
        name: 'greeting',
        description: 'Generate a greeting',
        scopes: createScopeRequirement('greeting', [], { description: 'Public greeting tool' })
      }
    })
  `,

  echoProcedure: `
    .meta({
      mcp: {
        name: 'echo',
        description: 'Echo a message',
        scopes: createScopeRequirement('echo', ['mcp:call'], { description: 'Echo tool access' })
      }
    })
  `,

  systemInfoProcedure: `
    .meta({
      mcp: {
        name: 'system_info',
        description: 'Get system information',
        scopes: createScopeRequirement('system_info', ['system:read'], { 
          description: 'System information access',
          privileged: true 
        })
      }
    })
  `
};

/**
 * Example: Server initialization with configurable scopes
 */
export function initializeServerWithConfigurableScopes(config?: ServerScopeConfig) {
  // Initialize the scope system
  const scopeIntegration = initializeScopeIntegration(config);
  
  console.log('🔐 Scope system initialized:', {
    enabled: scopeIntegration.isEnabled(),
    availableScopes: Object.keys(scopeIntegration.getAllScopes())
  });

  return scopeIntegration;
}

/**
 * Example: Runtime scope configuration
 */
export function configureRuntimeScopes() {
  const scopeIntegration = initializeScopeIntegration();

  // Add custom scopes at runtime
  scopeIntegration.addCustomScope({
    name: 'custom:analytics',
    description: 'Analytics access',
    includes: ['read'],
    privileged: false
  });

  // Override specific tool scopes
  scopeIntegration.overrideToolScopes('greeting', {
    required: [], // Make greeting public
    description: 'Public greeting tool'
  });

  scopeIntegration.overrideToolScopes('system_info', {
    required: ['admin'],
    requireAdminUser: true,
    adminUsers: ['admin@company.com'],
    description: 'Admin-only system information'
  });

  console.log('🔧 Runtime scope configuration applied');
}

/**
 * Example: Different deployment configurations
 */
export const deploymentExamples = {
  /**
   * Development environment - permissive
   */
  development: () => initializeServerWithConfigurableScopes(
    ExampleScopeConfigurations.development()
  ),

  /**
   * Staging environment - production-like but with debugging
   */
  staging: () => initializeServerWithConfigurableScopes({
    preset: 'standard',
    custom: {
      customScopes: [
        {
          name: 'debug:access',
          description: 'Debug tool access',
          includes: ['read', 'mcp:list']
        }
      ],
      toolOverrides: [
        {
          toolName: 'system_info',
          scopes: { required: ['debug:access'] },
          replace: true
        }
      ],
      authenticatedUserScopes: ['read', 'mcp:list', 'debug:access']
    },
    enabled: true,
    fallbackToDefault: true
  }),

  /**
   * Production environment - secure
   */
  production: () => initializeServerWithConfigurableScopes(
    ExampleScopeConfigurations.production()
  ),

  /**
   * Enterprise environment - fine-grained
   */
  enterprise: () => initializeServerWithConfigurableScopes(
    ExampleScopeConfigurations.enterprise()
  )
};

/**
 * Example: Custom validation logic
 */
export function setupCustomValidation() {
  return initializeServerWithConfigurableScopes({
    custom: {
      customValidator: (userScopes, requiredScopes, context) => {
        // Custom business logic
        const user = context?.user;
        const tool = context?.tool;

        // Time-based access control
        const currentHour = new Date().getHours();
        if (requiredScopes.privileged && (currentHour < 9 || currentHour > 17)) {
          console.log('🕐 Privileged access denied outside business hours');
          return false;
        }

        // Department-based access control
        if (tool?.department && user?.department !== tool.department) {
          console.log('🏢 Cross-department access denied');
          return false;
        }

        // IP-based restrictions
        if (requiredScopes.requireAdminUser && !context?.request?.ip?.startsWith('192.168.')) {
          console.log('🌐 Admin access denied from external IP');
          return false;
        }

        // Standard scope validation
        const required = requiredScopes.required || [];
        return required.every(scope => userScopes.includes(scope));
      },
      allowFallback: true
    },
    enabled: true
  });
}

/**
 * Example: Multi-tenant setup
 */
export function setupMultiTenantScopes() {
  return initializeServerWithConfigurableScopes({
    custom: {
      customScopes: [
        {
          name: 'tenant:basic',
          description: 'Basic tenant access',
          includes: ['read', 'mcp:list']
        },
        {
          name: 'tenant:premium',
          description: 'Premium tenant access',
          includes: ['tenant:basic', 'mcp:call']
        },
        {
          name: 'tenant:enterprise',
          description: 'Enterprise tenant access',
          includes: ['tenant:premium', 'system:read']
        }
      ],
      customValidator: (userScopes, requiredScopes, context) => {
        const userTenant = context?.user?.tenantId;
        const toolTenant = context?.tool?.tenantId;

        // Enforce tenant isolation
        if (toolTenant && userTenant !== toolTenant) {
          return false;
        }

        // Check subscription level
        const userSubscription = context?.user?.subscription || 'basic';
        const requiredSubscription = context?.tool?.requiredSubscription || 'basic';

        const subscriptionLevels = ['basic', 'premium', 'enterprise'];
        const userLevel = subscriptionLevels.indexOf(userSubscription);
        const requiredLevel = subscriptionLevels.indexOf(requiredSubscription);

        if (userLevel < requiredLevel) {
          return false;
        }

        // Standard validation
        const required = requiredScopes.required || [];
        return required.every(scope => userScopes.includes(scope));
      }
    },
    enabled: true
  });
}

/**
 * Example: Migration helper for existing tools
 */
export function migrateExistingTools() {
  const scopeIntegration = initializeScopeIntegration();

  // Define migration mapping
  const toolMigrations = [
    {
      toolName: 'greeting',
      oldScopes: 'ScopeHelpers.public()',
      newScopes: { required: [] }
    },
    {
      toolName: 'echo',
      oldScopes: 'ScopeHelpers.mcpCall()',
      newScopes: { required: ['mcp:call'] }
    },
    {
      toolName: 'system_info',
      oldScopes: 'ScopeHelpers.system("read")',
      newScopes: { required: ['system:read'], privileged: true }
    },
    {
      toolName: 'admin_tool',
      oldScopes: 'ScopeHelpers.admin()',
      newScopes: { 
        required: ['admin'], 
        requireAdminUser: true,
        adminUsers: 'any'
      }
    }
  ];

  // Apply migrations
  for (const migration of toolMigrations) {
    scopeIntegration.overrideToolScopes(migration.toolName, migration.newScopes);
    console.log(`✅ Migrated ${migration.toolName}: ${migration.oldScopes} → ${JSON.stringify(migration.newScopes)}`);
  }

  return scopeIntegration;
}

/**
 * Example: Configuration validation and testing
 */
export function validateAndTestConfiguration(config: ServerScopeConfig) {
  const { validateScopeConfig } = require('./server-scope-config');
  
  // Validate configuration
  const validation = validateScopeConfig(config);
  if (!validation.valid) {
    console.error('❌ Invalid scope configuration:', validation.errors);
    return false;
  }

  // Test configuration
  const scopeIntegration = initializeServerWithConfigurableScopes(config);
  
  // Test scenarios
  const testCases = [
    {
      name: 'Unauthenticated user',
      userScopes: scopeIntegration.getDefaultScopes('unauthenticated'),
      tool: 'greeting'
    },
    {
      name: 'Authenticated user',
      userScopes: scopeIntegration.getDefaultScopes('authenticated'),
      tool: 'echo'
    },
    {
      name: 'Admin user',
      userScopes: scopeIntegration.getDefaultScopes('admin'),
      tool: 'system_info'
    }
  ];

  console.log('🧪 Testing scope configuration:');
  for (const testCase of testCases) {
    const toolScopes = scopeIntegration.getToolScopes(testCase.tool);
    const hasAccess = toolScopes 
      ? scopeIntegration.validateScopes(testCase.userScopes, toolScopes)
      : true;
    
    console.log(`  ${hasAccess ? '✅' : '❌'} ${testCase.name} → ${testCase.tool}: ${hasAccess ? 'ALLOWED' : 'DENIED'}`);
  }

  return true;
}

/**
 * Example usage in server startup
 */
export function exampleServerStartup() {
  console.log('🚀 Starting RPC AI Server with configurable scopes...');

  // Load configuration from environment or config file
  const environment = process.env.NODE_ENV || 'development';
  let scopeConfig: ServerScopeConfig;

  switch (environment) {
    case 'production':
      scopeConfig = ExampleScopeConfigurations.production();
      break;
    case 'enterprise':
      scopeConfig = ExampleScopeConfigurations.enterprise();
      break;
    case 'development':
    default:
      scopeConfig = ExampleScopeConfigurations.development();
      break;
  }

  // Validate and initialize
  if (validateAndTestConfiguration(scopeConfig)) {
    const scopeIntegration = initializeServerWithConfigurableScopes(scopeConfig);
    console.log('✅ Server started with configurable scopes');
    return scopeIntegration;
  } else {
    console.error('❌ Failed to start server due to invalid scope configuration');
    process.exit(1);
  }
}