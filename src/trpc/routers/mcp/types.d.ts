import { JWTMiddleware } from '../../../auth/jwt-middleware';
import { MCPRateLimitConfig } from '../../../security/rate-limiter';
import { SecurityLoggerConfig } from '../../../security/security-logger';
import { AuthEnforcementConfig } from '../../../security/auth-enforcer';
export type MCPAuthType = 'oauth' | 'jwt' | 'both' | 'none';
export interface MCPAuthConfig {
    requireAuthForToolsList?: boolean;
    requireAuthForToolsCall?: boolean;
    publicTools?: string[] | 'default';
    denyPublicTools?: string[];
    publicCategories?: string[];
    _legacyPublicTools?: string[];
    authType?: MCPAuthType;
    oauth?: {
        enabled?: boolean;
        sessionStorePath?: string;
        requireValidSession?: boolean;
    };
    jwt?: {
        enabled?: boolean;
        requireValidSignature?: boolean;
        requiredScopes?: string[];
        allowExpiredTokens?: boolean;
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
    ai?: {
        enabled?: boolean;
        useServerConfig?: boolean;
        restrictToSampling?: boolean;
        allowByokOverride?: boolean;
        mcpProviders?: Record<string, {
            apiKey?: string;
            enabled?: boolean;
            priority?: number;
            models?: string[];
        }>;
        aiServiceConfig?: {
            defaultProvider?: 'anthropic' | 'openai' | 'google' | 'openrouter';
            maxTokens?: number;
            temperature?: number;
            systemPrompts?: Record<string, string>;
        };
        modelRestrictions?: Record<string, {
            allowedModels?: string[];
            allowedPatterns?: string[];
            blockedModels?: string[];
        }>;
        byokProviders?: string[];
        fallbackToServer?: boolean;
    };
    aiService?: any;
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
    /** Suppress authentication warnings in logs (useful for local/testing scenarios) */
    suppressAuthWarning?: boolean;
}
//# sourceMappingURL=types.d.ts.map
