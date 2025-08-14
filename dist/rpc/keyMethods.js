/**
 * RPC Methods for Vaultwarden Key Management
 *
 * JSON-RPC methods for managing AI provider API keys using Vaultwarden
 */
/**
 * Create RPC methods for key management
 */
export function createKeyMethods(context) {
    const { keyManager, authManager, logger } = context;
    return {
        /**
         * Store API key for a provider
         */
        async storeUserKey(params) {
            try {
                const session = authManager.getSession(params.deviceId);
                if (!session) {
                    return {
                        success: false,
                        error: 'AUTHENTICATION_REQUIRED',
                        message: 'Please authenticate first'
                    };
                }
                await keyManager.storeUserKey(session.userId, params.provider, params.apiKey);
                logger.info('API key stored via RPC', {
                    userId: session.userId,
                    provider: params.provider,
                    deviceId: params.deviceId
                });
                return {
                    success: true,
                    message: `API key stored securely for ${params.provider}`
                };
            }
            catch (error) {
                logger.error('Failed to store API key via RPC', {
                    provider: params.provider,
                    error: error.message
                });
                return {
                    success: false,
                    error: 'STORAGE_FAILED',
                    message: error.message
                };
            }
        },
        /**
         * Get API key for a provider (returns existence only, not the actual key)
         */
        async getUserKey(params) {
            try {
                const session = authManager.getSession(params.deviceId);
                if (!session) {
                    return {
                        success: false,
                        error: 'AUTHENTICATION_REQUIRED',
                        message: 'Please authenticate first'
                    };
                }
                const apiKey = await keyManager.getUserKey(session.userId, params.provider);
                return {
                    success: true,
                    hasKey: !!apiKey,
                    message: apiKey ? 'API key is available' : 'No API key found'
                };
            }
            catch (error) {
                logger.error('Failed to get API key via RPC', {
                    provider: params.provider,
                    error: error.message
                });
                return {
                    success: false,
                    error: 'RETRIEVAL_FAILED',
                    message: error.message
                };
            }
        },
        /**
         * Delete API key for a provider
         */
        async deleteUserKey(params) {
            try {
                const session = authManager.getSession(params.deviceId);
                if (!session) {
                    return {
                        success: false,
                        error: 'AUTHENTICATION_REQUIRED',
                        message: 'Please authenticate first'
                    };
                }
                await keyManager.deleteUserKey(session.userId, params.provider);
                logger.info('API key deleted via RPC', {
                    userId: session.userId,
                    provider: params.provider,
                    deviceId: params.deviceId
                });
                return {
                    success: true,
                    message: `API key deleted for ${params.provider}`
                };
            }
            catch (error) {
                logger.error('Failed to delete API key via RPC', {
                    provider: params.provider,
                    error: error.message
                });
                return {
                    success: false,
                    error: 'DELETION_FAILED',
                    message: error.message
                };
            }
        },
        /**
         * List all providers and their key status for user
         */
        async getUserProviders(params) {
            try {
                const session = authManager.getSession(params.deviceId);
                if (!session) {
                    return {
                        success: false,
                        error: 'AUTHENTICATION_REQUIRED',
                        message: 'Please authenticate first'
                    };
                }
                const providers = await keyManager.getUserProviders(session.userId);
                return {
                    success: true,
                    providers,
                    count: providers.length,
                    message: `Found ${providers.length} configured providers`
                };
            }
            catch (error) {
                logger.error('Failed to get user providers via RPC', {
                    error: error.message
                });
                return {
                    success: false,
                    error: 'PROVIDERS_FAILED',
                    message: error.message
                };
            }
        },
        /**
         * Validate API key for a provider
         */
        async validateUserKey(params) {
            try {
                const session = authManager.getSession(params.deviceId);
                if (!session) {
                    return {
                        success: false,
                        error: 'AUTHENTICATION_REQUIRED',
                        message: 'Please authenticate first'
                    };
                }
                const isValid = await keyManager.validateUserKey(session.userId, params.provider);
                return {
                    success: true,
                    isValid,
                    message: isValid ?
                        `API key for ${params.provider} is valid` :
                        `API key for ${params.provider} is invalid or not found`
                };
            }
            catch (error) {
                logger.error('Failed to validate API key via RPC', {
                    provider: params.provider,
                    error: error.message
                });
                return {
                    success: false,
                    error: 'VALIDATION_FAILED',
                    message: error.message
                };
            }
        },
        /**
         * Rotate API key for a provider
         */
        async rotateUserKey(params) {
            try {
                const session = authManager.getSession(params.deviceId);
                if (!session) {
                    return {
                        success: false,
                        error: 'AUTHENTICATION_REQUIRED',
                        message: 'Please authenticate first'
                    };
                }
                await keyManager.rotateUserKey(session.userId, params.provider, params.newApiKey);
                logger.info('API key rotated via RPC', {
                    userId: session.userId,
                    provider: params.provider,
                    deviceId: params.deviceId
                });
                return {
                    success: true,
                    message: `API key rotated successfully for ${params.provider}`
                };
            }
            catch (error) {
                logger.error('Failed to rotate API key via RPC', {
                    provider: params.provider,
                    error: error.message
                });
                return {
                    success: false,
                    error: 'ROTATION_FAILED',
                    message: error.message
                };
            }
        },
        /**
         * Get key usage statistics
         */
        async getKeyUsageStats(params) {
            try {
                const session = authManager.getSession(params.deviceId);
                if (!session) {
                    return {
                        success: false,
                        error: 'AUTHENTICATION_REQUIRED',
                        message: 'Please authenticate first'
                    };
                }
                const stats = await keyManager.getKeyUsageStats(session.userId);
                return {
                    success: true,
                    ...stats,
                    message: `Found ${stats.totalKeys} total keys, ${stats.validKeys} valid`
                };
            }
            catch (error) {
                logger.error('Failed to get key usage stats via RPC', {
                    error: error.message
                });
                return {
                    success: false,
                    error: 'STATS_FAILED',
                    message: error.message
                };
            }
        },
        /**
         * Validate all user keys
         */
        async validateAllUserKeys(params) {
            try {
                const session = authManager.getSession(params.deviceId);
                if (!session) {
                    return {
                        success: false,
                        error: 'AUTHENTICATION_REQUIRED',
                        message: 'Please authenticate first'
                    };
                }
                const validationResults = await keyManager.validateAllUserKeys(session.userId);
                const validCount = Object.values(validationResults).filter(Boolean).length;
                const totalCount = Object.keys(validationResults).length;
                return {
                    success: true,
                    results: validationResults,
                    validCount,
                    totalCount,
                    message: `Validated ${totalCount} keys, ${validCount} are valid`
                };
            }
            catch (error) {
                logger.error('Failed to validate all user keys via RPC', {
                    error: error.message
                });
                return {
                    success: false,
                    error: 'VALIDATION_ALL_FAILED',
                    message: error.message
                };
            }
        },
        /**
         * Health check for key management system
         */
        async keyManagerHealth() {
            try {
                const health = await keyManager.healthCheck();
                return {
                    success: health.status === 'healthy',
                    status: health.status,
                    details: health.details,
                    timestamp: new Date().toISOString(),
                    message: health.status === 'healthy' ?
                        'Key management system is healthy' :
                        'Key management system is unhealthy'
                };
            }
            catch (error) {
                logger.error('Key manager health check failed', {
                    error: error.message
                });
                return {
                    success: false,
                    status: 'unhealthy',
                    error: error.message,
                    timestamp: new Date().toISOString(),
                    message: 'Health check failed'
                };
            }
        }
    };
}
// Legacy method names for backward compatibility
export function createLegacyKeyMethods(context) {
    const methods = createKeyMethods(context);
    return {
        // New method names
        ...methods,
        // Legacy method names (mapping to new implementation)
        storeProviderApiKey: methods.storeUserKey,
        getProviderApiKey: methods.getUserKey,
        deleteProviderApiKey: methods.deleteUserKey,
        listProviderKeys: methods.getUserProviders,
        rotateProviderApiKey: methods.rotateUserKey,
        vaultwardenHealth: methods.keyManagerHealth,
    };
}
//# sourceMappingURL=keyMethods.js.map