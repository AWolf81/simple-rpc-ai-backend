/**
 * tRPC to JSON-RPC Bridge
 * 
 * Automatically generates JSON-RPC handlers from tRPC routers to eliminate code duplication.
 * This allows us to maintain a single source of truth in tRPC while supporting JSON-RPC protocol.
 */

import type { AnyRouter, inferRouterContext, TRPCError } from '@trpc/server';
import type { CreateExpressContextOptions } from '@trpc/server/adapters/express';
import type { Request, Response } from 'express';
import type { AppRouter } from './root';
import { createTRPCContext } from './index';

interface JSONRPCRequest {
  jsonrpc: '2.0';
  method: string;
  params?: any;
  id?: string | number | null;
}

interface JSONRPCResponse {
  jsonrpc: '2.0';
  id?: string | number | null;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

interface JSONRPCError {
  code: number;
  message: string;
  data?: any;
}

/**
 * Maps tRPC error codes to JSON-RPC error codes
 */
function mapTRPCErrorToJSONRPC(error: TRPCError): JSONRPCError {
  switch (error.code) {
    case 'BAD_REQUEST':
      return { code: -32602, message: 'Invalid params', data: error.message };
    case 'UNAUTHORIZED':
      return { code: -32001, message: 'Unauthorized', data: error.message };
    case 'FORBIDDEN':
      return { code: -32002, message: 'Forbidden', data: error.message };
    case 'NOT_FOUND':
      return { code: -32601, message: 'Method not found', data: error.message };
    case 'INTERNAL_SERVER_ERROR':
      return { code: -32603, message: 'Internal error', data: error.message };
    case 'PARSE_ERROR':
      return { code: -32700, message: 'Parse error', data: error.message };
    default:
      return { code: -32603, message: 'Internal error', data: error.message };
  }
}

/**
 * Bridge class that converts tRPC router to JSON-RPC handler
 */
export class TRPCToJSONRPCBridge {
  constructor(
    private router: AppRouter, 
    private contextCreator?: (opts: CreateExpressContextOptions) => any
  ) {}

  /**
   * Create Express middleware that handles JSON-RPC requests using tRPC procedures
   */
  createHandler() {
    return async (req: Request, res: Response): Promise<void> => {
      // Set CORS headers
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');

      try {
        const { method, params, id }: JSONRPCRequest = req.body;

        if (!method) {
          res.json({
            jsonrpc: '2.0',
            id: id || null,
            error: { code: -32600, message: 'Invalid Request' }
          } as JSONRPCResponse);
          return;
        }

        // Convert JSON-RPC method format to tRPC procedure path
        // e.g., "ai.executeAIRequest" or "executeAIRequest" -> ["ai", "executeAIRequest"]
        const procedurePath = method.includes('.') ? method.split('.') : ['ai', method];
        
        // Handle legacy method names by mapping them to new ones
        const legacyMethodMapping: Record<string, string[]> = {
          'health': ['ai', 'health'],
          'generateText': ['ai', 'generateText'],
          'listAllowedModels': ['ai', 'listAllowedModels'],
          'listProviders': ['ai', 'listProviders'],
          'storeUserKey': ['ai', 'storeUserKey'],
          'getUserKey': ['ai', 'getUserKey'],
          'getUserProviders': ['ai', 'getUserProviders'],
          'validateUserKey': ['ai', 'validateUserKey'],
          'rotateUserKey': ['ai', 'rotateUserKey'],
          'deleteUserKey': ['ai', 'deleteUserKey'],
        };

        const actualPath = legacyMethodMapping[method] || procedurePath;

        // Create tRPC context using the enhanced context creation function if provided
        const ctx = this.contextCreator 
          ? this.contextCreator({ req, res, info: {} as any })
          : createTRPCContext({ req, res, info: {} as any });

        try {
          // Use tRPC's createCaller API for clean procedure calling
          const caller = this.router.createCaller(ctx);
          
          // Navigate to the procedure using dot notation
          const [routerName, procedureName] = actualPath;
          
          let result;
          if (routerName === 'ai' && caller.ai) {
            const aiCaller = caller.ai as any;
            if (aiCaller[procedureName]) {
              result = await aiCaller[procedureName](params);
            } else {
              res.json({
                jsonrpc: '2.0',
                id,
                error: { code: -32601, message: `AI procedure not found: ${procedureName}` }
              } as JSONRPCResponse);
              return;
            }
          } else if (routerName === 'mcp' && caller.mcp) {
            const mcpCaller = caller.mcp as any;
            if (mcpCaller[procedureName]) {
              result = await mcpCaller[procedureName](params);
            } else {
              res.json({
                jsonrpc: '2.0',
                id,
                error: { code: -32601, message: `MCP procedure not found: ${procedureName}` }
              } as JSONRPCResponse);
              return;
            }
          } else {
            res.json({
              jsonrpc: '2.0',
              id,
              error: { code: -32601, message: `Router not found: ${routerName}` }
            } as JSONRPCResponse);
            return;
          }

          // Return successful JSON-RPC response
          res.json({
            jsonrpc: '2.0',
            id,
            result
          } as JSONRPCResponse);

        } catch (error) {
          // Handle tRPC errors
          if (error && typeof error === 'object' && 'code' in error) {
            const trpcError = error as TRPCError;
            const jsonRpcError = mapTRPCErrorToJSONRPC(trpcError);
            
            res.json({
              jsonrpc: '2.0',
              id,
              error: jsonRpcError
            } as JSONRPCResponse);
            return;
          }

          // Handle generic errors
          console.error('JSON-RPC Bridge Error:', error);
          res.json({
            jsonrpc: '2.0',
            id,
            error: {
              code: -32603,
              message: 'Internal error',
              data: error instanceof Error ? error.message : 'Unknown error'
            }
          } as JSONRPCResponse);
        }

      } catch (parseError) {
        // Handle JSON parsing errors
        res.json({
          jsonrpc: '2.0',
          id: null,
          error: { code: -32700, message: 'Parse error' }
        } as JSONRPCResponse);
      }
    };
  }

  /**
   * Generate OpenRPC schema from tRPC router
   * This introspects the tRPC router to generate documentation
   */
  generateOpenRPCSchema(serverUrl: string) {
    // For now, return a basic schema
    // TODO: Implement full schema generation by introspecting tRPC router
    return {
      openrpc: "1.2.6",
      info: {
        title: "Simple RPC AI Backend",
        description: "Auto-generated from tRPC router",
        version: "0.1.0"
      },
      servers: [{
        name: "AI Server",
        url: serverUrl,
        description: "JSON-RPC endpoint generated from tRPC"
      }],
      methods: [
        {
          name: "ai.health",
          description: "Check server health (auto-generated from tRPC)",
          params: [],
          result: {
            name: "healthResult",
            schema: { type: "object" }
          }
        },
        {
          name: "ai.generateText", 
          description: "Generate text using AI (auto-generated from tRPC)",
          params: [
            { name: "content", required: true, schema: { type: "string" } },
            { name: "promptId", required: true, schema: { type: "string" } },
            { name: "options", required: false, schema: { type: "object" } }
          ],
          result: {
            name: "aiResult",
            schema: { type: "object" }
          }
        },
        {
          name: "ai.listAllowedModels", 
          description: "List allowed AI models with optional provider filtering (auto-generated from tRPC)",
          params: [
            { name: "provider", required: false, schema: { type: "string" } }
          ],
          result: {
            name: "modelsResult",
            schema: { type: "array", items: { type: "object" } }
          }
        },
        // Add more methods as needed - these should be auto-generated from tRPC schema
      ]
    };
  }
}

/**
 * Factory function to create the bridge
 */
export function createTRPCToJSONRPCBridge(
  router: AppRouter, 
  contextCreator?: (opts: CreateExpressContextOptions) => any
): TRPCToJSONRPCBridge {
  return new TRPCToJSONRPCBridge(router, contextCreator);
}