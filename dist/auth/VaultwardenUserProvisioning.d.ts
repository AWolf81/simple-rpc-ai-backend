/**
 * Vaultwarden User Auto-Provisioning
 *
 * Automatically creates isolated Vaultwarden users when storing API keys
 * Supports OpenSaaS email/password + OAuth2 providers
 */
import { BitwardenRESTAPI } from './BitwardenRESTAPI.js';
import * as winston from 'winston';
export interface UserIdentity {
    email: string;
    opensaasUserId?: string;
    googleId?: string;
    githubId?: string;
    microsoftId?: string;
    auth0Sub?: string;
    name?: string;
    picture?: string;
    authProvider: 'opensaas' | 'google' | 'github' | 'microsoft' | 'auth0';
}
export interface VaultwardenUserAccount {
    vaultUserId: string;
    email: string;
    masterPassword: string;
    clientId: string;
    clientSecret: string;
    userIdentity: UserIdentity;
    createdAt: Date;
    lastAccessAt: Date;
    organizationId: string;
}
export interface ProvisioningConfig {
    serviceAccount: {
        serverUrl: string;
        clientId: string;
        clientSecret: string;
        masterPassword: string;
        organizationId: string;
    };
    userDefaults: {
        passwordLength: number;
        organizationId: string;
        autoInviteToOrg: boolean;
    };
}
/**
 * Auto-provisions Vaultwarden users with true vault isolation
 */
export declare class VaultwardenUserProvisioning {
    private logger;
    private config;
    private userMappings;
    constructor(config: ProvisioningConfig, logger?: winston.Logger);
    /**
     * Get or create Vaultwarden user account for identity
     * This is called during storeUserKey operations
     */
    getOrCreateUserAccount(userIdentity: UserIdentity): Promise<VaultwardenUserAccount>;
    /**
     * Create new Vaultwarden user with isolated vault
     */
    private provisionNewUser;
    /**
     * Create Vaultwarden account using service account API
     */
    private createVaultwardenAccount;
    /**
     * Generate API credentials for user account
     */
    private generateUserApiCredentials;
    /**
     * Invite user to organization
     */
    private inviteUserToOrganization;
    /**
     * Get user-specific BitwardenRESTAPI instance
     */
    getUserVaultAPI(userIdentity: UserIdentity): Promise<BitwardenRESTAPI>;
    /**
     * Generate secure master password
     */
    private generateSecurePassword;
    /**
     * Create cache key for user identity
     */
    private getUserCacheKey;
    /**
     * Load user account from persistent storage
     */
    private loadUserAccount;
    /**
     * Save user account to persistent storage
     */
    private saveUserAccount;
    /**
     * Extract user identity from various auth providers
     */
    static extractUserIdentity(authData: any): UserIdentity;
    /**
     * Health check for provisioning system
     */
    healthCheck(): Promise<{
        status: 'healthy' | 'unhealthy';
        details: any;
    }>;
}
export default VaultwardenUserProvisioning;
//# sourceMappingURL=VaultwardenUserProvisioning.d.ts.map