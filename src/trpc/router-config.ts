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

  /**
   * Namespace whitelist for filtering tools/methods
   * If specified, only tools from these namespaces will be included
   */
  namespaceWhitelist?: string[];
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

  // Namespace whitelist configuration
  if (process.env.TRPC_GEN_NAMESPACE_WHITELIST !== undefined) {
    const whitelist = process.env.TRPC_GEN_NAMESPACE_WHITELIST
      .split(',')
      .map(ns => ns.trim())
      .filter(ns => ns.length > 0);
    config.namespaceWhitelist = whitelist;
  }

  return config;
}

/**
 * Create a router for tRPC method generation with configuration filtering
 */
export async function createRouterForGeneration(config?: TRPCGenerationConfig): Promise<any> {
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
    enabled: true,
    ai: {
      enabled: generationConfig.mcp?.ai?.enabled ?? true,
      useServerConfig: true,
      restrictToSampling: true,
      allowByokOverride: false
    }
  } : {
    enabled: false,
    ai: {
      enabled: false
    }
  };

  // Create AI configuration
  const aiConfig = includeAI ? {
    // Default AI configuration
  } : undefined;

  const aiStatus = includeAI ? 'enabled' : 'disabled';
  const mcpStatus = includeMCP ? 'enabled' : 'disabled';
  const mcpAiStatus = includeMCP && generationConfig.mcp?.ai
    ? (generationConfig.mcp.ai.enabled ? 'AI tools enabled' : 'AI tools disabled')
    : null;
  console.log(`🔧 tRPC generation – AI ${aiStatus}, MCP ${mcpStatus}${mcpAiStatus ? ` (${mcpAiStatus})` : ''}`);

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
      aiService: null, // No shared AI service for generation
      namespaceWhitelist: generationConfig.namespaceWhitelist
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

  // Check for custom routers from consumer projects or examples
  // Only load custom routers if TRPC_GEN_CUSTOM_ROUTERS is set
  let customRouters = {};

  // Allow explicit path via environment variable
  const customRoutersPath = process.env.TRPC_GEN_CUSTOM_ROUTERS;

  if (customRoutersPath) {
    try {
      // Convert to absolute path if relative
      const { resolve } = await import('path');
      const { fileURLToPath } = await import('url');
      const absolutePath = customRoutersPath.startsWith('/') || customRoutersPath.startsWith('file://')
        ? customRoutersPath
        : resolve(process.cwd(), customRoutersPath);

      // Try to load from explicit path
      const consumerModule = await import(absolutePath);
      if (consumerModule.getCustomRouters && typeof consumerModule.getCustomRouters === 'function') {
        customRouters = consumerModule.getCustomRouters();
        console.log(`✅ Found custom routers: ${Object.keys(customRouters).join(', ')}`);
      } else {
        // Not an error - server files don't export getCustomRouters()
        // They're only used for config extraction in generate-trpc-methods.js
        console.log(`ℹ️  Path provided for config extraction (no custom routers exported): ${customRoutersPath}`);
      }
    } catch (error) {
      // Only warn if it looks like a custom routers module (has getCustomRouters in the file)
      console.log(`ℹ️  Could not import custom routers from ${customRoutersPath} (this is normal for server config files)`);
    }
  } else {
    // Base build mode - no custom routers
    // This ensures the package only includes core routers
    console.log(`ℹ️  Base build mode - no custom routers (set TRPC_GEN_CUSTOM_ROUTERS to include examples)`);
  }

  // Merge base routers with custom routers
  const allRouters = { ...baseRouters, ...customRouters };
  const generatedRouter = router(allRouters);
  return generatedRouter;
}
