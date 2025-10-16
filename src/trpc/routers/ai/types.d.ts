/**
 * Shared types and configurations for AI router
 */
import { PostgreSQLAdapter } from '@database/postgres-adapter';
import { PostgreSQLRPCMethods } from '@auth/PostgreSQLRPCMethods';
export interface AIRouterConfig {
    content?: {
        maxLength?: number;
        minLength?: number;
    };
    tokens?: {
        defaultMaxTokens?: number;
        maxTokenLimit?: number;
        minTokens?: number;
    };
    systemPrompt?: {
        maxLength?: number;
        minLength?: number;
    };
}
export declare const AI_LIMIT_PRESETS: {
    readonly conservative: AIRouterConfig;
    readonly standard: AIRouterConfig;
    readonly generous: AIRouterConfig;
    readonly maximum: AIRouterConfig;
};
export declare const DEFAULT_CONFIG: Required<AIRouterConfig>;
export declare function createMCPServiceProvidersConfig(mcpProviders: Record<string, {
    apiKey?: string;
    enabled?: boolean;
    priority?: number;
    models?: string[];
}>): Record<string, {
    priority: number;
    apiKey?: string;
}>;
export declare function createServiceProvidersConfig(providers: string[]): Record<string, {
    priority: number;
    apiKey?: string;
}>;
export interface AIRouterFactoryConfig {
    config?: AIRouterConfig;
    tokenTrackingEnabled?: boolean;
    dbAdapter?: PostgreSQLAdapter;
    serverProviders?: string[];
    byokProviders?: string[];
    postgresRPCMethods?: PostgreSQLRPCMethods;
    modelRestrictions?: Record<string, {
        allowedModels?: string[];
        allowedPatterns?: string[];
        blockedModels?: string[];
    }>;
}
//# sourceMappingURL=types.d.ts.map