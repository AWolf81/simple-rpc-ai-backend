/**
 * tRPC Server Setup
 *
 * This file sets up the core tRPC configuration for our AI backend.
 * Following tRPC v10+ best practices for type-safe API development.
 */
import type { CreateExpressContextOptions } from '@trpc/server/adapters/express';
import type { Request, Response } from 'express';
import superjson from 'superjson';
/**
 * Create context for each request
 * This is where you'd add authentication, database connections, etc.
 */
export declare function createTRPCContext(opts: CreateExpressContextOptions): {
    req: Request;
    res: Response;
    user: {
        id: string;
        email: string;
    } | null;
};
export type Context = ReturnType<typeof createTRPCContext>;
/**
 * Initialize tRPC with context and transformer
 */
declare const t: import("@trpc/server").TRPCRootObject<{
    req: Request;
    res: Response;
    user: {
        id: string;
        email: string;
    } | null;
}, object, {
    transformer: typeof superjson;
    errorFormatter({ shape }: {
        error: import("@trpc/server").TRPCError;
        type: import("@trpc/server").ProcedureType | "unknown";
        path: string | undefined;
        input: unknown;
        ctx: {
            req: Request;
            res: Response;
            user: {
                id: string;
                email: string;
            } | null;
        } | undefined;
        shape: import("@trpc/server").TRPCDefaultErrorShape;
    }): import("@trpc/server").TRPCDefaultErrorShape;
}, {
    ctx: {
        req: Request;
        res: Response;
        user: {
            id: string;
            email: string;
        } | null;
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
 * Protected procedure (can be extended for authentication)
 */
export declare const protectedProcedure: ReturnType<typeof t.procedure.use>;
export {};
//# sourceMappingURL=index.d.ts.map