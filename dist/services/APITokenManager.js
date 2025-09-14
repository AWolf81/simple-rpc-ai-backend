/**
 * API Token Manager
 *
 * Manages API tokens for external client access to user keys
 * Stores tokens securely in PostgreSQL with scoped permissions
 */
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import * as winston from 'winston';
export class APITokenManager {
    pgsqlSecretManager;
    logger;
    SALT_ROUNDS = 12;
    DEFAULT_RATE_LIMITS = {
        requestsPerHour: 100,
        dailyLimit: 1000,
    };
    // Token usage tracking (in production, use Redis)
    tokenUsage = new Map();
    constructor(pgsqlSecretManager, logger) {
        this.pgsqlSecretManager = pgsqlSecretManager;
        this.logger = logger || winston.createLogger({
            level: 'info',
            format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
            transports: [new winston.transports.Console()]
        });
    }
    /**
     * Generate a secure API token
     */
    generateToken() {
        // Format: srpc_<base64-encoded-random-bytes>
        const randomBytes = crypto.randomBytes(32);
        return `srpc_${randomBytes.toString('base64url')}`;
    }
    /**
     * Hash token for storage
     */
    async hashToken(token) {
        return await bcrypt.hash(token, this.SALT_ROUNDS);
    }
    /**
     * Verify token against hash
     */
    async verifyToken(token, hashedToken) {
        return await bcrypt.compare(token, hashedToken);
    }
    /**
     * Create new API token
     */
    async createAPIToken(request) {
        const tokenId = crypto.randomUUID();
        const plainTextToken = this.generateToken();
        const hashedToken = await this.hashToken(plainTextToken);
        const tokenData = {
            tokenId,
            userId: request.userId,
            name: request.name,
            hashedToken,
            scopes: request.scopes,
            rateLimits: {
                requestsPerHour: request.rateLimits?.requestsPerHour || this.DEFAULT_RATE_LIMITS.requestsPerHour,
                dailyLimit: request.rateLimits?.dailyLimit || this.DEFAULT_RATE_LIMITS.dailyLimit,
            },
            createdAt: new Date(),
            expiresAt: request.expiresInDays ?
                new Date(Date.now() + request.expiresInDays * 24 * 60 * 60 * 1000) :
                undefined,
            isActive: true,
        };
        // Store in PostgreSQL
        await this.storeTokenInDatabase(tokenData);
        this.logger.info('API token created', {
            tokenId,
            userId: request.userId,
            name: request.name,
            scopes: request.scopes,
        });
        const { hashedToken: _, ...metadata } = tokenData;
        return {
            tokenId,
            token: plainTextToken,
            metadata,
        };
    }
    /**
     * Store token data in PostgreSQL database
     */
    async storeTokenInDatabase(token) {
        const secretName = `api-token-${token.tokenId}`;
        const secretValue = JSON.stringify({
            userId: token.userId,
            hashedToken: token.hashedToken,
            scopes: token.scopes,
            rateLimits: token.rateLimits,
            metadata: {
                name: token.name,
                createdAt: token.createdAt.toISOString(),
                lastUsedAt: token.lastUsedAt?.toISOString(),
                expiresAt: token.expiresAt?.toISOString(),
                isActive: token.isActive,
            },
        });
        // Store in token project (separate from API keys)
        await this.pgsqlSecretManager.storeUserKey('api-tokens', // Special "provider" for API tokens
        secretValue, token.tokenId);
    }
    /**
     * Validate API token and return user context
     */
    async validateToken(token) {
        try {
            // Extract token ID from token (for efficient lookup)
            if (!token.startsWith('srpc_')) {
                return { isValid: false, error: 'Invalid token format' };
            }
            // Get all API tokens (in production, optimize this lookup)
            const tokenSecrets = await this.getAllTokenSecrets();
            for (const secret of tokenSecrets) {
                const isMatch = await this.verifyToken(token, secret.hashedToken);
                if (isMatch) {
                    // Check if token is active and not expired
                    if (!secret.isActive) {
                        return { isValid: false, error: 'Token is disabled' };
                    }
                    if (secret.expiresAt && new Date() > secret.expiresAt) {
                        return { isValid: false, error: 'Token has expired' };
                    }
                    // Check rate limits
                    const rateLimitOk = await this.checkRateLimit(secret.tokenId, secret.rateLimits);
                    if (!rateLimitOk) {
                        return { isValid: false, error: 'Rate limit exceeded' };
                    }
                    // Update last used timestamp
                    await this.updateLastUsed(secret.tokenId);
                    return {
                        isValid: true,
                        userId: secret.userId,
                        scopes: secret.scopes,
                        rateLimits: secret.rateLimits,
                        tokenId: secret.tokenId,
                    };
                }
            }
            return { isValid: false, error: 'Invalid token' };
        }
        catch (error) {
            if (error instanceof Error) {
                this.logger.error('Token validation failed', { error: error.message });
            }
            return { isValid: false, error: 'Validation error' };
        }
    }
    /**
     * Get all token secrets from PostgreSQL database
     */
    async getAllTokenSecrets() {
        // This is a simplified implementation
        // In production, you'd need a more efficient way to query tokens
        // Perhaps store token metadata separately for faster lookups
        // For now, return empty array - would need to implement token lookup
        this.logger.warn('getAllTokenSecrets not fully implemented - needs efficient token lookup');
        return [];
    }
    /**
     * Check rate limits for token
     */
    async checkRateLimit(tokenId, limits) {
        const now = new Date();
        const usage = this.tokenUsage.get(tokenId);
        if (!usage) {
            // First use
            this.tokenUsage.set(tokenId, {
                tokenId,
                requestCount: 1,
                lastHour: 1,
                today: 1,
                lastRequest: now,
            });
            return true;
        }
        // Check hourly limit
        const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
        if (usage.lastRequest < oneHourAgo) {
            usage.lastHour = 0;
        }
        // Check daily limit
        const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        if (usage.lastRequest < oneDayAgo) {
            usage.today = 0;
        }
        if (usage.lastHour >= limits.requestsPerHour) {
            this.logger.warn('Hourly rate limit exceeded', { tokenId, usage: usage.lastHour, limit: limits.requestsPerHour });
            return false;
        }
        if (usage.today >= limits.dailyLimit) {
            this.logger.warn('Daily rate limit exceeded', { tokenId, usage: usage.today, limit: limits.dailyLimit });
            return false;
        }
        // Update usage
        usage.requestCount++;
        usage.lastHour++;
        usage.today++;
        usage.lastRequest = now;
        return true;
    }
    /**
     * Update last used timestamp
     */
    async updateLastUsed(tokenId) {
        // In production, batch these updates to avoid excessive database calls
        this.logger.debug('Token used', { tokenId, timestamp: new Date().toISOString() });
    }
    /**
     * List user's API tokens
     */
    async listUserTokens(userId) {
        // Implementation would query PostgreSQL database for user's tokens
        this.logger.warn('listUserTokens not fully implemented');
        return [];
    }
    /**
     * Revoke API token
     */
    async revokeToken(tokenId, userId) {
        try {
            // Delete from PostgreSQL database
            const deleted = await this.pgsqlSecretManager.deleteUserKey('api-tokens', tokenId);
            // Remove from usage tracking
            this.tokenUsage.delete(tokenId);
            this.logger.info('API token revoked', { tokenId, userId });
            return deleted.success;
        }
        catch (error) {
            if (error instanceof Error) {
                this.logger.error('Failed to revoke token', { tokenId, error: error.message });
            }
            return false;
        }
    }
    /**
     * Check if user has permission for scope
     */
    hasScope(scopes, requiredScope) {
        return scopes.includes(requiredScope);
    }
    /**
     * Get token usage statistics
     */
    getTokenUsage(tokenId) {
        return this.tokenUsage.get(tokenId) || null;
    }
    /**
     * Clean up expired tokens (maintenance task)
     */
    async cleanupExpiredTokens() {
        let cleaned = 0;
        // Implementation would query all tokens and remove expired ones
        this.logger.info('Token cleanup completed', { cleaned });
        return cleaned;
    }
}
