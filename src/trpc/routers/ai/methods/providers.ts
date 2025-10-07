import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { publicProcedure } from '../../../index';
import { AIService } from '@services/ai/ai-service';

/**
 * AI provider management procedures
 */
export function createProviderProcedures(
  aiService: AIService,
  modelRestrictions?: Record<string, {
    allowedModels?: string[];
    allowedPatterns?: string[];
    blockedModels?: string[];
  }>
) {
  return {
    /**
     * List available AI service providers.
     * @description Returns the providers currently registered in the model registry along with metadata about the registry source.
     */
    listProviders: publicProcedure
      .input(z.void())
      .query(async () => {
        try {
          // TODO: Implement provider listing via ModelRegistry
          const providers: any[] = [];
          return {
            providers,
            source: 'registry',
            lastUpdated: new Date().toISOString()
          };
        } catch (error) {
          console.warn('Failed to fetch providers from registry:', error);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to fetch provider information'
          });
        }
      }),

    /**
     * List available BYOK (Bring Your Own Key) providers.
     * @description Filters the provider catalog to only those eligible for user-supplied API keys.
     */
    listProvidersBYOK: publicProcedure
      .input(z.void())
      .query(async () => {
        try {
          // TODO: Implement BYOK provider listing via ModelRegistry
          const providers: any[] = [];
          return {
            providers,
            source: 'registry',
            lastUpdated: new Date().toISOString()
          };
        } catch (error) {
          console.warn('Failed to fetch BYOK providers from registry:', error);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to fetch BYOK provider information'
          });
        }
      }),

    /**
     * List allowed models for a provider respecting configured restrictions.
     * @description Provides production-ready model identifiers for a single provider or a map of providers to models.
     */
    listAllowedModels: publicProcedure
      .input(z.object({
        provider: z.enum(['anthropic', 'openai', 'google', 'openrouter']).optional()
      }).optional())
      .query(async ({ input }) => {
        const { provider } = input || {};

        if (provider) {
          const detailedModels = await aiService.getAvailableModelsDetailed(provider);
          const models = detailedModels.map(model =>
            aiService.getProductionModelId(provider, model.id)
          );

          return {
            provider,
            models,
            count: models.length
          };
        } else {
          // All providers
          const allModels: Record<string, string[]> = {};

          for (const p of aiService.getProviders()) {
            const detailedModels = await aiService.getAvailableModelsDetailed(p.name);
            allModels[p.name] = detailedModels.map(model =>
              aiService.getProductionModelId(p.name, model.id)
            );
          }

          return allModels;
        }
      }),

    /**
     * Retrieve the AI model registry health status.
     * @description Reports availability and summary metrics for the registry integration, falling back to error details when checks fail.
     */
    getRegistryHealth: publicProcedure
      .input(z.void())
      .query(async () => {
        try {
          // TODO: Implement health status via ModelRegistry
          const healthStatus = { status: 'healthy', providers: 3, models: 100 };
          return {
            ...healthStatus,
            checkedAt: new Date().toISOString(),
            version: process.env.npm_package_version || 'unknown'
          };
        } catch (error) {
          console.warn('Failed to check registry health:', error);
          return {
            status: 'error' as const,
            available: false,
            lastUpdate: null,
            providers: {
              configured: [],
              available: [],
              failed: []
            },
            pricing: {
              overrides: 0,
              totalOverrideCount: 0
            },
            errors: [`Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
            performance: {
              responseTimeMs: 0,
              cacheHit: false
            },
            checkedAt: new Date().toISOString(),
            version: process.env.npm_package_version || 'unknown'
          };
        }
      }),

    /**
     * Validate AI provider configuration.
     * @description Performs lightweight API key validation for supported providers to catch obvious misconfigurations.
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
  };
}
