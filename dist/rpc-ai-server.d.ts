/**
 * RPC AI Server
 *
 * One server that supports both JSON-RPC and tRPC endpoints for AI applications.
 * Provides simple configuration for basic use cases and advanced options for complex scenarios.
 */
import type { Express } from 'express';
import type { AppRouter } from './trpc/root.js';
import type { AIRouterConfig } from './trpc/routers/ai.js';
export type BuiltInProvider = 'anthropic' | 'openai' | 'google';
export interface CustomProvider {
    name: string;
    baseUrl: string;
    apiKeyHeader?: string;
    apiKeyPrefix?: string;
    modelMapping?: Record<string, string>;
    defaultModel?: string;
    requestTransform?: (req: any) => any;
    responseTransform?: (res: any) => any;
}
export interface RpcAiServerConfig {
    port?: number;
    aiLimits?: AIRouterConfig;
    serverProviders?: (BuiltInProvider | string)[];
    byokProviders?: (BuiltInProvider | string)[];
    customProviders?: CustomProvider[];
    protocols?: {
        jsonRpc?: boolean;
        tRpc?: boolean;
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
    cors?: {
        origin?: string | string[];
        credentials?: boolean;
    };
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
}
export declare class RpcAiServer {
    private app;
    private server?;
    private config;
    private router;
    private aiService;
    private jwtMiddleware?;
    private dbAdapter?;
    private virtualTokenService?;
    private usageAnalyticsService?;
    /**
     * Opinionated protocol configuration:
     * - Default: JSON-RPC only (simpler, universal)
     * - If only one protocol specified as true, disable the other
     * - If both explicitly specified, use provided values
     */
    private getOpinionatedProtocols;
    constructor(config?: RpcAiServerConfig);
    private setupMiddleware;
    private setupRoutes;
    /**
     * Handle LemonSqueezy webhook for token top-ups
     */
    private handleLemonSqueezyWebhook;
    private getOpenRPCSchema;
    start(): Promise<void>;
    stop(): Promise<void>;
    getApp(): Express;
    getRouter(): AppRouter;
    private createServiceProvidersConfig;
    getConfig(): Required<RpcAiServerConfig>;
}
export declare function defineRpcAiServerConfig<TServerProviders extends readonly (BuiltInProvider | string)[], TByokProviders extends readonly (BuiltInProvider | string)[], TCustomProviders extends readonly CustomProvider[]>(config: {
    port?: number;
    aiLimits?: AIRouterConfig;
    serverProviders?: TServerProviders;
    byokProviders?: TByokProviders;
    customProviders?: TCustomProviders;
    protocols?: {
        jsonRpc?: boolean;
        tRpc?: boolean;
    };
    tokenTracking?: RpcAiServerConfig['tokenTracking'];
    jwt?: RpcAiServerConfig['jwt'];
    cors?: RpcAiServerConfig['cors'];
    rateLimit?: RpcAiServerConfig['rateLimit'];
    paths?: RpcAiServerConfig['paths'];
}): {
    serverProviders: TServerProviders;
    byokProviders: TByokProviders;
    customProviders: TCustomProviders;
} & RpcAiServerConfig;
export declare function createRpcAiServer(config?: RpcAiServerConfig): RpcAiServer;
export type { AppRouter };
//# sourceMappingURL=rpc-ai-server.d.ts.map