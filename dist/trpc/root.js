/**
 * Main tRPC App Router
 *
 * Combines all sub-routers into the main application router.
 * This is the single source of truth for all tRPC procedures.
 */
import { router } from './index.js';
import { createAIRouter } from './routers/ai.js';
//import { createMCPRouter, type MCPRouterConfig } from './routers/mcp_old.js';
import { createMCPRouter } from './routers/mcp.js';
// OpenAPI generation removed - using trpc-methods.json instead
/**
 * Create app router with configurable AI limits and optional token tracking
 * NESTED VERSION with proper namespaces for better organization
 */
export function createAppRouter(aiConfig, tokenTrackingEnabled, dbAdapter, serverProviders, byokProviders, postgresRPCMethods, mcpConfig) {
    // Create the MCP router and extract its SDK integration
    // Debug: log MCP config in createAppRouter
    console.log('🔍 createAppRouter MCP Config (Call #' + Math.random().toString(36).substr(2, 5) + '):', {
        hasMcpConfig: !!mcpConfig,
        extensions: mcpConfig?.extensions ? {
            hasPrompts: !!mcpConfig.extensions.prompts,
            hasResources: !!mcpConfig.extensions.resources,
            promptsConfig: mcpConfig.extensions.prompts,
            resourcesConfig: mcpConfig.extensions.resources
        } : null
    });
    const mcpRouter = createMCPRouter(mcpConfig);
    console.log("MCP enabled?", mcpConfig?.enableMCP); // todo add handling
    // Create the main app router
    const appRouter = router({
        ai: createAIRouter(aiConfig, tokenTrackingEnabled, dbAdapter, serverProviders, byokProviders, postgresRPCMethods),
        mcp: mcpRouter
    });
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
 * Generate tRPC methods documentation (replaces OpenAPI)
 * The actual generation is handled by tools/generate-trpc-methods.js
 */
export function generateTRPCMethods() {
    // This is now handled by the build script
    // The methods are available in dist/trpc-methods.json
    throw new Error('tRPC methods are generated at build time. Check dist/trpc-methods.json');
}
