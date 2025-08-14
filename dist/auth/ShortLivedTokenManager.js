/**
 * Short-Lived Token Manager
 *
 * Manages secure, short-lived tokens for Vaultwarden access
 * Implements token-based auth with automatic expiration and cleanup
 */
import { randomBytes, createHmac } from 'crypto';
import * as winston from 'winston';
/**
 * Manages short-lived tokens for secure Vaultwarden access
 * Tokens are cryptographically secure and automatically expire
 */
export class ShortLivedTokenManager {
    tokens = new Map();
    logger;
    cleanupInterval;
    hmacSecret;
    // Token configuration
    SETUP_TOKEN_LIFETIME = 10 * 60 * 1000; // 10 minutes
    ACCESS_TOKEN_LIFETIME = 30 * 60 * 1000; // 30 minutes
    CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes
    TOKEN_LENGTH = 32; // 256 bits
    constructor(hmacSecret, logger) {
        this.hmacSecret = hmacSecret
            ? Buffer.from(hmacSecret, 'utf8')
            : randomBytes(32); // Generate random secret if none provided
        this.logger = logger || winston.createLogger({
            level: 'info',
            format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
            transports: [new winston.transports.Console()]
        });
        // Start cleanup interval
        this.cleanupInterval = setInterval(() => {
            this.cleanupExpiredTokens();
        }, this.CLEANUP_INTERVAL);
        this.logger.info('ShortLivedTokenManager initialized', {
            setupTokenLifetime: this.SETUP_TOKEN_LIFETIME / 1000 / 60 + ' minutes',
            accessTokenLifetime: this.ACCESS_TOKEN_LIFETIME / 1000 / 60 + ' minutes',
            cleanupInterval: this.CLEANUP_INTERVAL / 1000 / 60 + ' minutes'
        });
    }
    /**
     * Generate setup token (Step 3 from sequence diagram)
     * Short-lived, single-use token for account setup
     */
    generateSetupToken(opensaasUserId, vaultwardenUserId, metadata) {
        const tokenBytes = randomBytes(this.TOKEN_LENGTH);
        const timestamp = Date.now().toString();
        const payload = `${opensaasUserId}:${vaultwardenUserId}:setup:${timestamp}`;
        // Create HMAC signature for integrity
        const signature = createHmac('sha256', this.hmacSecret)
            .update(payload)
            .digest('hex');
        const token = `setup_${tokenBytes.toString('hex')}_${signature.substring(0, 16)}`;
        const expiresAt = new Date(Date.now() + this.SETUP_TOKEN_LIFETIME);
        const tokenData = {
            token,
            opensaasUserId,
            vaultwardenUserId,
            expiresAt,
            createdAt: new Date(),
            tokenType: 'setup',
            metadata
        };
        // Store token
        this.tokens.set(token, tokenData);
        this.logger.info('Generated setup token', {
            opensaasUserId,
            vaultwardenUserId,
            token: token.substring(0, 20) + '...',
            expiresAt: expiresAt.toISOString()
        });
        return tokenData;
    }
    /**
     * Generate access token for normal operations
     * Short-lived token for API access
     */
    generateAccessToken(opensaasUserId, vaultwardenUserId, metadata) {
        const tokenBytes = randomBytes(this.TOKEN_LENGTH);
        const timestamp = Date.now().toString();
        const payload = `${opensaasUserId}:${vaultwardenUserId}:access:${timestamp}`;
        // Create HMAC signature for integrity
        const signature = createHmac('sha256', this.hmacSecret)
            .update(payload)
            .digest('hex');
        const token = `vw_${tokenBytes.toString('hex')}_${signature.substring(0, 16)}`;
        const expiresAt = new Date(Date.now() + this.ACCESS_TOKEN_LIFETIME);
        const tokenData = {
            token,
            opensaasUserId,
            vaultwardenUserId,
            expiresAt,
            createdAt: new Date(),
            tokenType: 'access',
            metadata
        };
        // Store token
        this.tokens.set(token, tokenData);
        this.logger.info('Generated access token', {
            opensaasUserId,
            vaultwardenUserId,
            token: token.substring(0, 20) + '...',
            expiresAt: expiresAt.toISOString(),
            scope: metadata?.scope
        });
        return tokenData;
    }
    /**
     * Validate token and return associated data
     */
    validateToken(token) {
        if (!token || typeof token !== 'string') {
            return { isValid: false, error: 'Invalid token format' };
        }
        // Check if token exists
        const tokenData = this.tokens.get(token);
        if (!tokenData) {
            return { isValid: false, error: 'Token not found' };
        }
        // Check if token is expired
        if (new Date() > tokenData.expiresAt) {
            // Remove expired token
            this.tokens.delete(token);
            this.logger.info('Removed expired token', {
                token: token.substring(0, 20) + '...',
                opensaasUserId: tokenData.opensaasUserId
            });
            return { isValid: false, error: 'Token expired' };
        }
        // Validate token integrity (check HMAC)
        const isIntegrityValid = this.validateTokenIntegrity(token, tokenData);
        if (!isIntegrityValid) {
            // Remove invalid token
            this.tokens.delete(token);
            this.logger.error('Token integrity validation failed', {
                token: token.substring(0, 20) + '...',
                opensaasUserId: tokenData.opensaasUserId
            });
            return { isValid: false, error: 'Token integrity check failed' };
        }
        return { isValid: true, tokenData };
    }
    /**
     * Consume setup token (single-use)
     */
    consumeSetupToken(token) {
        const validation = this.validateToken(token);
        if (!validation.isValid || !validation.tokenData) {
            return validation;
        }
        // Ensure it's a setup token
        if (validation.tokenData.tokenType !== 'setup') {
            return { isValid: false, error: 'Not a setup token' };
        }
        // Remove token after use (single-use)
        this.tokens.delete(token);
        this.logger.info('Consumed setup token', {
            token: token.substring(0, 20) + '...',
            opensaasUserId: validation.tokenData.opensaasUserId
        });
        return validation;
    }
    /**
     * Revoke token manually
     */
    revokeToken(token) {
        const tokenData = this.tokens.get(token);
        if (!tokenData) {
            return false;
        }
        this.tokens.delete(token);
        this.logger.info('Token revoked', {
            token: token.substring(0, 20) + '...',
            opensaasUserId: tokenData.opensaasUserId,
            tokenType: tokenData.tokenType
        });
        return true;
    }
    /**
     * Revoke all tokens for a user
     */
    revokeUserTokens(opensaasUserId) {
        const userTokens = Array.from(this.tokens.entries())
            .filter(([_, data]) => data.opensaasUserId === opensaasUserId);
        for (const [token, _] of userTokens) {
            this.tokens.delete(token);
        }
        this.logger.info('Revoked all user tokens', {
            opensaasUserId,
            tokensRevoked: userTokens.length
        });
        return userTokens.length;
    }
    /**
     * Get token statistics
     */
    getTokenStats() {
        const now = new Date();
        const allTokens = Array.from(this.tokens.values());
        const stats = {
            total: allTokens.length,
            setup: allTokens.filter(t => t.tokenType === 'setup').length,
            access: allTokens.filter(t => t.tokenType === 'access').length,
            expired: allTokens.filter(t => now > t.expiresAt).length,
            byType: {}
        };
        // Count by type
        for (const token of allTokens) {
            stats.byType[token.tokenType] = (stats.byType[token.tokenType] || 0) + 1;
        }
        return stats;
    }
    /**
     * Clean up expired tokens
     */
    cleanupExpiredTokens() {
        const now = new Date();
        const expiredTokens = [];
        for (const [token, data] of this.tokens.entries()) {
            if (now > data.expiresAt) {
                expiredTokens.push(token);
            }
        }
        for (const token of expiredTokens) {
            this.tokens.delete(token);
        }
        if (expiredTokens.length > 0) {
            this.logger.info('Cleaned up expired tokens', {
                expiredCount: expiredTokens.length,
                totalTokens: this.tokens.size
            });
        }
    }
    /**
     * Validate token integrity using HMAC
     */
    validateTokenIntegrity(token, tokenData) {
        try {
            // Extract signature from token
            const parts = token.split('_');
            if (parts.length < 3)
                return false;
            const signature = parts[parts.length - 1];
            const timestamp = tokenData.createdAt.getTime().toString();
            const payload = `${tokenData.opensaasUserId}:${tokenData.vaultwardenUserId}:${tokenData.tokenType}:${timestamp}`;
            // Recreate signature
            const expectedSignature = createHmac('sha256', this.hmacSecret)
                .update(payload)
                .digest('hex')
                .substring(0, 16);
            return signature === expectedSignature;
        }
        catch {
            return false;
        }
    }
    /**
     * Shutdown and cleanup
     */
    shutdown() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
        this.tokens.clear();
        this.logger.info('ShortLivedTokenManager shutdown completed');
    }
    /**
     * Health check
     */
    healthCheck() {
        try {
            const stats = this.getTokenStats();
            return {
                status: 'healthy',
                details: {
                    tokenStats: stats,
                    cleanupRunning: !!this.cleanupInterval,
                    hmacSecretConfigured: this.hmacSecret.length > 0
                }
            };
        }
        catch (error) {
            return {
                status: 'unhealthy',
                details: { error: error.message }
            };
        }
    }
}
export default ShortLivedTokenManager;
//# sourceMappingURL=ShortLivedTokenManager.js.map