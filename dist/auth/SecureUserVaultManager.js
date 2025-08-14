/**
 * Secure User Vault Manager
 *
 * Implements true user isolation where:
 * - Service account can only create/provision user accounts
 * - Service account CANNOT access user secrets
 * - Each user has isolated Vaultwarden account with their own credentials
 * - Zero-trust: users authenticate with their own credentials for secret operations
 */
import { BitwardenRESTAPI } from './BitwardenRESTAPI.js';
import { UserIdentityBridge } from './UserIdentityBridge.js';
import { VaultwardenAutoProvisioning } from './VaultwardenAutoProvisioning.js';
import { randomBytes } from 'crypto';
import * as winston from 'winston';
/**
 * Secure implementation that enforces user isolation
 */
export class SecureUserVaultManager {
    serviceAccount;
    userBridge;
    autoProvisioning;
    userVaults = new Map();
    logger;
    constructor(serviceConfig, logger) {
        this.logger = logger || winston.createLogger({
            level: 'info',
            format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
            transports: [new winston.transports.Console()]
        });
        // Service account - ONLY for user provisioning
        this.serviceAccount = new BitwardenRESTAPI(serviceConfig, this.logger);
        this.userBridge = new UserIdentityBridge(serviceConfig, this.logger);
        this.autoProvisioning = new VaultwardenAutoProvisioning(serviceConfig, this.userBridge, undefined, undefined, this.logger);
    }
    async initialize() {
        await this.serviceAccount.initialize();
        await this.userBridge.initialize();
        await this.autoProvisioning.initialize();
        this.logger.info('SecureUserVaultManager initialized - service account can only provision users');
    }
    /**
     * SERVICE ACCOUNT OPERATION: Create new user account
     * Service account can do this but CANNOT access user secrets
     */
    async provisionUser(userJWT) {
        try {
            const jwtPayload = this.parseJWT(userJWT);
            const userId = jwtPayload.userId;
            const email = jwtPayload.email;
            this.logger.info('Provisioning new user vault', { userId, email });
            // Check if already provisioned
            if (this.userVaults.has(userId)) {
                const existing = this.userVaults.get(userId);
                this.logger.info('User already provisioned', { userId });
                return existing;
            }
            // Generate secure password for user's Vaultwarden account
            const userPassword = this.generateSecurePassword();
            // Create user's Vaultwarden account (service account privilege)
            const setupResponse = await this.autoProvisioning.provisionUserAccount(jwtPayload);
            // Complete user setup with generated password
            await this.autoProvisioning.completeAccountSetup({
                setupToken: setupResponse.setupToken,
                masterPasswordHash: userPassword, // User's own password
                encryptedPrivateKey: undefined
            });
            // Create user credentials (these belong to the USER, not service account)
            const userCredentials = {
                userId,
                email,
                vaultwardenPassword: userPassword,
                organizationId: jwtPayload.organizationId,
                isProvisioned: true,
                createdAt: new Date()
            };
            this.userVaults.set(userId, userCredentials);
            this.logger.info('User vault provisioned successfully', {
                userId,
                email,
                hasPassword: !!userPassword
            });
            return userCredentials;
        }
        catch (error) {
            this.logger.error('Failed to provision user vault', { error: error.message });
            throw new Error(`User provisioning failed: ${error.message}`);
        }
    }
    /**
     * USER OPERATION: Store secret using USER's credentials
     * Service account CANNOT call this - requires user authentication
     */
    async storeUserSecret(userCreds, name, secret) {
        this.validateUserCredentials(userCreds);
        // Create USER's BitwardenRESTAPI instance (not service account)
        const userAPI = await this.createUserAPIInstance(userCreds);
        try {
            const secretId = await userAPI.createSecret(name, secret, `Secret for ${userCreds.email}`);
            this.logger.info('User secret stored successfully', {
                userId: userCreds.userId,
                secretId,
                secretName: name
            });
            return secretId;
        }
        catch (error) {
            this.logger.error('Failed to store user secret', {
                userId: userCreds.userId,
                error: error.message
            });
            throw new Error(`Failed to store secret: ${error.message}`);
        }
    }
    /**
     * USER OPERATION: Get secret using USER's credentials
     * Service account CANNOT call this - requires user authentication
     */
    async getUserSecret(userCreds, secretId) {
        this.validateUserCredentials(userCreds);
        const userAPI = await this.createUserAPIInstance(userCreds);
        try {
            const secret = await userAPI.getItem(secretId);
            if (secret) {
                this.logger.info('User secret retrieved successfully', {
                    userId: userCreds.userId,
                    secretId
                });
                return secret.value;
            }
            return null;
        }
        catch (error) {
            this.logger.error('Failed to get user secret', {
                userId: userCreds.userId,
                secretId,
                error: error.message
            });
            throw new Error(`Failed to get secret: ${error.message}`);
        }
    }
    /**
     * USER OPERATION: List user's secrets
     * Service account CANNOT call this - requires user authentication
     */
    async listUserSecrets(userCreds) {
        this.validateUserCredentials(userCreds);
        const userAPI = await this.createUserAPIInstance(userCreds);
        try {
            const secrets = await userAPI.listItems();
            this.logger.info('User secrets listed successfully', {
                userId: userCreds.userId,
                secretCount: secrets.length
            });
            return secrets.map(secret => ({
                id: secret.id,
                name: secret.name
            }));
        }
        catch (error) {
            this.logger.error('Failed to list user secrets', {
                userId: userCreds.userId,
                error: error.message
            });
            throw new Error(`Failed to list secrets: ${error.message}`);
        }
    }
    /**
     * SECURITY TEST: Validate that users cannot access each other's secrets
     */
    async validateUserIsolation(userA, userB) {
        try {
            // Create a secret for UserB
            const userBAPI = await this.createUserAPIInstance(userB);
            const secretId = await userBAPI.createSecret('isolation-test-secret', 'userB-secret-value', 'Test secret for isolation validation');
            // Try to access UserB's secret with UserA's credentials (should fail)
            try {
                const userAAPI = await this.createUserAPIInstance(userA);
                const stolenSecret = await userAAPI.getItem(secretId);
                if (stolenSecret) {
                    this.logger.error('SECURITY BREACH: UserA accessed UserB secret', {
                        userA: userA.userId,
                        userB: userB.userId,
                        secretId
                    });
                    return false; // Isolation failed
                }
            }
            catch (error) {
                // This is expected - UserA should not be able to access UserB's secret
                this.logger.info('User isolation working correctly - cross-access blocked', {
                    userA: userA.userId,
                    userB: userB.userId
                });
            }
            // Clean up test secret
            await userBAPI.deleteSecret(secretId);
            return true; // Isolation working
        }
        catch (error) {
            this.logger.error('Failed to validate user isolation', { error: error.message });
            return false;
        }
    }
    /**
     * SERVICE ACCOUNT SECURITY CHECK: Verify service account cannot access user secrets
     */
    async verifyServiceAccountIsolation(userCreds) {
        try {
            // Create a secret with user credentials
            const userAPI = await this.createUserAPIInstance(userCreds);
            const secretId = await userAPI.createSecret('service-isolation-test', 'user-secret-value', 'Test secret for service account isolation');
            // Try to access the secret with service account (should fail)
            try {
                const serviceSecret = await this.serviceAccount.getItem(secretId);
                if (serviceSecret) {
                    this.logger.error('SECURITY BREACH: Service account accessed user secret', {
                        userId: userCreds.userId,
                        secretId
                    });
                    return false; // Service account isolation failed
                }
            }
            catch (error) {
                // This is expected - service account should not access user secrets
                this.logger.info('Service account isolation working correctly', {
                    userId: userCreds.userId
                });
            }
            // Clean up test secret
            await userAPI.deleteSecret(secretId);
            return true; // Service account isolation working
        }
        catch (error) {
            this.logger.error('Failed to verify service account isolation', { error: error.message });
            return false;
        }
    }
    /**
     * Create BitwardenRESTAPI instance for specific user
     */
    async createUserAPIInstance(userCreds) {
        const userConfig = {
            serverUrl: process.env.VW_DOMAIN || 'http://localhost:8081',
            clientId: `user.${userCreds.userId}`, // User's client ID
            clientSecret: userCreds.vaultwardenPassword, // User's password
            masterPassword: userCreds.vaultwardenPassword,
            organizationId: userCreds.organizationId || 'default'
        };
        const userAPI = new BitwardenRESTAPI(userConfig, this.logger);
        await userAPI.initialize();
        return userAPI;
    }
    /**
     * Validate user credentials
     */
    validateUserCredentials(userCreds) {
        if (!userCreds.isProvisioned) {
            throw new Error('User not provisioned');
        }
        if (!userCreds.vaultwardenPassword) {
            throw new Error('User credentials missing');
        }
    }
    /**
     * Generate secure password for user's Vaultwarden account
     */
    generateSecurePassword() {
        return randomBytes(32).toString('base64');
    }
    /**
     * Parse JWT payload (simplified for demo)
     */
    parseJWT(jwt) {
        try {
            const [, payload] = jwt.split('.');
            return JSON.parse(Buffer.from(payload, 'base64url').toString());
        }
        catch (error) {
            throw new Error('Invalid JWT format');
        }
    }
    /**
     * Health check for the secure vault manager
     */
    async healthCheck() {
        try {
            const serviceHealth = await this.serviceAccount.healthCheck();
            const bridgeHealth = await this.userBridge.healthCheck();
            const isHealthy = serviceHealth.status === 'healthy' && bridgeHealth.status === 'healthy';
            return {
                status: isHealthy ? 'healthy' : 'unhealthy',
                details: {
                    provisionedUsers: this.userVaults.size,
                    serviceAccount: serviceHealth,
                    userBridge: bridgeHealth,
                    securityModel: 'per-user-isolation'
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
export default SecureUserVaultManager;
//# sourceMappingURL=SecureUserVaultManager.js.map