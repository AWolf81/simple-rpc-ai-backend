/**
 * tRPC to JSON-RPC Bridge
 *
 * Automatically generates JSON-RPC handlers from tRPC routers to eliminate code duplication.
 * This allows us to maintain a single source of truth in tRPC while supporting JSON-RPC protocol.
 */
import type { CreateExpressContextOptions } from '@trpc/server/adapters/express';
import type { Request, Response } from 'express';
import type { AppRouter } from './root';
/**
 * Bridge class that converts tRPC router to JSON-RPC handler
 */
export declare class TRPCToJSONRPCBridge {
    private router;
    private contextCreator?;
    private callerFactory;
    constructor(router: AppRouter, contextCreator?: ((opts: CreateExpressContextOptions) => any) | undefined);
    /**
     * Create Express middleware that handles JSON-RPC requests using tRPC procedures
     */
    createHandler(): (req: Request, res: Response) => Promise<void>;
    /**
     * Resolve a procedure from a flattened path like ['mcp', 'greeting']
     * Uses a more robust approach to access deeply nested procedures
     */
    private resolveProcedureFromPath;
    /**
     * Generate OpenRPC schema from tRPC router
     * This introspects the tRPC router to generate documentation
     */
    generateOpenRPCSchema(serverUrl: string): {
        openrpc: string;
        info: {
            title: string;
            description: string;
            version: string;
        };
        servers: {
            name: string;
            url: string;
            description: string;
        }[];
        methods: any[];
    };
    /**
     * Extract description from tRPC procedure metadata
     */
    private extractDescription;
    /**
     * Extract parameters from tRPC input schema
     */
    private extractParams;
    /**
     * Extract result schema from tRPC output
     */
    private extractResult;
    /**
     * Check if a Zod schema is optional
     */
    private isOptional;
    /**
     * Convert Zod schema to OpenRPC schema format
     */
    private zodSchemaToOpenRPCSchema;
}
/**
 * Factory function to create the bridge
 */
export declare function createTRPCToJSONRPCBridge(router: AppRouter, contextCreator?: (opts: CreateExpressContextOptions) => any): TRPCToJSONRPCBridge;
//# sourceMappingURL=trpc-to-jsonrpc-bridge.d.ts.map