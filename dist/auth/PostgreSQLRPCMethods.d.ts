/**
 * PostgreSQL JSON-RPC Methods
 *
 * Simple, reliable multi-tenant API key management using PostgreSQL
 * Maintains compatibility with existing TokenBasedVaultManager interface
 */
import { PostgreSQLConfig } from '../services/PostgreSQLSecretManager.js';
import * as winston from 'winston';
export interface VaultOperationResult {
    success: boolean;
    secretId?: string;
    error?: string;
    message?: string;
}
/**
 * JSON-RPC Methods for PostgreSQL Secret Management
 * Maintains API compatibility with existing system
 */
export declare class PostgreSQLRPCMethods {
    private secretManager;
    private logger;
    constructor(config: PostgreSQLConfig, encryptionKey: string, logger?: winston.Logger);
    /**
     * Initialize the RPC methods
     */
    initialize(): Promise<void>;
    /**
     * Store user API key (BYOK - Bring Your Own Key)
     *
     * RPC Method: storeUserKey
     * Params: { email: string, provider: string, apiKey: string }
     */
    storeUserKey(params: {
        email: string;
        provider: 'anthropic' | 'openai' | 'google';
        apiKey: string;
    }): Promise<VaultOperationResult>;
    /**
     * Get user API key
     *
     * RPC Method: getUserKey
     * Params: { email: string, provider: string }
     */
    getUserKey(params: {
        email: string;
        provider: 'anthropic' | 'openai' | 'google';
    }): Promise<VaultOperationResult>;
    /**
     * Get all configured providers for a user
     *
     * RPC Method: getUserProviders
     * Params: { email: string }
     */
    getUserProviders(params: {
        email: string;
    }): Promise<{
        success: boolean;
        providers?: string[];
        error?: string;
    }>;
    /**
     * Validate user API key
     *
     * RPC Method: validateUserKey
     * Params: { email: string, provider: string }
     */
    validateUserKey(params: {
        email: string;
        provider: 'anthropic' | 'openai' | 'google';
    }): Promise<{
        success: boolean;
        valid?: boolean;
        error?: string;
    }>;
    /**
     * Delete user API key
     *
     * RPC Method: deleteUserKey
     * Params: { email: string, provider: string }
     */
    deleteUserKey(params: {
        email: string;
        provider: 'anthropic' | 'openai' | 'google';
    }): Promise<VaultOperationResult>;
    /**
     * Get health status of the secret manager
     *
     * RPC Method: getSecretManagerHealth
     * Params: {}
     */
    getSecretManagerHealth(): Promise<any>;
    /**
     * Rotate user API key (replace with new key)
     *
     * RPC Method: rotateUserKey
     * Params: { email: string, provider: string, newApiKey: string }
     */
    rotateUserKey(params: {
        email: string;
        provider: 'anthropic' | 'openai' | 'google';
        newApiKey: string;
    }): Promise<VaultOperationResult>;
    /**
     * Clean up resources
     */
    cleanup(): Promise<void>;
}
//# sourceMappingURL=PostgreSQLRPCMethods.d.ts.map