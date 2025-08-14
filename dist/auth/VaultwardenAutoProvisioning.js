/**
 * Vaultwarden Auto-Provisioning Service
 *
 * Implements automatic Vaultwarden account creation per OpenSaaS user
 * Handles one-time setup tokens and client-side encryption setup
 */
import { ShortLivedTokenManager } from './ShortLivedTokenManager.js';
import { VaultwardenVaultManager } from './VaultwardenVaultManager.js';
import * as winston from 'winston';
/**
 * Manages automatic provisioning of Vaultwarden accounts for OpenSaaS users
 * Implements the improved auth flow with client-side encryption
 */
export class VaultwardenAutoProvisioning {
    bitwardenConfig;
    userBridge;
    logger;
    accounts = new Map();
    tokenManager;
    vaultManager;
    constructor(bitwardenConfig, userBridge, hmacSecret, vaultMasterKey, logger) {
        this.bitwardenConfig = bitwardenConfig;
        this.userBridge = userBridge;
        this.logger = logger || winston.createLogger({
            level: 'info',
            format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
            transports: [new winston.transports.Console()]
        });
        // Initialize token manager
        this.tokenManager = new ShortLivedTokenManager(hmacSecret, this.logger);
        // Initialize vault manager with generated passwords
        this.vaultManager = new VaultwardenVaultManager(this.bitwardenConfig, vaultMasterKey, this.logger);
    }
    /**
     * Initialize the auto-provisioning service
     */
    async initialize() {
        await this.userBridge.initialize();
        this.logger.info('VaultwardenAutoProvisioning initialized');
    }
    /**
     * Step 1-3 from sequence: Check/create Vaultwarden account and issue setup token
     */
    async provisionUserAccount(jwtPayload) {
        const opensaasUserId = jwtPayload.userId;
        const email = jwtPayload.email;
        this.logger.info('Provisioning Vaultwarden account', { opensaasUserId, email });
        // Check if account already exists
        let account = this.accounts.get(opensaasUserId);
        if (!account) {
            // Create new account mapping
            const vaultwardenUserId = this.generateVaultwardenUserId(email);
            account = {
                opensaasUserId,
                email,
                vaultwardenUserId,
                isProvisioned: false,
                createdAt: new Date()
            };
            this.accounts.set(opensaasUserId, account);
            this.logger.info('Created account mapping', { opensaasUserId, vaultwardenUserId });
        }
        // Generate setup token using token manager
        const tokenData = this.tokenManager.generateSetupToken(opensaasUserId, account.vaultwardenUserId, {
            email,
            subscriptionTier: jwtPayload.subscriptionTier
        });
        // Update account with setup token
        account.setupToken = tokenData.token;
        account.setupTokenExpires = tokenData.expiresAt;
        this.logger.info('Generated setup token', {
            opensaasUserId,
            setupToken: tokenData.token.substring(0, 16) + '...',
            expiresAt: tokenData.expiresAt.toISOString()
        });
        return {
            setupToken: tokenData.token,
            vaultwardenUserId: account.vaultwardenUserId,
            expiresAt: tokenData.expiresAt
        };
    }
    /**
     * Step 4: Validate setup token and complete account setup
     * Client provides the master password hash (derived client-side with Argon2id)
     */
    async completeAccountSetup(setupRequest) {
        const { setupToken, masterPasswordHash, encryptedPrivateKey } = setupRequest;
        // Validate and consume setup token (single-use)
        const tokenValidation = this.tokenManager.consumeSetupToken(setupToken);
        if (!tokenValidation.isValid || !tokenValidation.tokenData) {
            throw new Error(`Setup token validation failed: ${tokenValidation.error}`);
        }
        const tokenData = tokenValidation.tokenData;
        const account = this.accounts.get(tokenData.opensaasUserId);
        if (!account) {
            throw new Error('Account not found');
        }
        try {
            // Complete Vaultwarden account setup with GENERATED password
            // The masterPasswordHash from client is stored for client-side verification only
            // We generate our own vault password for server-side operations
            this.logger.info('Completing Vaultwarden account setup', {
                opensaasUserId: tokenData.opensaasUserId,
                vaultwardenUserId: tokenData.vaultwardenUserId,
                hasClientHash: !!masterPasswordHash,
                hasEncryptedPrivateKey: !!encryptedPrivateKey
            });
            // Create vault with server-generated password
            const vaultResult = await this.vaultManager.createUserVault(tokenData.opensaasUserId, tokenData.vaultwardenUserId);
            if (!vaultResult.success) {
                throw new Error('Failed to create Vaultwarden vault');
            }
            // Store client's master password hash for their own verification
            // (This is separate from the vault password we generated)
            account.clientMasterPasswordHash = masterPasswordHash;
            // Mark account as provisioned
            account.isProvisioned = true;
            account.setupToken = undefined;
            account.setupTokenExpires = undefined;
            this.logger.info('Account setup completed', {
                opensaasUserId: tokenData.opensaasUserId,
                vaultwardenUserId: tokenData.vaultwardenUserId,
                vaultCreated: vaultResult.success
            });
            return {
                success: true,
                vaultwardenUserId: tokenData.vaultwardenUserId,
                message: 'Account setup completed successfully'
            };
        }
        catch (error) {
            this.logger.error('Account setup failed', {
                opensaasUserId: tokenData.opensaasUserId,
                error: error.message
            });
            throw error;
        }
    }
    /**
     * Generate short-lived Vaultwarden access token for existing user
     */
    async generateShortLivedToken(opensaasUserId) {
        const account = this.accounts.get(opensaasUserId);
        if (!account || !account.isProvisioned) {
            throw new Error('User account not provisioned');
        }
        // Generate short-lived access token using token manager
        const tokenData = this.tokenManager.generateAccessToken(opensaasUserId, account.vaultwardenUserId, {
            email: account.email,
            scope: ['read:vault', 'write:vault']
        });
        this.logger.info('Generated short-lived access token', {
            opensaasUserId,
            vaultwardenUserId: account.vaultwardenUserId,
            accessToken: tokenData.token.substring(0, 16) + '...',
            expiresAt: tokenData.expiresAt.toISOString()
        });
        return {
            accessToken: tokenData.token,
            expiresAt: tokenData.expiresAt,
            vaultwardenUserId: account.vaultwardenUserId
        };
    }
    /**
     * Store encrypted API key in user's vault
     */
    async storeEncryptedKey(opensaasUserId, itemName, encryptedApiKey, provider, keyMetadata) {
        if (!this.isAccountProvisioned(opensaasUserId)) {
            throw new Error('User account not provisioned');
        }
        // Store in Vaultwarden vault using the vault manager
        const itemId = await this.vaultManager.storeVaultItem(opensaasUserId, itemName, JSON.stringify({
            encryptedApiKey,
            provider,
            keyMetadata,
            storedAt: new Date().toISOString()
        }), 'api_key');
        this.logger.info('Stored encrypted API key in vault', {
            opensaasUserId,
            provider,
            itemId,
            itemName
        });
        return itemId;
    }
    /**
     * Retrieve encrypted API key from user's vault
     */
    async retrieveEncryptedKey(opensaasUserId, itemId) {
        if (!this.isAccountProvisioned(opensaasUserId)) {
            throw new Error('User account not provisioned');
        }
        const vaultItem = await this.vaultManager.retrieveVaultItem(opensaasUserId, itemId);
        if (!vaultItem) {
            return null;
        }
        try {
            const itemData = JSON.parse(vaultItem.encryptedData);
            this.logger.info('Retrieved encrypted API key from vault', {
                opensaasUserId,
                itemId,
                provider: itemData.provider
            });
            return {
                encryptedApiKey: itemData.encryptedApiKey,
                keyMetadata: itemData.keyMetadata
            };
        }
        catch (error) {
            this.logger.error('Failed to parse vault item data', {
                opensaasUserId,
                itemId,
                error: error.message
            });
            return null;
        }
    }
    /**
     * Check if user account is provisioned and ready
     */
    isAccountProvisioned(opensaasUserId) {
        const account = this.accounts.get(opensaasUserId);
        return account?.isProvisioned ?? false;
    }
    /**
     * List user's vault items
     */
    async listUserVaultItems(opensaasUserId) {
        if (!this.isAccountProvisioned(opensaasUserId)) {
            throw new Error('User account not provisioned');
        }
        return await this.vaultManager.listVaultItems(opensaasUserId);
    }
    /**
     * Get account info for user
     */
    getAccountInfo(opensaasUserId) {
        return this.accounts.get(opensaasUserId) || null;
    }
    /**
     * Clean up expired tokens (maintenance)
     * Delegated to TokenManager
     */
    cleanupExpiredTokens() {
        // TokenManager handles cleanup automatically via interval
        const stats = this.tokenManager.getTokenStats();
        this.logger.debug('Token cleanup - current stats', stats);
    }
    /**
     * Generate stable Vaultwarden user ID from email
     */
    generateVaultwardenUserId(email) {
        // Use email directly for simplicity
        // In production, you might want a more sophisticated mapping
        return email;
    }
    /**
     * Health check
     */
    async healthCheck() {
        try {
            const bridgeHealth = await this.userBridge.healthCheck();
            const tokenHealth = this.tokenManager.healthCheck();
            const isHealthy = bridgeHealth.status === 'healthy' && tokenHealth.status === 'healthy';
            return {
                status: isHealthy ? 'healthy' : 'unhealthy',
                details: {
                    totalAccounts: this.accounts.size,
                    provisionedAccounts: Array.from(this.accounts.values()).filter(a => a.isProvisioned).length,
                    tokenManager: tokenHealth,
                    userBridge: bridgeHealth
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
}
export default VaultwardenAutoProvisioning;
//# sourceMappingURL=VaultwardenAutoProvisioning.js.map