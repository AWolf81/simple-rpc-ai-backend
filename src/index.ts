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
export { AIService } from './services/ai/ai-service';      // Direct AI service usage
export { generateTRPCMethods, createAppRouter } from './trpc/root';
export { router, publicProcedure, protectedProcedure } from './trpc/index';
// Shared type exports
export * from './types/';

// Recommended server - supports both JSON-RPC and tRPC
export { createRpcAiServer, RpcAiServer, defineRpcAiServerConfig } from './rpc-ai-server';

// Testing utilities (for consumer unit tests)
export { createContextInner, createTestCaller } from './utils/trpc-test-helpers';

// Note: OpenSaaSJWTPayload is already exported below in the auth section

// Note: Simplified server creation has been integrated into the main rpc-ai-server
// Use createRpcAiServer() with the serverWorkspaces configuration for file access

// AI Limit Presets for common use cases
export { AI_LIMIT_PRESETS } from './trpc/routers/ai/types';

// Model Registry (new unified registry with @anolilab/ai-model-registry integration)
export { ModelRegistry } from './services/ai/model-registry';

// Hybrid Model Registry (production-safe versioned model registry)
export { HybridModelRegistry, hybridRegistry } from './services/ai/hybrid-model-registry';

// tRPC router types for client type safety

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

// MCP Security Scanner - Scan MCP packages for security risks
export { scanMCPServerPackage } from './security/mcp-server-scanner';

// Extension OAuth - Simplified OAuth for browser/VS Code extensions
export {
  createExtensionOAuthHandler,
  encodeOAuthState,
  decodeOAuthState,
} from './auth/extension-oauth';

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


// OAuth helpers and template configuration
export {
  ExpressOAuthServer,
  getIdentityProviders,
  configureOAuthTemplates,
  createOAuthModel,
  normalizeUserProfile
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

// Dev Panel - Easy development tools for package consumers
export { startDevPanel, quickStartDevPanel } from './tools/dev-panel-api';

// Default export - unified server for new projects
export { createRpcAiServer as default } from './rpc-ai-server';
