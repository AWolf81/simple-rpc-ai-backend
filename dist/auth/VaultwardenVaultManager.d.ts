/**
 * Vaultwarden Vault Manager
 *
 * Manages generated vault passwords and vault operations
 * Separates vault access from user authentication passwords
 */
import { BitwardenRESTAPI, BitwardenConfig } from './BitwardenRESTAPI.js';
import * as winston from 'winston';
export interface VaultCredentials {
    vaultwardenUserId: string;
    generatedMasterPassword: string;
    encryptedMasterPassword: string;
    createdAt: Date;
    lastUsed: Date;
}
export interface VaultSession {
    vaultwardenUserId: string;
    sessionToken: string;
    expiresAt: Date;
    bitwardenAPI: BitwardenRESTAPI;
}
/**
 * Manages Vaultwarden vault access with generated passwords
 * Separates vault operations from user authentication
 */
export declare class VaultwardenVaultManager {
    private baseConfig;
    private logger;
    private vaultCredentials;
    private activeSessions;
    private masterEncryptionKey;
    constructor(baseConfig: BitwardenConfig, masterKey?: string, logger?: winston.Logger);
    /**
     * Create vault with generated password (called during user provisioning)
     */
    createUserVault(opensaasUserId: string, vaultwardenUserId: string): Promise<{
        success: boolean;
        vaultPassword?: string;
    }>;
    /**
     * Get active vault session for user (creates if needed)
     */
    getVaultSession(opensaasUserId: string): Promise<VaultSession>;
    /**
     * Store encrypted item in user's vault
     */
    storeVaultItem(opensaasUserId: string, itemName: string, encryptedData: string, itemType?: 'api_key' | 'secret' | 'note'): Promise<string>;
    /**
     * Retrieve encrypted item from user's vault
     */
    retrieveVaultItem(opensaasUserId: string, itemId: string): Promise<{
        encryptedData: string;
        metadata: any;
    } | null>;
    /**
     * List user's vault items
     */
    listVaultItems(opensaasUserId: string): Promise<Array<{
        id: string;
        name: string;
        createdAt: string;
    }>>;
    /**
     * Rotate vault password (security maintenance)
     */
    rotateVaultPassword(opensaasUserId: string): Promise<boolean>;
    /**
     * Clean up expired sessions
     */
    cleanupExpiredSessions(): void;
    /**
     * Generate cryptographically secure vault password
     */
    private generateSecureVaultPassword;
    /**
     * Encrypt password for storage using AES-256-GCM
     */
    private encryptPassword;
    /**
     * Decrypt stored password using AES-256-GCM
     */
    private decryptPassword;
    /**
     * Health check
     */
    healthCheck(): Promise<{
        status: 'healthy' | 'unhealthy';
        details: any;
    }>;
    /**
     * Cleanup resources
     */
    shutdown(): Promise<void>;
}
export default VaultwardenVaultManager;
//# sourceMappingURL=VaultwardenVaultManager.d.ts.map