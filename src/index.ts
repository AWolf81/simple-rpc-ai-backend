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
export { AIService } from './services/ai/ai-service';      // Direct AI service usage
export { generateTRPCMethods, createAppRouter } from './trpc/root';
export { router, publicProcedure, protectedProcedure } from './trpc/index';
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

// Note: Simplified server creation has been integrated into the main rpc-ai-server
// Use createRpcAiServer() with the serverWorkspaces configuration for file access

// AI Limit Presets for common use cases
export { AI_LIMIT_PRESETS } from './trpc/routers/ai/types';
export type { AIRouterConfig, AIRouterType } from './trpc/routers/ai';

// Model Registry (new unified registry with @anolilab/ai-model-registry integration)
export { ModelRegistry } from './services/ai/model-registry';
export type { ModelInfo } from './services/ai/model-registry';

// Hybrid Model Registry (production-safe versioned model registry)
export { HybridModelRegistry, hybridRegistry } from './services/ai/hybrid-model-registry';
export type { HybridModel } from './services/ai/hybrid-model-registry';

// tRPC router types for client type safety
export type { AppRouter, RouterInputs, RouterOutputs } from './trpc/root';

// Development tools are available in tools/ directory as standalone scripts


// Custom function system
export { FunctionRegistry } from './services/ai/function-registry';
export { PromptManager, promptManager } from './services/ai/prompt-manager';

// Workspace management (replaces root folder management)
export { WorkspaceManager, defaultWorkspaceManager, createWorkspaceManager } from './services/resources/workspace-manager';

// Legacy root folder management (deprecated - use WorkspaceManager instead)
export { RootManager, defaultRootManager, createRootManager } from './services/resources/root-manager';

// MCP (Model Context Protocol) Integration
export { MCPService, MCPUtils, getDefaultMCPService, initializeDefaultMCPService, setDefaultMCPServiceInstance } from './services/mcp/mcp-service';
export { MCPRegistryService, PREDEFINED_MCP_SERVERS } from './services/mcp/mcp-registry';
export { MCPAIService } from './services/ai/mcp-ai-service';
export { RefMCPIntegration, VSCodeRefIntegration } from './services/mcp/ref-mcp-integration';

// Remote MCP Client & Manager - Connect to external MCP servers
export { RemoteMCPClient, createRemoteMCPClient } from './mcp/remote-mcp-client';
export { RemoteMCPManager, createRemoteMCPManager } from './mcp/remote-mcp-manager';
export type { RemoteMCPServerConfig, RemoteMCPTransport, MCPMessage } from './mcp/remote-mcp-client';
export type { RemoteMCPManagerConfig, RemoteServerStatus } from './mcp/remote-mcp-manager';

// MCP Security Scanner - Scan MCP packages for security risks
export { scanMCPServerPackage } from './security/mcp-server-scanner';
export type { SecurityScanResult, SecurityMatch, PackageMetadata } from './security/mcp-server-scanner';

// MCP Resource Registry - Flexible resource system
export {
  MCPResourceRegistry,
  mcpResourceRegistry,
  registerMCPResource,
  registerMCPTemplate,
  registerMCPProvider,
  MCPResourceHelpers,
  GlobalResourceTemplates
} from './services/resources/mcp/mcp-resource-registry';

// MCP Template Engine - Reusable template API
export {
  TemplateBuilder,
  QuickTemplates,
  TemplateRegistry,
  createTemplate
} from './services/resources/template-engine';

// MCP Resource Helpers - Common error handlers and utilities
export {
  handleMCPResourceParameters,
  validateMCPParameters,
  generateMCPHelpText,
  createMCPResourceHandler,
  createMissingParameterError
} from './services/resources/mcp/mcp-resource-helpers';

// File Reader Helpers - Easy file access with root manager
export {
  createFileReader,
  createDirectoryLister,
  FileReaderHelpers
} from './services/resources/file-reader-helper';

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
} from './services/ai/ai-service';

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
} from './services/ai/prompt-manager';

export type {
  CustomFunctionDefinition,
  CustomFunctionRequest,
  CustomFunctionResult
} from './services/ai/function-registry';

// MCP Types
export type {
  MCPServiceConfig,
  AIToolRequest,
  AIToolResponse,
  MCPToolDefinition
} from './services/mcp/mcp-service';

export type {
  MCPServerConfig,
  MCPTool,
  MCPServerStatus,
  MCPToolRequest,
  MCPToolResponse
} from './services/mcp/mcp-registry';

export type {
  MCPAIServiceConfig,
  EnhancedExecuteRequest,
  EnhancedExecuteResult
} from './services/ai/mcp-ai-service';

export type {
  RefMCPConfig,
  DocumentationSearchRequest,
  DocumentationSearchResult,
  URLReadRequest,
  URLReadResult
} from './services/mcp/ref-mcp-integration';

// MCP Resource Registry Types
export type {
  MCPResource,
  MCPResourceProvider,
  MCPResourceTemplate
} from './services/resources/mcp/mcp-resource-registry';

// MCP Template Engine Types
export type {
  TemplateParameter,
  TemplateConfig,
  ContentResult,
  ContentGenerator,
  FormatHandler
} from './services/resources/template-engine';

// MCP Resource Helper Types
export type {
  MCPParameter,
  MCPResourceHelp,
  ParameterValidationResult
} from './services/resources/mcp/mcp-resource-helpers';

// File Reader Helper Types
export type {
  FileReaderConfig,
  FileMetadata,
  FileContent
} from './services/resources/file-reader-helper';

// Workspace Manager Types (replaces Root Manager Types)
export type {
  ServerWorkspaceConfig,
  ClientWorkspaceInfo,
  FileInfo as WorkspaceFileInfo,
  WorkspaceManagerConfig
} from './services/resources/workspace-manager';

// Legacy Root Manager Types (deprecated - use WorkspaceManager types instead)
export type {
  RootFolderConfig,
  ClientRootFolderInfo,
  FileInfo,
  RootManagerConfig
} from './services/resources/root-manager';

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

// OAuth helpers and template configuration
export {
  ExpressOAuthServer,
  getIdentityProviders,
  configureOAuthTemplates,
  createOAuthModel,
  normalizeUserProfile
} from './auth/oauth-middleware';
export type {
  HandlebarsTemplateConfig,
  HandlebarsTemplateData
} from './auth/oauth-middleware';

// Development tools (legacy - use the new dev-panel-api for easier integration)
// export { startDevPanel, createServerWithDevPanel, checkDevPanelRunning } from './dev-panel';
// export type { DevPanelConfig } from './dev-panel';

// MCP Helper Functions (simplified imports for common use)
export {
  createMCPTool,
  createAdminMCPTool,
  createMCPPrompt,
  ScopeHelpers,
  ScopeValidator,
  DefaultScopes
} from './auth/scopes';
export type {
  MCPToolScope,
  MCPPromptConfig,
  MCPPromptArgument,
  ScopeRequirement,
  ScopePattern
} from './auth/scopes';

// Dev Panel - Easy development tools for package consumers
export { startDevPanel, quickStartDevPanel } from './tools/dev-panel-api';
export type { DevPanelConfig } from './tools/dev-panel-api';

// Default export - unified server for new projects
export { createRpcAiServer as default } from './rpc-ai-server';
