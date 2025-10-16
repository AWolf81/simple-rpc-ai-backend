/**
 * Main tRPC App Router
 *
 * Combines all sub-routers into the main application router.
 * This is the single source of truth for all tRPC procedures.
 */
import { router } from '@src-trpc/index';
import type { AIRouterFactoryConfig } from '@src-trpc/routers/ai/types';
import { MCPRouterConfig } from '@src-trpc/routers/mcp/index';
import type { AgentConfig } from '@services/agents/types';
import type { inferRouterInputs, inferRouterOutputs } from '@trpc/server';
import type { PostgreSQLAdapter } from '@database/postgres-adapter';
import type { PostgreSQLRPCMethods } from '@auth/PostgreSQLRPCMethods';
/**
 * Create app router with configurable AI limits and optional token tracking
 * NESTED VERSION with proper namespaces for better organization
 */
export declare function createAppRouter(aiConfig?: AIRouterFactoryConfig, tokenTrackingEnabled?: boolean, dbAdapter?: PostgreSQLAdapter, serverProviders?: string[], byokProviders?: string[], postgresRPCMethods?: PostgreSQLRPCMethods, mcpConfig?: MCPRouterConfig, modelRestrictions?: Record<string, {
    allowedModels?: string[];
    allowedPatterns?: string[];
    blockedModels?: string[];
}>, serverWorkspaces?: {
    enabled?: boolean;
    defaultWorkspace?: {
        path?: string;
        readOnly?: boolean;
        allowedExtensions?: string[];
        blockedExtensions?: string[];
        maxFileSize?: number;
        allowedPaths?: string[];
        blockedPaths?: string[];
        followSymlinks?: boolean;
        enableWatching?: boolean;
        watchIgnore?: string[];
    };
    additionalWorkspaces?: Record<string, {
        path: string;
        name?: string;
        description?: string;
        readOnly?: boolean;
        allowedExtensions?: string[];
        blockedExtensions?: string[];
        maxFileSize?: number;
        allowedPaths?: string[];
        blockedPaths?: string[];
        followSymlinks?: boolean;
        enableWatching?: boolean;
        watchIgnore?: string[];
    }>;
}, customRouters?: {
    [namespace: string]: any;
}, agentConfig?: {
    enabled?: boolean;
    defaultSDK?: 'claude-code' | 'openai';
    enableClaudeCode?: boolean;
    enableOpenAI?: boolean;
    claudeCode?: AgentConfig['claudeCode'];
    openai?: AgentConfig['openai'];
}): ReturnType<typeof router>;
/**
 * Default app router with default configuration
 */
export declare const appRouter: ReturnType<typeof createAppRouter>;
/**
 * Generate tRPC methods documentation
 * The actual generation is handled by tools/generate-trpc-methods.js
 */
export declare function generateTRPCMethods(): void;
/**
 * Export the app router type definition
 * This is used by the client for end-to-end type safety
 *
 * Using the runtime type but with explicit static typing for better inference
 */
export type AppRouter = ReturnType<typeof createAppRouter>;
/**
 * Export input/output types for each router procedure
 * Using the runtime router for input/output inference since the static type doesn't work here
 */
export type RouterInputs = inferRouterInputs<typeof appRouter>;
export type RouterOutputs = inferRouterOutputs<typeof appRouter>;
//# sourceMappingURL=root.d.ts.map