/**
 * Storage Factory
 *
 * Creates appropriate storage adapters based on configuration
 * Handles initialization and error handling for different storage types
 */
import { StorageAdapter, StorageConfig } from './StorageAdapter.js';
import * as winston from 'winston';
export declare class StorageFactory {
    private static logger;
    /**
     * Create storage adapter from configuration
     */
    static createStorage(config: StorageConfig, logger?: winston.Logger): Promise<StorageAdapter>;
    /**
     * Create Vault storage adapter
     */
    private static createVaultStorage;
    /**
     * Create file storage adapter
     */
    private static createFileStorage;
    /**
     * Create client-managed storage adapter
     */
    private static createClientManagedStorage;
    /**
     * Create storage from environment variables (auto-detection)
     */
    static createFromEnvironment(logger?: winston.Logger): Promise<StorageAdapter>;
    /**
     * Validate storage configuration
     */
    static validateConfig(config: StorageConfig): string[];
    /**
     * Test storage adapter connectivity
     */
    static testStorage(adapter: StorageAdapter): Promise<{
        success: boolean;
        error?: string;
        details?: any;
    }>;
}
//# sourceMappingURL=StorageFactory.d.ts.map