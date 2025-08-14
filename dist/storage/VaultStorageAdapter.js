/**
 * Vault Storage Adapter
 *
 * Enterprise-grade storage using PostgreSQL key-value store
 * Wrapper around PostgreSQLSecretManager to implement StorageAdapter interface
 */
// import { VaultwardenSecretManager } from '../services/VaultwardenSecretManager.js';
import { PostgreSQLSecretManager } from '../services/PostgreSQLSecretManager.js';
export class VaultStorageAdapter {
    config;
    secretManager;
    constructor(config, logger) {
        this.config = config;
        this.secretManager = new PostgreSQLSecretManager(config, config.encryptionKey, logger);
    }
    async initialize() {
        await this.secretManager.initialize();
    }
    async storeApiKey(provider, apiKey, userId) {
        return await this.secretManager.storeApiKey(provider, apiKey, userId);
    }
    async getApiKey(provider, userId) {
        return await this.secretManager.getApiKey(provider, userId);
    }
    async deleteApiKey(provider, userId) {
        return await this.secretManager.deleteApiKey(provider, userId);
    }
    async listProviders(userId) {
        return await this.secretManager.listUserApiKeys(userId);
    }
    async rotateApiKey(provider, newApiKey, userId) {
        return await this.secretManager.rotateApiKey(provider, newApiKey, userId);
    }
    async validateApiKey(provider, userId) {
        const apiKey = await this.getApiKey(provider, userId);
        return !!apiKey;
    }
    async healthCheck() {
        return await this.secretManager.healthCheck();
    }
    getType() {
        return 'vault';
    }
    /**
     * Get the underlying secret manager for advanced operations
     */
    getSecretManager() {
        return this.secretManager;
    }
}
//# sourceMappingURL=VaultStorageAdapter.js.map