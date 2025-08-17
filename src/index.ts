/**
 * Simple RPC AI Backend - Main Entry Point
 * 
 * Exports all the main components for creating RPC AI backend servers
 * and clients for VS Code extensions with BYOK and progressive authentication.
 */

// Core components
export { RPCClient } from './client.js';          // Basic JSON-RPC client (platform-agnostic)
export { AIClient } from './client.js';           // Enhanced client with BYOK

// tRPC Client Support
export { createTypedAIClient, createAIServiceClient } from './client.js';
export type { TypedAIClient } from './client.js';
export { AIService } from './services/ai-service.js';      // Direct AI service usage
// Recommended server - supports both JSON-RPC and tRPC
export { createRpcAiServer, RpcAiServer, defineRpcAiServerConfig } from './rpc-ai-server.js';
export type { RpcAiServerConfig, CustomProvider, BuiltInProvider } from './rpc-ai-server.js';

// AI Limit Presets for common use cases
export { AI_LIMIT_PRESETS } from './trpc/routers/ai.js';
export type { AIRouterConfig } from './trpc/routers/ai.js';

// tRPC router types for client type safety
export type { AppRouter, RouterInputs, RouterOutputs } from './trpc/root.js';

// Development tools (separate from main server)
export { TrpcPanelServer, startTrpcPanel, createLocalPanelServer } from './dev/trpc-panel-server.js';
export type { PanelServerConfig } from './dev/trpc-panel-server.js';


// Custom function system
export { FunctionRegistry } from './services/function-registry.js';
export { PromptManager, promptManager } from './services/prompt-manager.js';

// Authentication system exports
export {
  UserManager,
  SimpleKeyManager,
  AuthManager,
  PostgreSQLAdapter,
  AIKeyValidator
} from './auth/index.js';

// Re-export legacy types
export type {
  ClientOptions
} from './client.js';

export type {
  AIServiceConfig
} from './services/ai-service.js';

// New progressive authentication types
export type {
  User,
  UserDevice,
  OAuthData,
  UserKey,
  AuthSession,
  DeviceInfo,
  AuthUpgradePrompt
} from './auth/index.js';


// Custom function types
export type {
  PromptTemplate,
  PromptContext
} from './services/prompt-manager.js';

export type {
  CustomFunctionDefinition,
  CustomFunctionRequest,
  CustomFunctionResult
} from './services/function-registry.js';

// OpenSaaS Monetization exports
export { createMonetizedAIServer } from './monetization/opensaas-server.js';
export {
  createOpenSaaSConfig,
  mergeOpenSaaSConfig,
  validateOpenSaaSConfig,
  EXAMPLE_CUSTOM_TIERS,
  DEFAULT_OPENSAAS_CONFIG
} from './monetization/opensaas-config.js';

// JWT Authentication middleware
export {
  JWTMiddleware,
  DEFAULT_TIER_CONFIGS,
  getTierConfig,
  mergeWithDefaultTiers
} from './auth/jwt-middleware.js';

// Rate limiting
export { RateLimiter, DEFAULT_TIER_LIMITS } from './middleware/rate-limiter.js';

// Usage tracking and billing
export { UsageTracker, PROVIDER_PRICING } from './billing/usage-tracker.js';
export { BillingEngine } from './billing/billing-engine.js';

// Export monetization types
export type {
  OpenSaaSJWTPayload,
  AuthenticatedRequest,
  SubscriptionTierConfig,
  JWTMiddlewareConfig
} from './auth/jwt-middleware.js';

export type {
  RateLimits,
  RateLimitConfig,
  RateLimitResult
} from './middleware/rate-limiter.js';

export type {
  UsageEvent,
  UsageSummary,
  QuotaStatus
} from './billing/usage-tracker.js';

export type {
  BillingEvent,
  BillingConfig,
  SubscriptionInfo
} from './billing/billing-engine.js';

export type {
  OpenSaaSMonetizationConfig,
  MonetizedAIServerConfig
} from './monetization/opensaas-config.js';

export type {
  MonetizedServerInstance
} from './monetization/opensaas-server.js';

// Default export - unified server for new projects
export { createRpcAiServer as default } from './rpc-ai-server.js';