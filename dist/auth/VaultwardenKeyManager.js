/**
 * Vaultwarden Key Manager
 *
 * Direct replacement for SQLite-based key storage using Vaultwarden
 * Provides the same interface as SimpleKeyManager but with enterprise-grade security
 */
import * as winston from 'winston';
/**
 * Vaultwarden-based key manager that replaces SimpleKeyManager
 * Provides the same API but uses Vaultwarden for secure storage
 */
export class VaultwardenKeyManager {
    vaultwarden;
    validator;
    logger;
    constructor(vaultwarden, validator, logger) {
        this.vaultwarden = vaultwarden;
        this.validator = validator;
        this.logger = logger || winston.createLogger({
            level: 'info',
            format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
            transports: [new winston.transports.Console()]
        });
    }
    /**
     * Initialize the key manager
     */
    async initialize() {
        await this.vaultwarden.initialize();
        this.logger.info('VaultwardenKeyManager initialized');
    }
    /**
     * Store user API key with validation
     */
    async storeUserKey(userId, provider, apiKey) {
        if (!userId || !provider || !apiKey) {
            throw new Error('Missing required parameters: userId, provider, apiKey');
        }
        // Validate API key before storing
        const validationResult = await this.validator.validateKey(provider, apiKey);
        if (!validationResult.isValid) {
            throw new Error(`Invalid API key for ${provider}: ${validationResult.error}`);
        }
        // Store in Vaultwarden
        await this.vaultwarden.storeApiKey(provider, apiKey, userId);
        this.logger.info('User API key stored', {
            userId,
            provider,
            timestamp: new Date().toISOString()
        });
    }
    /**
     * Get user API key (decrypted)
     */
    async getUserKey(userId, provider) {
        if (!userId || !provider) {
            throw new Error('Missing required parameters: userId, provider');
        }
        return await this.vaultwarden.getApiKey(provider, userId);
    }
    /**
     * Get all providers configured for user
     */
    async getUserProviders(userId) {
        if (!userId) {
            throw new Error('Missing required parameter: userId');
        }
        const keys = await this.vaultwarden.listUserApiKeys(userId);
        return keys
            .filter(key => key.hasKey)
            .map(key => key.provider);
    }
    /**
     * Validate user API key (re-test with provider)
     */
    async validateUserKey(userId, provider) {
        const apiKey = await this.getUserKey(userId, provider);
        if (!apiKey) {
            return false;
        }
        try {
            const result = await this.validator.validateKey(provider, apiKey);
            this.logger.info('API key validation result', {
                userId,
                provider,
                isValid: result.isValid,
                timestamp: new Date().toISOString()
            });
            return result.isValid;
        }
        catch (error) {
            this.logger.error('API key validation failed', {
                userId,
                provider,
                error: error instanceof Error ? error.message : String(error),
                timestamp: new Date().toISOString()
            });
            return false;
        }
    }
    /**
     * Rotate user API key
     */
    async rotateUserKey(userId, provider, newApiKey) {
        // Validate new key first
        const validationResult = await this.validator.validateKey(provider, newApiKey);
        if (!validationResult.isValid) {
            throw new Error(`Invalid new API key for ${provider}: ${validationResult.error}`);
        }
        // Rotate in Vaultwarden
        await this.vaultwarden.rotateApiKey(provider, newApiKey, userId);
        this.logger.info('User API key rotated', {
            userId,
            provider,
            timestamp: new Date().toISOString()
        });
    }
    /**
     * Delete user API key
     */
    async deleteUserKey(userId, provider) {
        if (!userId || !provider) {
            throw new Error('Missing required parameters: userId, provider');
        }
        const deleted = await this.vaultwarden.deleteApiKey(provider, userId);
        this.logger.info('User API key deletion', {
            userId,
            provider,
            deleted,
            timestamp: new Date().toISOString()
        });
        if (!deleted) {
            this.logger.warn('API key not found for deletion', { userId, provider });
        }
    }
    /**
     * Get key metadata (without decrypting)
     */
    async getKeyMetadata(userId, provider) {
        const keys = await this.vaultwarden.listUserApiKeys(userId);
        const key = keys.find(k => k.provider === provider);
        if (!key) {
            return null;
        }
        return {
            userId,
            provider,
            hasKey: key.hasKey,
            isValid: key.hasKey, // Assume valid if exists, would need validation for actual status
            lastValidated: new Date(), // Would need to store this separately
            createdAt: new Date(), // Would need to store this separately
            updatedAt: new Date() // Would need to store this separately
        };
    }
    /**
     * Validate all user keys (maintenance operation)
     */
    async validateAllUserKeys(userId) {
        const providers = await this.getUserProviders(userId);
        const results = {};
        for (const provider of providers) {
            try {
                results[provider] = await this.validateUserKey(userId, provider);
            }
            catch (error) {
                results[provider] = false;
                this.logger.error('Validation failed for provider', {
                    userId,
                    provider,
                    error: error instanceof Error ? error.message : String(error)
                });
            }
        }
        return results;
    }
    /**
     * Get usage statistics for user keys
     */
    async getKeyUsageStats(userId) {
        const keys = await this.vaultwarden.listUserApiKeys(userId);
        const validKeys = keys.filter(k => k.hasKey);
        return {
            totalKeys: keys.length,
            validKeys: validKeys.length,
            invalidKeys: keys.length - validKeys.length,
            providers: validKeys.map(k => k.provider),
            lastValidated: new Date() // Would need to track this separately
        };
    }
    /**
     * Check if user has any valid keys
     */
    async hasValidKeys(userId) {
        const keys = await this.vaultwarden.listUserApiKeys(userId);
        return keys.some(key => key.hasKey);
    }
    /**
     * Get preferred provider for user (first available)
     */
    async getPreferredProvider(userId) {
        const providers = await this.getUserProviders(userId);
        if (providers.length === 0) {
            return null;
        }
        // Return first available provider
        // Could be enhanced with user preferences
        return providers[0];
    }
    /**
     * Health check
     */
    async healthCheck() {
        return await this.vaultwarden.healthCheck();
    }
}
//# sourceMappingURL=VaultwardenKeyManager.js.map