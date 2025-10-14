import { JWTMiddleware } from '../../../auth/jwt-middleware';
import { MCPRateLimitConfig } from '../../../security/rate-limiter';
import { SecurityLoggerConfig } from '../../../security/security-logger';
import { AuthEnforcementConfig } from '../../../security/auth-enforcer';

export type MCPAuthType = 'oauth' | 'jwt' | 'both' | 'none';

export interface MCPAuthConfig {
  requireAuthForToolsList?: boolean;
  requireAuthForToolsCall?: boolean;

  // Hybrid authentication system (priority order)
  publicTools?: string[] | 'default';    // Explicit allow list OR 'default' to use tool metadata
  denyPublicTools?: string[];            // Tools to deny even if marked public (security override)
  publicCategories?: string[];           // Allow tools by category

  // Legacy support (deprecated - use publicTools instead)
  _legacyPublicTools?: string[];

  remoteMcpServers?: {
    enabled?: boolean;
    prefixToolNames?: boolean;
  };

  // New authentication type configuration
  authType?: MCPAuthType; // Default: 'oauth' for backward compatibility

  // OAuth-specific configuration
  oauth?: {
    enabled?: boolean; // Default: true when authType includes 'oauth'
    sessionStorePath?: string; // Path to OAuth session storage
    requireValidSession?: boolean; // Default: true
  };

  // JWT-specific configuration
  jwt?: {
    enabled?: boolean; // Default: true when authType includes 'jwt'
    requireValidSignature?: boolean; // Default: true
    requiredScopes?: string[]; // Required JWT scopes (e.g., ['mcp', 'mcp:call'])
    allowExpiredTokens?: boolean; // Default: false
  };
}

export interface MCPRouterConfig {
  enabled?: boolean;
  mcpService?: any;
  refIntegration?: any;
  defaultConfig?: any;
  adminUsers?: string[];
  jwtMiddleware?: JWTMiddleware;
  rateLimiting?: MCPRateLimitConfig;
  securityLogging?: SecurityLoggerConfig;
  authEnforcement?: AuthEnforcementConfig;
  auth?: MCPAuthConfig;
  remoteMcpServers?: {
    enabled?: boolean;
    prefixToolNames?: boolean;
  };
  ai?: {
    enabled?: boolean; // Default: false - explicit opt-in required
    useServerConfig?: boolean; // Default: true - use same config as ai.generateText
    restrictToSampling?: boolean; // Default: true - only sampling tools use AI
    allowByokOverride?: boolean; // Default: false - allow BYOK API keys in MCP calls

    // MCP-specific AI configuration (used when useServerConfig: false)
    mcpProviders?: Record<string, {
      apiKey?: string;
      enabled?: boolean;
      priority?: number;
      models?: string[];
    }>;

    // MCP-specific AI service configuration
    aiServiceConfig?: {
      defaultProvider?: 'anthropic' | 'openai' | 'google' | 'openrouter';
      maxTokens?: number;
      temperature?: number;
      systemPrompts?: Record<string, string>;
    };

    // MCP-specific model restrictions
    modelRestrictions?: Record<string, {
      allowedModels?: string[];
      allowedPatterns?: string[];
      blockedModels?: string[];
    }>;

    // BYOK configuration
    byokProviders?: string[];
    fallbackToServer?: boolean; // Default: true - fallback to server config if BYOK not provided
  };
  aiService?: any; // AIService instance for sampling procedures (internal)
  dnsRebinding?: {
    /** List of allowed host header values for DNS rebinding protection */
    allowedHosts?: string[];
    /** List of allowed origin header values for DNS rebinding protection */
    allowedOrigins?: string[];
    /** Enable DNS rebinding protection (requires allowedHosts and/or allowedOrigins to be configured) */
    enableDnsRebindingProtection?: boolean;
  };
  extensions?: {
    prompts?: {
      customPrompts?: any[];
      customTemplates?: Record<string, any>;
    };
    resources?: {
      customResources?: any[];
      customHandlers?: Record<string, any>;
      customTemplates?: any[];
      templateHandlers?: Record<string, any>;
    };
  };

  /**
   * Namespace whitelist for MCP tool filtering
   * If specified, only tools from these namespaces will be exposed via MCP
   * Examples: ['math', 'utility'], ['ai', 'system'], ['custom']
   * If not specified, all available tools are exposed
   */
  namespaceWhitelist?: string[];
}
