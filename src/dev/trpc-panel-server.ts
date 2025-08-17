/**
 * Standalone tRPC Panel Server for Development
 * 
 * Runs independently from the main RPC AI server to provide
 * interactive API testing during development.
 */

import express from 'express';
import type { Express, Request, Response } from 'express';
import type { Server } from 'http';
import { renderTrpcPanel } from 'trpc-panel';
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

export class TrpcPanelServer {
  private app: Express;
  private server?: Server;
  private config: Required<Omit<PanelServerConfig, 'router'>> & { router?: AnyRouter };

  constructor(config: PanelServerConfig) {
    this.config = {
      port: 8080,
      path: '/',
      transformer: 'superjson' as const,
      router: config.router,
      ...config
    };

    this.app = express();
    this.setupRoutes();
  }

  private setupRoutes(): void {
    // Health check
    this.app.get('/health', (_req: Request, res: Response) => {
      res.json({
        status: 'healthy',
        service: 'trpc-panel-server',
        timestamp: new Date().toISOString(),
        trpcUrl: this.config.trpcUrl
      });
    });

    // Panel route
    this.app.get(this.config.path, (_req: Request, res: Response) => {
      if (!this.config.router) {
        return res.status(500).send(`
          <html>
            <body>
              <h1>tRPC Panel Server</h1>
              <p>❌ No router instance provided. Cannot render panel.</p>
              <p>Make sure to pass the router instance when creating the panel server.</p>
              <hr>
              <p>Target tRPC URL: <code>${this.config.trpcUrl}</code></p>
            </body>
          </html>
        `);
      }

      try {
        const panelHtml = renderTrpcPanel(this.config.router, {
          url: this.config.trpcUrl,
          transformer: this.config.transformer === 'serialize' ? undefined : this.config.transformer,
        });
        
        return res.send(panelHtml);
      } catch (error) {
        console.error('Failed to render tRPC panel:', error);
        return res.status(500).send(`
          <html>
            <body>
              <h1>tRPC Panel Server</h1>
              <p>❌ Failed to render panel: ${error instanceof Error ? error.message : 'Unknown error'}</p>
              <hr>
              <p>Target tRPC URL: <code>${this.config.trpcUrl}</code></p>
            </body>
          </html>
        `);
      }
    });

    // Catch-all for other routes
    this.app.use('*', (_req: Request, res: Response) => {
      res.status(404).json({
        error: 'Not found',
        message: 'This endpoint does not exist.',
        availableEndpoints: {
          panel: this.config.path,
          health: '/health'
        }
      });
    });
  }

  async start(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      try {
        this.server = this.app.listen(this.config.port, () => {
          console.log(`
🎛️  tRPC Panel Server running!

📍 Panel URL: http://localhost:${this.config.port}${this.config.path}
🔗 Target tRPC: ${this.config.trpcUrl}
📋 Transformer: ${this.config.transformer || 'none'}

💡 Use this panel to test your tRPC API interactively
          `);
          resolve();
        });

        this.server.on('error', (error) => {
          console.error('Panel server failed to start:', error);
          reject(error);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  async stop(): Promise<void> {
    return new Promise<void>((resolve) => {
      if (this.server) {
        this.server.close(() => {
          console.log('🛑 tRPC Panel Server stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * Update the router instance (useful for development when router changes)
   */
  updateRouter(router: AnyRouter): void {
    this.config.router = router;
  }

  /**
   * Get the current configuration
   */
  getConfig(): Required<Omit<PanelServerConfig, 'router'>> & { router?: AnyRouter } {
    return { ...this.config };
  }
}

/**
 * Convenience function to quickly start a panel server
 */
export async function startTrpcPanel(config: PanelServerConfig): Promise<TrpcPanelServer> {
  const panelServer = new TrpcPanelServer(config);
  await panelServer.start();
  return panelServer;
}

/**
 * Create panel server connected to local RPC AI server
 */
export function createLocalPanelServer(router?: AnyRouter, port = 8080): TrpcPanelServer {
  return new TrpcPanelServer({
    port,
    trpcUrl: 'http://localhost:8000/trpc',
    router,
    transformer: 'superjson'
  });
}