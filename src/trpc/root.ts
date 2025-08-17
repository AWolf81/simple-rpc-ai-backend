/**
 * Main tRPC App Router
 * 
 * Combines all sub-routers into the main application router.
 * This is the single source of truth for all tRPC procedures.
 */

import { createTRPCRouter } from './index.js';
import { createAIRouter, type AIRouterConfig, type AIRouterType } from './routers/ai.js';
import type { inferRouterInputs, inferRouterOutputs } from '@trpc/server';
import type { PostgreSQLAdapter } from '../database/postgres-adapter.js';

/**
 * Create app router with configurable AI limits and optional token tracking
 */
export function createAppRouter(
  aiConfig?: AIRouterConfig, 
  tokenTrackingEnabled?: boolean,
  dbAdapter?: PostgreSQLAdapter,
  serverProviders?: string[],
  byokProviders?: string[]
) {
  return createTRPCRouter({
    ai: createAIRouter(aiConfig, tokenTrackingEnabled, dbAdapter, serverProviders, byokProviders),
    
    // Add more routers here as needed:
    // auth: authRouter,
    // billing: billingRouter,
    // etc.
  });
}

/**
 * Default app router with default configuration
 */
export const appRouter: ReturnType<typeof createAppRouter> = createAppRouter();

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