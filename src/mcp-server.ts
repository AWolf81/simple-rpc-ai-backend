/**
 * MCP Server with STDIO and SSE transport support
 * 
 * This module provides MCP Server implementations that work alongside the HTTP server.
 * Supports both STDIO (for Claude Desktop) and SSE (for web clients) transports.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { 
  ListToolsRequestSchema, 
  CallToolRequestSchema, 
  PingRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  LATEST_PROTOCOL_VERSION
} from '@modelcontextprotocol/sdk/types.js';
import type { Express } from 'express';
import { createMCPRouter, MCPProtocolHandler } from './trpc/routers/mcp.js';

export interface MCPServerConfig {
  name?: string;
  version?: string;
  enableStdio?: boolean;
  enableSSE?: boolean;
  sseEndpoint?: string;
}

export class MCPServerManager {
  private server: Server;
  private handler: MCPProtocolHandler;
  private config: MCPServerConfig;

  constructor(config: MCPServerConfig = {}) {
    this.config = {
      name: 'simple-rpc-ai-backend',
      version: '1.0.0',
      enableStdio: false,
      enableSSE: false,
      sseEndpoint: '/sse',
      ...config
    };

    // Create MCP server instance
    this.server = new Server(
      {
        name: this.config.name!,
        version: this.config.version!
      },
      {
        capabilities: {
          tools: {},
          prompts: {},
          resources: {},
          logging: {}
        }
      }
    );

    // Create unified handler with server instance
    const router = createMCPRouter();
    this.handler = new MCPProtocolHandler(router);

    this.setupServerHandlers();
  }

  /**
   * Setup MCP server request handlers
   */
  private setupServerHandlers() {
    // Handle tools/list requests
    this.server.setRequestHandler(
      ListToolsRequestSchema, 
      async () => {
        console.log('📋 MCP SDK: tools/list requested');
        return {
          tools: [
            { name: 'hello', description: 'Generate a greeting', inputSchema: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] } },
            { name: 'echo', description: 'Echo a message', inputSchema: { type: 'object', properties: { message: { type: 'string' } }, required: ['message'] } }
          ]
        };
      }
    );

    // Handle tools/call requests  
    this.server.setRequestHandler(
      CallToolRequestSchema,
      async (request: any) => {
        console.log('🔧 MCP SDK: tools/call requested:', request.params);
        const { name, arguments: args } = request.params;
        
        if (name === 'hello') {
          return { content: [{ type: 'text', text: `Hello ${args.name}! Welcome to Simple RPC AI Backend.` }] };
        } else if (name === 'echo') {
          return { content: [{ type: 'text', text: `Echo: ${args.message}` }] };
        } else {
          throw new Error(`Tool '${name}' not found`);
        }
      }
    );

    // Handle ping requests
    this.server.setRequestHandler(
      PingRequestSchema,
      async () => {
        console.log('🏓 MCP SDK: ping requested');
        return {};
      }
    );

    console.log('✅ MCP SDK server handlers configured (tools only for now)');
  }

  /**
   * Start STDIO transport (for Claude Desktop)
   */
  public async startStdio(): Promise<void> {
    if (!this.config.enableStdio) {
      throw new Error('STDIO transport is not enabled');
    }

    console.log('🚀 Starting MCP STDIO server...');
    
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    
    console.log('✅ MCP STDIO server started (connected to stdin/stdout)');
  }

  /**
   * Setup HTTP+SSE transport (for Claude.ai) 
   * Uses separate endpoints: GET /mcp for SSE and POST /messages for requests
   */
  public setupSSE(app: Express): void {
    if (!this.config.enableSSE) {
      throw new Error('SSE transport is not enabled');
    }

    const endpoint = this.config.sseEndpoint!;
    console.log(`🚀 Setting up MCP HTTP+SSE transport...`);
    
    // Store active SSE connections
    const sseConnections = new Map<string, any>();
    
    // SSE endpoint for Claude.ai - GET /mcp 
    app.get('/mcp', (req, res) => {
      const sessionId = req.query.sessionId as string || 'session-' + Date.now();
      console.log(`🔗 SSE connection established: GET /mcp?sessionId=${sessionId}`);
      
      // Set SSE headers
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
      });

      // Store connection
      sseConnections.set(sessionId, res);
      
      // Send initial connection event
      res.write(`event: message\n`);
      res.write(`data: ${JSON.stringify({
        jsonrpc: '2.0',
        method: 'initialized',
        params: {
          protocolVersion: LATEST_PROTOCOL_VERSION,
          capabilities: { tools: {}, prompts: {}, resources: {} },
          serverInfo: { name: 'Simple RPC AI Backend', version: '1.0.0' }
        }
      })}\n\n`);

      // Handle client disconnect
      req.on('close', () => {
        console.log(`🔌 SSE connection closed: ${sessionId}`);
        sseConnections.delete(sessionId);
      });
    });

    // Message endpoint for Claude.ai requests - POST /messages
    app.post('/messages', async (req, res) => {
      console.log(`📥 MCP request received:`, JSON.stringify(req.body, null, 2));
      
      try {
        // Process MCP request using our handler
        const mcpRequest = req.body;
        const sessionId = req.headers['x-session-id'] as string || 'default';
        
        // Process the MCP request directly
        let mcpResponse;
        
        // Handle basic MCP methods for Claude.ai
        switch (mcpRequest.method) {
          case 'initialize':
            mcpResponse = {
              jsonrpc: '2.0',
              id: mcpRequest.id,
              result: {
                protocolVersion: LATEST_PROTOCOL_VERSION,
                capabilities: { tools: {}, prompts: {}, resources: {} },
                serverInfo: { name: 'Simple RPC AI Backend', version: '1.0.0' }
              }
            };
            break;
            
          case 'tools/list':
            mcpResponse = {
              jsonrpc: '2.0', 
              id: mcpRequest.id,
              result: {
                tools: [
                  { name: 'hello', description: 'Generate a greeting', inputSchema: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] } },
                  { name: 'echo', description: 'Echo a message', inputSchema: { type: 'object', properties: { message: { type: 'string' } }, required: ['message'] } }
                ]
              }
            };
            break;
            
          case 'tools/call':
            const { name, arguments: args } = mcpRequest.params;
            if (name === 'hello') {
              mcpResponse = {
                jsonrpc: '2.0',
                id: mcpRequest.id, 
                result: {
                  content: [{ type: 'text', text: `Hello ${args.name}! Welcome to Simple RPC AI Backend.` }]
                }
              };
            } else if (name === 'echo') {
              mcpResponse = {
                jsonrpc: '2.0',
                id: mcpRequest.id,
                result: {
                  content: [{ type: 'text', text: `Echo: ${args.message}` }]
                }
              };
            } else {
              mcpResponse = {
                jsonrpc: '2.0',
                id: mcpRequest.id,
                error: { code: -32601, message: `Tool '${name}' not found` }
              };
            }
            break;
            
          default:
            mcpResponse = {
              jsonrpc: '2.0',
              id: mcpRequest.id,
              error: { code: -32601, message: `Method '${mcpRequest.method}' not found` }
            };
        }
        
        // Send response via SSE if connection exists
        const sseConnection = sseConnections.get(sessionId);
        if (sseConnection) {
          sseConnection.write(`event: message\n`);
          sseConnection.write(`data: ${JSON.stringify(mcpResponse)}\n\n`);
        }
        
        // Also send HTTP response
        res.json(mcpResponse);
        
      } catch (error) {
        console.error('❌ MCP request processing failed:', error);
        res.status(500).json({
          jsonrpc: '2.0',
          id: req.body?.id || null,
          error: {
            code: -32603,
            message: 'Internal error',
            data: error instanceof Error ? error.message : String(error)
          }
        });
      }
    });

    // Root endpoint for Claude.ai requests - POST /
    // Some Claude.ai versions send requests to root instead of /messages
    app.post('/', async (req, res) => {
      console.log(`📥 MCP request received at root:`, JSON.stringify(req.body, null, 2));
      
      try {
        // Process MCP request using our handler
        const mcpRequest = req.body;
        const sessionId = req.headers['x-session-id'] as string || 'default';
        
        // Process the MCP request directly
        let mcpResponse;
        
        // Handle basic MCP methods for Claude.ai
        switch (mcpRequest.method) {
          case 'initialize':
            mcpResponse = {
              jsonrpc: '2.0',
              id: mcpRequest.id,
              result: {
                protocolVersion: LATEST_PROTOCOL_VERSION,
                capabilities: { tools: {}, prompts: {}, resources: {} },
                serverInfo: { name: 'Simple RPC AI Backend', version: '1.0.0' }
              }
            };
            break;
            
          case 'tools/list':
            mcpResponse = {
              jsonrpc: '2.0', 
              id: mcpRequest.id,
              result: {
                tools: [
                  { name: 'hello', description: 'Generate a greeting', inputSchema: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] } },
                  { name: 'echo', description: 'Echo a message', inputSchema: { type: 'object', properties: { message: { type: 'string' } }, required: ['message'] } }
                ]
              }
            };
            break;
            
          case 'tools/call':
            const { name, arguments: args } = mcpRequest.params;
            if (name === 'hello') {
              mcpResponse = {
                jsonrpc: '2.0',
                id: mcpRequest.id, 
                result: {
                  content: [{ type: 'text', text: `Hello ${args.name}! Welcome to Simple RPC AI Backend.` }]
                }
              };
            } else if (name === 'echo') {
              mcpResponse = {
                jsonrpc: '2.0',
                id: mcpRequest.id,
                result: {
                  content: [{ type: 'text', text: `Echo: ${args.message}` }]
                }
              };
            } else {
              mcpResponse = {
                jsonrpc: '2.0',
                id: mcpRequest.id,
                error: { code: -32601, message: `Tool '${name}' not found` }
              };
            }
            break;
            
          default:
            mcpResponse = {
              jsonrpc: '2.0',
              id: mcpRequest.id,
              error: { code: -32601, message: `Method '${mcpRequest.method}' not found` }
            };
        }
        
        // Send response via SSE if connection exists
        const sseConnection = sseConnections.get(sessionId);
        if (sseConnection) {
          sseConnection.write(`event: message\n`);
          sseConnection.write(`data: ${JSON.stringify(mcpResponse)}\n\n`);
        }
        
        // Also send HTTP response
        res.json(mcpResponse);
        
      } catch (error) {
        console.error('❌ MCP request processing failed:', error);
        res.status(500).json({
          jsonrpc: '2.0',
          id: req.body?.id || null,
          error: {
            code: -32603,
            message: 'Internal error',
            data: error instanceof Error ? error.message : String(error)
          }
        });
      }
    });

    // OAuth endpoints that Claude.ai discovers
    app.get('/.well-known/oauth-authorization-server', (req, res) => {
      console.log('🔐 OAuth authorization server discovery');
      res.json({
        issuer: req.protocol + '://' + req.get('host'),
        authorization_endpoint: req.protocol + '://' + req.get('host') + '/oauth/authorize',
        token_endpoint: req.protocol + '://' + req.get('host') + '/oauth/token',
        response_types_supported: ['code'],
        grant_types_supported: ['authorization_code'],
        code_challenge_methods_supported: ['S256']
      });
    });

    app.get('/.well-known/oauth-protected-resource/mcp', (req, res) => {
      console.log('🔐 OAuth protected resource discovery');
      res.json({
        resource_server: req.protocol + '://' + req.get('host'),
        authorization_servers: [req.protocol + '://' + req.get('host')],
        scopes_supported: ['mcp']
      });
    });

    // Client registration endpoint
    app.post('/register', (req, res) => {
      console.log('📝 Client registration requested:', req.body);
      res.json({
        client_id: 'mcp-client-' + Date.now(),
        client_secret: 'secret-' + Math.random().toString(36).substring(7),
        registration_access_token: 'token-' + Math.random().toString(36).substring(7)
      });
    });

    // CORS support
    app.options(['/mcp', '/messages', '/register'], (req, res) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Session-Id');
      res.status(200).send();
    });

    console.log(`✅ MCP HTTP+SSE transport ready:`);
    console.log(`   • SSE: GET /mcp`);
    console.log(`   • Messages: POST /messages`);
    console.log(`   • OAuth discovery endpoints configured`);
  }

  /**
   * Get the handler instance (for HTTP transport integration)
   */
  public getHandler(): MCPProtocolHandler {
    return this.handler;
  }

  /**
   * Get server info
   */
  public getServerInfo() {
    return {
      name: this.config.name,
      version: this.config.version,
      transports: {
        stdio: this.config.enableStdio,
        sse: this.config.enableSSE,
        sseEndpoint: this.config.sseEndpoint
      }
    };
  }
}

/**
 * Create and configure MCP server manager
 */
export function createMCPServer(config: MCPServerConfig = {}): MCPServerManager {
  return new MCPServerManager(config);
}

/**
 * Standalone STDIO server entry point (for Claude Desktop)
 */
export async function startStdioServer(): Promise<void> {
  console.log('🚀 Simple RPC AI Backend - MCP STDIO Server');
  console.log('📡 Connecting to Claude Desktop via STDIO...');
  
  const mcpServer = createMCPServer({
    enableStdio: true
  });

  try {
    await mcpServer.startStdio();
    console.log('✅ MCP STDIO server running');
    console.log('📝 Configure in Claude Desktop config:');
    console.log('   "simple-rpc-ai-backend": {');
    console.log(`     "command": "node",`);
    console.log(`     "args": ["${process.cwd()}/dist/mcp-stdio-server.js"]`);
    console.log('   }');
  } catch (error) {
    console.error('❌ Failed to start MCP STDIO server:', error);
    process.exit(1);
  }
}