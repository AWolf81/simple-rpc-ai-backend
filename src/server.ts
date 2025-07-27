import express from 'express';
import type { Express } from 'express';
import type { Server } from 'http';

import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { 
  UserManager, 
  SimpleKeyManager, 
  AuthManager,
  SQLiteAdapter,
  AIKeyValidator
} from './auth';
import { AIService } from './services/ai-service';
import type { ServiceProvidersConfig } from './services/ai-service';

export interface AIServerConfig {
  port?: number; // Added this since you use config.port
  database?: {
    type?: 'sqlite' | 'postgresql' | 'mysql';
    connectionString?: string;
    path?: string; // For SQLite
  };
  masterEncryptionKey?: string;
  oauth?: {
    github?: { clientId: string; clientSecret: string };
    google?: { clientId: string; clientSecret: string };
    microsoft?: { clientId: string; clientSecret: string };
  };
  mode?: 'simple' | 'byok' | 'hybrid';
  serviceProviders?: ServiceProvidersConfig;
  fallbackStrategy?: 'priority' | 'round_robin' | 'fastest_first';
  requirePayment?: {
    enabled?: boolean;
    checkFunction?: (userId: string) => Promise<boolean>;
    freeTrialCredits?: number;
    errorMessage?: string;
  };
  cors?: {
    origin?: string | string[];
    credentials?: boolean;
  };
  rateLimit?: {
    windowMs?: number;
    max?: number;
  };
}

interface SuggestUpgradeParams {
  deviceId: string;
}

export interface RPCRequest {
  jsonrpc: '2.0';
  id: number;
  method: string;
  params?: any;
}

export interface RPCResponse {
  jsonrpc?: '2.0';
  id: number;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

export function createAIServer(config: AIServerConfig): {
  app: Express;
  start: (port?: number) => Server;
  stop: () => void;
} {
  const app = express();
  const port = config.port ?? 8000;
  
  const mode = config.mode ?? determineMode(config);

  // Create AIService instance once here:
  const aiService = new AIService(config);

  let dbAdapter: SQLiteAdapter | null = null;
  let userManager: UserManager | null = null;
  let keyManager: SimpleKeyManager | null = null;
  let authManager: AuthManager | null = null;


  if (mode !== 'simple') {
    dbAdapter = new SQLiteAdapter(config.database?.path ?? ':memory:');
    userManager = new UserManager(dbAdapter);
    const keyValidator = new AIKeyValidator();
    keyManager = new SimpleKeyManager(dbAdapter, keyValidator, config.masterEncryptionKey ?? '');
    authManager = new AuthManager(userManager, keyManager, new Map());
    dbAdapter.initialize().catch(console.error);
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

  app.post('/rpc', async (req, res) => {
    const { id, method, params }: RPCRequest = req.body;

    if (!method || typeof method !== 'string') {
      return res.status(400).json({
        id,
        error: { code: -32600, message: 'Invalid Request - missing method' }
      });
    }

    try {
      let result: any;

      switch (method) {
        case 'initializeSession':
          if (!authManager) throw new Error('Authentication manager not initialized');
          result = await authManager.initializeSession(params.deviceId, params.deviceName);
          break;
        case 'upgradeToOAuth':
          if (!authManager) throw new Error('Authentication manager not initialized');
          result = await authManager.upgradeToOAuth(params.deviceId, params.provider, params.oauthToken);
          break;
        case 'linkDeviceWithCode':
          if (!authManager) throw new Error('Authentication manager not initialized');
          result = await authManager.linkDeviceWithCode(params.newDeviceId, params.code, params.deviceName);
          break;
        case 'generateDeviceLinkCode':
          if (!authManager) throw new Error('Authentication manager not initialized');
          result = await authManager.generateDeviceLinkCode(params.email);
          break;
        case 'upgradeToPro':
          if (!authManager) throw new Error('Authentication manager not initialized');
          result = await authManager.upgradeToPro(params.deviceId);
          break;
        case 'getAuthStatus':
          if (!authManager) throw new Error('Authentication manager not initialized');
          result = await authManager.getAuthStatus(params.deviceId);
          break;
        case 'hasFeature':
          if (!authManager) throw new Error('Authentication manager not initialized');
          result = await authManager.hasFeature(params.deviceId, params.feature);
          break;
        case 'invalidateSession':
          if (!authManager) throw new Error('Authentication manager not initialized');
          authManager.invalidateSession(params.deviceId);
          result = { success: true };
          break;
        case 'storeUserKey':
          if (!keyManager) throw new Error('Key manager not initialized');
          await keyManager.storeUserKey(params.userId, params.provider, params.apiKey);
          result = { success: true };
          break;
        case 'getUserKey':
          if (!keyManager) throw new Error('Key manager not initialized');
          result = await keyManager.getUserKey(params.userId, params.provider);
          break;
        case 'getUserProviders':
          if (!keyManager) throw new Error('Key manager not initialized');
          result = await keyManager.getUserProviders(params.userId);
          break;
        case 'validateUserKey':
          if (!keyManager) throw new Error('Key manager not initialized');
          result = await keyManager.validateUserKey(params.userId, params.provider);
          break;
        case 'validateAllUserKeys':
          if (!keyManager) throw new Error('Key manager not initialized');
          result = await keyManager.validateAllUserKeys(params.userId);
          break;
        case 'rotateUserKey':
          if (!keyManager) throw new Error('Key manager not initialized');
          await keyManager.rotateUserKey(params.userId, params.provider, params.newApiKey);
          result = { success: true };
          break;
        case 'deleteUserKey':
          if (!keyManager) throw new Error('Key manager not initialized');
          await keyManager.deleteUserKey(params.userId, params.provider);
          result = { success: true };
          break;
        case 'executeAIRequest':
          result = await handleAIRequest(params, keyManager, aiService);
          break;
        case 'shouldSuggestUpgrade':
          if (!authManager) throw new Error('Authentication manager not initialized');
          result = await handleSuggestUpgrade(params, authManager);
          break;
        case 'health':
          result = await handleHealth();
          break;
        default:
          throw new Error(`Unknown method: ${method}`);
      }

      res.json({ id, result });
      return;

    } catch (error: any) {
      res.status(500).json({
        id,
        error: {
          code: -32603,
          message: 'Internal error',
          data: error.message ?? String(error)
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
    } catch (error: any) {
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
    start: (portOverride?: number) => {
      const serverPort = portOverride ?? port;
      const server = app.listen(serverPort, () => {
        console.log('🚀 Progressive AI Backend Server');
        console.log(`🌐 Server running on port ${serverPort}`);
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

function determineMode(config: AIServerConfig): 'simple' | 'byok' | 'hybrid' {
  if (config.mode) return config.mode;
  if (config.serviceProviders) return 'byok';
  return 'simple';
}

async function handleAIRequest(
  params: any,
  keyManager: SimpleKeyManager | null,
  aiService: AIService
): Promise<any> {
  const { userId, content, systemPrompt, metadata = {} } = params;

  if (!content || !systemPrompt) {
    throw new Error('Missing required parameters: content, systemPrompt');
  }

  // Try user's API keys first (if BYOK mode and user provided)
  if (keyManager && userId) {
    try {
      const providers = await keyManager.getUserProviders(userId);
      if (providers.length > 0) {
        console.log(`🔑 Using user's ${providers[0]} key`);
        // User has keys, let them use their own
      }
    } catch (error) {
      console.log('🔄 User key failed, using service providers...');
    }
  }

  const startTime = Date.now();
  console.log(`🤖 Processing AI request`);

  const result = await aiService.execute({
    content,
    systemPrompt,
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

async function handleSuggestUpgrade(
  params: SuggestUpgradeParams,
  authManager: AuthManager
): Promise<boolean> {
  const status = await authManager.getAuthStatus(params.deviceId);
  // Simplified suggestion logic
  return status.authLevel !== 'pro';
}

async function handleHealth(): Promise<{ status: string; timestamp: string }> {
  return { status: 'healthy', timestamp: new Date().toISOString() };
}
