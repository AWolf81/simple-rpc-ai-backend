/**
 * Main tRPC App Router
 *
 * Combines all sub-routers into the main application router.
 * This is the single source of truth for all tRPC procedures.
 */
import type { inferRouterInputs, inferRouterOutputs } from '@trpc/server';
/**
 * Main app router that combines all feature routers
 */
export declare const appRouter: any;
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
//# sourceMappingURL=root.d.ts.map