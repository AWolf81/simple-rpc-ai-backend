/**
 * tRPC Server Setup
 *
 * This file sets up the core tRPC configuration for our AI backend.
 * Following tRPC v10+ best practices for type-safe API development.
 */
import type { CreateExpressContextOptions } from '@trpc/server/adapters/express';
/**
 * Create context for each request
 * This is where you'd add authentication, database connections, etc.
 */
export declare function createTRPCContext(opts: CreateExpressContextOptions): any;
export type Context = any;
/**
 * Export reusable router and procedure helpers
 * These are the building blocks for our API
 */
export declare const createTRPCRouter: any;
export declare const publicProcedure: any;
/**
 * Protected procedure (can be extended for authentication)
 */
export declare const protectedProcedure: any;
//# sourceMappingURL=trpc.d.ts.map