/**
 * Vaultwarden Storage Adapter
 *
 * Enterprise-grade storage using Vaultwarden (Bitwarden-compatible server)
 * Wrapper around VaultwardenSecretManager to implement StorageAdapter interface
 */
import { StorageAdapter } from './StorageAdapter.js';
import { VaultwardenSecretManager } from '../services/VaultwardenSecretManager.js';
import { VaultwardenConfig } from '../config/vaultwarden.js';
import * as winston from 'winston';
export declare class VaultwardenStorageAdapter implements StorageAdapter {
    private config;
    private secretManager;
    constructor(config: VaultwardenConfig, logger?: winston.Logger);
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
    getType(): 'vaultwarden';
    /**
     * Get the underlying secret manager for advanced operations
     */
    getSecretManager(): VaultwardenSecretManager;
}
//# sourceMappingURL=VaultwardenStorageAdapter.d.ts.map