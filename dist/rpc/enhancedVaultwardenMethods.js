/**
 * Enhanced Vaultwarden RPC Methods
 *
 * Reuses existing UserIdentityBridge and VaultwardenAutoProvisioning
 * Adds OAuth2 provider support to the existing architecture
 */
import { VaultwardenRPCMethods } from '../auth/VaultwardenRPCMethods.js';
import * as winston from 'winston';
/**
 * Enhanced RPC methods that extend existing Vaultwarden functionality
 * with OAuth2 provider support
 */
export class EnhancedVaultwardenMethods extends VaultwardenRPCMethods {
    logger;
    constructor(provisioning, userBridge, logger) {
        super(provisioning, userBridge, logger);
        this.logger = logger || winston.createLogger({
            level: 'info',
            format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
            transports: [new winston.transports.Console()]
        });
    }
    /**
     * Enhanced storeApiKey with OAuth2 provider support
     * Extends the existing JWT-based method
     */
    async storeApiKeyWithOAuth(params) {
        try {
            this.logger.info('📥 Enhanced storeApiKey called', {
                provider: params.provider,
                hasOpenSaaSJWT: !!params.opensaasJWT,
                hasGoogleToken: !!params.googleToken,
                hasGitHubToken: !!params.githubToken,
                hasMicrosoftToken: !!params.microsoftToken,
                hasAuth0Token: !!params.auth0Token,
                testEmail: params.userEmail
            });
            // Convert OAuth tokens to OpenSaaS JWT format for existing system
            const opensaasJWT = await this.convertToOpenSaaSJWT(params);
            // Use existing VaultwardenRPCMethods.storeEncryptedKey
            const storeRequest = {
                opensaasJWT,
                encryptedApiKey: params.encryptedApiKey || params.apiKey, // Use existing encryption or plaintext
                provider: params.provider,
                keyMetadata: params.keyMetadata || {
                    algorithm: 'AES-256-GCM',
                    createdAt: new Date().toISOString()
                }
            };
            // Delegate to existing implementation
            const result = await this.storeEncryptedKey(storeRequest);
            this.logger.info('✅ Enhanced storeApiKey completed', {
                success: result.success,
                keyId: result.keyId
            });
            return {
                ...result,
                enhanced: true,
                userVault: {
                    isolated: true,
                    authProvider: this.detectAuthProvider(params)
                }
            };
        }
        catch (error) {
            this.logger.error('❌ Enhanced storeApiKey failed', {
                error: error.message,
                provider: params.provider
            });
            return {
                success: false,
                error: 'ENHANCED_STORE_FAILED',
                message: error.message
            };
        }
    }
    /**
     * Enhanced getUserKey with OAuth2 support
     */
    async getUserKeyWithOAuth(params) {
        try {
            // Convert to OpenSaaS JWT format
            const opensaasJWT = await this.convertToOpenSaaSJWT(params);
            // Generate short-lived token using existing flow
            const tokenResponse = await this.getShortLivedToken({ opensaasJWT });
            if (!tokenResponse.accessToken) {
                throw new Error('Failed to get access token');
            }
            // Use existing retrieval method
            const result = await this.retrieveEncryptedKey({
                shortLivedToken: tokenResponse.accessToken,
                provider: params.provider
            });
            return {
                success: true,
                apiKey: result.encryptedApiKey, // May need decryption on client side
                provider: params.provider,
                keyMetadata: result.keyMetadata,
                enhanced: true,
                userVault: {
                    isolated: true,
                    authProvider: this.detectAuthProvider(params)
                }
            };
        }
        catch (error) {
            this.logger.error('❌ Enhanced getUserKey failed', {
                error: error.message,
                provider: params.provider
            });
            return {
                success: false,
                error: 'ENHANCED_GET_FAILED',
                message: error.message
            };
        }
    }
    /**
     * Convert various OAuth tokens to OpenSaaS JWT format
     * This allows reuse of existing UserIdentityBridge logic
     */
    async convertToOpenSaaSJWT(params) {
        // If already OpenSaaS JWT, return as-is
        if (params.opensaasJWT) {
            return params.opensaasJWT;
        }
        let userInfo = {};
        // Handle different OAuth providers
        if (params.googleToken) {
            userInfo = await this.validateGoogleToken(params.googleToken);
            userInfo.authProvider = 'google';
        }
        else if (params.githubToken) {
            userInfo = await this.validateGitHubToken(params.githubToken);
            userInfo.authProvider = 'github';
        }
        else if (params.microsoftToken) {
            userInfo = await this.validateMicrosoftToken(params.microsoftToken);
            userInfo.authProvider = 'microsoft';
        }
        else if (params.auth0Token) {
            userInfo = await this.validateAuth0Token(params.auth0Token);
            userInfo.authProvider = 'auth0';
        }
        else if (params.userEmail) {
            // Testing/admin mode
            userInfo = {
                email: params.userEmail,
                userId: `test_${params.userEmail}`,
                name: params.userEmail.split('@')[0],
                authProvider: 'test'
            };
        }
        else {
            throw new Error('No valid authentication provided');
        }
        // Create OpenSaaS-compatible JWT payload
        const jwtPayload = {
            userId: userInfo.id || userInfo.sub || `${userInfo.authProvider}_${userInfo.email}`,
            email: userInfo.email,
            organizationId: process.env.SIMPLE_RPC_ORG_ID,
            subscriptionTier: 'free', // Default tier
            monthlyTokenQuota: 100000,
            rpmLimit: 60,
            tpmLimit: 10000,
            features: ['api_key_storage'],
            iat: Math.floor(Date.now() / 1000),
            exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60), // 24 hours
            iss: 'simple-rpc-ai-backend',
            aud: 'vaultwarden'
        };
        // Create simple JWT (for testing - use proper signing in production)
        const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
        const payload = Buffer.from(JSON.stringify(jwtPayload)).toString('base64url');
        return `${header}.${payload}.`;
    }
    /**
     * Validate Google OAuth token
     */
    async validateGoogleToken(token) {
        // TODO: Implement Google token validation
        // For now, decode if it's a JWT-like token
        try {
            if (token.includes('.')) {
                const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
                return {
                    id: payload.sub,
                    email: payload.email,
                    name: payload.name,
                    picture: payload.picture
                };
            }
        }
        catch (error) {
            // If not a JWT, would need to call Google's tokeninfo endpoint
        }
        throw new Error('Google token validation not implemented - use mock data or implement Google API call');
    }
    /**
     * Validate GitHub OAuth token
     */
    async validateGitHubToken(token) {
        // TODO: Implement GitHub token validation
        // Would call: GET https://api.github.com/user with Authorization: token <token>
        throw new Error('GitHub token validation not implemented - use mock data or implement GitHub API call');
    }
    /**
     * Validate Microsoft OAuth token
     */
    async validateMicrosoftToken(token) {
        // TODO: Implement Microsoft token validation
        // Would call Microsoft Graph API
        throw new Error('Microsoft token validation not implemented - use mock data or implement Microsoft Graph call');
    }
    /**
     * Validate Auth0 token
     */
    async validateAuth0Token(token) {
        // TODO: Implement Auth0 token validation
        // Would validate JWT signature and call Auth0 userinfo endpoint
        throw new Error('Auth0 token validation not implemented - use mock data or implement Auth0 API call');
    }
    /**
     * Detect authentication provider from request
     */
    detectAuthProvider(params) {
        if (params.opensaasJWT)
            return 'opensaas';
        if (params.googleToken)
            return 'google';
        if (params.githubToken)
            return 'github';
        if (params.microsoftToken)
            return 'microsoft';
        if (params.auth0Token)
            return 'auth0';
        if (params.userEmail)
            return 'test';
        return 'unknown';
    }
    /**
     * List all available methods
     */
    getAvailableMethods() {
        return [
            // Existing methods (inherited)
            'vaultwarden.onboardUser',
            'vaultwarden.completeSetup',
            'vaultwarden.getShortLivedToken',
            'vaultwarden.storeEncryptedKey',
            'vaultwarden.retrieveEncryptedKey',
            'vaultwarden.getAccountStatus',
            // Enhanced methods (new)
            'vaultwarden.storeApiKeyWithOAuth',
            'vaultwarden.getUserKeyWithOAuth'
        ];
    }
}
export default EnhancedVaultwardenMethods;
//# sourceMappingURL=enhancedVaultwardenMethods.js.map