/**
 * RPC AI Server
 *
 * One server that supports both JSON-RPC and tRPC endpoints for AI applications.
 * Provides simple configuration for basic use cases and advanced options for complex scenarios.
 */
import type { Express } from 'express';
import type { AppRouter } from './trpc/root.js';
import type { AIRouterConfig } from './trpc/routers/ai.js';
export interface RpcAiServerConfig {
    port?: number;
    aiLimits?: AIRouterConfig;
    protocols?: {
        jsonRpc?: boolean;
        tRpc?: boolean;
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
    };
}
export declare class RpcAiServer {
    private app;
    private server?;
    private config;
    private router;
    private aiService;
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
    private getOpenRPCSchema;
    start(): Promise<void>;
    stop(): Promise<void>;
    getApp(): Express;
    getRouter(): AppRouter;
    getConfig(): Required<RpcAiServerConfig>;
}
export declare function createRpcAiServer(config?: RpcAiServerConfig): RpcAiServer;
export type { AppRouter };
//# sourceMappingURL=rpc-ai-server.d.ts.map