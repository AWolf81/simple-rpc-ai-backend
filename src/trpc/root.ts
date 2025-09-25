/**
 * Main tRPC App Router
 * 
 * Combines all sub-routers into the main application router.
 * This is the single source of truth for all tRPC procedures.
 */

import { router } from '@src-trpc/index';
import { createAIRouter } from '@src-trpc/routers/ai';
import type { AIRouterFactoryConfig } from '@src-trpc/routers/ai/types';
import { AIService } from '@services/ai-service';
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
import { VirtualTokenService } from '@services/virtual-token-service';
import { UsageAnalyticsService } from '@services/usage-analytics-service';
import { RootManager } from '@services/root-manager';
import { WorkspaceManager } from '@services/workspace-manager';


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
  rootFolders?: any,
  customRouters?: { [namespace: string]: any }
) {
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
  if (rootFolders?.enableAPI !== false && (rootFolders as any)?.additionalRoots) {
    // Create workspace manager from serverWorkspaces config
    workspaceManager = new WorkspaceManager();

    // Add workspaces from additionalRoots (which maps to serverWorkspaces in server config)
    const serverWorkspaces = (rootFolders as any).additionalRoots;
    if (serverWorkspaces) {
      for (const [workspaceId, config] of Object.entries(serverWorkspaces)) {
        try {
          workspaceManager.addWorkspace(workspaceId, config as any);
        } catch (error) {
          console.warn(`Failed to add workspace ${workspaceId}:`, error);
        }
      }
    }
  }

  // Initialize RootManager for MCP client roots
  let rootManager: RootManager | undefined;
  if (rootFolders?.enableAPI !== false) {
    // Create basic root manager configuration
    const rootManagerConfig = {
      defaultRoot: rootFolders?.defaultRoot ? {
        path: (rootFolders.defaultRoot as any).path || process.cwd(),
        name: 'Project Root',
        description: 'Default project root folder',
        readOnly: (rootFolders.defaultRoot as any).readOnly ?? false,
        allowedExtensions: (rootFolders.defaultRoot as any).allowedExtensions || ['ts', 'js', 'json', 'md', 'txt', 'yml', 'yaml'],
        blockedExtensions: ['exe', 'bin', 'so', 'dll'],
        maxFileSize: 10 * 1024 * 1024,
        followSymlinks: false,
        enableWatching: false
      } : undefined,
      roots: rootFolders?.additionalRoots ? Object.fromEntries(
        Object.entries(rootFolders.additionalRoots).map(([id, config]) => [
          id,
          {
            path: (config as any).path,
            name: (config as any).name || id,
            description: (config as any).description,
            readOnly: (config as any).readOnly ?? false,
            allowedExtensions: (config as any).allowedExtensions,
            blockedExtensions: (config as any).blockedExtensions || ['exe', 'bin', 'so', 'dll'],
            maxFileSize: (config as any).maxFileSize || 10 * 1024 * 1024,
            followSymlinks: false,
            enableWatching: false
          }
        ])
      ) : undefined
    };
    rootManager = new RootManager(rootManagerConfig);
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

  // Create all routers
  const mcpRouter = createMCPRouter({
    auth: mcpConfig?.auth,
    ai: mcpConfig?.ai,
    aiService: sharedAIService
  });
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

  // Only log MCP config if MCP is enabled
  if (mcpConfig?.enableMCP) {
    console.log("MCP enabled:", mcpConfig.enableMCP);
  }

  // Create the main app router with proper namespace structure and custom routers
  const baseRouters = {
    ai: createAIRouter({
      config: aiConfig,
      tokenTrackingEnabled,
      dbAdapter,
      serverProviders,
      byokProviders,
      postgresRPCMethods,
      modelRestrictions
    } as any),
    mcp: mcpRouter,
    system: systemRouter,
    user: userRouter,
    billing: billingRouter,
    auth: authRouter,
    admin: adminRouter
  };

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