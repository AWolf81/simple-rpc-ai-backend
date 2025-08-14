/**
 * Secure Vault Manager
 *
 * High-performance Vaultwarden integration with:
 * 1. Persistent bw serve service (no per-request spawning)
 * 2. Connection pooling and session reuse
 * 3. Server-side master key generation
 * 4. Flexible plan management integration
 * 5. OAuth2 + multi-auth provider support
 */
import { BitwardenRESTAPI, BitwardenConfig } from './BitwardenRESTAPI.js';
import { UserIdentityBridge } from './UserIdentityBridge.js';
import { FlexiblePlanConfig } from './FlexiblePlanManager.js';
import * as winston from 'winston';
export interface SecureUserMapping {
    primaryUserId: string;
    alternateUserIds: string[];
    email: string;
    vaultwardenUserId: string;
    encryptedVaultPassword: string;
    authProvider: string;
    subscriptionTier: 'free' | 'pro' | 'enterprise';
    createdAt: Date;
    lastUsed?: Date;
}
export interface ProUserConfig {
    anthropicApiKey?: string;
    openaiApiKey?: string;
    googleApiKey?: string;
}
export interface SecureVaultManagerConfig {
    bitwardenConfig: BitwardenConfig;
    databaseMasterKey: string;
    userBridge: UserIdentityBridge;
    proUserConfig?: ProUserConfig;
    flexiblePlanConfig?: FlexiblePlanConfig;
    logger?: winston.Logger;
}
export interface VaultConnection {
    api: BitwardenRESTAPI;
    userId: string;
    sessionToken: string;
    lastUsed: Date;
    isHealthy: boolean;
}
export declare class SecureVaultManager {
    private logger;
    private userMappings;
    private userIdIndex;
    private connections;
    private globalAPI?;
    private planManager?;
    private masterKey;
    private proUserConfig?;
    private config;
    private isGlobalAPIInitialized;
    private sessionRefreshInterval?;
    constructor(config: SecureVaultManagerConfig);
    /**
     * RPC Method: vaultwarden.storeApiKey
     * Store API key with automatic onboarding and optimized performance
     */
    storeApiKey(opensaasJWT: string, apiKey: string, provider: string): Promise<{
        success: boolean;
        keyId: string;
    }>;
    /**
     * RPC Method: executeAIRequest (with user existence check)
     * Execute AI request - requires user to have stored API key first
     */
    executeAIRequestWithAutoKey(opensaasJWT: string, content: string, systemPrompt: string, provider: string): Promise<string>;
    /**
     * Get persistent API connection (main performance optimization)
     * Connects to persistent bw serve service instead of spawning new processes
     */
    private getVaultConnection;
    /**
     * Get shared global API (connects to persistent bw serve service)
     * Main performance optimization - no process spawning
     */
    private getGlobalAPI;
    /**
     * Internal method: Ensure user is onboarded (supporting multiple user IDs)
     */
    private ensureUserOnboarded;
    /**
     * Fast API key storage with optimized connection
     */
    private storeAPIKeyOptimized;
    /**
     * Fast API key retrieval with connection reuse
     */
    private retrieveAPIKeyOptimized;
    /**
     * Retrieve API key securely (handles both BYOK and Pro users with flexible plans)
     */
    private retrieveApiKeySecurely;
    private findUserByAnyId;
    private generateSecurePassword;
    private encryptVaultPassword;
    private decryptVaultPassword;
    private createVaultwardenAccount;
    private getServerApiKey;
    private getSystemPrompt;
    private executeAIRequest;
    private validateJWT;
    private extractUserIdentity;
    private clearSensitiveData;
    /**
     * Background session refresh for long-running servers
     */
    private refreshExpiredSessions;
    /**
     * Check if session token is still valid (basic time-based check)
     */
    private isSessionValid;
    /**
     * Get performance statistics
     */
    getPerformanceStats(): {
        globalAPIInitialized: boolean;
        activeConnections: number;
        connectionsByAge: {
            [key: string]: number;
        };
        memoryUsage: {
            connections: number;
            oldestConnection: Date | null;
            newestConnection: Date | null;
        };
    };
    /**
     * Graceful cleanup for server shutdown
     */
    cleanup(): Promise<void>;
}
export default SecureVaultManager;
//# sourceMappingURL=SecureVaultManager.d.ts.map