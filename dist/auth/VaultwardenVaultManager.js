/**
 * Vaultwarden Vault Manager
 *
 * Manages generated vault passwords and vault operations
 * Separates vault access from user authentication passwords
 */
import { randomBytes, createCipheriv, createDecipheriv } from 'crypto';
import { BitwardenRESTAPI } from './BitwardenRESTAPI.js';
import * as winston from 'winston';
/**
 * Manages Vaultwarden vault access with generated passwords
 * Separates vault operations from user authentication
 */
export class VaultwardenVaultManager {
    baseConfig;
    logger;
    vaultCredentials = new Map();
    activeSessions = new Map();
    masterEncryptionKey;
    constructor(baseConfig, masterKey, logger) {
        this.baseConfig = baseConfig;
        this.logger = logger || winston.createLogger({
            level: 'info',
            format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
            transports: [new winston.transports.Console()]
        });
        // Master key for encrypting stored vault passwords (32 bytes for AES-256)
        this.masterEncryptionKey = masterKey
            ? Buffer.from(masterKey, 'utf8')
            : randomBytes(32);
    }
    /**
     * Create vault with generated password (called during user provisioning)
     */
    async createUserVault(opensaasUserId, vaultwardenUserId) {
        try {
            // Generate strong master password for the vault
            const generatedPassword = this.generateSecureVaultPassword();
            this.logger.info('Creating Vaultwarden vault with generated password', {
                opensaasUserId,
                vaultwardenUserId
            });
            // In production, this would call Vaultwarden Admin API to:
            // 1. Create user account with generated password
            // 2. Set up vault with proper encryption
            // 3. Configure organization membership if using organizations
            // For now, simulate vault creation
            const credentials = {
                vaultwardenUserId,
                generatedMasterPassword: generatedPassword,
                encryptedMasterPassword: this.encryptPassword(generatedPassword),
                createdAt: new Date(),
                lastUsed: new Date()
            };
            this.vaultCredentials.set(opensaasUserId, credentials);
            this.logger.info('Vault created successfully', {
                opensaasUserId,
                vaultwardenUserId,
                passwordLength: generatedPassword.length
            });
            return {
                success: true,
                vaultPassword: generatedPassword // Only during creation
            };
        }
        catch (error) {
            this.logger.error('Failed to create user vault', {
                opensaasUserId,
                vaultwardenUserId,
                error: error.message
            });
            return { success: false };
        }
    }
    /**
     * Get active vault session for user (creates if needed)
     */
    async getVaultSession(opensaasUserId) {
        // Check for active session
        const existingSession = this.activeSessions.get(opensaasUserId);
        if (existingSession && new Date() < existingSession.expiresAt) {
            this.logger.debug('Using existing vault session', { opensaasUserId });
            return existingSession;
        }
        // Clean up expired session
        if (existingSession) {
            this.activeSessions.delete(opensaasUserId);
        }
        // Get vault credentials
        const credentials = this.vaultCredentials.get(opensaasUserId);
        if (!credentials) {
            throw new Error('Vault not found for user. Complete setup first.');
        }
        // Create new Bitwarden session
        const decryptedPassword = this.decryptPassword(credentials.encryptedMasterPassword);
        const vaultConfig = {
            ...this.baseConfig,
            // Use generated password instead of user password
            masterPassword: decryptedPassword
        };
        const bitwardenAPI = new BitwardenRESTAPI(vaultConfig, this.logger);
        await bitwardenAPI.initialize();
        // Create session
        const session = {
            vaultwardenUserId: credentials.vaultwardenUserId,
            sessionToken: `vault_session_${Date.now()}_${randomBytes(16).toString('hex')}`,
            expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes
            bitwardenAPI
        };
        this.activeSessions.set(opensaasUserId, session);
        // Update last used
        credentials.lastUsed = new Date();
        this.logger.info('Created vault session', {
            opensaasUserId,
            sessionToken: session.sessionToken.substring(0, 20) + '...',
            expiresAt: session.expiresAt.toISOString()
        });
        return session;
    }
    /**
     * Store encrypted item in user's vault
     */
    async storeVaultItem(opensaasUserId, itemName, encryptedData, itemType = 'api_key') {
        const session = await this.getVaultSession(opensaasUserId);
        // Store in Vaultwarden using the session
        const itemId = await session.bitwardenAPI.createSecret(itemName, encryptedData, `Encrypted ${itemType} - Client-side encrypted data`);
        this.logger.info('Stored encrypted item in vault', {
            opensaasUserId,
            itemName,
            itemId,
            itemType,
            dataSize: encryptedData.length
        });
        return itemId;
    }
    /**
     * Retrieve encrypted item from user's vault
     */
    async retrieveVaultItem(opensaasUserId, itemId) {
        const session = await this.getVaultSession(opensaasUserId);
        const item = await session.bitwardenAPI.getItem(itemId);
        if (!item) {
            return null;
        }
        this.logger.info('Retrieved encrypted item from vault', {
            opensaasUserId,
            itemId,
            dataSize: item.value?.length || 0
        });
        return {
            encryptedData: item.value || '',
            metadata: {
                name: item.name,
                createdAt: item.creationDate,
                updatedAt: item.revisionDate
            }
        };
    }
    /**
     * List user's vault items
     */
    async listVaultItems(opensaasUserId) {
        const session = await this.getVaultSession(opensaasUserId);
        const items = await session.bitwardenAPI.listItems();
        return items.map(item => ({
            id: item.id,
            name: item.name,
            createdAt: item.creationDate
        }));
    }
    /**
     * Rotate vault password (security maintenance)
     */
    async rotateVaultPassword(opensaasUserId) {
        try {
            const credentials = this.vaultCredentials.get(opensaasUserId);
            if (!credentials) {
                throw new Error('Vault not found');
            }
            // Generate new password
            const newPassword = this.generateSecureVaultPassword();
            // In production, call Vaultwarden Admin API to change password
            // This would require re-encrypting the vault with new password
            // Update stored credentials
            credentials.generatedMasterPassword = newPassword;
            credentials.encryptedMasterPassword = this.encryptPassword(newPassword);
            // Invalidate existing sessions
            const existingSession = this.activeSessions.get(opensaasUserId);
            if (existingSession) {
                await existingSession.bitwardenAPI.cleanup();
                this.activeSessions.delete(opensaasUserId);
            }
            this.logger.info('Rotated vault password', { opensaasUserId });
            return true;
        }
        catch (error) {
            this.logger.error('Failed to rotate vault password', {
                opensaasUserId,
                error: error.message
            });
            return false;
        }
    }
    /**
     * Clean up expired sessions
     */
    cleanupExpiredSessions() {
        const now = new Date();
        const expiredSessions = [];
        for (const [userId, session] of this.activeSessions.entries()) {
            if (now > session.expiresAt) {
                expiredSessions.push(userId);
            }
        }
        for (const userId of expiredSessions) {
            const session = this.activeSessions.get(userId);
            if (session) {
                session.bitwardenAPI.cleanup();
                this.activeSessions.delete(userId);
            }
        }
        if (expiredSessions.length > 0) {
            this.logger.info('Cleaned up expired vault sessions', {
                expiredCount: expiredSessions.length
            });
        }
    }
    /**
     * Generate cryptographically secure vault password
     */
    generateSecureVaultPassword() {
        // Generate 32 character password with mixed case, numbers, symbols
        const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';
        const length = 32;
        const bytes = randomBytes(length);
        let password = '';
        for (let i = 0; i < length; i++) {
            password += charset[bytes[i] % charset.length];
        }
        return password;
    }
    /**
     * Encrypt password for storage using AES-256-GCM
     */
    encryptPassword(password) {
        const iv = randomBytes(16);
        const cipher = createCipheriv('aes-256-gcm', this.masterEncryptionKey, iv);
        let encrypted = cipher.update(password, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        const authTag = cipher.getAuthTag();
        // Combine IV + authTag + encrypted data
        return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
    }
    /**
     * Decrypt stored password using AES-256-GCM
     */
    decryptPassword(encryptedData) {
        const parts = encryptedData.split(':');
        if (parts.length !== 3) {
            throw new Error('Invalid encrypted data format');
        }
        const iv = Buffer.from(parts[0], 'hex');
        const authTag = Buffer.from(parts[1], 'hex');
        const encrypted = parts[2];
        const decipher = createDecipheriv('aes-256-gcm', this.masterEncryptionKey, iv);
        decipher.setAuthTag(authTag);
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    }
    /**
     * Health check
     */
    async healthCheck() {
        try {
            const activeSessionCount = this.activeSessions.size;
            const vaultCount = this.vaultCredentials.size;
            return {
                status: 'healthy',
                details: {
                    activeVaults: vaultCount,
                    activeSessions: activeSessionCount,
                    masterKeyConfigured: this.masterEncryptionKey.length > 0
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
    /**
     * Cleanup resources
     */
    async shutdown() {
        // Clean up all active sessions
        for (const [userId, session] of this.activeSessions.entries()) {
            try {
                await session.bitwardenAPI.cleanup();
            }
            catch (error) {
                this.logger.error('Error cleaning up session during shutdown', {
                    userId,
                    error: error instanceof Error ? error.message : String(error)
                });
            }
        }
        this.activeSessions.clear();
        this.vaultCredentials.clear();
        this.logger.info('VaultwardenVaultManager shutdown completed');
    }
}
export default VaultwardenVaultManager;
//# sourceMappingURL=VaultwardenVaultManager.js.map