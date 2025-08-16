/**
 * tRPC Server Setup
 * 
 * This file sets up the core tRPC configuration for our AI backend.
 * Following tRPC v10+ best practices for type-safe API development.
 */

import { initTRPC, TRPCError } from '@trpc/server';
import type { CreateExpressContextOptions } from '@trpc/server/adapters/express';
import type { Request, Response } from 'express';
import type { AuthenticatedRequest, OpenSaaSJWTPayload } from '../auth/jwt-middleware.js';
import superjson from 'superjson';

/**
 * Create context for each request
 * Extracts user information from JWT token if present
 */
export function createTRPCContext(opts: CreateExpressContextOptions): {
  req: Request;
  res: Response;
  user: OpenSaaSJWTPayload | null;
} {
  const authReq = opts.req as AuthenticatedRequest;
  
  return {
    req: opts.req,
    res: opts.res,
    user: authReq.user || null, // Populated by JWT middleware if token is valid
  };
}

export type Context = ReturnType<typeof createTRPCContext>;

/**
 * Initialize tRPC with context and transformer
 */
const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape }) {
    return shape;
  },
});

/**
 * Export reusable router and procedure helpers
 * These are the building blocks for our API
 */
export const createTRPCRouter: typeof t.router = t.router;
export const publicProcedure: typeof t.procedure = t.procedure;

/**
 * Protected procedure - requires valid JWT authentication
 */
export const protectedProcedure: ReturnType<typeof t.procedure.use> = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Authentication required. Please provide a valid JWT token.',
    });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user, // Guaranteed to be non-null after check
    },
  });
});

/**
 * Token-protected procedure - requires JWT + checks token balance
 */
export const tokenProtectedProcedure: typeof protectedProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  // This will be used in AI router for token balance checking
  // The actual token balance check will be done in the AI router
  return next({
    ctx: {
      ...ctx,
      // User is guaranteed to exist from protectedProcedure
    },
  });
});