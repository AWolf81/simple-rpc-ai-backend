/**
 * AI Router - tRPC implementation
 * 
 * Type-safe AI procedures using tRPC with Zod validation.
 * Integrates with our existing AI service.
 */

import { z } from 'zod';
import { createTRPCRouter, publicProcedure } from '../index.js';
import { AIService } from '../../services/ai-service.js';

// Configurable limits interface
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

// Default configuration with reasonable limits
const DEFAULT_CONFIG: Required<AIRouterConfig> = {
  content: {
    maxLength: 1_000_000, // 1MB of text (~200k words)
    minLength: 1,
  },
  tokens: {
    defaultMaxTokens: 4096, // Good default for most use cases
    maxTokenLimit: 200_000, // Support for long context models
    minTokens: 1,
  },
  systemPrompt: {
    maxLength: 50_000, // Reasonable system prompt size
    minLength: 1,
  },
};

// Create configurable AI router
export function createAIRouter(config: AIRouterConfig = {}): ReturnType<typeof createTRPCRouter> {
  const mergedConfig = {
    content: { ...DEFAULT_CONFIG.content, ...config.content },
    tokens: { ...DEFAULT_CONFIG.tokens, ...config.tokens },
    systemPrompt: { ...DEFAULT_CONFIG.systemPrompt, ...config.systemPrompt },
  };

  // Initialize AI service (in production, this would be dependency injected)
  const aiService = new AIService({
    serviceProviders: {
      anthropic: { priority: 1 },
      openai: { priority: 2 },
      google: { priority: 3 }
    }
  });

  // Create dynamic schemas based on configuration  
  const executeAIRequestSchema = z.object({
    content: z.string()
      .min(mergedConfig.content.minLength!)
      .max(mergedConfig.content.maxLength!),
    systemPrompt: z.string()
      .min(mergedConfig.systemPrompt.minLength!)
      .max(mergedConfig.systemPrompt.maxLength!),
    metadata: z.object({
      name: z.string().optional(),
      type: z.string().optional(),
    }).optional(),
    options: z.object({
      model: z.string().optional(),
      maxTokens: z.number().int()
        .min(mergedConfig.tokens.minTokens!)
        .max(mergedConfig.tokens.maxTokenLimit!)
        .default(mergedConfig.tokens.defaultMaxTokens!)
        .optional(),
      temperature: z.number().min(0).max(1).optional(),
    }).optional(),
  });

  const healthSchema = z.object({}).optional();

  return createTRPCRouter({
  /**
   * Health check procedure
   */
  health: publicProcedure
    .input(healthSchema)
    .query(async () => {
      return {
        status: 'healthy' as const,
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: '0.1.0',
      };
    }),

  /**
   * Execute AI request with system prompt protection
   */
  executeAIRequest: publicProcedure
    .input(executeAIRequestSchema)
    .mutation(async ({ input }) => {
      try {
        const result = await aiService.execute({
          content: input.content,
          systemPrompt: input.systemPrompt,
          metadata: input.metadata,
          options: input.options,
        });

        return {
          success: true,
          data: result,
        };
      } catch (error) {
        throw new Error(`AI service error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }),

  /**
   * List available AI providers
   */
  listProviders: publicProcedure
    .query(async () => {
      return {
        providers: [
          {
            name: 'anthropic',
            models: ['claude-3-5-sonnet-20241022', 'claude-3-haiku-20240307'],
            priority: 1,
          },
          {
            name: 'openai', 
            models: ['gpt-4o', 'gpt-4o-mini', 'gpt-3.5-turbo'],
            priority: 2,
          },
          {
            name: 'google',
            models: ['gemini-1.5-pro', 'gemini-1.5-flash'],
            priority: 3,
          },
        ],
      };
    }),

  /**
   * Validate AI provider configuration
   */
  validateProvider: publicProcedure
    .input(z.object({
      provider: z.enum(['anthropic', 'openai', 'google']),
      apiKey: z.string().min(1),
    }))
    .mutation(async ({ input }) => {
      // Note: In production, never log API keys
      try {
        // Simple validation - in production, make a test API call
        const isValid = input.apiKey.length > 10; // Basic check
        
        return {
          isValid,
          provider: input.provider,
          message: isValid ? 'API key format appears valid' : 'API key format invalid',
        };
      } catch (error) {
        return {
          isValid: false,
          provider: input.provider,
          message: `Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
      }
    }),
  });
}

// Default AI router instance with default configuration
export const aiRouter = createAIRouter();