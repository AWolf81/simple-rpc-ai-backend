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
// Default export - progressive server for new projects (now async)
export { createAIServer as default } from './server.js';
//# sourceMappingURL=index.js.map