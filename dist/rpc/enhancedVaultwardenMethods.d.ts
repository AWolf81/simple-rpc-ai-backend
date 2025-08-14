/**
 * Enhanced Vaultwarden RPC Methods
 *
 * Reuses existing UserIdentityBridge and VaultwardenAutoProvisioning
 * Adds OAuth2 provider support to the existing architecture
 */
import { VaultwardenRPCMethods } from '../auth/VaultwardenRPCMethods.js';
import { UserIdentityBridge } from '../auth/UserIdentityBridge.js';
import { VaultwardenAutoProvisioning } from '../auth/VaultwardenAutoProvisioning.js';
import * as winston from 'winston';
export interface EnhancedStoreKeyRequest {
    opensaasJWT?: string;
    googleToken?: string;
    githubToken?: string;
    microsoftToken?: string;
    auth0Token?: string;
    userEmail?: string;
    provider: string;
    apiKey: string;
    encryptedApiKey?: string;
    keyMetadata?: {
        algorithm: string;
        keyId?: string;
        createdAt: string;
    };
}
/**
 * Enhanced RPC methods that extend existing Vaultwarden functionality
 * with OAuth2 provider support
 */
export declare class EnhancedVaultwardenMethods extends VaultwardenRPCMethods {
    private logger;
    constructor(provisioning: VaultwardenAutoProvisioning, userBridge: UserIdentityBridge, logger?: winston.Logger);
    /**
     * Enhanced storeApiKey with OAuth2 provider support
     * Extends the existing JWT-based method
     */
    storeApiKeyWithOAuth(params: EnhancedStoreKeyRequest): Promise<{
        enhanced: boolean;
        userVault: {
            isolated: boolean;
            authProvider: string;
        };
        success: boolean;
        keyId: string;
        message: string;
        error?: undefined;
    } | {
        success: boolean;
        error: string;
        message: any;
    }>;
    /**
     * Enhanced getUserKey with OAuth2 support
     */
    getUserKeyWithOAuth(params: {
        opensaasJWT?: string;
        googleToken?: string;
        githubToken?: string;
        microsoftToken?: string;
        auth0Token?: string;
        userEmail?: string;
        provider: string;
    }): Promise<{
        success: boolean;
        apiKey: string;
        provider: string;
        keyMetadata: {
            algorithm: string;
            keyId?: string;
            createdAt: string;
            provider: string;
        };
        enhanced: boolean;
        userVault: {
            isolated: boolean;
            authProvider: string;
        };
        error?: undefined;
        message?: undefined;
    } | {
        success: boolean;
        error: string;
        message: any;
        apiKey?: undefined;
        provider?: undefined;
        keyMetadata?: undefined;
        enhanced?: undefined;
        userVault?: undefined;
    }>;
    /**
     * Convert various OAuth tokens to OpenSaaS JWT format
     * This allows reuse of existing UserIdentityBridge logic
     */
    private convertToOpenSaaSJWT;
    /**
     * Validate Google OAuth token
     */
    private validateGoogleToken;
    /**
     * Validate GitHub OAuth token
     */
    private validateGitHubToken;
    /**
     * Validate Microsoft OAuth token
     */
    private validateMicrosoftToken;
    /**
     * Validate Auth0 token
     */
    private validateAuth0Token;
    /**
     * Detect authentication provider from request
     */
    private detectAuthProvider;
    /**
     * List all available methods
     */
    getAvailableMethods(): string[];
}
export default EnhancedVaultwardenMethods;
//# sourceMappingURL=enhancedVaultwardenMethods.d.ts.map