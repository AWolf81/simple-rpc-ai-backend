/**
 * Secure User Vault Manager
 *
 * Implements true user isolation where:
 * - Service account can only create/provision user accounts
 * - Service account CANNOT access user secrets
 * - Each user has isolated Vaultwarden account with their own credentials
 * - Zero-trust: users authenticate with their own credentials for secret operations
 */
import { BitwardenConfig } from './BitwardenRESTAPI.js';
import * as winston from 'winston';
export interface UserVaultCredentials {
    userId: string;
    email: string;
    vaultwardenPassword: string;
    apiToken?: string;
    organizationId?: string;
    isProvisioned: boolean;
    createdAt: Date;
}
export interface SecureVaultManager {
    provisionUser(userJWT: string): Promise<UserVaultCredentials>;
    storeUserSecret(userCreds: UserVaultCredentials, name: string, secret: string): Promise<string>;
    getUserSecret(userCreds: UserVaultCredentials, secretId: string): Promise<string | null>;
    listUserSecrets(userCreds: UserVaultCredentials): Promise<Array<{
        id: string;
        name: string;
    }>>;
    validateUserIsolation(userA: UserVaultCredentials, userB: UserVaultCredentials): Promise<boolean>;
}
/**
 * Secure implementation that enforces user isolation
 */
export declare class SecureUserVaultManager implements SecureVaultManager {
    private serviceAccount;
    private userBridge;
    private autoProvisioning;
    private userVaults;
    private logger;
    constructor(serviceConfig: BitwardenConfig, logger?: winston.Logger);
    initialize(): Promise<void>;
    /**
     * SERVICE ACCOUNT OPERATION: Create new user account
     * Service account can do this but CANNOT access user secrets
     */
    provisionUser(userJWT: string): Promise<UserVaultCredentials>;
    /**
     * USER OPERATION: Store secret using USER's credentials
     * Service account CANNOT call this - requires user authentication
     */
    storeUserSecret(userCreds: UserVaultCredentials, name: string, secret: string): Promise<string>;
    /**
     * USER OPERATION: Get secret using USER's credentials
     * Service account CANNOT call this - requires user authentication
     */
    getUserSecret(userCreds: UserVaultCredentials, secretId: string): Promise<string | null>;
    /**
     * USER OPERATION: List user's secrets
     * Service account CANNOT call this - requires user authentication
     */
    listUserSecrets(userCreds: UserVaultCredentials): Promise<Array<{
        id: string;
        name: string;
    }>>;
    /**
     * SECURITY TEST: Validate that users cannot access each other's secrets
     */
    validateUserIsolation(userA: UserVaultCredentials, userB: UserVaultCredentials): Promise<boolean>;
    /**
     * SERVICE ACCOUNT SECURITY CHECK: Verify service account cannot access user secrets
     */
    verifyServiceAccountIsolation(userCreds: UserVaultCredentials): Promise<boolean>;
    /**
     * Create BitwardenRESTAPI instance for specific user
     */
    private createUserAPIInstance;
    /**
     * Validate user credentials
     */
    private validateUserCredentials;
    /**
     * Generate secure password for user's Vaultwarden account
     */
    private generateSecurePassword;
    /**
     * Parse JWT payload (simplified for demo)
     */
    private parseJWT;
    /**
     * Health check for the secure vault manager
     */
    healthCheck(): Promise<{
        status: 'healthy' | 'unhealthy';
        details: any;
    }>;
}
export default SecureUserVaultManager;
//# sourceMappingURL=SecureUserVaultManager.d.ts.map