/**
 * Simple RPC AI Backend - Main Entry Point
 *
 * Exports all the main components for creating RPC AI backend servers
 * and clients for VS Code extensions with BYOK and progressive authentication.
 */
// Core components
export { RPCClient } from './client.js'; // Basic JSON-RPC client (platform-agnostic)
export { AIClient } from './client.js'; // Enhanced client with BYOK
export { AIService } from './services/ai-service.js'; // Direct AI service usage
export { createAIServer, createAIServerAsync } from './server.js'; // Server factories
// Custom function system
export { FunctionRegistry } from './services/function-registry.js';
export { PromptManager, promptManager } from './services/prompt-manager.js';
// Authentication system exports
export { UserManager, SimpleKeyManager, AuthManager, SQLiteAdapter, AIKeyValidator } from './auth/index.js';
// OpenSaaS Monetization exports
export { createMonetizedAIServer } from './monetization/opensaas-server.js';
export { createOpenSaaSConfig, mergeOpenSaaSConfig, validateOpenSaaSConfig, EXAMPLE_CUSTOM_TIERS, DEFAULT_OPENSAAS_CONFIG } from './monetization/opensaas-config.js';
// JWT Authentication middleware
export { JWTMiddleware, DEFAULT_TIER_CONFIGS, getTierConfig, mergeWithDefaultTiers } from './auth/jwt-middleware.js';
// Rate limiting
export { RateLimiter, DEFAULT_TIER_LIMITS } from './middleware/rate-limiter.js';
// Usage tracking and billing
export { UsageTracker, PROVIDER_PRICING } from './billing/usage-tracker.js';
export { BillingEngine } from './billing/billing-engine.js';
// Default export - progressive server for new projects (now async)
export { createAIServer as default } from './server.js';
//# sourceMappingURL=index.js.map