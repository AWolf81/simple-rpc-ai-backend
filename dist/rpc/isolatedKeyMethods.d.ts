/**
 * Isolated Vaultwarden Key Methods with Auto-Provisioning
 *
 * RPC methods that automatically provision isolated Vaultwarden users
 * Supports OpenSaaS + OAuth2 providers with true vault isolation
 */
import { VaultwardenUserProvisioning, UserIdentity } from '../auth/VaultwardenUserProvisioning.js';
import * as winston from 'winston';
export interface IsolatedKeyMethodsContext {
    userProvisioning: VaultwardenUserProvisioning;
    logger: winston.Logger;
}
/**
 * Create RPC methods with automatic user provisioning
 */
export declare function createIsolatedKeyMethods(context: IsolatedKeyMethodsContext): {
    /**
     * Store API key with automatic user provisioning
     *
     * This method:
     * 1. Extracts user identity from JWT/OAuth token
     * 2. Auto-provisions Vaultwarden user if needed
     * 3. Stores API key in user's isolated vault
     */
    storeUserKey(params: {
        opensaasJWT?: string;
        oauthToken?: string;
        userEmail?: string;
        provider: string;
        apiKey: string;
        keyName?: string;
        description?: string;
    }): Promise<{
        success: boolean;
        keyId: any;
        message: string;
        userVault: {
            email: any;
            isolated: boolean;
            provider: any;
        };
        error?: undefined;
    } | {
        success: boolean;
        error: string;
        message: any;
        keyId?: undefined;
        userVault?: undefined;
    }>;
    /**
     * Retrieve API key from user's isolated vault
     */
    getUserKey(params: {
        opensaasJWT?: string;
        oauthToken?: string;
        userEmail?: string;
        provider: string;
        keyId?: string;
        keyName?: string;
    }): Promise<{
        success: boolean;
        apiKey: string;
        provider: string;
        userVault: {
            email: any;
            isolated: boolean;
        };
        error?: undefined;
        message?: undefined;
    } | {
        success: boolean;
        error: string;
        message: any;
        apiKey?: undefined;
        provider?: undefined;
        userVault?: undefined;
    }>;
    /**
     * List user's providers (from their isolated vault)
     */
    getUserProviders(params: {
        opensaasJWT?: string;
        oauthToken?: string;
        userEmail?: string;
    }): Promise<{
        success: boolean;
        providers: any;
        userVault: {
            email: any;
            isolated: boolean;
        };
        error?: undefined;
        message?: undefined;
    } | {
        success: boolean;
        error: string;
        message: any;
        providers?: undefined;
        userVault?: undefined;
    }>;
    /**
     * Delete API key from user's isolated vault
     */
    deleteUserKey(params: {
        opensaasJWT?: string;
        oauthToken?: string;
        userEmail?: string;
        provider?: string;
        keyId?: string;
        keyName?: string;
    }): Promise<{
        success: boolean;
        deletedCount: number;
        message: string;
        error?: undefined;
    } | {
        success: boolean;
        error: string;
        message: any;
        deletedCount?: undefined;
    }>;
    /**
     * Get user account info and vault status
     */
    getUserVaultInfo(params: {
        opensaasJWT?: string;
        oauthToken?: string;
        userEmail?: string;
    }): Promise<{
        success: boolean;
        userVault: {
            email: any;
            vaultUserId: any;
            isolated: boolean;
            createdAt: any;
            lastAccessAt: any;
            authProvider: any;
            organizationId: any;
        };
        error?: undefined;
        message?: undefined;
    } | {
        success: boolean;
        error: string;
        message: any;
        userVault?: undefined;
    }>;
    /**
     * Extract user identity from various auth sources
     */
    extractUserIdentity(params: any): Promise<UserIdentity>;
    /**
     * Decode JWT token (simplified - use proper JWT library in production)
     */
    decodeJWT(jwt: string): any;
    /**
     * Validate OAuth token with provider
     */
    validateOAuthToken(token: string): Promise<any>;
};
export default createIsolatedKeyMethods;
//# sourceMappingURL=isolatedKeyMethods.d.ts.map