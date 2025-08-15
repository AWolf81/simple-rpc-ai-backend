/**
 * Main tRPC App Router
 *
 * Combines all sub-routers into the main application router.
 * This is the single source of truth for all tRPC procedures.
 */
import { createTRPCRouter } from './index.js';
import { type AIRouterConfig } from './routers/ai.js';
import type { inferRouterInputs, inferRouterOutputs } from '@trpc/server';
/**
 * Create app router with configurable AI limits
 */
export declare function createAppRouter(aiConfig?: AIRouterConfig): ReturnType<typeof createTRPCRouter>;
/**
 * Default app router with default configuration
 */
export declare const appRouter: ReturnType<typeof createAppRouter>;
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
//# sourceMappingURL=root.d.ts.map