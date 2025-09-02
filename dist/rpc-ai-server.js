/**
 * RPC AI Server
 *
 * One server that supports both JSON-RPC and tRPC endpoints for AI applications.
 * Provides simple configuration for basic use cases and advanced options for complex scenarios.
 */
import 'dotenv/config';
import express from 'express';
import { createServer as createHttpServer } from 'http';
import { createServer as createHttpsServer } from 'https';
import { readFileSync, existsSync } from 'fs';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import * as trpcExpress from '@trpc/server/adapters/express';
import session from 'express-session';
import crypto from 'crypto';
import { createAppRouter } from './trpc/root.js';
import { createTRPCContext } from './trpc/index.js';
import { JWTMiddleware } from './auth/jwt-middleware.js';
import { PostgreSQLAdapter } from './database/postgres-adapter.js';
import { VirtualTokenService } from './services/virtual-token-service.js';
import { UsageAnalyticsService } from './services/usage-analytics-service.js';
import { PostgreSQLRPCMethods } from './auth/PostgreSQLRPCMethods.js';
import { RPC_METHODS } from './constants.js';
import { createTRPCToJSONRPCBridge } from './trpc/trpc-to-jsonrpc-bridge.js';
import { createOAuthMiddleware, createOAuthRoutes } from './auth/oauth-middleware.js';
export class RpcAiServer {
    app;
    server;
    config;
    router;
    jwtMiddleware;
    dbAdapter;
    virtualTokenService;
    usageAnalyticsService;
    postgresRPCMethods;
    jsonRpcBridge;
    oauthMiddleware;
    oauthRoutes;
    /**
     * Opinionated protocol configuration:
     * - Default: JSON-RPC only (simpler, universal)
     * - If only one protocol specified as true, disable the other
     * - If both explicitly specified, use provided values
     */
    getOpinionatedProtocols(protocols) {
        // No protocols specified - default to JSON-RPC only (simpler)
        if (!protocols) {
            return { jsonRpc: true, tRpc: false };
        }
        const { jsonRpc, tRpc } = protocols;
        // Both explicitly specified - respect user choice
        if (jsonRpc !== undefined && tRpc !== undefined) {
            return { jsonRpc, tRpc };
        }
        // Only one specified - be opinionated about the other
        if (jsonRpc === true && tRpc === undefined) {
            return { jsonRpc: true, tRpc: false };
        }
        if (tRpc === true && jsonRpc === undefined) {
            return { jsonRpc: false, tRpc: true };
        }
        if (jsonRpc === false && tRpc === undefined) {
            return { jsonRpc: false, tRpc: true };
        }
        if (tRpc === false && jsonRpc === undefined) {
            return { jsonRpc: true, tRpc: false };
        }
        // Fallback to default
        return { jsonRpc: true, tRpc: false };
    }
    constructor(config = {}) {
        // Opinionated protocol defaults
        const protocols = this.getOpinionatedProtocols(config.protocols);
        // Set smart defaults
        this.config = {
            port: 8000,
            aiLimits: {},
            serverProviders: ['anthropic'], // Default: Anthropic only for easier onboarding
            byokProviders: ['anthropic'], // Default: Anthropic BYOK only
            customProviders: [], // Default: no custom providers
            systemPrompts: config.systemPrompts || {}, // Default: use built-in prompts
            secretManager: {}, // Default: no secret manager
            protocols,
            tokenTracking: {
                enabled: false,
                platformFeePercent: 25,
                webhookPath: '/webhooks/lemonsqueezy',
                ...config.tokenTracking
            },
            jwt: {
                ...config.jwt
            },
            ...(config.oauth && { oauth: config.oauth }),
            cors: {
                origin: '*',
                credentials: false,
                ...config.cors
            },
            https: {
                enabled: false,
                keyPath: './certs/key.pem',
                certPath: './certs/cert.pem',
                ...config.https
            },
            rateLimit: {
                windowMs: 15 * 60 * 1000, // 15 minutes
                max: 1000, // Conservative but reasonable
                ...config.rateLimit
            },
            paths: {
                jsonRpc: '/rpc',
                tRpc: '/trpc',
                health: '/health',
                webhooks: '/webhooks/lemonsqueezy',
                ...config.paths
            },
            mcp: {
                enableMCP: config.mcp?.enableMCP || false,
                transports: {
                    http: true, // HTTP transport enabled by default
                    stdio: false, // STDIO transport disabled by default
                    sse: false, // SSE transport disabled by default  
                    ...config.mcp?.transports,
                    // Ensure sseEndpoint always has a fallback value after merge
                    sseEndpoint: config.mcp?.transports?.sseEndpoint || '/sse'
                },
                auth: {
                    requireAuthForToolsList: false, // tools/list is public by default
                    requireAuthForToolsCall: true, // tools/call requires auth by default
                    publicTools: ['greeting'], // greeting can be public by default
                    ...config.mcp?.auth
                },
                defaultConfig: {
                    enableWebSearchTool: false,
                    enableRefTools: false,
                    enableFilesystemTools: false,
                    ...config.mcp?.defaultConfig
                },
                extensions: config.mcp?.extensions
            },
            ...config
        };
        // Initialize database adapter if token tracking is enabled
        if (this.config.tokenTracking.enabled && this.config.tokenTracking.databaseUrl) {
            this.dbAdapter = new PostgreSQLAdapter(this.config.tokenTracking.databaseUrl);
            this.virtualTokenService = new VirtualTokenService(this.dbAdapter);
            this.usageAnalyticsService = new UsageAnalyticsService(this.dbAdapter);
        }
        // Initialize PostgreSQL RPC Methods if secret manager is configured
        if (this.config.secretManager && this.config.secretManager.encryptionKey) {
            const { type, host, port, database, user, password, encryptionKey } = this.config.secretManager;
            if (type === 'postgresql' && host && port && database && user && password) {
                try {
                    this.postgresRPCMethods = new PostgreSQLRPCMethods({ host, port, database, user, password }, encryptionKey);
                }
                catch (error) {
                    console.error('❌ Failed to initialize PostgreSQL RPC Methods:', error);
                }
            }
        }
        // Initialize JWT middleware if configured
        if (this.config.jwt.secret) {
            this.jwtMiddleware = new JWTMiddleware({
                opensaasPublicKey: this.config.jwt.secret,
                audience: this.config.jwt.audience || 'rpc-ai-backend',
                issuer: this.config.jwt.issuer || 'opensaas',
                skipAuthForMethods: ['health', 'listProviders'],
                requireAuthForAllMethods: false
            });
        }
        // Create router with AI configuration and token tracking
        this.router = createAppRouter(this.config.aiLimits, this.config.tokenTracking.enabled || false, this.dbAdapter, this.config.serverProviders, this.config.byokProviders, this.postgresRPCMethods);
        // Initialize tRPC to JSON-RPC bridge (if JSON-RPC is enabled)
        if (this.config.protocols.jsonRpc) {
            this.jsonRpcBridge = createTRPCToJSONRPCBridge(this.router);
        }
        this.app = express();
        this.setupOAuth();
        this.setupMiddleware();
        this.setupRoutes();
    }
    /**
     * Setup OAuth2 authentication (if configured)
     * Note: Routes are registered later in start() method to avoid catch-all interference
     */
    setupOAuth() {
        if (!this.config.oauth) {
            return;
        }
        console.log(`🔐 Setting up OAuth2 authentication with ${this.config.oauth.provider}...`);
        // Add session middleware (required for OAuth flow)
        this.app.use(session({
            secret: this.config.oauth.encryptionKey || crypto.randomBytes(32).toString('hex'),
            resave: false,
            saveUninitialized: true,
            cookie: {
                secure: false, // Set to true in production with HTTPS
                maxAge: 24 * 60 * 60 * 1000, // 24 hours
                sameSite: 'lax'
            }
        }));
        // Calculate base URL for OAuth (prefer HTTPS for MCP compliance)
        const baseUrl = this.config.oauth.baseUrl || `https://localhost:${this.config.port}`;
        // Ensure redirectUri is set if not provided
        const oauthConfig = {
            ...this.config.oauth,
            redirectUri: this.config.oauth.redirectUri || `${baseUrl}/oauth/callback`,
            baseUrl
        };
        // Initialize OAuth middleware and routes (routes will be registered in start())
        this.oauthMiddleware = createOAuthMiddleware(oauthConfig);
        this.oauthRoutes = createOAuthRoutes(oauthConfig, baseUrl);
        // Use the tokenStorage from the OAuth routes (same instance used by OAuth handlers)
        this.tokenStorage = this.oauthRoutes.tokenStorage;
        // Note: OAuth middleware for MCP endpoint will be applied in start() after JSON parsing
        console.log(`✅ OAuth2 middleware configured (routes will be registered during start())`);
    }
    /**
     * Register OAuth routes (called during start() before catch-all handler)
     */
    setupOAuthRoutes() {
        if (!this.config.oauth || !this.oauthRoutes) {
            return;
        }
        const baseUrl = this.config.oauth.baseUrl || `https://localhost:${this.config.port}`;
        // CORS preflight support for OAuth discovery endpoints
        const corsHandler = (req, res) => {
            res.header('Access-Control-Allow-Origin', '*');
            res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
            res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Accept-Language, Content-Language, Origin');
            res.status(200).send();
        };
        this.app.options('/.well-known/oauth-authorization-server', corsHandler);
        this.app.options('/.well-known/oauth-authorization-server/mcp', corsHandler);
        this.app.options('/.well-known/oauth-protected-resource', corsHandler);
        this.app.options('/.well-known/oauth-protected-resource/mcp', corsHandler);
        this.app.options('/.well-known/openid-configuration', corsHandler);
        this.app.options('/.well-known/openid-configuration/mcp', corsHandler);
        this.app.options('/mcp/.well-known/openid-configuration', corsHandler);
        this.app.options('/.well-known/jwks.json', corsHandler);
        this.app.options('/mcp', corsHandler); // MCP endpoint preflight
        // Setup OAuth discovery and flow routes
        this.app.get('/.well-known/oauth-authorization-server', this.oauthRoutes.authorizationServerDiscovery);
        this.app.get('/.well-known/oauth-authorization-server/mcp', this.oauthRoutes.mcpAuthorizationServerDiscovery);
        this.app.get('/.well-known/oauth-protected-resource', this.oauthRoutes.protectedResourceDiscovery);
        this.app.get('/.well-known/oauth-protected-resource/mcp', this.oauthRoutes.mcpResourceDiscovery);
        this.app.get('/.well-known/openid-configuration', this.oauthRoutes.openidConfiguration);
        this.app.get('/.well-known/openid-configuration/mcp', this.oauthRoutes.openidConfiguration); // MCP-specific alias
        this.app.get('/mcp/.well-known/openid-configuration', this.oauthRoutes.openidConfiguration); // Alternative MCP path
        this.app.get('/.well-known/jwks.json', this.oauthRoutes.jwks);
        // OAuth flow endpoints
        this.app.post('/oauth/register', express.json(), this.oauthRoutes.register);
        this.app.get('/oauth/authorize', this.oauthRoutes.authorize);
        this.app.get('/authorize', this.oauthRoutes.authorize); // Alias for MCP Jam compatibility
        this.app.get('/oauth/callback', this.oauthRoutes.callback);
        this.app.post('/oauth/token', express.json(), this.oauthRoutes.token);
        this.app.post('/token', express.json(), this.oauthRoutes.token); // Alias for MCP Jam compatibility
        console.log(`✅ OAuth2 routes registered:`);
        console.log(`   • Provider: ${this.config.oauth.provider}`);
        console.log(`   • Base URL: ${baseUrl}`);
        console.log(`   • Discovery: ${baseUrl}/.well-known/oauth-authorization-server`);
        console.log(`   • Protected Resource: ${baseUrl}/.well-known/oauth-protected-resource`);
        console.log(`   • Authorization: ${baseUrl}/oauth/authorize (also available at ${baseUrl}/authorize)`);
        console.log(`   • Token: ${baseUrl}/oauth/token (also available at ${baseUrl}/token)`);
        console.log(`   • OpenID Config: ${baseUrl}/.well-known/openid-configuration (also at /mcp/.well-known/openid-configuration)`);
        // Add debug endpoints for token inspection
        this.app.get('/debug/tokens', (req, res) => {
            console.log('🐛 DEBUG: Token inspection requested');
            const storage = this.tokenStorage;
            if (storage && storage.tokens) {
                const tokens = Array.from(storage.tokens.entries()).map((entry) => {
                    const [token, info] = entry;
                    return {
                        token: token.substring(0, 20) + '...',
                        user: info.user?.email,
                        created: new Date(info.created_at).toISOString(),
                        expires_in: info.expires_in
                    };
                });
                res.json({ tokens, count: tokens.length });
            }
            else {
                res.json({ error: 'Token storage not accessible', tokens: [] });
            }
        });
        this.app.get('/debug/latest-token', (req, res) => {
            console.log('🐛 DEBUG: Latest token inspection requested');
            const storage = this.tokenStorage;
            console.log('🐛 DEBUG: tokenStorage exists?', !!storage);
            console.log('🐛 DEBUG: storage.tokens exists?', !!(storage && storage.tokens));
            console.log('🐛 DEBUG: storage.tokens size:', storage && storage.tokens ? storage.tokens.size : 'N/A');
            if (storage && storage.tokens) {
                const entries = Array.from(storage.tokens.entries());
                console.log('🐛 DEBUG: entries length:', entries.length);
                if (entries.length > 0) {
                    const latest = entries[entries.length - 1];
                    res.json({
                        token: latest[0].substring(0, 20) + '...',
                        info: {
                            user: latest[1].user?.email,
                            created_at: latest[1].created_at,
                            expires_in: latest[1].expires_in
                        },
                        created: new Date(latest[1].created_at).toISOString()
                    });
                }
                else {
                    res.json({ error: 'No tokens found' });
                }
            }
            else {
                res.json({ error: 'Token storage not accessible', debug: {
                        storageExists: !!storage,
                        tokensExists: !!(storage && storage.tokens)
                    } });
            }
        });
        this.app.get('/debug/session', (req, res) => {
            console.log('🐛 DEBUG: Session inspection requested');
            const session = req.session;
            res.json({
                sessionID: req.sessionID,
                session: session,
                cookies: req.headers.cookie
            });
        });
        // Apply OAuth middleware to MCP endpoint (after JSON parsing middleware is set up)
        this.app.use('/', (req, res, next) => {
            if (req.method === 'POST' && req.path === '/mcp') {
                return this.oauthMiddleware.mcpAuthMiddleware(req, res, next);
            }
            next();
        });
    }
    setupMiddleware() {
        // Security - with CORS-friendly settings
        this.app.use(helmet({
            crossOriginResourcePolicy: false, // Allow cross-origin for OpenRPC tools
            crossOriginOpenerPolicy: false,
            contentSecurityPolicy: false // Disable CSP for development
        }));
        // CORS - permissive for OpenRPC tools and MCP Jam
        this.app.use(cors({
            origin: this.config.cors.origin,
            credentials: this.config.cors.credentials,
            methods: ['GET', 'POST', 'OPTIONS', 'HEAD', 'PUT', 'DELETE'],
            allowedHeaders: [
                'Content-Type',
                'Authorization',
                'X-Requested-With',
                'Accept',
                'Accept-Language',
                'Content-Language',
                'Origin',
                'X-Session-Id',
                'X-Forwarded-For',
                'X-Real-IP'
            ],
            exposedHeaders: ['WWW-Authenticate'],
            optionsSuccessStatus: 200 // Some legacy browsers choke on 204
        }));
        // Body parsing
        this.app.use(express.json({ limit: '50mb' }));
        this.app.use(express.urlencoded({ extended: true, limit: '50mb' }));
        // JWT Authentication (if enabled)
        if (this.jwtMiddleware) {
            this.app.use(this.jwtMiddleware.authenticate);
        }
        // Rate limiting
        if (this.config.rateLimit.max > 0) {
            this.app.use(rateLimit({
                windowMs: this.config.rateLimit.windowMs,
                max: this.config.rateLimit.max,
                message: {
                    error: 'Too many requests',
                    retryAfter: Math.ceil(this.config.rateLimit.windowMs / 1000)
                },
                standardHeaders: true,
                legacyHeaders: false,
            }));
        }
    }
    setupRoutes() {
        // Health endpoint
        this.app.get(this.config.paths.health, (_req, res) => {
            res.json({
                status: 'healthy',
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                version: '0.1.0',
                protocols: {
                    jsonRpc: this.config.protocols.jsonRpc ? this.config.paths.jsonRpc : null,
                    tRpc: this.config.protocols.tRpc ? this.config.paths.tRpc : null,
                }
            });
        });
        // tRPC endpoint (if enabled)
        if (this.config.protocols.tRpc) {
            this.app.use(this.config.paths.tRpc, trpcExpress.createExpressMiddleware({
                router: this.router,
                createContext: createTRPCContext,
                onError: ({ path, error }) => {
                    console.error(`❌ tRPC failed on ${path ?? "<no-path>"}:`, error);
                },
            }));
        }
        // MCP endpoint will be set up in start() method since it requires async
        // JSON-RPC endpoint (if enabled)
        if (this.config.protocols.jsonRpc) {
            // Handle OPTIONS preflight for CORS
            this.app.options(this.config.paths.jsonRpc, (_req, res) => {
                res.header('Access-Control-Allow-Origin', '*');
                res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
                res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
                res.sendStatus(200);
            });
            // Handle GET requests to RPC endpoint (for discovery/testing)
            this.app.get(this.config.paths.jsonRpc, (_req, res) => {
                res.header('Access-Control-Allow-Origin', '*');
                res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
                res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
                res.json({
                    message: 'JSON-RPC endpoint - use POST method',
                    endpoint: this.config.paths.jsonRpc,
                    methods: [RPC_METHODS.HEALTH, RPC_METHODS.EXECUTE_AI_REQUEST, RPC_METHODS.LIST_PROVIDERS, RPC_METHODS.STORE_USER_KEY, RPC_METHODS.GET_USER_KEY, RPC_METHODS.GET_USER_PROVIDERS, RPC_METHODS.VALIDATE_USER_KEY, RPC_METHODS.ROTATE_USER_KEY, RPC_METHODS.DELETE_USER_KEY],
                    example: {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: { jsonrpc: '2.0', method: 'health', params: [], id: 1 }
                    }
                });
            });
            // Use the tRPC to JSON-RPC bridge instead of manual route handling
            this.app.post(this.config.paths.jsonRpc, this.jsonRpcBridge.createHandler());
        }
        // OpenRPC schema endpoint (for JSON-RPC discovery)
        if (this.config.protocols.jsonRpc && this.jsonRpcBridge) {
            this.app.get('/openrpc.json', (_req, res) => {
                // Explicit CORS headers for OpenRPC tools
                res.header('Access-Control-Allow-Origin', '*');
                res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
                res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
                // Use bridge to generate schema from tRPC router
                const serverUrl = process.env.OPENRPC_SERVER_URL || `http://localhost:${this.config.port}${this.config.paths.jsonRpc}`;
                res.json(this.jsonRpcBridge.generateOpenRPCSchema(serverUrl));
            });
        }
        // Root endpoint - helpful information
        this.app.get('/', (_req, res) => {
            const hardcodedEndpoints = [
                this.config.paths.health,
                this.config.paths.jsonRpc,
                '/openrpc.json',
                this.config.paths.tRpc + '/*'
            ];
            const routes = {};
            if (this.app._router) {
                this.app._router.stack.forEach((layer) => {
                    if (layer.route && layer.route.path) {
                        const path = layer.route.path;
                        if (!hardcodedEndpoints.includes(path)) {
                            const methods = Object.keys(layer.route.methods).map(m => m.toUpperCase());
                            routes[path] = methods;
                        }
                    }
                });
            }
            res.json({
                name: 'Simple RPC AI Backend',
                version: '0.1.0',
                description: 'Unified server supporting both JSON-RPC and tRPC protocols',
                endpoints: {
                    health: this.config.paths.health,
                    ...(this.config.protocols.jsonRpc && {
                        jsonRpc: this.config.paths.jsonRpc,
                        openRpcSchema: '/openrpc.json'
                    }),
                    ...(this.config.protocols.tRpc && {
                        tRpc: this.config.paths.tRpc + '/*'
                    }),
                    mcp: '/mcp',
                    custom: routes
                },
                configuration: {
                    protocols: this.config.protocols,
                    aiLimits: this.config.aiLimits
                }
            });
        });
        // LemonSqueezy webhook endpoint (if token tracking is enabled)
        if (this.config.tokenTracking.enabled && this.virtualTokenService) {
            this.app.post(this.config.tokenTracking.webhookPath, (req, res) => {
                this.handleLemonSqueezyWebhook(req, res);
            });
        }
    }
    /**
     * Handle LemonSqueezy webhook for token top-ups
     */
    async handleLemonSqueezyWebhook(req, res) {
        try {
            const signature = req.headers['x-signature'];
            const body = JSON.stringify(req.body);
            // Verify webhook signature
            if (this.config.tokenTracking.webhookSecret) {
                const expectedSignature = crypto
                    .createHmac('sha256', this.config.tokenTracking.webhookSecret)
                    .update(body)
                    .digest('hex');
                if (signature !== `sha256=${expectedSignature}`) {
                    console.error('❌ Invalid webhook signature');
                    res.status(401).json({ error: 'Invalid signature' });
                    return;
                }
            }
            const webhookData = req.body;
            const { meta, data } = webhookData;
            // Handle successful payments
            if (meta.event_name === 'order_created' && data.attributes.status === 'paid') {
                const userId = data.attributes.user_email; // Use email as user ID for now
                const orderValue = parseInt(data.attributes.order_value); // In cents
                const variantId = data.attributes.variant_id;
                const orderId = data.id;
                const variantName = data.attributes.variant_name || '';
                const productName = data.attributes.product_name || '';
                // Determine purchase type based on variant/product name or other criteria
                const isSubscription = variantName.toLowerCase().includes('subscription') ||
                    productName.toLowerCase().includes('subscription');
                const purchaseType = isSubscription ? 'subscription' : 'one_time';
                // Check if already processed
                if (this.usageAnalyticsService && !(await this.usageAnalyticsService.isPaymentProcessed(orderId))) {
                    // Record purchase in analytics
                    await this.usageAnalyticsService.recordPurchase({
                        userId,
                        paymentId: orderId,
                        purchaseType,
                        variantId,
                        quantity: purchaseType === 'one_time' ? Math.floor(orderValue / 100) : undefined, // Assume $1 = 1 unit for one-time
                        amountPaidCents: orderValue,
                        currency: 'USD',
                        lemonSqueezyData: webhookData
                    });
                    // If it's a token purchase (subscription), also add to virtual token service
                    if (purchaseType === 'subscription' && this.virtualTokenService) {
                        // Calculate tokens based on order value (example: 1 cent = 10 tokens)
                        const tokensPurchased = orderValue * 10;
                        await this.virtualTokenService.addTokensFromPayment(userId, tokensPurchased, orderId, variantId, orderValue, 'USD', webhookData);
                        console.log(`✅ Processed subscription: ${tokensPurchased} tokens for user ${userId}`);
                    }
                    else {
                        console.log(`✅ Processed one-time purchase: $${orderValue / 100} for user ${userId}`);
                    }
                }
            }
            res.status(200).json({ received: true });
        }
        catch (error) {
            console.error('❌ Webhook processing error:', error);
            res.status(500).json({ error: 'Webhook processing failed' });
        }
    }
    /**
     * Setup the new router-based MCP server with configurable transports
     */
    async setupMCPServer() {
        console.log(`🚀 Setting up MCP server...`);
        // Import MCP server components
        const { createMCPServer } = await import('./mcp-server.js');
        const { MCPProtocolHandler } = await import('./trpc/routers/mcp.js');
        // Use the corrected transport configuration from constructor (should be defined by now)
        const transports = this.config.mcp.transports;
        // Create unified MCP server manager
        const mcpServer = createMCPServer({
            name: 'simple-rpc-ai-backend',
            version: '1.0.0',
            enableStdio: transports.stdio,
            enableSSE: transports.sse,
            sseEndpoint: transports.sseEndpoint
        });
        // Setup transports based on configuration
        const enabledTransports = [];
        // HTTP transport (for MCP Jam, testing)
        if (transports.http) {
            const httpHandler = new MCPProtocolHandler(this.router);
            httpHandler.setupMCPEndpoint(this.app, '/mcp');
            enabledTransports.push('HTTP');
        }
        // SSE transport (for web clients)
        if (transports.sse) {
            mcpServer.setupSSE(this.app);
            enabledTransports.push('SSE');
        }
        // STDIO transport (for Claude Desktop) - handled separately since it's blocking
        if (transports.stdio) {
            enabledTransports.push('STDIO');
            console.log(`⚠️  STDIO transport enabled but not started (use standalone server)`);
            console.log(`   Start with: node dist/mcp-stdio-server.js`);
        }
        console.log(`🤖 MCP server ready with tRPC integration:`);
        if (transports.http) {
            console.log(`   • HTTP: http://localhost:${this.config.port}/mcp`);
        }
        if (transports.sse) {
            console.log(`   • SSE: http://localhost:${this.config.port}${transports.sseEndpoint || '/sse'}`);
        }
        if (transports.stdio) {
            console.log(`   • STDIO: node dist/mcp-stdio-server.js`);
        }
        console.log(`   • Transports: ${enabledTransports.join(', ')}`);
        console.log(`   • Auto-discovered tools from tRPC procedures with mcp metadata`);
        console.log(`   • Supports: initialize, ping, tools/list, tools/call, notifications/progress`);
    }
    async start(setupRoutes) {
        // Setup MCP endpoint (always enabled for SDK integration)
        // Setup new router-based MCP server with HTTP transport
        await this.setupMCPServer();
        if (setupRoutes) {
            setupRoutes(this.app);
        }
        // Register OAuth routes (must be before catch-all handler)
        this.setupOAuthRoutes();
        // Catch-all (moved from rpc-ai-server setupRoutes method to run after the custom setup routes - if any)
        // Catch-all 404 middleware — place this LAST
        this.app.use((req, res) => {
            console.log('Requested URL:', req.originalUrl);
            console.log('Matched route:', req.route?.path || '(none)');
            console.log('Method:', req.method);
            res.status(404).json({
                error: 'Not found',
                message: 'This endpoint does not exist.',
                availableEndpoints: {
                    health: this.config.paths.health,
                    ...(this.config.protocols.jsonRpc && { jsonRpc: this.config.paths.jsonRpc }),
                    ...(this.config.protocols.tRpc && { tRpc: this.config.paths.tRpc }),
                    ...(this.config.tokenTracking.enabled && { webhooks: this.config.tokenTracking.webhookPath }),
                    ...(this.config.oauth && {
                        'oauth-authorize': '/oauth/authorize',
                        'oauth-token': '/oauth/token',
                        'oauth-discovery': '/.well-known/oauth-authorization-server',
                        'mcp': '/mcp'
                    })
                }
            });
        });
        return new Promise((resolve, reject) => {
            // Create HTTPS or HTTP server based on configuration
            const useHttps = this.config.https?.enabled;
            const protocol = useHttps ? 'https' : 'http';
            if (useHttps) {
                const keyPath = this.config.https?.keyPath || './certs/key.pem';
                const certPath = this.config.https?.certPath || './certs/cert.pem';
                if (!existsSync(keyPath) || !existsSync(certPath)) {
                    reject(new Error(`HTTPS enabled but certificates not found at ${keyPath} and ${certPath}`));
                    return;
                }
                const httpsOptions = {
                    key: readFileSync(keyPath),
                    cert: readFileSync(certPath)
                };
                this.server = createHttpsServer(httpsOptions, this.app);
            }
            else {
                this.server = createHttpServer(this.app);
            }
            this.server.listen(this.config.port, () => {
                console.log(`🚀 RPC AI Server running on port ${this.config.port} ${useHttps ? '(HTTPS)' : '(HTTP)'}`);
                console.log(`📍 Endpoints:`);
                console.log(`   • Health: GET ${protocol}://localhost:${this.config.port}${this.config.paths.health}`);
                if (this.config.protocols.jsonRpc) {
                    console.log(`   • JSON-RPC: POST ${protocol}://localhost:${this.config.port}${this.config.paths.jsonRpc}`);
                    console.log(`   • OpenRPC Schema: GET ${protocol}://localhost:${this.config.port}/openrpc.json`);
                }
                if (this.config.protocols.tRpc) {
                    console.log(`   • tRPC: POST ${protocol}://localhost:${this.config.port}${this.config.paths.tRpc}/*`);
                }
                console.log(`📋 Configuration:`);
                console.log(`   • Protocols: ${Object.entries(this.config.protocols).filter(([, enabled]) => enabled).map(([name]) => name).join(', ')}`);
                console.log(`   • Rate limit: ${this.config.rateLimit.max} req/${this.config.rateLimit.windowMs / 1000}s`);
                if (this.config.aiLimits.content?.maxLength) {
                    console.log(`   • Content limit: ${this.config.aiLimits.content.maxLength.toLocaleString()} chars`);
                }
                if (this.config.aiLimits.tokens?.maxTokenLimit) {
                    console.log(`   • Token limit: ${this.config.aiLimits.tokens.maxTokenLimit.toLocaleString()}`);
                }
                if (this.config.tokenTracking.enabled) {
                    console.log(`   • Token tracking: enabled (${this.config.tokenTracking.platformFeePercent}% platform fee)`);
                    console.log(`   • Webhook: ${this.config.tokenTracking.webhookPath}`);
                }
                if (this.jwtMiddleware) {
                    console.log(`   • JWT authentication: enabled`);
                }
                resolve();
            });
            this.server.on('error', reject);
        });
    }
    async stop() {
        return new Promise((resolve) => {
            if (this.server) {
                this.server.close(() => {
                    console.log('✅ Server stopped');
                    resolve();
                });
            }
            else {
                resolve();
            }
        });
    }
    getApp() {
        return this.app;
    }
    getRouter() {
        return this.router;
    }
    createServiceProvidersConfig(providers) {
        const config = {};
        const builtInProviders = ['anthropic', 'openai', 'google'];
        providers.forEach((provider, index) => {
            if (builtInProviders.includes(provider)) {
                // Built-in provider - get API key from environment variables
                let apiKey;
                switch (provider) {
                    case 'anthropic':
                        apiKey = process.env.ANTHROPIC_API_KEY;
                        break;
                    case 'openai':
                        apiKey = process.env.OPENAI_API_KEY;
                        break;
                    case 'google':
                        apiKey = process.env.GOOGLE_API_KEY;
                        break;
                }
                config[provider] = {
                    priority: index + 1,
                    ...(apiKey && { apiKey })
                };
            }
            else {
                // Custom provider - find in customProviders config
                const customProvider = this.config.customProviders?.find(cp => cp.name === provider);
                if (customProvider) {
                    config[provider] = {
                        priority: index + 1,
                        custom: true,
                        ...customProvider
                    };
                }
                else {
                    console.warn(`Custom provider '${provider}' not found in customProviders config`);
                }
            }
        });
        return config;
    }
    getConfig() {
        return this.config;
    }
}
// Helper function to create type-safe config with const assertions
export function defineRpcAiServerConfig(config) {
    return config;
}
// Factory function for easy usage
export function createRpcAiServer(config = {}) {
    return new RpcAiServer(config);
}
