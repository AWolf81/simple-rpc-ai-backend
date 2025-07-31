/**
 * Simple RPC AI Backend - Main Entry Point
 *
 * Exports all the main components for creating RPC AI backend servers
 * and clients for VS Code extensions with BYOK and progressive authentication.
 */
export { RPCClient } from './client.js';
export { AIClient } from './client.js';
export { AIService } from './services/ai-service.js';
export { createAIServer, createAIServerAsync } from './server.js';
export { FunctionRegistry } from './services/function-registry.js';
export { PromptManager, promptManager } from './services/prompt-manager.js';
export { UserManager, SimpleKeyManager, AuthManager, SQLiteAdapter, AIKeyValidator } from './auth/index.js';
export type { ClientOptions } from './client.js';
export type { AIServiceConfig } from './services/ai-service.js';
export type { User, UserDevice, OAuthData, UserKey, AuthSession, DeviceInfo, AuthUpgradePrompt } from './auth/index.js';
export type { AIServerConfig, AIServerAsyncConfig } from './server.js';
export type { PromptTemplate, PromptContext } from './services/prompt-manager.js';
export type { CustomFunctionDefinition, CustomFunctionRequest, CustomFunctionResult } from './services/function-registry.js';
export { createAIServer as default } from './server.js';
//# sourceMappingURL=index.d.ts.map