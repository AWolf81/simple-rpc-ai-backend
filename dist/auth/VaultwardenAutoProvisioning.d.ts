/**
 * Vaultwarden Auto-Provisioning Service
 *
 * Implements automatic Vaultwarden account creation per OpenSaaS user
 * Handles one-time setup tokens and client-side encryption setup
 */
import { BitwardenConfig } from './BitwardenRESTAPI.js';
import { UserIdentityBridge, OpenSaaSJWTPayload } from './UserIdentityBridge.js';
import * as winston from 'winston';
export interface VaultwardenAccount {
    opensaasUserId: string;
    email: string;
    vaultwardenUserId: string;
    isProvisioned: boolean;
    setupToken?: string;
    setupTokenExpires?: Date;
    createdAt: Date;
    clientMasterPasswordHash?: string;
}
export interface SetupTokenResponse {
    setupToken: string;
    vaultwardenUserId: string;
    expiresAt: Date;
}
export interface UserSetupRequest {
    setupToken: string;
    masterPasswordHash: string;
    encryptedPrivateKey?: string;
}
/**
 * Manages automatic provisioning of Vaultwarden accounts for OpenSaaS users
 * Implements the improved auth flow with client-side encryption
 */
export declare class VaultwardenAutoProvisioning {
    private bitwardenConfig;
    private userBridge;
    private logger;
    private accounts;
    private tokenManager;
    private vaultManager;
    constructor(bitwardenConfig: BitwardenConfig, userBridge: UserIdentityBridge, hmacSecret?: string, vaultMasterKey?: string, logger?: winston.Logger);
    /**
     * Initialize the auto-provisioning service
     */
    initialize(): Promise<void>;
    /**
     * Step 1-3 from sequence: Check/create Vaultwarden account and issue setup token
     */
    provisionUserAccount(jwtPayload: OpenSaaSJWTPayload): Promise<SetupTokenResponse>;
    /**
     * Step 4: Validate setup token and complete account setup
     * Client provides the master password hash (derived client-side with Argon2id)
     */
    completeAccountSetup(setupRequest: UserSetupRequest): Promise<{
        success: boolean;
        vaultwardenUserId: string;
        message: string;
    }>;
    /**
     * Generate short-lived Vaultwarden access token for existing user
     */
    generateShortLivedToken(opensaasUserId: string): Promise<{
        accessToken: string;
        expiresAt: Date;
        vaultwardenUserId: string;
    }>;
    /**
     * Store encrypted API key in user's vault
     */
    storeEncryptedKey(opensaasUserId: string, itemName: string, encryptedApiKey: string, provider: string, keyMetadata: any): Promise<string>;
    /**
     * Retrieve encrypted API key from user's vault
     */
    retrieveEncryptedKey(opensaasUserId: string, itemId: string): Promise<{
        encryptedApiKey: string;
        keyMetadata: any;
    } | null>;
    /**
     * Check if user account is provisioned and ready
     */
    isAccountProvisioned(opensaasUserId: string): boolean;
    /**
     * List user's vault items
     */
    listUserVaultItems(opensaasUserId: string): Promise<Array<{
        id: string;
        name: string;
        createdAt: string;
    }>>;
    /**
     * Get account info for user
     */
    getAccountInfo(opensaasUserId: string): VaultwardenAccount | null;
    /**
     * Clean up expired tokens (maintenance)
     * Delegated to TokenManager
     */
    cleanupExpiredTokens(): void;
    /**
     * Generate stable Vaultwarden user ID from email
     */
    private generateVaultwardenUserId;
    /**
     * Health check
     */
    healthCheck(): Promise<{
        status: 'healthy' | 'unhealthy';
        details: any;
    }>;
}
export default VaultwardenAutoProvisioning;
//# sourceMappingURL=VaultwardenAutoProvisioning.d.ts.map