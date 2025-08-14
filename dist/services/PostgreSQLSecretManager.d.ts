/**
 * PostgreSQL Secret Manager
 *
 * Simple, secure multi-tenant API key storage using PostgreSQL directly
 * No complex external dependencies - just encrypted storage with proper user isolation
 */
import * as winston from 'winston';
export interface PostgreSQLConfig {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
    ssl?: boolean;
}
export interface SecretRecord {
    userId: string;
    secretKey: string;
    encryptedValue: string;
    provider: string;
    createdAt: Date;
    updatedAt: Date;
}
export interface SecretOperationResult {
    success: boolean;
    error?: string;
    secretId?: string;
}
/**
 * Simple PostgreSQL-based secret manager with true user isolation
 */
export declare class PostgreSQLSecretManager {
    private client;
    private logger;
    private masterKey;
    constructor(config: PostgreSQLConfig, encryptionKey: string, logger?: winston.Logger);
    /**
     * Initialize database connection and schema
     */
    initialize(): Promise<void>;
    /**
     * Store user API key with encryption and isolation
     */
    storeUserKey(email: string, provider: string, apiKey: string): Promise<SecretOperationResult>;
    /**
     * Retrieve user API key with decryption
     */
    getUserKey(email: string, provider: string): Promise<{
        success: boolean;
        apiKey?: string;
        error?: string;
    }>;
    /**
     * Get all configured providers for a user
     */
    getUserProviders(email: string): Promise<{
        success: boolean;
        providers?: string[];
        error?: string;
    }>;
    /**
     * Delete user API key
     */
    deleteUserKey(email: string, provider: string): Promise<SecretOperationResult>;
    /**
     * Validate user API key format
     */
    validateUserKey(email: string, provider: string): Promise<{
        success: boolean;
        valid?: boolean;
        error?: string;
    }>;
    /**
     * Get health status
     */
    getHealthStatus(): Promise<{
        status: string;
        details: any;
    }>;
    /**
     * Clean up resources
     */
    cleanup(): Promise<void>;
    private getUserId;
    /**
     * Log all secret access attempts for security audit
     */
    private logSecretAccess;
    private createSchema;
    private encrypt;
    private decrypt;
}
//# sourceMappingURL=PostgreSQLSecretManager.d.ts.map