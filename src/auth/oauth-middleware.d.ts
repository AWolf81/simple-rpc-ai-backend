/**
 * OAuth 2.0 Server Implementation using @node-oauth/express-oauth-server
 *
 * Provides proper OAuth 2.0 server functionality for MCP Jam integration.
 * Uses RFC 6749 & RFC 6750 compliant implementation with PKCE support.
 */
import ExpressOAuthServer from '@node-oauth/express-oauth-server';
import * as OAuth2Server from '@node-oauth/oauth2-server';
import { SessionStorage } from './session-storage.js';
import { Request, Response } from 'express';
import { HandlebarsTemplateEngine, HandlebarsTemplateConfig, HandlebarsTemplateData } from './handlebars-template-engine.js';
interface IdentityProviderConfig {
    type: 'oidc' | 'oauth2';
    clientId: string;
    clientSecret: string;
    discoveryUrl?: string;
    authUrl?: string;
    tokenUrl?: string;
    userInfoUrl?: string;
    scopes: string[];
    redirectUri?: string;
}
declare const getIdentityProviders: () => Record<string, IdentityProviderConfig>;
/**
 * Normalize user profile from different providers
 */
declare function normalizeUserProfile(provider: string, profile: any): {
    id: string;
    email: string;
    name: string;
};
/**
 * Create OAuth 2.0 Model Implementation with Session Storage
 * Uses the configured session storage backend for persistence
 */
declare function createOAuthModel(storage: SessionStorage, adminUsers?: string[]): {
    getClient(clientId: string, clientSecret?: string): Promise<OAuth2Server.Client | null>;
    saveAuthorizationCode(code: any, client: any, user: any): Promise<{
        authorizationCode: any;
        expiresAt: any;
        redirectUri: any;
        scope: any;
        client: any;
        user: any;
        codeChallenge: any;
        codeChallengeMethod: any;
    }>;
    getAuthorizationCode(authorizationCode: string): Promise<any>;
    revokeAuthorizationCode(authorizationCode: any): Promise<boolean>;
    saveToken(token: any, client: any, user: any): Promise<any>;
    getAccessToken(accessToken: string): Promise<OAuth2Server.Token | null>;
    validateScope(user: any, client: any, scope?: any): Promise<string[]>;
};
/**
 * Create OAuth 2.0 server instance with configurable session storage and templating
 */
export declare function createOAuthServer(storageConfig?: {
    type: 'memory' | 'file' | 'redis';
    filePath?: string;
    redis?: {
        host?: string;
        port?: number;
        password?: string;
        db?: number;
        keyPrefix?: string;
        instance?: any;
    };
}, adminUsers?: string[], templateConfig?: HandlebarsTemplateConfig): {
    oauth: ExpressOAuthServer;
    storage: SessionStorage;
};
/**
 * Register a new OAuth client
 */
export declare function registerClient(clientData: {
    id: string;
    name: string;
    redirectUris: string[];
    grants?: string[];
}, storage?: SessionStorage): Promise<OAuth2Server.Client>;
/**
 * Initialize OAuth server with default client and user
 */
export declare function initializeOAuthServer(): Promise<void>;
/**
 * Get the current session storage instance
 */
export declare function getSessionStorage(): SessionStorage;
/**
 * Get OAuth server statistics (for debugging)
 */
export declare function getOAuthStats(): {
    storageType: string;
    initialized: boolean;
};
/**
 * Clear all OAuth data (for testing)
 */
export declare function clearOAuthData(): Promise<void>;
/**
 * Close OAuth server and clean up resources
 */
export declare function closeOAuthServer(): Promise<void>;
/**
 * Handle identity provider login initiation
 */
export declare function handleProviderLogin(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
/**
 * Handle identity provider callback
 */
export declare function handleProviderCallback(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
/**
 * Create authentication handler for OAuth authorize endpoint
 */
export declare function createAuthenticateHandler(): {
    handle: (req: Request & {
        query: any;
        session?: any;
    }) => Promise<false | OAuth2Server.User>;
};
/**
 * Handle provider selection page using Handlebars templates
 */
export declare function handleProviderSelection(req: Request, res: Response): Promise<void>;
/**
 * Configure OAuth template engine
 */
export declare function configureOAuthTemplates(config: HandlebarsTemplateConfig): void;
/**
 * Get the current template engine instance
 */
export declare function getTemplateEngine(): HandlebarsTemplateEngine;
export { ExpressOAuthServer, getIdentityProviders, HandlebarsTemplateConfig, HandlebarsTemplateData, createOAuthModel, normalizeUserProfile };
//# sourceMappingURL=oauth-middleware.d.ts.map