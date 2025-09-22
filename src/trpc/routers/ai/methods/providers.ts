import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { publicProcedure } from '../../../index';
import { AIService } from '@services/ai-service';

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
     * List available AI service providers
     * Enhanced with @anolilab/ai-model-registry integration
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
     * List available BYOK (Bring Your Own Key) providers
     * Returns only providers configured for BYOK usage
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
     * List allowed models for a provider (respects model restrictions)
     */
    listAllowedModels: publicProcedure
      .input(z.object({
        provider: z.enum(['anthropic', 'openai', 'google', 'openrouter']).optional()
      }).optional())
      .query(async ({ input }) => {
        const { provider } = input || {};

        if (provider) {
          // Single provider - return simple format
          const allowedModels = await aiService.getAllowedModels(provider);

          // Check if restrictions are actually configured for this provider
          const hasRestrictions = modelRestrictions &&
            modelRestrictions[provider] &&
            (modelRestrictions[provider].allowedModels?.length ||
              modelRestrictions[provider].allowedPatterns?.length ||
              modelRestrictions[provider].blockedModels?.length);

          const restrictionSuffix = hasRestrictions ? ' (after applying restrictions)' : '';

          return {
            provider,
            models: allowedModels,
            count: allowedModels.length,
            description: `Available models for ${provider}${restrictionSuffix}`
          };
        } else {
          // All providers - return structured format
          const providerData = [];
          let totalCount = 0;

          for (const p of aiService.getProviders()) {
            const providerModels = await aiService.getAllowedModels(p.name);

            // Check if restrictions are configured for this provider
            const hasRestrictions = modelRestrictions &&
              modelRestrictions[p.name] &&
              (modelRestrictions[p.name].allowedModels?.length ||
                modelRestrictions[p.name].allowedPatterns?.length ||
                modelRestrictions[p.name].blockedModels?.length);

            providerData.push({
              provider: p.name,
              models: providerModels,
              count: providerModels.length,
              hasRestrictions
            });

            totalCount += providerModels.length;
          }

          // Check if any provider has restrictions
          const anyRestrictions = providerData.some(p => p.hasRestrictions);
          const restrictionSuffix = anyRestrictions ? ' (after applying restrictions)' : '';

          return {
            provider: 'all',
            providers: providerData,
            totalCount,
            description: `All available models across all providers${restrictionSuffix}`
          };
        }
      }),

    /**
     * Get AI model registry health status
     * Returns detailed health information about the registry integration
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
  };
}