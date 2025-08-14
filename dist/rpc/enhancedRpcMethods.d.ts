/**
 * Enhanced RPC Methods with Flexible Key Management
 *
 * Supports Vaultwarden, file storage, and client-managed API keys
 * Handles direct API key passing in requests
 */
import { StorageAdapter } from '../storage/StorageAdapter.js';
import { AuthManager } from '../auth/auth-manager.js';
import * as winston from 'winston';
export interface EnhancedRpcMethodsContext {
    storageAdapter: StorageAdapter;
    authManager?: AuthManager;
    logger: winston.Logger;
    config: {
        requireAuth: boolean;
        allowDirectKeyPassing: boolean;
    };
}
export interface AIRequestParams {
    content: string;
    systemPrompt: string;
    apiKey?: string;
    provider?: string;
    deviceId?: string;
    metadata?: Record<string, any>;
}
export interface KeyManagementParams {
    deviceId?: string;
    provider: string;
    apiKey?: string;
    userId?: string;
}
/**
 * Create enhanced RPC methods with flexible storage
 */
export declare function createEnhancedRpcMethods(context: EnhancedRpcMethodsContext): {
    /**
     * Execute AI request with flexible key management
     */
    executeAIRequest(params: AIRequestParams): Promise<{
        success: boolean;
        response: string;
        metadata: {
            provider: string;
            systemPrompt: string;
            processingTime: number;
            tokenUsage: {
                inputTokens: number;
                outputTokens: number;
                totalTokens: number;
            };
            storageType: import("../storage/StorageAdapter.js").StorageType;
        };
    } | {
        success: boolean;
        error: string;
        message: any;
    }>;
    /**
     * Store API key (only for storage-based adapters)
     */
    storeApiKey(params: KeyManagementParams): Promise<{
        success: boolean;
        keyId: string;
        message: string;
        error?: undefined;
    } | {
        success: boolean;
        error: string;
        message: any;
        keyId?: undefined;
    }>;
    /**
     * Get API key status (never returns actual key)
     */
    getApiKeyStatus(params: {
        deviceId?: string;
        provider: string;
        userId?: string;
    }): Promise<{
        success: boolean;
        hasKey: boolean;
        storageType: string;
        message: string;
        provider?: undefined;
        error?: undefined;
    } | {
        success: boolean;
        hasKey: boolean;
        provider: string;
        storageType: import("../storage/StorageAdapter.js").StorageType;
        message: string;
        error?: undefined;
    } | {
        success: boolean;
        error: string;
        message: any;
        hasKey?: undefined;
        storageType?: undefined;
        provider?: undefined;
    }>;
    /**
     * List available providers
     */
    listProviders(params: {
        deviceId?: string;
        userId?: string;
    }): Promise<{
        success: boolean;
        providers: {
            provider: string;
            hasKey: boolean;
        }[];
        storageType: import("../storage/StorageAdapter.js").StorageType;
        message: string;
        error?: undefined;
    } | {
        success: boolean;
        error: string;
        message: any;
        providers?: undefined;
        storageType?: undefined;
    }>;
    /**
     * Delete API key (only for storage-based adapters)
     */
    deleteApiKey(params: KeyManagementParams): Promise<{
        success: boolean;
        message: string;
        error?: undefined;
    } | {
        success: boolean;
        error: string;
        message: any;
    }>;
    /**
     * Get storage health and configuration info
     */
    getStorageInfo(): Promise<{
        success: boolean;
        storageType: import("../storage/StorageAdapter.js").StorageType;
        health: "healthy" | "unhealthy";
        details: any;
        capabilities: {
            storeKeys: boolean;
            requiresDirectKeys: boolean;
            supportsMultiUser: boolean;
            supportsApiTokens: boolean;
        };
        message: string;
        error?: undefined;
    } | {
        success: boolean;
        error: string;
        message: any;
        storageType?: undefined;
        health?: undefined;
        details?: undefined;
        capabilities?: undefined;
    }>;
    /**
     * Health check for the entire system
     */
    health(): Promise<{
        success: boolean;
        status: "healthy" | "unhealthy";
        storage: {
            type: import("../storage/StorageAdapter.js").StorageType;
            status: "healthy" | "unhealthy";
            details: any;
        };
        capabilities: {
            requiresAuth: boolean;
            allowsDirectKeys: boolean;
            storageType: import("../storage/StorageAdapter.js").StorageType;
        };
        timestamp: string;
        message: string;
        error?: undefined;
    } | {
        success: boolean;
        error: string;
        message: any;
        status?: undefined;
        storage?: undefined;
        capabilities?: undefined;
        timestamp?: undefined;
    }>;
};
//# sourceMappingURL=enhancedRpcMethods.d.ts.map