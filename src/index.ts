/**
 * Simple RPC AI Backend - Main Entry Point
 * 
 * Exports all the main components for creating RPC AI backend servers
 * and clients for VS Code extensions with BYOK and progressive authentication.
 */

// Core components
export { RPCClient } from './client';          // Basic JSON-RPC client (platform-agnostic)
export { AIClient } from './client';           // Enhanced client with BYOK

// tRPC Client Support
export { createTypedAIClient } from './client';
export type { TypedAIClient } from './client';
export { AIService } from './services/ai-service';      // Direct AI service usage
export { generateTRPCMethods, createAppRouter } from './trpc/root';
// export { createTestRouter } from './trpc/test-router';
// OpenAPI-related exports temporarily disabled
// export { 
//   openApiCompatMiddleware, 
//   openApiCompatProcedure, 
//   createOpenApiCompatRouter,
//   patchTrpcToOpenApi,
//   makeRouterOpenApiCompatible 
// } from './trpc/openapi-compat-middleware';

// getRawInput fix for trpc-to-openapi compatibility (disabled)
// export {
//   openApiProcedure,
//   createOpenApiRouter,
//   createFixedProcedure,
//   procedures,
//   createGetRawInputTestRouter,
//   wrapRouterWithGetRawInputFix,
//   debugProcedureInputs
// } from './trpc/getrawinput-fix';

// Recommended server - supports both JSON-RPC and tRPC
export { createRpcAiServer, RpcAiServer, defineRpcAiServerConfig } from './rpc-ai-server';
export type { RpcAiServerConfig, CustomProvider, BuiltInProvider } from './rpc-ai-server';

// AI Limit Presets for common use cases
export { AI_LIMIT_PRESETS } from './trpc/routers/ai';
export type { AIRouterConfig, AIRouterType } from './trpc/routers/ai';

// Provider Registry types
export type { ProviderConfig, ModelConfig, PricingInfo, RegistryHealthStatus } from './services/provider-registry';

// tRPC router types for client type safety
export type { AppRouter, RouterInputs, RouterOutputs } from './trpc/root';

// Development tools are available in tools/ directory as standalone scripts


// Custom function system
export { FunctionRegistry } from './services/function-registry';
export { PromptManager, promptManager } from './services/prompt-manager';

// MCP (Model Context Protocol) Integration
export { MCPService, MCPUtils, getDefaultMCPService, initializeDefaultMCPService, setDefaultMCPServiceInstance } from './services/mcp-service';
export { MCPRegistryService, PREDEFINED_MCP_SERVERS } from './services/mcp-registry';
export { MCPAIService } from './services/mcp-ai-service';
export { RefMCPIntegration, VSCodeRefIntegration } from './services/ref-mcp-integration';

// Authentication system exports
export {
  UserManager,
  SimpleKeyManager,
  AuthManager,
  PostgreSQLAdapter,
  AIKeyValidator
} from './auth/index';

// Re-export legacy types
export type {
  ClientOptions
} from './client';

export type {
  AIServiceConfig
} from './services/ai-service';

// New progressive authentication types
export type {
  User,
  UserDevice,
  OAuthData,
  UserKey,
  AuthSession,
  DeviceInfo,
  AuthUpgradePrompt
} from './auth/index';




// Custom function types
export type {
  PromptTemplate,
  PromptContext
} from './services/prompt-manager';

export type {
  CustomFunctionDefinition,
  CustomFunctionRequest,
  CustomFunctionResult
} from './services/function-registry';

// MCP Types
export type {
  MCPServiceConfig,
  AIToolRequest,
  AIToolResponse,
  MCPToolDefinition
} from './services/mcp-service';

export type {
  MCPServerConfig,
  MCPTool,
  MCPServerStatus,
  MCPToolRequest,
  MCPToolResponse
} from './services/mcp-registry';

export type {
  MCPAIServiceConfig,
  EnhancedExecuteRequest,
  EnhancedExecuteResult
} from './services/mcp-ai-service';

export type {
  RefMCPConfig,
  DocumentationSearchRequest,
  DocumentationSearchResult,
  URLReadRequest,
  URLReadResult
} from './services/ref-mcp-integration';

export type {
  MCPRouterConfig,
  //MCPRouterType
} from './trpc/routers/mcp';

// OpenSaaS Monetization exports
export { createMonetizedAIServer } from './monetization/opensaas-server';
export {
  createOpenSaaSConfig,
  mergeOpenSaaSConfig,
  validateOpenSaaSConfig,
  EXAMPLE_CUSTOM_TIERS,
  DEFAULT_OPENSAAS_CONFIG
} from './monetization/opensaas-config';

// JWT Authentication middleware
export {
  JWTMiddleware,
  DEFAULT_TIER_CONFIGS,
  getTierConfig,
  mergeWithDefaultTiers
} from './auth/jwt-middleware';

// Rate limiting
export { RateLimiter, DEFAULT_TIER_LIMITS } from './middleware/rate-limiter';

// Usage tracking and billing
export { UsageTracker, PROVIDER_PRICING } from './billing/usage-tracker';
export { BillingEngine } from './billing/billing-engine';

// Export monetization types
export type {
  OpenSaaSJWTPayload,
  AuthenticatedRequest,
  SubscriptionTierConfig,
  JWTMiddlewareConfig
} from './auth/jwt-middleware';

export type {
  RateLimits,
  RateLimitConfig,
  RateLimitResult
} from './middleware/rate-limiter';

export type {
  UsageEvent,
  UsageSummary,
  QuotaStatus
} from './billing/usage-tracker';

export type {
  BillingEvent,
  BillingConfig,
  SubscriptionInfo
} from './billing/billing-engine';

export type {
  OpenSaaSMonetizationConfig,
  MonetizedAIServerConfig
} from './monetization/opensaas-config';

export type {
  MonetizedServerInstance
} from './monetization/opensaas-server';

// Default export - unified server for new projects
export { createRpcAiServer as default } from './rpc-ai-server';