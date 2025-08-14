/**
 * RPC Methods for Vaultwarden Key Management
 *
 * JSON-RPC methods for managing AI provider API keys using Vaultwarden
 */
import { VaultwardenKeyManager } from '../auth/VaultwardenKeyManager.js';
import { AuthManager } from '../auth/auth-manager.js';
import * as winston from 'winston';
export interface KeyMethodsContext {
    keyManager: VaultwardenKeyManager;
    authManager: AuthManager;
    logger: winston.Logger;
}
/**
 * Create RPC methods for key management
 */
export declare function createKeyMethods(context: KeyMethodsContext): {
    /**
     * Store API key for a provider
     */
    storeUserKey(params: {
        deviceId: string;
        provider: string;
        apiKey: string;
    }): Promise<{
        success: boolean;
        message: string;
        error?: undefined;
    } | {
        success: boolean;
        error: string;
        message: any;
    }>;
    /**
     * Get API key for a provider (returns existence only, not the actual key)
     */
    getUserKey(params: {
        deviceId: string;
        provider: string;
    }): Promise<{
        success: boolean;
        hasKey: boolean;
        message: string;
        error?: undefined;
    } | {
        success: boolean;
        error: string;
        message: any;
        hasKey?: undefined;
    }>;
    /**
     * Delete API key for a provider
     */
    deleteUserKey(params: {
        deviceId: string;
        provider: string;
    }): Promise<{
        success: boolean;
        message: string;
        error?: undefined;
    } | {
        success: boolean;
        error: string;
        message: any;
    }>;
    /**
     * List all providers and their key status for user
     */
    getUserProviders(params: {
        deviceId: string;
    }): Promise<{
        success: boolean;
        providers: any;
        count: any;
        message: string;
        error?: undefined;
    } | {
        success: boolean;
        error: string;
        message: any;
        providers?: undefined;
        count?: undefined;
    }>;
    /**
     * Validate API key for a provider
     */
    validateUserKey(params: {
        deviceId: string;
        provider: string;
    }): Promise<{
        success: boolean;
        isValid: any;
        message: string;
        error?: undefined;
    } | {
        success: boolean;
        error: string;
        message: any;
        isValid?: undefined;
    }>;
    /**
     * Rotate API key for a provider
     */
    rotateUserKey(params: {
        deviceId: string;
        provider: string;
        newApiKey: string;
    }): Promise<{
        success: boolean;
        message: string;
        error?: undefined;
    } | {
        success: boolean;
        error: string;
        message: any;
    }>;
    /**
     * Get key usage statistics
     */
    getKeyUsageStats(params: {
        deviceId: string;
    }): Promise<any>;
    /**
     * Validate all user keys
     */
    validateAllUserKeys(params: {
        deviceId: string;
    }): Promise<{
        success: boolean;
        results: any;
        validCount: number;
        totalCount: number;
        message: string;
        error?: undefined;
    } | {
        success: boolean;
        error: string;
        message: any;
        results?: undefined;
        validCount?: undefined;
        totalCount?: undefined;
    }>;
    /**
     * Health check for key management system
     */
    keyManagerHealth(): Promise<{
        success: boolean;
        status: any;
        details: any;
        timestamp: string;
        message: string;
        error?: undefined;
    } | {
        success: boolean;
        status: string;
        error: any;
        timestamp: string;
        message: string;
        details?: undefined;
    }>;
};
export declare function createLegacyKeyMethods(context: KeyMethodsContext): {
    storeProviderApiKey: (params: {
        deviceId: string;
        provider: string;
        apiKey: string;
    }) => Promise<{
        success: boolean;
        message: string;
        error?: undefined;
    } | {
        success: boolean;
        error: string;
        message: any;
    }>;
    getProviderApiKey: (params: {
        deviceId: string;
        provider: string;
    }) => Promise<{
        success: boolean;
        hasKey: boolean;
        message: string;
        error?: undefined;
    } | {
        success: boolean;
        error: string;
        message: any;
        hasKey?: undefined;
    }>;
    deleteProviderApiKey: (params: {
        deviceId: string;
        provider: string;
    }) => Promise<{
        success: boolean;
        message: string;
        error?: undefined;
    } | {
        success: boolean;
        error: string;
        message: any;
    }>;
    listProviderKeys: (params: {
        deviceId: string;
    }) => Promise<{
        success: boolean;
        providers: any;
        count: any;
        message: string;
        error?: undefined;
    } | {
        success: boolean;
        error: string;
        message: any;
        providers?: undefined;
        count?: undefined;
    }>;
    rotateProviderApiKey: (params: {
        deviceId: string;
        provider: string;
        newApiKey: string;
    }) => Promise<{
        success: boolean;
        message: string;
        error?: undefined;
    } | {
        success: boolean;
        error: string;
        message: any;
    }>;
    vaultwardenHealth: () => Promise<{
        success: boolean;
        status: any;
        details: any;
        timestamp: string;
        message: string;
        error?: undefined;
    } | {
        success: boolean;
        status: string;
        error: any;
        timestamp: string;
        message: string;
        details?: undefined;
    }>;
    /**
     * Store API key for a provider
     */
    storeUserKey(params: {
        deviceId: string;
        provider: string;
        apiKey: string;
    }): Promise<{
        success: boolean;
        message: string;
        error?: undefined;
    } | {
        success: boolean;
        error: string;
        message: any;
    }>;
    /**
     * Get API key for a provider (returns existence only, not the actual key)
     */
    getUserKey(params: {
        deviceId: string;
        provider: string;
    }): Promise<{
        success: boolean;
        hasKey: boolean;
        message: string;
        error?: undefined;
    } | {
        success: boolean;
        error: string;
        message: any;
        hasKey?: undefined;
    }>;
    /**
     * Delete API key for a provider
     */
    deleteUserKey(params: {
        deviceId: string;
        provider: string;
    }): Promise<{
        success: boolean;
        message: string;
        error?: undefined;
    } | {
        success: boolean;
        error: string;
        message: any;
    }>;
    /**
     * List all providers and their key status for user
     */
    getUserProviders(params: {
        deviceId: string;
    }): Promise<{
        success: boolean;
        providers: any;
        count: any;
        message: string;
        error?: undefined;
    } | {
        success: boolean;
        error: string;
        message: any;
        providers?: undefined;
        count?: undefined;
    }>;
    /**
     * Validate API key for a provider
     */
    validateUserKey(params: {
        deviceId: string;
        provider: string;
    }): Promise<{
        success: boolean;
        isValid: any;
        message: string;
        error?: undefined;
    } | {
        success: boolean;
        error: string;
        message: any;
        isValid?: undefined;
    }>;
    /**
     * Rotate API key for a provider
     */
    rotateUserKey(params: {
        deviceId: string;
        provider: string;
        newApiKey: string;
    }): Promise<{
        success: boolean;
        message: string;
        error?: undefined;
    } | {
        success: boolean;
        error: string;
        message: any;
    }>;
    /**
     * Get key usage statistics
     */
    getKeyUsageStats(params: {
        deviceId: string;
    }): Promise<any>;
    /**
     * Validate all user keys
     */
    validateAllUserKeys(params: {
        deviceId: string;
    }): Promise<{
        success: boolean;
        results: any;
        validCount: number;
        totalCount: number;
        message: string;
        error?: undefined;
    } | {
        success: boolean;
        error: string;
        message: any;
        results?: undefined;
        validCount?: undefined;
        totalCount?: undefined;
    }>;
    /**
     * Health check for key management system
     */
    keyManagerHealth(): Promise<{
        success: boolean;
        status: any;
        details: any;
        timestamp: string;
        message: string;
        error?: undefined;
    } | {
        success: boolean;
        status: string;
        error: any;
        timestamp: string;
        message: string;
        details?: undefined;
    }>;
};
//# sourceMappingURL=keyMethods.d.ts.map