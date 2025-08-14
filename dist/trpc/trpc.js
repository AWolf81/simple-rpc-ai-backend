/**
 * tRPC Server Setup
 *
 * This file sets up the core tRPC configuration for our AI backend.
 * Following tRPC v10+ best practices for type-safe API development.
 */
import { initTRPC } from '@trpc/server';
import superjson from 'superjson';
/**
 * Create context for each request
 * This is where you'd add authentication, database connections, etc.
 */
export function createTRPCContext(opts) {
    return {
        req: opts.req,
        res: opts.res,
        // Add user session, database, etc. here
        user: null, // Will be populated by auth middleware
    };
}
/**
 * Initialize tRPC with context and transformer
 */
const t = initTRPC.context().create({
    transformer: superjson,
    errorFormatter({ shape }) {
        return shape;
    },
});
/**
 * Export reusable router and procedure helpers
 * These are the building blocks for our API
 */
export const createTRPCRouter = t.router;
export const publicProcedure = t.procedure;
/**
 * Protected procedure (can be extended for authentication)
 */
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
    // Add authentication logic here
    // For now, just pass through
    return next({
        ctx: {
            ...ctx,
            // user: ctx.user, // Add user from auth
        },
    });
});
//# sourceMappingURL=trpc.js.map