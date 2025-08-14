/**
 * Vaultwarden Secret Manager
 *
 * Secure API key storage using Vaultwarden (Bitwarden-compatible server)
 * Replaces SQLite-based key storage with enterprise-grade secret management
 */
import * as winston from 'winston';
export class VaultwardenSecretManager {
    config;
    client = null;
    organizationId;
    projectId = null;
    tokenProjectId = null;
    logger;
    isInitialized = false;
    // AI provider validation
    AI_PROVIDERS = [
        'anthropic', 'openai', 'google', 'deepseek', 'openrouter',
        'cohere', 'mistral', 'together', 'replicate'
    ];
    constructor(config, logger) {
        this.config = config;
        this.organizationId = config.organizationId;
        this.logger = logger || winston.createLogger({
            level: 'info',
            format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
            transports: [
                new winston.transports.Console()
            ]
        });
    }
    async initialize() {
        try {
            this.logger.info('Initializing Vaultwarden Secret Manager', {
                serverUrl: this.config.serverUrl,
                organizationId: this.organizationId
            });
            // Initialize Bitwarden SDK client
            this.client = new Client({
                apiUrl: `${this.config.serverUrl}/api`,
                identityUrl: `${this.config.serverUrl}/identity`,
            });
            // Authenticate service account
            await this.client.auth.login({
                email: this.config.serviceEmail,
                password: this.config.servicePassword,
            });
            // Validate organization access
            if (!this.organizationId) {
                throw new Error('Organization ID not configured. Please run setup script first.');
            }
            // Get or create projects
            this.projectId = await this.ensureProject('AI Provider Keys');
            this.tokenProjectId = await this.ensureProject('API Tokens');
            this.isInitialized = true;
            this.logger.info('Vaultwarden Secret Manager initialized successfully');
        }
        catch (error) {
            this.logger.error('Failed to initialize Vaultwarden Secret Manager', { error: error.message });
            throw new Error(`Vaultwarden initialization failed: ${error.message}`);
        }
    }
    ensureInitialized() {
        if (!this.isInitialized || !this.client || !this.projectId) {
            throw new Error('VaultwardenSecretManager not initialized. Call initialize() first.');
        }
    }
    validateProvider(provider) {
        if (!this.AI_PROVIDERS.includes(provider)) {
            throw new Error(`Invalid AI provider: ${provider}. Allowed providers: ${this.AI_PROVIDERS.join(', ')}`);
        }
    }
    validateApiKey(apiKey) {
        if (!apiKey || typeof apiKey !== 'string') {
            throw new Error('API key must be a non-empty string');
        }
        if (apiKey.length > 1024) {
            throw new Error('API key too large (max 1KB)');
        }
        // Basic format validation
        const commonPrefixes = ['sk-', 'claude-', 'goog-', 'Bearer ', 'API-'];
        const hasValidPrefix = commonPrefixes.some(prefix => apiKey.toLowerCase().startsWith(prefix.toLowerCase()));
        if (!hasValidPrefix && apiKey.length < 20) {
            this.logger.warn('API key format may be invalid', {
                provider: 'unknown',
                keyLength: apiKey.length
            });
        }
    }
    async storeApiKey(provider, apiKey, userId) {
        this.ensureInitialized();
        this.validateProvider(provider);
        this.validateApiKey(apiKey);
        const secretName = userId ? `${provider}-${userId}` : `${provider}-default`;
        const timestamp = new Date().toISOString();
        try {
            // Check if secret already exists
            const existingSecret = await this.findSecret(secretName);
            if (existingSecret) {
                // Update existing secret
                await this.client.secrets.update(existingSecret.id, {
                    organizationId: this.organizationId,
                    key: secretName,
                    value: apiKey,
                    note: `API key for ${provider} provider${userId ? ` (user: ${userId})` : ' (default)'} - Updated: ${timestamp}`,
                });
                await this.auditLog('UPDATE_API_KEY', {
                    provider,
                    userId,
                    secretId: existingSecret.id,
                    timestamp,
                });
                return existingSecret.id;
            }
            else {
                // Create new secret
                const secretId = await this.client.secrets.create({
                    organizationId: this.organizationId,
                    projectId: this.projectId,
                    key: secretName,
                    value: apiKey,
                    note: `API key for ${provider} provider${userId ? ` (user: ${userId})` : ' (default)'} - Created: ${timestamp}`,
                });
                await this.auditLog('STORE_API_KEY', {
                    provider,
                    userId,
                    secretId,
                    timestamp,
                });
                return secretId;
            }
        }
        catch (error) {
            await this.auditLog('STORE_API_KEY_ERROR', {
                provider,
                userId,
                error: error.message,
                timestamp,
            });
            throw new Error(`Failed to store API key for ${provider}: ${error.message}`);
        }
    }
    async getApiKey(provider, userId) {
        this.ensureInitialized();
        this.validateProvider(provider);
        const secretName = userId ? `${provider}-${userId}` : `${provider}-default`;
        try {
            const secret = await this.findSecret(secretName);
            if (!secret) {
                return null;
            }
            const secretData = await this.client.secrets.get(secret.id);
            await this.auditLog('RETRIEVE_API_KEY', {
                provider,
                userId,
                secretId: secret.id,
                timestamp: new Date().toISOString(),
            });
            return secretData.value;
        }
        catch (error) {
            await this.auditLog('RETRIEVE_API_KEY_ERROR', {
                provider,
                userId,
                error: error.message,
                timestamp: new Date().toISOString(),
            });
            return null;
        }
    }
    async deleteApiKey(provider, userId) {
        this.ensureInitialized();
        this.validateProvider(provider);
        const secretName = userId ? `${provider}-${userId}` : `${provider}-default`;
        try {
            const secret = await this.findSecret(secretName);
            if (!secret) {
                return false;
            }
            await this.client.secrets.delete(secret.id);
            await this.auditLog('DELETE_API_KEY', {
                provider,
                userId,
                secretId: secret.id,
                timestamp: new Date().toISOString(),
            });
            return true;
        }
        catch (error) {
            await this.auditLog('DELETE_API_KEY_ERROR', {
                provider,
                userId,
                error: error.message,
                timestamp: new Date().toISOString(),
            });
            return false;
        }
    }
    async listUserApiKeys(userId) {
        this.ensureInitialized();
        try {
            const secrets = await this.client.secrets.list({
                organizationId: this.organizationId,
                projectId: this.projectId,
            });
            const userSuffix = userId ? `-${userId}` : '-default';
            return this.AI_PROVIDERS.map(provider => ({
                provider,
                hasKey: secrets.data.some(s => s.key === `${provider}${userSuffix}`)
            }));
        }
        catch (error) {
            this.logger.error('Failed to list user API keys', { error: error.message, userId });
            return this.AI_PROVIDERS.map(provider => ({ provider, hasKey: false }));
        }
    }
    async rotateApiKey(provider, newApiKey, userId) {
        this.ensureInitialized();
        this.validateProvider(provider);
        this.validateApiKey(newApiKey);
        try {
            // Store new key (this will update if exists)
            const secretId = await this.storeApiKey(provider, newApiKey, userId);
            await this.auditLog('ROTATE_API_KEY', {
                provider,
                userId,
                secretId,
                timestamp: new Date().toISOString(),
            });
            return secretId;
        }
        catch (error) {
            await this.auditLog('ROTATE_API_KEY_ERROR', {
                provider,
                userId,
                error: error.message,
                timestamp: new Date().toISOString(),
            });
            throw error;
        }
    }
    async healthCheck() {
        try {
            if (!this.isInitialized || !this.client) {
                return {
                    status: 'unhealthy',
                    details: { error: 'Not initialized' }
                };
            }
            // Test API connectivity by listing projects
            await this.client.projects.list(this.organizationId);
            return {
                status: 'healthy',
                details: {
                    serverUrl: this.config.serverUrl,
                    organizationId: this.organizationId,
                    projectId: this.projectId,
                    tokenProjectId: this.tokenProjectId,
                    initialized: this.isInitialized,
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
    async ensureProject(projectName) {
        if (!this.client) {
            throw new Error('Client not initialized');
        }
        try {
            const projects = await this.client.projects.list(this.organizationId);
            const existing = projects.data.find(p => p.name === projectName);
            if (existing) {
                this.logger.debug(`Using existing project: ${projectName}`, { projectId: existing.id });
                return existing.id;
            }
            const project = await this.client.projects.create({
                organizationId: this.organizationId,
                name: projectName,
            });
            this.logger.info(`Created new project: ${projectName}`, { projectId: project.id });
            return project.id;
        }
        catch (error) {
            this.logger.error(`Failed to ensure project: ${projectName}`, { error: error.message });
            throw error;
        }
    }
    async findSecret(secretName) {
        if (!this.client || !this.projectId) {
            return null;
        }
        try {
            const secrets = await this.client.secrets.list({
                organizationId: this.organizationId,
                projectId: this.projectId,
            });
            return secrets.data.find(s => s.key === secretName) || null;
        }
        catch (error) {
            this.logger.error('Failed to find secret', { secretName, error: error.message });
            return null;
        }
    }
    async auditLog(action, data) {
        this.logger.info('Vaultwarden Secret Manager audit log', {
            service: 'VaultwardenSecretManager',
            action,
            data,
            timestamp: new Date().toISOString(),
        });
    }
    // Cleanup resources
    async disconnect() {
        if (this.client) {
            // Note: @bitwarden/sdk-node doesn't have explicit disconnect
            // but we can clear our reference
            this.client = null;
            this.isInitialized = false;
            this.logger.info('Vaultwarden Secret Manager disconnected');
        }
    }
}
//# sourceMappingURL=VaultwardenSecretManager.js.map