/**
 * PostgreSQL JSON-RPC Methods
 *
 * Simple, reliable multi-tenant API key management using PostgreSQL
 * Maintains compatibility with existing TokenBasedVaultManager interface
 */
import { PostgreSQLSecretManager } from '../src/services/PostgreSQLSecretManager.js';
import * as winston from 'winston';
/**
 * JSON-RPC Methods for PostgreSQL Secret Management
 * Maintains API compatibility with existing system
 */
export class PostgreSQLRPCMethods {
    secretManager;
    logger;
    constructor(config, encryptionKey, logger) {
        this.logger = logger || winston.createLogger({
            level: 'info',
            format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
            transports: [new winston.transports.Console()]
        });
        this.secretManager = new PostgreSQLSecretManager(config, encryptionKey, this.logger);
    }
    /**
     * Initialize the RPC methods
     */
    async initialize() {
        await this.secretManager.initialize();
        this.logger.info('PostgreSQLRPCMethods initialized successfully');
    }
    /**
     * Store user API key (BYOK - Bring Your Own Key)
     *
     * RPC Method: storeUserKey
     * Params: { email: string, provider: string, apiKey: string }
     */
    async storeUserKey(params) {
        try {
            const { email, provider, apiKey } = params;
            this.logger.info('Storing user API key', { email, provider });
            const result = await this.secretManager.storeUserKey(email, provider, apiKey);
            if (result.success) {
                this.logger.info('User API key stored successfully', {
                    email,
                    provider,
                    secretId: result.secretId
                });
                return {
                    success: true,
                    secretId: result.secretId,
                    message: `${provider} API key stored successfully`
                };
            }
            else {
                return {
                    success: false,
                    error: result.error || 'Failed to store API key'
                };
            }
        }
        catch (error) {
            this.logger.error('Failed to store user API key', {
                email: params.email,
                provider: params.provider,
                error: error.message
            });
            return {
                success: false,
                error: error.message
            };
        }
    }
    /**
     * Get user API key
     *
     * RPC Method: getUserKey
     * Params: { email: string, provider: string }
     */
    async getUserKey(params) {
        try {
            const { email, provider } = params;
            this.logger.info('Retrieving user API key', { email, provider });
            const result = await this.secretManager.getUserKey(email, provider);
            if (result.success && result.apiKey) {
                this.logger.info('User API key retrieved successfully', { email, provider });
                return {
                    success: true,
                    // Return the API key (in practice, you might want to validate/decrypt it)
                    message: result.apiKey
                };
            }
            else {
                return {
                    success: false,
                    error: result.error || `No ${provider} API key found for user`
                };
            }
        }
        catch (error) {
            this.logger.error('Failed to retrieve user API key', {
                email: params.email,
                provider: params.provider,
                error: error.message
            });
            return {
                success: false,
                error: error.message
            };
        }
    }
    /**
     * Get all configured providers for a user
     *
     * RPC Method: getUserProviders
     * Params: { email: string }
     */
    async getUserProviders(params) {
        try {
            const { email } = params;
            this.logger.info('Getting user providers', { email });
            const result = await this.secretManager.getUserProviders(email);
            if (result.success) {
                this.logger.info('User providers retrieved', { email, providers: result.providers });
                return {
                    success: true,
                    providers: result.providers || []
                };
            }
            else {
                return {
                    success: false,
                    error: result.error || 'Failed to get user providers'
                };
            }
        }
        catch (error) {
            this.logger.error('Failed to get user providers', {
                email: params.email,
                error: error.message
            });
            return {
                success: false,
                error: error.message
            };
        }
    }
    /**
     * Validate user API key
     *
     * RPC Method: validateUserKey
     * Params: { email: string, provider: string }
     */
    async validateUserKey(params) {
        try {
            const { email, provider } = params;
            this.logger.info('Validating user API key', { email, provider });
            const result = await this.secretManager.validateUserKey(email, provider);
            if (result.success) {
                this.logger.info('User API key validation complete', {
                    email,
                    provider,
                    valid: result.valid
                });
                return {
                    success: true,
                    valid: result.valid || false
                };
            }
            else {
                return {
                    success: false,
                    error: result.error || 'Validation failed'
                };
            }
        }
        catch (error) {
            this.logger.error('Failed to validate user API key', {
                email: params.email,
                provider: params.provider,
                error: error.message
            });
            return {
                success: false,
                error: error.message
            };
        }
    }
    /**
     * Delete user API key
     *
     * RPC Method: deleteUserKey
     * Params: { email: string, provider: string }
     */
    async deleteUserKey(params) {
        try {
            const { email, provider } = params;
            this.logger.info('Deleting user API key', { email, provider });
            const result = await this.secretManager.deleteUserKey(email, provider);
            if (result.success) {
                this.logger.info('User API key deleted successfully', { email, provider });
                return {
                    success: true,
                    message: `${provider} API key deleted successfully`
                };
            }
            else {
                return {
                    success: false,
                    error: result.error || 'Failed to delete API key'
                };
            }
        }
        catch (error) {
            this.logger.error('Failed to delete user API key', {
                email: params.email,
                provider: params.provider,
                error: error.message
            });
            return {
                success: false,
                error: error.message
            };
        }
    }
    /**
     * Get health status of the secret manager
     *
     * RPC Method: getSecretManagerHealth
     * Params: {}
     */
    async getSecretManagerHealth() {
        try {
            const health = await this.secretManager.getHealthStatus();
            this.logger.info('Secret manager health check', { status: health.status });
            return health;
        }
        catch (error) {
            this.logger.error('Health check failed', { error: error.message });
            return {
                status: 'unhealthy',
                details: {
                    connected: false,
                    error: error.message,
                    totalSecrets: 0,
                    totalUsers: 0,
                    totalProviders: 0,
                    lastCheck: new Date()
                }
            };
        }
    }
    /**
     * Rotate user API key (replace with new key)
     *
     * RPC Method: rotateUserKey
     * Params: { email: string, provider: string, newApiKey: string }
     */
    async rotateUserKey(params) {
        try {
            const { email, provider, newApiKey } = params;
            this.logger.info('Rotating user API key', { email, provider });
            // First check if key exists
            const existingResult = await this.secretManager.getUserKey(email, provider);
            if (!existingResult.success) {
                return {
                    success: false,
                    error: `No existing ${provider} API key found for user to rotate`
                };
            }
            // Store the new key (this will overwrite the existing one)
            const storeResult = await this.secretManager.storeUserKey(email, provider, newApiKey);
            if (storeResult.success) {
                this.logger.info('User API key rotated successfully', { email, provider });
                return {
                    success: true,
                    secretId: storeResult.secretId,
                    message: `${provider} API key rotated successfully`
                };
            }
            else {
                return {
                    success: false,
                    error: storeResult.error || 'Failed to rotate API key'
                };
            }
        }
        catch (error) {
            this.logger.error('Failed to rotate user API key', {
                email: params.email,
                provider: params.provider,
                error: error.message
            });
            return {
                success: false,
                error: error.message
            };
        }
    }
    /**
     * Reset database for testing purposes
     * WARNING: This will delete all data - for testing only!
     */
    async resetForTesting() {
        this.logger.warn('Resetting database for testing - ALL DATA WILL BE LOST');
        // Get direct database access through the secret manager
        const client = this.secretManager.client;
        if (client) {
            await client.query('DELETE FROM user_api_keys');
            this.logger.info('Database reset completed');
        }
        else {
            throw new Error('Database client not available for reset');
        }
    }
    /**
     * Clean up resources
     */
    async cleanup() {
        this.logger.info('Cleaning up PostgreSQLRPCMethods');
        await this.secretManager.cleanup();
    }
}
