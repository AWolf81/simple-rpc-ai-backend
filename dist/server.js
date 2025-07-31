import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { UserManager, SimpleKeyManager, AuthManager, SQLiteAdapter, AIKeyValidator } from './auth/index.js';
import { OAuthAuthManager } from './auth/oauth-auth-manager.js';
import { AIService } from './services/ai-service.js';
import { FunctionRegistry } from './services/function-registry.js';
import { promptManager } from './services/prompt-manager.js';
import { readFile } from 'fs/promises';
import { resolve } from 'path';
export function createAIServer(config) {
    const app = express();
    const port = config.port ?? 8000;
    const mode = config.mode ?? determineMode(config);
    // Create AIService instance once here:
    let aiService;
    try {
        aiService = new AIService(config);
    }
    catch (error) {
        console.warn(`⚠️  AI Service initialization failed: ${error.message}`);
        console.warn('   AI requests will fail until serviceProviders are properly configured');
        // Create a dummy service that will always throw helpful errors
        aiService = null;
    }
    // Create Function Registry for custom RPC functions
    const functionRegistry = new FunctionRegistry(aiService);
    // Register custom system prompts from config (sync only)
    if (config.systemPrompts) {
        loadSystemPromptsSync(config.systemPrompts);
    }
    let dbAdapter = null;
    let userManager = null;
    let keyManager = null;
    let authManager = null;
    // OAuth authentication (simplified approach)
    let oauthAuthManager = null;
    if (mode !== 'simple') {
        dbAdapter = new SQLiteAdapter(config.database?.path ?? ':memory:');
        userManager = new UserManager(dbAdapter);
        const keyValidator = new AIKeyValidator();
        keyManager = new SimpleKeyManager(dbAdapter, keyValidator, config.masterEncryptionKey ?? '');
        authManager = new AuthManager(userManager, keyManager, new Map());
        dbAdapter.initialize().catch(console.error);
    }
    // Initialize OAuth authentication if configured (recommended approach)
    if (config.oauthAuth) {
        oauthAuthManager = new OAuthAuthManager({
            allowedProviders: config.oauthAuth.allowedProviders,
            allowedUsers: config.oauthAuth.allowedUsers,
            allowedOrgs: config.oauthAuth.allowedOrgs,
            requireVerifiedEmail: config.oauthAuth.requireVerifiedEmail,
            sessionExpirationMs: config.oauthAuth.sessionExpirationMs
        });
        console.log('🔐 OAuth authentication enabled');
        console.log(`   📋 Allowed providers: ${config.oauthAuth.allowedProviders.join(', ')}`);
        if (config.oauthAuth.allowedUsers?.length) {
            console.log(`   👥 Allowed users: ${config.oauthAuth.allowedUsers.length} configured`);
        }
        if (config.oauthAuth.allowedOrgs?.length) {
            console.log(`   🏢 Allowed orgs: ${config.oauthAuth.allowedOrgs.join(', ')}`);
        }
    }
    app.use(helmet());
    app.use(cors({
        origin: config.cors?.origin ?? ['vscode-webview://*', 'http://localhost:*', 'https://localhost:*'],
        credentials: config.cors?.credentials ?? true
    }));
    app.use(express.json({ limit: '10mb' }));
    // Enhanced rate limiting with IP-based tracking
    const limiter = rateLimit({
        windowMs: config.rateLimit?.windowMs ?? 15 * 60 * 1000,
        max: config.rateLimit?.max ?? 100,
        keyGenerator: (req) => {
            // Use IP address for rate limiting
            return req.ip || req.connection.remoteAddress || 'unknown';
        },
        handler: (req, res) => {
            const rateLimitedReq = req;
            res.status(429).json({
                error: {
                    code: -32003,
                    message: 'Too many requests from this IP, please try again later.',
                    data: { retryAfter: Math.ceil((rateLimitedReq.rateLimit?.resetTime ?? Date.now()) / 1000) }
                }
            });
        },
        standardHeaders: true,
        legacyHeaders: false,
        skipFailedRequests: false,
        skipSuccessfulRequests: false
    });
    // Stricter rate limiting for auth endpoints
    const authLimiter = rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 10, // Limit auth attempts
        keyGenerator: (req) => req.ip || req.connection.remoteAddress || 'unknown',
        handler: (req, res) => {
            const rateLimitedReq = req;
            res.status(429).json({
                success: false,
                error: 'Too many authentication attempts from this IP, please try again later.',
                retryAfter: Math.ceil((rateLimitedReq.rateLimit?.resetTime ?? Date.now()) / 1000)
            });
        },
        standardHeaders: true,
        legacyHeaders: false
    });
    app.use('/rpc', limiter);
    app.use('/auth', authLimiter);
    // Input validation middleware for RPC requests
    const validateRPCRequest = (req, res, next) => {
        const { jsonrpc, id, method, params } = req.body;
        // Validate required fields
        if (jsonrpc !== '2.0') {
            return res.status(400).json({
                id: id || null,
                error: { code: -32600, message: 'Invalid Request - jsonrpc must be "2.0"' }
            });
        }
        if (typeof id !== 'number' && typeof id !== 'string') {
            return res.status(400).json({
                id: null,
                error: { code: -32600, message: 'Invalid Request - id must be a number or string' }
            });
        }
        if (!method || typeof method !== 'string' || method.length === 0) {
            return res.status(400).json({
                id,
                error: { code: -32600, message: 'Invalid Request - method must be a non-empty string' }
            });
        }
        // Method name validation - allow only alphanumeric, dots, and underscores
        if (!/^[a-zA-Z0-9._]+$/.test(method)) {
            return res.status(400).json({
                id,
                error: { code: -32600, message: 'Invalid Request - method contains invalid characters' }
            });
        }
        // Params validation - must be object or undefined
        if (params !== undefined && (typeof params !== 'object' || params === null || Array.isArray(params))) {
            return res.status(400).json({
                id,
                error: { code: -32600, message: 'Invalid Request - params must be an object' }
            });
        }
        next();
    };
    app.use('/rpc', validateRPCRequest);
    // OAuth authentication endpoint (simplified approach)
    if (config.oauthAuth && oauthAuthManager) {
        app.post('/auth/oauth', async (req, res) => {
            try {
                const { extensionId, provider, accessToken, deviceId } = req.body;
                if (!extensionId || !provider || !accessToken || !deviceId) {
                    res.status(400).json({
                        success: false,
                        error: 'Missing required parameters: extensionId, provider, accessToken, deviceId'
                    });
                    return;
                }
                // Authenticate with OAuth manager
                const session = await oauthAuthManager.authenticateWithOAuth(extensionId, provider, accessToken, deviceId);
                // Generate session token
                const sessionToken = `oauth_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                res.json({
                    success: true,
                    sessionToken,
                    user: session.userInfo,
                    authLevel: session.authLevel,
                    expiresAt: session.expiresAt
                });
            }
            catch (error) {
                res.status(401).json({
                    success: false,
                    error: error.message
                });
            }
        });
        // OAuth sign out endpoint
        app.post('/auth/signout', async (req, res) => {
            try {
                const { sessionToken } = req.body;
                if (sessionToken && oauthAuthManager) {
                    oauthAuthManager.invalidateSession(sessionToken);
                }
                res.json({ success: true });
            }
            catch (error) {
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });
    }
    // Authentication validation middleware for RPC requests
    const validateAuth = (req, res, next) => {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            // No token provided - allow for backward compatibility
            return next();
        }
        const token = authHeader.substring(7);
        // Try OAuth session first (if configured)
        if (config.oauthAuth && oauthAuthManager && token.startsWith('oauth_')) {
            const session = oauthAuthManager.validateSession(token);
            if (session) {
                req.authContext = {
                    type: 'oauth',
                    userId: session.userId,
                    deviceId: session.deviceId,
                    extensionId: session.extensionId,
                    authLevel: session.authLevel,
                    userInfo: session.userInfo
                };
                return next();
            }
        }
        // If we have auth configured but token is invalid
        if (config.oauthAuth) {
            return res.status(401).json({
                error: { code: -32001, message: 'Invalid or expired authentication token' }
            });
        }
        // No auth configured, continue
        next();
    };
    // Apply authentication middleware to RPC endpoint
    app.use('/rpc', validateAuth);
    app.post('/rpc', async (req, res) => {
        const { id, method, params } = req.body;
        if (!method || typeof method !== 'string') {
            return res.status(400).json({
                id,
                error: { code: -32600, message: 'Invalid Request - missing method' }
            });
        }
        try {
            let result;
            switch (method) {
                case 'initializeSession':
                    if (!authManager)
                        throw new Error('Authentication manager not initialized');
                    result = await authManager.initializeSession(params.deviceId, params.deviceName);
                    break;
                case 'upgradeToOAuth':
                    if (!authManager)
                        throw new Error('Authentication manager not initialized');
                    result = await authManager.upgradeToOAuth(params.deviceId, params.provider, params.oauthToken);
                    break;
                case 'linkDeviceWithCode':
                    if (!authManager)
                        throw new Error('Authentication manager not initialized');
                    result = await authManager.linkDeviceWithCode(params.newDeviceId, params.code, params.deviceName);
                    break;
                case 'generateDeviceLinkCode':
                    if (!authManager)
                        throw new Error('Authentication manager not initialized');
                    result = await authManager.generateDeviceLinkCode(params.email);
                    break;
                case 'upgradeToPro':
                    if (!authManager)
                        throw new Error('Authentication manager not initialized');
                    result = await authManager.upgradeToPro(params.deviceId);
                    break;
                case 'getAuthStatus':
                    if (!authManager)
                        throw new Error('Authentication manager not initialized');
                    result = await authManager.getAuthStatus(params.deviceId);
                    break;
                case 'hasFeature':
                    if (!authManager)
                        throw new Error('Authentication manager not initialized');
                    result = await authManager.hasFeature(params.deviceId, params.feature);
                    break;
                case 'invalidateSession':
                    if (!authManager)
                        throw new Error('Authentication manager not initialized');
                    authManager.invalidateSession(params.deviceId);
                    result = { success: true };
                    break;
                case 'storeUserKey':
                    if (!keyManager)
                        throw new Error('Key manager not initialized');
                    await keyManager.storeUserKey(params.userId, params.provider, params.apiKey);
                    result = { success: true };
                    break;
                case 'getUserKey':
                    if (!keyManager)
                        throw new Error('Key manager not initialized');
                    result = await keyManager.getUserKey(params.userId, params.provider);
                    break;
                case 'getUserProviders':
                    if (!keyManager)
                        throw new Error('Key manager not initialized');
                    result = await keyManager.getUserProviders(params.userId);
                    break;
                case 'validateUserKey':
                    if (!keyManager)
                        throw new Error('Key manager not initialized');
                    result = await keyManager.validateUserKey(params.userId, params.provider);
                    break;
                case 'validateAllUserKeys':
                    if (!keyManager)
                        throw new Error('Key manager not initialized');
                    result = await keyManager.validateAllUserKeys(params.userId);
                    break;
                case 'rotateUserKey':
                    if (!keyManager)
                        throw new Error('Key manager not initialized');
                    await keyManager.rotateUserKey(params.userId, params.provider, params.newApiKey);
                    result = { success: true };
                    break;
                case 'deleteUserKey':
                    if (!keyManager)
                        throw new Error('Key manager not initialized');
                    await keyManager.deleteUserKey(params.userId, params.provider);
                    result = { success: true };
                    break;
                case 'executeAIRequest':
                    result = await handleAIRequest(params, keyManager, aiService);
                    break;
                case 'shouldSuggestUpgrade':
                    if (!authManager)
                        throw new Error('Authentication manager not initialized');
                    result = await handleSuggestUpgrade(params, authManager);
                    break;
                case 'health':
                    result = await handleHealth();
                    break;
                case 'rpc.discover':
                    result = await handleDiscover();
                    break;
                case 'listCustomFunctions':
                    result = functionRegistry.listFunctions();
                    break;
                case 'getCustomFunction':
                    result = functionRegistry.getFunction(params.name);
                    break;
                default:
                    // Check if it's a custom function
                    if (functionRegistry.hasFunction(method)) {
                        result = await functionRegistry.executeFunction(method, params, params.aiOptions);
                    }
                    else {
                        throw new Error(`Unknown method: ${method}`);
                    }
            }
            res.json({ id, result });
            return;
        }
        catch (error) {
            // Log full error internally (but sanitize for production logs)
            console.error(`❌ RPC method '${method}' failed:`, {
                message: error.message,
                stack: process.env.NODE_ENV === 'development' ? error.stack : '[hidden]'
            });
            // Send sanitized response to client
            const isDevelopment = process.env.NODE_ENV === 'development';
            res.status(500).json({
                id,
                error: {
                    code: -32603,
                    message: 'Internal server error',
                    data: isDevelopment ? error.message : 'An error occurred while processing your request'
                }
            });
            return;
        }
    });
    app.get('/health', async (req, res) => {
        try {
            res.json({
                status: 'healthy',
                timestamp: new Date().toISOString(),
                service: 'Progressive AI Backend',
                features: ['byok', 'progressive_auth', 'multi_device'],
                database: 'connected'
            });
        }
        catch (error) {
            res.status(500).json({
                status: 'unhealthy',
                timestamp: new Date().toISOString(),
                error: error.message ?? String(error)
            });
        }
    });
    app.get('/config', (req, res) => {
        res.json({
            service: 'Progressive AI Backend',
            version: '1.0.0',
            rpcEndpoint: '/rpc',
            supportedMethods: [
                'initializeSession', 'upgradeToOAuth', 'linkDeviceWithCode',
                'storeUserKey', 'getUserKey', 'executeAIRequest', 'health'
            ],
            authLevels: ['anonymous', 'oauth', 'passkey', 'pro'],
            supportedProviders: ['anthropic', 'openai', 'google'],
            features: {
                byok: true,
                progressiveAuth: true,
                multiDevice: true,
                oauth: Object.keys(config.oauth || {}),
                passkeySupport: false
            }
        });
    });
    return {
        app,
        functionRegistry,
        promptManager,
        start: (portOverride) => {
            const serverPort = portOverride ?? port;
            const server = app.listen(serverPort, () => {
                console.log('🚀 Progressive AI Backend Server');
                console.log(`🌐 Server running on port ${serverPort}`);
                console.log(`📋 Available custom functions: ${functionRegistry.listFunctions().map(f => f.name).join(', ')}`);
            });
            return server;
        },
        stop: () => {
            console.log('🛑 Shutting down gracefully...');
            if (dbAdapter) {
                dbAdapter.close();
            }
        }
    };
}
export async function createAIServerAsync(config) {
    const app = express();
    const port = config.port ?? 8000;
    const mode = config.mode ?? determineMode(config);
    // Create AIService instance once here:
    const aiService = new AIService(config);
    // Create Function Registry for custom RPC functions
    const functionRegistry = new FunctionRegistry(aiService);
    // Register custom system prompts from config (async loading)
    if (config.systemPrompts) {
        await loadSystemPrompts(config.systemPrompts);
    }
    let dbAdapter = null;
    let userManager = null;
    let keyManager = null;
    let authManager = null;
    // OAuth authentication (simplified approach)
    let oauthAuthManager = null;
    if (mode !== 'simple') {
        dbAdapter = new SQLiteAdapter(config.database?.path ?? ':memory:');
        userManager = new UserManager(dbAdapter);
        const keyValidator = new AIKeyValidator();
        keyManager = new SimpleKeyManager(dbAdapter, keyValidator, config.masterEncryptionKey ?? '');
        authManager = new AuthManager(userManager, keyManager, new Map());
        dbAdapter.initialize().catch(console.error);
    }
    // Initialize OAuth authentication if configured (recommended approach)
    if (config.oauthAuth) {
        oauthAuthManager = new OAuthAuthManager({
            allowedProviders: config.oauthAuth.allowedProviders,
            allowedUsers: config.oauthAuth.allowedUsers,
            allowedOrgs: config.oauthAuth.allowedOrgs,
            requireVerifiedEmail: config.oauthAuth.requireVerifiedEmail,
            sessionExpirationMs: config.oauthAuth.sessionExpirationMs
        });
        console.log('🔐 OAuth authentication enabled');
        console.log(`   📋 Allowed providers: ${config.oauthAuth.allowedProviders.join(', ')}`);
        if (config.oauthAuth.allowedUsers?.length) {
            console.log(`   👥 Allowed users: ${config.oauthAuth.allowedUsers.length} configured`);
        }
        if (config.oauthAuth.allowedOrgs?.length) {
            console.log(`   🏢 Allowed orgs: ${config.oauthAuth.allowedOrgs.join(', ')}`);
        }
    }
    app.use(helmet());
    app.use(cors({
        origin: config.cors?.origin ?? ['vscode-webview://*', 'http://localhost:*', 'https://localhost:*'],
        credentials: config.cors?.credentials ?? true
    }));
    app.use(express.json({ limit: '10mb' }));
    const limiter = rateLimit({
        windowMs: config.rateLimit?.windowMs ?? 15 * 60 * 1000,
        max: config.rateLimit?.max ?? 100,
        message: { error: 'Too many requests, please try again later.' }
    });
    app.use('/rpc', limiter);
    // OAuth authentication endpoint (simplified approach)
    if (config.oauthAuth && oauthAuthManager) {
        app.post('/auth/oauth', async (req, res) => {
            try {
                const { extensionId, provider, accessToken, deviceId } = req.body;
                if (!extensionId || !provider || !accessToken || !deviceId) {
                    res.status(400).json({
                        success: false,
                        error: 'Missing required parameters: extensionId, provider, accessToken, deviceId'
                    });
                    return;
                }
                // Authenticate with OAuth manager
                const session = await oauthAuthManager.authenticateWithOAuth(extensionId, provider, accessToken, deviceId);
                // Generate session token
                const sessionToken = `oauth_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                res.json({
                    success: true,
                    sessionToken,
                    user: session.userInfo,
                    authLevel: session.authLevel,
                    expiresAt: session.expiresAt
                });
            }
            catch (error) {
                res.status(401).json({
                    success: false,
                    error: error.message
                });
            }
        });
        // OAuth sign out endpoint
        app.post('/auth/signout', async (req, res) => {
            try {
                const { sessionToken } = req.body;
                if (sessionToken && oauthAuthManager) {
                    oauthAuthManager.invalidateSession(sessionToken);
                }
                res.json({ success: true });
            }
            catch (error) {
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });
    }
    // Authentication validation middleware for RPC requests
    const validateAuth = (req, res, next) => {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            // No token provided - allow for backward compatibility
            return next();
        }
        const token = authHeader.substring(7);
        // Try OAuth session first (if configured)
        if (config.oauthAuth && oauthAuthManager && token.startsWith('oauth_')) {
            const session = oauthAuthManager.validateSession(token);
            if (session) {
                req.authContext = {
                    type: 'oauth',
                    userId: session.userId,
                    deviceId: session.deviceId,
                    extensionId: session.extensionId,
                    authLevel: session.authLevel,
                    userInfo: session.userInfo
                };
                return next();
            }
        }
        // If we have auth configured but token is invalid
        if (config.oauthAuth) {
            return res.status(401).json({
                error: { code: -32001, message: 'Invalid or expired authentication token' }
            });
        }
        // No auth configured, continue
        next();
    };
    // Apply authentication middleware to RPC endpoint
    app.use('/rpc', validateAuth);
    app.post('/rpc', async (req, res) => {
        const { id, method, params } = req.body;
        if (!method || typeof method !== 'string') {
            return res.status(400).json({
                id,
                error: { code: -32600, message: 'Invalid Request - missing method' }
            });
        }
        try {
            let result;
            switch (method) {
                case 'initializeSession':
                    if (!authManager)
                        throw new Error('Authentication manager not initialized');
                    result = await authManager.initializeSession(params.deviceId, params.deviceName);
                    break;
                case 'upgradeToOAuth':
                    if (!authManager)
                        throw new Error('Authentication manager not initialized');
                    result = await authManager.upgradeToOAuth(params.deviceId, params.provider, params.oauthToken);
                    break;
                case 'linkDeviceWithCode':
                    if (!authManager)
                        throw new Error('Authentication manager not initialized');
                    result = await authManager.linkDeviceWithCode(params.newDeviceId, params.code, params.deviceName);
                    break;
                case 'generateDeviceLinkCode':
                    if (!authManager)
                        throw new Error('Authentication manager not initialized');
                    result = await authManager.generateDeviceLinkCode(params.email);
                    break;
                case 'upgradeToPro':
                    if (!authManager)
                        throw new Error('Authentication manager not initialized');
                    result = await authManager.upgradeToPro(params.deviceId);
                    break;
                case 'getAuthStatus':
                    if (!authManager)
                        throw new Error('Authentication manager not initialized');
                    result = await authManager.getAuthStatus(params.deviceId);
                    break;
                case 'hasFeature':
                    if (!authManager)
                        throw new Error('Authentication manager not initialized');
                    result = await authManager.hasFeature(params.deviceId, params.feature);
                    break;
                case 'invalidateSession':
                    if (!authManager)
                        throw new Error('Authentication manager not initialized');
                    authManager.invalidateSession(params.deviceId);
                    result = { success: true };
                    break;
                case 'storeUserKey':
                    if (!keyManager)
                        throw new Error('Key manager not initialized');
                    result = await keyManager.storeUserKey(params.userId, params.provider, params.apiKey);
                    break;
                case 'getUserKey':
                    if (!keyManager)
                        throw new Error('Key manager not initialized');
                    result = await keyManager.getUserKey(params.userId, params.provider);
                    break;
                case 'rotateUserKey':
                    if (!keyManager)
                        throw new Error('Key manager not initialized');
                    result = await keyManager.rotateUserKey(params.userId, params.provider, params.newApiKey);
                    break;
                case 'deleteUserKey':
                    if (!keyManager)
                        throw new Error('Key manager not initialized');
                    result = await keyManager.deleteUserKey(params.userId, params.provider);
                    break;
                case 'validateUserKey':
                    if (!keyManager)
                        throw new Error('Key manager not initialized');
                    result = await keyManager.validateUserKey(params.userId, params.provider);
                    break;
                case 'getUserProviders':
                    if (!keyManager)
                        throw new Error('Key manager not initialized');
                    result = await keyManager.getUserProviders(params.userId);
                    break;
                case 'executeAIRequest':
                    result = await handleAIRequest(params, keyManager, aiService);
                    break;
                case 'shouldSuggestUpgrade':
                    if (!authManager)
                        throw new Error('Authentication manager not initialized');
                    result = await handleSuggestUpgrade(params, authManager);
                    break;
                case 'health':
                    result = await handleHealth();
                    break;
                case 'rpc.discover':
                    result = await handleDiscover();
                    break;
                case 'listCustomFunctions':
                    result = functionRegistry.listFunctions();
                    break;
                case 'getCustomFunction':
                    result = functionRegistry.getFunction(params.name);
                    break;
                default:
                    // Check if it's a custom function
                    if (functionRegistry.hasFunction(method)) {
                        result = await functionRegistry.executeFunction(method, params, params.aiOptions);
                    }
                    else {
                        throw new Error(`Unknown method: ${method}`);
                    }
            }
            res.json({ id, result });
            return;
        }
        catch (error) {
            // Log full error internally (but sanitize for production logs)
            console.error(`❌ RPC method '${method}' failed:`, {
                message: error.message,
                stack: process.env.NODE_ENV === 'development' ? error.stack : '[hidden]'
            });
            // Send sanitized response to client
            const isDevelopment = process.env.NODE_ENV === 'development';
            res.status(500).json({
                id,
                error: {
                    code: -32603,
                    message: 'Internal server error',
                    data: isDevelopment ? error.message : 'An error occurred while processing your request'
                }
            });
            return;
        }
    });
    app.get('/config', (req, res) => {
        res.json({
            name: 'simple-rpc-ai-backend',
            version: '1.0.0',
            features: {
                authentication: mode !== 'simple',
                byok: mode === 'byok' || mode === 'hybrid',
                customFunctions: true,
                fileBasedPrompts: true
            },
            supportedMethods: [
                'initializeSession', 'upgradeToOAuth', 'getAuthStatus', 'shouldSuggestUpgrade',
                'storeUserKey', 'getUserKey', 'executeAIRequest', 'health', 'listCustomFunctions'
            ],
            authentication: {
                oauth: Object.keys(config.oauth || {}),
                passkeySupport: false
            }
        });
    });
    return {
        app,
        functionRegistry,
        promptManager,
        start: (portOverride) => {
            const serverPort = portOverride ?? port;
            const server = app.listen(serverPort, () => {
                console.log('🚀 Progressive AI Backend Server (Async)');
                console.log(`🌐 Server running on port ${serverPort}`);
                console.log(`📋 Available custom functions: ${functionRegistry.listFunctions().map(f => f.name).join(', ')}`);
            });
            return server;
        },
        stop: () => {
            console.log('🛑 Shutting down gracefully...');
            if (dbAdapter) {
                dbAdapter.close();
            }
        }
    };
}
function determineMode(config) {
    if (config.mode)
        return config.mode;
    if (config.serviceProviders)
        return 'byok';
    return 'simple';
}
async function handleAIRequest(params, keyManager, aiService) {
    const { userId, content, systemPrompt, promptId, promptContext = {}, metadata = {} } = params;
    // Debug logging
    console.log('🔍 handleAIRequest Debug:');
    console.log(`   Params keys: ${Object.keys(params).join(', ')}`);
    console.log(`   Prompt ID: ${promptId || 'NONE'}`);
    console.log(`   System Prompt: ${systemPrompt ? `"${systemPrompt.substring(0, 100)}..."` : 'NONE'}`);
    console.log(`   Content: ${content ? `"${content.substring(0, 100)}..."` : 'MISSING'}`);
    if (!content) {
        throw new Error('Missing required parameter: content');
    }
    // Resolve system prompt: promptId takes precedence over direct systemPrompt
    let resolvedSystemPrompt;
    if (promptId) {
        try {
            resolvedSystemPrompt = promptManager.getPrompt(promptId, promptContext);
            console.log(`🎯 Using managed prompt: ${promptId}`);
        }
        catch (error) {
            throw new Error(`Failed to resolve prompt ID '${promptId}': ${error.message}`);
        }
    }
    else if (systemPrompt) {
        resolvedSystemPrompt = systemPrompt;
        console.log('📝 Using direct system prompt');
    }
    else {
        throw new Error('Either promptId or systemPrompt must be provided');
    }
    if (!aiService) {
        throw new Error('AI service not available. Please configure serviceProviders with valid API keys (e.g., set ANTHROPIC_API_KEY environment variable).');
    }
    // Try user's API keys first (if BYOK mode and user provided)
    if (keyManager && userId) {
        try {
            const providers = await keyManager.getUserProviders(userId);
            if (providers.length > 0) {
                console.log(`🔑 Using user's ${providers[0]} key`);
                // User has keys, let them use their own
            }
        }
        catch (error) {
            console.log('🔄 User key failed, using service providers...');
        }
    }
    const startTime = Date.now();
    console.log(`🤖 Processing AI request`);
    const result = await aiService.execute({
        content,
        systemPrompt: resolvedSystemPrompt,
        metadata
    });
    const processingTime = Date.now() - startTime;
    console.log(`✅ AI request completed in ${processingTime}ms`);
    return {
        success: true,
        result: result.content,
        metadata: {
            requestId: Math.random().toString(36).substring(7),
            processingTime,
            tokenUsage: result.usage,
            model: result.model,
            finishReason: result.finishReason,
            timestamp: new Date().toISOString(),
            ...metadata
        }
    };
}
async function handleSuggestUpgrade(params, authManager) {
    const status = await authManager.getAuthStatus(params.deviceId);
    // Simplified suggestion logic
    return status.authLevel !== 'pro';
}
async function handleHealth() {
    return { status: 'healthy', timestamp: new Date().toISOString() };
}
async function handleDiscover() {
    const { readFile } = await import('fs/promises');
    const { resolve } = await import('path');
    try {
        const openrpcPath = resolve(process.cwd(), 'openrpc.json');
        const openrpcContent = await readFile(openrpcPath, 'utf-8');
        return JSON.parse(openrpcContent);
    }
    catch (error) {
        // Fallback minimal schema if file not found
        return {
            openrpc: '1.2.6',
            info: {
                title: 'Simple RPC AI Backend',
                version: '0.1.0',
                description: 'Platform-agnostic JSON-RPC server for AI integration'
            },
            methods: [
                {
                    name: 'health',
                    description: 'Check server health',
                    params: [],
                    result: { name: 'healthResult', schema: { type: 'object' } }
                },
                {
                    name: 'executeAIRequest',
                    description: 'Execute AI request with system prompt protection',
                    params: [
                        { name: 'content', schema: { type: 'string' }, required: true },
                        { name: 'systemPrompt', schema: { type: 'string' }, required: true }
                    ],
                    result: { name: 'aiResult', schema: { type: 'object' } }
                }
            ]
        };
    }
}
/**
 * Load system prompts synchronously (strings and content objects only)
 */
function loadSystemPromptsSync(systemPrompts) {
    for (const [promptId, promptConfig] of Object.entries(systemPrompts)) {
        if (typeof promptConfig === 'string') {
            // Simple string format
            promptManager.registerPrompt({
                id: promptId,
                name: promptId,
                description: `Custom prompt: ${promptId}`,
                systemPrompt: promptConfig,
                variables: extractTemplateVariables(promptConfig),
                category: 'custom'
            });
        }
        else {
            // Object format - sync only supports content, not file/DB
            if (promptConfig.content) {
                promptManager.registerPrompt({
                    id: promptId,
                    name: promptConfig.name || promptId,
                    description: promptConfig.description || `Custom prompt: ${promptId}`,
                    systemPrompt: promptConfig.content,
                    variables: promptConfig.variables || extractTemplateVariables(promptConfig.content),
                    category: promptConfig.category || 'custom',
                    version: promptConfig.version
                });
            }
            else {
                console.warn(`⚠️  Sync loading only supports 'content' property for prompt '${promptId}'. Use createAIServerAsync for file/DB loading.`);
            }
        }
    }
}
/**
 * Load system prompts from various sources (strings, files, future DB)
 */
async function loadSystemPrompts(systemPrompts) {
    for (const [promptId, promptConfig] of Object.entries(systemPrompts)) {
        let systemPrompt;
        let metadata = {};
        if (typeof promptConfig === 'string') {
            // Simple string format
            systemPrompt = promptConfig;
            metadata = {
                name: promptId,
                description: `Custom prompt: ${promptId}`,
                category: 'custom'
            };
        }
        else {
            // Object format with multiple source options
            if (promptConfig.content) {
                // Direct content
                systemPrompt = promptConfig.content;
            }
            else if (promptConfig.file) {
                // Load from file
                try {
                    const filePath = resolve(promptConfig.file);
                    systemPrompt = await readFile(filePath, 'utf-8');
                    console.log(`📄 Loaded prompt '${promptId}' from file: ${promptConfig.file}`);
                }
                catch (error) {
                    console.error(`❌ Failed to load prompt file '${promptConfig.file}' for '${promptId}':`, error.message);
                    continue; // Skip this prompt
                }
            }
            else if (promptConfig.db) {
                // Future: Load from database
                console.warn(`⚠️  Database loading not yet implemented for prompt '${promptId}'. Skipping.`);
                continue;
            }
            else {
                console.warn(`⚠️  No content source specified for prompt '${promptId}'. Skipping.`);
                continue;
            }
            // Extract metadata
            metadata = {
                name: promptConfig.name || promptId,
                description: promptConfig.description || `Custom prompt: ${promptId}`,
                variables: promptConfig.variables || [],
                category: promptConfig.category || 'custom',
                version: promptConfig.version
            };
        }
        // Extract variables from template if not explicitly provided
        if (!metadata.variables || metadata.variables.length === 0) {
            metadata.variables = extractTemplateVariables(systemPrompt);
        }
        // Register the prompt
        promptManager.registerPrompt({
            id: promptId,
            name: metadata.name,
            description: metadata.description,
            systemPrompt,
            variables: metadata.variables,
            category: metadata.category,
            version: metadata.version
        });
    }
}
/**
 * Extract template variables from a prompt string (e.g., {variable})
 */
function extractTemplateVariables(template) {
    const matches = template.match(/\{(\w+)\}/g);
    if (!matches)
        return [];
    return [...new Set(matches.map(match => match.slice(1, -1)))];
}
//# sourceMappingURL=server.js.map