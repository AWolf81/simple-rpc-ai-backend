/**
 * Vaultwarden Secret Manager
 *
 * Secure API key storage using Vaultwarden (Bitwarden-compatible server)
 * Replaces SQLite-based key storage with enterprise-grade secret management
 */
import { VaultwardenConfig } from '../config/vaultwarden.js';
import * as winston from 'winston';
export interface SecretManagerInterface {
    initialize(): Promise<void>;
    storeApiKey(provider: string, apiKey: string, userId?: string): Promise<string>;
    getApiKey(provider: string, userId?: string): Promise<string | null>;
    deleteApiKey(provider: string, userId?: string): Promise<boolean>;
    listUserApiKeys(userId?: string): Promise<Array<{
        provider: string;
        hasKey: boolean;
    }>>;
    rotateApiKey(provider: string, newApiKey: string, userId?: string): Promise<string>;
    healthCheck(): Promise<{
        status: 'healthy' | 'unhealthy';
        details: any;
    }>;
}
export interface APIKeyMetadata {
    provider: string;
    userId?: string;
    createdAt: string;
    lastUsedAt?: string;
    rotatedAt?: string;
}
export declare class VaultwardenSecretManager implements SecretManagerInterface {
    private config;
    private client;
    private organizationId;
    private projectId;
    private tokenProjectId;
    private logger;
    private isInitialized;
    private readonly AI_PROVIDERS;
    constructor(config: VaultwardenConfig, logger?: winston.Logger);
    initialize(): Promise<void>;
    private ensureInitialized;
    private validateProvider;
    private validateApiKey;
    storeApiKey(provider: string, apiKey: string, userId?: string): Promise<string>;
    getApiKey(provider: string, userId?: string): Promise<string | null>;
    deleteApiKey(provider: string, userId?: string): Promise<boolean>;
    listUserApiKeys(userId?: string): Promise<Array<{
        provider: string;
        hasKey: boolean;
    }>>;
    rotateApiKey(provider: string, newApiKey: string, userId?: string): Promise<string>;
    healthCheck(): Promise<{
        status: 'healthy' | 'unhealthy';
        details: any;
    }>;
    private ensureProject;
    private findSecret;
    private auditLog;
    disconnect(): Promise<void>;
}
//# sourceMappingURL=VaultwardenSecretManager.d.ts.map