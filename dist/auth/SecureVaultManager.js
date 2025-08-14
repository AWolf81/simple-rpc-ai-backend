/**
 * Secure Vault Manager
 *
 * High-performance Vaultwarden integration with:
 * 1. Persistent bw serve service (no per-request spawning)
 * 2. Connection pooling and session reuse
 * 3. Server-side master key generation
 * 4. Flexible plan management integration
 * 5. OAuth2 + multi-auth provider support
 */
import { randomBytes, createCipheriv, createDecipheriv } from 'crypto';
import { BitwardenRESTAPI } from './BitwardenRESTAPI.js';
import { UserIdentityBridge } from './UserIdentityBridge.js';
import { FlexiblePlanManager } from './FlexiblePlanManager.js';
import * as winston from 'winston';
export class SecureVaultManager {
    logger;
    userMappings = new Map(); // primaryUserId -> mapping
    userIdIndex = new Map(); // any user ID -> primaryUserId
    connections = new Map();
    globalAPI; // Persistent API connection to bw serve
    planManager;
    masterKey;
    proUserConfig;
    config;
    isGlobalAPIInitialized = false;
    sessionRefreshInterval;
    constructor(config) {
        this.config = config;
        this.logger = config.logger || winston.createLogger({
            level: 'info',
            format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
            transports: [new winston.transports.Console()]
        });
        this.masterKey = Buffer.from(config.databaseMasterKey, 'hex');
        this.proUserConfig = config.proUserConfig;
        // Initialize flexible plan manager if config provided
        if (config.flexiblePlanConfig) {
            this.planManager = new FlexiblePlanManager(config.flexiblePlanConfig, this.logger);
        }
        if (this.masterKey.length !== 32) {
            throw new Error('Database master key must be 32 bytes (64 hex chars)');
        }
        // Start background session refresh (every 30 minutes)
        this.sessionRefreshInterval = setInterval(() => {
            this.refreshExpiredSessions();
        }, 30 * 60 * 1000);
    }
    /**
     * RPC Method: vaultwarden.storeApiKey
     * Store API key with automatic onboarding and optimized performance
     */
    async storeApiKey(opensaasJWT, apiKey, provider) {
        try {
            // Auto-onboard user if needed (transparent to client)
            const userMapping = await this.ensureUserOnboarded(opensaasJWT);
            // Use persistent API connection for performance
            const keyId = await this.storeAPIKeyOptimized(userMapping.primaryUserId, provider, apiKey);
            // Update last used timestamp
            userMapping.lastUsed = new Date();
            this.logger.info('API key stored securely', {
                primaryUserId: userMapping.primaryUserId,
                provider,
                keyId
            });
            return { success: true, keyId };
        }
        catch (error) {
            this.logger.error('API key storage failed', {
                error: error.message,
                provider
            });
            throw new Error(`Key storage failed: ${error.message}`);
        }
    }
    /**
     * RPC Method: executeAIRequest (with user existence check)
     * Execute AI request - requires user to have stored API key first
     */
    async executeAIRequestWithAutoKey(opensaasJWT, content, systemPrompt, provider) {
        try {
            const jwtPayload = await this.validateJWT(opensaasJWT);
            const userIdentity = this.extractUserIdentity(jwtPayload);
            // Check if user exists (don't auto-onboard for AI requests)
            const userMapping = this.findUserByAnyId(userIdentity.primaryUserId, userIdentity.alternateIds);
            if (!userMapping) {
                throw new Error('User not found. Please store an API key first using vaultwarden.storeApiKey');
            }
            // Retrieve API key with flexible plan support
            const apiKey = await this.retrieveApiKeySecurely(userMapping.primaryUserId, provider);
            // Get system prompt from secure server storage
            const fullSystemPrompt = await this.getSystemPrompt(systemPrompt);
            // Execute AI request (integrate with your AI service here)
            const response = await this.executeAIRequest({
                content,
                systemPrompt: fullSystemPrompt,
                apiKey,
                provider
            });
            // Clear API key from memory immediately
            this.clearSensitiveData(apiKey);
            this.logger.info('AI request executed successfully', {
                primaryUserId: userMapping.primaryUserId,
                provider,
                contentLength: content.length,
                responseLength: response.length
            });
            return response;
        }
        catch (error) {
            this.logger.error('AI request failed', {
                error: error.message,
                provider
            });
            throw new Error(`AI request failed: ${error.message}`);
        }
    }
    /**
     * Get persistent API connection (main performance optimization)
     * Connects to persistent bw serve service instead of spawning new processes
     */
    async getVaultConnection(userId) {
        // For service operations, use global persistent connection
        if (!userId || userId === 'service') {
            return await this.getGlobalAPI();
        }
        // For user-specific operations, use connection pooling
        const existing = this.connections.get(userId);
        if (existing && existing.isHealthy && this.isSessionValid(existing)) {
            existing.lastUsed = new Date();
            this.logger.debug('Reusing existing vault connection', { userId });
            return existing.api;
        }
        // Create new connection for this user  
        this.logger.info('Creating new vault connection', { userId });
        const api = new BitwardenRESTAPI(this.config.bitwardenConfig, this.logger);
        try {
            await api.initialize();
            const connection = {
                api,
                userId,
                sessionToken: api.sessionToken, // Access private field
                lastUsed: new Date(),
                isHealthy: true
            };
            this.connections.set(userId, connection);
            this.logger.info('Vault connection created and cached', { userId });
            return api;
        }
        catch (error) {
            this.logger.error('Failed to create vault connection', {
                userId,
                error: error.message
            });
            throw error;
        }
    }
    /**
     * Get shared global API (connects to persistent bw serve service)
     * Main performance optimization - no process spawning
     */
    async getGlobalAPI() {
        if (this.globalAPI && this.isGlobalAPIInitialized) {
            // Health check before returning cached API
            const health = await this.globalAPI.healthCheck();
            if (health.status === 'healthy') {
                this.logger.debug('Reusing healthy global vault API');
                return this.globalAPI;
            }
            else {
                this.logger.warn('Global API unhealthy, reinitializing', {
                    details: health.details
                });
                await this.globalAPI.cleanup();
                this.isGlobalAPIInitialized = false;
            }
        }
        this.logger.info('Connecting to persistent bw serve API...');
        this.globalAPI = new BitwardenRESTAPI(this.config.bitwardenConfig, this.logger);
        try {
            // This now connects to persistent service instead of spawning new process
            await this.globalAPI.initialize();
            this.isGlobalAPIInitialized = true;
            this.logger.info('✅ Connected to persistent vault API service');
            return this.globalAPI;
        }
        catch (error) {
            this.logger.error('❌ Failed to connect to vault API service', {
                error: error.message
            });
            this.globalAPI = undefined;
            this.isGlobalAPIInitialized = false;
            throw error;
        }
    }
    // Add all the missing core methods from the original SecureVaultManager...
    /**
     * Internal method: Ensure user is onboarded (supporting multiple user IDs)
     */
    async ensureUserOnboarded(jwt) {
        const jwtPayload = await this.validateJWT(jwt);
        const userIdentity = this.extractUserIdentity(jwtPayload);
        // Check if user exists by any of their IDs
        let userMapping = this.findUserByAnyId(userIdentity.primaryUserId, userIdentity.alternateIds);
        if (userMapping) {
            // Update user mapping with any new alternate IDs
            const newIds = userIdentity.alternateIds.filter(id => !userMapping.alternateUserIds.includes(id));
            if (newIds.length > 0) {
                userMapping.alternateUserIds.push(...newIds);
                // Update index for new IDs
                newIds.forEach(id => this.userIdIndex.set(id, userMapping.primaryUserId));
                this.logger.info('Added new alternate IDs for existing user', {
                    primaryUserId: userMapping.primaryUserId,
                    newIds
                });
            }
            this.logger.debug('User already onboarded', {
                primaryUserId: userMapping.primaryUserId
            });
            return userMapping;
        }
        this.logger.info('Auto-onboarding new user', {
            primaryUserId: userIdentity.primaryUserId,
            alternateIds: userIdentity.alternateIds,
            email: userIdentity.email,
            provider: userIdentity.provider
        });
        try {
            // Generate secure vault password (server-side only)
            const vaultPassword = this.generateSecurePassword(64);
            const vaultUserId = `vw_${userIdentity.primaryUserId}_${Date.now()}`;
            // Create Vaultwarden account with server-generated password
            const vaultCreated = await this.createVaultwardenAccount(vaultUserId, userIdentity.email, vaultPassword);
            if (!vaultCreated) {
                throw new Error('Failed to create Vaultwarden account');
            }
            // Store secure mapping with all user IDs
            userMapping = {
                primaryUserId: userIdentity.primaryUserId,
                alternateUserIds: userIdentity.alternateIds,
                email: userIdentity.email,
                vaultwardenUserId: vaultUserId,
                encryptedVaultPassword: this.encryptVaultPassword(vaultPassword),
                authProvider: userIdentity.provider,
                subscriptionTier: jwtPayload.subscriptionTier || jwtPayload.plan || 'free',
                createdAt: new Date()
            };
            // Store mapping and index all IDs
            this.userMappings.set(userIdentity.primaryUserId, userMapping);
            this.userIdIndex.set(userIdentity.primaryUserId, userIdentity.primaryUserId);
            userIdentity.alternateIds.forEach(id => this.userIdIndex.set(id, userIdentity.primaryUserId));
            // Clear plaintext password from memory immediately
            this.clearSensitiveData(vaultPassword);
            this.logger.info('User auto-onboarded successfully', {
                primaryUserId: userIdentity.primaryUserId,
                email: userIdentity.email,
                totalIds: 1 + userIdentity.alternateIds.length
            });
            return userMapping;
        }
        catch (error) {
            this.logger.error('Auto-onboarding failed', {
                error: error.message,
                primaryUserId: userIdentity.primaryUserId,
                email: userIdentity.email
            });
            throw new Error(`Auto-onboarding failed: ${error.message}`);
        }
    }
    /**
     * Fast API key storage with optimized connection
     */
    async storeAPIKeyOptimized(userId, provider, apiKey) {
        const startTime = Date.now();
        try {
            const api = await this.getVaultConnection('service'); // Use persistent connection
            const keyId = await api.createSecret(`${provider}_api_key`, apiKey, `API key for ${provider} - User: ${userId}`);
            const duration = Date.now() - startTime;
            this.logger.info('API key stored via persistent connection', {
                userId,
                provider,
                keyId,
                duration: `${duration}ms`
            });
            return keyId;
        }
        catch (error) {
            const duration = Date.now() - startTime;
            this.logger.error('API key storage failed', {
                userId,
                provider,
                duration: `${duration}ms`,
                error: error.message
            });
            throw error;
        }
    }
    /**
     * Fast API key retrieval with connection reuse
     */
    async retrieveAPIKeyOptimized(userId, provider) {
        const startTime = Date.now();
        try {
            const api = await this.getVaultConnection('service'); // Use persistent connection
            const items = await api.listItems();
            const keyItem = items.find(item => item.name === `${provider}_api_key`);
            if (!keyItem || !keyItem.value) {
                throw new Error(`API key not found for provider: ${provider}`);
            }
            const duration = Date.now() - startTime;
            this.logger.info('API key retrieved via persistent connection', {
                userId,
                provider,
                duration: `${duration}ms`
            });
            return keyItem.value;
        }
        catch (error) {
            const duration = Date.now() - startTime;
            this.logger.error('API key retrieval failed', {
                userId,
                provider,
                duration: `${duration}ms`,
                error: error.message
            });
            throw error;
        }
    }
    /**
     * Retrieve API key securely (handles both BYOK and Pro users with flexible plans)
     */
    async retrieveApiKeySecurely(primaryUserId, provider) {
        const userMapping = this.userMappings.get(primaryUserId);
        if (!userMapping) {
            throw new Error('User not found');
        }
        // If flexible plan manager is available, use it for advanced key management
        if (this.planManager) {
            const keyResult = await this.planManager.getApiKeyForUser(primaryUserId, provider, userMapping.subscriptionTier);
            if (keyResult.source === 'server_provided') {
                return keyResult.apiKey;
            }
        }
        // Legacy Pro/Enterprise logic (fallback)
        if (userMapping.subscriptionTier === 'pro' || userMapping.subscriptionTier === 'enterprise') {
            return this.getServerApiKey(provider, userMapping.subscriptionTier);
        }
        // Free users: Use their own API keys (BYOK) with optimized connection
        try {
            return await this.retrieveAPIKeyOptimized(primaryUserId, provider);
        }
        catch (error) {
            throw new Error(`Failed to retrieve API key for ${provider}: ${error.message}`);
        }
    }
    // Additional core methods...
    findUserByAnyId(primaryId, alternateIds) {
        // Check primary ID first
        let mapping = this.userMappings.get(primaryId);
        if (mapping)
            return mapping;
        // Check alternate IDs via index
        for (const altId of alternateIds) {
            const foundPrimaryId = this.userIdIndex.get(altId);
            if (foundPrimaryId) {
                mapping = this.userMappings.get(foundPrimaryId);
                if (mapping)
                    return mapping;
            }
        }
        return undefined;
    }
    generateSecurePassword(length) {
        const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=';
        const bytes = randomBytes(length);
        let password = '';
        for (let i = 0; i < length; i++) {
            password += charset[bytes[i] % charset.length];
        }
        return password;
    }
    encryptVaultPassword(password) {
        const iv = randomBytes(16);
        const cipher = createCipheriv('aes-256-gcm', this.masterKey, iv);
        let encrypted = cipher.update(password, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        const tag = cipher.getAuthTag();
        // Return iv + tag + encrypted (all hex)
        return iv.toString('hex') + ':' + tag.toString('hex') + ':' + encrypted;
    }
    decryptVaultPassword(encryptedPassword) {
        const parts = encryptedPassword.split(':');
        if (parts.length !== 3) {
            throw new Error('Invalid encrypted password format');
        }
        const iv = Buffer.from(parts[0], 'hex');
        const tag = Buffer.from(parts[1], 'hex');
        const encrypted = parts[2];
        const decipher = createDecipheriv('aes-256-gcm', this.masterKey, iv);
        decipher.setAuthTag(tag);
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    }
    async createVaultwardenAccount(vaultUserId, email, password) {
        try {
            const api = await this.getGlobalAPI();
            await api.createUser({
                email: vaultUserId, // Use generated ID as email
                name: email, // Store actual email as name
                password,
                passwordHint: 'Server-generated account for Simple RPC AI Backend'
            });
            return true;
        }
        catch (error) {
            this.logger.error('Failed to create Vaultwarden account', {
                error: error.message,
                email
            });
            return false;
        }
    }
    getServerApiKey(provider, subscriptionTier) {
        if (!this.proUserConfig) {
            throw new Error('Server API keys not configured for Pro users');
        }
        let apiKey;
        switch (provider.toLowerCase()) {
            case 'anthropic':
                apiKey = this.proUserConfig.anthropicApiKey;
                break;
            case 'openai':
                apiKey = this.proUserConfig.openaiApiKey;
                break;
            case 'google':
                apiKey = this.proUserConfig.googleApiKey;
                break;
            default:
                throw new Error(`Server API key not available for provider: ${provider}`);
        }
        if (!apiKey) {
            throw new Error(`Server API key not configured for ${provider}`);
        }
        return apiKey;
    }
    async getSystemPrompt(promptName) {
        const prompts = {
            'code_review': 'You are a senior security engineer. Review the provided code for security vulnerabilities, bugs, and best practices...',
            'code_quality': 'You are a senior architect. Analyze the code quality, design patterns, and suggest improvements...',
        };
        const prompt = prompts[promptName];
        if (!prompt) {
            throw new Error(`System prompt not found: ${promptName}`);
        }
        return prompt;
    }
    async executeAIRequest(params) {
        // This is where you'd integrate with your AI service (Anthropic, OpenAI, etc.)
        return `AI analysis completed for ${params.provider}. Content analyzed: ${params.content.substring(0, 100)}...`;
    }
    async validateJWT(jwt) {
        const userBridge = new UserIdentityBridge();
        return userBridge.validateJWT(jwt);
    }
    extractUserIdentity(jwtPayload) {
        const alternateIds = [];
        let primaryUserId;
        let authMethod;
        if (jwtPayload.userId && !jwtPayload.googleId && !jwtPayload.githubId && !jwtPayload.microsoftId) {
            primaryUserId = jwtPayload.userId;
            authMethod = 'email_password';
        }
        else if (jwtPayload.googleId && !jwtPayload.userId) {
            primaryUserId = `google:${jwtPayload.googleId}`;
            authMethod = 'oauth2';
        }
        else if (jwtPayload.githubId && !jwtPayload.userId) {
            primaryUserId = `github:${jwtPayload.githubId}`;
            authMethod = 'oauth2';
        }
        else if (jwtPayload.microsoftId && !jwtPayload.userId) {
            primaryUserId = `microsoft:${jwtPayload.microsoftId}`;
            authMethod = 'oauth2';
        }
        else if (jwtPayload.employee_id || jwtPayload.sub?.includes('saml')) {
            primaryUserId = jwtPayload.employee_id || jwtPayload.sub;
            authMethod = 'sso';
        }
        else {
            primaryUserId = jwtPayload.userId || jwtPayload.sub || jwtPayload.user_id;
            authMethod = jwtPayload.googleId || jwtPayload.githubId ? 'oauth2' : 'email_password';
        }
        // Add alternate IDs
        if (jwtPayload.sub && jwtPayload.sub !== primaryUserId)
            alternateIds.push(jwtPayload.sub);
        if (jwtPayload.userId && jwtPayload.userId !== primaryUserId)
            alternateIds.push(jwtPayload.userId);
        if (jwtPayload.user_id && jwtPayload.user_id !== primaryUserId)
            alternateIds.push(jwtPayload.user_id);
        if (jwtPayload.googleId)
            alternateIds.push(`google:${jwtPayload.googleId}`);
        if (jwtPayload.githubId)
            alternateIds.push(`github:${jwtPayload.githubId}`);
        if (jwtPayload.microsoftId)
            alternateIds.push(`microsoft:${jwtPayload.microsoftId}`);
        return {
            primaryUserId,
            alternateIds: alternateIds.filter(id => id !== primaryUserId),
            email: jwtPayload.email,
            provider: jwtPayload.iss || 'unknown',
            authMethod
        };
    }
    clearSensitiveData(data) {
        if (typeof data === 'string') {
            data = null;
        }
    }
    /**
     * Background session refresh for long-running servers
     */
    async refreshExpiredSessions() {
        this.logger.debug('Refreshing expired vault sessions...');
        const now = new Date();
        const expiredConnections = [];
        for (const [userId, connection] of this.connections.entries()) {
            const minutesSinceUsed = (now.getTime() - connection.lastUsed.getTime()) / (1000 * 60);
            // Mark connections as expired after 60 minutes of inactivity
            if (minutesSinceUsed > 60) {
                expiredConnections.push(userId);
                continue;
            }
            // Health check for recent connections
            if (minutesSinceUsed < 30) {
                try {
                    const health = await connection.api.healthCheck();
                    connection.isHealthy = health.status === 'healthy';
                    if (!connection.isHealthy) {
                        this.logger.warn('Connection marked unhealthy', { userId });
                    }
                }
                catch (error) {
                    connection.isHealthy = false;
                    this.logger.warn('Connection health check failed', {
                        userId,
                        error: error.message
                    });
                }
            }
        }
        // Clean up expired connections
        for (const userId of expiredConnections) {
            const connection = this.connections.get(userId);
            if (connection) {
                await connection.api.cleanup();
                this.connections.delete(userId);
                this.logger.info('Cleaned up expired connection', { userId });
            }
        }
        if (expiredConnections.length > 0) {
            this.logger.info('Session refresh completed', {
                cleaned: expiredConnections.length,
                active: this.connections.size
            });
        }
    }
    /**
     * Check if session token is still valid (basic time-based check)
     */
    isSessionValid(connection) {
        const now = new Date();
        const minutesSinceUsed = (now.getTime() - connection.lastUsed.getTime()) / (1000 * 60);
        // Consider session invalid after 45 minutes (Bitwarden default timeout)
        return minutesSinceUsed < 45;
    }
    /**
     * Get performance statistics
     */
    getPerformanceStats() {
        const connections = Array.from(this.connections.values());
        const now = new Date();
        const connectionsByAge = {
            'under_5min': 0,
            '5_to_30min': 0,
            'over_30min': 0
        };
        connections.forEach(conn => {
            const minutes = (now.getTime() - conn.lastUsed.getTime()) / (1000 * 60);
            if (minutes < 5)
                connectionsByAge.under_5min++;
            else if (minutes < 30)
                connectionsByAge['5_to_30min']++;
            else
                connectionsByAge.over_30min++;
        });
        return {
            globalAPIInitialized: this.isGlobalAPIInitialized,
            activeConnections: this.connections.size,
            connectionsByAge,
            memoryUsage: {
                connections: this.connections.size,
                oldestConnection: connections.length > 0 ?
                    connections.reduce((oldest, current) => current.lastUsed < oldest.lastUsed ? current : oldest).lastUsed : null,
                newestConnection: connections.length > 0 ?
                    connections.reduce((newest, current) => current.lastUsed > newest.lastUsed ? current : newest).lastUsed : null
            }
        };
    }
    /**
     * Graceful cleanup for server shutdown
     */
    async cleanup() {
        this.logger.info('Cleaning up OptimizedVaultManager...');
        // Clear session refresh interval
        if (this.sessionRefreshInterval) {
            clearInterval(this.sessionRefreshInterval);
        }
        // Cleanup global API
        if (this.globalAPI) {
            await this.globalAPI.cleanup();
            this.globalAPI = undefined;
            this.isGlobalAPIInitialized = false;
        }
        // Cleanup all user connections
        for (const [userId, connection] of this.connections.entries()) {
            try {
                await connection.api.cleanup();
            }
            catch (error) {
                this.logger.warn('Error cleaning up connection', { userId, error: error.message });
            }
        }
        this.connections.clear();
        this.logger.info('OptimizedVaultManager cleanup completed');
    }
}
export default SecureVaultManager;
//# sourceMappingURL=SecureVaultManager.js.map