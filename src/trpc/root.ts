/**
 * Main tRPC App Router
 * 
 * Combines all sub-routers into the main application router.
 * This is the single source of truth for all tRPC procedures.
 */

import { createTRPCRouter } from './trpc.js';
import { aiRouter } from './routers/ai.js';
import type { inferRouterInputs, inferRouterOutputs } from '@trpc/server';

/**
 * Main app router that combines all feature routers
 */
export const appRouter: any = createTRPCRouter({
  ai: aiRouter,
  
  // Add more routers here as needed:
  // auth: authRouter,
  // billing: billingRouter,
  // etc.
});

/**
 * Export the app router type definition
 * This is used by the client for end-to-end type safety
 */
export type AppRouter = typeof appRouter;

/**
 * Export input/output types for each router procedure
 */
export type RouterInputs = inferRouterInputs<AppRouter>;
export type RouterOutputs = inferRouterOutputs<AppRouter>;