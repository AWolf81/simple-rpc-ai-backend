/**
 * Storage Adapter Interface
 *
 * Pluggable storage system for API keys and secrets
 * Supports Vaultwarden, file-based, and client-managed storage
 */
export interface StorageAdapter {
    /**
     * Initialize the storage system
     */
    initialize(): Promise<void>;
    /**
     * Store API key for a provider
     */
    storeApiKey(provider: string, apiKey: string, userId?: string): Promise<string>;
    /**
     * Get API key for a provider
     */
    getApiKey(provider: string, userId?: string): Promise<string | null>;
    /**
     * Delete API key for a provider
     */
    deleteApiKey(provider: string, userId?: string): Promise<boolean>;
    /**
     * List providers with keys
     */
    listProviders(userId?: string): Promise<Array<{
        provider: string;
        hasKey: boolean;
    }>>;
    /**
     * Rotate API key
     */
    rotateApiKey(provider: string, newApiKey: string, userId?: string): Promise<string>;
    /**
     * Validate that an API key exists and is accessible
     */
    validateApiKey(provider: string, userId?: string): Promise<boolean>;
    /**
     * Health check for storage system
     */
    healthCheck(): Promise<{
        status: 'healthy' | 'unhealthy';
        details: any;
    }>;
    /**
     * Get storage type identifier
     */
    getType(): StorageType;
}
export type StorageType = 'vault' | 'file' | 'client_managed';
export interface StorageConfig {
    type: StorageType;
    config?: any;
}
export interface VaultStorageConfig extends StorageConfig {
    type: 'vault';
    config: {
        host: string;
        port: number;
        database: string;
        user: string;
        password: string;
        encryptionKey: string;
    };
}
export interface FileStorageConfig extends StorageConfig {
    type: 'file';
    config: {
        path: string;
        masterKey: string;
    };
}
export interface ClientManagedStorageConfig extends StorageConfig {
    type: 'client_managed';
    config?: never;
}
//# sourceMappingURL=StorageAdapter.d.ts.map