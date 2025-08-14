/**
 * RPC Methods for API Token Management
 *
 * JSON-RPC methods for managing API tokens for external access
 */
import { APITokenManager, TokenScope } from '../services/APITokenManager.js';
import { AuthManager } from '../auth/auth-manager.js';
import * as winston from 'winston';
export interface ApiTokenMethodsContext {
    tokenManager: APITokenManager;
    authManager: AuthManager;
    logger: winston.Logger;
    config: {
        apiTokensEnabled: boolean;
        requiresPro: boolean;
        maxTokensPerUser: number;
    };
}
/**
 * Create RPC methods for API token management
 */
export declare function createApiTokenMethods(context: ApiTokenMethodsContext): {
    /**
     * Create API token for external access (Pro feature)
     */
    createAPIToken(params: {
        deviceId: string;
        name: string;
        scopes: TokenScope[];
        expiresInDays?: number;
        rateLimits?: {
            requestsPerHour?: number;
            dailyLimit?: number;
        };
    }): Promise<{
        success: boolean;
        error: string;
        message: string;
        upgradeUrl: string;
        tokenId?: undefined;
        token?: undefined;
        name?: undefined;
        scopes?: undefined;
        rateLimits?: undefined;
        expiresAt?: undefined;
    } | {
        success: boolean;
        tokenId: string;
        token: string;
        name: string;
        scopes: TokenScope[];
        rateLimits: {
            requestsPerHour: number;
            dailyLimit: number;
        };
        expiresAt: string | undefined;
        message: string;
        error?: undefined;
        upgradeUrl?: undefined;
    } | {
        success: boolean;
        error: string;
        message: any;
        upgradeUrl?: undefined;
        tokenId?: undefined;
        token?: undefined;
        name?: undefined;
        scopes?: undefined;
        rateLimits?: undefined;
        expiresAt?: undefined;
    }>;
    /**
     * List user's API tokens
     */
    listAPITokens(params: {
        deviceId: string;
    }): Promise<{
        success: boolean;
        tokens: {
            tokenId: string;
            name: string;
            scopes: TokenScope[];
            rateLimits: {
                requestsPerHour: number;
                dailyLimit: number;
            };
            createdAt: string;
            lastUsedAt: string | undefined;
            expiresAt: string | undefined;
            isActive: boolean;
        }[];
        count: number;
        message: string;
        error?: undefined;
    } | {
        success: boolean;
        error: string;
        message: any;
        tokens?: undefined;
        count?: undefined;
    }>;
    /**
     * Revoke API token
     */
    revokeAPIToken(params: {
        deviceId: string;
        tokenId: string;
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
     * Get API token usage statistics
     */
    getAPITokenUsage(params: {
        deviceId: string;
        tokenId: string;
    }): Promise<{
        success: boolean;
        usage: {
            requestCount: number;
            lastHour: number;
            today: number;
            lastRequest: string;
        } | null;
        message: string;
        error?: undefined;
    } | {
        success: boolean;
        error: string;
        message: any;
        usage?: undefined;
    }>;
    /**
     * Get API token configuration and limits
     */
    getAPITokenConfig(params: {
        deviceId: string;
    }): Promise<{
        success: boolean;
        config: {
            enabled: boolean;
            requiresPro: boolean;
            maxTokensPerUser: number;
            userHasFeature: boolean;
            currentTokenCount: number;
            remainingTokens: number;
        };
        availableScopes: string[];
        message: string;
        error?: undefined;
    } | {
        success: boolean;
        error: string;
        message: any;
        config?: undefined;
        availableScopes?: undefined;
    }>;
};
/**
 * Middleware to validate API token for external requests
 */
export declare function createApiTokenMiddleware(tokenManager: APITokenManager, logger: winston.Logger): (req: any, res: any, next: any) => Promise<any>;
/**
 * Helper to check scope permission
 */
export declare function requireScope(scope: TokenScope): (req: any, res: any, next: any) => any;
//# sourceMappingURL=apiTokenMethods.d.ts.map