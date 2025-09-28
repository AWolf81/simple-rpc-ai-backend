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
      try {
        const { method, params, id }: JSONRPCRequest = req.body;

        // Create tRPC context
        const ctx = this.contextCreator 
          ? await this.contextCreator({ req, res, info: {} as any })
          : await createTRPCContext({ req, res, info: {} as any });

        try {
          // Parse nested method path (e.g., "ai.health" -> caller.ai.health)
          const caller = this.router.createCaller(ctx);
          const methodParts = method.split('.');

          // Navigate to the nested procedure
          let procedure: any = caller;
          for (const part of methodParts) {
            if (procedure && typeof procedure === 'object' && part in procedure) {
              procedure = procedure[part];
            } else {
              throw new Error(`No such procedure: ${method}`);
            }
          }

          // Call the procedure
          if (typeof procedure !== 'function') {
            throw new Error(`No such procedure: ${method}`);
          }

          const result = await procedure(params);
          
          res.json({
            jsonrpc: '2.0',
            id,
            result
          } as JSONRPCResponse);
        } catch (error: any) {
          // If method not found, return proper JSON-RPC error
          if (error.message?.includes('No such procedure')) {
            res.json({
              jsonrpc: '2.0',
              id,
              error: { 
                code: -32601, 
                message: `Method not found: ${method}`
              }
            } as JSONRPCResponse);
            return;
          }

          // Map other tRPC errors to JSON-RPC errors
          console.error('Procedure error:', error);
          res.json({
            jsonrpc: '2.0',
            id,
            error: mapTRPCErrorToJSONRPC(error)
          } as JSONRPCResponse);
        }
      } catch (error: any) {
        res.json({
          jsonrpc: '2.0',
          id: (req.body as JSONRPCRequest)?.id,
          error: { 
            code: -32700, 
            message: 'Parse error', 
            data: error.message 
          }
        } as JSONRPCResponse);
      }
    };
  }

  /**
   * Resolve a procedure from a flattened path like ['mcp', 'greeting']
   * Uses a more robust approach to access deeply nested procedures
   */
  private resolveProcedureFromPath(caller: any, path: string[]): ((params: any) => Promise<any>) | ((params: any) => any) | null {
    try {
      // Try direct path resolution
      let current = caller;
      for (const segment of path) {
        if (current && typeof current === 'object' && current[segment]) {
          current = current[segment];
        } else {
          return null;
        }
      }

      return typeof current === 'function' ? current : null;
    } catch (error) {
      console.warn('Error resolving procedure from path:', path, error);
      return null;
    }
  }

  /**
   * Generate OpenRPC schema from tRPC router
   * This introspects the tRPC router to generate documentation
   */
  generateOpenRPCSchema(serverUrl: string) {
    const methods: any[] = [];

    // Introspect the tRPC router to extract all procedures dynamically
    try {
      // Access the router definition which contains all procedures
      const routerDef = this.router._def;

      if (routerDef && routerDef.procedures) {
        // Iterate through all procedures in the flattened structure
        for (const [procedurePath, procedure] of Object.entries(routerDef.procedures)) {
          const procedureDef = (procedure as any)._def;

          if (procedureDef) {
            // Extract method information
            const methodName = procedurePath; // e.g., "ai.generateText", "admin.status"
            const description = this.extractDescription(procedureDef) || `${procedurePath} (auto-generated from tRPC)`;

            // Convert tRPC input schema to OpenRPC params
            const params = this.extractParams(procedureDef.inputs?.[0]);

            // Convert tRPC output schema to OpenRPC result
            const result = this.extractResult(procedureDef.output, procedurePath);

            methods.push({
              name: methodName,
              description,
              params,
              result
            });
          }
        }
      }
    } catch (error) {
      console.warn('Failed to introspect tRPC router for OpenRPC generation:', error);

      // Fallback to basic methods if introspection fails
      methods.push(
        {
          name: "ai.health",
          description: "Check server health",
          params: [],
          result: { name: "healthResult", schema: { type: "object" } }
        },
        {
          name: "ai.generateText",
          description: "Generate text using AI",
          params: [
            { name: "content", required: true, schema: { type: "string" } },
            { name: "systemPrompt", required: true, schema: { type: "string" } },
            { name: "provider", required: false, schema: { type: "string" } },
            { name: "apiKey", required: false, schema: { type: "string" } },
            { name: "options", required: false, schema: { type: "object" } }
          ],
          result: { name: "aiResult", schema: { type: "object" } }
        }
      );
    }

    return {
      openrpc: "1.2.6",
      info: {
        title: "Simple RPC AI Backend",
        description: "Dynamically generated from tRPC router - includes all routers and custom routers",
        version: "0.1.0"
      },
      servers: [{
        name: "AI Server",
        url: serverUrl,
        description: "JSON-RPC endpoint generated from tRPC router with dynamic procedure discovery"
      }],
      methods: methods.sort((a, b) => a.name.localeCompare(b.name))
    };
  }

  /**
   * Extract description from tRPC procedure metadata
   */
  private extractDescription(procedureDef: any): string | null {
    // Check various places where description might be stored
    if (procedureDef.meta?.openapi?.description) {
      return procedureDef.meta.openapi.description;
    }
    if (procedureDef.meta?.openapi?.summary) {
      return procedureDef.meta.openapi.summary;
    }
    if (procedureDef.meta?.description) {
      return procedureDef.meta.description;
    }
    return null;
  }

  /**
   * Extract parameters from tRPC input schema
   */
  private extractParams(inputSchema: any): any[] {
    if (!inputSchema) {
      return [];
    }

    try {
      // Handle Zod object schema
      if (inputSchema._def?.typeName === 'ZodObject' && inputSchema._def?.shape) {
        const shape = typeof inputSchema._def.shape === 'function'
          ? inputSchema._def.shape()
          : inputSchema._def.shape;

        const params = [];
        for (const [key, fieldSchema] of Object.entries(shape)) {
          const param = {
            name: key,
            required: !this.isOptional(fieldSchema as any),
            schema: this.zodSchemaToOpenRPCSchema(fieldSchema as any)
          };
          params.push(param);
        }
        return params;
      }

      // Handle other schema types
      if (inputSchema._def?.typeName === 'ZodVoid') {
        return [];
      }

      // Fallback for unknown schema types
      return [{
        name: "params",
        required: false,
        schema: { type: "object" }
      }];
    } catch (error) {
      // Fallback if schema parsing fails
      return [{
        name: "params",
        required: false,
        schema: { type: "object" }
      }];
    }
  }

  /**
   * Extract result schema from tRPC output
   */
  private extractResult(outputSchema: any, procedurePath: string): any {
    const resultName = `${procedurePath.replace('.', '_')}_result`;

    if (!outputSchema) {
      return {
        name: resultName,
        schema: { type: "object" }
      };
    }

    return {
      name: resultName,
      schema: this.zodSchemaToOpenRPCSchema(outputSchema)
    };
  }

  /**
   * Check if a Zod schema is optional
   */
  private isOptional(schema: any): boolean {
    return schema._def?.typeName === 'ZodOptional' ||
           (schema._def?.typeName === 'ZodDefault');
  }

  /**
   * Convert Zod schema to OpenRPC schema format
   */
  private zodSchemaToOpenRPCSchema(zodSchema: any): any {
    if (!zodSchema || !zodSchema._def) {
      return { type: "object" };
    }

    const def = zodSchema._def;

    switch (def.typeName) {
      case 'ZodString':
        return { type: "string" };
      case 'ZodNumber':
        return { type: "number" };
      case 'ZodBoolean':
        return { type: "boolean" };
      case 'ZodArray':
        return {
          type: "array",
          items: def.type ? this.zodSchemaToOpenRPCSchema(def.type) : { type: "object" }
        };
      case 'ZodObject':
        const properties: any = {};
        if (def.shape) {
          const shape = typeof def.shape === 'function' ? def.shape() : def.shape;
          for (const [key, fieldSchema] of Object.entries(shape)) {
            properties[key] = this.zodSchemaToOpenRPCSchema(fieldSchema as any);
          }
        }
        return { type: "object", properties };
      case 'ZodEnum':
        return { type: "string", enum: def.values };
      case 'ZodLiteral':
        return { type: typeof def.value, const: def.value };
      case 'ZodUnion':
        return { oneOf: def.options?.map((opt: any) => this.zodSchemaToOpenRPCSchema(opt)) || [] };
      case 'ZodOptional':
      case 'ZodDefault':
        return def.innerType ? this.zodSchemaToOpenRPCSchema(def.innerType) : { type: "object" };
      case 'ZodNullable':
        const innerSchema = def.innerType ? this.zodSchemaToOpenRPCSchema(def.innerType) : { type: "object" };
        return { ...innerSchema, nullable: true };
      case 'ZodVoid':
        return { type: "null" };
      default:
        return { type: "object" };
    }
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