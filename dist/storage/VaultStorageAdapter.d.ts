/**
 * Vault Storage Adapter
 *
 * Enterprise-grade storage using PostgreSQL key-value store
 * Wrapper around PostgreSQLSecretManager to implement StorageAdapter interface
 */
import { StorageAdapter } from './StorageAdapter.js';
import { PostgreSQLSecretManager, PostgreSQLConfig } from '../services/PostgreSQLSecretManager.js';
import * as winston from 'winston';
export declare class VaultStorageAdapter implements StorageAdapter {
    private config;
    private secretManager;
    constructor(config: PostgreSQLConfig, logger?: winston.Logger);
    initialize(): Promise<void>;
    storeApiKey(provider: string, apiKey: string, userId?: string): Promise<string>;
    getApiKey(provider: string, userId?: string): Promise<string | null>;
    deleteApiKey(provider: string, userId?: string): Promise<boolean>;
    listProviders(userId?: string): Promise<Array<{
        provider: string;
        hasKey: boolean;
    }>>;
    rotateApiKey(provider: string, newApiKey: string, userId?: string): Promise<string>;
    validateApiKey(provider: string, userId?: string): Promise<boolean>;
    healthCheck(): Promise<{
        status: 'healthy' | 'unhealthy';
        details: any;
    }>;
    getType(): 'vault';
    /**
     * Get the underlying secret manager for advanced operations
     */
    getSecretManager(): PostgreSQLSecretManager;
}
//# sourceMappingURL=VaultStorageAdapter.d.ts.map