/**
 * RPC AI Server
 * 
 * One server that supports both JSON-RPC and tRPC endpoints for AI applications.
 * Provides simple configuration for basic use cases and advanced options for complex scenarios.
 */

import 'dotenv/config';
import express from 'express';
import type { Express, Request, Response, Application } from 'express';
import crypto from 'crypto';
import type { Server } from 'http';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import * as trpcExpress from '@trpc/server/adapters/express';
import { createTRPCContext, router } from './trpc/index.js';
import { createAppRouter } from './trpc/root.js';
import type { AnyRouter } from '@trpc/server';
import type { AppRouter } from './trpc/root.js';
import type { AIRouterConfig } from './trpc/routers/ai/types.js';
import { JWTMiddleware } from './auth/jwt-middleware.js';
import { PostgreSQLAdapter } from './database/postgres-adapter.js';
import { VirtualTokenService } from './services/virtual-token-service.js';
import { UsageAnalyticsService } from './services/usage-analytics-service.js';
import { PostgreSQLRPCMethods } from './auth/PostgreSQLRPCMethods.js';
import { RPC_METHODS } from './constants.js';
import { createTRPCToJSONRPCBridge } from './trpc/trpc-to-jsonrpc-bridge.js';
import { MCPExtensionConfig } from './mcp/mcp-config.js';
import { MCPRateLimitConfig } from './security/rate-limiter.js';
import { SecurityLoggerConfig } from './security/security-logger.js';
import { AuthEnforcementConfig } from './security/auth-enforcer.js';
import { createOAuthServer, initializeOAuthServer, closeOAuthServer } from './auth/oauth-middleware.js';
import { getTestSafeConfig } from './security/test-helpers.js';

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
    enabled?: boolean;
    enableMCP?: boolean;  // Internal property - automatically set based on enabled and mcp object presence
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
    /** Default workspace folder configuration */
    defaultWorkspace?: {
      /** Path to default workspace folder (defaults to current working directory) */
      path?: string;
      /** Whether default workspace is read-only */
      readOnly?: boolean;
      /** Allowed file extensions */
      allowedExtensions?: string[];
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
    }>;

    /** Enable file operations via tRPC/MCP */
    enableAPI?: boolean;
  };

  /**
   * @deprecated Use serverWorkspaces instead. This will be removed in a future version.
   * Root folder management configuration (legacy)
   */
  rootFolders?: {
    /** Default root folder configuration */
    defaultRoot?: {
      /** Path to default root folder (defaults to current working directory) */
      path?: string;
      /** Whether default root is read-only */
      readOnly?: boolean;
      /** Allowed file extensions */
      allowedExtensions?: string[];
    };

    /** Additional named root folders */
    additionalRoots?: Record<string, {
      /** Absolute path to the root folder */
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
    }>;

    /** Enable file operations via tRPC/MCP */
    enableAPI?: boolean;
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
  private oauthStorage?: ReturnType<typeof createOAuthServer>['storage'];

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

  constructor(config: RpcAiServerConfig = {}) {
    // Apply test-safe configuration if in test environment
    config = getTestSafeConfig(config);
    
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
      oauth: {
        enabled: false,
        ...config.oauth
      },
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
        enableMCP: config.mcp?.enabled !== false && !!config.mcp,  // Enable MCP if mcp config object is provided and not explicitly disabled
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

      // Server workspace configuration (preferred)
      serverWorkspaces: {
        enableAPI: true,
        ...config.serverWorkspaces
      },

      // Legacy root folders configuration (for backward compatibility)
      rootFolders: {
        enableAPI: true,
        ...config.rootFolders
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
    if (this.config.mcp?.enableMCP) {
      console.log('🔍 RPC Server MCP Config:', {
        hasMcpConfig: !!this.config.mcp,
        extensions: this.config.mcp?.extensions ? {
          hasPrompts: !!this.config.mcp.extensions.prompts,
          hasResources: !!this.config.mcp.extensions.resources,
          promptsConfig: this.config.mcp.extensions.prompts,
          resourcesConfig: this.config.mcp.extensions.resources
        } : null
      });
    }

    if ((config as any).providers) {
      const providersObj = (config as any).providers;
      for (const providerName in providersObj) {
        if (providersObj[providerName].apiKey) {
          this.providerApiKeys[providerName] = providersObj[providerName].apiKey;
        }
      }
    } else if (this.config.serverProviders) {
      for (const provider of this.config.serverProviders) {
        if (typeof provider === 'string') {
          const envKey = `${provider.toUpperCase()}_API_KEY`;
          const apiKey = process.env[envKey];
          this.providerApiKeys[provider] = apiKey;
        }
      }
    }

    // Create router with AI configuration and token tracking
    // Create workspace configuration with fallback to rootFolders for backward compatibility
    const workspaceConfig = this.config.serverWorkspaces || this.config.rootFolders;

    this.router = createAppRouter(
      {
        config: this.config.aiLimits,
        tokenTrackingEnabled: this.config.tokenTracking.enabled || false,
        dbAdapter: this.dbAdapter,
        serverProviders: this.config.serverProviders,
        byokProviders: this.config.byokProviders,
        postgresRPCMethods: this.postgresRPCMethods,
        modelRestrictions: this.config.modelRestrictions
      },
      this.config.tokenTracking.enabled || false,
      this.dbAdapter,
      this.config.serverProviders,
      this.config.byokProviders,
      this.postgresRPCMethods,
      this.config.mcp,
      this.config.modelRestrictions,
      workspaceConfig, // Pass serverWorkspaces (preferred) or rootFolders (fallback)
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
      console.log(`🔧 Trust proxy enabled for reverse proxy support`);
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
      };
    };
  }

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
      res.json({
        port: this.config.port,
        baseUrl: `http://localhost:${this.config.port}`,
        endpoints: {
          health: `http://localhost:${this.config.port}${this.config.paths.health}`,
          jsonRpc: this.config.protocols.jsonRpc ? `http://localhost:${this.config.port}${this.config.paths.jsonRpc}` : null,
          tRpc: this.config.protocols.tRpc ? `http://localhost:${this.config.port}${this.config.paths.tRpc}` : null,
          mcp: this.config.mcp?.enableMCP ? `http://localhost:${this.config.port}/mcp` : null,
        },
        protocols: {
          jsonRpc: this.config.protocols.jsonRpc,
          tRpc: this.config.protocols.tRpc,
          mcp: this.config.mcp?.enableMCP || false,
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
          
          const { redirect_uris, client_name, grant_types } = req.body;
          
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




  public async start(setupRoutes?: (app: Application) => void): Promise<void> {
    // Initialize OAuth server session storage (if enabled)
    if (this.config.oauth.enabled) {
      await initializeOAuthServer();
    }
    
    // Setup routes (including OAuth routes)
    await this.setupRoutes();

    // Setup MCP endpoint if enabled
    if (this.config.mcp?.enableMCP) {
      console.log('🚀 Setting up MCP server...');
      // Import and create the protocol handler
      const { MCPProtocolHandler } = await import('./trpc/routers/mcp/protocol-handler.js');
      const protocolHandler = new MCPProtocolHandler(
        this.router,
        this.config.mcp
      );

      // Import and provide the default root manager for roots capability
      try {
        const { defaultRootManager } = await import('./services/root-manager.js');
        protocolHandler.setRootManager(defaultRootManager);
        console.log('✅ MCP roots capability enabled with defaultRootManager');
      } catch (error) {
        console.warn('⚠️ Could not initialize MCP roots capability:', error instanceof Error ? error.message : String(error));
      }

      // Also set up workspace manager for server workspaces if configured
      if (this.config.serverWorkspaces) {
        try {
          const { WorkspaceManager } = await import('./services/workspace-manager.js');
          const workspaceManager = new WorkspaceManager();

          // Add configured server workspaces
          for (const [workspaceId, config] of Object.entries(this.config.serverWorkspaces)) {
            if (workspaceId !== 'enableAPI' && config && typeof config === 'object') {
              try {
                workspaceManager.addWorkspace(workspaceId, config as any);
                console.log(`✅ Added server workspace: ${workspaceId} at ${config.path}`);
              } catch (error) {
                console.warn(`⚠️ Failed to add workspace ${workspaceId}:`, error instanceof Error ? error.message : String(error));
              }
            }
          }

          // Set the workspace manager on the protocol handler
          protocolHandler.setWorkspaceManager(workspaceManager);
          console.log('✅ MCP server workspace manager configured');
        } catch (error) {
          console.warn('⚠️ Could not initialize server workspace manager:', error instanceof Error ? error.message : String(error));
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