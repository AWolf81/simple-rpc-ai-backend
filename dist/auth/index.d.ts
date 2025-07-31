/**
 * Authentication Module Exports
 *
 * Main entry point for all authentication-related classes and interfaces
 */
export { UserManager } from './user-manager.js';
export { SimpleKeyManager } from './key-manager.js';
export { AuthManager } from './auth-manager.js';
export { OAuthAuthManager } from './oauth-auth-manager.js';
export type { User, UserDevice, OAuthData, DatabaseAdapter } from './user-manager.js';
export type { UserKey, KeyValidationResult, KeyStorageAdapter, AIProviderValidator } from './key-manager.js';
export type { AuthSession, OAuthProvider, PasskeyCredential, AuthUpgradeOptions } from './auth-manager.js';
export type { OAuthSession, OAuthConfig } from './oauth-auth-manager.js';
export { SQLiteAdapter } from '../database/sqlite-adapter.js';
export { AIKeyValidator } from '../services/ai-validator.js';
export type { AIClientOptions, DeviceInfo, AuthUpgradePrompt } from '../client.js';
//# sourceMappingURL=index.d.ts.map