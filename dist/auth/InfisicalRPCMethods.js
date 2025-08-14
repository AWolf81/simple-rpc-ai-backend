/**
 * Infisical JSON-RPC Methods
 *
 * Maintains compatibility with existing TokenBasedVaultManager interface
 * while providing proper multi-tenant isolation via Infisical
 */
import { InfisicalSecretManager } from '../services/InfisicalSecretManager.js';
import * as winston from 'winston';
/**
 * JSON-RPC Methods for Infisical Secret Management
 * Maintains API compatibility with existing system
 */
export class InfisicalRPCMethods {
    secretManager;
    logger;
    constructor(config, logger) {
        this.logger = logger || winston.createLogger({
            level: 'info',
            format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
            transports: [new winston.transports.Console()]
        });
        this.secretManager = new InfisicalSecretManager(config, this.logger);
    }
    /**
     * Initialize the RPC methods
     */
    async initialize() {
        await this.secretManager.initialize();
        this.logger.info('InfisicalRPCMethods initialized successfully');
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
            // Generate userId from email (you might want to use a proper user ID)
            const userId = email.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
            // Provision user if not exists
            await this.secretManager.provisionUser(userId, email);
            // Store the API key with provider prefix
            const secretKey = `${provider}_api_key`;
            const result = await this.secretManager.storeUserSecret(userId, secretKey, apiKey, `${provider} API key for ${email}`);
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
            // Generate userId from email
            const userId = email.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
            // Get the API key
            const secretKey = `${provider}_api_key`;
            const result = await this.secretManager.getUserSecret(userId, secretKey);
            if (result.success && result.secretKey) {
                this.logger.info('User API key retrieved successfully', {
                    email,
                    provider,
                    secretId: result.secretId
                });
                return {
                    success: true,
                    secretId: result.secretId,
                    // Return the API key (in practice, you might want to validate/decrypt it)
                    message: result.secretKey
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
            // Generate userId from email
            const userId = email.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
            const providers = [];
            // Check each provider
            for (const provider of ['anthropic', 'openai', 'google']) {
                try {
                    const secretKey = `${provider}_api_key`;
                    const result = await this.secretManager.getUserSecret(userId, secretKey);
                    if (result.success && result.secretKey) {
                        providers.push(provider);
                    }
                }
                catch (error) {
                    // Provider doesn't exist, continue
                }
            }
            this.logger.info('User providers retrieved', { email, providers });
            return {
                success: true,
                providers
            };
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
            // First, try to retrieve the key
            const keyResult = await this.getUserKey({ email, provider });
            if (!keyResult.success || !keyResult.message) {
                return {
                    success: true,
                    valid: false,
                    error: 'API key not found'
                };
            }
            // For now, just check if key exists and has proper format
            // In a real implementation, you'd validate against the provider's API
            const apiKey = keyResult.message;
            let isValidFormat = false;
            switch (provider) {
                case 'anthropic':
                    isValidFormat = apiKey.startsWith('sk-ant-');
                    break;
                case 'openai':
                    isValidFormat = apiKey.startsWith('sk-') && apiKey.length > 20;
                    break;
                case 'google':
                    isValidFormat = apiKey.length > 20; // Basic check
                    break;
            }
            this.logger.info('User API key validation complete', {
                email,
                provider,
                valid: isValidFormat
            });
            return {
                success: true,
                valid: isValidFormat
            };
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
            // Generate userId from email
            const userId = email.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
            // Delete the API key
            const secretKey = `${provider}_api_key`;
            const result = await this.secretManager.deleteUserSecret(userId, secretKey);
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
                message: error.message,
                details: {
                    infisicalConnected: false,
                    totalProjects: 0,
                    totalSecrets: 0,
                    lastCheck: new Date()
                }
            };
        }
    }
    /**
     * Clean up resources
     */
    async cleanup() {
        this.logger.info('Cleaning up InfisicalRPCMethods');
        await this.secretManager.cleanup();
    }
}
//# sourceMappingURL=InfisicalRPCMethods.js.map