/**
 * tRPC Server Setup
 *
 * This file sets up the core tRPC configuration for our AI backend.
 * Following tRPC v10+ best practices for type-safe API development.
 */
import { TRPCError } from '@trpc/server';
import type { CreateExpressContextOptions } from '@trpc/server/adapters/express';
import type { Request, Response } from 'express';
import { type McpMeta } from "trpc-to-mcp";
import type { MCPPromptConfig } from '../auth/scopes';
export interface ExtendedMeta extends McpMeta {
    openapi?: {
        method: string;
        path: string;
        tags?: string[];
        summary?: string;
        description?: string;
    };
    mcpExtensions?: {
        supportsProgress?: boolean;
        supportsCancellation?: boolean;
    };
    mcpPrompt?: MCPPromptConfig;
}
import type { OpenSaaSJWTPayload } from '@auth/jwt-middleware';
import superjson from 'superjson';
/**
 * Create context for each request
 * Extracts user information from JWT token if present
 */
export declare function createTRPCContext(opts: CreateExpressContextOptions): {
    req: Request;
    res: Response;
    user: OpenSaaSJWTPayload | null;
    apiKey: string | null;
};
export type Context = ReturnType<typeof createTRPCContext>;
/**
 * Initialize tRPC with context and transformer
 */
declare const t: import("@trpc/server").TRPCRootObject<{
    req: Request;
    res: Response;
    user: OpenSaaSJWTPayload | null;
    apiKey: string | null;
}, ExtendedMeta, {
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
            apiKey: string | null;
        };
        shape: import("@trpc/server").TRPCDefaultErrorShape;
    }): {
        data: {
            code: import("@trpc/server").TRPC_ERROR_CODE_KEY;
            httpStatus: number;
        };
        message: string;
        code: import("@trpc/server").TRPC_ERROR_CODE_NUMBER;
    };
}, {
    ctx: {
        req: Request;
        res: Response;
        user: OpenSaaSJWTPayload | null;
        apiKey: string | null;
    };
    meta: ExtendedMeta;
    errorShape: import("@trpc/server").TRPCDefaultErrorShape;
    transformer: false;
}>;
/**
 * Export reusable router and procedure helpers
 * These are the building blocks for our API
 */
export declare const router: typeof t.router;
export declare const publicProcedure: typeof t.procedure;
/**
 * Export the tRPC instance for advanced usage like createCallerFactory
 * Needed for server-side calls in the JSON-RPC bridge
 */
export { t };
/**
 * Protected procedure - requires valid JWT authentication
 */
export declare const protectedProcedure: ReturnType<typeof t.procedure.use>;
/**
 * Token-protected procedure - requires JWT + checks token balance
 */
export declare const tokenProtectedProcedure: typeof protectedProcedure;
//# sourceMappingURL=index.d.ts.map