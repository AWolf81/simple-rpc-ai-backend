import type { Express } from 'express';
import type { Server } from 'http';
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
    serviceProviders?: any;
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
export declare function createAIServer(config: AIServerConfig): {
    app: Express;
    functionRegistry: any;
    promptManager: any;
    start: (port?: number) => Server;
    stop: () => void;
};
export declare function createAIServerAsync(config: AIServerAsyncConfig): Promise<{
    app: Express;
    functionRegistry: any;
    promptManager: any;
    start: (port?: number) => Server;
    stop: () => void;
}>;
//# sourceMappingURL=server.d.ts.map