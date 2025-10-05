/**
 * Main tRPC App Router
 * 
 * Combines all sub-routers into the main application router.
 * This is the single source of truth for all tRPC procedures.
 */

import { router } from '@src-trpc/index';
import { createAIRouter } from '@src-trpc/routers/ai';
import type { AIRouterFactoryConfig } from '@src-trpc/routers/ai/types';
import { AIService } from '@services/ai/ai-service';
import { createServiceProvidersConfig, createMCPServiceProvidersConfig } from '@src-trpc/routers/ai/types';
import { createMCPRouter, MCPRouterConfig } from '@src-trpc/routers/mcp/index';
import { createSystemRouter } from '@src-trpc/routers/system';
import { createUserRouter } from '@src-trpc/routers/user';
import { createBillingRouter } from '@src-trpc/routers/billing';
import { createAuthRouter } from '@src-trpc/routers/auth';
import { createAdminRouter } from '@src-trpc/routers/admin';
import type { inferRouterInputs, inferRouterOutputs } from '@trpc/server';
import type { PostgreSQLAdapter } from '@database/postgres-adapter';
import type { PostgreSQLRPCMethods } from '@auth/PostgreSQLRPCMethods';
import { VirtualTokenService } from '@services/billing/virtual-token-service';
import { UsageAnalyticsService } from '@services/billing/usage-analytics-service';
import { WorkspaceManager } from '@services/resources/workspace-manager';
import type { WorkspaceManagerConfig, ServerWorkspaceConfig } from '@services/resources/workspace-manager';
import { logger } from '../utils/logger.js';


/**
 * Create app router with configurable AI limits and optional token tracking
 * NESTED VERSION with proper namespaces for better organization
 */
export function createAppRouter(
  aiConfig?: AIRouterFactoryConfig,
  tokenTrackingEnabled?: boolean,
  dbAdapter?: PostgreSQLAdapter,
  serverProviders?: string[],
  byokProviders?: string[],
  postgresRPCMethods?: PostgreSQLRPCMethods,
  mcpConfig?: MCPRouterConfig,
  modelRestrictions?: Record<string, {
    allowedModels?: string[];
    allowedPatterns?: string[];
    blockedModels?: string[];
  }>,
  serverWorkspaces?: {
    enabled?: boolean;
    defaultWorkspace?: {
      path?: string;
      readOnly?: boolean;
      allowedExtensions?: string[];
      blockedExtensions?: string[];
      maxFileSize?: number;
      allowedPaths?: string[];
      blockedPaths?: string[];
      followSymlinks?: boolean;
      enableWatching?: boolean;
      watchIgnore?: string[];
    };
    additionalWorkspaces?: Record<string, {
      path: string;
      name?: string;
      description?: string;
      readOnly?: boolean;
      allowedExtensions?: string[];
      blockedExtensions?: string[];
      maxFileSize?: number;
      allowedPaths?: string[];
      blockedPaths?: string[];
      followSymlinks?: boolean;
      enableWatching?: boolean;
      watchIgnore?: string[];
    }>;
  },
  customRouters?: { [namespace: string]: any }
): ReturnType<typeof router> {
  // Initialize services if database is available
  let virtualTokenService: VirtualTokenService | null = null;
  let usageAnalyticsService: UsageAnalyticsService | null = null;
  let hybridUserService: any | null = null; // TODO: Import proper type

  if (dbAdapter) {
    usageAnalyticsService = new UsageAnalyticsService(dbAdapter);

    if (tokenTrackingEnabled) {
      virtualTokenService = new VirtualTokenService(dbAdapter);
    }
  }

  // Initialize WorkspaceManager for server workspaces
  let workspaceManager: WorkspaceManager | undefined;
  if (serverWorkspaces?.enabled) {
    const hasDefault = typeof serverWorkspaces.defaultWorkspace?.path === 'string' && serverWorkspaces.defaultWorkspace.path.trim().length > 0;
    const hasAdditional = !!serverWorkspaces.additionalWorkspaces && Object.keys(serverWorkspaces.additionalWorkspaces).length > 0;

    if (hasDefault || hasAdditional) {
      try {
        const workspaceManagerConfig: WorkspaceManagerConfig = {};

        if (hasDefault && serverWorkspaces.defaultWorkspace) {
          const normalizedDefault: ServerWorkspaceConfig = {
            ...serverWorkspaces.defaultWorkspace,
            path: serverWorkspaces.defaultWorkspace.path!.trim()
          };
          workspaceManagerConfig.defaultWorkspace = normalizedDefault;
        }

        if (hasAdditional && serverWorkspaces.additionalWorkspaces) {
          const normalizedAdditional = Object.fromEntries(
            Object.entries(serverWorkspaces.additionalWorkspaces)
              .filter(([, config]) => typeof config?.path === 'string' && config.path.trim().length > 0)
              .map(([workspaceId, config]) => [
                workspaceId,
                {
                  ...config,
                  path: config.path.trim()
                } as ServerWorkspaceConfig
              ])
          );

          if (Object.keys(normalizedAdditional).length > 0) {
            workspaceManagerConfig.serverWorkspaces = normalizedAdditional;
          }
        }

        if (!workspaceManagerConfig.defaultWorkspace && !workspaceManagerConfig.serverWorkspaces) {
          throw new Error('No valid workspace paths provided');
        }

        workspaceManager = new WorkspaceManager(workspaceManagerConfig);
      } catch (error) {
        logger.warn('⚠️  Failed to initialize server workspace manager:', error instanceof Error ? error.message : error);
      }
    } else {
      logger.warn('⚠️  serverWorkspaces.enabled is true but no workspace paths are configured. Skipping workspace manager initialization.');
    }
  }

  // Create shared AI service instance only if MCP AI is enabled
  const sharedAIService = mcpConfig?.ai?.enabled
    ? (() => {
        // Use MCP-specific configuration if useServerConfig is false
        if (mcpConfig.ai.useServerConfig === false) {
          // Use MCP-specific providers and configuration
          const mcpProviders = mcpConfig.ai.mcpProviders;
          const serviceProvidersConfig = mcpProviders
            ? createMCPServiceProvidersConfig(mcpProviders)
            : createServiceProvidersConfig(['anthropic']); // Default fallback

          return new AIService({
            serviceProviders: serviceProvidersConfig,
            modelRestrictions: mcpConfig.ai.modelRestrictions || modelRestrictions,
            ...(mcpConfig.ai.aiServiceConfig || {})
          });
        } else {
          // Use server configuration (current behavior)
          return new AIService({
            serviceProviders: createServiceProvidersConfig(serverProviders || ['anthropic']),
            modelRestrictions
          });
        }
      })()
    : null;

  // Create routers
  const systemRouter = createSystemRouter(workspaceManager);
  const userRouter = createUserRouter(virtualTokenService, usageAnalyticsService, hybridUserService, byokProviders);
  const billingRouter = createBillingRouter(virtualTokenService, usageAnalyticsService, hybridUserService);
  const authRouter = createAuthRouter(postgresRPCMethods);
  const adminRouter = createAdminRouter({
    adminUsers: ['admin@company.com'],
    requireAdminAuth: true,
    usageAnalyticsService,
    virtualTokenService
  });

  const aiRouter = createAIRouter({
    config: aiConfig,
    tokenTrackingEnabled,
    dbAdapter,
    serverProviders,
    byokProviders,
    postgresRPCMethods,
    modelRestrictions
  } as any);

  // Build base routers object
  const baseRouters: Record<string, any> = {
    ai: aiRouter,
    system: systemRouter,
    user: userRouter,
    billing: billingRouter,
    auth: authRouter,
    admin: adminRouter
  };

  // Only include MCP router if enabled
  if (mcpConfig?.enabled !== false) {
    const mcpRouter = createMCPRouter({
      auth: mcpConfig?.auth,
      ai: mcpConfig?.ai,
      aiService: sharedAIService,
      namespaceWhitelist: mcpConfig?.namespaceWhitelist
    });
    baseRouters.mcp = mcpRouter;
    logger.debug(`🔧 MCP router included`);
  } else {
    logger.debug(`🔧 MCP router excluded (disabled in config)`);
  }

  // Merge custom routers if provided
  const allRouters = customRouters ? { ...baseRouters, ...customRouters } : baseRouters;

  const appRouter = router(allRouters);

  //const mcpServer = createMcpServer(implementation, appRouter);
  // Attach the SDK integration from MCP router to the main app router
  /*const mcpSdkIntegration = (mcpRouter as any).sdkIntegration;
  if (mcpSdkIntegration) {
    (appRouter as any).sdkIntegration = mcpSdkIntegration;
    console.log('✅ SDK integration attached to app router');
  } else {
    console.warn('⚠️  No SDK integration found on MCP router');
  }*/
  
  return appRouter;
}

/**
 * Default app router with default configuration
 */
export const appRouter: ReturnType<typeof createAppRouter> = createAppRouter();

/**
 * Generate tRPC methods documentation
 * The actual generation is handled by tools/generate-trpc-methods.js
 */
export function generateTRPCMethods() {
  // This is now handled by the build script
  // The methods are available in dist/trpc-methods.json
  throw new Error('tRPC methods are generated at build time. Check dist/trpc-methods.json');
}

/**
 * Export the app router type definition
 * This is used by the client for end-to-end type safety
 * 
 * Using the runtime type but with explicit static typing for better inference
 */
export type AppRouter = ReturnType<typeof createAppRouter>;

/**
 * Export input/output types for each router procedure
 * Using the runtime router for input/output inference since the static type doesn't work here
 */
export type RouterInputs = inferRouterInputs<typeof appRouter>;
export type RouterOutputs = inferRouterOutputs<typeof appRouter>;
