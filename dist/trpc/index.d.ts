/**
 * tRPC Server Setup
 *
 * This file sets up the core tRPC configuration for our AI backend.
 * Following tRPC v10+ best practices for type-safe API development.
 */
import { TRPCError } from '@trpc/server';
import type { CreateExpressContextOptions } from '@trpc/server/adapters/express';
import type { Request, Response } from 'express';
import type { OpenSaaSJWTPayload } from '../auth/jwt-middleware.js';
import superjson from 'superjson';
/**
 * Create context for each request
 * Extracts user information from JWT token if present
 */
export declare function createTRPCContext(opts: CreateExpressContextOptions): {
    req: Request;
    res: Response;
    user: OpenSaaSJWTPayload | null;
};
export type Context = ReturnType<typeof createTRPCContext>;
/**
 * Initialize tRPC with context and transformer
 */
declare const t: import("@trpc/server").TRPCRootObject<{
    req: Request;
    res: Response;
    user: OpenSaaSJWTPayload | null;
}, object, {
    transformer: typeof superjson;
    errorFormatter({ shape }: {
        error: TRPCError;
        type: import("@trpc/server").ProcedureType | "unknown";
        path: string | undefined;
        input: unknown;
        ctx: {
            req: Request;
            res: Response;
            user: OpenSaaSJWTPayload | null;
        } | undefined;
        shape: import("@trpc/server").TRPCDefaultErrorShape;
    }): import("@trpc/server").TRPCDefaultErrorShape;
}, {
    ctx: {
        req: Request;
        res: Response;
        user: OpenSaaSJWTPayload | null;
    };
    meta: object;
    errorShape: import("@trpc/server").TRPCDefaultErrorShape;
    transformer: true;
}>;
/**
 * Export reusable router and procedure helpers
 * These are the building blocks for our API
 */
export declare const createTRPCRouter: typeof t.router;
export declare const publicProcedure: typeof t.procedure;
/**
 * Protected procedure - requires valid JWT authentication
 */
export declare const protectedProcedure: ReturnType<typeof t.procedure.use>;
/**
 * Token-protected procedure - requires JWT + checks token balance
 */
export declare const tokenProtectedProcedure: typeof protectedProcedure;
export {};
//# sourceMappingURL=index.d.ts.map