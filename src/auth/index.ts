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

// Interfaces
export type { 
  User, 
  UserDevice, 
  OAuthData,
  DatabaseAdapter 
} from './user-manager.js';

export type {
  UserKey,
  KeyValidationResult,
  KeyStorageAdapter,
  AIProviderValidator
} from './key-manager.js';

export type {
  AuthSession,
  OAuthProvider,
  PasskeyCredential,
  AuthUpgradeOptions
} from './auth-manager.js';

// Private key authentication types removed for security reasons
// Use OAuth authentication instead

export type {
  OAuthSession,
  OAuthConfig
} from './oauth-auth-manager.js';

// Database and validation
export { SQLiteAdapter } from '../database/sqlite-adapter.js';
export { AIKeyValidator } from '../services/ai-validator.js';

// Client (now in main client.ts)
export type { 
  AIClientOptions,
  DeviceInfo,
  AuthUpgradePrompt 
} from '../client.js';