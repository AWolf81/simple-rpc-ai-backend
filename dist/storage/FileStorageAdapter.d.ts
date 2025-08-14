/**
 * File-based Storage Adapter
 *
 * Simple, encrypted file storage for API keys
 * Perfect for development and small deployments
 */
import { StorageAdapter } from './StorageAdapter.js';
import * as winston from 'winston';
export interface FileStorageData {
    version: string;
    keys: Record<string, {
        provider: string;
        userId?: string;
        encryptedKey: string;
        nonce: string;
        createdAt: string;
        updatedAt: string;
    }>;
}
export declare class FileStorageAdapter implements StorageAdapter {
    private filePath;
    private masterKey;
    private logger;
    private data;
    private isInitialized;
    private readonly algorithm;
    private encryptionKey;
    constructor(filePath: string, masterKey: string, logger?: winston.Logger);
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
    getType(): 'file';
    /**
     * Export keys for backup (encrypted)
     */
    exportKeys(): Promise<string>;
    /**
     * Import keys from backup
     */
    importKeys(encryptedData: string): Promise<void>;
    private ensureInitialized;
    private generateKeyId;
    private encryptApiKey;
    private decryptApiKey;
    private encryptData;
    private decryptData;
    private save;
}
//# sourceMappingURL=FileStorageAdapter.d.ts.map