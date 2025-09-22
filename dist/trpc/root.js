/**
 * Main tRPC App Router
 *
 * Combines all sub-routers into the main application router.
 * This is the single source of truth for all tRPC procedures.
 */
import { router } from './index.js';
import { createAIRouter } from './routers/ai.js';
import { AIService } from '../services/ai-service.js';
import { createServiceProvidersConfig, createMCPServiceProvidersConfig } from './routers/ai/types.js';
import { createMCPRouter } from './routers/mcp/index.js';
import { createSystemRouter } from './routers/system/index.js';
import { createUserRouter } from './routers/user/index.js';
import { createBillingRouter } from './routers/billing/index.js';
import { createAuthRouter } from './routers/auth/index.js';
import { createAdminRouter } from './routers/admin/index.js';
import { VirtualTokenService } from '../services/virtual-token-service.js';
import { UsageAnalyticsService } from '../services/usage-analytics-service.js';
import { RootManager } from '../services/root-manager.js';
/**
 * Create app router with configurable AI limits and optional token tracking
 * NESTED VERSION with proper namespaces for better organization
 */
export function createAppRouter(aiConfig, tokenTrackingEnabled, dbAdapter, serverProviders, byokProviders, postgresRPCMethods, mcpConfig, modelRestrictions, rootFolders, customRouters) {
    // Initialize services if database is available
    let virtualTokenService = null;
    let usageAnalyticsService = null;
    let hybridUserService = null; // TODO: Import proper type
    if (dbAdapter) {
        usageAnalyticsService = new UsageAnalyticsService(dbAdapter);
        if (tokenTrackingEnabled) {
            virtualTokenService = new VirtualTokenService(dbAdapter);
        }
    }
    // Initialize RootManager
    let rootManager;
    if (rootFolders?.enableAPI !== false) {
        // Create basic root manager configuration
        const rootManagerConfig = {
            defaultRoot: rootFolders?.defaultRoot ? {
                path: rootFolders.defaultRoot.path || process.cwd(),
                name: 'Project Root',
                description: 'Default project root folder',
                readOnly: rootFolders.defaultRoot.readOnly ?? false,
                allowedExtensions: rootFolders.defaultRoot.allowedExtensions || ['ts', 'js', 'json', 'md', 'txt', 'yml', 'yaml'],
                blockedExtensions: ['exe', 'bin', 'so', 'dll'],
                maxFileSize: 10 * 1024 * 1024,
                followSymlinks: false,
                enableWatching: false
            } : undefined,
            roots: rootFolders?.additionalRoots ? Object.fromEntries(Object.entries(rootFolders.additionalRoots).map(([id, config]) => [
                id,
                {
                    path: config.path,
                    name: config.name || id,
                    description: config.description,
                    readOnly: config.readOnly ?? false,
                    allowedExtensions: config.allowedExtensions,
                    blockedExtensions: config.blockedExtensions || ['exe', 'bin', 'so', 'dll'],
                    maxFileSize: config.maxFileSize || 10 * 1024 * 1024,
                    followSymlinks: false,
                    enableWatching: false
                }
            ])) : undefined
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
            }
            else {
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
    const systemRouter = createSystemRouter(rootManager);
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
        }),
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
export const appRouter = createAppRouter();
/**
 * Generate tRPC methods documentation
 * The actual generation is handled by tools/generate-trpc-methods.js
 */
export function generateTRPCMethods() {
    // This is now handled by the build script
    // The methods are available in dist/trpc-methods.json
    throw new Error('tRPC methods are generated at build time. Check dist/trpc-methods.json');
}
