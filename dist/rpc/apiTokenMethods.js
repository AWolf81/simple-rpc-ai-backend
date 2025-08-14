/**
 * RPC Methods for API Token Management
 *
 * JSON-RPC methods for managing API tokens for external access
 */
import { APITokenManager } from '../services/APITokenManager.js';
/**
 * Create RPC methods for API token management
 */
export function createApiTokenMethods(context) {
    const { tokenManager, authManager, logger, config } = context;
    return {
        /**
         * Create API token for external access (Pro feature)
         */
        async createAPIToken(params) {
            try {
                // Check if API tokens are enabled
                if (!config.apiTokensEnabled) {
                    return {
                        success: false,
                        error: 'API_TOKENS_DISABLED',
                        message: 'API token creation is disabled',
                    };
                }
                const session = authManager.getSession(params.deviceId);
                if (!session) {
                    return {
                        success: false,
                        error: 'AUTHENTICATION_REQUIRED',
                        message: 'Please authenticate first'
                    };
                }
                // Check if user has API token feature
                if (config.requiresPro && !await authManager.hasFeature(params.deviceId, 'api_tokens')) {
                    return {
                        success: false,
                        error: 'API_TOKENS_REQUIRES_PRO',
                        message: 'API token creation requires Pro plan',
                        upgradeUrl: '/upgrade'
                    };
                }
                // Validate scopes
                const validScopes = ['keys:read', 'keys:write', 'keys:delete', 'keys:list', 'keys:rotate'];
                const invalidScopes = params.scopes.filter(scope => !validScopes.includes(scope));
                if (invalidScopes.length > 0) {
                    return {
                        success: false,
                        error: 'INVALID_SCOPES',
                        message: `Invalid scopes: ${invalidScopes.join(', ')}`
                    };
                }
                // Check token limit per user
                const existingTokens = await tokenManager.listUserTokens(session.userId);
                if (existingTokens.length >= config.maxTokensPerUser) {
                    return {
                        success: false,
                        error: 'TOKEN_LIMIT_EXCEEDED',
                        message: `Maximum ${config.maxTokensPerUser} tokens per user`
                    };
                }
                // Create token
                const tokenResult = await tokenManager.createAPIToken({
                    userId: session.userId,
                    name: params.name,
                    scopes: params.scopes,
                    expiresInDays: params.expiresInDays,
                    rateLimits: params.rateLimits,
                });
                logger.info('API token created via RPC', {
                    userId: session.userId,
                    tokenId: tokenResult.tokenId,
                    name: params.name,
                    scopes: params.scopes
                });
                return {
                    success: true,
                    tokenId: tokenResult.tokenId,
                    token: tokenResult.token, // Only returned once!
                    name: tokenResult.metadata.name,
                    scopes: tokenResult.metadata.scopes,
                    rateLimits: tokenResult.metadata.rateLimits,
                    expiresAt: tokenResult.metadata.expiresAt?.toISOString(),
                    message: 'API token created successfully'
                };
            }
            catch (error) {
                logger.error('Failed to create API token via RPC', {
                    error: error.message,
                    name: params.name
                });
                return {
                    success: false,
                    error: 'TOKEN_CREATION_FAILED',
                    message: error.message
                };
            }
        },
        /**
         * List user's API tokens
         */
        async listAPITokens(params) {
            try {
                const session = authManager.getSession(params.deviceId);
                if (!session) {
                    return {
                        success: false,
                        error: 'AUTHENTICATION_REQUIRED',
                        message: 'Please authenticate first'
                    };
                }
                const tokens = await tokenManager.listUserTokens(session.userId);
                // Remove sensitive data before returning
                const safeTokens = tokens.map(token => ({
                    tokenId: token.tokenId,
                    name: token.name,
                    scopes: token.scopes,
                    rateLimits: token.rateLimits,
                    createdAt: token.createdAt.toISOString(),
                    lastUsedAt: token.lastUsedAt?.toISOString(),
                    expiresAt: token.expiresAt?.toISOString(),
                    isActive: token.isActive,
                }));
                return {
                    success: true,
                    tokens: safeTokens,
                    count: safeTokens.length,
                    message: `Found ${safeTokens.length} API tokens`
                };
            }
            catch (error) {
                logger.error('Failed to list API tokens via RPC', {
                    error: error.message
                });
                return {
                    success: false,
                    error: 'TOKEN_LIST_FAILED',
                    message: error.message
                };
            }
        },
        /**
         * Revoke API token
         */
        async revokeAPIToken(params) {
            try {
                const session = authManager.getSession(params.deviceId);
                if (!session) {
                    return {
                        success: false,
                        error: 'AUTHENTICATION_REQUIRED',
                        message: 'Please authenticate first'
                    };
                }
                const revoked = await tokenManager.revokeToken(params.tokenId, session.userId);
                logger.info('API token revoked via RPC', {
                    userId: session.userId,
                    tokenId: params.tokenId
                });
                return {
                    success: revoked,
                    message: revoked ?
                        'API token revoked successfully' :
                        'API token not found or already revoked'
                };
            }
            catch (error) {
                logger.error('Failed to revoke API token via RPC', {
                    error: error.message,
                    tokenId: params.tokenId
                });
                return {
                    success: false,
                    error: 'TOKEN_REVOKE_FAILED',
                    message: error.message
                };
            }
        },
        /**
         * Get API token usage statistics
         */
        async getAPITokenUsage(params) {
            try {
                const session = authManager.getSession(params.deviceId);
                if (!session) {
                    return {
                        success: false,
                        error: 'AUTHENTICATION_REQUIRED',
                        message: 'Please authenticate first'
                    };
                }
                const usage = tokenManager.getTokenUsage(params.tokenId);
                return {
                    success: true,
                    usage: usage ? {
                        requestCount: usage.requestCount,
                        lastHour: usage.lastHour,
                        today: usage.today,
                        lastRequest: usage.lastRequest.toISOString(),
                    } : null,
                    message: usage ? 'Token usage retrieved' : 'No usage data available'
                };
            }
            catch (error) {
                logger.error('Failed to get API token usage via RPC', {
                    error: error.message,
                    tokenId: params.tokenId
                });
                return {
                    success: false,
                    error: 'TOKEN_USAGE_FAILED',
                    message: error.message
                };
            }
        },
        /**
         * Get API token configuration and limits
         */
        async getAPITokenConfig(params) {
            try {
                const session = authManager.getSession(params.deviceId);
                if (!session) {
                    return {
                        success: false,
                        error: 'AUTHENTICATION_REQUIRED',
                        message: 'Please authenticate first'
                    };
                }
                const hasFeature = await authManager.hasFeature(params.deviceId, 'api_tokens');
                const existingTokens = await tokenManager.listUserTokens(session.userId);
                return {
                    success: true,
                    config: {
                        enabled: config.apiTokensEnabled,
                        requiresPro: config.requiresPro,
                        maxTokensPerUser: config.maxTokensPerUser,
                        userHasFeature: hasFeature,
                        currentTokenCount: existingTokens.length,
                        remainingTokens: Math.max(0, config.maxTokensPerUser - existingTokens.length),
                    },
                    availableScopes: ['keys:read', 'keys:write', 'keys:delete', 'keys:list', 'keys:rotate'],
                    message: 'API token configuration retrieved'
                };
            }
            catch (error) {
                logger.error('Failed to get API token config via RPC', {
                    error: error.message
                });
                return {
                    success: false,
                    error: 'TOKEN_CONFIG_FAILED',
                    message: error.message
                };
            }
        },
    };
}
/**
 * Middleware to validate API token for external requests
 */
export function createApiTokenMiddleware(tokenManager, logger) {
    return async (req, res, next) => {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                error: 'MISSING_TOKEN',
                message: 'API token required in Authorization header'
            });
        }
        const token = authHeader.substring(7); // Remove 'Bearer '
        const validation = await tokenManager.validateToken(token);
        if (!validation.isValid) {
            logger.warn('Invalid API token used', {
                error: validation.error,
                ip: req.ip,
                userAgent: req.headers['user-agent']
            });
            return res.status(401).json({
                error: 'INVALID_TOKEN',
                message: validation.error || 'Invalid API token'
            });
        }
        // Add token context to request
        req.tokenAuth = {
            userId: validation.userId,
            scopes: validation.scopes,
            tokenId: validation.tokenId,
            rateLimits: validation.rateLimits,
        };
        next();
    };
}
/**
 * Helper to check scope permission
 */
export function requireScope(scope) {
    return (req, res, next) => {
        if (!req.tokenAuth) {
            return res.status(401).json({
                error: 'NO_TOKEN_CONTEXT',
                message: 'API token context missing'
            });
        }
        const tokenManager = new APITokenManager(null); // Would inject properly
        if (!tokenManager.hasScope(req.tokenAuth.scopes, scope)) {
            return res.status(403).json({
                error: 'INSUFFICIENT_SCOPE',
                message: `Required scope: ${scope}`
            });
        }
        next();
    };
}
//# sourceMappingURL=apiTokenMethods.js.map