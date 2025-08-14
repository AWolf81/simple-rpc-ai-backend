/**
 * Isolated Vaultwarden Key Methods with Auto-Provisioning
 *
 * RPC methods that automatically provision isolated Vaultwarden users
 * Supports OpenSaaS + OAuth2 providers with true vault isolation
 */
import { VaultwardenUserProvisioning } from '../auth/VaultwardenUserProvisioning.js';
/**
 * Create RPC methods with automatic user provisioning
 */
export function createIsolatedKeyMethods(context) {
    const { userProvisioning, logger } = context;
    return {
        /**
         * Store API key with automatic user provisioning
         *
         * This method:
         * 1. Extracts user identity from JWT/OAuth token
         * 2. Auto-provisions Vaultwarden user if needed
         * 3. Stores API key in user's isolated vault
         */
        async storeUserKey(params) {
            try {
                logger.info('📥 RPC: storeUserKey called', {
                    provider: params.provider,
                    hasOpenSaaSJWT: !!params.opensaasJWT,
                    hasOAuthToken: !!params.oauthToken,
                    userEmail: params.userEmail
                });
                // Extract user identity from auth data
                const userIdentity = await this.extractUserIdentity(params);
                logger.info('👤 User identity extracted', {
                    email: userIdentity.email,
                    provider: userIdentity.authProvider,
                    opensaasUserId: userIdentity.opensaasUserId
                });
                // Get or create user's isolated Vaultwarden account
                const userVaultAPI = await userProvisioning.getUserVaultAPI(userIdentity);
                // Store API key in user's isolated vault
                const keyName = params.keyName || `${params.provider}_api_key_${Date.now()}`;
                const result = await userVaultAPI.storeSecret(keyName, params.apiKey, params.description || `${params.provider} API key for ${userIdentity.email}`, {
                    provider: params.provider,
                    userId: userIdentity.email,
                    authProvider: userIdentity.authProvider,
                    createdAt: new Date().toISOString()
                });
                await userVaultAPI.cleanup();
                logger.info('✅ API key stored in isolated vault', {
                    email: userIdentity.email,
                    provider: params.provider,
                    keyId: result.id,
                    keyName
                });
                return {
                    success: true,
                    keyId: result.id,
                    message: `${params.provider} API key stored successfully`,
                    userVault: {
                        email: userIdentity.email,
                        isolated: true,
                        provider: userIdentity.authProvider
                    }
                };
            }
            catch (error) {
                logger.error('❌ storeUserKey failed', {
                    error: error.message,
                    provider: params.provider,
                    userEmail: params.userEmail
                });
                return {
                    success: false,
                    error: 'STORE_KEY_FAILED',
                    message: error.message
                };
            }
        },
        /**
         * Retrieve API key from user's isolated vault
         */
        async getUserKey(params) {
            try {
                logger.info('📥 RPC: getUserKey called', {
                    provider: params.provider,
                    keyId: params.keyId,
                    keyName: params.keyName
                });
                // Extract user identity
                const userIdentity = await this.extractUserIdentity(params);
                // Get user's isolated vault API
                const userVaultAPI = await userProvisioning.getUserVaultAPI(userIdentity);
                let apiKey;
                if (params.keyId) {
                    // Retrieve by ID
                    const result = await userVaultAPI.getSecret(params.keyId);
                    apiKey = result.value;
                }
                else if (params.keyName) {
                    // Search by name
                    const items = await userVaultAPI.listItems();
                    const item = items.find(item => item.name === params.keyName);
                    if (!item) {
                        throw new Error(`API key not found: ${params.keyName}`);
                    }
                    const result = await userVaultAPI.getSecret(item.id);
                    apiKey = result.value;
                }
                else {
                    // Search by provider (get most recent)
                    const items = await userVaultAPI.listItems();
                    const providerItems = items.filter(item => item.name.toLowerCase().includes(params.provider.toLowerCase()));
                    if (providerItems.length === 0) {
                        throw new Error(`No API key found for provider: ${params.provider}`);
                    }
                    // Get most recent
                    const mostRecent = providerItems.sort((a, b) => new Date(b.creationDate).getTime() - new Date(a.creationDate).getTime())[0];
                    const result = await userVaultAPI.getSecret(mostRecent.id);
                    apiKey = result.value;
                }
                await userVaultAPI.cleanup();
                logger.info('✅ API key retrieved from isolated vault', {
                    email: userIdentity.email,
                    provider: params.provider,
                    keyLength: apiKey.length
                });
                return {
                    success: true,
                    apiKey,
                    provider: params.provider,
                    userVault: {
                        email: userIdentity.email,
                        isolated: true
                    }
                };
            }
            catch (error) {
                logger.error('❌ getUserKey failed', {
                    error: error.message,
                    provider: params.provider
                });
                return {
                    success: false,
                    error: 'GET_KEY_FAILED',
                    message: error.message
                };
            }
        },
        /**
         * List user's providers (from their isolated vault)
         */
        async getUserProviders(params) {
            try {
                const userIdentity = await this.extractUserIdentity(params);
                const userVaultAPI = await userProvisioning.getUserVaultAPI(userIdentity);
                const items = await userVaultAPI.listItems();
                // Extract providers from vault items
                const providers = items.map(item => {
                    const metadata = item.notes ? JSON.parse(item.notes) : {};
                    return {
                        provider: metadata.provider || 'unknown',
                        keyName: item.name,
                        keyId: item.id,
                        createdAt: metadata.createdAt || item.creationDate
                    };
                });
                await userVaultAPI.cleanup();
                logger.info('📋 Listed user providers', {
                    email: userIdentity.email,
                    providerCount: providers.length
                });
                return {
                    success: true,
                    providers,
                    userVault: {
                        email: userIdentity.email,
                        isolated: true
                    }
                };
            }
            catch (error) {
                logger.error('❌ getUserProviders failed', {
                    error: error.message
                });
                return {
                    success: false,
                    error: 'LIST_PROVIDERS_FAILED',
                    message: error.message
                };
            }
        },
        /**
         * Delete API key from user's isolated vault
         */
        async deleteUserKey(params) {
            try {
                const userIdentity = await this.extractUserIdentity(params);
                const userVaultAPI = await userProvisioning.getUserVaultAPI(userIdentity);
                let deletedCount = 0;
                if (params.keyId) {
                    // Delete by ID
                    await userVaultAPI.deleteSecret(params.keyId);
                    deletedCount = 1;
                }
                else if (params.keyName) {
                    // Delete by name
                    const items = await userVaultAPI.listItems();
                    const item = items.find(item => item.name === params.keyName);
                    if (item) {
                        await userVaultAPI.deleteSecret(item.id);
                        deletedCount = 1;
                    }
                }
                else if (params.provider) {
                    // Delete all keys for provider
                    const items = await userVaultAPI.listItems();
                    const providerItems = items.filter(item => item.name.toLowerCase().includes(params.provider.toLowerCase()));
                    for (const item of providerItems) {
                        await userVaultAPI.deleteSecret(item.id);
                        deletedCount++;
                    }
                }
                await userVaultAPI.cleanup();
                logger.info('🗑️ API keys deleted from isolated vault', {
                    email: userIdentity.email,
                    provider: params.provider,
                    deletedCount
                });
                return {
                    success: true,
                    deletedCount,
                    message: `${deletedCount} API key(s) deleted successfully`
                };
            }
            catch (error) {
                logger.error('❌ deleteUserKey failed', {
                    error: error.message
                });
                return {
                    success: false,
                    error: 'DELETE_KEY_FAILED',
                    message: error.message
                };
            }
        },
        /**
         * Get user account info and vault status
         */
        async getUserVaultInfo(params) {
            try {
                const userIdentity = await this.extractUserIdentity(params);
                // This doesn't create an account, just checks if it exists
                const userAccount = await userProvisioning.getOrCreateUserAccount(userIdentity);
                return {
                    success: true,
                    userVault: {
                        email: userAccount.email,
                        vaultUserId: userAccount.vaultUserId,
                        isolated: true,
                        createdAt: userAccount.createdAt,
                        lastAccessAt: userAccount.lastAccessAt,
                        authProvider: userAccount.userIdentity.authProvider,
                        organizationId: userAccount.organizationId
                    }
                };
            }
            catch (error) {
                return {
                    success: false,
                    error: 'VAULT_INFO_FAILED',
                    message: error.message
                };
            }
        },
        /**
         * Extract user identity from various auth sources
         */
        async extractUserIdentity(params) {
            // Handle OpenSaaS JWT
            if (params.opensaasJWT) {
                const jwtPayload = this.decodeJWT(params.opensaasJWT);
                return VaultwardenUserProvisioning.extractUserIdentity(jwtPayload);
            }
            // Handle OAuth token
            if (params.oauthToken) {
                const tokenData = await this.validateOAuthToken(params.oauthToken);
                return VaultwardenUserProvisioning.extractUserIdentity(tokenData);
            }
            // Handle direct email (for testing/admin)
            if (params.userEmail) {
                return {
                    email: params.userEmail,
                    authProvider: 'opensaas'
                };
            }
            throw new Error('No valid authentication provided (opensaasJWT, oauthToken, or userEmail required)');
        },
        /**
         * Decode JWT token (simplified - use proper JWT library in production)
         */
        decodeJWT(jwt) {
            try {
                const payload = jwt.split('.')[1];
                return JSON.parse(Buffer.from(payload, 'base64').toString());
            }
            catch (error) {
                throw new Error('Invalid JWT token');
            }
        },
        /**
         * Validate OAuth token with provider
         */
        async validateOAuthToken(token) {
            // TODO: Implement OAuth token validation for different providers
            // This would validate the token with Google/GitHub/Microsoft/Auth0 APIs
            throw new Error('OAuth token validation not yet implemented');
        }
    };
}
export default createIsolatedKeyMethods;
//# sourceMappingURL=isolatedKeyMethods.js.map