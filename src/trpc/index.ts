/**
 * tRPC Server Setup
 * 
 * This file sets up the core tRPC configuration for our AI backend.
 * Following tRPC v10+ best practices for type-safe API development.
 */

import { initTRPC, TRPCError } from '@trpc/server';
import type { CreateExpressContextOptions } from '@trpc/server/adapters/express';
import type { Request, Response } from 'express';
import { type McpMeta } from "trpc-to-mcp";

// Extended meta type that supports both MCP and OpenAPI
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
  // MCP Authentication support
  mcpAuth?: {
    /** Function to check if the current user can access this MCP tool */
    canAccess?: (ctx: { user: OpenSaaSJWTPayload | null; apiKey: string | null }) => boolean;
    /** Whether this tool requires authentication (default: true if canAccess is provided) */
    requireAuth?: boolean;
    /** Roles that can access this tool */
    roles?: string[];
    /** Custom error message when access is denied */
    accessDeniedMessage?: string;
  };
}
// OpenAPI removed - using custom tRPC methods extraction instead
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
  apiKey: string | null;
} {
  const authReq = opts.req as AuthenticatedRequest;
  
  // Debug: Log what user context we have
  console.log('🔍 tRPC Context Creation:');
  console.log(`   Path: ${opts.req.path}`);
  console.log(`   Method: ${opts.req.method}`);
  console.log(`   Has authReq.user: ${!!authReq.user}`);
  console.log(`   User email: ${authReq.user?.email || 'none'}`);
  console.log(`   Auth header: ${opts.req.headers.authorization ? 'present' : 'missing'}`);
  
  // Start with JWT middleware user if available
  let user = authReq.user || null;
  
  // Extract API key from header for BYOK scenarios
  const apiKey = opts.req.headers['x-api-key'] as string | null;
  
  // Development mode: Handle OpenSaaS JWT tokens and session tokens
  if (!user && opts.req.headers.authorization?.startsWith('Bearer ')) {
    const token = opts.req.headers.authorization.substring(7);
    
    // Handle OpenSaaS session tokens (old format)
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
    // Handle OpenSaaS JWT tokens (new format)
    else if (token.startsWith('eyJ') && process.env.NODE_ENV !== 'production') {
      try {
        console.log('🔧 Development mode: Parsing OpenSaaS JWT token:', token.slice(0, 20) + '...');
        
        // Decode JWT payload (skip signature verification in development)
        const parts = token.split('.');
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
        
        console.log('📄 JWT payload:', payload);
        
        // Convert OpenSaaS JWT to our expected format
        user = {
          userId: payload.userId || payload.sub || 'unknown',
          email: payload.email || 'unknown@example.com',
          subscriptionTier: payload.subscriptionTier || 'pro', // Default to pro in development
          monthlyTokenQuota: payload.monthlyTokenQuota || 100000,
          rpmLimit: payload.rpmLimit || 100,
          tpmLimit: payload.tpmLimit || 10000,
          features: payload.features || ['basic_ai', 'advanced_ai'],
          iat: payload.iat,
          exp: payload.exp,
          iss: payload.iss,
          aud: payload.aud,
          organizationId: payload.organizationId
        };
        
        console.log('✅ OpenSaaS user authenticated:', { 
          userId: user.userId, 
          email: user.email, 
          tier: user.subscriptionTier,
          issuer: user.iss
        });
        
      } catch (error) {
        console.warn('⚠️ Failed to parse OpenSaaS JWT in development mode:', error instanceof Error ? error.message : String(error));
      }
    }
  }
  
  return {
    req: opts.req,
    res: opts.res,
    user, // Populated by JWT middleware if token is valid, or mock user in dev mode
    apiKey,
  };
}

export type Context = ReturnType<typeof createTRPCContext>;

/**
 * Initialize tRPC with context and transformer
 */
const t = initTRPC
  .context<Context>()
  .meta<ExtendedMeta>()
  .create({
    transformer: superjson,
    errorFormatter({ shape }) {
      return shape;
    },
});

/**
 * Export reusable router and procedure helpers
 * These are the building blocks for our API
 */
export const router: typeof t.router = t.router;
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

/**
 * MCP Authentication Middleware
 * Can be applied to any procedure type (public, protected, etc.)
 * Checks MCP-specific auth requirements from meta.mcpAuth
 */
export function withMCPAuth<TProcedure extends typeof t.procedure>(
  procedure: TProcedure
): TProcedure {
  return procedure.use(({ meta, ctx, next }) => {
    const mcpAuth = meta?.mcpAuth;
    
    // If no MCP auth config, continue normally
    if (!mcpAuth) {
      return next();
    }

    // Check if authentication is required
    const requireAuth = mcpAuth.requireAuth ?? (mcpAuth.canAccess !== undefined);
    
    if (requireAuth && !ctx.user) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: mcpAuth.accessDeniedMessage || 'Authentication required for this MCP tool',
      });
    }

    // Check role-based access
    if (mcpAuth.roles && mcpAuth.roles.length > 0) {
      const userRole = ctx.user?.subscriptionTier || 'free';
      if (!mcpAuth.roles.includes(userRole)) {
        throw new TRPCError({
          code: 'FORBIDDEN', 
          message: mcpAuth.accessDeniedMessage || `Access denied. Required roles: ${mcpAuth.roles.join(', ')}`,
        });
      }
    }

    // Check custom access function
    if (mcpAuth.canAccess) {
      const hasAccess = mcpAuth.canAccess({ user: ctx.user, apiKey: ctx.apiKey });
      if (!hasAccess) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: mcpAuth.accessDeniedMessage || 'Access denied for this MCP tool',
        });
      }
    }

    return next();
  }) as TProcedure;
}

/**
 * Convenience functions for common MCP procedure patterns
 * These combine base procedures with MCP auth middleware
 */

/** Public procedure with optional MCP auth */
export const mcpPublicProcedure = withMCPAuth(publicProcedure);

/** Protected procedure with MCP auth */
export const mcpProtectedProcedure = withMCPAuth(protectedProcedure);

/** Token-protected procedure with MCP auth */
export const mcpTokenProtectedProcedure = withMCPAuth(tokenProtectedProcedure);