/**
 * tRPC + Express Server
 *
 * Production-ready server combining Express with tRPC for type-safe APIs.
 * Maintains compatibility with our existing JSON-RPC endpoints while
 * adding modern tRPC functionality.
 */
import type { Express } from 'express';
import type { AppRouter } from './trpc/root.js';
export interface TRPCServerConfig {
    port?: number;
    cors?: {
        origin?: string | string[];
        credentials?: boolean;
    };
    rateLimit?: {
        windowMs?: number;
        max?: number;
    };
    trpcPath?: string;
}
export declare class TRPCServer {
    private app;
    private server?;
    private config;
    constructor(config?: TRPCServerConfig);
    private setupMiddleware;
    private setupRoutes;
    private getOpenRPCSchema;
    start(): Promise<void>;
    stop(): Promise<void>;
    getApp(): Express;
    getRouter(): AppRouter;
}
export declare function createTRPCServer(config?: TRPCServerConfig): TRPCServer;
export type { AppRouter };
//# sourceMappingURL=server-trpc.d.ts.map