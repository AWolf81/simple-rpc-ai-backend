/**
 * Standalone tRPC Panel Server for Development
 *
 * Runs independently from the main RPC AI server to provide
 * interactive API testing during development.
 */
import type { AnyRouter } from '@trpc/server';
export interface PanelServerConfig {
    /** Port for the panel server (default: 8080) */
    port?: number;
    /** Path for the panel (default: '/') */
    path?: string;
    /** URL of the tRPC server to connect to */
    trpcUrl: string;
    /** Router instance for schema introspection */
    router?: AnyRouter | undefined;
    /** Transformer used by tRPC (default: 'superjson') */
    transformer?: 'superjson' | 'serialize' | undefined;
}
export declare class TrpcPanelServer {
    private app;
    private server?;
    private config;
    constructor(config: PanelServerConfig);
    private setupRoutes;
    start(): Promise<void>;
    stop(): Promise<void>;
    /**
     * Update the router instance (useful for development when router changes)
     */
    updateRouter(router: AnyRouter): void;
    /**
     * Get the current configuration
     */
    getConfig(): Required<Omit<PanelServerConfig, 'router'>> & {
        router?: AnyRouter;
    };
}
/**
 * Convenience function to quickly start a panel server
 */
export declare function startTrpcPanel(config: PanelServerConfig): Promise<TrpcPanelServer>;
/**
 * Create panel server connected to local RPC AI server
 */
export declare function createLocalPanelServer(router?: AnyRouter, port?: number): TrpcPanelServer;
//# sourceMappingURL=trpc-panel-server.d.ts.map