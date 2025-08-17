/**
 * Platform-Agnostic RPC Client
 *
 * Provides clean, reliable JSON-RPC communication with backend servers.
 * Works in Node.js, browsers, CLI apps, and any JavaScript environment.
 *
 * Uses the json-rpc-2.0 library for robust JSON-RPC 2.0 protocol support.
 *
 * Usage:
 * ```typescript
 * import { RPCClient } from 'simple-rpc-ai-backend';
 *
 * const client = new RPCClient('http://localhost:8080');
 * const result = await client.request('methodName', { param1: 'value' });
 * ```
 */
import { createTRPCProxyClient } from '@trpc/client';
export interface ClientOptions {
    timeout?: number;
}
/**
 * Platform-agnostic JSON-RPC client for backend servers
 *
 * Works in Node.js, browsers, CLI applications, and any JavaScript environment.
 * Provides reliable communication using the robust json-rpc-2.0 library.
 */
export declare class RPCClient {
    private client;
    private baseUrl;
    private rpcEndpoint;
    private timeout;
    constructor(baseUrl?: string, options?: ClientOptions);
    /**
     * Make a JSON-RPC request
     */
    request(method: string, params?: any): Promise<any>;
    /**
     * Send a JSON-RPC notification (no response expected)
     */
    notify(method: string, params?: any): Promise<void>;
    /**
     * Get current configuration
     */
    getConfig(): {
        baseUrl: string;
        rpcEndpoint: string;
        timeout: number;
    };
}
export default RPCClient;
/**
 * Enhanced AI Client with BYOK and Authentication Support
 *
 * Extends the basic RPC client with:
 * - Progressive authentication (anonymous → OAuth → Pro)
 * - BYOK (Bring Your Own Key) support
 * - Multi-device sync capabilities
 * - VS Code authentication API integration
 */
import { AuthSession } from './auth/index.js';
export interface AIClientOptions {
    baseUrl: string;
    timeout?: number;
    retries?: number;
}
export interface DeviceInfo {
    machineId: string;
    hostname: string;
    platform: string;
    vsCodeVersion: string;
}
export interface AuthUpgradePrompt {
    triggerReason: 'multi_device' | 'premium_features' | 'security' | 'high_usage';
    message: string;
    benefits: string[];
    actions: {
        label: string;
        action: string;
    }[];
}
export declare class AIClient extends RPCClient {
    private session;
    private deviceInfo;
    private userId;
    constructor(options: AIClientOptions, deviceInfo: DeviceInfo);
    /**
     * Initialize client session (anonymous or existing)
     */
    initialize(): Promise<void>;
    /**
     * Get current session
     */
    getSession(): AuthSession | null;
    /**
     * Get configured AI providers for user
     */
    getConfiguredProviders(): Promise<string[]>;
    /**
     * Store API key for provider
     */
    storeApiKey(provider: string, apiKey: string): Promise<void>;
    /**
     * Execute AI request with user's keys or service keys
     */
    executeAIRequest(content: string, systemPrompt: string, metadata?: any): Promise<any>;
    /**
     * Upgrade to OAuth authentication
     */
    upgradeToOAuth(provider: 'github' | 'google' | 'microsoft'): Promise<void>;
    /**
     * Get authentication status
     */
    getAuthStatus(): Promise<any>;
    /**
     * Check if upgrade prompt should be shown
     */
    checkUpgradePrompt(triggerReason: string): Promise<boolean>;
    /**
     * Generate stable device ID from machine info
     */
    private generateDeviceId;
}
/**
 * tRPC Client Support
 *
 * Simple, type-safe tRPC client with automatic type inference
 */
/**
 * Create a typed tRPC client with automatic type inference
 * Provides easy access to AI router procedures with proper typing
 *
 * Usage:
 * ```typescript
 * const client = createTypedAIClient({
 *   links: [httpBatchLink({ url: 'http://localhost:8000/trpc' })]
 * });
 *
 * // Fully typed without any casts
 * const result = await client.ai.executeAIRequest.mutate({ content: "test", systemPrompt: "You are helpful" });
 * const health = await client.ai.health.query();
 * ```
 */
export declare function createTypedAIClient(config: Parameters<typeof createTRPCProxyClient>[0]): import("@trpc/client").TRPCClient<import("@trpc/server").TRPCBuiltRouter<{
    ctx: {
        req: import("express").Request;
        res: import("express").Response;
        user: import("./index.js").OpenSaaSJWTPayload | null;
    };
    meta: object;
    errorShape: import("@trpc/server").TRPCDefaultErrorShape;
    transformer: true;
}, import("@trpc/server").TRPCDecorateCreateRouterOptions<import("@trpc/server").TRPCCreateRouterOptions>>>;
/**
 * Type alias for the typed AI client
 */
export type TypedAIClient = ReturnType<typeof createTypedAIClient>;
/**
 * Helper for creating a ready-to-use AI service client with authentication
 */
export declare const createAIServiceClient: (serverUrl: string, authToken?: string) => import("@trpc/client").TRPCClient<import("@trpc/server").TRPCBuiltRouter<{
    ctx: {
        req: import("express").Request;
        res: import("express").Response;
        user: import("./index.js").OpenSaaSJWTPayload | null;
    };
    meta: object;
    errorShape: import("@trpc/server").TRPCDefaultErrorShape;
    transformer: true;
}, import("@trpc/server").TRPCDecorateCreateRouterOptions<import("@trpc/server").TRPCCreateRouterOptions>>>;
//# sourceMappingURL=client.d.ts.map