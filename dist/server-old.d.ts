import type { Express } from 'express';
import type { Server } from 'http';
import type { ServiceProvidersConfig } from './services/ai-service.js';
import { FunctionRegistry } from './services/function-registry.js';
import { PromptManager } from './services/prompt-manager.js';
export interface AIServerConfig {
    port?: number;
    database?: {
        type?: 'sqlite' | 'postgresql' | 'mysql';
        connectionString?: string;
        path?: string;
    };
    masterEncryptionKey?: string;
    vaultwarden?: {
        enabled?: boolean;
        serverUrl: string;
        serviceEmail: string;
        servicePassword: string;
        clientId?: string;
        clientSecret?: string;
    };
    oauth?: {
        github?: {
            clientId: string;
            clientSecret: string;
        };
        google?: {
            clientId: string;
            clientSecret: string;
        };
        microsoft?: {
            clientId: string;
            clientSecret: string;
        };
    };
    mode?: 'simple' | 'byok' | 'hybrid';
    serviceProviders?: ServiceProvidersConfig;
    fallbackStrategy?: 'priority' | 'round_robin' | 'fastest_first';
    requirePayment?: {
        enabled?: boolean;
        checkFunction?: (userId: string) => Promise<boolean>;
        freeTrialCredits?: number;
        errorMessage?: string;
    };
    cors?: {
        origin?: string | string[];
        credentials?: boolean;
    };
    rateLimit?: {
        windowMs?: number;
        max?: number;
    };
    oauthAuth?: {
        allowedProviders: ('github' | 'google' | 'microsoft')[];
        allowedUsers?: string[];
        allowedOrgs?: string[];
        requireVerifiedEmail?: boolean;
        sessionExpirationMs?: number;
    };
    requireAuth?: boolean;
    systemPrompts?: {
        [promptId: string]: string | {
            content?: string;
            file?: string;
            db?: {
                table?: string;
                id?: string | number;
                query?: string;
            };
            name?: string;
            description?: string;
            variables?: string[];
            category?: string;
            version?: string;
        };
    };
}
export interface RPCRequest {
    jsonrpc: '2.0';
    id: number;
    method: string;
    params?: any;
}
export interface RPCResponse {
    jsonrpc?: '2.0';
    id: number;
    result?: any;
    error?: {
        code: number;
        message: string;
        data?: any;
    };
}
export declare function createAIServer(config: AIServerConfig): {
    app: Express;
    functionRegistry: FunctionRegistry;
    promptManager: PromptManager;
    start: (port?: number) => Server;
    stop: () => void;
};
export interface AIServerAsyncConfig extends Omit<AIServerConfig, 'systemPrompts'> {
    systemPrompts?: {
        [promptId: string]: string | {
            content?: string;
            file?: string;
            db?: {
                table?: string;
                id?: string | number;
                query?: string;
            };
            name?: string;
            description?: string;
            variables?: string[];
            category?: string;
            version?: string;
        };
    };
}
export declare function createAIServerAsync(config: AIServerAsyncConfig): Promise<{
    app: Express;
    functionRegistry: FunctionRegistry;
    promptManager: PromptManager;
    start: (port?: number) => Server;
    stop: () => void;
}>;
//# sourceMappingURL=server-old.d.ts.map