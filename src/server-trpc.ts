/**
 * tRPC + Express Server
 * 
 * Production-ready server combining Express with tRPC for type-safe APIs.
 * Maintains compatibility with our existing JSON-RPC endpoints while 
 * adding modern tRPC functionality.
 */

import express from 'express';
import type { Express, Request, Response } from 'express';
import type { Server } from 'http';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import * as trpcExpress from '@trpc/server/adapters/express';

import { appRouter } from './trpc/root.js';
import { createTRPCContext } from './trpc/trpc.js';
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

export class TRPCServer {
  private app: Express;
  private server?: Server;
  private config: TRPCServerConfig;

  constructor(config: TRPCServerConfig = {}) {
    this.config = {
      port: 8000,
      trpcPath: '/trpc',
      ...config
    };
    
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware() {
    // Security
    this.app.use(helmet());
    
    // CORS
    this.app.use(cors({
      origin: this.config.cors?.origin || '*',
      credentials: this.config.cors?.credentials || false,
      methods: ['GET', 'POST', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization']
    }));

    // Rate limiting
    this.app.use(rateLimit({
      windowMs: this.config.rateLimit?.windowMs || 15 * 60 * 1000, // 15 minutes
      max: this.config.rateLimit?.max || 100,
      message: 'Too many requests from this IP, please try again later'
    }));

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));
  }

  private setupRoutes() {
    // Health check
    this.app.get('/health', (req: Request, res: Response) => {
      res.json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        version: '0.1.0',
        server: 'tRPC + Express'
      });
    });

    // tRPC Express adapter
    this.app.use(
      this.config.trpcPath!,
      trpcExpress.createExpressMiddleware({
        router: appRouter,
        createContext: createTRPCContext,
        onError: ({ path, error }) => {
          console.error(`❌ tRPC failed on ${path ?? "<no-path>"}:`, error);
        },
      })
    );

    // Legacy JSON-RPC compatibility endpoint
    this.app.post('/rpc', async (req: Request, res: Response) => {
      try {
        const { method, params, id } = req.body;

        // Basic JSON-RPC compatibility (simplified for now)
        switch (method) {
          case 'health':
            return res.json({
              jsonrpc: '2.0',
              id,
              result: { 
                status: 'healthy', 
                timestamp: new Date().toISOString(),
                server: 'tRPC + Express'
              }
            });

          case 'rpc.discover':
            return res.json({
              jsonrpc: '2.0',
              id,
              result: this.getOpenRPCSchema()
            });

          default:
            return res.json({
              jsonrpc: '2.0',
              id,
              error: {
                code: -32601,
                message: `Method not found: ${method}. Use tRPC endpoints at /trpc for full functionality.`
              }
            });
        }
      } catch (error) {
        return res.status(500).json({
          jsonrpc: '2.0',
          id: req.body?.id || null,
          error: {
            code: -32700,
            message: 'Parse error'
          }
        });
      }
    });

    // OpenRPC schema endpoint
    this.app.get('/openrpc.json', (req: Request, res: Response) => {
      res.json(this.getOpenRPCSchema());
    });

    // API documentation
    this.app.get('/api-docs', (req: Request, res: Response) => {
      res.json({
        title: 'AI Backend API',
        description: 'Type-safe AI backend with tRPC and JSON-RPC compatibility',
        version: '0.1.0',
        endpoints: {
          tRPC: `${req.protocol}://${req.get('host')}${this.config.trpcPath}`,
          jsonRPC: `${req.protocol}://${req.get('host')}/rpc`,
          openRPC: `${req.protocol}://${req.get('host')}/openrpc.json`,
          health: `${req.protocol}://${req.get('host')}/health`
        },
        procedures: [
          'ai.health',
          'ai.executeAIRequest', 
          'ai.listProviders',
          'ai.validateProvider'
        ]
      });
    });

    // Catch all
    this.app.use('*', (req: Request, res: Response) => {
      res.status(404).json({
        error: 'Not found',
        message: 'Available endpoints: /trpc, /rpc, /health, /api-docs, /openrpc.json'
      });
    });
  }

  private getOpenRPCSchema() {
    return {
      openrpc: "1.2.6",
      info: {
        title: "AI Backend API",
        description: "Type-safe AI backend with tRPC and JSON-RPC compatibility",
        version: "0.1.0"
      },
      servers: [{
        name: "tRPC + Express Server",
        url: `http://localhost:${this.config.port}/rpc`,
        description: "JSON-RPC endpoint (legacy compatibility)"
      }],
      methods: [
        {
          name: "health",
          description: "Check server health and availability status",
          params: [],
          result: {
            name: "healthResult",
            schema: {
              type: "object",
              properties: {
                status: { type: "string" },
                timestamp: { type: "string", format: "date-time" },
                uptime: { type: "number" },
                version: { type: "string" }
              },
              required: ["status", "timestamp"]
            }
          }
        },
        {
          name: "executeAIRequest",
          description: "Execute AI analysis request with system prompt protection",
          params: [
            {
              name: "content",
              required: true,
              schema: { type: "string", minLength: 1, maxLength: 100000 }
            },
            {
              name: "systemPrompt", 
              required: true,
              schema: { type: "string", minLength: 1 }
            },
            {
              name: "options",
              required: false,
              schema: {
                type: "object",
                properties: {
                  model: { type: "string" },
                  maxTokens: { type: "integer", minimum: 1, maximum: 8192 },
                  temperature: { type: "number", minimum: 0, maximum: 1 }
                }
              }
            }
          ],
          result: {
            name: "aiResult",
            schema: {
              type: "object",
              properties: {
                content: { type: "string" },
                usage: {
                  type: "object",
                  properties: {
                    promptTokens: { type: "integer" },
                    completionTokens: { type: "integer" },
                    totalTokens: { type: "integer" }
                  }
                },
                model: { type: "string" },
                finishReason: { type: "string" }
              },
              required: ["content", "usage", "model"]
            }
          }
        }
      ]
    };
  }

  public async start(): Promise<void> {
    return new Promise((resolve) => {
      this.server = this.app.listen(this.config.port, () => {
        console.log(`🚀 tRPC + Express AI Server running on port ${this.config.port}`);
        console.log(`📍 tRPC endpoint: http://localhost:${this.config.port}${this.config.trpcPath}`);
        console.log(`📍 JSON-RPC endpoint: http://localhost:${this.config.port}/rpc`);
        console.log(`📍 API docs: http://localhost:${this.config.port}/api-docs`);
        console.log(`📍 OpenRPC schema: http://localhost:${this.config.port}/openrpc.json`);
        resolve();
      });
    });
  }

  public async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          console.log('Server stopped');
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
    return appRouter;
  }
}

// Factory function for easy usage
export function createTRPCServer(config: TRPCServerConfig = {}): TRPCServer {
  return new TRPCServer(config);
}

// Export the app router type for client usage
export type { AppRouter };