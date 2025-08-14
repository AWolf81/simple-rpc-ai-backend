/**
 * Main tRPC App Router
 *
 * Combines all sub-routers into the main application router.
 * This is the single source of truth for all tRPC procedures.
 */
import { createTRPCRouter } from './trpc.js';
import { aiRouter } from './routers/ai.js';
/**
 * Main app router that combines all feature routers
 */
export const appRouter = createTRPCRouter({
    ai: aiRouter,
    // Add more routers here as needed:
    // auth: authRouter,
    // billing: billingRouter,
    // etc.
});
//# sourceMappingURL=root.js.map