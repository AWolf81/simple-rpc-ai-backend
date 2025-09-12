/**
 * OAuth 2.0 Server Implementation using @node-oauth/express-oauth-server
 * 
 * Provides proper OAuth 2.0 server functionality for MCP Jam integration.
 * Uses RFC 6749 & RFC 6750 compliant implementation with PKCE support.
 */

import ExpressOAuthServer from '@node-oauth/express-oauth-server';
import * as OAuth2Server from '@node-oauth/oauth2-server';
import { randomPKCECodeVerifier, calculatePKCECodeChallenge } from 'openid-client';
import crypto from 'crypto';
import { createSessionStorage, SessionStorage } from './session-storage.js';
import { Request, Response } from 'express';
import { HandlebarsTemplateEngine, HandlebarsTemplateConfig, HandlebarsTemplateData, HANDLEBARS_PROVIDER_ICONS } from './handlebars-template-engine.js';
import winston from 'winston';

// Session storage instance (will be set during initialization)
let sessionStorage: SessionStorage;

// Template engine instance for OAuth pages
let templateEngine: HandlebarsTemplateEngine;

// Logger instance for structured logging
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ],
  defaultMeta: { service: 'oauth-middleware' }
});

// Identity Provider Configuration
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

// Default identity providers configuration
const getIdentityProviders = (): Record<string, IdentityProviderConfig> => {
  const baseUrl = process.env.OAUTH_BASE_URL || `http://localhost:${process.env.PORT || 8000}`;
  
  return {
    google: {
      type: 'oidc',
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      discoveryUrl: 'https://accounts.google.com/.well-known/openid-configuration',
      scopes: ['openid', 'email', 'profile'],
      redirectUri: `${baseUrl}/callback/google`
    },
    github: {
      type: 'oauth2',
      clientId: process.env.GITHUB_CLIENT_ID || '',
      clientSecret: process.env.GITHUB_CLIENT_SECRET || '',
      authUrl: 'https://github.com/login/oauth/authorize',
      tokenUrl: 'https://github.com/login/oauth/access_token',
      userInfoUrl: 'https://api.github.com/user',
      scopes: ['read:user', 'user:email'],
      redirectUri: `${baseUrl}/callback/github`
    },
    microsoft: {
      type: 'oidc',
      clientId: process.env.MICROSOFT_CLIENT_ID || '',
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET || '',
      discoveryUrl: 'https://login.microsoftonline.com/common/v2.0/.well-known/openid-configuration',
      scopes: ['openid', 'email', 'profile'],
      redirectUri: `${baseUrl}/callback/microsoft`
    }
  };
};

// Default MCP client for testing
const getDefaultClient = (): OAuth2Server.Client => ({
  id: process.env.MCP_CLIENT_ID || 'mcp-client',
  clientSecret: process.env.MCP_CLIENT_SECRET || crypto.randomBytes(32).toString('hex'),
  grants: ['authorization_code', 'refresh_token'],
  redirectUris: process.env.MCP_REDIRECT_URIS 
    ? process.env.MCP_REDIRECT_URIS.split(',').map(uri => uri.trim())
    : ['http://localhost:4000/oauth/callback/debug'],
  accessTokenLifetime: 3600, // 1 hour
  refreshTokenLifetime: 86400 // 24 hours
});

// Default user for OAuth flow (Google OAuth integration would replace this)
const defaultUser: OAuth2Server.User = {
  id: 'user@example.com',
  username: 'user@example.com'
};

// OIDC configuration cache to avoid repeated discovery
const oidcConfigs: Record<string, any> = {};

/**
 * Get or create OIDC configuration for a provider
 */
async function getOidcConfig(providerName: string, config: IdentityProviderConfig): Promise<any> {
  if (oidcConfigs[providerName]) {
    return oidcConfigs[providerName];
  }

  if (config.type !== 'oidc' || !config.discoveryUrl) {
    throw new Error(`Provider ${providerName} is not an OIDC provider`);
  }

  logger.info('Discovering OIDC configuration', { provider: providerName });
  
  // Use direct HTTP call to discovery endpoint instead of openid-client discovery
  const discoveryResponse = await fetch(config.discoveryUrl);
  if (!discoveryResponse.ok) {
    throw new Error(`Failed to fetch OIDC configuration: ${discoveryResponse.status}`);
  }
  
  const configuration = await discoveryResponse.json() as any;

  oidcConfigs[providerName] = {
    configuration,
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    redirectUri: config.redirectUri
  };
  
  logger.info('OIDC configuration cached', { 
    provider: providerName, 
    authEndpoint: configuration.authorization_endpoint 
  });
  
  return oidcConfigs[providerName];
}

/**
 * Normalize user profile from different providers
 */
function normalizeUserProfile(provider: string, profile: any): { id: string; email: string; name: string } {
  switch (provider) {
    case 'google':
      return {
        id: profile.sub || profile.id,
        email: profile.email,
        name: profile.name || profile.given_name
      };
    case 'github':
      return {
        id: profile.id.toString(),
        email: profile.email,
        name: profile.name || profile.login
      };
    case 'microsoft':
      return {
        id: profile.sub || profile.oid,
        email: profile.email || profile.preferred_username,
        name: profile.name
      };
    default:
      return {
        id: profile.sub || profile.id || profile.user_id,
        email: profile.email || profile.preferred_username,
        name: profile.name || profile.display_name || profile.username
      };
  }
}

/**
 * Create OAuth 2.0 Model Implementation with Session Storage
 * Uses the configured session storage backend for persistence
 */
function createOAuthModel(storage: SessionStorage, adminUsers: string[] = []) {
  return {
    // Client methods
    async getClient(clientId: string, clientSecret?: string) {
      logger.debug('OAuth client lookup', { clientId, hasSecret: clientSecret !== undefined && clientSecret !== '' });
      const client = await storage.getClient(clientId);
      
      if (!client) {
        logger.warn('OAuth client not found', { clientId });
        return null;
      }
      
      // Handle different authentication methods:
      // 1. PKCE flow: clientSecret is undefined or empty - skip secret validation
      // 2. Client credentials flow: clientSecret must match
      const isPKCE = !clientSecret || clientSecret === '';
      
      if (!isPKCE && client.clientSecret !== clientSecret) {
        logger.warn('OAuth invalid client secret', { clientId });
        console.log(`   Expected: ${client.clientSecret.substring(0, 20)}... (length: ${client.clientSecret.length})`);
        console.log(`   Received: ${clientSecret?.substring(0, 20)}... (length: ${clientSecret?.length})`);
        return null;
      }
      
      console.log(`✅ OAuth: Client ${clientId} found (PKCE: ${isPKCE})`);
      return client;
    },

    // Authorization code methods
    async saveAuthorizationCode(code: any, client: any, user: any) {
      console.log(`💾 OAuth: Saving authorization code for client ${client.id}, user ${user.id}`);
      
      const authCode = {
        authorizationCode: code.authorizationCode,
        expiresAt: code.expiresAt,
        redirectUri: code.redirectUri,
        scope: code.scope,
        client,
        user,
        // PKCE support
        codeChallenge: code.codeChallenge,
        codeChallengeMethod: code.codeChallengeMethod
      };
      
      await storage.setAuthCode(code.authorizationCode, authCode);
      console.log(`✅ OAuth: Authorization code saved: ${code.authorizationCode.substring(0, 10)}...`);
      
      return authCode;
    },

    async getAuthorizationCode(authorizationCode: string) {
      console.log(`🔍 OAuth: Getting authorization code ${authorizationCode.substring(0, 10)}...`);
      
      const code = await storage.getAuthCode(authorizationCode);
      if (!code) {
        console.log(`❌ OAuth: Authorization code not found`);
        return null;
      }
      
      // Convert expiresAt string back to Date object (required by OAuth library)
      if (code.expiresAt && typeof code.expiresAt === 'string') {
        code.expiresAt = new Date(code.expiresAt);
      }
      
      console.log(`✅ OAuth: Authorization code found`);
      return code;
    },

    async revokeAuthorizationCode(authorizationCode: any) {
      console.log(`🗑️ OAuth: Revoking authorization code ${authorizationCode.authorizationCode.substring(0, 10)}...`);
      
      const deleted = await storage.deleteAuthCode(authorizationCode.authorizationCode);
      console.log(`${deleted ? '✅' : '❌'} OAuth: Authorization code revoked`);
      
      return deleted;
    },

    // Access token methods
    async saveToken(token: any, client: any, user: any) {
      console.log(`💾 OAuth: Saving access token for client ${client.id}, user ${user.id}`);
      
      const tokenWithMeta = {
        ...token,
        client,
        user
      };
      
      await storage.setToken(token.accessToken, tokenWithMeta);
      
      if (token.refreshToken) {
        await storage.setToken(token.refreshToken, tokenWithMeta);
      }
      
      console.log(`✅ OAuth: Token saved: ${token.accessToken.substring(0, 10)}...`);
      return tokenWithMeta;
    },

    async getAccessToken(accessToken: string) {
      console.log(`🔍 OAuth: Getting access token ${accessToken.substring(0, 10)}...`);
      
      const token = await storage.getToken(accessToken);
      if (!token) {
        console.log(`❌ OAuth: Access token not found`);
        return null;
      }
      
      console.log(`✅ OAuth: Access token found`);
      return token;
    },

    // Scope validation with admin user support
    async validateScope(user: any, client: any, scope?: any) {
      console.log(`🔍 OAuth: Validating scope for user ${user.id}, client ${client.id}`, scope, typeof scope);
      
      // Parse requested scopes from the OAuth flow - handle different input types
      let requestedScopes: string[] = [];
      if (scope) {
        if (typeof scope === 'string') {
          requestedScopes = scope.split(' ');
        } else if (Array.isArray(scope)) {
          requestedScopes = scope;
        } else if (scope.split && typeof scope.split === 'function') {
          requestedScopes = scope.split(' ');
        } else {
          console.warn(`⚠️ OAuth: Unexpected scope type:`, typeof scope, scope);
          requestedScopes = [];
        }
      }
      
      // Check if user is an admin (by email or userId)
      const userEmail = user?.email;
      const userId = user?.id || user?.sub;
      const isAdminUser = adminUsers.includes(userEmail || '') || adminUsers.includes(userId || '');
      
      console.log(`🔐 OAuth: Admin user check - Email: ${userEmail}, IsAdmin: ${isAdminUser}`);
      
      // Default scopes for MCP access
      const defaultScopes = ['mcp', 'mcp:list', 'mcp:call'];
      
      // Admin scopes granted automatically to admin users
      const adminScopes = ['admin', 'mcp:admin'];
      
      let validatedScopes: string[];
      
      if (requestedScopes.length === 0) {
        // Best Practice: Empty scopes = defaults + admin (if admin user)
        validatedScopes = [...defaultScopes];
        if (isAdminUser) {
          validatedScopes.push(...adminScopes);
          console.log(`🔐 OAuth: Admin user detected - granting admin scopes automatically`);
        }
      } else {
        // Best Practice: Explicit scopes = validate and filter based on permissions
        validatedScopes = [...requestedScopes];
        
        // Always ensure basic MCP scopes for valid users
        for (const scope of defaultScopes) {
          if (!validatedScopes.includes(scope)) {
            validatedScopes.push(scope);
          }
        }
        
        // Auto-grant admin scopes to admin users (even if not requested)
        if (isAdminUser) {
          for (const scope of adminScopes) {
            if (!validatedScopes.includes(scope)) {
              validatedScopes.push(scope);
            }
          }
          console.log(`🔐 OAuth: Admin user - automatically added admin scopes`);
        } else {
          // Remove admin scopes from non-admin users
          validatedScopes = validatedScopes.filter(s => !adminScopes.includes(s));
          if (requestedScopes.some(s => adminScopes.includes(s))) {
            console.log(`⚠️  OAuth: Non-admin user requested admin scopes - filtered out`);
          }
        }
      }
      
      console.log(`✅ OAuth: Final validated scopes:`, validatedScopes);
      return validatedScopes;
    }
  };
}

/**
 * Create OAuth 2.0 server instance with configurable session storage and templating
 */
export function createOAuthServer(storageConfig: {
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
} = { type: 'memory' }, adminUsers: string[] = [], templateConfig?: HandlebarsTemplateConfig) {
  logger.info('Creating OAuth 2.0 server', { storageType: storageConfig.type });
  
  // Initialize session storage - ensure it's the same instance used globally
  if (!sessionStorage) {
    sessionStorage = createSessionStorage(storageConfig);
  }
  
  // Initialize template engine with provided configuration
  if (!templateEngine) {
    templateEngine = new HandlebarsTemplateEngine(templateConfig);
    console.log(`✅ OAuth Handlebars template engine initialized with ${templateConfig ? 'custom' : 'default'} configuration`);
  }
  
  // Create OAuth model with session storage and admin users
  const oauthModel = createOAuthModel(sessionStorage, adminUsers);
  
  const oauth = new ExpressOAuthServer({
    model: oauthModel,
    requireClientAuthentication: {
      authorization_code: false  // PKCE doesn't require client secret
    },
    allowBearerTokensInQueryString: true,
    allowExtendedTokenAttributes: true,
    accessTokenLifetime: 3600,      // 1 hour
    refreshTokenLifetime: 86400,    // 24 hours
    authorizationCodeLifetime: 600, // 10 minutes
    useErrorHandler: false,
    continueMiddleware: false
  });
  
  logger.info('OAuth 2.0 server created', { storageType: storageConfig.type });
  return { oauth, storage: sessionStorage };
}

/**
 * Register a new OAuth client
 */
export async function registerClient(
  clientData: {
    id: string;
    name: string; 
    redirectUris: string[];
    grants?: string[];
  },
  storage?: SessionStorage
): Promise<OAuth2Server.Client> {
  console.log(`📝 Registering OAuth client: ${clientData.id}`);
  
  const client: OAuth2Server.Client = {
    id: clientData.id,
    clientSecret: crypto.randomBytes(32).toString('hex'),
    grants: clientData.grants || ['authorization_code', 'refresh_token'],
    redirectUris: clientData.redirectUris,
    accessTokenLifetime: 3600,
    refreshTokenLifetime: 86400
  };
  
  // Use provided storage or fall back to global sessionStorage
  const storageToUse = storage || sessionStorage;
  await storageToUse.setClient(client.id, client);
  console.log(`✅ Client registered: ${client.id}`);
  
  return client;
}

/**
 * Initialize OAuth server with default client and user
 */
export async function initializeOAuthServer() {
  if (!sessionStorage) {
    throw new Error('OAuth server not initialized. Call createOAuthServer first.');
  }
  
  await sessionStorage.initialize();
  
  // Add default client and user
  const defaultClient = getDefaultClient();
  await sessionStorage.setClient(defaultClient.id, defaultClient);
  await sessionStorage.setUser(defaultUser.id, defaultUser);
  
  console.log(`✅ OAuth server initialized with default client and user`);
}

/**
 * Get the current session storage instance
 */
export function getSessionStorage() {
  return sessionStorage;
}

/**
 * Get OAuth server statistics (for debugging)
 */
export function getOAuthStats() {
  return {
    storageType: sessionStorage ? sessionStorage.constructor.name : 'none',
    initialized: !!sessionStorage
  };
}

/**
 * Clear all OAuth data (for testing)
 */
export async function clearOAuthData() {
  if (!sessionStorage) {
    console.warn(`⚠️ OAuth server not initialized`);
    return;
  }
  
  console.log(`🧹 Clearing OAuth data...`);
  await sessionStorage.clear();
  
  // Re-add default client and user
  const defaultClient = getDefaultClient();
  await sessionStorage.setClient(defaultClient.id, defaultClient);
  await sessionStorage.setUser(defaultUser.id, defaultUser);
  
  console.log(`✅ OAuth data cleared and defaults restored`);
}

/**
 * Close OAuth server and clean up resources
 */
export async function closeOAuthServer() {
  if (sessionStorage) {
    await sessionStorage.close();
    console.log(`✅ OAuth server closed`);
  }
}

/**
 * Handle identity provider login initiation
 */
export async function handleProviderLogin(req: Request, res: Response) {
  const provider = req.params.provider;
  const identityProviders = getIdentityProviders();
  const config = identityProviders[provider];

  if (!config) {
    return res.status(400).json({ 
      error: 'invalid_provider',
      error_description: `Unknown provider: ${provider}`,
      supported_providers: Object.keys(identityProviders)
    });
  }

  if (!config.clientId || !config.clientSecret) {
    return res.status(500).json({
      error: 'provider_not_configured',
      error_description: `Provider ${provider} is not properly configured. Missing client credentials.`
    });
  }

  try {
    // Store OAuth state for security
    const state = crypto.randomBytes(32).toString('hex');
    const codeVerifier = randomPKCECodeVerifier();
    const codeChallenge = await calculatePKCECodeChallenge(codeVerifier);
    
    // Extract original OAuth parameters from redirect_uri if provided
    // When user clicks on a provider from /login page, the original OAuth params are in redirect_uri
    let originalQuery = {};
    const redirectUri = req.query.redirect_uri as string;
    if (redirectUri) {
      try {
        // Parse the redirect_uri to extract original OAuth parameters
        const urlParts = redirectUri.split('?');
        if (urlParts.length > 1) {
          const searchParams = new URLSearchParams(urlParts[1]);
          originalQuery = Object.fromEntries(searchParams.entries());
        }
      } catch (error) {
        console.warn(`⚠️ Failed to parse redirect_uri: ${redirectUri}`);
      }
    } else {
      // Fallback: if no redirect_uri, use current query params (direct provider access)
      originalQuery = { ...req.query };
    }

    // Store state and PKCE data in session/storage for later verification
    await sessionStorage.setItem(`oauth_state_${state}`, JSON.stringify({
      provider,
      codeVerifier,
      originalQuery // Store original OAuth authorize params
    }), 600); // 10 minutes

    if (config.type === 'oidc') {
      const oidcConfig = await getOidcConfig(provider, config);
      const authUrl = new URL(oidcConfig.configuration.authorization_endpoint);
      authUrl.searchParams.set('client_id', config.clientId);
      authUrl.searchParams.set('redirect_uri', config.redirectUri!);
      authUrl.searchParams.set('scope', config.scopes.join(' '));
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('state', state);
      authUrl.searchParams.set('code_challenge', codeChallenge);
      authUrl.searchParams.set('code_challenge_method', 'S256');
      
      console.log(`🚀 Redirecting to ${provider} OIDC authorization...`);
      res.redirect(authUrl.toString());
      
    } else {
      // OAuth2-only flow (GitHub, etc.)
      const authUrl = new URL(config.authUrl!);
      authUrl.searchParams.set('client_id', config.clientId);
      authUrl.searchParams.set('redirect_uri', config.redirectUri!);
      authUrl.searchParams.set('scope', config.scopes.join(' '));
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('state', state);
      
      console.log(`🚀 Redirecting to ${provider} OAuth2 authorization...`);
      res.redirect(authUrl.toString());
    }
    
  } catch (error) {
    logger.error('Error initiating provider login', { provider, error: error.message, stack: error.stack });
    res.status(500).json({
      error: 'authorization_error',
      error_description: `Failed to initiate ${provider} login`
    });
  }
}

/**
 * Handle identity provider callback
 */
export async function handleProviderCallback(req: Request, res: Response) {
  const provider = req.params.provider;
  const { code, state, error } = req.query;

  if (error) {
    logger.error('OAuth error from provider', { provider, error });
    return res.status(400).json({
      error: 'authorization_denied',
      error_description: `Authorization denied by ${provider}: ${error}`
    });
  }

  if (!code || !state) {
    return res.status(400).json({
      error: 'invalid_request',
      error_description: 'Missing authorization code or state parameter'
    });
  }

  try {
    // Retrieve and verify state
    const stateData = await sessionStorage.getItem(`oauth_state_${state}`);
    if (!stateData) {
      return res.status(400).json({
        error: 'invalid_state',
        error_description: 'Invalid or expired state parameter'
      });
    }

    const { provider: storedProvider, codeVerifier, originalQuery } = JSON.parse(stateData);
    
    if (storedProvider !== provider) {
      return res.status(400).json({
        error: 'state_mismatch',
        error_description: 'State parameter provider mismatch'
      });
    }

    const identityProviders = getIdentityProviders();
    const config = identityProviders[provider];
    
    let userProfile: Record<string, any>;

    if (config.type === 'oidc') {
      // OIDC flow - use direct token exchange
      const oidcConfig = await getOidcConfig(provider, config);
      const tokenResponse = await fetch(oidcConfig.configuration.token_endpoint, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: config.clientId,
          client_secret: config.clientSecret,
          code: code as string,
          redirect_uri: config.redirectUri!,
          code_verifier: codeVerifier
        })
      });
      
      const tokens = await tokenResponse.json() as any;
      
      if (!tokens.access_token) {
        throw new Error(`No access token received from ${provider}`);
      }
      
      // Fetch user profile using userinfo endpoint
      const profileResponse = await fetch(oidcConfig.configuration.userinfo_endpoint, {
        headers: { Authorization: `Bearer ${tokens.access_token}` }
      });
      
      userProfile = await profileResponse.json() as Record<string, any>;
      
    } else {
      // OAuth2-only flow
      const tokenResponse = await fetch(config.tokenUrl!, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        },
        body: new URLSearchParams({
          client_id: config.clientId,
          client_secret: config.clientSecret,
          code: code as string,
          redirect_uri: config.redirectUri!,
          grant_type: 'authorization_code'
        })
      });
      
      const tokens = await tokenResponse.json() as any;
      
      if (!tokens.access_token) {
        throw new Error(`No access token received from ${provider}`);
      }
      
      // Fetch user profile
      const profileResponse = await fetch(config.userInfoUrl!, {
        headers: { Authorization: `Bearer ${tokens.access_token}` }
      });
      
      userProfile = await profileResponse.json() as Record<string, any>;
    }

    // Normalize user profile
    const user = normalizeUserProfile(provider, userProfile);
    
    // Store user in session storage
    const userId = `${provider}:${user.id}`;
    await sessionStorage.setUser(userId, {
      id: userId,
      username: user.email,
      email: user.email,
      name: user.name,
      provider
    });

    // Clean up state
    await sessionStorage.deleteItem(`oauth_state_${state}`);

    console.log(`✅ User authenticated via ${provider}: ${user.email}`);

    // Redirect back to continue OAuth authorize flow
    const baseUrl = process.env.OAUTH_BASE_URL || `http://localhost:${process.env.PORT || 8000}`;
    const resumeUrl = new URL('/oauth/authorize', baseUrl);
    Object.entries(originalQuery).forEach(([key, value]) => {
      if (typeof value === 'string') {
        resumeUrl.searchParams.set(key, value);
      }
    });
    
    // Set session marker so OAuth authorize can find authenticated user
    resumeUrl.searchParams.set('authenticated_user', userId);
    
    res.redirect(resumeUrl.toString());

  } catch (error) {
    logger.error('Error processing provider callback', { provider, error: error.message, stack: error.stack });
    res.status(500).json({
      error: 'callback_error',
      error_description: `Failed to process ${provider} callback`
    });
  }
}

/**
 * Create authentication handler for OAuth authorize endpoint
 */
export function createAuthenticateHandler() {
  return {
    handle: async (req: Request & { query: any; session?: any }) => {
      // Check if user was just authenticated via federated login
      const authenticatedUser = req.query.authenticated_user;
      if (authenticatedUser) {
        const user = await sessionStorage.getUser(authenticatedUser);
        if (user) {
          console.log(`🔐 OAuth: User authenticated via federated login: ${user.email || user.username}`);
          return user;
        }
      }

      // Check session for existing authentication
      if (req.session?.userId) {
        const user = await sessionStorage.getUser(req.session.userId);
        if (user) {
          console.log(`🔐 OAuth: User authenticated via session: ${user.email || user.username}`);
          return user;
        }
      }

      // No authentication found - return false to trigger OAuth2 error handling
      console.log(`❌ OAuth: No authenticated user found`);
      return false;
    }
  };
}

/**
 * Handle provider selection page using Handlebars templates
 */
export async function handleProviderSelection(req: Request, res: Response) {
  const identityProviders = getIdentityProviders();
  const availableProviders = Object.keys(identityProviders).filter(provider => {
    const config = identityProviders[provider];
    return config.clientId && config.clientSecret;
  });

  const baseUrl = process.env.OAUTH_BASE_URL || `http://localhost:${process.env.PORT || 8000}`;
  
  // Preserve redirect_uri parameter for provider login links
  const redirectUri = req.query.redirect_uri as string;
  const redirectParam = redirectUri ? `?redirect_uri=${encodeURIComponent(redirectUri)}` : '';
  
  // Prepare template data
  const templateData: HandlebarsTemplateData = {
    providers: availableProviders.map(provider => ({
      name: provider,
      displayName: provider.charAt(0).toUpperCase() + provider.slice(1),
      loginUrl: `${baseUrl}/login/${provider}${redirectParam}`,
      icon: HANDLEBARS_PROVIDER_ICONS[provider] || '🔑'
    })),
    context: {
      redirectUri,
      scopes: req.query.scope ? (req.query.scope as string).split(' ') : undefined,
      clientId: req.query.client_id as string
    }
  };
  
  // Use Handlebars template engine to render the page
  if (!templateEngine) {
    // Fallback to default template engine if not initialized
    templateEngine = new HandlebarsTemplateEngine();
  }
  
  try {
    const html = await templateEngine.render('oauth/login', templateData);
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (error) {
    logger.error('Template rendering error', { error: error.message, stack: error.stack });
    res.status(500).send('Template rendering error');
  }
}

/**
 * Configure OAuth template engine
 */
export function configureOAuthTemplates(config: HandlebarsTemplateConfig) {
  if (!templateEngine) {
    templateEngine = new HandlebarsTemplateEngine(config);
  } else {
    // Update existing configuration
    templateEngine.updateConfig(config);
  }
  console.log(`✅ OAuth Handlebars templates configured with custom branding`);
}

/**
 * Get the current template engine instance
 */
export function getTemplateEngine() {
  return templateEngine;
}

export { ExpressOAuthServer, getIdentityProviders, HandlebarsTemplateConfig, HandlebarsTemplateData, createOAuthModel, normalizeUserProfile };