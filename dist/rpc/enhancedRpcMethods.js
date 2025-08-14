/**
 * Enhanced RPC Methods with Flexible Key Management
 *
 * Supports Vaultwarden, file storage, and client-managed API keys
 * Handles direct API key passing in requests
 */
import { ClientManagedStorageAdapter } from '../storage/ClientManagedStorageAdapter.js';
/**
 * Create enhanced RPC methods with flexible storage
 */
export function createEnhancedRpcMethods(context) {
    const { storageAdapter, authManager, logger, config } = context;
    return {
        /**
         * Execute AI request with flexible key management
         */
        async executeAIRequest(params) {
            try {
                let apiKey = null;
                let userId = undefined;
                // Handle authentication if required
                if (config.requireAuth && authManager && params.deviceId) {
                    const session = authManager.getSession(params.deviceId);
                    if (!session) {
                        return {
                            success: false,
                            error: 'AUTHENTICATION_REQUIRED',
                            message: 'Please authenticate first'
                        };
                    }
                    userId = session.userId;
                }
                // Get API key based on storage type and request parameters
                if (params.apiKey && config.allowDirectKeyPassing) {
                    // Direct key passing (client-managed)
                    apiKey = params.apiKey;
                    // Validate key format if provider specified
                    if (params.provider && !ClientManagedStorageAdapter.validateApiKeyFormat(params.provider, apiKey)) {
                        return {
                            success: false,
                            error: 'INVALID_API_KEY_FORMAT',
                            message: `Invalid API key format for ${params.provider}`
                        };
                    }
                }
                else if (storageAdapter.getType() !== 'client_managed') {
                    // Storage-based key retrieval
                    const defaultProvider = params.provider || 'anthropic'; // Could be configurable
                    apiKey = await storageAdapter.getApiKey(defaultProvider, userId);
                    if (!apiKey) {
                        return {
                            success: false,
                            error: 'NO_API_KEY',
                            message: `No API key found for ${defaultProvider}. Please store a key first or pass one directly.`
                        };
                    }
                }
                else {
                    // Client-managed storage but no key provided
                    return {
                        success: false,
                        error: 'API_KEY_REQUIRED',
                        message: 'API key must be provided in request for client-managed storage'
                    };
                }
                if (!apiKey) {
                    return {
                        success: false,
                        error: 'NO_API_KEY_AVAILABLE',
                        message: 'No API key available for AI request'
                    };
                }
                // Infer provider if not specified
                const provider = params.provider || ClientManagedStorageAdapter.inferProvider(apiKey) || 'anthropic';
                logger.info('Executing AI request', {
                    provider,
                    systemPrompt: params.systemPrompt,
                    storageType: storageAdapter.getType(),
                    hasDirectKey: !!params.apiKey,
                    userId,
                });
                // Here you would call your AI service with the API key
                // This is a placeholder for the actual AI service integration
                const result = {
                    success: true,
                    response: `AI analysis using ${provider} would be executed here`,
                    metadata: {
                        provider,
                        systemPrompt: params.systemPrompt,
                        processingTime: Math.random() * 1000 + 500,
                        tokenUsage: {
                            inputTokens: params.content.length / 4, // Rough estimate
                            outputTokens: 100,
                            totalTokens: (params.content.length / 4) + 100
                        },
                        storageType: storageAdapter.getType(),
                        ...params.metadata
                    }
                };
                return result;
            }
            catch (error) {
                logger.error('AI request failed', {
                    error: error.message,
                    systemPrompt: params.systemPrompt,
                    storageType: storageAdapter.getType()
                });
                return {
                    success: false,
                    error: 'AI_REQUEST_FAILED',
                    message: error.message
                };
            }
        },
        /**
         * Store API key (only for storage-based adapters)
         */
        async storeApiKey(params) {
            if (storageAdapter.getType() === 'client_managed') {
                return {
                    success: false,
                    error: 'NOT_SUPPORTED',
                    message: 'Client-managed storage does not support server-side key storage'
                };
            }
            if (!params.apiKey) {
                return {
                    success: false,
                    error: 'API_KEY_REQUIRED',
                    message: 'API key is required'
                };
            }
            try {
                let userId = params.userId;
                // Handle authentication if required
                if (config.requireAuth && authManager && params.deviceId) {
                    const session = authManager.getSession(params.deviceId);
                    if (!session) {
                        return {
                            success: false,
                            error: 'AUTHENTICATION_REQUIRED',
                            message: 'Please authenticate first'
                        };
                    }
                    userId = session.userId;
                }
                const keyId = await storageAdapter.storeApiKey(params.provider, params.apiKey, userId);
                logger.info('API key stored', {
                    provider: params.provider,
                    userId,
                    keyId,
                    storageType: storageAdapter.getType()
                });
                return {
                    success: true,
                    keyId,
                    message: `API key stored successfully for ${params.provider}`
                };
            }
            catch (error) {
                logger.error('Failed to store API key', {
                    provider: params.provider,
                    error: error.message,
                    storageType: storageAdapter.getType()
                });
                return {
                    success: false,
                    error: 'STORAGE_FAILED',
                    message: error.message
                };
            }
        },
        /**
         * Get API key status (never returns actual key)
         */
        async getApiKeyStatus(params) {
            try {
                let userId = params.userId;
                // Handle authentication if required
                if (config.requireAuth && authManager && params.deviceId) {
                    const session = authManager.getSession(params.deviceId);
                    if (!session) {
                        return {
                            success: false,
                            error: 'AUTHENTICATION_REQUIRED',
                            message: 'Please authenticate first'
                        };
                    }
                    userId = session.userId;
                }
                if (storageAdapter.getType() === 'client_managed') {
                    return {
                        success: true,
                        hasKey: false,
                        storageType: 'client_managed',
                        message: 'Keys are managed by client - pass apiKey in requests'
                    };
                }
                const hasKey = await storageAdapter.validateApiKey(params.provider, userId);
                return {
                    success: true,
                    hasKey,
                    provider: params.provider,
                    storageType: storageAdapter.getType(),
                    message: hasKey ? 'API key is available' : 'No API key found'
                };
            }
            catch (error) {
                logger.error('Failed to check API key status', {
                    provider: params.provider,
                    error: error.message
                });
                return {
                    success: false,
                    error: 'STATUS_CHECK_FAILED',
                    message: error.message
                };
            }
        },
        /**
         * List available providers
         */
        async listProviders(params) {
            try {
                let userId = params.userId;
                // Handle authentication if required
                if (config.requireAuth && authManager && params.deviceId) {
                    const session = authManager.getSession(params.deviceId);
                    if (!session) {
                        return {
                            success: false,
                            error: 'AUTHENTICATION_REQUIRED',
                            message: 'Please authenticate first'
                        };
                    }
                    userId = session.userId;
                }
                const providers = await storageAdapter.listProviders(userId);
                return {
                    success: true,
                    providers,
                    storageType: storageAdapter.getType(),
                    message: `Found ${providers.filter(p => p.hasKey).length} configured providers`
                };
            }
            catch (error) {
                logger.error('Failed to list providers', {
                    error: error.message
                });
                return {
                    success: false,
                    error: 'LIST_PROVIDERS_FAILED',
                    message: error.message
                };
            }
        },
        /**
         * Delete API key (only for storage-based adapters)
         */
        async deleteApiKey(params) {
            if (storageAdapter.getType() === 'client_managed') {
                return {
                    success: false,
                    error: 'NOT_SUPPORTED',
                    message: 'Client-managed storage does not support server-side key deletion'
                };
            }
            try {
                let userId = params.userId;
                // Handle authentication if required
                if (config.requireAuth && authManager && params.deviceId) {
                    const session = authManager.getSession(params.deviceId);
                    if (!session) {
                        return {
                            success: false,
                            error: 'AUTHENTICATION_REQUIRED',
                            message: 'Please authenticate first'
                        };
                    }
                    userId = session.userId;
                }
                const deleted = await storageAdapter.deleteApiKey(params.provider, userId);
                logger.info('API key deletion attempt', {
                    provider: params.provider,
                    userId,
                    deleted,
                    storageType: storageAdapter.getType()
                });
                return {
                    success: deleted,
                    message: deleted ?
                        `API key deleted for ${params.provider}` :
                        `No API key found for ${params.provider}`
                };
            }
            catch (error) {
                logger.error('Failed to delete API key', {
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
         * Get storage health and configuration info
         */
        async getStorageInfo() {
            try {
                const health = await storageAdapter.healthCheck();
                return {
                    success: true,
                    storageType: storageAdapter.getType(),
                    health: health.status,
                    details: health.details,
                    capabilities: {
                        storeKeys: storageAdapter.getType() !== 'client_managed',
                        requiresDirectKeys: storageAdapter.getType() === 'client_managed',
                        supportsMultiUser: storageAdapter.getType() === 'vaultwarden',
                        supportsApiTokens: storageAdapter.getType() === 'vaultwarden',
                    },
                    message: 'Storage information retrieved successfully'
                };
            }
            catch (error) {
                logger.error('Failed to get storage info', {
                    error: error.message
                });
                return {
                    success: false,
                    error: 'STORAGE_INFO_FAILED',
                    message: error.message
                };
            }
        },
        /**
         * Health check for the entire system
         */
        async health() {
            try {
                const storageHealth = await storageAdapter.healthCheck();
                return {
                    success: true,
                    status: storageHealth.status,
                    storage: {
                        type: storageAdapter.getType(),
                        status: storageHealth.status,
                        details: storageHealth.details,
                    },
                    capabilities: {
                        requiresAuth: config.requireAuth,
                        allowsDirectKeys: config.allowDirectKeyPassing,
                        storageType: storageAdapter.getType(),
                    },
                    timestamp: new Date().toISOString(),
                    message: 'System health check completed'
                };
            }
            catch (error) {
                logger.error('Health check failed', {
                    error: error.message
                });
                return {
                    success: false,
                    error: 'HEALTH_CHECK_FAILED',
                    message: error.message
                };
            }
        }
    };
}
//# sourceMappingURL=enhancedRpcMethods.js.map