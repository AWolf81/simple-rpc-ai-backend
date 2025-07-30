/**
 * Simple RPC AI Backend - Main Entry Point
 * 
 * Exports all the main components for creating RPC AI backend servers
 * and clients for VS Code extensions with BYOK and progressive authentication.
 */

// Core components
export { RPCClient } from './client.js';          // Basic JSON-RPC client (platform-agnostic)
export { AIClient } from './client.js';           // Enhanced client with BYOK
export { AIService } from './services/ai-service.js';      // Direct AI service usage
export { createAIServer, createAIServerAsync } from './server.js';     // Server factories

// Custom function system
export { FunctionRegistry } from './services/function-registry.js';
export { PromptManager, promptManager } from './services/prompt-manager.js';

// Authentication system exports
export {
  UserManager,
  SimpleKeyManager,
  AuthManager,
  SQLiteAdapter,
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

export type {
  AIServerConfig,
  AIServerAsyncConfig
} from './server.js';

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

// Default export - progressive server for new projects (now async)
export { createAIServer as default } from './server.js';