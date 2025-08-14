/**
 * AI Router - tRPC implementation
 * 
 * Type-safe AI procedures using tRPC with Zod validation.
 * Integrates with our existing AI service.
 */

import { z } from 'zod';
import { createTRPCRouter, publicProcedure } from '../trpc.js';
import { AIService } from '../../services/ai-service.js';

// Initialize AI service (in production, this would be dependency injected)
const aiService = new AIService({
  serviceProviders: {
    anthropic: { priority: 1 },
    openai: { priority: 2 },
    google: { priority: 3 }
  }
});

// Input schemas
const executeAIRequestSchema = z.object({
  content: z.string().min(1).max(100000),
  systemPrompt: z.string().min(1),
  metadata: z.object({
    name: z.string().optional(),
    type: z.string().optional(),
  }).optional(),
  options: z.object({
    model: z.string().optional(),
    maxTokens: z.number().int().min(1).max(8192).optional(),
    temperature: z.number().min(0).max(1).optional(),
  }).optional(),
});

const healthSchema = z.object({}).optional();

export const aiRouter: any = createTRPCRouter({
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
    .mutation(async ({ input }: any) => {
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
    .mutation(async ({ input }: any) => {
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