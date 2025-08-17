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
import { JSONRPCClient } from 'json-rpc-2.0';
import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';
/**
 * Platform-agnostic JSON-RPC client for backend servers
 *
 * Works in Node.js, browsers, CLI applications, and any JavaScript environment.
 * Provides reliable communication using the robust json-rpc-2.0 library.
 */
export class RPCClient {
    client;
    baseUrl;
    rpcEndpoint;
    timeout;
    constructor(baseUrl = 'http://localhost:8000', options = {}) {
        this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
        this.rpcEndpoint = `${this.baseUrl}/rpc`;
        this.timeout = options.timeout || 60000; // 60 second default
        // Create JSON-RPC client with HTTP transport
        this.client = new JSONRPCClient(async (jsonRPCRequest) => {
            const axios = (await import('axios')).default;
            const response = await axios.post(this.rpcEndpoint, jsonRPCRequest, {
                timeout: this.timeout,
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            if (response.data) {
                this.client.receive(response.data);
            }
        });
    }
    /**
     * Make a JSON-RPC request
     */
    async request(method, params) {
        try {
            return await this.client.request(method, params);
        }
        catch (error) {
            // Enhanced error messages for common network issues
            if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
                throw new Error(`Cannot connect to backend server at ${this.baseUrl}. Please ensure the server is running.`);
            }
            else if (error.code === 'ETIMEDOUT') {
                throw new Error(`Request timeout after ${this.timeout}ms. Server may be overloaded.`);
            }
            throw error;
        }
    }
    /**
     * Send a JSON-RPC notification (no response expected)
     */
    async notify(method, params) {
        await this.client.notify(method, params);
    }
    /**
     * Get current configuration
     */
    getConfig() {
        return {
            baseUrl: this.baseUrl,
            rpcEndpoint: this.rpcEndpoint,
            timeout: this.timeout
        };
    }
}
// Default export for convenience
export default RPCClient;
export class AIClient extends RPCClient {
    session = null;
    deviceInfo;
    userId = null;
    constructor(options, deviceInfo) {
        super(options.baseUrl, {
            timeout: options.timeout
        });
        this.deviceInfo = deviceInfo;
    }
    /**
     * Initialize client session (anonymous or existing)
     */
    async initialize() {
        try {
            // Generate stable device ID
            const deviceId = this.generateDeviceId();
            // Initialize session with backend
            const result = await this.request('initializeSession', {
                deviceId,
                deviceName: this.deviceInfo.hostname
            });
            this.session = result;
            this.userId = result.userId;
        }
        catch (error) {
            throw new Error(`Failed to initialize AI client: ${error.message}`);
        }
    }
    /**
     * Get current session
     */
    getSession() {
        return this.session;
    }
    /**
     * Get configured AI providers for user
     */
    async getConfiguredProviders() {
        if (!this.userId) {
            return [];
        }
        return this.request('getUserProviders', { userId: this.userId });
    }
    /**
     * Store API key for provider
     */
    async storeApiKey(provider, apiKey) {
        if (!this.userId) {
            throw new Error('User not initialized');
        }
        await this.request('storeUserKey', {
            userId: this.userId,
            provider,
            apiKey
        });
    }
    /**
     * Execute AI request with user's keys or service keys
     */
    async executeAIRequest(content, systemPrompt, metadata) {
        return this.request('executeAIRequest', {
            userId: this.userId,
            content,
            systemPrompt,
            metadata
        });
    }
    /**
     * Upgrade to OAuth authentication
     */
    async upgradeToOAuth(provider) {
        if (!this.session) {
            throw new Error('Session not initialized');
        }
        await this.request('upgradeToOAuth', {
            deviceId: this.session.deviceId,
            provider
        });
    }
    /**
     * Get authentication status
     */
    async getAuthStatus() {
        if (!this.session) {
            throw new Error('Session not initialized');
        }
        return this.request('getAuthStatus', {
            deviceId: this.session.deviceId
        });
    }
    /**
     * Check if upgrade prompt should be shown
     */
    async checkUpgradePrompt(triggerReason) {
        if (!this.session) {
            return false;
        }
        return this.request('shouldSuggestUpgrade', {
            deviceId: this.session.deviceId,
            triggerReason
        });
    }
    /**
     * Generate stable device ID from machine info
     */
    generateDeviceId() {
        const data = `${this.deviceInfo.machineId}-${this.deviceInfo.hostname}-${this.deviceInfo.platform}`;
        // Simple hash function for demo - use crypto in production
        let hash = 0;
        for (let i = 0; i < data.length; i++) {
            const char = data.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return `device-${Math.abs(hash).toString(36)}`;
    }
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
export function createTypedAIClient(config) {
    return createTRPCProxyClient(config);
}
/**
 * Helper for creating a ready-to-use AI service client with authentication
 */
export const createAIServiceClient = (serverUrl, authToken) => {
    const headers = {
        'Content-Type': 'application/json',
    };
    if (authToken) {
        headers.authorization = `Bearer ${authToken}`;
    }
    return createTypedAIClient({
        links: [
            httpBatchLink({
                url: `${serverUrl}/trpc`,
                headers
            })
        ]
    });
};
//# sourceMappingURL=client.js.map