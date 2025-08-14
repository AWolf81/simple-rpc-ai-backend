/**
 * Token-Based Vault Manager
 *
 * Secure user isolation using encrypted access tokens instead of stored passwords:
 * - Service account only creates Vaultwarden user accounts
 * - Access tokens are encrypted and stored in database
 * - No passwords are ever stored
 * - Users access vaults via their encrypted tokens
 * - Automatic token refresh when expired
 */
import { BitwardenConfig } from './BitwardenRESTAPI.js';
import * as winston from 'winston';
export interface UserVaultToken {
    userId: string;
    email: string;
    encryptedAccessToken: string;
    tokenExpiresAt: Date;
    isProvisioned: boolean;
    createdAt: Date;
    lastUsedAt: Date;
    rotationCount: number;
    lastRotatedAt?: Date;
    autoRotationEnabled: boolean;
}
export interface VaultOperationResult {
    success: boolean;
    data?: any;
    error?: string;
    tokenRefreshed?: boolean;
}
/**
 * Token-based secure vault manager with automatic rotation
 * No passwords stored - only encrypted access tokens with auto-rotation
 */
export declare class TokenBasedVaultManager {
    private serviceAccount;
    private userBridge;
    private userTokens;
    private masterKey;
    private logger;
    private rotationInterval;
    private readonly TOKEN_LIFETIME_HOURS;
    private readonly ROTATION_CHECK_INTERVAL_MS;
    private readonly ROTATION_THRESHOLD_HOURS;
    constructor(serviceConfig: BitwardenConfig, tokenEncryptionKey?: string, logger?: winston.Logger);
    initialize(): Promise<void>;
    /**
     * SERVICE ACCOUNT OPERATION: Provision new user and get their access token
     */
    provisionUser(userJWT: string): Promise<UserVaultToken>;
    /**
     * USER OPERATION: Store secret using encrypted access token
     */
    storeUserSecret(userId: string, secretName: string, secret: string): Promise<VaultOperationResult>;
    /**
     * USER OPERATION: Get secret using encrypted access token
     */
    getUserSecret(userId: string, secretId: string): Promise<VaultOperationResult>;
    /**
     * USER OPERATION: List user's secrets
     */
    listUserSecrets(userId: string): Promise<VaultOperationResult>;
    /**
     * Get decrypted access token for user
     */
    private getUserAccessToken;
    /**
     * Create API instance using access token (no password needed)
     */
    private createTokenBasedAPI;
    /**
     * Start automatic token rotation service
     */
    private startTokenRotationService;
    /**
     * Stop automatic token rotation service
     */
    private stopTokenRotationService;
    /**
     * Check all tokens and rotate those that need rotation
     */
    private checkAndRotateTokens;
    /**
     * Rotate user's access token (automatic or manual)
     */
    private rotateUserToken;
    /**
     * Manual token refresh (fallback for failed automatic rotation)
     */
    private refreshUserToken;
    /**
     * Create Vaultwarden user account (service account operation)
     */
    private createVaultwardenUser;
    /**
     * Extract access token from authenticated API session
     */
    private extractAccessToken;
    /**
     * Encrypt access token for storage
     */
    private encryptToken;
    /**
     * Decrypt stored access token
     */
    private decryptToken;
    /**
     * Update last used timestamp
     */
    private updateLastUsed;
    /**
     * Parse JWT payload
     */
    private parseJWT;
    /**
     * Enable/disable auto-rotation for specific user
     */
    setAutoRotation(userId: string, enabled: boolean): Promise<void>;
    /**
     * Get token rotation statistics for user
     */
    getTokenStats(userId: string): {
        rotationCount: number;
        lastRotatedAt?: Date;
        expiresAt: Date;
        timeToExpiry: number;
        autoRotationEnabled: boolean;
    } | null;
    /**
     * Cleanup - stop rotation service
     */
    cleanup(): Promise<void>;
    /**
     * Health check with rotation statistics
     */
    healthCheck(): Promise<{
        status: 'healthy' | 'unhealthy';
        details: any;
    }>;
}
export default TokenBasedVaultManager;
//# sourceMappingURL=TokenBasedVaultManager.d.ts.map