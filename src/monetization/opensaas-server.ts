import express from 'express';
import type { Express, Request, Response, NextFunction } from 'express';
import type { Server } from 'http';
import cors from 'cors';
import helmet from 'helmet';

// Import OpenSaaS monetization components
import { JWTMiddleware, type AuthenticatedRequest, mergeWithDefaultTiers } from '../auth/jwt-middleware.js';
import { RateLimiter } from '../middleware/rate-limiter.js';
import { UsageTracker } from '../billing/usage-tracker.js';
import { BillingEngine } from '../billing/billing-engine.js';
import { PostgreSQLAdapter } from '../database/postgres-adapter.js';

// Import existing server components
import { AIService } from '../services/ai-service.js';
import { FunctionRegistry } from '../services/function-registry.js';
import { PromptManager, promptManager } from '../services/prompt-manager.js';

// Import configuration
import type { MonetizedAIServerConfig, OpenSaaSMonetizationConfig } from './opensaas-config.js';
import { mergeOpenSaaSConfig, validateOpenSaaSConfig } from './opensaas-config.js';

export interface MonetizedServerInstance {
  app: Express;
  functionRegistry: FunctionRegistry;
  promptManager: PromptManager;
  usageTracker: UsageTracker;
  billingEngine: BillingEngine;
  rateLimiter: RateLimiter;
  start: (port?: number) => Server;
  stop: () => Promise<void>;
}

/**
 * Create a monetized AI server with OpenSaaS integration
 */
export async function createMonetizedAIServer(config: MonetizedAIServerConfig): Promise<MonetizedServerInstance> {
  const app = express();
  const port = config.port ?? 8000;

  // Validate OpenSaaS configuration
  if (!config.opensaasMonetization) {
    throw new Error('OpenSaaS monetization configuration is required');
  }

  const opensaasConfig = mergeOpenSaaSConfig(config.opensaasMonetization);
  validateOpenSaaSConfig(opensaasConfig);

  // Initialize database - convert config format to PostgreSQL format
  const dbConfig = config.database ? {
    host: config.database.host || 'localhost',
    port: config.database.port || 5432,
    database: config.database.database || 'ai_backend',
    user: config.database.user || 'postgres',
    password: config.database.password || 'password'
  } : {
    host: 'localhost',
    port: 5432,
    database: 'ai_backend',
    user: 'postgres',
    password: 'password'
  };
  const db = new PostgreSQLAdapter(dbConfig);
  await db.initialize();

  // Initialize AI service
  let aiService: AIService;
  try {
    aiService = new AIService(config);
  } catch (error: any) {
    console.warn(`⚠️  AI Service initialization failed: ${error.message}`);
    aiService = null as any;
  }

  // Initialize monetization components
  const usageTracker = new UsageTracker(db, opensaasConfig.billing.platformFee.percentage / 100);
  await usageTracker.initialize();

  const billingEngine = new BillingEngine(db, usageTracker, opensaasConfig.billing);
  await billingEngine.initialize();

  // Merge custom tiers with defaults
  const mergedTiers = mergeWithDefaultTiers(opensaasConfig.subscriptionTiers);

  // Initialize JWT middleware
  const jwtMiddleware = new JWTMiddleware({
    opensaasPublicKey: opensaasConfig.opensaas.publicKey,
    audience: opensaasConfig.opensaas.audience,
    issuer: opensaasConfig.opensaas.issuer,
    clockTolerance: opensaasConfig.opensaas.clockTolerance,
    skipAuthForMethods: opensaasConfig.authentication?.skipAuthForMethods,
    requireAuthForAllMethods: opensaasConfig.authentication?.requireAuthForAllMethods,
    subscriptionTiers: mergedTiers
  });

  // Initialize rate limiter
  const rateLimiter = new RateLimiter({
    ...opensaasConfig.rateLimiting,
    subscriptionTiers: mergedTiers
  });

  // Initialize function registry
  const functionRegistry = new FunctionRegistry(aiService);

  // Load system prompts
  if (config.systemPrompts) {
    for (const [promptId, promptConfig] of Object.entries(config.systemPrompts)) {
      if (typeof promptConfig === 'string') {
        promptManager.registerPrompt({
          id: promptId,
          name: promptId,
          description: `Custom prompt: ${promptId}`,
          systemPrompt: promptConfig,
          variables: [],
          category: 'custom'
        });
      }
    }
  }

  // Middleware setup
  app.use(helmet());
  app.use(cors({
    origin: config.cors?.origin ?? ['vscode-webview://*', 'http://localhost:*', 'https://localhost:*'],
    credentials: config.cors?.credentials ?? true
  }));
  app.use(express.json({ limit: '10mb' }));

  // Request logging
  app.use((req, res, next) => {
    console.log(`📥 ${req.method} ${req.path} from ${req.headers.origin || 'unknown'}`);
    next();
  });

  // Health check endpoint (no auth required)
  app.get('/health', async (req, res) => {
    try {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'Monetized AI Backend',
        features: ['opensaas_auth', 'usage_tracking', 'rate_limiting', 'billing'],
        subscriptionTiers: Object.keys(mergedTiers)
      });
    } catch (error: any) {
      res.status(500).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error.message
      });
    }
  });

  // Configuration endpoint (no auth required)
  app.get('/config', (req, res) => {
    res.json({
      service: 'Monetized AI Backend',
      version: '1.0.0',
      rpcEndpoint: '/rpc',
      supportedMethods: [
        'executeAIRequest', 'getUsageStats', 'checkQuotaStatus', 'health', 'rpc.discover'
      ],
      subscriptionTiers: Object.keys(mergedTiers),
      features: {
        opensaasAuth: true,
        usageTracking: true,
        rateLimiting: true,
        billing: true,
        customTiers: true
      },
      billing: {
        provider: opensaasConfig.billing.billingProvider,
        platformFeePercentage: opensaasConfig.billing.platformFee.percentage
      }
    });
  });

  // Webhook endpoints for payment providers
  app.post('/webhooks/opensaas', express.raw({ type: 'application/json' }), async (req, res) => {
    try {
      const signature = req.headers['x-opensaas-signature'] as string;
      await billingEngine.processWebhook('opensaas', req.body, signature);
      res.status(200).json({ received: true });
    } catch (error: any) {
      console.error('OpenSaaS webhook error:', error.message);
      res.status(400).json({ error: 'Webhook processing failed' });
    }
  });

  app.post('/webhooks/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
    try {
      const signature = req.headers['stripe-signature'] as string;
      await billingEngine.processWebhook('stripe', req.body, signature);
      res.status(200).json({ received: true });
    } catch (error: any) {
      console.error('Stripe webhook error:', error.message);
      res.status(400).json({ error: 'Webhook processing failed' });
    }
  });

  app.post('/webhooks/lemonsqueezy', express.raw({ type: 'application/json' }), async (req, res) => {
    try {
      const signature = req.headers['x-signature'] as string;
      await billingEngine.processWebhook('lemonsqueezy', req.body, signature);
      res.status(200).json({ received: true });
    } catch (error: any) {
      console.error('LemonSqueezy webhook error:', error.message);
      res.status(400).json({ error: 'Webhook processing failed' });
    }
  });

  // Apply rate limiting middleware
  app.use('/rpc', rateLimiter.middleware());

  // Apply JWT authentication middleware
  app.use('/rpc', jwtMiddleware.authenticate);

  // Input validation for RPC requests
  app.use('/rpc', (req: any, res: any, next: any) => {
    const { jsonrpc, id, method, params } = req.body;

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

    if (!method || typeof method !== 'string') {
      return res.status(400).json({
        id,
        error: { code: -32600, message: 'Invalid Request - method must be a non-empty string' }
      });
    }

    if (!/^[a-zA-Z0-9._]+$/.test(method)) {
      return res.status(400).json({
        id,
        error: { code: -32600, message: 'Invalid Request - method contains invalid characters' }
      });
    }

    if (params !== undefined && (typeof params !== 'object' || params === null)) {
      return res.status(400).json({
        id,
        error: { code: -32600, message: 'Invalid Request - params must be an object or array' }
      });
    }

    next();
  });

  // Main RPC endpoint
  app.post('/rpc', async (req: AuthenticatedRequest, res: Response) => {
    const { id, method, params } = req.body;

    try {
      let result: any;

      switch (method) {
        case 'executeAIRequest':
          result = await handleMonetizedAIRequest(
            params, 
            req, 
            aiService, 
            usageTracker, 
            billingEngine, 
            rateLimiter,
            mergedTiers
          );
          break;

        case 'getUsageStats':
          result = await handleGetUsageStats(params, req, usageTracker);
          break;

        case 'checkQuotaStatus':
          result = await handleCheckQuotaStatus(req, usageTracker);
          break;

        case 'health':
          result = { status: 'healthy', timestamp: new Date().toISOString() };
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
          // Check custom functions
          if (functionRegistry.hasFunction(method)) {
            if (opensaasConfig.authentication?.requireAuthForAllMethods && !req.authContext) {
              throw new Error('Authentication required for custom functions');
            }
            result = await functionRegistry.executeFunction(method, params, params.aiOptions);
          } else {
            throw new Error(`Unknown method: ${method}`);
          }
      }

      res.json({ id, result });

    } catch (error: any) {
      console.error(`❌ RPC method '${method}' failed:`, error.message);
      
      // Handle specific error types
      let errorCode = -32603;
      let errorMessage = 'Internal server error';
      let errorData: any = undefined;

      if (error.message.includes('quota exceeded')) {
        errorCode = -32001;
        errorMessage = 'Monthly quota exceeded';
        errorData = { upgradeUrl: '/billing/upgrade' };
      } else if (error.message.includes('rate limit')) {
        errorCode = -32002;
        errorMessage = 'Rate limit exceeded';
      } else if (error.message.includes('authentication')) {
        errorCode = -32001;
        errorMessage = 'Authentication required';
        errorData = { authUrl: '/auth/opensaas' };
      } else if (error.message.includes('payment')) {
        errorCode = -32003;
        errorMessage = 'Payment required';
        errorData = { billingUrl: '/billing' };
      }

      res.status(500).json({
        id,
        error: {
          code: errorCode,
          message: errorMessage,
          data: errorData || (process.env.NODE_ENV === 'development' ? error.message : undefined)
        }
      });
    }
  });

  // Admin endpoints (require authentication)
  app.get('/admin/analytics', jwtMiddleware.authenticate, async (req: AuthenticatedRequest, res: Response) => {
    try {
      // Check if user has admin access
      if (!req.authContext || !req.authContext.features.includes('analytics')) {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const startDate = req.query.start ? new Date(req.query.start as string) : undefined;
      const endDate = req.query.end ? new Date(req.query.end as string) : undefined;

      const [usageAnalytics, billingAnalytics] = await Promise.all([
        usageTracker.getUsageAnalytics(startDate, endDate),
        billingEngine.getBillingAnalytics(startDate, endDate)
      ]);

      return res.json({
        usage: usageAnalytics,
        billing: billingAnalytics,
        subscriptionTiers: mergedTiers
      });

    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  });

  return {
    app,
    functionRegistry,
    promptManager,
    usageTracker,
    billingEngine,
    rateLimiter,
    start: (portOverride?: number) => {
      const serverPort = portOverride ?? port;
      const server = app.listen(serverPort, () => {
        console.log('🚀 Monetized AI Backend Server with OpenSaaS');
        console.log(`🌐 Server running on port ${serverPort}`);
        console.log(`💰 Platform fee: ${opensaasConfig.billing.platformFee.percentage}%`);
        console.log(`🎯 Subscription tiers: ${Object.keys(mergedTiers).join(', ')}`);
        console.log(`📋 Available functions: ${functionRegistry.listFunctions().map(f => f.name).join(', ')}`);
      });
      return server;
    },
    stop: async () => {
      console.log('🛑 Shutting down monetized server...');
      await Promise.all([
        rateLimiter.close(),
        db.close()
      ]);
    }
  };
}

/**
 * Handle monetized AI request with usage tracking and billing
 */
async function handleMonetizedAIRequest(
  params: any,
  req: AuthenticatedRequest,
  aiService: AIService,
  usageTracker: UsageTracker,
  billingEngine: BillingEngine,
  rateLimiter: RateLimiter,
  tiers: Record<string, any>
): Promise<any> {
  const { content, systemPrompt, promptId, promptContext = {}, metadata = {} } = params;
  const userId = req.authContext?.userId || 'anonymous';
  const userTier = req.authContext?.subscriptionTier || 'anonymous';

  // Check quota first
  const quotaStatus = await usageTracker.getQuotaStatus(userId);
  if (quotaStatus.isExceeded) {
    const quotaAction = await billingEngine.handleQuotaExceeded(userId);
    if (quotaAction.action === 'block') {
      throw new Error(`Quota exceeded: ${quotaAction.message}`);
    }
  }

  // Estimate tokens for rate limiting
  const estimatedTokens = Math.ceil((content?.length || 0) / 4); // Rough estimate
  const tokenRateLimit = await rateLimiter.checkTokenRateLimit(userId, userTier, estimatedTokens);
  
  if (!tokenRateLimit.allowed) {
    throw new Error(`Token rate limit exceeded. Resets at ${new Date(tokenRateLimit.resetTime).toISOString()}`);
  }

  // Process AI request
  if (!content) {
    throw new Error('Missing required parameter: content');
  }

  let resolvedSystemPrompt: string;
  if (promptId) {
    resolvedSystemPrompt = promptManager.getPrompt(promptId, promptContext);
  } else if (systemPrompt) {
    resolvedSystemPrompt = systemPrompt;
  } else {
    throw new Error('Either promptId or systemPrompt must be provided');
  }

  if (!aiService) {
    throw new Error('AI service not available');
  }

  const startTime = Date.now();
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const aiResult = await aiService.execute({
    content,
    systemPrompt: resolvedSystemPrompt,
    metadata
  });

  const processingTime = Date.now() - startTime;

  // Record usage and billing
  const usageEvent = await usageTracker.recordUsage({
    userId,
    organizationId: req.authContext?.organizationId,
    requestId,
    method: 'executeAIRequest',
    provider: 'ai-service', // This should come from aiResult
    model: aiResult.model,
    inputTokens: aiResult.usage?.promptTokens || estimatedTokens,
    outputTokens: aiResult.usage?.completionTokens || 0,
    timestamp: new Date(),
    metadata: { ...metadata, processingTime }
  });

  // Record actual token usage for rate limiting
  await rateLimiter.recordTokenUsage(userId, userTier, usageEvent.totalTokens);

  // Process billing event
  await billingEngine.processUsageEvent(usageEvent);

  return {
    content: aiResult.content,
    usage: {
      inputTokens: usageEvent.inputTokens,
      outputTokens: usageEvent.outputTokens,
      totalTokens: usageEvent.totalTokens,
      cost: usageEvent.cost,
      platformFee: usageEvent.platformFee,
      totalCost: usageEvent.totalCost
    },
    quotaRemaining: quotaStatus.quotaLimit - quotaStatus.quotaUsed - usageEvent.totalTokens,
    requestId,
    metadata: {
      processingTime,
      model: aiResult.model,
      finishReason: aiResult.finishReason,
      timestamp: new Date().toISOString()
    }
  };
}

/**
 * Handle get usage stats request
 */
async function handleGetUsageStats(params: any, req: AuthenticatedRequest, usageTracker: UsageTracker): Promise<any> {
  const userId = req.authContext?.userId;
  if (!userId) {
    throw new Error('Authentication required');
  }

  const period = params.period || 'current_month';
  return await usageTracker.getUserUsage(userId, period);
}

/**
 * Handle check quota status request
 */
async function handleCheckQuotaStatus(req: AuthenticatedRequest, usageTracker: UsageTracker): Promise<any> {
  const userId = req.authContext?.userId;
  if (!userId) {
    throw new Error('Authentication required');
  }

  return await usageTracker.getQuotaStatus(userId);
}

/**
 * Handle RPC discovery request
 */
async function handleDiscover(): Promise<any> {
  return {
    openrpc: '1.2.6',
    info: {
      title: 'Monetized AI Backend',
      version: '1.0.0',
      description: 'OpenSaaS-integrated JSON-RPC server for AI services with usage tracking and billing'
    },
    methods: [
      {
        name: 'executeAIRequest',
        description: 'Execute AI request with usage tracking and billing',
        params: {
          type: 'object',
          properties: {
            content: { type: 'string', description: 'User content to process' },
            systemPrompt: { type: 'string', description: 'System prompt for AI context' },
            promptId: { type: 'string', description: 'ID of managed system prompt' }
          },
          required: ['content']
        }
      },
      {
        name: 'getUsageStats',
        description: 'Get usage statistics for authenticated user',
        params: {
          type: 'object',
          properties: {
            period: { type: 'string', enum: ['current_month', 'last_30_days', 'last_7_days'] }
          }
        }
      },
      {
        name: 'checkQuotaStatus',
        description: 'Check current quota status for authenticated user',
        params: { type: 'object', properties: {} }
      }
    ]
  };
}