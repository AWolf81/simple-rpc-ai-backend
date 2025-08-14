import express from 'express';
import type { Express, Request, Response } from 'express';
import type { Server } from 'http';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { AIService } from './services/ai-service.js';
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

export class SimpleAIServer {
  private app: Express;
  private server?: Server;
  private aiService: AIService;
  private config: SimpleAIServerConfig;

  constructor(config: SimpleAIServerConfig = {}) {
    this.config = {
      port: 8000,
      ...config
    };
    
    this.app = express();
    this.setupMiddleware();
    
    // Initialize AI service
    this.aiService = new AIService({
      serviceProviders: config.serviceProviders || {
        anthropic: { priority: 1 },
        openai: { priority: 2 },
        google: { priority: 3 }
      }
    });
    
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
      max: this.config.rateLimit?.max || 100, // limit each IP to 100 requests per windowMs
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
        version: '0.1.0'
      });
    });

    // OpenRPC schema endpoint
    this.app.get('/openrpc.json', (req: Request, res: Response) => {
      res.json(this.getOpenRPCSchema());
    });

    // JSON-RPC endpoint
    this.app.post('/rpc', async (req: Request, res: Response) => {
      try {
        const { method, params, id } = req.body;

        // Handle JSON-RPC methods
        switch (method) {
          case 'health':
            return res.json({
              jsonrpc: '2.0',
              id,
              result: { 
                status: 'healthy', 
                timestamp: new Date().toISOString() 
              }
            });

          case 'rpc.discover':
            return res.json({
              jsonrpc: '2.0',
              id,
              result: this.getOpenRPCSchema()
            });

          case 'executeAIRequest':
            const { content, systemPrompt, options } = params;
            
            if (!content || !systemPrompt) {
              return res.json({
                jsonrpc: '2.0',
                id,
                error: {
                  code: -32602,
                  message: 'Invalid params: content and systemPrompt are required'
                }
              });
            }

            try {
              const result = await this.aiService.execute({
                content,
                systemPrompt,
                options
              });

              return res.json({
                jsonrpc: '2.0',
                id,
                result
              });
            } catch (error) {
              return res.json({
                jsonrpc: '2.0',
                id,
                error: {
                  code: -32603,
                  message: `AI service error: ${error instanceof Error ? error.message : 'Unknown error'}`
                }
              });
            }

          default:
            return res.json({
              jsonrpc: '2.0',
              id,
              error: {
                code: -32601,
                message: `Method not found: ${method}`
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

    // Catch all
    this.app.use('*', (req: Request, res: Response) => {
      res.status(404).json({
        error: 'Not found',
        message: 'This endpoint does not exist. Try POST /rpc for JSON-RPC calls.'
      });
    });
  }

  public async start(): Promise<void> {
    return new Promise((resolve) => {
      this.server = this.app.listen(this.config.port, () => {
        console.log(`🚀 Simple AI RPC Server running on port ${this.config.port}`);
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

  private getOpenRPCSchema() {
    return {
      openrpc: "1.2.6",
      info: {
        title: "Simple RPC AI Backend",
        description: "Platform-agnostic JSON-RPC server for AI integration",
        version: "0.1.0"
      },
      servers: [{
        name: "Local Development Server",
        url: `http://localhost:${this.config.port}/rpc`,
        description: "JSON-RPC endpoint"
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
                timestamp: { type: "string", format: "date-time" }
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
              schema: {
                type: "string",
                minLength: 1,
                maxLength: 100000
              }
            },
            {
              name: "systemPrompt", 
              required: true,
              schema: {
                type: "string",
                minLength: 1
              }
            },
            {
              name: "options",
              required: false,
              schema: {
                type: "object",
                properties: {
                  model: { type: "string" },
                  maxTokens: { type: "integer", minimum: 1 },
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
        },
        {
          name: "rpc.discover",
          description: "OpenRPC service discovery method",
          params: [],
          result: {
            name: "openrpcDocument",
            schema: {
              type: "object",
              description: "Complete OpenRPC specification document"
            }
          }
        }
      ]
    };
  }
}

// Factory function for easy usage
export function createSimpleAIServer(config: SimpleAIServerConfig = {}): SimpleAIServer {
  return new SimpleAIServer(config);
}

// Default export for convenience
export default SimpleAIServer;