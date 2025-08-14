/**
 * Client-Managed Storage Adapter
 *
 * No server-side storage - API keys passed directly in requests
 * Perfect for VS Code secure storage integration
 */
import { StorageAdapter } from './StorageAdapter.js';
import * as winston from 'winston';
export declare class ClientManagedStorageAdapter implements StorageAdapter {
    private logger;
    constructor(logger?: winston.Logger);
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
    getType(): 'client_managed';
    /**
     * Validate that an API key was provided in the request
     */
    static validateRequestApiKey(apiKey?: string): boolean;
    /**
     * Extract provider from API key format (basic validation)
     */
    static inferProvider(apiKey: string): string | null;
    /**
     * Validate API key format for known providers
     */
    static validateApiKeyFormat(provider: string, apiKey: string): boolean;
}
//# sourceMappingURL=ClientManagedStorageAdapter.d.ts.map