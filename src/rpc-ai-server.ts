/**
 * RPC AI Server
 * 
 * One server that supports both JSON-RPC and tRPC endpoints for AI applications.
 * Provides simple configuration for basic use cases and advanced options for complex scenarios.
 */

import 'dotenv/config';
import express from 'express';
import type { Express, Request, Response, Application, NextFunction } from 'express';
import crypto from 'crypto';
import type { Server } from 'http';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import * as trpcExpress from '@trpc/server/adapters/express';
import { createTRPCContext } from './trpc/index.js';
import { createAppRouter } from './trpc/root.js';
import type { AnyRouter } from '@trpc/server';
import type { AppRouter } from './trpc/root.js';
import type { AIRouterConfig } from './trpc/routers/ai/types.js';
import { JWTMiddleware } from './auth/jwt-middleware.js';
import type { AuthenticatedRequest, OpenSaaSJWTPayload } from './auth/jwt-middleware.js';
import type { SessionStorage } from './auth/session-storage.js';
import { PostgreSQLAdapter } from './database/postgres-adapter.js';
import { VirtualTokenService } from './services/billing/virtual-token-service.js';
import { UsageAnalyticsService } from './services/billing/usage-analytics-service.js';
import { PostgreSQLRPCMethods } from './auth/PostgreSQLRPCMethods.js';
import { RPC_METHODS } from './constants.js';
import { createTRPCToJSONRPCBridge } from './trpc/trpc-to-jsonrpc-bridge.js';
import { MCPExtensionConfig } from './mcp/mcp-config.js';
import { MCPRateLimitConfig } from './security/rate-limiter.js';
import { SecurityLoggerConfig } from './security/security-logger.js';
import { AuthEnforcementConfig } from './security/auth-enforcer.js';
import type { RootManagerConfig, RootFolderConfig } from './services/resources/root-manager.js';
import { createOAuthServer, initializeOAuthServer, closeOAuthServer } from './auth/oauth-middleware.js';
import { getTestSafeConfig } from './security/test-helpers.js';
import { initializeTiming } from './utils/timing.js';
import { logger } from './utils/logger.js';

// Built-in provider types
export type BuiltInProvider = 'anthropic' | 'openai' | 'google' | 'openrouter' | 'huggingface';

// Provider configuration object (extended config for a provider)
export interface ProviderConfig {
  name: BuiltInProvider | string;        // Provider name
  apiKey?: string;                       // Explicit API key (overrides env var)
  defaultModel?: string;                 // Default model for this provider
  systemPrompts?: Record<string, string>; // Provider-specific system prompts
  modelRestrictions?: {                  // Provider-specific model restrictions
    allowedModels?: string[];
    allowedPatterns?: string[];
    blockedModels?: string[];
  };
  // For custom providers (non-built-in)
  type?: BuiltInProvider;                // Base provider type to use (e.g., 'openai' for OpenAI-compatible)
  baseUrl?: string;                      // Custom API endpoint
  apiKeyHeader?: string;                 // Default: 'Authorization'
  apiKeyPrefix?: string;                 // Default: 'Bearer '
}

// Legacy custom provider interface (deprecated, use ProviderConfig instead)
export interface CustomProvider {
  name: string;
  baseUrl: string;
  apiKeyHeader?: string;
  apiKeyPrefix?: string;
  modelMapping?: Record<string, string>;
  defaultModel?: string;
  requestTransform?: (req: unknown) => unknown;
  responseTransform?: (res: unknown) => unknown;
}

// More practical approach: Use const assertions for type safety
export interface RpcAiServerConfig {
  // Basic settings
  port?: number;
  
  // AI Configuration
  aiLimits?: AIRouterConfig;

  // Provider Configuration (both 'providers' and 'serverProviders' are supported)
  providers?: (BuiltInProvider | string | ProviderConfig)[];  // Hybrid: strings or objects
  // - undefined: Allow all providers with env vars (auto-detect BYOK mode)
  // - []: Block all providers (no AI allowed)
  // - ['anthropic', 'openai']: Only these providers allowed (reads from env vars)
  // - [{name: 'anthropic', apiKey: '...', defaultModel: '...'}]: Extended config

  serverProviders?: (BuiltInProvider | string)[];    // Alternative to 'providers' (same behavior)
  byokProviders?: (BuiltInProvider | string)[];      // Additional BYOK-only providers
  customProviders?: CustomProvider[];                // Custom provider configurations

  // Global settings (can be overridden per-provider in ProviderConfig)
  systemPrompts?: Record<string, string>;           // Custom system prompt definitions
  modelRestrictions?: Record<string, {               // Per-provider model restrictions
    allowedModels?: string[];                        // Exact model names allowed
    allowedPatterns?: string[];                      // Glob patterns allowed (e.g., "anthropic/*")
    blockedModels?: string[];                        // Specific models to block
  }>;
  
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

  // Debug & Performance
  debug?: {
    enableTiming?: boolean;      // Enable performance timing logs (default: false)
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
  
  // OAuth2 Authentication (for MCP and API access)
  oauth?: {
    enabled?: boolean;                    // Enable OAuth 2.0 server
    googleClientId?: string;              // Google OAuth client ID (for external OAuth)
    googleClientSecret?: string;          // Google OAuth client secret
    encryptionKey?: string;               // Key for token encryption
    sessionStorage?: {
      type?: 'memory' | 'file' | 'redis'; // Session storage type
      filePath?: string;                  // File path for file storage
      redis?: {                           // Redis configuration
        host?: string;
        port?: number;
        password?: string;
        db?: number;
        keyPrefix?: string;
      };
    };
  };

  // Extension OAuth (Simplified OAuth for browser/VS Code extensions)
  extensionOAuth?: {
    enabled?: boolean;                    // Enable extension OAuth callback handler (default: false)
    isExtensionOAuth?: (stateData: any) => boolean;  // Custom detection function (default: checks state.isExtensionAuth)
    onUserAuthenticated?: (stateData: any, userId: string, userInfo: { email?: string; provider: string; [key: string]: any }) => void | Promise<void>;
    tokenExchangeHandlers?: {             // Custom token exchange per provider
      [provider: string]: (code: string, callbackUrl: string) => Promise<{ userId: string; email?: string; [key: string]: any }>;
    };
    successTemplate?: (user: any, stateData: any) => string;  // Custom success HTML
    errorTemplate?: (error: string, stateData?: any) => string;  // Custom error HTML
  };

  // Network settings
  cors?: {
    origin?: string | string[];
    credentials?: boolean;
  };
  
  // Proxy configuration
  trustProxy?: boolean;                       // Enable trust proxy for reverse proxies (default: false)
  
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
    enabled?: boolean;  // Enable/disable MCP server (default: true if mcp config provided)
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
      opensaas?: {
        enabled?: boolean;                // Enable OpenSaaS JWT token authentication
        publicKey?: string;               // OpenSaaS public key for JWT validation
        audience?: string;                // Expected audience for JWT tokens
        issuer?: string;                  // Expected issuer for JWT tokens
        clockTolerance?: number;          // JWT clock tolerance in seconds (default: 30)
        requireAuthForAllMethods?: boolean; // If true, all MCP methods require auth
        skipAuthForMethods?: string[];    // MCP methods that don't require auth
      };
    };
    adminUsers?: string[];                // Admin users who can access admin-restricted tools (by email/username);
    defaultConfig?: {
      enableWebSearchTool?: boolean;   // build-in websearch tool
      enableRefTools?: boolean;        // Documentation search
      enableFilesystemTools?: boolean; // Disabled for security
    };
    
    /**
     * MCP extensions configuration - customize prompts and resources
     */
    extensions?: MCPExtensionConfig;
    
    /**
     * Rate limiting configuration for MCP endpoints
     */
    rateLimiting?: MCPRateLimitConfig;
    
    /**
     * Security logging and network filtering configuration
     */
    securityLogging?: SecurityLoggerConfig;
    
    /**
     * Authentication enforcement configuration
     */
    authEnforcement?: AuthEnforcementConfig;
  }

  /**
   * Custom router extensions - allows users to add their own tRPC procedures
   */
  customRouters?: {
    [namespace: string]: any; // tRPC router instance
  };

  /**
   * Server workspace management configuration
   *
   * NOTE: This is for server-side file access, separate from MCP client roots.
   * Server workspaces are configured and controlled by the server.
   * MCP roots are managed by the client and advertised via roots/list.
   */
  serverWorkspaces?: {
    /** Enable server-managed file operations via tRPC/MCP (default: false) */
    enabled?: boolean;

    /** Default workspace folder configuration */
    defaultWorkspace?: {
      /** Absolute path to default workspace folder */
      path?: string;
      /** Whether default workspace is read-only */
      readOnly?: boolean;
      /** Allowed file extensions */
      allowedExtensions?: string[];
      /** Blocked file extensions */
      blockedExtensions?: string[];
      /** Maximum file size in bytes */
      maxFileSize?: number;
      /** Allowed path globs */
      allowedPaths?: string[];
      /** Blocked path globs */
      blockedPaths?: string[];
      /** Follow symbolic links */
      followSymlinks?: boolean;
      /** Enable file watching */
      enableWatching?: boolean;
      /** Watch ignore patterns */
      watchIgnore?: string[];
    };

    /** Additional named workspace folders */
    additionalWorkspaces?: Record<string, {
      /** Absolute path to the workspace folder */
      path: string;
      /** Display name */
      name?: string;
      /** Description */
      description?: string;
      /** Whether read-only */
      readOnly?: boolean;
      /** Allowed file extensions */
      allowedExtensions?: string[];
      /** Blocked file extensions */
      blockedExtensions?: string[];
      /** Maximum file size in bytes */
      maxFileSize?: number;
      /** Allowed path globs */
      allowedPaths?: string[];
      /** Blocked path globs */
      blockedPaths?: string[];
      /** Follow symbolic links */
      followSymlinks?: boolean;
      /** Enable file watching */
      enableWatching?: boolean;
      /** Watch ignore patterns */
      watchIgnore?: string[];
    }>;
  };

  /**
   * Remote MCP Server Configuration
   *
   * Configure external MCP servers to connect to via different transports.
   * Supports uvx (Python), npx (Node.js), docker, and HTTP/HTTPS.
   */
  remoteMcpServers?: {
    /** Enable remote MCP server connections */
    enabled?: boolean;

    /** List of remote servers to connect to */
    servers?: Array<{
      /** Unique identifier for this server */
      name: string;

      /** Transport method */
      transport: 'uvx' | 'npx' | 'docker' | 'http' | 'https';

      /** For uvx/npx: package name to run */
      command?: string;

      /** For uvx/npx: additional command line arguments */
      args?: string[];

      /** For uvx/npx/docker: environment variables */
      env?: Record<string, string>;

      /** For docker: docker image name */
      image?: string;

      /** For docker: additional container arguments */
      containerArgs?: string[];

      /** For http/https: remote server URL */
      url?: string;

      /** For http/https: custom headers */
      headers?: Record<string, string>;

      /** Authentication configuration */
      auth?: {
        type: 'bearer' | 'basic' | 'none';
        token?: string;
        username?: string;
        password?: string;
      };

      /** Auto-start on server initialization */
      autoStart?: boolean;

      /** Request timeout in milliseconds */
      timeout?: number;

      /** Number of retries on connection failure */
      retries?: number;
    }>;

    /** Security scanning configuration */
    security?: {
      /** Enable security scanning on startup (default: true) */
      enableStartupScan?: boolean;

      /** Block server start if high-risk packages detected (default: false) */
      blockOnHighRisk?: boolean;

      /** Downgrade security level for official Anthropic servers (default: true) */
      trustAnthropicServers?: boolean;

      /** Custom package security overrides */
      packageOverrides?: Record<string, 'GREEN' | 'YELLOW' | 'RED' | 'SKIP'>;
    };

    /** Auto-reconnect settings */
    autoReconnect?: boolean;
    reconnectDelay?: number;
    maxReconnectAttempts?: number;
  };
}

/**
 * Parse CORS origin configuration to support flexible formats:
 * - String: "https://example.com" or "*" 
 * - Comma-separated: "https://example.com,http://localhost:3000"
 * - Array: ["https://example.com", "http://localhost:3000"]
 */
function parseCorsOrigin(origin?: string | string[]): string | string[] {
  if (!origin) return '*';
  if (Array.isArray(origin)) return origin;
  if (typeof origin === 'string') {
    // If it contains commas, split into array
    if (origin.includes(',')) {
      return origin.split(',').map(s => s.trim()).filter(s => s.length > 0);
    }
    return origin;
  }
  return '*';
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
  private oauthServer?: ReturnType<typeof createOAuthServer>['oauth'];
  private oauthStorage?: SessionStorage;
  private remoteMcpManager?: any; // RemoteMCPManager type

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

  private providerApiKeys: Record<string, string | undefined> = {};
  private allowedProviders: Set<string> | null = null; // null = allow all, Set = whitelist

  constructor(config: RpcAiServerConfig = {}) {
    // Apply test-safe configuration if in test environment
    config = getTestSafeConfig(config);

    // Initialize timing/debug configuration
    initializeTiming(config.debug);

    // Opinionated protocol defaults
    const protocols = this.getOpinionatedProtocols(config.protocols);
    
    // Set smart defaults
    this.config = {
      port: config.port ?? 8000,       // Use provided port or default to 8000
      debug: config.debug || {},
      aiLimits: {},
      providers: config.providers,     // Optional: undefined by default
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
      oauth: {
        enabled: false,
        ...config.oauth
      },
      extensionOAuth: config.extensionOAuth,
      cors: {
        origin: parseCorsOrigin(config.cors?.origin) || '*',
        credentials: false,
        ...config.cors
      },
      trustProxy: config.trustProxy || false,
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
        enabled: config.mcp?.enabled !== false && !!config.mcp,  // Enable MCP if mcp config object is provided and not explicitly disabled
        transports: {
          http: true,    // HTTP transport enabled by default - universal compatibility
          sse: true,     // SSE transport enabled by default - real-time capabilities
          stdio: false,  // STDIO transport disabled by default - specialized use case
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
        extensions: config.mcp?.extensions,
        // Spread any other MCP config properties
        ...config.mcp
      },
      modelRestrictions: config.modelRestrictions || {},  // Default: no model restrictions

      // Server workspace configuration (disabled by default)
      serverWorkspaces: config.serverWorkspaces
        ? {
            ...config.serverWorkspaces,
            enabled: config.serverWorkspaces.enabled ?? false,
          }
        : undefined,

      // Remote MCP servers configuration
      remoteMcpServers: {
        enabled: false,
        servers: [],
        security: {
          enableStartupScan: true,
          blockOnHighRisk: false,
          trustAnthropicServers: true,
        },
        autoReconnect: true,
        reconnectDelay: 5000,
        maxReconnectAttempts: 3,
        ...config.remoteMcpServers
      },

      customRouters: config.customRouters || {},  // Default: no custom routers
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
      this.jwtMiddleware = new JWTMiddleware({
        opensaasPublicKey: this.config.jwt.secret,
        audience: this.config.jwt.audience || 'rpc-ai-backend',
        issuer: this.config.jwt.issuer || 'opensaas',
        skipAuthForMethods: ['health', 'listProviders'],
        requireAuthForAllMethods: false
      });
    }

    // Debug: log MCP config only if MCP is enabled
    if (this.config.mcp?.enabled) {
      const promptsInfo = this.config.mcp.extensions?.prompts;
      const resourcesInfo = this.config.mcp.extensions?.resources;
      const promptsSummary = promptsInfo?.customPrompts?.length
        ? `${promptsInfo.customPrompts.length} custom prompts`
        : promptsInfo ? 'extensions configured' : 'none';
      const resourcesSummary = resourcesInfo?.customResources?.length
        ? `${resourcesInfo.customResources.length} custom resources`
        : resourcesInfo ? 'extensions configured' : 'none';

      logger.debug(`🔍 MCP enabled – prompts: ${promptsSummary}, resources: ${resourcesSummary}`);
    }

    // Normalize provider configuration
    // Priority: config.providers > config.serverProviders > undefined (allow all with env)
    const providerConfig = this.config.providers || this.config.serverProviders;

    if (providerConfig !== undefined) {
      // Explicit provider list defined - create whitelist
      this.allowedProviders = new Set<string>();

      for (const provider of providerConfig) {
        if (typeof provider === 'string') {
          // Simple string: 'anthropic' → read from ANTHROPIC_API_KEY
          const envKey = `${provider.toUpperCase()}_API_KEY`;
          const apiKey = process.env[envKey];
          this.providerApiKeys[provider] = apiKey;
          this.allowedProviders.add(provider);
        } else if (typeof provider === 'object' && provider.name) {
          // Object config: { name: 'anthropic', apiKey: '...' }
          const providerName = provider.name;
          const explicitKey = (provider as ProviderConfig).apiKey;

          if (explicitKey) {
            this.providerApiKeys[providerName] = explicitKey;
          } else {
            // No explicit key, try env var
            const envKey = `${providerName.toUpperCase()}_API_KEY`;
            this.providerApiKeys[providerName] = process.env[envKey];
          }
          this.allowedProviders.add(providerName);
        }
      }

      logger.debug(`🔒 Provider whitelist enabled: ${Array.from(this.allowedProviders).join(', ')}`);
    } else {
      // undefined: Allow all providers with env vars (BYOK mode)
      // Auto-detect from environment variables
      this.allowedProviders = null; // null = allow all

      const knownProviders: BuiltInProvider[] = ['anthropic', 'openai', 'google', 'openrouter', 'huggingface'];
      for (const provider of knownProviders) {
        const envKey = `${provider.toUpperCase()}_API_KEY`;
        const apiKey = process.env[envKey];
        if (apiKey) {
          this.providerApiKeys[provider] = apiKey;
          logger.debug(`🔍 Auto-detected provider: ${provider} (from ${envKey})`);
        }
      }

      logger.debug(`🔓 Provider mode: Allow all with valid API keys (BYOK)`);
    }

    // Create router with AI configuration and token tracking
    // Normalize server workspace configuration (requires explicit workspace definitions)
    const workspaceConfig = (this.config.serverWorkspaces && this.config.serverWorkspaces.enabled &&
      this.hasWorkspaceDefinitions(this.config.serverWorkspaces))
      ? this.config.serverWorkspaces
      : undefined;

    if (this.config.serverWorkspaces?.enabled && !workspaceConfig) {
      console.warn('⚠️  serverWorkspaces.enabled is true but no workspace paths are configured. Skipping workspace API initialization.');
    }

    this.router = createAppRouter(
      undefined, // aiConfig - handled by separate params below
      this.config.tokenTracking.enabled || false,
      this.dbAdapter,
      this.config.serverProviders,
      this.config.byokProviders,
      this.postgresRPCMethods,
      this.config.mcp,
      this.config.modelRestrictions,
      workspaceConfig,
      this.config.customRouters
    );

    // Initialize tRPC to JSON-RPC bridge (if JSON-RPC is enabled)
    if (this.config.protocols.jsonRpc) {
      this.jsonRpcBridge = createTRPCToJSONRPCBridge(this.router, this.createContext(this.providerApiKeys));
    }

    // Initialize OAuth server (if enabled)
    if (this.config.oauth.enabled) {
      console.log(`🔐 Setting up OAuth 2.0 server...`);
      
      const storageConfig = {
        type: this.config.oauth.sessionStorage?.type || 'memory' as const,
        filePath: this.config.oauth.sessionStorage?.filePath,
        redis: this.config.oauth.sessionStorage?.redis
      };
      
      const { oauth, storage } = createOAuthServer(storageConfig, this.config.mcp?.adminUsers || []);
      this.oauthServer = oauth;
      this.oauthStorage = storage; // Store reference to session storage
      console.log(`✅ OAuth 2.0 server initialized with ${storageConfig.type} storage`);
    }

    this.app = express();
    
    // Enable trust proxy if configured (for reverse proxies like ngrok, cloudflare, etc.)
    if (this.config.trustProxy) {
      this.app.set('trust proxy', 1);
      logger.debug(`🔧 Trust proxy enabled for reverse proxy support`);
    }
    
    this.setupMiddleware();
  }

  private createContext(providerApiKeys: Record<string, string | undefined>) {
    return (opts: trpcExpress.CreateExpressContextOptions) => {
      const baseCtx = createTRPCContext(opts);

      // Get provider from request, or use first configured provider as default
      // For JSON-RPC requests, provider is in req.body.params.provider
      // For tRPC requests, provider might be in different locations
      const jsonRpcParams = baseCtx.req.body?.params;
      const requestedProvider = jsonRpcParams?.provider || baseCtx.req.body?.params?.provider;
      const defaultProvider = this.config.serverProviders?.[0];
      const providerToUse = requestedProvider || defaultProvider;

      // Get API key for the provider, or fall back to any available API key
      let apiKey = baseCtx.apiKey || providerApiKeys[providerToUse as string];

      // If no specific provider API key found, try to use any available API key as fallback
      if (!apiKey && !requestedProvider) {
        // Use the first available API key if no specific provider was requested
        apiKey = Object.values(providerApiKeys).find(key => key) || null;
      }


      return {
        ...baseCtx,
        apiKey: apiKey || null,
        appRouter: this.router, // Add router to context for prompt access tools
      };
    };
  }

  // Provider validation removed - now handled in AIService.execute()

  private setupMiddleware() {
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
      methods: ['GET', 'POST', 'OPTIONS', 'HEAD'],
      allowedHeaders: [
        'Content-Type', 
        'Authorization', 
        'X-Requested-With',
        'mcp-protocol-version',  // Required for MCP Jam OAuth discovery
        'Accept',
        'Accept-Language',
        'Content-Language',
        'Origin'
      ],
      optionsSuccessStatus: 200 // Some legacy browsers choke on 204
    }));

    // Body parsing
    this.app.use(express.json({ limit: '50mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '50mb' }));

    if (this.oauthStorage) {
      this.app.use(async (req: Request, res: Response, next: NextFunction) => {
        try {
          await this.attachOAuthUserFromAccessToken(req as AuthenticatedRequest);
          next();
        } catch (error) {
          logger.warn('⚠️ OAuth access token resolution failed', {
            error: error instanceof Error ? error.message : String(error)
          });
          next();
        }
      });
    }

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

  private async attachOAuthUserFromAccessToken(req: AuthenticatedRequest): Promise<void> {
    if (!this.oauthStorage) {
      return;
    }

    // Skip if user already resolved
    if (req.user) {
      return;
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return;
    }

    const accessToken = authHeader.substring(7).trim();
    if (!accessToken) {
      return;
    }

    const tokenRecord = await this.oauthStorage.getToken(accessToken);
    if (!tokenRecord) {
      return;
    }

    const expiresAtRaw = tokenRecord.accessTokenExpiresAt ?? (tokenRecord as any).expiresAt;
    const expiresAt = expiresAtRaw instanceof Date ? expiresAtRaw : expiresAtRaw ? new Date(expiresAtRaw) : undefined;
    if (expiresAt && expiresAt.getTime() <= Date.now()) {
      // Token expired - ignore so downstream auth will fail naturally
      return;
    }

    const oauthUser = (tokenRecord.user || {}) as Record<string, any>;
    const provider = oauthUser.provider || tokenRecord.client?.id;
    const scopeList = this.normalizeOAuthScopes(tokenRecord.scope);
    const featureSet = new Set<string>(scopeList);
    featureSet.add('mcp');
    featureSet.add('oauth');
    const features = Array.from(featureSet);

    const derivedUserId = (oauthUser.id || oauthUser.userId || oauthUser.email || oauthUser.username || `oauth-${accessToken.slice(0, 8)}`).toString();
    const email = (oauthUser.email || (oauthUser.username ? `${oauthUser.username}@oauth.local` : `${derivedUserId}@oauth.local`)).toString();
    const nowSeconds = Math.floor(Date.now() / 1000);
    const expSeconds = expiresAt ? Math.floor(expiresAt.getTime() / 1000) : nowSeconds + 3600;

    const payload: OpenSaaSJWTPayload = {
      userId: derivedUserId,
      email,
      subscriptionTier: 'oauth',
      monthlyTokenQuota: Number.MAX_SAFE_INTEGER,
      rpmLimit: 1000,
      tpmLimit: 60000,
      features,
      iat: nowSeconds,
      exp: expSeconds,
      iss: provider ? `oauth:${provider}` : 'oauth',
      aud: 'mcp',
    };

    req.user = payload;
    req.authContext = {
      type: 'oauth',
      userId: payload.userId,
      email: payload.email,
      provider,
      scopes: scopeList,
      subscriptionTier: payload.subscriptionTier,
      quotaInfo: {
        monthlyTokenQuota: payload.monthlyTokenQuota,
        rpmLimit: payload.rpmLimit,
        tpmLimit: payload.tpmLimit,
      },
      features,
      organizationId: oauthUser.organizationId || undefined,
    };
  }

  private normalizeOAuthScopes(scope: unknown): string[] {
    if (!scope) {
      return [];
    }

    if (Array.isArray(scope)) {
      return scope.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0);
    }

    if (typeof scope === 'string') {
      return scope
        .split(/[\s,]+/)
        .map(entry => entry.trim())
        .filter(entry => entry.length > 0);
    }

    if (typeof scope === 'object') {
      const collected: string[] = [];
      for (const value of Object.values(scope as Record<string, unknown>)) {
        if (typeof value === 'string' && value.trim().length > 0) {
          collected.push(value.trim());
        } else if (Array.isArray(value)) {
          for (const nested of value) {
            if (typeof nested === 'string' && nested.trim().length > 0) {
              collected.push(nested.trim());
            }
          }
        }
      }
      return collected;
    }

    return [];
  }

  private hasWorkspaceDefinitions(config?: RpcAiServerConfig['serverWorkspaces']): boolean {
    if (!config) {
      return false;
    }

    const hasDefault = typeof config.defaultWorkspace?.path === 'string' && config.defaultWorkspace.path.trim().length > 0;
    const hasAdditional = !!config.additionalWorkspaces && Object.keys(config.additionalWorkspaces).length > 0;

    return hasDefault || hasAdditional;
  }

  private async setupRoutes() {
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

    // Configuration endpoint for development tools
    this.app.get('/config', (_req: Request, res: Response) => {
      // Use OAUTH_BASE_URL if available (e.g., for ngrok, tunneling services)
      const baseUrl = process.env.OAUTH_BASE_URL || `http://localhost:${this.config.port}`;

      res.json({
        port: this.config.port,
        baseUrl: baseUrl,
        endpoints: {
          health: `${baseUrl}${this.config.paths.health}`,
          jsonRpc: this.config.protocols.jsonRpc ? `${baseUrl}${this.config.paths.jsonRpc}` : null,
          tRpc: this.config.protocols.tRpc ? `${baseUrl}${this.config.paths.tRpc}` : null,
          mcp: this.config.mcp?.enabled ? `${baseUrl}/mcp` : null,
        },
        protocols: {
          jsonRpc: this.config.protocols.jsonRpc,
          tRpc: this.config.protocols.tRpc,
          mcp: this.config.mcp?.enabled || false,
        },
        timestamp: new Date().toISOString()
      });
    });

    // OAuth2 Discovery endpoints (for MCP Jam compatibility)
    // These endpoints are required by MCP Jam even if OAuth is not fully implemented
    const baseUrl = process.env.OAUTH_BASE_URL || `http://localhost:${this.config.port}`;
    
    // CORS preflight for OAuth discovery endpoints
    const oauthCorsHandler = (_req: Request, res: Response) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, mcp-protocol-version, Accept, Accept-Language, Content-Language, Origin');
      res.status(200).send();
    };
    
    this.app.options('/.well-known/oauth-authorization-server', oauthCorsHandler);
    this.app.options('/.well-known/oauth-authorization-server/mcp', oauthCorsHandler);
    this.app.options('/.well-known/oauth-protected-resource', oauthCorsHandler);
    this.app.options('/.well-known/oauth-protected-resource/mcp', oauthCorsHandler);
    this.app.options('/.well-known/openid-configuration', oauthCorsHandler);
    this.app.options('/oauth/register', oauthCorsHandler);
    this.app.options('/oauth/token', oauthCorsHandler);
    this.app.options('/oauth/authorize', oauthCorsHandler);
    
    // OAuth Authorization Server Discovery
    this.app.get('/.well-known/oauth-authorization-server', (_req: Request, res: Response) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.json({
        issuer: baseUrl,
        authorization_endpoint: `${baseUrl}/oauth/authorize`,
        token_endpoint: `${baseUrl}/oauth/token`,
        registration_endpoint: `${baseUrl}/oauth/register`,
        response_types_supported: ['code'],
        grant_types_supported: ['authorization_code'],
        code_challenge_methods_supported: ['S256'],
        token_endpoint_auth_methods_supported: ['client_secret_basic', 'client_secret_post', 'none'],
        // scopes_supported: [
        //   'mcp', 'mcp:list', 'mcp:call', 'mcp:tools', 'mcp:admin',
        //   'read', 'write', 'admin', 'user',
        //   'ai:execute', 'ai:configure', 'ai:read',
        //   'system:read', 'system:admin', 'system:health',
        //   'profile:read', 'profile:write',
        //   'billing:read', 'billing:write'
        // ],
        scopes_supported: ['mcp'],
        resource: `${baseUrl}/`,  // Required by OAuth 2025-DRAFT-v2
        // RFC 7591 Dynamic Client Registration metadata
        client_registration_types_supported: ['dynamic'],
        registration_endpoint_auth_methods_supported: ['none'],
        client_registration_endpoint: `${baseUrl}/oauth/register`,
        // Additional metadata for OAuth client compatibility
        application_type: 'web',
        subject_types_supported: ['public'],
        client_id_issued_at: Math.floor(Date.now() / 1000)
      });
    });
    
    // MCP-specific OAuth Authorization Server Discovery
    this.app.get('/.well-known/oauth-authorization-server/mcp', (_req: Request, res: Response) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.json({
        issuer: baseUrl,
        authorization_endpoint: `${baseUrl}/oauth/authorize`,
        token_endpoint: `${baseUrl}/oauth/token`,
        registration_endpoint: `${baseUrl}/oauth/register`,
        response_types_supported: ['code'],
        grant_types_supported: ['authorization_code'],
        code_challenge_methods_supported: ['S256'],
        token_endpoint_auth_methods_supported: ['client_secret_basic', 'client_secret_post', 'none'],
        // scopes_supported: [
        //   'mcp', 'mcp:list', 'mcp:call', 'mcp:tools', 'mcp:admin',
        //   'read', 'write', 'admin', 'user',
        //   'ai:execute', 'ai:configure', 'ai:read',
        //   'system:read', 'system:admin', 'system:health',
        //   'profile:read', 'profile:write',
        //   'billing:read', 'billing:write'
        // ],
        scopes_supported: ['mcp'],
        resource: `${baseUrl}/`,  // Required by OAuth 2025-DRAFT-v2
        // RFC 7591 Dynamic Client Registration metadata
        client_registration_types_supported: ['dynamic'],
        registration_endpoint_auth_methods_supported: ['none'],
        client_registration_endpoint: `${baseUrl}/oauth/register`,
        // Additional metadata for OAuth client compatibility
        application_type: 'web',
        subject_types_supported: ['public'],
        client_id_issued_at: Math.floor(Date.now() / 1000)
      });
    });
    
    // OAuth Protected Resource Discovery  
    this.app.get('/.well-known/oauth-protected-resource', (_req: Request, res: Response) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.json({
        resource: `${baseUrl}/`,
        authorization_servers: [`${baseUrl}/`],
        // scopes_supported: [
        //   'mcp', 'mcp:list', 'mcp:call', 'mcp:tools', 'mcp:admin',
        //   'read', 'write', 'admin', 'user',
        //   'ai:execute', 'ai:configure', 'ai:read',
        //   'system:read', 'system:admin', 'system:health',
        //   'profile:read', 'profile:write',
        //   'billing:read', 'billing:write'
        // ],
        scopes_supported: ['mcp'],
        bearer_methods_supported: ['header'],
        resource_documentation: `${baseUrl}/mcp`
      });
    });
    
    // MCP-specific OAuth Protected Resource Discovery
    this.app.get('/.well-known/oauth-protected-resource/mcp', (_req: Request, res: Response) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.json({
        resource: `${baseUrl}/`,
        authorization_servers: [`${baseUrl}/`],
        // scopes_supported: [
        //   'mcp', 'mcp:list', 'mcp:call', 'mcp:tools', 'mcp:admin',
        //   'read', 'write', 'admin', 'user',
        //   'ai:execute', 'ai:configure', 'ai:read',
        //   'system:read', 'system:admin', 'system:health',
        //   'profile:read', 'profile:write',
        //   'billing:read', 'billing:write'
        // ],
        scopes_supported: ['mcp'],
        bearer_methods_supported: ['header'],
        resource_documentation: `${baseUrl}/mcp`
      });
    });
    
    // OpenID Configuration (minimal, for compatibility)
    this.app.get('/.well-known/openid-configuration', (_req: Request, res: Response) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.json({
        issuer: baseUrl,
        authorization_endpoint: `${baseUrl}/oauth/authorize`,
        token_endpoint: `${baseUrl}/oauth/token`,
        response_types_supported: ['code'],
        grant_types_supported: ['authorization_code'],
        code_challenge_methods_supported: ['S256'],
        scopes_supported: ['openid', 'mcp'],
        subject_types_supported: ['public'],
        jwks_uri: `${baseUrl}/.well-known/jwks.json`, // required by OIDC
        id_token_signing_alg_values_supported: ['RS256']
      });
    });

    // JWKS endpoint (placeholder) --> required by OIDC but empty for now
    this.app.get('/.well-known/jwks.json', (_req: Request, res: Response) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.json({
        keys: [] // In a real implementation, this would contain your public keys
      });
    });

    // OAuth 2.0 Functional Endpoints (if OAuth is enabled)
    if (this.config.oauth.enabled && this.oauthServer) {
      console.log(`🔗 Setting up OAuth 2.0 functional endpoints...`);

      // Import OAuth route handlers
      const { handleProviderLogin, handleProviderCallback, createAuthenticateHandler, handleProviderSelection } = await import('./auth/oauth-middleware.js');
      
      // Provider selection page
      this.app.get('/login', handleProviderSelection);
      
      // Identity provider login routes
      this.app.get('/login/:provider', handleProviderLogin);

      // Extension OAuth handler (intercepts before regular callback if enabled)
      if (this.config.extensionOAuth?.enabled) {
        const { createExtensionOAuthHandler } = await import('./auth/extension-oauth.js');
        const extensionOAuthHandler = createExtensionOAuthHandler(this.config.extensionOAuth);
        this.app.get('/callback/:provider', extensionOAuthHandler);
      }

      // Regular OAuth callback (for MCP, etc.)
      this.app.get('/callback/:provider', handleProviderCallback);
      
      // OAuth Authorization Endpoint with pre-authentication check
      this.app.get('/oauth/authorize', async (req: Request, res: Response, next) => {
        // Generate a default state parameter if missing (OAuth 2.0 state is optional)
        if (!req.query.state) {
          console.log(`⚠️ OAuth: No state parameter provided, generating default state`);
          req.query.state = 'auto-generated-state-' + crypto.randomBytes(16).toString('hex');
        }
        
        // Pre-check authentication before calling OAuth server
        const authenticateHandler = createAuthenticateHandler();
        const user = await authenticateHandler.handle(req as any);
        
        if (!user) {
          // No authentication - redirect to login page
          const baseUrl = process.env.OAUTH_BASE_URL || `http://localhost:${this.config.port}`;
          const loginUrl = new URL('/login', baseUrl);
          loginUrl.searchParams.set('redirect_uri', req.originalUrl);
          return res.redirect(loginUrl.toString());
        }
        
        // User is authenticated - proceed with OAuth authorization
        this.oauthServer!.authorize({
          authenticateHandler: {
            handle: async () => user // Return the already authenticated user
          }
        })(req, res, next);
      });

      // OAuth Token Endpoint  
      this.app.post('/oauth/token', (req: Request, res: Response, next) => {
        // Add CORS headers for token endpoint
        res.header('Access-Control-Allow-Origin', '*');
        res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
        res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        next();
      }, this.oauthServer.token());

      // OAuth Dynamic Client Registration Endpoint
      this.app.post('/oauth/register', async (req: Request, res: Response) => {
        try {
          res.header('Access-Control-Allow-Origin', '*');
          
          const { redirect_uris, grant_types } = req.body;
          
          if (!redirect_uris || !Array.isArray(redirect_uris) || redirect_uris.length === 0) {
            res.status(400).json({ 
              error: 'invalid_redirect_uri',
              error_description: 'redirect_uris is required and must be an array'
            });
            return;
          }

          // Generate a new client with timestamp-based ID (matching expected format)
          const clientId = `static_client_${Date.now()}`;
          const clientSecret = crypto.randomBytes(32).toString('hex');
          
          // Create client object directly in storage to avoid registerClient generating its own secret
          const client = {
            id: clientId,
            clientSecret,
            grants: grant_types || ['authorization_code', 'refresh_token'],
            redirectUris: redirect_uris,
            accessTokenLifetime: 3600,
            refreshTokenLifetime: 86400
          };

          // Store client directly using the OAuth storage instance
          await this.oauthStorage!.setClient(clientId, client);

          console.log(`✅ OAuth: Registered dynamic client ${clientId}`);

          // Return client registration response
          res.json({
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uris: redirect_uris,
            grant_types: client.grants,
            token_endpoint_auth_method: 'client_secret_post'
          });
          
        } catch (error) {
          console.error('❌ OAuth client registration failed:', error);
          res.status(500).json({ 
            error: 'server_error',
            error_description: 'Failed to register client'
          });
        }
      });

      console.log(`✅ OAuth 2.0 functional endpoints configured (including registration)`);
    }

    // tRPC endpoint (if enabled)
    if (this.config.protocols.tRpc) {
      this.app.use(
        this.config.paths.tRpc!,
        trpcExpress.createExpressMiddleware({
          router: this.router,
          createContext: this.createContext(this.providerApiKeys),
          onError: ({ path, error }) => {
            // In production, log only essential info without stack traces
            if (process.env.NODE_ENV === 'production') {
              logger.error(`❌ tRPC failed on ${path ?? "<no-path>"}: ${error.code} - ${error.message}`);
            } else {
              // In development, log full error for debugging
              console.error(`❌ tRPC failed on ${path ?? "<no-path>"}:`, error);
            }
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
          methods: [RPC_METHODS.HEALTH, RPC_METHODS.GENERATE_TEXT, RPC_METHODS.LIST_PROVIDERS, RPC_METHODS.STORE_USER_KEY, RPC_METHODS.GET_USER_KEY, RPC_METHODS.GET_USER_PROVIDERS, RPC_METHODS.VALIDATE_USER_KEY, RPC_METHODS.ROTATE_USER_KEY, RPC_METHODS.DELETE_USER_KEY],
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
      this.app.get('/openrpc.json', (req: Request, res: Response) => {
        const prettyReturn = req.query.pretty === 'true' || Boolean(req.query.pretty) === true;
        // Explicit CORS headers for OpenRPC tools
        res.header('Access-Control-Allow-Origin', '*');
        res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        res.header('Content-Type', 'application/json');

        // Use bridge to generate schema from tRPC router
        const serverUrl = process.env.OPENRPC_SERVER_URL || `http://localhost:${this.config.port}${this.config.paths.jsonRpc}`;

        const jsonOpenRpcObj = this.jsonRpcBridge!.generateOpenRPCSchema(serverUrl);
        if(prettyReturn) {          
          res.send(JSON.stringify(jsonOpenRpcObj, null, 3));
        }
        else {          
          res.send(jsonOpenRpcObj);
        }
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
          ...(this.config.mcp?.enabled && {
            mcp: '/mcp'
          }),
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
            console.log(`✅ Processed one-time purchase: ${orderValue / 100} for user ${userId}`);
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
   * Initialize remote MCP servers with security scanning
   */
  private async initializeRemoteMcpServers(): Promise<void> {
    const config = this.config.remoteMcpServers;
    if (!config || !config.servers || config.servers.length === 0) {
      return;
    }

    console.log('🔐 Initializing remote MCP servers...');

    // Security scanning if enabled (default: true)
    const securityConfig = config.security || {};
    const enableStartupScan = securityConfig.enableStartupScan !== false; // Default: true
    const blockOnHighRisk = securityConfig.blockOnHighRisk || false; // Default: false
    const trustAnthropicServers = securityConfig.trustAnthropicServers !== false; // Default: true

    if (enableStartupScan) {
      console.log('🔍 Scanning remote MCP packages for security risks...');

      try {
        const { scanMCPServerPackage } = await import('./security/mcp-server-scanner.js');

        const scanResults = new Map<string, any>();
        let hasHighRisk = false;
        let hasErrors = false;

        // Scan each server package
        for (const server of config.servers) {
          // Only scan uvx and npx packages (not docker or HTTP)
          if (server.transport !== 'uvx' && server.transport !== 'npx') {
            continue;
          }

          if (!server.command) {
            console.warn(`⚠️ Server ${server.name}: No command specified, skipping scan`);
            continue;
          }

          // Check for custom override
          if (securityConfig.packageOverrides?.[server.command] === 'SKIP') {
            console.log(`⏭️ Server ${server.name}: Skipping scan (configured override)`);
            continue;
          }

          try {
            console.log(`   Scanning ${server.name} (${server.transport}:${server.command})...`);
            const result = await scanMCPServerPackage(server.command, server.transport);
            scanResults.set(server.name, result);

            // Calculate total issues
            const totalIssues = result.redFlags.length + result.yellowFlags.length;

            // Apply custom overrides
            let finalLevel: 'GREEN' | 'YELLOW' | 'RED' = result.level;
            const override = securityConfig.packageOverrides?.[server.command];
            if (override && override !== 'SKIP') {
              finalLevel = override;
              console.log(`   📋 Applied security override: ${result.level} → ${finalLevel}`);
            }

            // Apply Anthropic trust policy
            const isAnthropicOfficial = result.metadata.name.startsWith('@modelcontextprotocol/') ||
                                       result.metadata.name.startsWith('anthropic-');
            if (trustAnthropicServers && isAnthropicOfficial) {
              if (finalLevel === 'RED') {
                finalLevel = 'YELLOW';
                console.log(`   ✅ Downgraded security level: RED → YELLOW (official Anthropic package)`);
              }
            }

            // Display result
            const icon = finalLevel === 'GREEN' ? '✅' : finalLevel === 'YELLOW' ? '⚠️' : '🚨';
            console.log(`   ${icon} ${server.name}: ${finalLevel} (${result.scannedFiles} files, ${totalIssues} issues)`);

            if (finalLevel === 'RED') {
              hasHighRisk = true;
              if (result.redFlags.length > 0) {
                console.log(`      High-risk patterns detected:`);
                result.redFlags.slice(0, 3).forEach((flag: any) => {
                  console.log(`      - ${flag.description} (${flag.file}:${flag.line})`);
                });
                if (result.redFlags.length > 3) {
                  console.log(`      ... and ${result.redFlags.length - 3} more`);
                }
              }
            }
          } catch (error) {
            hasErrors = true;
            console.error(`   ❌ Failed to scan ${server.name}:`, error instanceof Error ? error.message : String(error));
          }
        }

        // Check if we should block startup
        if (hasHighRisk && blockOnHighRisk) {
          throw new Error(
            'Server startup blocked: High-risk MCP packages detected. ' +
            'Set remoteMcpServers.security.blockOnHighRisk=false to bypass this check.'
          );
        }

        if (hasHighRisk) {
          console.warn('⚠️ Warning: One or more high-risk MCP packages detected. Review security scan results above.');
        } else if (hasErrors) {
          console.warn('⚠️ Warning: Some packages could not be scanned. They will still be initialized.');
        } else {
          console.log('✅ All MCP packages passed security scan');
        }

      } catch (error) {
        if (blockOnHighRisk) {
          throw error; // Re-throw if we're blocking on errors
        }
        console.error('❌ MCP security scanning failed:', error instanceof Error ? error.message : String(error));
        console.warn('⚠️ Continuing with server initialization despite scan failure');
      }
    }

    // Initialize RemoteMCPManager
    try {
      const { RemoteMCPManager } = await import('./mcp/remote-mcp-manager.js');

      this.remoteMcpManager = new RemoteMCPManager({
        servers: config.servers.map(server => ({
          name: server.name,
          transport: server.transport,
          command: server.command,
          args: server.args,
          env: server.env,
          image: server.image,
          containerArgs: server.containerArgs,
          url: server.url,
          headers: server.headers,
          auth: server.auth,
          autoStart: server.autoStart,
          timeout: server.timeout,
          retries: server.retries
        })),
        autoConnect: true, // Auto-connect on init
        retryOnFailure: config.autoReconnect !== false,
        retryDelay: config.reconnectDelay || 5000,
        maxRetries: config.maxReconnectAttempts || 3
      });

      // Setup event handlers
      this.remoteMcpManager.on('serverConnected', (name: string) => {
        console.log(`✅ Remote MCP server connected: ${name}`);
      });

      this.remoteMcpManager.on('serverDisconnected', ({ name, code }: { name: string; code?: number }) => {
        console.warn(`⚠️ Remote MCP server disconnected: ${name}${code ? ` (exit code: ${code})` : ''}`);
      });

      this.remoteMcpManager.on('serverError', ({ server, error }: { server: string; error: any }) => {
        console.error(`❌ Remote MCP server error (${server}):`, error instanceof Error ? error.message : String(error));
      });

      // Initialize connections
      await this.remoteMcpManager.initialize();

      const connectedServers = this.remoteMcpManager.getConnectedServers();
      const icon = connectedServers.length === config.servers.length ? '✅' : connectedServers.length > 0 ? '⚠️' : '❌';
      console.log(`${icon} Remote MCP: ${connectedServers.length}/${config.servers.length} servers connected`);

    } catch (error) {
      console.error('❌ Failed to initialize remote MCP manager:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  public async start(setupRoutes?: (app: Application) => void): Promise<void> {
    // Initialize OAuth server session storage (if enabled)
    if (this.config.oauth.enabled) {
      await initializeOAuthServer();
    }

    // Initialize remote MCP servers with security scanning
    if (this.config.remoteMcpServers?.enabled && this.config.remoteMcpServers.servers?.length) {
      await this.initializeRemoteMcpServers();
    }

    // Setup routes (including OAuth routes)
    await this.setupRoutes();

    // Setup MCP endpoint if enabled
    if (this.config.mcp?.enabled) {
      console.log('🚀 Setting up MCP server...');
      // Import and create the protocol handler
      const { MCPProtocolHandler } = await import('./trpc/routers/mcp/protocol-handler.js');
      const protocolHandler = new MCPProtocolHandler(
        this.router,
        this.config.mcp,
        this.remoteMcpManager // Pass remote MCP manager for external tool discovery
      );

      const mcpWorkspaceConfig = (this.config.serverWorkspaces && this.config.serverWorkspaces.enabled &&
        this.hasWorkspaceDefinitions(this.config.serverWorkspaces))
        ? this.config.serverWorkspaces
        : undefined;

      if (this.config.serverWorkspaces?.enabled && !mcpWorkspaceConfig) {
        console.warn('⚠️  Server workspace API enabled for MCP, but no workspace paths configured. Skipping workspace manager initialization.');
      }

      if (mcpWorkspaceConfig) {
        try {
          const { createRootManager } = await import('./services/resources/root-manager.js');

          const rootManagerConfig: RootManagerConfig = {};

          if (mcpWorkspaceConfig.defaultWorkspace?.path && mcpWorkspaceConfig.defaultWorkspace.path.trim().length > 0) {
            const normalizedDefault: RootFolderConfig = {
              ...mcpWorkspaceConfig.defaultWorkspace,
              path: mcpWorkspaceConfig.defaultWorkspace.path.trim()
            };
            rootManagerConfig.defaultRoot = normalizedDefault;
          } else if (mcpWorkspaceConfig.defaultWorkspace) {
            console.warn('⚠️  MCP root manager default workspace is defined but missing a path. Ignoring default root.');
          }

          if (mcpWorkspaceConfig.additionalWorkspaces) {
            const normalizedRoots = Object.fromEntries(
              Object.entries(mcpWorkspaceConfig.additionalWorkspaces)
                .map(([rootId, config]) => {
                  if (!config?.path || config.path.trim().length === 0) {
                    console.warn(`⚠️  MCP root manager additional workspace "${rootId}" is missing a path and will be ignored.`);
                    return null;
                  }

                  const normalizedRoot: RootFolderConfig = {
                    ...config,
                    path: config.path.trim()
                  };

                  return [rootId, normalizedRoot] as const;
                })
                .filter((entry): entry is [string, RootFolderConfig] => Boolean(entry))
            );

            if (Object.keys(normalizedRoots).length > 0) {
              rootManagerConfig.roots = normalizedRoots;
            }
          }

          if (!rootManagerConfig.defaultRoot && !rootManagerConfig.roots) {
            throw new Error('No valid workspace paths provided for MCP root manager');
          }

          const rootManager = createRootManager(rootManagerConfig);

          protocolHandler.setRootManager(rootManager);
          console.log('✅ MCP root manager configured for server workspaces');
        } catch (error) {
          console.warn('⚠️ Could not initialize MCP root manager:', error instanceof Error ? error.message : String(error));
        }
      }

      // Setup the MCP endpoint
      protocolHandler.setupMCPEndpoint(this.app, '/mcp');
      console.log('⚠️ MCP endpoint ready at /mcp (security logging, rate limiting enabled, JWT AUTH configured)');
    }

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
    // Close OAuth server if enabled
    if (this.config.oauth.enabled) {
      await closeOAuthServer();
    }
    
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

  /**
   * Completely replace the current router with a new one.
   * 
   * WARNING: This replaces ALL existing routes including AI and MCP routers.
   * If you need MCP tools to be discoverable, ensure your new router includes
   * procedures with MCP metadata (using .meta({ mcp: {...} })).
   * 
   * For adding routes, create a new router with the desired procedures.
   * 
   * @param newRouter - The router to replace the current router with
   * 
   * Example:
   * const newRouter = router({
   *   greeting: publicProcedure
   *     .meta({ mcp: { description: 'Say hello' } })
   *     .input(z.object({ name: z.string() }))
   *     .query(({ input }) => `Hello, ${input.name}!`)
   * });
   * server.setRouter(newRouter);
   */
  public setRouter(newRouter: AnyRouter): void {
    this.router = newRouter as AppRouter;
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
