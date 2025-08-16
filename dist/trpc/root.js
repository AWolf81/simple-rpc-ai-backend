/**
 * Main tRPC App Router
 *
 * Combines all sub-routers into the main application router.
 * This is the single source of truth for all tRPC procedures.
 */
import { createTRPCRouter } from './index.js';
import { createAIRouter } from './routers/ai.js';
/**
 * Create app router with configurable AI limits and optional token tracking
 */
export function createAppRouter(aiConfig, tokenTrackingEnabled, dbAdapter) {
    return createTRPCRouter({
        ai: createAIRouter(aiConfig, tokenTrackingEnabled, dbAdapter),
        // Add more routers here as needed:
        // auth: authRouter,
        // billing: billingRouter,
        // etc.
    });
}
/**
 * Default app router with default configuration
 */
export const appRouter = createAppRouter();
//# sourceMappingURL=root.js.map