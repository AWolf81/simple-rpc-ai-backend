/**
 * Storage Factory
 *
 * Creates appropriate storage adapters based on configuration
 * Handles initialization and error handling for different storage types
 */
// VaultStorageAdapter removed - using simplified storage
import { FileStorageAdapter } from './FileStorageAdapter.js';
import { ClientManagedStorageAdapter } from './ClientManagedStorageAdapter.js';
import * as winston from 'winston';
import * as path from 'path';
export class StorageFactory {
    static logger = winston.createLogger({
        level: 'info',
        format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
        transports: [new winston.transports.Console()]
    });
    /**
     * Create storage adapter from configuration
     */
    static async createStorage(config, logger) {
        const log = logger || this.logger;
        log.info('Creating storage adapter', { type: config.type });
        let adapter;
        switch (config.type) {
            case 'postgres':
                adapter = this.createPostgreSQLStorage(config, log);
                break;
            case 'file':
                adapter = this.createFileStorage(config, log);
                break;
            case 'client_managed':
                adapter = this.createClientManagedStorage(log);
                break;
            default:
                throw new Error(`Unsupported storage type: ${config.type}`);
        }
        // Initialize the adapter
        await adapter.initialize();
        log.info('Storage adapter created and initialized', {
            type: adapter.getType()
        });
        return adapter;
    }
    /**
     * Create PostgreSQL storage adapter
     */
    static createPostgreSQLStorage(config, logger) {
        // PostgreSQL storage adapter implementation would go here
        // For now, throw an error as this needs to be implemented
        throw new Error('PostgreSQL storage adapter not yet implemented. Use "file" or "client-managed" storage types instead.');
    }
    /**
     * Create file storage adapter
     */
    static createFileStorage(config, logger) {
        const { path: filePath, masterKey } = config.config;
        if (!filePath) {
            throw new Error('File storage requires a file path');
        }
        if (!masterKey) {
            throw new Error('File storage requires a master key');
        }
        // Resolve relative paths
        const resolvedPath = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
        return new FileStorageAdapter(resolvedPath, masterKey, logger);
    }
    /**
     * Create client-managed storage adapter
     */
    static createClientManagedStorage(logger) {
        return new ClientManagedStorageAdapter(logger);
    }
    /**
     * Create storage from environment variables (auto-detection)
     */
    static async createFromEnvironment(logger) {
        const log = logger || this.logger;
        // Try to detect storage type from environment
        if (process.env.SECRET_MANAGER_DB_HOST && process.env.SECRET_MANAGER_DB_PASS) {
            log.info('Detected PostgreSQL Vault configuration in environment');
            return this.createStorage({
                type: 'postgres'
            }, log);
        }
        if (process.env.STORAGE_FILE_PATH || process.env.MASTER_KEY) {
            log.info('Detected file storage configuration in environment');
            return this.createStorage({
                type: 'file',
                config: {
                    path: process.env.STORAGE_FILE_PATH || './data/keys.encrypted.json',
                    masterKey: process.env.MASTER_KEY || 'dev-key-change-in-production'
                }
            }, log);
        }
        // Default to client-managed storage
        log.info('No storage configuration detected, using client-managed storage');
        return this.createStorage({
            type: 'client_managed'
        }, log);
    }
    /**
     * Validate storage configuration
     */
    static validateConfig(config) {
        const errors = [];
        switch (config.type) {
            case 'postgres':
                const postgresConfig = config;
                if (postgresConfig.config) {
                    if (!postgresConfig.config.host)
                        errors.push('PostgreSQL storage host is required');
                    if (!postgresConfig.config.database)
                        errors.push('PostgreSQL storage database is required');
                    if (!postgresConfig.config.user)
                        errors.push('PostgreSQL storage user is required');
                    if (!postgresConfig.config.password)
                        errors.push('PostgreSQL storage password is required');
                    if (!postgresConfig.config.encryptionKey)
                        errors.push('PostgreSQL storage encryptionKey is required');
                }
                break;
            case 'file':
                const fileConfig = config;
                if (!fileConfig.config?.path)
                    errors.push('File storage path is required');
                if (!fileConfig.config?.masterKey)
                    errors.push('File storage masterKey is required');
                if (fileConfig.config?.masterKey === 'dev-key-change-in-production' && process.env.NODE_ENV === 'production') {
                    errors.push('File storage masterKey must be changed for production');
                }
                break;
            case 'client_managed':
                // No configuration needed
                break;
            default:
                errors.push(`Unknown storage type: ${config.type}`);
        }
        return errors;
    }
    /**
     * Test storage adapter connectivity
     */
    static async testStorage(adapter) {
        try {
            // Test basic health check
            const health = await adapter.healthCheck();
            if (health.status !== 'healthy') {
                return {
                    success: false,
                    error: 'Storage health check failed',
                    details: health.details
                };
            }
            // For storage types that support it, test basic operations
            if (adapter.getType() !== 'client_managed') {
                try {
                    // Test store/retrieve/delete cycle with a test key
                    const testProvider = 'test-provider';
                    const testKey = 'test-api-key-' + Date.now();
                    await adapter.storeApiKey(testProvider, testKey);
                    const retrieved = await adapter.getApiKey(testProvider);
                    if (retrieved !== testKey) {
                        return {
                            success: false,
                            error: 'Storage test failed: key mismatch',
                            details: { expected: testKey, actual: retrieved }
                        };
                    }
                    await adapter.deleteApiKey(testProvider);
                }
                catch (testError) {
                    if (testError instanceof Error) {
                        return {
                            success: false,
                            error: 'Storage operation test failed',
                            details: { error: testError.message }
                        };
                    }
                    return {
                        success: false,
                        error: 'Storage operation test failed',
                        details: { error: 'Unexpected error!' }
                    };
                }
            }
            return {
                success: true,
                details: health.details
            };
        }
        catch (error) {
            if (error instanceof Error) {
                return {
                    success: false,
                    error: error.message
                };
            }
            return {
                success: false,
                error: 'Unexpected Error!'
            };
        }
    }
}
