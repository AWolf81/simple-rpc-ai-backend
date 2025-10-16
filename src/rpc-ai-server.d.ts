/**
 * RPC AI Server
 *
 * One server that supports both JSON-RPC and tRPC endpoints for AI applications.
 * Provides simple configuration for basic use cases and advanced options for complex scenarios.
 */
import 'dotenv/config';
import type { Express, Application } from 'express';
import type { AnyRouter } from '@trpc/server';
import type { AppRouter } from './trpc/root.js';
import type { AIRouterConfig } from './trpc/routers/ai/types.js';
import { MCPExtensionConfig } from './mcp/mcp-config.js';
import { MCPRateLimitConfig } from './security/rate-limiter.js';
import { SecurityLoggerConfig } from './security/security-logger.js';
import { AuthEnforcementConfig } from './security/auth-enforcer.js';
export type BuiltInProvider = 'anthropic' | 'openai' | 'google';
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
export interface RpcAiServerConfig {
    port?: number;
    aiLimits?: AIRouterConfig;
    serverProviders?: (BuiltInProvider | string)[];
    byokProviders?: (BuiltInProvider | string)[];
    customProviders?: CustomProvider[];
    systemPrompts?: Record<string, string>;
    modelRestrictions?: Record<string, {
        allowedModels?: string[];
        allowedPatterns?: string[];
        blockedModels?: string[];
    }>;
    agents?: {
        enabled?: boolean;
        defaultSDK?: 'claude-code' | 'openai';
        enableClaudeCode?: boolean;
        enableOpenAI?: boolean;
        claudeCode?: {
            enableSkills?: boolean;
            skillsDirectory?: string;
            defaultSkills?: Array<{
                id: string;
                name: string;
                description: string;
                level: 1 | 2 | 3;
                instructions?: string;
                resources?: Array<{
                    type: 'file' | 'script' | 'reference';
                    path: string;
                    content?: string;
                }>;
            }>;
        };
        openai?: {
            assistantId?: string;
            instructions?: string;
        };
    };
    secretManager?: {
        type?: 'postgresql';
        host?: string;
        port?: number;
        database?: string;
        user?: string;
        password?: string;
        encryptionKey?: string;
    };
    protocols?: {
        jsonRpc?: boolean;
        tRpc?: boolean;
    };
    debug?: {
        enableTiming?: boolean;
    };
    tokenTracking?: {
        enabled?: boolean;
        platformFeePercent?: number;
        databaseUrl?: string;
        webhookSecret?: string;
        webhookPath?: string;
    };
    jwt?: {
        secret?: string;
        issuer?: string;
        audience?: string;
    };
    oauth?: {
        enabled?: boolean;
        googleClientId?: string;
        googleClientSecret?: string;
        encryptionKey?: string;
        sessionStorage?: {
            type?: 'memory' | 'file' | 'redis';
            filePath?: string;
            redis?: {
                host?: string;
                port?: number;
                password?: string;
                db?: number;
                keyPrefix?: string;
            };
        };
    };
    extensionOAuth?: {
        enabled?: boolean;
        isExtensionOAuth?: (stateData: any) => boolean;
        onUserAuthenticated?: (stateData: any, userId: string, userInfo: {
            email?: string;
            provider: string;
            [key: string]: any;
        }) => void | Promise<void>;
        tokenExchangeHandlers?: {
            [provider: string]: (code: string, callbackUrl: string) => Promise<{
                userId: string;
                email?: string;
                [key: string]: any;
            }>;
        };
        successTemplate?: (user: any, stateData: any) => string;
        errorTemplate?: (error: string, stateData?: any) => string;
    };
    cors?: {
        origin?: string | string[];
        credentials?: boolean;
    };
    trustProxy?: boolean;
    rateLimit?: {
        windowMs?: number;
        max?: number;
    };
    paths?: {
        jsonRpc?: string;
        tRpc?: string;
        health?: string;
        webhooks?: string;
    };
    mcp?: {
        enabled?: boolean;
        transports?: {
            http?: boolean;
            stdio?: boolean;
            sse?: boolean;
            sseEndpoint?: string;
        };
        auth?: {
            requireAuthForToolsList?: boolean;
            requireAuthForToolsCall?: boolean;
            publicTools?: string[];
            opensaas?: {
                enabled?: boolean;
                publicKey?: string;
                audience?: string;
                issuer?: string;
                clockTolerance?: number;
                requireAuthForAllMethods?: boolean;
                skipAuthForMethods?: string[];
            };
        };
        adminUsers?: string[];
        defaultConfig?: {
            enableWebSearchTool?: boolean;
            enableRefTools?: boolean;
            enableFilesystemTools?: boolean;
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
    };
    /**
     * Custom router extensions - allows users to add their own tRPC procedures
     */
    customRouters?: {
        [namespace: string]: any;
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
export declare class RpcAiServer {
    private app;
    private server?;
    private config;
    private router;
    private jwtMiddleware?;
    private dbAdapter?;
    private virtualTokenService?;
    private usageAnalyticsService?;
    private postgresRPCMethods?;
    private jsonRpcBridge?;
    private oauthServer?;
    private oauthStorage?;
    private remoteMcpManager?;
    private agentService?;
    /**
     * Opinionated protocol configuration:
     * - Default: JSON-RPC only (simpler, universal)
     * - If only one protocol specified as true, disable the other
     * - If both explicitly specified, use provided values
     */
    private getOpinionatedProtocols;
    private providerApiKeys;
    constructor(config?: RpcAiServerConfig);
    private createContext;
    private setupMiddleware;
    private attachOAuthUserFromAccessToken;
    private normalizeOAuthScopes;
    private hasWorkspaceDefinitions;
    private setupRoutes;
    /**
     * Handle LemonSqueezy webhook for token top-ups
     */
    private handleLemonSqueezyWebhook;
    /**
     * Initialize remote MCP servers with security scanning
     */
    private initializeRemoteMcpServers;
    start(setupRoutes?: (app: Application) => void): Promise<void>;
    stop(): Promise<void>;
    getApp(): Express;
    getRouter(): AppRouter;
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
    setRouter(newRouter: AnyRouter): void;
    private createServiceProvidersConfig;
    getConfig(): Required<RpcAiServerConfig>;
}
export declare function defineRpcAiServerConfig(config: RpcAiServerConfig): RpcAiServerConfig;
export declare function createRpcAiServer(config?: RpcAiServerConfig): RpcAiServer;
export type { AppRouter };
//# sourceMappingURL=rpc-ai-server.d.ts.map