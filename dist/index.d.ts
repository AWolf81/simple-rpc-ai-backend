/**
 * Simple RPC AI Backend - Main Entry Point
 *
 * Exports all the main components for creating RPC AI backend servers
 * and clients for VS Code extensions with BYOK and progressive authentication.
 */
export { RPCClient } from './client.js';
export { AIClient } from './client.js';
export { createTypedAIClient } from './client.js';
export type { TypedAIClient } from './client.js';
export { AIService } from './services/ai-service.js';
export { createRpcAiServer, RpcAiServer, defineRpcAiServerConfig } from './rpc-ai-server.js';
export type { RpcAiServerConfig, CustomProvider, BuiltInProvider } from './rpc-ai-server.js';
export { AI_LIMIT_PRESETS } from './trpc/routers/ai.js';
export type { AIRouterConfig, AIRouterType } from './trpc/routers/ai.js';
export type { ProviderConfig, ModelConfig, PricingInfo, RegistryHealthStatus } from './services/provider-registry.js';
export type { AppRouter, RouterInputs, RouterOutputs } from './trpc/root.js';
export { TrpcPanelServer, startTrpcPanel, createLocalPanelServer } from './dev/trpc-panel-server.js';
export type { PanelServerConfig } from './dev/trpc-panel-server.js';
export { FunctionRegistry } from './services/function-registry.js';
export { PromptManager, promptManager } from './services/prompt-manager.js';
export { UserManager, SimpleKeyManager, AuthManager, PostgreSQLAdapter, AIKeyValidator } from './auth/index.js';
export type { ClientOptions } from './client.js';
export type { AIServiceConfig } from './services/ai-service.js';
export type { User, UserDevice, OAuthData, UserKey, AuthSession, DeviceInfo, AuthUpgradePrompt } from './auth/index.js';
export type { PromptTemplate, PromptContext } from './services/prompt-manager.js';
export type { CustomFunctionDefinition, CustomFunctionRequest, CustomFunctionResult } from './services/function-registry.js';
export { createMonetizedAIServer } from './monetization/opensaas-server.js';
export { createOpenSaaSConfig, mergeOpenSaaSConfig, validateOpenSaaSConfig, EXAMPLE_CUSTOM_TIERS, DEFAULT_OPENSAAS_CONFIG } from './monetization/opensaas-config.js';
export { JWTMiddleware, DEFAULT_TIER_CONFIGS, getTierConfig, mergeWithDefaultTiers } from './auth/jwt-middleware.js';
export { RateLimiter, DEFAULT_TIER_LIMITS } from './middleware/rate-limiter.js';
export { UsageTracker, PROVIDER_PRICING } from './billing/usage-tracker.js';
export { BillingEngine } from './billing/billing-engine.js';
export type { OpenSaaSJWTPayload, AuthenticatedRequest, SubscriptionTierConfig, JWTMiddlewareConfig } from './auth/jwt-middleware.js';
export type { RateLimits, RateLimitConfig, RateLimitResult } from './middleware/rate-limiter.js';
export type { UsageEvent, UsageSummary, QuotaStatus } from './billing/usage-tracker.js';
export type { BillingEvent, BillingConfig, SubscriptionInfo } from './billing/billing-engine.js';
export type { OpenSaaSMonetizationConfig, MonetizedAIServerConfig } from './monetization/opensaas-config.js';
export type { MonetizedServerInstance } from './monetization/opensaas-server.js';
export { createRpcAiServer as default } from './rpc-ai-server.js';
//# sourceMappingURL=index.d.ts.map