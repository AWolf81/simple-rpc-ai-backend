import type { Express } from 'express';
import type { ServiceProvidersConfig } from './services/ai-service.js';
export interface SimpleAIServerConfig {
    port?: number;
    serviceProviders?: ServiceProvidersConfig;
    cors?: {
        origin?: string | string[];
        credentials?: boolean;
    };
    rateLimit?: {
        windowMs?: number;
        max?: number;
    };
}
export declare class SimpleAIServer {
    private app;
    private server?;
    private aiService;
    private config;
    constructor(config?: SimpleAIServerConfig);
    private setupMiddleware;
    private setupRoutes;
    start(): Promise<void>;
    stop(): Promise<void>;
    getApp(): Express;
    private getOpenRPCSchema;
}
export declare function createSimpleAIServer(config?: SimpleAIServerConfig): SimpleAIServer;
export default SimpleAIServer;
//# sourceMappingURL=server-simple.d.ts.map