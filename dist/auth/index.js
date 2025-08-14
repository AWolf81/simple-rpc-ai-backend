/**
 * Authentication Module Exports
 *
 * Main entry point for all authentication-related classes and interfaces
 */
// Core authentication classes
export { UserManager } from './user-manager.js';
export { SimpleKeyManager } from './key-manager.js';
export { AuthManager } from './auth-manager.js';
// OAuth authentication (recommended secure approach)
export { OAuthAuthManager } from './oauth-auth-manager.js';
// Database and validation
export { PostgreSQLAdapter } from '../database/postgres-adapter.js';
export { AIKeyValidator } from '../services/ai-validator.js';
//# sourceMappingURL=index.js.map