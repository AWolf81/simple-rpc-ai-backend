/**
 * Short-Lived Token Manager
 *
 * Manages secure, short-lived tokens for Vaultwarden access
 * Implements token-based auth with automatic expiration and cleanup
 */
import * as winston from 'winston';
export interface TokenData {
    token: string;
    opensaasUserId: string;
    vaultwardenUserId: string;
    expiresAt: Date;
    createdAt: Date;
    tokenType: 'setup' | 'access';
    metadata?: {
        email?: string;
        subscriptionTier?: string;
        scope?: string[];
    };
}
export interface TokenValidationResult {
    isValid: boolean;
    tokenData?: TokenData;
    error?: string;
}
/**
 * Manages short-lived tokens for secure Vaultwarden access
 * Tokens are cryptographically secure and automatically expire
 */
export declare class ShortLivedTokenManager {
    private tokens;
    private logger;
    private cleanupInterval;
    private readonly hmacSecret;
    private readonly SETUP_TOKEN_LIFETIME;
    private readonly ACCESS_TOKEN_LIFETIME;
    private readonly CLEANUP_INTERVAL;
    private readonly TOKEN_LENGTH;
    constructor(hmacSecret?: string, logger?: winston.Logger);
    /**
     * Generate setup token (Step 3 from sequence diagram)
     * Short-lived, single-use token for account setup
     */
    generateSetupToken(opensaasUserId: string, vaultwardenUserId: string, metadata?: {
        email?: string;
        subscriptionTier?: string;
    }): TokenData;
    /**
     * Generate access token for normal operations
     * Short-lived token for API access
     */
    generateAccessToken(opensaasUserId: string, vaultwardenUserId: string, metadata?: {
        email?: string;
        subscriptionTier?: string;
        scope?: string[];
    }): TokenData;
    /**
     * Validate token and return associated data
     */
    validateToken(token: string): TokenValidationResult;
    /**
     * Consume setup token (single-use)
     */
    consumeSetupToken(token: string): TokenValidationResult;
    /**
     * Revoke token manually
     */
    revokeToken(token: string): boolean;
    /**
     * Revoke all tokens for a user
     */
    revokeUserTokens(opensaasUserId: string): number;
    /**
     * Get token statistics
     */
    getTokenStats(): {
        total: number;
        setup: number;
        access: number;
        expired: number;
        byType: {
            [type: string]: number;
        };
    };
    /**
     * Clean up expired tokens
     */
    private cleanupExpiredTokens;
    /**
     * Validate token integrity using HMAC
     */
    private validateTokenIntegrity;
    /**
     * Shutdown and cleanup
     */
    shutdown(): void;
    /**
     * Health check
     */
    healthCheck(): {
        status: 'healthy' | 'unhealthy';
        details: any;
    };
}
export default ShortLivedTokenManager;
//# sourceMappingURL=ShortLivedTokenManager.d.ts.map