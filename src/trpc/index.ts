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
  
  // Start with JWT middleware user if available
  let user = authReq.user || null;
  
  // Development mode: Handle OpenSaaS session tokens
  if (!user && opts.req.headers.authorization?.startsWith('Bearer ')) {
    const token = opts.req.headers.authorization.substring(7);
    
    // Check if it looks like an OpenSaaS session token (development mode only)
    if (token.startsWith('jwt_token_') && process.env.NODE_ENV !== 'production') {
      console.log('🔧 Development mode: Creating mock user for OpenSaaS session token:', token.slice(0, 20) + '...');
      
      // Extract user ID from session token
      const userId = token.includes('_') ? token.split('_')[2] || 'dev-user' : 'dev-user';
      
      user = {
        userId: `dev-${userId.slice(-8)}`,
        email: 'dev@example.com',
        subscriptionTier: 'pro',
        monthlyTokenQuota: 100000,
        rpmLimit: 100,
        tpmLimit: 10000,
        features: ['basic_ai', 'advanced_ai'],
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 86400, // 24 hours
        iss: 'dev-mode',
        aud: 'ai-backend'
      };
      
      console.log('✅ Mock user created:', { userId: user.userId, email: user.email, tier: user.subscriptionTier });
    }
  }
  
  return {
    req: opts.req,
    res: opts.res,
    user, // Populated by JWT middleware if token is valid, or mock user in dev mode
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