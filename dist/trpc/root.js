/**
 * Main tRPC App Router
 *
 * Combines all sub-routers into the main application router.
 * This is the single source of truth for all tRPC procedures.
 */
import { createAIRouter } from './routers/ai.js';
/**
 * Create app router with configurable AI limits and optional token tracking
 *
 * Since this is a dedicated AI backend, all procedures are at the root level
 * for cleaner API: client.executeAIRequest.mutate() instead of client.ai.executeAIRequest.mutate()
 */
export function createAppRouter(aiConfig, tokenTrackingEnabled, dbAdapter, serverProviders, byokProviders) {
    // Return AI router directly as the root router for simpler API
    return createAIRouter(aiConfig, tokenTrackingEnabled, dbAdapter, serverProviders, byokProviders);
}
/**
 * Default app router with default configuration
 */
export const appRouter = createAppRouter();
//# sourceMappingURL=root.js.map