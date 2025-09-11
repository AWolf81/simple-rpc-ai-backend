/**
 * RPC AI Server
 * 
 * One server that supports both JSON-RPC and tRPC endpoints for AI applications.
 * Provides simple configuration for basic use cases and advanced options for complex scenarios.
 */

import 'dotenv/config';
import express from 'express';
import type { Express, Request, Response, Application } from 'express';
import type { Server } from 'http';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import * as trpcExpress from '@trpc/server/adapters/express';
import crypto from 'crypto';

import { createAppRouter } from './trpc/root';
import { createTRPCContext } from './trpc/index';
import type { AppRouter } from './trpc/root';
import type { AIRouterConfig } from './trpc/routers/ai';
import { JWTMiddleware } from './auth/jwt-middleware';
import { PostgreSQLAdapter } from './database/postgres-adapter';
import { VirtualTokenService } from './services/virtual-token-service';
import { UsageAnalyticsService } from './services/usage-analytics-service';
import { PostgreSQLRPCMethods } from './auth/PostgreSQLRPCMethods';
import { RPC_METHODS } from './constants';
import { createTRPCToJSONRPCBridge } from './trpc/trpc-to-jsonrpc-bridge';
import { MCPExtensionConfig } from './mcp/mcp-config';

// Built-in provider types
export type BuiltInProvider = 'anthropic' | 'openai' | 'google';

// Custom provider interface
export interface CustomProvider {
  name: string;                          // e.g. 'deepseek', 'claude-custom'
  baseUrl: string;                       // Custom API endpoint
  apiKeyHeader?: string;                 // Default: 'Authorization'  
  apiKeyPrefix?: string;                 // Default: 'Bearer '
  modelMapping?: Record<string, string>; // Map generic -> provider-specific models
  defaultModel?: string;                 // Default model to use
  requestTransform?: (req: unknown) => unknown;  // Transform request format
  responseTransform?: (res: unknown) => unknown; // Transform response format
}

// More practical approach: Use const assertions for type safety
export interface RpcAiServerConfig {
  // Basic settings
  port?: number;
  
  // AI Configuration
  aiLimits?: AIRouterConfig;
  serverProviders?: (BuiltInProvider | string)[];    // Built-in providers + custom names
  byokProviders?: (BuiltInProvider | string)[];      // Built-in providers + custom names  
  customProviders?: CustomProvider[];                // Register custom providers
  systemPrompts?: Record<string, string>;           // Custom system prompt definitions
  
  // Secret Manager Configuration (for BYOK key storage)
  secretManager?: {
    type?: 'postgresql';
    host?: string;
    port?: number;
    database?: string;
    user?: string;
    password?: string;
    encryptionKey?: string;
  };
  
  // Protocol support
  protocols?: {
    jsonRpc?: boolean;    // Enable JSON-RPC endpoint (default: true)
    tRpc?: boolean;       // Enable tRPC endpoint (default: false)
  };
  
  // Token tracking & monetization
  tokenTracking?: {
    enabled?: boolean;                    // Default: false
    platformFeePercent?: number;          // Default: 25 (20% of total charge)
    databaseUrl?: string;                 // PostgreSQL connection string
    webhookSecret?: string;               // LemonSqueezy webhook secret
    webhookPath?: string;                 // Default: '/webhooks/lemonsqueezy'
  };
  
  // JWT Authentication (for token tracking)
  jwt?: {
    secret?: string;                      // JWT secret from OpenSaaS
    issuer?: string;                      // Expected issuer (OpenSaaS)
    audience?: string;                    // Expected audience (your service)
  };
  
  // Network settings
  cors?: {
    origin?: string | string[];
    credentials?: boolean;
  };
  
  // Security & rate limiting
  rateLimit?: {
    windowMs?: number;
    max?: number;
  };
  
  // Custom paths
  paths?: {
    jsonRpc?: string;     // Default: '/rpc'
    tRpc?: string;        // Default: '/trpc'
    health?: string;      // Default: '/health'
    webhooks?: string;    // Default: '/webhooks/lemonsqueezy'
  };

  // MCP configuration
  mcp?: {
    enableMCP?: boolean;
    transports?: {
      http?: boolean;        // HTTP transport (default: true)
      stdio?: boolean;       // STDIO transport for Claude Desktop (default: false)  
      sse?: boolean;         // Server-Sent Events transport (default: false)
      sseEndpoint?: string;  // SSE endpoint path (default: '/sse')
    };
    auth?: {
      requireAuthForToolsList?: boolean;  // Default: false (tools/list is public)
      requireAuthForToolsCall?: boolean;  // Default: true (tools/call requires auth)
      publicTools?: string[];             // Tools that don't require auth (even if requireAuthForToolsCall = true)
    };
    defaultConfig?: {
      enableWebSearchTool?: boolean;   // build-in websearch tool
      enableRefTools?: boolean;        // Documentation search
      enableFilesystemTools?: boolean; // Disabled for security
    };
    
    /**
     * MCP extensions configuration - customize prompts and resources
     */
    extensions?: MCPExtensionConfig;
  }
}

export class RpcAiServer {
  private app: Express;
  private server?: Server;
  private config: Required<RpcAiServerConfig>;
  private router: AppRouter;
  private jwtMiddleware?: JWTMiddleware;
  private dbAdapter?: PostgreSQLAdapter;
  private virtualTokenService?: VirtualTokenService;
  private usageAnalyticsService?: UsageAnalyticsService;
  private postgresRPCMethods?: PostgreSQLRPCMethods;
  private jsonRpcBridge?: ReturnType<typeof createTRPCToJSONRPCBridge>;

  /**
   * Opinionated protocol configuration:
   * - Default: JSON-RPC only (simpler, universal)
   * - If only one protocol specified as true, disable the other
   * - If both explicitly specified, use provided values
   */
  private getOpinionatedProtocols(protocols?: { jsonRpc?: boolean; tRpc?: boolean }) {
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

  constructor(config: RpcAiServerConfig = {}) {
    // Opinionated protocol defaults
    const protocols = this.getOpinionatedProtocols(config.protocols);
    
    // Set smart defaults
    this.config = {
      port: 8000,
      aiLimits: {},
      serverProviders: ['anthropic'],  // Default: Anthropic only for easier onboarding
      byokProviders: ['anthropic'],    // Default: Anthropic BYOK only
      customProviders: [],             // Default: no custom providers
      systemPrompts: config.systemPrompts || {},  // Default: use built-in prompts
      secretManager: {},               // Default: no secret manager
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
      mcp: {
        enableMCP: config.mcp?.enableMCP || false,
        transports: {
          http: true,    // HTTP transport enabled by default
          stdio: false,  // STDIO transport disabled by default
          sse: false,    // SSE transport disabled by default  
          sseEndpoint: '/sse',
          ...config.mcp?.transports
        },
        auth: {
          requireAuthForToolsList: false,  // tools/list is public by default
          requireAuthForToolsCall: true,   // tools/call requires auth by default
          publicTools: ['greeting'],       // greeting can be public by default
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
          this.postgresRPCMethods = new PostgreSQLRPCMethods(
            { host, port, database, user, password },
            encryptionKey
          );
        } catch (error) {
          console.error('❌ Failed to initialize PostgreSQL RPC Methods:', error);
        }
      }
    }

    // Initialize JWT middleware if configured
    if (this.config.jwt.secret) {
      console.log('🔧 JWT Config:', { 
        secret: this.config.jwt.secret?.slice(0, 10) + '...', 
        audience: this.config.jwt.audience, 
        issuer: this.config.jwt.issuer 
      });
      this.jwtMiddleware = new JWTMiddleware({
        opensaasPublicKey: this.config.jwt.secret,
        audience: this.config.jwt.audience!,
        issuer: this.config.jwt.issuer!,
        skipAuthForMethods: ['health', 'listProviders'],
        requireAuthForAllMethods: false
      });
    }

    // Create router with AI configuration and token tracking
    this.router = createAppRouter(
      this.config.aiLimits,
      this.config.tokenTracking.enabled || false,
      this.dbAdapter,
      this.config.serverProviders,
      this.config.byokProviders,
      this.postgresRPCMethods
    );

    // Initialize tRPC to JSON-RPC bridge (if JSON-RPC is enabled)
    if (this.config.protocols.jsonRpc) {
      this.jsonRpcBridge = createTRPCToJSONRPCBridge(this.router);
    }

    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware() {
    // Security - with CORS-friendly settings
    this.app.use(helmet({
      crossOriginResourcePolicy: false, // Allow cross-origin for OpenRPC tools
      crossOriginOpenerPolicy: false,
      contentSecurityPolicy: false // Disable CSP for development
    }));
    
    // CORS - permissive for OpenRPC tools
    this.app.use(cors({
      origin: this.config.cors.origin,
      credentials: this.config.cors.credentials,
      methods: ['GET', 'POST', 'OPTIONS', 'HEAD'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
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
    if (this.config.rateLimit.max! > 0) {
      this.app.use(rateLimit({
        windowMs: this.config.rateLimit.windowMs!,
        max: this.config.rateLimit.max!,
        message: {
          error: 'Too many requests',
          retryAfter: Math.ceil(this.config.rateLimit.windowMs! / 1000)
        },
        standardHeaders: true,
        legacyHeaders: false,
      }));
    }
  }

  private setupRoutes() {
    // Health endpoint
    this.app.get(this.config.paths.health!, (_req: Request, res: Response) => {
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
      this.app.use(
        this.config.paths.tRpc!,
        trpcExpress.createExpressMiddleware({
          router: this.router,
          createContext: createTRPCContext,
          onError: ({ path, error }) => {
            console.error(`❌ tRPC failed on ${path ?? "<no-path>"}:`, error);
          },
        })
      );

    }

    // MCP endpoint will be set up in start() method since it requires async

    // JSON-RPC endpoint (if enabled)
    if (this.config.protocols.jsonRpc) {
      // Handle OPTIONS preflight for CORS
      this.app.options(this.config.paths.jsonRpc!, (_req: Request, res: Response) => {
        res.header('Access-Control-Allow-Origin', '*');
        res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        res.sendStatus(200);
      });

      // Handle GET requests to RPC endpoint (for discovery/testing)
      this.app.get(this.config.paths.jsonRpc!, (_req: Request, res: Response) => {
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
      this.app.post(this.config.paths.jsonRpc!, this.jsonRpcBridge!.createHandler());
    }

    // OpenRPC schema endpoint (for JSON-RPC discovery)
    if (this.config.protocols.jsonRpc && this.jsonRpcBridge) {
      this.app.get('/openrpc.json', (_req: Request, res: Response) => {
        // Explicit CORS headers for OpenRPC tools
        res.header('Access-Control-Allow-Origin', '*');
        res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        
        // Use bridge to generate schema from tRPC router
        const serverUrl = process.env.OPENRPC_SERVER_URL || `http://localhost:${this.config.port}${this.config.paths.jsonRpc}`;
        res.json(this.jsonRpcBridge!.generateOpenRPCSchema(serverUrl));
      });
    }

    // Root endpoint - helpful information
    this.app.get('/', (_req: Request, res: Response) => {
      const hardcodedEndpoints = [
        this.config.paths.health,
        this.config.paths.jsonRpc,
        '/openrpc.json',
        this.config.paths.tRpc + '/*'
      ];

      const routes: Record<string, string[]> = {};

      if ((this.app as any)._router) {
        (this.app as any)._router.stack.forEach((layer: { route?: { path: string; methods: Record<string, boolean> } }) => {
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
      this.app.post(this.config.tokenTracking.webhookPath!, (req: Request, res: Response) => {
        this.handleLemonSqueezyWebhook(req, res);
      });
    }
  }

  /**
   * Handle LemonSqueezy webhook for token top-ups
   */
  private async handleLemonSqueezyWebhook(req: Request, res: Response): Promise<void> {
    try {
      const signature = req.headers['x-signature'] as string;
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
            
            await this.virtualTokenService.addTokensFromPayment(
              userId,
              tokensPurchased,
              orderId,
              variantId,
              orderValue,
              'USD',
              webhookData
            );

            console.log(`✅ Processed subscription: ${tokensPurchased} tokens for user ${userId}`);
          } else {
            console.log(`✅ Processed one-time purchase: $${orderValue / 100} for user ${userId}`);
          }
        }
      }

      res.status(200).json({ received: true });
    } catch (error) {
      console.error('❌ Webhook processing error:', error);
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  }



  /**
   * Setup the new router-based MCP server with configurable transports
   */
  private async setupMCPServer(): Promise<void> {
    console.log(`🚀 Setting up MCP server...`);

    // Import MCP server components
    const { createMCPServer } = await import('./mcp-server.js');
    const { MCPProtocolHandler } = await import('./trpc/routers/mcp.js');

    const transports = this.config.mcp.transports || {
      http: true,
      stdio: false,
      sse: false,
      sseEndpoint: '/sse'
    };

    // Create unified MCP server manager
    const mcpServer = createMCPServer({
      name: 'simple-rpc-ai-backend',
      version: '1.0.0',
      enableStdio: transports.stdio,
      enableSSE: transports.sse,
      sseEndpoint: transports.sseEndpoint
    });

    // Setup transports based on configuration
    const enabledTransports: string[] = [];

    // HTTP transport (for MCP Jam, testing)
    if (transports.http) {
      const httpHandler = new MCPProtocolHandler(this.router, {
        jwtMiddleware: this.jwtMiddleware,
        auth: this.config.mcp.auth,
        // Pass additional config if available (for tests)
        ...(this.config.mcp as any).rateLimiting && { rateLimiting: (this.config.mcp as any).rateLimiting },
        ...(this.config.mcp as any).securityLogging && { securityLogging: (this.config.mcp as any).securityLogging },
        ...(this.config.mcp as any).authEnforcement && { authEnforcement: (this.config.mcp as any).authEnforcement }
      });
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
      console.log(`   • SSE: http://localhost:${this.config.port}${transports.sseEndpoint}`);
    }
    if (transports.stdio) {
      console.log(`   • STDIO: node dist/mcp-stdio-server.js`);
    }
    console.log(`   • Transports: ${enabledTransports.join(', ')}`);
    console.log(`   • Auto-discovered tools from tRPC procedures with mcp metadata`);
    console.log(`   • Supports: initialize, ping, tools/list, tools/call, notifications/progress`);
  }

  public async start(setupRoutes?: (app: Application) => void): Promise<void> {
    // Setup MCP endpoint (always enabled for SDK integration)
    
    // Setup new router-based MCP server with HTTP transport
    await this.setupMCPServer();

    if (setupRoutes) {
      setupRoutes(this.app);
    }

    // Catch-all (moved from rpc-ai-server setupRoutes method to run after the custom setup routes - if any)
    // Catch-all 404 middleware — place this LAST
    this.app.use((req: Request, res: Response) => {    
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
          ...(this.config.tokenTracking.enabled && { webhooks: this.config.tokenTracking.webhookPath })
        }
      });
    });

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
        console.log(`   • Protocols: ${Object.entries(this.config.protocols).filter(([,enabled]) => enabled).map(([name]) => name).join(', ')}`);
        console.log(`   • Rate limit: ${this.config.rateLimit.max} req/${this.config.rateLimit.windowMs!/1000}s`);
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

  public async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          console.log('✅ Server stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  public getApp(): Express {
    return this.app;
  }

  public getRouter(): AppRouter {
    return this.router;
  }

  private createServiceProvidersConfig(providers: (BuiltInProvider | string)[]): Record<string, unknown> {
    const config: Record<string, unknown> = {};
    const builtInProviders: BuiltInProvider[] = ['anthropic', 'openai', 'google'];
    
    providers.forEach((provider, index) => {
      if (builtInProviders.includes(provider as BuiltInProvider)) {
        // Built-in provider - get API key from environment variables
        let apiKey: string | undefined;
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
      } else {
        // Custom provider - find in customProviders config
        const customProvider = this.config.customProviders?.find(cp => cp.name === provider);
        if (customProvider) {
          config[provider] = { 
            priority: index + 1,
            custom: true,
            ...customProvider
          };
        } else {
          console.warn(`Custom provider '${provider}' not found in customProviders config`);
        }
      }
    });
    return config;
  }

  public getConfig(): Required<RpcAiServerConfig> {
    return this.config;
  }
}

// Helper function to create type-safe config with const assertions
export function defineRpcAiServerConfig(config: RpcAiServerConfig): RpcAiServerConfig {
  return config;
}

// Factory function for easy usage
export function createRpcAiServer(config: RpcAiServerConfig = {}): RpcAiServer {
  return new RpcAiServer(config);
}

// Export types
export type { AppRouter };