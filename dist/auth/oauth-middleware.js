/**
 * OAuth2 Middleware for AI Server
 *
 * Provides easy OAuth2 integration with Google, GitHub, and custom providers
 * for MCP authentication with minimal configuration.
 */
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
/**
 * Built-in OAuth provider configurations
 */
const OAUTH_PROVIDERS = {
    google: {
        authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
        tokenUrl: 'https://oauth2.googleapis.com/token',
        userInfoUrl: 'https://www.googleapis.com/oauth2/v1/userinfo',
        defaultScopes: ['openid', 'email', 'profile']
    },
    github: {
        authUrl: 'https://github.com/login/oauth/authorize',
        tokenUrl: 'https://github.com/login/oauth/access_token',
        userInfoUrl: 'https://api.github.com/user',
        defaultScopes: ['user:email']
    }
};
/**
 * Encrypted Token Storage for OAuth tokens
 */
class EncryptedTokenStorage {
    tokens = new Map();
    encryptionKey;
    storagePath;
    constructor(encryptionKey, storagePath) {
        this.encryptionKey = encryptionKey || crypto.randomBytes(32).toString('hex');
        this.storagePath = storagePath || path.join(process.cwd(), '.oauth-tokens.encrypted');
        if (!encryptionKey) {
            console.log('⚠️ Using generated encryption key for OAuth tokens. Set encryptionKey for production.');
        }
        this.loadTokens();
    }
    encrypt(data) {
        // 🚨 DEBUG MODE: Encryption disabled for testing
        console.log('🐛 DEBUG: Token encryption disabled - storing plaintext');
        console.log('🐛 DEBUG: Data being stored:', JSON.stringify(data, null, 2));
        return {
            plaintext: JSON.stringify(data),
            debug: true
        };
    }
    decrypt(encryptedData) {
        // 🚨 DEBUG MODE: Check if it's plaintext debug data first
        if (encryptedData.debug && encryptedData.plaintext) {
            console.log('🐛 DEBUG: Reading plaintext token data');
            const data = JSON.parse(encryptedData.plaintext);
            console.log('🐛 DEBUG: Data loaded:', Object.keys(data));
            return data;
        }
        // Otherwise try normal decryption
        try {
            const algorithm = 'aes-256-gcm';
            const key = Buffer.from(this.encryptionKey, 'hex');
            const iv = Buffer.from(encryptedData.iv, 'hex');
            const decipher = crypto.createDecipheriv(algorithm, key, iv);
            decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));
            let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            return JSON.parse(decrypted);
        }
        catch (error) {
            console.error('❌ OAuth token decryption failed:', error.message);
            throw error;
        }
    }
    loadTokens() {
        try {
            if (fs.existsSync(this.storagePath)) {
                const encryptedData = JSON.parse(fs.readFileSync(this.storagePath, 'utf8'));
                if (!encryptedData.iv || !encryptedData.authTag) {
                    console.log('🚨 Old token file format detected. Deleting and starting fresh.');
                    fs.unlinkSync(this.storagePath);
                    this.tokens = new Map();
                    return;
                }
                const tokenData = this.decrypt(encryptedData);
                const now = Date.now();
                let validCount = 0;
                let expiredCount = 0;
                for (const [token, info] of Object.entries(tokenData)) {
                    const tokenInfo = info;
                    const tokenAge = now - tokenInfo.created_at;
                    const isExpired = tokenAge > (tokenInfo.expires_in * 1000);
                    if (!isExpired) {
                        this.tokens.set(token, tokenInfo);
                        validCount++;
                    }
                    else {
                        expiredCount++;
                    }
                }
                console.log(`📂 Loaded ${validCount} valid OAuth tokens from encrypted storage`);
                if (expiredCount > 0) {
                    console.log(`🧹 Filtered out ${expiredCount} expired tokens`);
                    this.saveTokens();
                }
            }
        }
        catch (error) {
            console.error('❌ Could not load OAuth tokens:', error.message);
            this.tokens = new Map();
        }
    }
    saveTokens() {
        try {
            const tokenData = Object.fromEntries(this.tokens);
            const encryptedData = this.encrypt(tokenData);
            fs.writeFileSync(this.storagePath, JSON.stringify(encryptedData));
        }
        catch (error) {
            console.error('❌ Could not save OAuth tokens:', error.message);
        }
    }
    set(token, info) { this.tokens.set(token, info); this.saveTokens(); }
    get(token) { return this.tokens.get(token); }
    delete(token) { const r = this.tokens.delete(token); if (r) {
        this.saveTokens();
    } return r; }
    cleanupExpired() { }
}
export function createOAuthMiddleware(config) {
    const tokenStorage = new EncryptedTokenStorage(config.encryptionKey, config.tokenStoragePath);
    const provider = config.provider === 'custom' ? { authUrl: config.authUrl, tokenUrl: config.tokenUrl, userInfoUrl: config.userInfoUrl, defaultScopes: config.scopes || [] } : OAUTH_PROVIDERS[config.provider];
    setInterval(() => tokenStorage.cleanupExpired(), 5 * 60 * 1000);
    const mcpAuthMiddleware = async (req, res, next) => {
        // Check if this is a JSON-RPC request and what method is being called
        let mcpMethod;
        if (req.body && typeof req.body === 'object' && req.body.method) {
            mcpMethod = req.body.method;
        }
        // Allow certain MCP methods without authentication for initial handshake
        const publicMethods = ['initialize', 'ping'];
        if (mcpMethod && publicMethods.includes(mcpMethod)) {
            console.log(`🔓 Allowing unauthenticated MCP method: ${mcpMethod}`);
            return next();
        }
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) {
            // Use configured baseUrl or construct from request (allow HTTP for localhost development)
            const baseUrl = config.baseUrl || `${req.protocol}://${req.get('host')}`;
            res.setHeader('WWW-Authenticate', `Bearer resource="${baseUrl}/.well-known/oauth-protected-resource"`);
            return res.status(401).json({
                error: 'unauthorized',
                error_description: 'Authentication required for MCP access',
                _links: {
                    'oauth-authorization-server': `${baseUrl}/.well-known/oauth-authorization-server`,
                    'oauth-protected-resource': `${baseUrl}/.well-known/oauth-protected-resource`
                }
            });
        }
        const token = authHeader.substring(7);
        const tokenInfo = tokenStorage.get(token);
        if (!tokenInfo) {
            return res.status(401).json({ error: 'invalid_token', error_description: 'Invalid or expired access token' });
        }
        const tokenAge = Date.now() - tokenInfo.created_at;
        if (tokenAge > (tokenInfo.expires_in * 1000)) {
            tokenStorage.delete(token);
            return res.status(401).json({ error: 'invalid_token', error_description: 'Access token has expired' });
        }
        req.user = { userId: tokenInfo.user.id?.toString() || 'oauth-' + Date.now(), email: tokenInfo.user.email || tokenInfo.user.login, subscriptionTier: 'oauth', monthlyTokenQuota: 10000, rpmLimit: 60, tpmLimit: 50000, features: ['oauth_access'], iat: Math.floor(tokenInfo.created_at / 1000), exp: Math.floor((tokenInfo.created_at + tokenInfo.expires_in * 1000) / 1000), iss: 'simple-rpc-ai-backend', aud: 'oauth-users', _originalOAuthUser: tokenInfo.user };
        next();
    };
    return { mcpAuthMiddleware, tokenStorage, provider };
}
export function createOAuthRoutes(config, baseUrl) {
    const { tokenStorage, provider } = createOAuthMiddleware(config);
    // Use configured baseUrl or provided baseUrl (allow HTTP for localhost development)
    const effectiveBaseUrl = config.baseUrl || baseUrl || 'http://localhost:8000';
    const handleAuthorizationRequest = (req, res) => {
        const { resource, code_challenge, code_challenge_method, ...query } = req.query;
        const normalizedResource = resource ? resource.replace(/\/$/, '') : undefined;
        // Allow both HTTP and HTTPS versions for localhost development
        const isLocalhostDev = effectiveBaseUrl.includes('localhost') || effectiveBaseUrl.includes('127.0.0.1');
        if (normalizedResource && normalizedResource !== effectiveBaseUrl) {
            if (isLocalhostDev) {
                // For localhost, allow both HTTP and HTTPS variants
                const httpUrl = effectiveBaseUrl.replace('https:', 'http:');
                const httpsUrl = effectiveBaseUrl.replace('http:', 'https:');
                if (normalizedResource !== httpUrl && normalizedResource !== httpsUrl) {
                    return res.status(400).json({ error: 'invalid_resource', error_description: `Invalid resource. Expected: ${effectiveBaseUrl} (or HTTP/HTTPS variant)` });
                }
            }
            else {
                return res.status(400).json({ error: 'invalid_resource', error_description: `Invalid resource. Expected: ${effectiveBaseUrl}` });
            }
        }
        // Store the original client's PKCE challenge in the session
        console.log('🔍 MCP Client Authorization Request:');
        console.log('   redirect_uri:', query.redirect_uri);
        console.log('   client_id:', query.client_id);
        console.log('   resource:', normalizedResource || effectiveBaseUrl);
        req.session.oauth = { ...query, resource: normalizedResource || effectiveBaseUrl, code_challenge, code_challenge_method };
        // Parameters for the external OAuth provider (Google)
        const params = new URLSearchParams({
            client_id: config.clientId,
            redirect_uri: config.redirectUri,
            response_type: 'code',
            scope: (config.scopes || provider.defaultScopes).join(' '),
            state: query.state || crypto.randomBytes(16).toString('hex'),
            access_type: 'offline'
        });
        // Do NOT forward the client's PKCE challenge to the external provider.
        // The server acts as a confidential client to Google.
        res.redirect(`${provider.authUrl}?${params}`);
    };
    const handleCallback = async (req, res) => {
        console.log('--- OAuth Callback ---');
        console.log('🐛 DEBUG: Full callback URL:', req.url);
        console.log('🐛 DEBUG: Query parameters:', req.query);
        console.log('🐛 DEBUG: Session ID:', req.sessionID);
        console.log('🐛 DEBUG: Session data:', req.session);
        const { code, state, error } = req.query;
        if (error) {
            console.log('Error from OAuth provider:', error);
            return res.status(400).json({ error: `OAuth error: ${error}` });
        }
        if (!code) {
            console.log('Error: Missing authorization code from provider');
            return res.status(400).json({ error: 'Missing authorization code' });
        }
        console.log('Received code from provider:', code);
        try {
            console.log('Exchanging code for token...');
            const tokenResponse = await fetch(provider.tokenUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({ client_id: config.clientId, client_secret: config.clientSecret, code: code, grant_type: 'authorization_code', redirect_uri: config.redirectUri })
            });
            const tokens = await tokenResponse.json();
            console.log('Token exchange response status:', tokenResponse.status);
            console.log('Token exchange response body:', tokens);
            if (!tokenResponse.ok) {
                throw new Error(tokens.error_description || 'Token exchange failed');
            }
            console.log('Fetching user info...');
            const userResponse = await fetch(provider.userInfoUrl, { headers: { 'Authorization': `Bearer ${tokens.access_token}` } });
            const userInfo = await userResponse.json();
            console.log('User info received:', userInfo);
            const accessToken = 'mcp_' + crypto.randomBytes(32).toString('hex');
            const tokenInfo = { user: userInfo, google_tokens: tokens, created_at: Date.now(), expires_in: 3600 };
            console.log('🐛 DEBUG: About to store token info:', JSON.stringify(tokenInfo, null, 2));
            tokenStorage.set(accessToken, tokenInfo);
            console.log('Generated and stored MCP token:', accessToken);
            const oauthParams = req.session.oauth;
            console.log('🐛 DEBUG: Session OAuth params:', JSON.stringify(oauthParams, null, 2));
            if (!oauthParams) {
                console.log('Error: Session expired or missing');
                return res.status(400).json({ error: 'Session expired' });
            }
            console.log('Retrieved OAuth params from session:', oauthParams);
            const callbackParams = new URLSearchParams({ code: accessToken, state: oauthParams.state || state });
            console.log('🔄 OAuth Callback Redirect:');
            console.log('   MCP Client redirect_uri:', oauthParams.redirect_uri);
            console.log('   Full callback URL:', `${oauthParams.redirect_uri}?${callbackParams}`);
            res.redirect(`${oauthParams.redirect_uri}?${callbackParams}`);
        }
        catch (e) {
            console.error('Error in callback handler:', e);
            res.status(500).json({ error: 'Internal server error', message: e.message });
        }
        console.log('----------------------');
    };
    const handleToken = (req, res) => {
        console.log('--- OAuth Token Endpoint ---');
        console.log('Request Body:', req.body);
        console.log('Request Headers:', req.headers);
        console.log('Session Object:', req.session);
        const { grant_type, code, resource, code_verifier } = req.body;
        if (grant_type !== 'authorization_code') {
            return res.status(400).json({ error: 'unsupported_grant_type' });
        }
        // Resource parameter is optional in token request (already validated during authorization)
        // Allow both HTTP and HTTPS versions for localhost development  
        if (resource) {
            const normalizedResource = resource.replace(/\/$/, '');
            const isLocalhostDev = effectiveBaseUrl.includes('localhost') || effectiveBaseUrl.includes('127.0.0.1');
            if (normalizedResource !== effectiveBaseUrl) {
                if (isLocalhostDev) {
                    const httpUrl = effectiveBaseUrl.replace('https:', 'http:');
                    const httpsUrl = effectiveBaseUrl.replace('http:', 'https:');
                    if (normalizedResource !== httpUrl && normalizedResource !== httpsUrl) {
                        return res.status(400).json({ error: 'invalid_request', error_description: 'Invalid resource parameter' });
                    }
                }
                else {
                    return res.status(400).json({ error: 'invalid_request', error_description: 'Invalid resource parameter' });
                }
            }
        }
        if (!code || !code.startsWith('mcp_')) {
            return res.status(400).json({ error: 'invalid_grant' });
        }
        // Try to get oauthParams from session first, but allow fallback
        const oauthParams = req.session.oauth;
        if (!oauthParams) {
            console.log('Warning: oauthParams not found in session, but continuing with token validation...');
            // We can still validate the MCP token without full session state
        }
        // PKCE Verification (only if oauthParams exists and has code_challenge)
        if (oauthParams && oauthParams.code_challenge) {
            console.log('--- PKCE Verification ---');
            console.log('Received code_verifier:', code_verifier);
            console.log('Stored code_challenge:', oauthParams.code_challenge);
            if (!code_verifier) {
                console.log('Error: Missing code_verifier in request body');
                return res.status(400).json({ error: 'invalid_request', error_description: 'Missing code_verifier' });
            }
            const expectedChallenge = crypto.createHash('sha256').update(code_verifier).digest('base64url');
            console.log('Calculated expected_challenge:', expectedChallenge);
            if (oauthParams.code_challenge !== expectedChallenge) {
                console.log('Error: PKCE challenge mismatch');
                return res.status(400).json({ error: 'invalid_grant', error_description: 'Invalid PKCE code_verifier' });
            }
            console.log('PKCE Verification Successful');
            console.log('-------------------------');
        }
        else if (code_verifier) {
            console.log('Warning: code_verifier provided but no stored code_challenge found (session may be missing)');
        }
        const tokenInfo = tokenStorage.get(code);
        console.log('🐛 DEBUG: Looking up token:', code);
        console.log('🐛 DEBUG: Token info found:', tokenInfo ? 'YES' : 'NO');
        if (tokenInfo) {
            console.log('🐛 DEBUG: Token details:', JSON.stringify(tokenInfo, null, 2));
        }
        if (!tokenInfo) {
            return res.status(400).json({ error: 'invalid_grant' });
        }
        tokenInfo.audience = resource;
        tokenInfo.resource = resource;
        const tokenResponse = { access_token: code, token_type: 'Bearer', expires_in: tokenInfo.expires_in, scope: 'mcp', resource: resource };
        console.log('🐛 DEBUG: Token exchange successful:', tokenResponse);
        res.json(tokenResponse);
        console.log('--------------------------');
    };
    const handleRegistration = (req, res) => {
        const { redirect_uris, ...body } = req.body;
        const clientId = 'mcp-client-' + Date.now();
        const clientSecret = crypto.randomBytes(16).toString('hex');
        res.status(201).json({
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uris: redirect_uris || [config.redirectUri],
            ...body
        });
    };
    const handleOpenIdConfiguration = (req, res) => {
        res.json({
            issuer: effectiveBaseUrl,
            authorization_endpoint: `${effectiveBaseUrl}/oauth/authorize`,
            token_endpoint: `${effectiveBaseUrl}/oauth/token`,
            userinfo_endpoint: `${effectiveBaseUrl}/oauth/userinfo`,
            jwks_uri: `${effectiveBaseUrl}/.well-known/jwks.json`,
            registration_endpoint: `${effectiveBaseUrl}/oauth/register`,
            response_types_supported: ['code'],
            subject_types_supported: ['public'],
            id_token_signing_alg_values_supported: ['RS256'],
            scopes_supported: ['openid', 'email', 'profile', 'mcp'],
            token_endpoint_auth_methods_supported: ['client_secret_basic', 'client_secret_post'],
            claims_supported: ['sub', 'email', 'name', 'picture'],
            code_challenge_methods_supported: ['S256'],
            registration_endpoint_auth_methods_supported: ['none'],
        });
    };
    const handleJwks = (req, res) => {
        res.json({ keys: [] });
    };
    return {
        authorizationServerDiscovery: (req, res) => res.json({
            issuer: effectiveBaseUrl,
            authorization_endpoint: `${effectiveBaseUrl}/oauth/authorize`,
            token_endpoint: `${effectiveBaseUrl}/oauth/token`,
            userinfo_endpoint: `${effectiveBaseUrl}/oauth/userinfo`,
            registration_endpoint: `${effectiveBaseUrl}/oauth/register`,
            jwks_uri: `${effectiveBaseUrl}/.well-known/jwks.json`,
            response_types_supported: ['code'],
            grant_types_supported: ['authorization_code', 'refresh_token'],
            scopes_supported: config.scopes || provider.defaultScopes,
            resource_parameter_supported: true,
            code_challenge_methods_supported: ['S256'],
            registration_endpoint_auth_methods_supported: ['none'],
        }),
        protectedResourceDiscovery: (req, res) => res.json({
            resource: effectiveBaseUrl,
            authorization_servers: [effectiveBaseUrl],
            scopes_supported: config.scopes || provider.defaultScopes,
            bearer_methods_supported: ['header'],
            resource_documentation: effectiveBaseUrl + '/docs'
        }),
        mcpAuthorizationServerDiscovery: (req, res) => res.json({
            issuer: effectiveBaseUrl,
            authorization_endpoint: `${effectiveBaseUrl}/oauth/authorize`,
            token_endpoint: `${effectiveBaseUrl}/oauth/token`,
            userinfo_endpoint: `${effectiveBaseUrl}/oauth/userinfo`,
            registration_endpoint: `${effectiveBaseUrl}/oauth/register`,
            jwks_uri: `${effectiveBaseUrl}/.well-known/jwks.json`,
            response_types_supported: ['code'],
            grant_types_supported: ['authorization_code', 'refresh_token'],
            scopes_supported: ['openid', 'email', 'profile', 'mcp'],
            resource_parameter_supported: true,
            code_challenge_methods_supported: ['S256'],
            registration_endpoint_auth_methods_supported: ['none'],
        }),
        mcpResourceDiscovery: (req, res) => res.json({ resource_server: effectiveBaseUrl, resource: effectiveBaseUrl, authorization_servers: [effectiveBaseUrl], scopes_supported: ['mcp'], bearer_methods_supported: ['header'] }),
        openidConfiguration: handleOpenIdConfiguration,
        jwks: handleJwks,
        authorize: handleAuthorizationRequest,
        callback: handleCallback,
        token: handleToken,
        register: handleRegistration,
        tokenStorage, // Add tokenStorage to the returned object
    };
}
