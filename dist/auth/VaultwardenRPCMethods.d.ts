/**
 * Vaultwarden RPC Methods
 *
 * Implements the improved auth flow RPC methods for automatic onboarding
 * and client-side encryption with one Vaultwarden account per OpenSaaS user
 */
import { VaultwardenAutoProvisioning, SetupTokenResponse } from './VaultwardenAutoProvisioning.js';
import { UserIdentityBridge } from './UserIdentityBridge.js';
import * as winston from 'winston';
export interface VaultwardenOnboardingRequest {
    opensaasJWT: string;
}
export interface VaultwardenSetupRequest {
    setupToken: string;
    masterPasswordHash: string;
    encryptedPrivateKey?: string;
}
export interface VaultwardenTokenRequest {
    opensaasJWT: string;
}
export interface VaultwardenStoreKeyRequest {
    opensaasJWT: string;
    encryptedApiKey: string;
    provider: string;
    keyMetadata: {
        algorithm: string;
        keyId?: string;
        createdAt: string;
    };
}
export interface VaultwardenRetrieveKeyRequest {
    shortLivedToken: string;
    provider: string;
}
/**
 * RPC Methods for the improved Vaultwarden auth flow
 * Provides automatic onboarding and client-side encryption support
 */
export declare class VaultwardenRPCMethods {
    private provisioning;
    private userBridge;
    private logger;
    constructor(provisioning: VaultwardenAutoProvisioning, userBridge: UserIdentityBridge, logger?: winston.Logger);
    /**
     * RPC Method: vaultwarden.onboardUser
     *
     * Step 1-3 from sequence diagram:
     * - Validate OpenSaaS JWT
     * - Check/create Vaultwarden account
     * - Generate setup token
     */
    onboardUser(params: VaultwardenOnboardingRequest): Promise<SetupTokenResponse>;
    /**
     * RPC Method: vaultwarden.completeSetup
     *
     * Step 4 from sequence diagram:
     * - Client completes account setup with master password hash
     * - Master password derived client-side with Argon2id
     */
    completeSetup(params: VaultwardenSetupRequest): Promise<{
        success: boolean;
        vaultwardenUserId: string;
        message: string;
    }>;
    /**
     * RPC Method: vaultwarden.getShortLivedToken
     *
     * Generate short-lived token for normal operations
     * Used after account setup is complete
     */
    getShortLivedToken(params: VaultwardenTokenRequest): Promise<{
        accessToken: string;
        expiresAt: string;
        vaultwardenUserId: string;
    }>;
    /**
     * RPC Method: vaultwarden.storeEncryptedKey
     *
     * Step 5 from sequence diagram:
     * - Store client-encrypted API key in Vaultwarden
     * - Key is already encrypted client-side with user's Master Key
     */
    storeEncryptedKey(params: VaultwardenStoreKeyRequest): Promise<{
        success: boolean;
        keyId: string;
        message: string;
    }>;
    /**
     * RPC Method: vaultwarden.retrieveEncryptedKey
     *
     * Normal operation: retrieve encrypted API key
     * Returns ciphertext that client must decrypt with their Master Key
     */
    retrieveEncryptedKey(params: VaultwardenRetrieveKeyRequest): Promise<{
        encryptedApiKey: string;
        keyMetadata: {
            algorithm: string;
            keyId?: string;
            createdAt: string;
            provider: string;
        };
    }>;
    /**
     * RPC Method: vaultwarden.getAccountStatus
     *
     * Check account provisioning status
     */
    getAccountStatus(params: {
        opensaasJWT: string;
    }): Promise<{
        isProvisioned: boolean;
        needsSetup: boolean;
        vaultwardenUserId?: string;
        accountCreated?: string;
    }>;
    /**
     * Validate access token and return user info
     */
    private validateAccessToken;
    /**
     * List user's vault items
     */
    private listUserVaultItems;
    /**
     * Health check for all components
     */
    healthCheck(): Promise<{
        status: 'healthy' | 'unhealthy';
        details: any;
    }>;
}
export default VaultwardenRPCMethods;
//# sourceMappingURL=VaultwardenRPCMethods.d.ts.map