"use strict";
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
 * const client = new RPCClient('http://localhost:8000');
 * const result = await client.request('methodName', { param1: 'value' });
 * ```
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.AIClient = exports.RPCClient = void 0;
const json_rpc_2_0_1 = require("json-rpc-2.0");
/**
 * Platform-agnostic JSON-RPC client for backend servers
 *
 * Works in Node.js, browsers, CLI applications, and any JavaScript environment.
 * Provides reliable communication using the robust json-rpc-2.0 library.
 */
class RPCClient {
    constructor(baseUrl = 'http://localhost:8000', options = {}) {
        this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
        this.rpcEndpoint = `${this.baseUrl}/rpc`;
        this.timeout = options.timeout || 60000; // 60 second default
        // Create JSON-RPC client with HTTP transport
        this.client = new json_rpc_2_0_1.JSONRPCClient(async (jsonRPCRequest) => {
            const axios = (await Promise.resolve().then(() => __importStar(require('axios')))).default;
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
exports.RPCClient = RPCClient;
// Default export for convenience
exports.default = RPCClient;
class AIClient extends RPCClient {
    constructor(options, deviceInfo) {
        super(options.baseUrl, {
            timeout: options.timeout
        });
        this.session = null;
        this.userId = null;
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
exports.AIClient = AIClient;
//# sourceMappingURL=client.js.map