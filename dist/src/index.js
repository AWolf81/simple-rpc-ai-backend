/**
 * Simple RPC AI Backend - Main Entry Point
 *
 * Exports all the main components for creating RPC AI backend servers
 * and clients for VS Code extensions with BYOK and progressive authentication.
 */
// Core components
export { RPCClient } from './client.js'; // Basic JSON-RPC client (platform-agnostic)
export { AIClient } from './client.js'; // Enhanced client with BYOK
// tRPC Client Support
export { createTypedAIClient } from './client.js';
export { AIService } from './services/ai-service.js'; // Direct AI service usage
export { generateTRPCMethods, createAppRouter } from './trpc/root.js';
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
export { createRpcAiServer, RpcAiServer, defineRpcAiServerConfig } from './rpc-ai-server.js';
// AI Limit Presets for common use cases
export { AI_LIMIT_PRESETS } from './trpc/routers/ai.js';
// Development tools (separate from main server)
export { TrpcPanelServer, startTrpcPanel, createLocalPanelServer } from './dev/trpc-panel-server.js';
// Custom function system
export { FunctionRegistry } from './services/function-registry.js';
export { PromptManager, promptManager } from './services/prompt-manager.js';
// MCP (Model Context Protocol) Integration
export { MCPService, MCPUtils, getDefaultMCPService, initializeDefaultMCPService, setDefaultMCPServiceInstance } from './services/mcp-service.js';
export { MCPRegistryService, PREDEFINED_MCP_SERVERS } from './services/mcp-registry.js';
export { MCPAIService } from './services/mcp-ai-service.js';
export { RefMCPIntegration, VSCodeRefIntegration } from './services/ref-mcp-integration.js';
// Authentication system exports
export { UserManager, SimpleKeyManager, AuthManager, PostgreSQLAdapter, AIKeyValidator } from './auth/index.js';
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
// Default export - unified server for new projects
export { createRpcAiServer as default } from './rpc-ai-server.js';
