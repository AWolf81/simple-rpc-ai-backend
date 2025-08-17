/**
 * Main tRPC App Router
 *
 * Combines all sub-routers into the main application router.
 * This is the single source of truth for all tRPC procedures.
 */
import { type AIRouterConfig } from './routers/ai.js';
import type { inferRouterInputs, inferRouterOutputs } from '@trpc/server';
import type { PostgreSQLAdapter } from '../database/postgres-adapter.js';
/**
 * Create app router with configurable AI limits and optional token tracking
 */
export declare function createAppRouter(aiConfig?: AIRouterConfig, tokenTrackingEnabled?: boolean, dbAdapter?: PostgreSQLAdapter, serverProviders?: string[], byokProviders?: string[]): import("@trpc/server").TRPCBuiltRouter<{
    ctx: {
        req: import("express").Request;
        res: import("express").Response;
        user: import("../index.js").OpenSaaSJWTPayload | null;
    };
    meta: object;
    errorShape: import("@trpc/server").TRPCDefaultErrorShape;
    transformer: true;
}, import("@trpc/server").TRPCDecorateCreateRouterOptions<{
    ai: import("@trpc/server").TRPCBuiltRouter<{
        ctx: {
            req: import("express").Request;
            res: import("express").Response;
            user: import("../index.js").OpenSaaSJWTPayload | null;
        };
        meta: object;
        errorShape: import("@trpc/server").TRPCDefaultErrorShape;
        transformer: true;
    }, import("@trpc/server").TRPCDecorateCreateRouterOptions<import("@trpc/server").TRPCCreateRouterOptions>>;
}>>;
/**
 * Default app router with default configuration
 */
export declare const appRouter: ReturnType<typeof createAppRouter>;
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