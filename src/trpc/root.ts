/**
 * Main tRPC App Router
 * 
 * Combines all sub-routers into the main application router.
 * This is the single source of truth for all tRPC procedures.
 */

import { router } from '@src-trpc/index';
import { createAIRouter, type AIRouterConfig } from '@src-trpc/routers/ai';
import { createMCPRouter, MCPRouterConfig } from '@src-trpc/routers/mcp';
import type { inferRouterInputs, inferRouterOutputs } from '@trpc/server';
import type { PostgreSQLAdapter } from '@database/postgres-adapter';
import type { PostgreSQLRPCMethods } from '@auth/PostgreSQLRPCMethods';
// OpenAPI generation removed - using trpc-methods.json instead


/**
 * Create app router with configurable AI limits and optional token tracking
 * NESTED VERSION with proper namespaces for better organization
 */
export function createAppRouter(
  aiConfig?: AIRouterConfig, 
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
  }>
) {
  // Create the MCP router and extract its SDK integration

  const mcpRouter = createMCPRouter();

  // Only log MCP config if MCP is enabled
  if (mcpConfig?.enableMCP) {
    console.log("MCP enabled:", mcpConfig.enableMCP);
  }

  // Create the main app router
  const appRouter = router({
    ai: createAIRouter(aiConfig, tokenTrackingEnabled, dbAdapter, serverProviders, byokProviders, postgresRPCMethods, modelRestrictions),
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
export const appRouter: ReturnType<typeof createAppRouter> = createAppRouter();

/**
 * Generate tRPC methods documentation (replaces OpenAPI)
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