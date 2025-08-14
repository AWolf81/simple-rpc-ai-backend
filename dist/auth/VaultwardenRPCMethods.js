/**
 * Vaultwarden RPC Methods
 *
 * Implements the improved auth flow RPC methods for automatic onboarding
 * and client-side encryption with one Vaultwarden account per OpenSaaS user
 */
import * as winston from 'winston';
/**
 * RPC Methods for the improved Vaultwarden auth flow
 * Provides automatic onboarding and client-side encryption support
 */
export class VaultwardenRPCMethods {
    provisioning;
    userBridge;
    logger;
    constructor(provisioning, userBridge, logger) {
        this.provisioning = provisioning;
        this.userBridge = userBridge;
        this.logger = logger || winston.createLogger({
            level: 'info',
            format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
            transports: [new winston.transports.Console()]
        });
    }
    /**
     * RPC Method: vaultwarden.onboardUser
     *
     * Step 1-3 from sequence diagram:
     * - Validate OpenSaaS JWT
     * - Check/create Vaultwarden account
     * - Generate setup token
     */
    async onboardUser(params) {
        const { opensaasJWT } = params;
        if (!opensaasJWT) {
            throw new Error('Missing required parameter: opensaasJWT');
        }
        this.logger.info('Starting user onboarding', {
            jwtPrefix: opensaasJWT.substring(0, 20) + '...'
        });
        try {
            // Validate JWT and extract user info
            const jwtPayload = this.userBridge.validateJWT(opensaasJWT);
            this.logger.info('JWT validated', {
                userId: jwtPayload.userId,
                email: jwtPayload.email,
                tier: jwtPayload.subscriptionTier
            });
            // Provision or get existing account + setup token
            const response = await this.provisioning.provisionUserAccount(jwtPayload);
            this.logger.info('User onboarding completed', {
                opensaasUserId: jwtPayload.userId,
                vaultwardenUserId: response.vaultwardenUserId,
                setupTokenExpires: response.expiresAt.toISOString()
            });
            return response;
        }
        catch (error) {
            this.logger.error('User onboarding failed', {
                error: error.message,
                jwtPrefix: opensaasJWT.substring(0, 20) + '...'
            });
            throw new Error(`Onboarding failed: ${error.message}`);
        }
    }
    /**
     * RPC Method: vaultwarden.completeSetup
     *
     * Step 4 from sequence diagram:
     * - Client completes account setup with master password hash
     * - Master password derived client-side with Argon2id
     */
    async completeSetup(params) {
        const { setupToken, masterPasswordHash, encryptedPrivateKey } = params;
        if (!setupToken || !masterPasswordHash) {
            throw new Error('Missing required parameters: setupToken, masterPasswordHash');
        }
        this.logger.info('Completing account setup', {
            setupToken: setupToken.substring(0, 16) + '...',
            hasMasterHash: !!masterPasswordHash,
            hasPrivateKey: !!encryptedPrivateKey
        });
        try {
            const result = await this.provisioning.completeAccountSetup({
                setupToken,
                masterPasswordHash,
                encryptedPrivateKey
            });
            this.logger.info('Account setup completed', {
                vaultwardenUserId: result.vaultwardenUserId,
                success: result.success
            });
            return result;
        }
        catch (error) {
            this.logger.error('Account setup failed', {
                error: error.message,
                setupToken: setupToken.substring(0, 16) + '...'
            });
            throw new Error(`Setup failed: ${error.message}`);
        }
    }
    /**
     * RPC Method: vaultwarden.getShortLivedToken
     *
     * Generate short-lived token for normal operations
     * Used after account setup is complete
     */
    async getShortLivedToken(params) {
        const { opensaasJWT } = params;
        if (!opensaasJWT) {
            throw new Error('Missing required parameter: opensaasJWT');
        }
        try {
            // Validate JWT and extract user info
            const jwtPayload = this.userBridge.validateJWT(opensaasJWT);
            // Check if account is provisioned
            if (!this.provisioning.isAccountProvisioned(jwtPayload.userId)) {
                throw new Error('User account not provisioned. Complete setup first.');
            }
            // Generate short-lived token
            const tokenData = await this.provisioning.generateShortLivedToken(jwtPayload.userId);
            this.logger.info('Generated short-lived token', {
                opensaasUserId: jwtPayload.userId,
                vaultwardenUserId: tokenData.vaultwardenUserId,
                expiresAt: tokenData.expiresAt.toISOString()
            });
            return {
                accessToken: tokenData.accessToken,
                expiresAt: tokenData.expiresAt.toISOString(),
                vaultwardenUserId: tokenData.vaultwardenUserId
            };
        }
        catch (error) {
            this.logger.error('Token generation failed', {
                error: error.message,
                jwtPrefix: opensaasJWT.substring(0, 20) + '...'
            });
            throw new Error(`Token generation failed: ${error.message}`);
        }
    }
    /**
     * RPC Method: vaultwarden.storeEncryptedKey
     *
     * Step 5 from sequence diagram:
     * - Store client-encrypted API key in Vaultwarden
     * - Key is already encrypted client-side with user's Master Key
     */
    async storeEncryptedKey(params) {
        const { opensaasJWT, encryptedApiKey, provider, keyMetadata } = params;
        if (!opensaasJWT || !encryptedApiKey || !provider || !keyMetadata) {
            throw new Error('Missing required parameters: opensaasJWT, encryptedApiKey, provider, keyMetadata');
        }
        try {
            // Validate JWT and get user info
            const jwtPayload = this.userBridge.validateJWT(opensaasJWT);
            // Verify account is provisioned
            if (!this.provisioning.isAccountProvisioned(jwtPayload.userId)) {
                throw new Error('User account not provisioned');
            }
            const accountInfo = this.provisioning.getAccountInfo(jwtPayload.userId);
            if (!accountInfo) {
                throw new Error('Account not found');
            }
            // Store encrypted key in user's Vaultwarden vault
            // The key is already encrypted client-side, so Vaultwarden only stores ciphertext
            const keyId = await this.provisioning.storeEncryptedKey(jwtPayload.userId, `${provider}_api_key`, encryptedApiKey, provider, keyMetadata);
            this.logger.info('Stored encrypted API key', {
                opensaasUserId: jwtPayload.userId,
                vaultwardenUserId: accountInfo.vaultwardenUserId,
                provider,
                keyId,
                algorithm: keyMetadata.algorithm,
                encryptedKeyLength: encryptedApiKey.length
            });
            return {
                success: true,
                keyId,
                message: `Encrypted ${provider} API key stored successfully`
            };
        }
        catch (error) {
            this.logger.error('Key storage failed', {
                error: error.message,
                provider,
                jwtPrefix: opensaasJWT.substring(0, 20) + '...'
            });
            throw new Error(`Key storage failed: ${error.message}`);
        }
    }
    /**
     * RPC Method: vaultwarden.retrieveEncryptedKey
     *
     * Normal operation: retrieve encrypted API key
     * Returns ciphertext that client must decrypt with their Master Key
     */
    async retrieveEncryptedKey(params) {
        const { shortLivedToken, provider } = params;
        if (!shortLivedToken || !provider) {
            throw new Error('Missing required parameters: shortLivedToken, provider');
        }
        try {
            // Validate short-lived access token 
            const tokenValidation = await this.validateAccessToken(shortLivedToken);
            if (!tokenValidation.isValid || !tokenValidation.opensaasUserId) {
                throw new Error('Invalid or expired access token');
            }
            // Find API key items for this provider
            const vaultItems = await this.provisioning.listUserVaultItems(tokenValidation.opensaasUserId);
            const apiKeyItem = vaultItems.find(item => item.name.includes(`${provider}_api_key`));
            if (!apiKeyItem) {
                throw new Error(`No API key found for provider: ${provider}`);
            }
            // Retrieve encrypted key data
            const keyData = await this.provisioning.retrieveEncryptedKey(tokenValidation.opensaasUserId, apiKeyItem.id);
            if (!keyData) {
                throw new Error('Failed to retrieve encrypted key');
            }
            this.logger.info('Retrieved encrypted API key', {
                opensaasUserId: tokenValidation.opensaasUserId,
                provider,
                tokenPrefix: shortLivedToken.substring(0, 16) + '...',
                keyId: apiKeyItem.id
            });
            return {
                encryptedApiKey: keyData.encryptedApiKey,
                keyMetadata: {
                    ...keyData.keyMetadata,
                    keyId: apiKeyItem.id,
                    provider
                }
            };
        }
        catch (error) {
            this.logger.error('Key retrieval failed', {
                error: error.message,
                provider,
                tokenPrefix: shortLivedToken.substring(0, 16) + '...'
            });
            throw error;
        }
    }
    /**
     * RPC Method: vaultwarden.getAccountStatus
     *
     * Check account provisioning status
     */
    async getAccountStatus(params) {
        const { opensaasJWT } = params;
        if (!opensaasJWT) {
            throw new Error('Missing required parameter: opensaasJWT');
        }
        try {
            const jwtPayload = this.userBridge.validateJWT(opensaasJWT);
            const accountInfo = this.provisioning.getAccountInfo(jwtPayload.userId);
            return {
                isProvisioned: accountInfo?.isProvisioned ?? false,
                needsSetup: !accountInfo?.isProvisioned,
                vaultwardenUserId: accountInfo?.vaultwardenUserId,
                accountCreated: accountInfo?.createdAt.toISOString()
            };
        }
        catch (error) {
            throw new Error(`Status check failed: ${error.message}`);
        }
    }
    /**
     * Validate access token and return user info
     */
    async validateAccessToken(token) {
        // In production, this would validate the token properly
        // For now, simulate validation based on token format
        if (!token || !token.startsWith('vw_')) {
            return { isValid: false, error: 'Invalid token format' };
        }
        // Extract user ID from token (in production, this would be proper token validation)
        // For now, we'll need to store token->user mapping or validate via the provisioning service
        return { isValid: true, opensaasUserId: 'dummy_user_id' };
    }
    /**
     * List user's vault items
     */
    async listUserVaultItems(opensaasUserId) {
        return await this.provisioning.listUserVaultItems(opensaasUserId);
    }
    /**
     * Health check for all components
     */
    async healthCheck() {
        try {
            const provisioningHealth = await this.provisioning.healthCheck();
            const bridgeHealth = await this.userBridge.healthCheck();
            const isHealthy = provisioningHealth.status === 'healthy' && bridgeHealth.status === 'healthy';
            return {
                status: isHealthy ? 'healthy' : 'unhealthy',
                details: {
                    provisioning: provisioningHealth,
                    userBridge: bridgeHealth,
                    rpcMethods: {
                        availableMethods: [
                            'vaultwarden.onboardUser',
                            'vaultwarden.completeSetup',
                            'vaultwarden.getShortLivedToken',
                            'vaultwarden.storeEncryptedKey',
                            'vaultwarden.retrieveEncryptedKey',
                            'vaultwarden.getAccountStatus'
                        ]
                    }
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
export default VaultwardenRPCMethods;
//# sourceMappingURL=VaultwardenRPCMethods.js.map