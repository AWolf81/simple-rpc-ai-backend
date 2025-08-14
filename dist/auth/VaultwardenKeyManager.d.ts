/**
 * Vaultwarden Key Manager
 *
 * Direct replacement for SQLite-based key storage using Vaultwarden
 * Provides the same interface as SimpleKeyManager but with enterprise-grade security
 */
import { VaultwardenSecretManager } from '../services/VaultwardenSecretManager.js';
import * as winston from 'winston';
export interface UserKey {
    userId: string;
    provider: string;
    hasKey: boolean;
    isValid: boolean;
    lastValidated?: Date;
    createdAt?: Date;
    updatedAt?: Date;
}
export interface KeyValidationResult {
    isValid: boolean;
    error?: string;
    provider: string;
    model?: string;
}
export interface AIProviderValidator {
    validateKey(provider: string, apiKey: string): Promise<KeyValidationResult>;
}
/**
 * Vaultwarden-based key manager that replaces SimpleKeyManager
 * Provides the same API but uses Vaultwarden for secure storage
 */
export declare class VaultwardenKeyManager {
    private vaultwarden;
    private validator;
    private logger;
    constructor(vaultwarden: VaultwardenSecretManager, validator: AIProviderValidator, logger?: winston.Logger);
    /**
     * Initialize the key manager
     */
    initialize(): Promise<void>;
    /**
     * Store user API key with validation
     */
    storeUserKey(userId: string, provider: string, apiKey: string): Promise<void>;
    /**
     * Get user API key (decrypted)
     */
    getUserKey(userId: string, provider: string): Promise<string | null>;
    /**
     * Get all providers configured for user
     */
    getUserProviders(userId: string): Promise<string[]>;
    /**
     * Validate user API key (re-test with provider)
     */
    validateUserKey(userId: string, provider: string): Promise<boolean>;
    /**
     * Rotate user API key
     */
    rotateUserKey(userId: string, provider: string, newApiKey: string): Promise<void>;
    /**
     * Delete user API key
     */
    deleteUserKey(userId: string, provider: string): Promise<void>;
    /**
     * Get key metadata (without decrypting)
     */
    getKeyMetadata(userId: string, provider: string): Promise<UserKey | null>;
    /**
     * Validate all user keys (maintenance operation)
     */
    validateAllUserKeys(userId: string): Promise<{
        [provider: string]: boolean;
    }>;
    /**
     * Get usage statistics for user keys
     */
    getKeyUsageStats(userId: string): Promise<{
        totalKeys: number;
        validKeys: number;
        invalidKeys: number;
        providers: string[];
        lastValidated?: Date;
    }>;
    /**
     * Check if user has any valid keys
     */
    hasValidKeys(userId: string): Promise<boolean>;
    /**
     * Get preferred provider for user (first available)
     */
    getPreferredProvider(userId: string): Promise<string | null>;
    /**
     * Health check
     */
    healthCheck(): Promise<{
        status: 'healthy' | 'unhealthy';
        details: any;
    }>;
}
//# sourceMappingURL=VaultwardenKeyManager.d.ts.map