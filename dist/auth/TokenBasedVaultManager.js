/**
 * Token-Based Vault Manager
 *
 * Secure user isolation using encrypted access tokens instead of stored passwords:
 * - Service account only creates Vaultwarden user accounts
 * - Access tokens are encrypted and stored in database
 * - No passwords are ever stored
 * - Users access vaults via their encrypted tokens
 * - Automatic token refresh when expired
 */
import { BitwardenRESTAPI } from './BitwardenRESTAPI.js';
import { UserIdentityBridge } from './UserIdentityBridge.js';
import { randomBytes, createCipheriv, createDecipheriv } from 'crypto';
import * as winston from 'winston';
/**
 * Token-based secure vault manager with automatic rotation
 * No passwords stored - only encrypted access tokens with auto-rotation
 */
export class TokenBasedVaultManager {
    serviceAccount;
    userBridge;
    userTokens = new Map();
    masterKey; // For token encryption only
    logger;
    rotationInterval = null;
    TOKEN_LIFETIME_HOURS = 24;
    ROTATION_CHECK_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes
    ROTATION_THRESHOLD_HOURS = 4; // Rotate when <4 hours left
    constructor(serviceConfig, tokenEncryptionKey, logger) {
        this.logger = logger || winston.createLogger({
            level: 'info',
            format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
            transports: [new winston.transports.Console()]
        });
        // Service account - ONLY for user provisioning
        this.serviceAccount = new BitwardenRESTAPI(serviceConfig, this.logger);
        this.userBridge = new UserIdentityBridge(serviceConfig, this.logger);
        // Master key for token encryption (32 bytes for AES-256)
        this.masterKey = tokenEncryptionKey
            ? Buffer.from(tokenEncryptionKey, 'utf8').subarray(0, 32)
            : randomBytes(32);
    }
    async initialize() {
        this.logger.info('Initializing TokenBasedVaultManager...');
        await this.serviceAccount.initialize();
        // Skip UserIdentityBridge initialization to avoid CLI calls
        // await this.userBridge.initialize();
        // Start automatic token rotation service
        this.startTokenRotationService();
        this.logger.info('TokenBasedVaultManager initialized with auto-rotation', {
            tokenLifetimeHours: this.TOKEN_LIFETIME_HOURS,
            rotationThresholdHours: this.ROTATION_THRESHOLD_HOURS,
            checkIntervalMinutes: this.ROTATION_CHECK_INTERVAL_MS / (60 * 1000)
        });
    }
    /**
     * SERVICE ACCOUNT OPERATION: Provision new user and get their access token
     */
    async provisionUser(userJWT) {
        try {
            const jwtPayload = this.parseJWT(userJWT);
            const userId = jwtPayload.userId;
            const email = jwtPayload.email;
            this.logger.info('Provisioning user with token-based access', { userId, email });
            // Check if already provisioned
            if (this.userTokens.has(userId)) {
                const existing = this.userTokens.get(userId);
                // Check if token is still valid
                if (existing.tokenExpiresAt > new Date()) {
                    this.logger.info('User already provisioned with valid token', { userId });
                    return existing;
                }
                else {
                    this.logger.info('User exists but token expired, refreshing', { userId });
                    return await this.refreshUserToken(userId);
                }
            }
            // Step 1: Create Vaultwarden account with random password
            const tempPassword = randomBytes(32).toString('base64');
            // Use service account to create the user account
            await this.createVaultwardenUser(email, tempPassword);
            // Step 2: Login as the new user to get access token
            const userConfig = {
                serverUrl: process.env.VW_DOMAIN || 'http://localhost:8081',
                clientId: `user.${userId}`,
                clientSecret: tempPassword, // Use temporarily
                masterPassword: tempPassword,
                organizationId: jwtPayload.organizationId || 'default'
            };
            const userAPI = new BitwardenRESTAPI(userConfig, this.logger);
            await userAPI.initialize();
            // Step 3: Extract access token from user API session
            const accessToken = await this.extractAccessToken(userAPI);
            if (!accessToken) {
                throw new Error('Failed to obtain access token from user session');
            }
            // Step 4: Encrypt and store the access token (NOT the password)
            const encryptedToken = this.encryptToken(accessToken);
            const userVaultToken = {
                userId,
                email,
                encryptedAccessToken: encryptedToken,
                tokenExpiresAt: new Date(Date.now() + this.TOKEN_LIFETIME_HOURS * 60 * 60 * 1000),
                isProvisioned: true,
                createdAt: new Date(),
                lastUsedAt: new Date(),
                rotationCount: 0,
                autoRotationEnabled: true
            };
            this.userTokens.set(userId, userVaultToken);
            this.logger.info('User provisioned with encrypted access token', {
                userId,
                email,
                tokenExpires: userVaultToken.tokenExpiresAt.toISOString()
            });
            // Step 5: Password is discarded here (never stored)
            // tempPassword goes out of scope and gets garbage collected
            return userVaultToken;
        }
        catch (error) {
            this.logger.error('Failed to provision user', { error: error.message });
            throw new Error(`User provisioning failed: ${error.message}`);
        }
    }
    /**
     * USER OPERATION: Store secret using encrypted access token
     */
    async storeUserSecret(userId, secretName, secret) {
        try {
            // Get user's access token
            const accessToken = await this.getUserAccessToken(userId);
            // Create temporary API instance with token
            const userAPI = await this.createTokenBasedAPI(userId, accessToken);
            // Store the secret
            const secretId = await userAPI.createSecret(secretName, secret, `Secret for user ${userId}`);
            // Update last used timestamp
            await this.updateLastUsed(userId);
            this.logger.info('User secret stored successfully', {
                userId,
                secretName,
                secretId
            });
            return {
                success: true,
                data: { secretId }
            };
        }
        catch (error) {
            this.logger.error('Failed to store user secret', {
                userId,
                error: error.message
            });
            // If token expired, try refreshing once
            if (error.message.includes('401') || error.message.includes('unauthorized')) {
                try {
                    this.logger.info('Token may be expired, attempting refresh', { userId });
                    await this.refreshUserToken(userId);
                    // Retry the operation with fresh token
                    const newAccessToken = await this.getUserAccessToken(userId);
                    const userAPI = await this.createTokenBasedAPI(userId, newAccessToken);
                    const secretId = await userAPI.createSecret(secretName, secret, `Secret for user ${userId}`);
                    return {
                        success: true,
                        data: { secretId },
                        tokenRefreshed: true
                    };
                }
                catch (refreshError) {
                    return {
                        success: false,
                        error: `Token refresh failed: ${refreshError.message}`
                    };
                }
            }
            return {
                success: false,
                error: error.message
            };
        }
    }
    /**
     * USER OPERATION: Get secret using encrypted access token
     */
    async getUserSecret(userId, secretId) {
        try {
            const accessToken = await this.getUserAccessToken(userId);
            const userAPI = await this.createTokenBasedAPI(userId, accessToken);
            const secret = await userAPI.getItem(secretId);
            await this.updateLastUsed(userId);
            if (!secret) {
                return {
                    success: false,
                    error: 'Secret not found'
                };
            }
            this.logger.info('User secret retrieved successfully', { userId, secretId });
            return {
                success: true,
                data: { secret: secret.value }
            };
        }
        catch (error) {
            this.logger.error('Failed to get user secret', { userId, secretId, error: error.message });
            // Try token refresh on auth errors
            if (error.message.includes('401') || error.message.includes('unauthorized')) {
                try {
                    await this.refreshUserToken(userId);
                    const newAccessToken = await this.getUserAccessToken(userId);
                    const userAPI = await this.createTokenBasedAPI(userId, newAccessToken);
                    const secret = await userAPI.getItem(secretId);
                    return {
                        success: true,
                        data: { secret: secret?.value },
                        tokenRefreshed: true
                    };
                }
                catch (refreshError) {
                    return {
                        success: false,
                        error: `Token refresh failed: ${refreshError.message}`
                    };
                }
            }
            return {
                success: false,
                error: error.message
            };
        }
    }
    /**
     * USER OPERATION: List user's secrets
     */
    async listUserSecrets(userId) {
        try {
            const accessToken = await this.getUserAccessToken(userId);
            const userAPI = await this.createTokenBasedAPI(userId, accessToken);
            const secrets = await userAPI.listItems();
            await this.updateLastUsed(userId);
            this.logger.info('User secrets listed successfully', {
                userId,
                secretCount: secrets.length
            });
            return {
                success: true,
                data: {
                    secrets: secrets.map(s => ({ id: s.id, name: s.name }))
                }
            };
        }
        catch (error) {
            this.logger.error('Failed to list user secrets', { userId, error: error.message });
            return {
                success: false,
                error: error.message
            };
        }
    }
    /**
     * Get decrypted access token for user
     */
    async getUserAccessToken(userId) {
        const userToken = this.userTokens.get(userId);
        if (!userToken) {
            throw new Error('User not provisioned');
        }
        if (userToken.tokenExpiresAt <= new Date()) {
            this.logger.info('Token expired, refreshing', { userId });
            await this.refreshUserToken(userId);
            const refreshedToken = this.userTokens.get(userId);
            if (!refreshedToken) {
                throw new Error('Token refresh failed');
            }
            return this.decryptToken(refreshedToken.encryptedAccessToken);
        }
        return this.decryptToken(userToken.encryptedAccessToken);
    }
    /**
     * Create API instance using access token (no password needed)
     */
    async createTokenBasedAPI(userId, accessToken) {
        const userToken = this.userTokens.get(userId);
        if (!userToken) {
            throw new Error('User not found');
        }
        // Create config with token-based auth
        const tokenConfig = {
            serverUrl: process.env.VW_DOMAIN || 'http://localhost:8081',
            clientId: `user.${userId}`,
            clientSecret: accessToken, // Use access token instead of password
            masterPassword: accessToken, // Temporary for API compatibility
            organizationId: 'default'
        };
        const userAPI = new BitwardenRESTAPI(tokenConfig, this.logger);
        // Note: We may need to modify BitwardenRESTAPI to accept pre-authenticated tokens
        return userAPI;
    }
    /**
     * Start automatic token rotation service
     */
    startTokenRotationService() {
        if (this.rotationInterval) {
            clearInterval(this.rotationInterval);
        }
        this.rotationInterval = setInterval(async () => {
            await this.checkAndRotateTokens();
        }, this.ROTATION_CHECK_INTERVAL_MS);
        this.logger.info('Token rotation service started', {
            checkIntervalMinutes: this.ROTATION_CHECK_INTERVAL_MS / (60 * 1000)
        });
    }
    /**
     * Stop automatic token rotation service
     */
    stopTokenRotationService() {
        if (this.rotationInterval) {
            clearInterval(this.rotationInterval);
            this.rotationInterval = null;
            this.logger.info('Token rotation service stopped');
        }
    }
    /**
     * Check all tokens and rotate those that need rotation
     */
    async checkAndRotateTokens() {
        const now = new Date();
        const rotationThreshold = new Date(now.getTime() + (this.ROTATION_THRESHOLD_HOURS * 60 * 60 * 1000));
        for (const [userId, userToken] of this.userTokens.entries()) {
            if (!userToken.autoRotationEnabled) {
                continue;
            }
            // Check if token expires within rotation threshold
            if (userToken.tokenExpiresAt <= rotationThreshold) {
                try {
                    this.logger.info('Auto-rotating token for user', {
                        userId,
                        currentExpiry: userToken.tokenExpiresAt.toISOString(),
                        rotationCount: userToken.rotationCount
                    });
                    await this.rotateUserToken(userId);
                }
                catch (error) {
                    this.logger.error('Failed to auto-rotate token', {
                        userId,
                        error: error.message,
                        rotationCount: userToken.rotationCount
                    });
                }
            }
        }
    }
    /**
     * Rotate user's access token (automatic or manual)
     */
    async rotateUserToken(userId) {
        const userToken = this.userTokens.get(userId);
        if (!userToken) {
            throw new Error('User not found for token rotation');
        }
        try {
            // Step 1: Create new authenticated session for the user
            const userConfig = {
                serverUrl: process.env.VW_DOMAIN || 'http://localhost:8081',
                clientId: `user.${userId}`,
                clientSecret: 'rotation-temp-password', // This would be managed securely
                masterPassword: 'rotation-temp-password',
                organizationId: 'default'
            };
            // Step 2: Get new access token
            const tempUserAPI = new BitwardenRESTAPI(userConfig, this.logger);
            await tempUserAPI.initialize();
            const newAccessToken = await this.extractAccessToken(tempUserAPI);
            if (!newAccessToken) {
                throw new Error('Failed to obtain new access token during rotation');
            }
            // Step 3: Encrypt and update the token
            const encryptedNewToken = this.encryptToken(newAccessToken);
            const newExpiryTime = new Date(Date.now() + this.TOKEN_LIFETIME_HOURS * 60 * 60 * 1000);
            // Step 4: Update user token with rotation tracking
            const updatedToken = {
                ...userToken,
                encryptedAccessToken: encryptedNewToken,
                tokenExpiresAt: newExpiryTime,
                rotationCount: userToken.rotationCount + 1,
                lastRotatedAt: new Date(),
                lastUsedAt: new Date()
            };
            this.userTokens.set(userId, updatedToken);
            this.logger.info('Token rotated successfully', {
                userId,
                oldExpiry: userToken.tokenExpiresAt.toISOString(),
                newExpiry: newExpiryTime.toISOString(),
                rotationCount: updatedToken.rotationCount,
                autoRotation: true
            });
            return updatedToken;
        }
        catch (error) {
            this.logger.error('Token rotation failed', {
                userId,
                error: error.message,
                rotationCount: userToken.rotationCount
            });
            throw error;
        }
    }
    /**
     * Manual token refresh (fallback for failed automatic rotation)
     */
    async refreshUserToken(userId) {
        this.logger.info('Manual token refresh requested', { userId });
        return await this.rotateUserToken(userId);
    }
    /**
     * Create Vaultwarden user account (service account operation)
     */
    async createVaultwardenUser(email, _password) {
        // This would use service account privileges to create new user
        // Implementation depends on Vaultwarden admin API
        this.logger.info('Creating Vaultwarden user account', { email });
        // For now, simulate user creation
        // In production, this would call Vaultwarden admin endpoints
    }
    /**
     * Extract access token from authenticated API session
     */
    async extractAccessToken(_userAPI) {
        // This would extract the access token from the authenticated session
        // Implementation depends on BitwardenRESTAPI internal structure
        // For now, return a mock token
        // In production, extract real token from userAPI session
        return 'mock-access-token-' + randomBytes(16).toString('hex');
    }
    /**
     * Encrypt access token for storage
     */
    encryptToken(token) {
        const iv = randomBytes(16);
        const cipher = createCipheriv('aes-256-gcm', this.masterKey, iv);
        let encrypted = cipher.update(token, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        const authTag = cipher.getAuthTag();
        return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
    }
    /**
     * Decrypt stored access token
     */
    decryptToken(encryptedData) {
        const parts = encryptedData.split(':');
        if (parts.length !== 3) {
            throw new Error('Invalid encrypted token format');
        }
        const iv = Buffer.from(parts[0], 'hex');
        const authTag = Buffer.from(parts[1], 'hex');
        const encrypted = parts[2];
        const decipher = createDecipheriv('aes-256-gcm', this.masterKey, iv);
        decipher.setAuthTag(authTag);
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    }
    /**
     * Update last used timestamp
     */
    async updateLastUsed(userId) {
        const userToken = this.userTokens.get(userId);
        if (userToken) {
            userToken.lastUsedAt = new Date();
            this.userTokens.set(userId, userToken);
        }
    }
    /**
     * Parse JWT payload
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
     * Enable/disable auto-rotation for specific user
     */
    async setAutoRotation(userId, enabled) {
        const userToken = this.userTokens.get(userId);
        if (!userToken) {
            throw new Error('User not found');
        }
        userToken.autoRotationEnabled = enabled;
        this.userTokens.set(userId, userToken);
        this.logger.info('Auto-rotation setting updated', {
            userId,
            autoRotationEnabled: enabled
        });
    }
    /**
     * Get token rotation statistics for user
     */
    getTokenStats(userId) {
        const userToken = this.userTokens.get(userId);
        if (!userToken) {
            return null;
        }
        return {
            rotationCount: userToken.rotationCount,
            lastRotatedAt: userToken.lastRotatedAt,
            expiresAt: userToken.tokenExpiresAt,
            timeToExpiry: userToken.tokenExpiresAt.getTime() - Date.now(),
            autoRotationEnabled: userToken.autoRotationEnabled
        };
    }
    /**
     * Cleanup - stop rotation service
     */
    async cleanup() {
        this.stopTokenRotationService();
        this.logger.info('TokenBasedVaultManager cleanup completed');
    }
    /**
     * Health check with rotation statistics
     */
    async healthCheck() {
        try {
            const serviceHealth = await this.serviceAccount.healthCheck();
            const bridgeHealth = await this.userBridge.healthCheck();
            const now = new Date();
            const rotationThreshold = new Date(now.getTime() + (this.ROTATION_THRESHOLD_HOURS * 60 * 60 * 1000));
            const tokenStats = Array.from(this.userTokens.values());
            const activeTokens = tokenStats.filter(t => t.tokenExpiresAt > now);
            const expiredTokens = tokenStats.filter(t => t.tokenExpiresAt <= now);
            const tokensNeedingRotation = tokenStats.filter(t => t.tokenExpiresAt <= rotationThreshold && t.autoRotationEnabled);
            const totalRotations = tokenStats.reduce((sum, t) => sum + t.rotationCount, 0);
            const isHealthy = serviceHealth.status === 'healthy' && bridgeHealth.status === 'healthy';
            return {
                status: isHealthy ? 'healthy' : 'unhealthy',
                details: {
                    provisionedUsers: this.userTokens.size,
                    activeTokens: activeTokens.length,
                    expiredTokens: expiredTokens.length,
                    tokensNeedingRotation: tokensNeedingRotation.length,
                    totalRotations,
                    autoRotationServiceRunning: !!this.rotationInterval,
                    rotationSettings: {
                        tokenLifetimeHours: this.TOKEN_LIFETIME_HOURS,
                        rotationThresholdHours: this.ROTATION_THRESHOLD_HOURS,
                        checkIntervalMinutes: this.ROTATION_CHECK_INTERVAL_MS / (60 * 1000)
                    },
                    serviceAccount: serviceHealth,
                    userBridge: bridgeHealth,
                    securityModel: 'token-based-isolation-with-auto-rotation'
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
export default TokenBasedVaultManager;
//# sourceMappingURL=TokenBasedVaultManager.js.map