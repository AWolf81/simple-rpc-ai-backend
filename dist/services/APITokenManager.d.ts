/**
 * API Token Manager
 *
 * Manages API tokens for external client access to user keys
 * Stores tokens securely in Vaultwarden with scoped permissions
 */
import { PostgreSQLSecretManager } from './PostgreSQLSecretManager';
import * as winston from 'winston';
export type TokenScope = 'keys:read' | 'keys:write' | 'keys:delete' | 'keys:list' | 'keys:rotate';
export interface APIToken {
    tokenId: string;
    userId: string;
    name: string;
    hashedToken: string;
    scopes: TokenScope[];
    rateLimits: {
        requestsPerHour: number;
        dailyLimit: number;
    };
    createdAt: Date;
    lastUsedAt?: Date;
    expiresAt?: Date;
    isActive: boolean;
}
export interface TokenCreationRequest {
    userId: string;
    name: string;
    scopes: TokenScope[];
    expiresInDays?: number;
    rateLimits?: {
        requestsPerHour?: number;
        dailyLimit?: number;
    };
}
export interface TokenUsage {
    tokenId: string;
    requestCount: number;
    lastHour: number;
    today: number;
    lastRequest: Date;
}
export declare class APITokenManager {
    private pgsqlSecretManager;
    private logger;
    private readonly SALT_ROUNDS;
    private readonly DEFAULT_RATE_LIMITS;
    private tokenUsage;
    constructor(pgsqlSecretManager: PostgreSQLSecretManager, logger?: winston.Logger);
    /**
     * Generate a secure API token
     */
    private generateToken;
    /**
     * Hash token for storage
     */
    private hashToken;
    /**
     * Verify token against hash
     */
    private verifyToken;
    /**
     * Create new API token
     */
    createAPIToken(request: TokenCreationRequest): Promise<{
        tokenId: string;
        token: string;
        metadata: Omit<APIToken, 'hashedToken'>;
    }>;
    /**
     * Store token data in Vault
     */
    private storeTokenInVault;
    /**
     * Validate API token and return user context
     */
    validateToken(token: string): Promise<{
        isValid: boolean;
        userId?: string;
        scopes?: TokenScope[];
        rateLimits?: APIToken['rateLimits'];
        tokenId?: string;
        error?: string;
    }>;
    /**
     * Get all token secrets from Vaultwarden
     */
    private getAllTokenSecrets;
    /**
     * Check rate limits for token
     */
    private checkRateLimit;
    /**
     * Update last used timestamp
     */
    private updateLastUsed;
    /**
     * List user's API tokens
     */
    listUserTokens(userId: string): Promise<Array<Omit<APIToken, 'hashedToken'>>>;
    /**
     * Revoke API token
     */
    revokeToken(tokenId: string, userId: string): Promise<boolean>;
    /**
     * Check if user has permission for scope
     */
    hasScope(scopes: TokenScope[], requiredScope: TokenScope): boolean;
    /**
     * Get token usage statistics
     */
    getTokenUsage(tokenId: string): TokenUsage | null;
    /**
     * Clean up expired tokens (maintenance task)
     */
    cleanupExpiredTokens(): Promise<number>;
}
//# sourceMappingURL=APITokenManager.d.ts.map