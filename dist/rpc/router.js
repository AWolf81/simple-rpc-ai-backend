/**
 * Simplified RPC Router using tRPC
 *
 * This file now exports tRPC components directly, simplifying the codebase
 * by using the battle-tested tRPC library instead of custom implementations.
 */
import { z } from 'zod';
import { createTRPCRouter, publicProcedure } from '../trpc/index.js';
import { appRouter } from '../trpc/root.js';
// Re-export tRPC components for compatibility
export { createTRPCRouter, publicProcedure };
export { appRouter as mainRouter };
// Re-export Zod for validation (better than custom validators)
export const v = {
    object: z.object,
    string: z.string,
    number: z.number,
    optional: z.optional,
    array: z.array,
    boolean: z.boolean,
    enum: z.enum,
};
// For backward compatibility, create an alias
export const createRPCRouter = createTRPCRouter;
// Simple OpenRPC schema generator for tRPC routers
export function generateOpenRPCSchema(info) {
    return {
        openrpc: '1.2.6',
        info: {
            title: info.title,
            description: info.description || 'tRPC-powered API',
            version: info.version,
        },
        servers: [
            {
                name: 'Development Server',
                url: 'http://localhost:8000/trpc',
                description: 'tRPC HTTP endpoint'
            }
        ],
        methods: [
            {
                name: 'ai.health',
                description: 'Check AI service health',
                params: [],
                result: {
                    name: 'healthResult',
                    schema: {
                        type: 'object',
                        properties: {
                            status: { type: 'string' },
                            timestamp: { type: 'string' },
                            uptime: { type: 'number' }
                        }
                    }
                }
            },
            {
                name: 'ai.executeAIRequest',
                description: 'Execute AI request with system prompt protection',
                params: [
                    {
                        name: 'input',
                        required: true,
                        schema: {
                            type: 'object',
                            properties: {
                                content: { type: 'string' },
                                systemPrompt: { type: 'string' },
                                metadata: {
                                    type: 'object',
                                    properties: {
                                        name: { type: 'string' },
                                        type: { type: 'string' }
                                    }
                                },
                                options: {
                                    type: 'object',
                                    properties: {
                                        model: { type: 'string' },
                                        maxTokens: { type: 'number' },
                                        temperature: { type: 'number' }
                                    }
                                }
                            },
                            required: ['content', 'systemPrompt']
                        }
                    }
                ],
                result: {
                    name: 'aiResult',
                    schema: {
                        type: 'object',
                        properties: {
                            success: { type: 'boolean' },
                            data: { type: 'object' }
                        }
                    }
                }
            },
            {
                name: 'ai.listProviders',
                description: 'List available AI providers',
                params: [],
                result: {
                    name: 'providersResult',
                    schema: {
                        type: 'object',
                        properties: {
                            providers: {
                                type: 'array',
                                items: {
                                    type: 'object',
                                    properties: {
                                        name: { type: 'string' },
                                        models: { type: 'array', items: { type: 'string' } },
                                        priority: { type: 'number' }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        ]
    };
}
//# sourceMappingURL=router.js.map