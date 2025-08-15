/**
 * Main tRPC App Router
 * 
 * Combines all sub-routers into the main application router.
 * This is the single source of truth for all tRPC procedures.
 */

import { createTRPCRouter } from './index.js';
import { createAIRouter, type AIRouterConfig } from './routers/ai.js';
import type { inferRouterInputs, inferRouterOutputs } from '@trpc/server';

/**
 * Create app router with configurable AI limits
 */
export function createAppRouter(aiConfig?: AIRouterConfig): ReturnType<typeof createTRPCRouter> {
  return createTRPCRouter({
    ai: createAIRouter(aiConfig),
    
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
 */
export type AppRouter = ReturnType<typeof createAppRouter>;

/**
 * Export input/output types for each router procedure
 */
export type RouterInputs = inferRouterInputs<AppRouter>;
export type RouterOutputs = inferRouterOutputs<AppRouter>;