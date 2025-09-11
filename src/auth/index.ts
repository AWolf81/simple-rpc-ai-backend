/**
 * Authentication Module Exports
 * 
 * Main entry point for all authentication-related classes and interfaces
 */

// Core authentication classes
export { UserManager } from './user-manager';
export { SimpleKeyManager } from './key-manager';
export { AuthManager } from './auth-manager';

// OAuth authentication (recommended secure approach)
export { OAuthAuthManager } from './oauth-auth-manager';

// Interfaces
export type { 
  User, 
  UserDevice, 
  OAuthData,
  DatabaseAdapter 
} from './user-manager';

export type {
  UserKey,
  KeyValidationResult,
  KeyStorageAdapter,
  AIProviderValidator
} from './key-manager';

export type {
  AuthSession,
  OAuthProvider,
  PasskeyCredential,
  AuthUpgradeOptions
} from './auth-manager';

// Private key authentication types removed for security reasons
// Use OAuth authentication instead

export type {
  OAuthSession,
  OAuthConfig
} from './oauth-auth-manager';

// Database and validation
export { PostgreSQLAdapter } from '../database/postgres-adapter';
export { AIKeyValidator } from '../services/ai-validator';

// Client (now in main client.ts)
export type { 
  AIClientOptions,
  DeviceInfo,
  AuthUpgradePrompt 
} from '../client';