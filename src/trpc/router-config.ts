/**
 * Router Configuration for tRPC Method Generation
 *
 * This file defines the configuration that controls which routers/methods
 * are included in the generated tRPC methods documentation.
 */

export interface TRPCGenerationConfig {
  /**
   * AI router configuration
   */
  ai?: {
    enabled: boolean;
    /** Include AI-related methods in generation */
    includeInGeneration?: boolean;
  };

  /**
   * MCP router configuration
   */
  mcp?: {
    enabled: boolean;
    /** Include MCP-related methods in generation */
    includeInGeneration?: boolean;
    ai?: {
      enabled: boolean;
      /** Include AI-powered MCP tools in generation */
      includeAIToolsInGeneration?: boolean;
    };
  };

  /**
   * Other routers that can be controlled
   */
  system?: {
    enabled: boolean;
    includeInGeneration?: boolean;
  };

  user?: {
    enabled: boolean;
    includeInGeneration?: boolean;
  };

  billing?: {
    enabled: boolean;
    includeInGeneration?: boolean;
  };

  auth?: {
    enabled: boolean;
    includeInGeneration?: boolean;
  };

  admin?: {
    enabled: boolean;
    includeInGeneration?: boolean;
  };
}

/**
 * Load configuration from environment variables or config files
 */
export function loadTRPCGenerationConfig(): TRPCGenerationConfig {
  // Start with default configuration
  const defaultConfig: TRPCGenerationConfig = {
    ai: {
      enabled: true,
      includeInGeneration: true,
    },
    mcp: {
      enabled: true,
      includeInGeneration: true,
      ai: {
        enabled: true,
        includeAIToolsInGeneration: true,
      },
    },
    system: {
      enabled: true,
      includeInGeneration: true,
    },
    user: {
      enabled: true,
      includeInGeneration: true,
    },
    billing: {
      enabled: true,
      includeInGeneration: true,
    },
    auth: {
      enabled: true,
      includeInGeneration: true,
    },
    admin: {
      enabled: true,
      includeInGeneration: true,
    },
  };

  // Override with environment variables if present
  const config = { ...defaultConfig };

  // AI configuration
  if (process.env.TRPC_GEN_AI_ENABLED !== undefined) {
    config.ai!.enabled = process.env.TRPC_GEN_AI_ENABLED === 'true';
    config.ai!.includeInGeneration = config.ai!.enabled;
  }

  // MCP configuration
  if (process.env.TRPC_GEN_MCP_ENABLED !== undefined) {
    config.mcp!.enabled = process.env.TRPC_GEN_MCP_ENABLED === 'true';
    config.mcp!.includeInGeneration = config.mcp!.enabled;
  }

  if (process.env.TRPC_GEN_MCP_AI_ENABLED !== undefined) {
    config.mcp!.ai!.enabled = process.env.TRPC_GEN_MCP_AI_ENABLED === 'true';
    config.mcp!.ai!.includeAIToolsInGeneration = config.mcp!.ai!.enabled;
  }

  // Other router configurations
  if (process.env.TRPC_GEN_SYSTEM_ENABLED !== undefined) {
    config.system!.enabled = process.env.TRPC_GEN_SYSTEM_ENABLED === 'true';
    config.system!.includeInGeneration = config.system!.enabled;
  }

  if (process.env.TRPC_GEN_USER_ENABLED !== undefined) {
    config.user!.enabled = process.env.TRPC_GEN_USER_ENABLED === 'true';
    config.user!.includeInGeneration = config.user!.enabled;
  }

  if (process.env.TRPC_GEN_BILLING_ENABLED !== undefined) {
    config.billing!.enabled = process.env.TRPC_GEN_BILLING_ENABLED === 'true';
    config.billing!.includeInGeneration = config.billing!.enabled;
  }

  if (process.env.TRPC_GEN_AUTH_ENABLED !== undefined) {
    config.auth!.enabled = process.env.TRPC_GEN_AUTH_ENABLED === 'true';
    config.auth!.includeInGeneration = config.auth!.enabled;
  }

  if (process.env.TRPC_GEN_ADMIN_ENABLED !== undefined) {
    config.admin!.enabled = process.env.TRPC_GEN_ADMIN_ENABLED === 'true';
    config.admin!.includeInGeneration = config.admin!.enabled;
  }

  return config;
}

/**
 * Create a router for tRPC method generation with configuration filtering
 */
export async function createRouterForGeneration(config?: TRPCGenerationConfig) {
  const generationConfig = config || loadTRPCGenerationConfig();

  // Import the createAppRouter function dynamically for ES modules
  const { createAppRouter } = await import('./root.js');

  // Create router configuration for generation
  const routerConfig: any = {};

  // Only include enabled routers in generation
  const includeAI = generationConfig.ai?.enabled && generationConfig.ai?.includeInGeneration;
  const includeMCP = generationConfig.mcp?.enabled && generationConfig.mcp?.includeInGeneration;

  // Create MCP configuration for router creation
  const mcpConfig = includeMCP ? {
    enableMCP: true,
    ai: {
      enabled: generationConfig.mcp?.ai?.enabled ?? true,
      useServerConfig: true,
      restrictToSampling: true,
      allowByokOverride: false
    }
  } : {
    enableMCP: false,
    ai: {
      enabled: false
    }
  };

  // Create AI configuration
  const aiConfig = includeAI ? {
    // Default AI configuration
  } : undefined;

  console.log(`🔧 tRPC Generation Config:`);
  console.log(`   AI: ${includeAI ? '✅ Enabled' : '❌ Disabled'}`);
  console.log(`   MCP: ${includeMCP ? '✅ Enabled' : '❌ Disabled'}`);
  if (includeMCP && generationConfig.mcp?.ai) {
    console.log(`   MCP AI Tools: ${generationConfig.mcp.ai.enabled ? '✅ Enabled' : '❌ Disabled'}`);
  }

  // Import router creation functions individually using relative paths
  const { router } = await import('./index.js');
  const { createMCPRouter } = await import('./routers/mcp/index.js');
  const { createSystemRouter } = await import('./routers/system/index.js');
  const { createUserRouter } = await import('./routers/user/index.js');
  const { createBillingRouter } = await import('./routers/billing/index.js');
  const { createAuthRouter } = await import('./routers/auth/index.js');
  const { createAdminRouter } = await import('./routers/admin/index.js');

  // Conditionally import AI router only if needed
  let aiRouter = null;
  if (includeAI) {
    const { createAIRouter } = await import('./routers/ai/index.js');
    aiRouter = createAIRouter({
      config: aiConfig,
      tokenTrackingEnabled: false,
      dbAdapter: undefined,
      serverProviders: ['anthropic'],
      byokProviders: ['anthropic'],
      postgresRPCMethods: undefined,
      modelRestrictions: undefined
    } as any);
  }

  // Create other routers
  const baseRouters: any = {};

  // Only include AI router if enabled
  if (includeAI && aiRouter) {
    baseRouters.ai = aiRouter;
  }

  // Only include MCP router if enabled
  if (includeMCP) {
    baseRouters.mcp = createMCPRouter({
      auth: (mcpConfig as any)?.auth || undefined, // Safe fallback for auth config
      ai: mcpConfig?.ai,
      aiService: null // No shared AI service for generation
    });
  }

  // Always include system router (contains system tools needed for basic operation)
  if (generationConfig.system?.enabled && generationConfig.system?.includeInGeneration) {
    baseRouters.system = createSystemRouter(undefined);
  }

  // Include other routers based on configuration
  if (generationConfig.user?.enabled && generationConfig.user?.includeInGeneration) {
    baseRouters.user = createUserRouter(null, null, null, includeAI ? ['anthropic'] : undefined);
  }

  if (generationConfig.billing?.enabled && generationConfig.billing?.includeInGeneration) {
    baseRouters.billing = createBillingRouter(null, null, null);
  }

  if (generationConfig.auth?.enabled && generationConfig.auth?.includeInGeneration) {
    baseRouters.auth = createAuthRouter(undefined);
  }

  if (generationConfig.admin?.enabled && generationConfig.admin?.includeInGeneration) {
    baseRouters.admin = createAdminRouter({
      adminUsers: ['admin@company.com'],
      requireAdminAuth: true,
      usageAnalyticsService: null,
      virtualTokenService: null
    });
  }

  const generatedRouter = router(baseRouters);
  return generatedRouter;
}