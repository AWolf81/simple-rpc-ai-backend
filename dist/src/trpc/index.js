/**
 * tRPC Server Setup
 *
 * This file sets up the core tRPC configuration for our AI backend.
 * Following tRPC v10+ best practices for type-safe API development.
 */
import { initTRPC, TRPCError } from '@trpc/server';
import superjson from 'superjson';
/**
 * Create context for each request
 * Extracts user information from JWT token if present
 */
export function createTRPCContext(opts) {
    const authReq = opts.req;
    // Start with JWT middleware user if available
    let user = authReq.user || null;
    // Extract API key from header for BYOK scenarios
    const apiKey = opts.req.headers['x-api-key'];
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
            }
            catch (error) {
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
/**
 * Initialize tRPC with context and transformer
 */
const t = initTRPC
    .context()
    .meta()
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
export const router = t.router;
export const publicProcedure = t.procedure;
/**
 * Protected procedure - requires valid JWT authentication
 */
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
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
export const tokenProtectedProcedure = protectedProcedure.use(async ({ ctx, next }) => {
    // This will be used in AI router for token balance checking
    // The actual token balance check will be done in the AI router
    return next({
        ctx: {
            ...ctx,
            // User is guaranteed to exist from protectedProcedure
        },
    });
});
