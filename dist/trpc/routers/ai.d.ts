/**
 * AI Router - tRPC implementation
 *
 * Type-safe AI procedures using tRPC with Zod validation.
 * Integrates with our existing AI service.
 */
import { createTRPCRouter } from '../index.js';
import { PostgreSQLAdapter } from '../../database/postgres-adapter.js';
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
export declare function createAIRouter(config?: AIRouterConfig, tokenTrackingEnabled?: boolean, dbAdapter?: PostgreSQLAdapter): ReturnType<typeof createTRPCRouter>;
export declare const aiRouter: ReturnType<typeof createAIRouter>;
//# sourceMappingURL=ai.d.ts.map