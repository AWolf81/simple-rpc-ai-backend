/**
 * RPC AI Server
 *
 * One server that supports both JSON-RPC and tRPC endpoints for AI applications.
 * Provides simple configuration for basic use cases and advanced options for complex scenarios.
 */
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import * as trpcExpress from '@trpc/server/adapters/express';
import crypto from 'crypto';
import { createAppRouter } from './trpc/root.js';
import { createTRPCContext } from './trpc/index.js';
import { AIService } from './services/ai-service.js';
import { JWTMiddleware } from './auth/jwt-middleware.js';
import { PostgreSQLAdapter } from './database/postgres-adapter.js';
import { VirtualTokenService } from './services/virtual-token-service.js';
import { UsageAnalyticsService } from './services/usage-analytics-service.js';
export class RpcAiServer {
    app;
    server;
    config;
    router;
    aiService;
    jwtMiddleware;
    dbAdapter;
    virtualTokenService;
    usageAnalyticsService;
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
            cors: {
                origin: '*',
                credentials: false,
                ...config.cors
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
            ...config
        };
        // Initialize database adapter if token tracking is enabled
        if (this.config.tokenTracking.enabled && this.config.tokenTracking.databaseUrl) {
            this.dbAdapter = new PostgreSQLAdapter(this.config.tokenTracking.databaseUrl);
            this.virtualTokenService = new VirtualTokenService(this.dbAdapter);
            this.usageAnalyticsService = new UsageAnalyticsService(this.dbAdapter);
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
        this.router = createAppRouter(this.config.aiLimits, this.config.tokenTracking.enabled || false, this.dbAdapter, this.config.serverProviders, this.config.byokProviders);
        // Initialize AI service for JSON-RPC endpoint with configured providers
        this.aiService = new AIService({
            serviceProviders: this.createServiceProvidersConfig(this.config.serverProviders)
        });
        this.app = express();
        this.setupMiddleware();
        this.setupRoutes();
    }
    setupMiddleware() {
        // Security
        this.app.use(helmet());
        // CORS
        this.app.use(cors({
            origin: this.config.cors.origin,
            credentials: this.config.cors.credentials,
            methods: ['GET', 'POST', 'OPTIONS'],
            allowedHeaders: ['Content-Type', 'Authorization']
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
        // JSON-RPC endpoint (if enabled)
        if (this.config.protocols.jsonRpc) {
            this.app.post(this.config.paths.jsonRpc, async (req, res) => {
                try {
                    const { method, params, id } = req.body;
                    // Handle JSON-RPC methods compatible with tRPC
                    switch (method) {
                        case 'health':
                        case 'ai.health':
                            return res.json({
                                jsonrpc: '2.0',
                                id,
                                result: {
                                    status: 'healthy',
                                    timestamp: new Date().toISOString(),
                                    uptime: process.uptime()
                                }
                            });
                        case 'executeAIRequest':
                        case 'ai.executeAIRequest': {
                            const { content, systemPrompt, options } = params;
                            if (!content || !systemPrompt) {
                                return res.json({
                                    jsonrpc: '2.0',
                                    id,
                                    error: {
                                        code: -32602,
                                        message: 'Invalid params: content and systemPrompt are required'
                                    }
                                });
                            }
                            const result = await this.aiService.execute({
                                content,
                                systemPrompt,
                                options
                            });
                            return res.json({
                                jsonrpc: '2.0',
                                id,
                                result: {
                                    success: true,
                                    data: result
                                }
                            });
                        }
                        case 'listProviders':
                        case 'ai.listProviders':
                            return res.json({
                                jsonrpc: '2.0',
                                id,
                                result: {
                                    providers: [
                                        {
                                            name: 'anthropic',
                                            models: ['claude-3-5-sonnet-20241022', 'claude-3-haiku-20240307'],
                                            priority: 1,
                                        },
                                        {
                                            name: 'openai',
                                            models: ['gpt-4o', 'gpt-4o-mini', 'gpt-3.5-turbo'],
                                            priority: 2,
                                        },
                                        {
                                            name: 'google',
                                            models: ['gemini-1.5-pro', 'gemini-1.5-flash'],
                                            priority: 3,
                                        },
                                    ],
                                }
                            });
                        default:
                            return res.json({
                                jsonrpc: '2.0',
                                id,
                                error: {
                                    code: -32601,
                                    message: `Method not found: ${method}`
                                }
                            });
                    }
                }
                catch (error) {
                    return res.status(500).json({
                        jsonrpc: '2.0',
                        id: req.body?.id || null,
                        error: {
                            code: -32603,
                            message: `Internal error: ${error instanceof Error ? error.message : 'Unknown error'}`
                        }
                    });
                }
            });
        }
        // OpenRPC schema endpoint (for JSON-RPC discovery)
        if (this.config.protocols.jsonRpc) {
            this.app.get('/openrpc.json', (_req, res) => {
                res.json(this.getOpenRPCSchema());
            });
        }
        // Root endpoint - helpful information
        this.app.get('/', (req, res) => {
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
                    })
                },
                configuration: {
                    protocols: this.config.protocols,
                    aiLimits: this.config.aiLimits,
                }
            });
        });
        // LemonSqueezy webhook endpoint (if token tracking is enabled)
        if (this.config.tokenTracking.enabled && this.virtualTokenService) {
            this.app.post(this.config.tokenTracking.webhookPath, (req, res) => {
                this.handleLemonSqueezyWebhook(req, res);
            });
        }
        // Catch all
        this.app.use('*', (_req, res) => {
            res.status(404).json({
                error: 'Not found',
                message: 'This endpoint does not exist.',
                availableEndpoints: {
                    health: this.config.paths.health,
                    ...(this.config.protocols.jsonRpc && { jsonRpc: this.config.paths.jsonRpc }),
                    ...(this.config.protocols.tRpc && { tRpc: this.config.paths.tRpc }),
                    ...(this.config.tokenTracking.enabled && { webhooks: this.config.tokenTracking.webhookPath })
                }
            });
        });
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
    getOpenRPCSchema() {
        return {
            openrpc: "1.2.6",
            info: {
                title: "Simple RPC AI Backend",
                description: "Unified AI server with system prompt protection",
                version: "0.1.0"
            },
            servers: [{
                    name: "Unified AI Server",
                    url: `http://localhost:${this.config.port}${this.config.paths.jsonRpc}`,
                    description: "JSON-RPC endpoint"
                }],
            methods: [
                {
                    name: "health",
                    description: "Check server health",
                    params: [],
                    result: {
                        name: "healthResult",
                        schema: {
                            type: "object",
                            properties: {
                                status: { type: "string" },
                                timestamp: { type: "string" },
                                uptime: { type: "number" }
                            }
                        }
                    }
                },
                {
                    name: "executeAIRequest",
                    description: "Execute AI request with system prompt protection",
                    params: [
                        {
                            name: "content",
                            required: true,
                            schema: { type: "string" }
                        },
                        {
                            name: "systemPrompt",
                            required: true,
                            schema: { type: "string" }
                        },
                        {
                            name: "options",
                            required: false,
                            schema: {
                                type: "object",
                                properties: {
                                    model: { type: "string" },
                                    maxTokens: { type: "number" },
                                    temperature: { type: "number" }
                                }
                            }
                        }
                    ],
                    result: {
                        name: "aiResult",
                        schema: {
                            type: "object",
                            properties: {
                                success: { type: "boolean" },
                                data: { type: "object" }
                            }
                        }
                    }
                }
            ]
        };
    }
    async start() {
        return new Promise((resolve, reject) => {
            this.server = this.app.listen(this.config.port, () => {
                console.log(`🚀 RPC AI Server running on port ${this.config.port}`);
                console.log(`📍 Endpoints:`);
                console.log(`   • Health: GET http://localhost:${this.config.port}${this.config.paths.health}`);
                if (this.config.protocols.jsonRpc) {
                    console.log(`   • JSON-RPC: POST http://localhost:${this.config.port}${this.config.paths.jsonRpc}`);
                    console.log(`   • OpenRPC Schema: GET http://localhost:${this.config.port}/openrpc.json`);
                }
                if (this.config.protocols.tRpc) {
                    console.log(`   • tRPC: POST http://localhost:${this.config.port}${this.config.paths.tRpc}/*`);
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
                // Built-in provider - use standard config
                config[provider] = { priority: index + 1 };
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
//# sourceMappingURL=rpc-ai-server.js.map