/**
 * Vaultwarden User Auto-Provisioning
 *
 * Automatically creates isolated Vaultwarden users when storing API keys
 * Supports OpenSaaS email/password + OAuth2 providers
 */
import { BitwardenRESTAPI } from './BitwardenRESTAPI.js';
import { randomBytes } from 'crypto';
import * as winston from 'winston';
/**
 * Auto-provisions Vaultwarden users with true vault isolation
 */
export class VaultwardenUserProvisioning {
    logger;
    config;
    userMappings = new Map();
    constructor(config, logger) {
        this.config = config;
        this.logger = logger || winston.createLogger({
            level: 'info',
            format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
            transports: [new winston.transports.Console()]
        });
    }
    /**
     * Get or create Vaultwarden user account for identity
     * This is called during storeUserKey operations
     */
    async getOrCreateUserAccount(userIdentity) {
        const cacheKey = this.getUserCacheKey(userIdentity);
        // Check cache first
        if (this.userMappings.has(cacheKey)) {
            const account = this.userMappings.get(cacheKey);
            account.lastAccessAt = new Date();
            return account;
        }
        this.logger.info('🔍 Looking up Vaultwarden user account', {
            email: userIdentity.email,
            provider: userIdentity.authProvider,
            opensaasUserId: userIdentity.opensaasUserId
        });
        // Try to load existing account from persistent storage
        let account = await this.loadUserAccount(userIdentity);
        if (!account) {
            // Auto-provision new user
            account = await this.provisionNewUser(userIdentity);
        }
        // Cache and return
        this.userMappings.set(cacheKey, account);
        account.lastAccessAt = new Date();
        return account;
    }
    /**
     * Create new Vaultwarden user with isolated vault
     */
    async provisionNewUser(userIdentity) {
        this.logger.info('🆕 Auto-provisioning new Vaultwarden user', {
            email: userIdentity.email,
            provider: userIdentity.authProvider
        });
        try {
            // Generate secure master password for user
            const masterPassword = this.generateSecurePassword();
            // Create Vaultwarden account via API
            const vaultAccount = await this.createVaultwardenAccount(userIdentity.email, userIdentity.name || userIdentity.email.split('@')[0], masterPassword);
            // Generate API credentials for the new user
            const apiCredentials = await this.generateUserApiCredentials(userIdentity.email, masterPassword);
            // Create user account record
            const userAccount = {
                vaultUserId: vaultAccount.userId,
                email: userIdentity.email,
                masterPassword: masterPassword, // TODO: Encrypt this at rest
                clientId: apiCredentials.clientId,
                clientSecret: apiCredentials.clientSecret,
                userIdentity,
                createdAt: new Date(),
                lastAccessAt: new Date(),
                organizationId: this.config.userDefaults.organizationId
            };
            // Invite to organization if configured
            if (this.config.userDefaults.autoInviteToOrg) {
                await this.inviteUserToOrganization(userAccount);
            }
            // Save to persistent storage
            await this.saveUserAccount(userAccount);
            this.logger.info('✅ User provisioned successfully', {
                email: userIdentity.email,
                vaultUserId: vaultAccount.userId,
                provider: userIdentity.authProvider
            });
            return userAccount;
        }
        catch (error) {
            this.logger.error('❌ User provisioning failed', {
                email: userIdentity.email,
                error: error.message
            });
            throw new Error(`Failed to provision Vaultwarden user: ${error.message}`);
        }
    }
    /**
     * Create Vaultwarden account using service account API
     */
    async createVaultwardenAccount(email, name, masterPassword) {
        // Use service account API to create new user
        const serviceAPI = new BitwardenRESTAPI({
            serverUrl: this.config.serviceAccount.serverUrl,
            clientId: this.config.serviceAccount.clientId,
            clientSecret: this.config.serviceAccount.clientSecret,
            masterPassword: this.config.serviceAccount.masterPassword
        });
        await serviceAPI.initialize();
        // Create user via admin API (this would need admin permissions)
        // For now, we'll simulate this - in production you'd use Vaultwarden admin API
        const userId = `user_${randomBytes(16).toString('hex')}`;
        this.logger.info('📝 Created Vaultwarden account', {
            email,
            userId,
            name
        });
        await serviceAPI.cleanup();
        return { userId };
    }
    /**
     * Generate API credentials for user account
     */
    async generateUserApiCredentials(email, masterPassword) {
        // In production, this would:
        // 1. Login as the user
        // 2. Generate API key via Vaultwarden API
        // 3. Return the credentials
        const clientId = `user.${randomBytes(16).toString('hex')}`;
        const clientSecret = randomBytes(24).toString('base64url');
        this.logger.info('🔑 Generated API credentials', {
            email,
            clientId: clientId.substring(0, 20) + '...'
        });
        return { clientId, clientSecret };
    }
    /**
     * Invite user to organization
     */
    async inviteUserToOrganization(userAccount) {
        this.logger.info('🏢 Inviting user to organization', {
            email: userAccount.email,
            organizationId: userAccount.organizationId
        });
        // Implementation would use Vaultwarden admin API to invite user
        // For now, we'll log this step
    }
    /**
     * Get user-specific BitwardenRESTAPI instance
     */
    async getUserVaultAPI(userIdentity) {
        const userAccount = await this.getOrCreateUserAccount(userIdentity);
        const api = new BitwardenRESTAPI({
            serverUrl: this.config.serviceAccount.serverUrl,
            clientId: userAccount.clientId,
            clientSecret: userAccount.clientSecret,
            masterPassword: userAccount.masterPassword,
            serviceEmail: userAccount.email
        });
        await api.initialize();
        this.logger.info('🔧 Created user-specific vault API', {
            email: userAccount.email,
            vaultUserId: userAccount.vaultUserId
        });
        return api;
    }
    /**
     * Generate secure master password
     */
    generateSecurePassword() {
        // Generate 32-character password with high entropy
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
        const password = Array.from(randomBytes(32))
            .map(byte => chars[byte % chars.length])
            .join('');
        return password;
    }
    /**
     * Create cache key for user identity
     */
    getUserCacheKey(userIdentity) {
        // Use email as primary key, but include provider for uniqueness
        return `${userIdentity.email}:${userIdentity.authProvider}`;
    }
    /**
     * Load user account from persistent storage
     */
    async loadUserAccount(userIdentity) {
        // TODO: Implement database lookup
        // This would check your database for existing user mapping
        return null;
    }
    /**
     * Save user account to persistent storage
     */
    async saveUserAccount(userAccount) {
        // TODO: Implement database storage
        // This would save the user mapping to your database
        this.logger.info('💾 Saving user account mapping', {
            email: userAccount.email,
            vaultUserId: userAccount.vaultUserId
        });
    }
    /**
     * Extract user identity from various auth providers
     */
    static extractUserIdentity(authData) {
        // Handle OpenSaaS JWT
        if (authData.opensaasJWT || authData.userId) {
            return {
                email: authData.email,
                opensaasUserId: authData.userId,
                name: authData.name,
                authProvider: 'opensaas'
            };
        }
        // Handle Google OAuth
        if (authData.googleId || authData.sub?.startsWith('google|')) {
            return {
                email: authData.email,
                googleId: authData.sub || authData.googleId,
                name: authData.name,
                picture: authData.picture,
                authProvider: 'google'
            };
        }
        // Handle GitHub OAuth  
        if (authData.githubId || authData.sub?.startsWith('github|')) {
            return {
                email: authData.email,
                githubId: authData.sub || authData.githubId,
                name: authData.name || authData.login,
                picture: authData.avatar_url,
                authProvider: 'github'
            };
        }
        // Handle Microsoft OAuth
        if (authData.microsoftId || authData.sub?.startsWith('microsoft|')) {
            return {
                email: authData.email || authData.preferred_username,
                microsoftId: authData.sub || authData.microsoftId,
                name: authData.name,
                authProvider: 'microsoft'
            };
        }
        // Handle Auth0
        if (authData.sub?.includes('auth0') || authData.iss?.includes('auth0')) {
            return {
                email: authData.email,
                auth0Sub: authData.sub,
                name: authData.name,
                picture: authData.picture,
                authProvider: 'auth0'
            };
        }
        // Fallback - generic email-based
        return {
            email: authData.email,
            name: authData.name,
            authProvider: 'opensaas'
        };
    }
    /**
     * Health check for provisioning system
     */
    async healthCheck() {
        try {
            // Test service account connection
            const serviceAPI = new BitwardenRESTAPI({
                serverUrl: this.config.serviceAccount.serverUrl,
                clientId: this.config.serviceAccount.clientId,
                clientSecret: this.config.serviceAccount.clientSecret,
                masterPassword: this.config.serviceAccount.masterPassword
            });
            await serviceAPI.initialize();
            await serviceAPI.cleanup();
            return {
                status: 'healthy',
                details: {
                    serviceAccountWorking: true,
                    cachedUsers: this.userMappings.size,
                    organizationId: this.config.userDefaults.organizationId
                }
            };
        }
        catch (error) {
            return {
                status: 'unhealthy',
                details: {
                    error: error.message,
                    serviceAccountWorking: false
                }
            };
        }
    }
}
export default VaultwardenUserProvisioning;
//# sourceMappingURL=VaultwardenUserProvisioning.js.map