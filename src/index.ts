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
export { createTypedAIClient } from './client.js';
export type { TypedAIClient } from './client.js';
export { AIService } from './services/ai/ai-service.js';      // Direct AI service usage
export { generateTRPCMethods, createAppRouter } from './trpc/root.js';
export { router, publicProcedure, protectedProcedure } from './trpc/index.js';
// export { createTestRouter } from './trpc/test-router.js';
// OpenAPI-related exports temporarily disabled
// export { 
//   openApiCompatMiddleware, 
//   openApiCompatProcedure, 
//   createOpenApiCompatRouter,
//   patchTrpcToOpenApi,
//   makeRouterOpenApiCompatible 
// } from './trpc/openapi-compat-middleware.js';

// getRawInput fix for trpc-to-openapi compatibility (disabled)
// export {
//   openApiProcedure,
//   createOpenApiRouter,
//   createFixedProcedure,
//   procedures,
//   createGetRawInputTestRouter,
//   wrapRouterWithGetRawInputFix,
//   debugProcedureInputs
// } from './trpc/getrawinput-fix.js';

// Recommended server - supports both JSON-RPC and tRPC
export { createRpcAiServer, RpcAiServer, defineRpcAiServerConfig } from './rpc-ai-server.js';
export type { RpcAiServerConfig, CustomProvider, BuiltInProvider, ProviderConfig } from './rpc-ai-server.js';

// Provider configuration utilities
export {
  parseProviders,
  validateProviderConfig,
  getProviderConfig,
  mergeProviderConfig
} from './config/provider-parser.js';
export type { ParsedProvider, ProviderParseResult } from './config/provider-parser.js';

// Testing utilities (for consumer unit tests)
export { createContextInner, createTestCaller } from './utils/trpc-test-helpers.js';
export type { CreateContextOptions, TestContext } from './utils/trpc-test-helpers.js';

// Note: OpenSaaSJWTPayload is already exported below in the auth section

// Note: Simplified server creation has been integrated into the main rpc-ai-server
// Use createRpcAiServer() with the serverWorkspaces configuration for file access

// AI Limit Presets for common use cases
export { AI_LIMIT_PRESETS } from './trpc/routers/ai/types.js';
export type { AIRouterConfig, AIRouterType } from './trpc/routers/ai';

// Model Registry (new unified registry with @anolilab/ai-model-registry integration)
export { ModelRegistry } from './services/ai/model-registry.js';
export type { ModelInfo } from './services/ai/model-registry.js';

// Hybrid Model Registry (production-safe versioned model registry)
export { HybridModelRegistry, hybridRegistry } from './services/ai/hybrid-model-registry.js';
export type { HybridModel } from './services/ai/hybrid-model-registry.js';

// tRPC router types for client type safety
export type { AppRouter, RouterInputs, RouterOutputs } from './trpc/root.js';

// Development tools are available in tools/ directory as standalone scripts


// Custom function system
export { FunctionRegistry } from './services/ai/function-registry.js';
export { PromptManager, promptManager } from './services/ai/prompt-manager.js';

// Workspace management (replaces root folder management)
export { WorkspaceManager, defaultWorkspaceManager, createWorkspaceManager } from './services/resources/workspace-manager.js';

// Legacy root folder management (deprecated - use WorkspaceManager instead)
export { RootManager, defaultRootManager, createRootManager } from './services/resources/root-manager.js';

// MCP (Model Context Protocol) Integration
export { MCPService, MCPUtils, getDefaultMCPService, initializeDefaultMCPService, setDefaultMCPServiceInstance } from './services/mcp/mcp-service.js';
export { MCPRegistryService, PREDEFINED_MCP_SERVERS } from './services/mcp/mcp-registry.js';
export { MCPAIService } from './services/ai/mcp-ai-service.js';
export { RefMCPIntegration, VSCodeRefIntegration } from './services/mcp/ref-mcp-integration.js';

// Remote MCP Client & Manager - Connect to external MCP servers
export { RemoteMCPClient, createRemoteMCPClient } from './mcp/remote-mcp-client.js';
export { RemoteMCPManager, createRemoteMCPManager } from './mcp/remote-mcp-manager.js';
export type { RemoteMCPServerConfig, RemoteMCPTransport, MCPMessage } from './mcp/remote-mcp-client.js';
export type { RemoteMCPManagerConfig, RemoteServerStatus } from './mcp/remote-mcp-manager.js';

// MCP Security Scanner - Scan MCP packages for security risks
export { scanMCPServerPackage } from './security/mcp-server-scanner.js';
export type { SecurityScanResult, SecurityMatch, PackageMetadata } from './security/mcp-server-scanner.js';

// Extension OAuth - Simplified OAuth for browser/VS Code extensions
export {
  createExtensionOAuthHandler,
  encodeOAuthState,
  decodeOAuthState,
} from './auth/extension-oauth.js';
export type { ExtensionOAuthConfig } from './auth/extension-oauth.js';

// MCP Resource Registry - Flexible resource system
export {
  MCPResourceRegistry,
  mcpResourceRegistry,
  registerMCPResource,
  registerMCPTemplate,
  registerMCPProvider,
  MCPResourceHelpers,
  GlobalResourceTemplates
} from './services/resources/mcp/mcp-resource-registry.js';

// MCP Template Engine - Reusable template API
export {
  TemplateBuilder,
  QuickTemplates,
  TemplateRegistry,
  createTemplate
} from './services/resources/template-engine.js';

// MCP Resource Helpers - Common error handlers and utilities
export {
  handleMCPResourceParameters,
  validateMCPParameters,
  generateMCPHelpText,
  createMCPResourceHandler,
  createMissingParameterError
} from './services/resources/mcp/mcp-resource-helpers.js';

// File Reader Helpers - Easy file access with root manager
export {
  createFileReader,
  createDirectoryLister,
  FileReaderHelpers
} from './services/resources/file-reader-helper.js';

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
} from './services/ai/ai-service.js';

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
} from './services/ai/prompt-manager.js';

export type {
  CustomFunctionDefinition,
  CustomFunctionRequest,
  CustomFunctionResult
} from './services/ai/function-registry.js';

// MCP Types
export type {
  MCPServiceConfig,
  AIToolRequest,
  AIToolResponse,
  MCPToolDefinition
} from './services/mcp/mcp-service.js';

export type {
  MCPServerConfig,
  MCPTool,
  MCPServerStatus,
  MCPToolRequest,
  MCPToolResponse
} from './services/mcp/mcp-registry.js';

export type {
  MCPAIServiceConfig,
  EnhancedExecuteRequest,
  EnhancedExecuteResult
} from './services/ai/mcp-ai-service.js';

export type {
  RefMCPConfig,
  DocumentationSearchRequest,
  DocumentationSearchResult,
  URLReadRequest,
  URLReadResult
} from './services/mcp/ref-mcp-integration.js';

// MCP Resource Registry Types
export type {
  MCPResource,
  MCPResourceProvider,
  MCPResourceTemplate
} from './services/resources/mcp/mcp-resource-registry.js';

// MCP Template Engine Types
export type {
  TemplateParameter,
  TemplateConfig,
  ContentResult,
  ContentGenerator,
  FormatHandler
} from './services/resources/template-engine.js';

// MCP Resource Helper Types
export type {
  MCPParameter,
  MCPResourceHelp,
  ParameterValidationResult
} from './services/resources/mcp/mcp-resource-helpers.js';

// File Reader Helper Types
export type {
  FileReaderConfig,
  FileMetadata,
  FileContent
} from './services/resources/file-reader-helper.js';

// Workspace Manager Types (replaces Root Manager Types)
export type {
  ServerWorkspaceConfig,
  ClientWorkspaceInfo,
  FileInfo as WorkspaceFileInfo,
  WorkspaceManagerConfig
} from './services/resources/workspace-manager.js';

// Legacy Root Manager Types (deprecated - use WorkspaceManager types instead)
export type {
  RootFolderConfig,
  ClientRootFolderInfo,
  FileInfo,
  RootManagerConfig
} from './services/resources/root-manager.js';

export type {
  MCPRouterConfig,
  //MCPRouterType
} from './trpc/routers/mcp';

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

// OAuth helpers and template configuration
export {
  ExpressOAuthServer,
  getIdentityProviders,
  configureOAuthTemplates,
  createOAuthModel,
  normalizeUserProfile
} from './auth/oauth-middleware.js';
export type {
  HandlebarsTemplateConfig,
  HandlebarsTemplateData
} from './auth/oauth-middleware.js';

// Development tools (legacy - use the new dev-panel-api for easier integration)
// export { startDevPanel, createServerWithDevPanel, checkDevPanelRunning } from './dev-panel.js';
// export type { DevPanelConfig } from './dev-panel.js';

// MCP Helper Functions (simplified imports for common use)
export {
  createMCPTool,
  createAdminMCPTool,
  createMCPPrompt,
  ScopeHelpers,
  ScopeValidator,
  DefaultScopes
} from './auth/scopes.js';
export type {
  MCPToolScope,
  MCPPromptConfig,
  MCPPromptArgument,
  ScopeRequirement,
  ScopePattern
} from './auth/scopes.js';

// Dev Panel - Easy development tools for package consumers
export { startDevPanel, quickStartDevPanel } from './tools/dev-panel-api.js';
export type { DevPanelConfig } from './tools/dev-panel-api.js';

// Default export - unified server for new projects
export { createRpcAiServer as default } from './rpc-ai-server.js';
