/**
 * AI Router - Core AI functionality
 */

import { router } from '@src-trpc/index';
import { AIService } from '@services/ai/ai-service';
import { VirtualTokenService } from '@services/billing/virtual-token-service';
import { UsageAnalyticsService } from '@services/billing/usage-analytics-service';
import { PostgreSQLAdapter } from '@database/postgres-adapter'; // unused, why?
import { PostgreSQLRPCMethods } from '@auth/PostgreSQLRPCMethods'; // unused, why?
import { createGenerationProcedures } from './methods/generation';
import { createProviderProcedures } from './methods/providers';
import { AIRouterFactoryConfig, DEFAULT_CONFIG, createServiceProvidersConfig, AIRouterConfig } from './types'; // AIRouterConig is imported but not used, why?

export function createAIRouter(factoryConfig: AIRouterFactoryConfig = {}): ReturnType<typeof router> {
  const {
    config = {},
    tokenTrackingEnabled = false,
    dbAdapter,
    serverProviders = ['anthropic'],
    //byokProviders = ['anthropic'], // where is it used?
    //postgresRPCMethods, // where is it used?
    modelRestrictions
  } = factoryConfig;

  const mergedConfig = {
    content: { ...DEFAULT_CONFIG.content, ...config.content },
    tokens: { ...DEFAULT_CONFIG.tokens, ...config.tokens },
    systemPrompt: { ...DEFAULT_CONFIG.systemPrompt, ...config.systemPrompt },
  };

  // Initialize AI service with configured providers
  const aiService = new AIService({
    serviceProviders: createServiceProvidersConfig(serverProviders),
    modelRestrictions
  });

  // Initialize services if database is available
  let virtualTokenService: VirtualTokenService | null = null;
  let usageAnalyticsService: UsageAnalyticsService | null = null;
  let hybridUserService: any | null = null; // TODO: Import proper type

  if (dbAdapter) {
    usageAnalyticsService = new UsageAnalyticsService(dbAdapter);

    if (tokenTrackingEnabled) {
      virtualTokenService = new VirtualTokenService(dbAdapter);
    }
  }

  // Create procedure groups
  const generationProcedures = createGenerationProcedures(
    mergedConfig,
    aiService,
    virtualTokenService,
    usageAnalyticsService,
    hybridUserService
  );

  const providerProcedures = createProviderProcedures(
    aiService
  );

  return router({
    ...generationProcedures,
    ...providerProcedures,
  });
}

// Default AI router instance with default configuration
export const aiRouter: ReturnType<typeof createAIRouter> = createAIRouter();

/**
 * Static type definition for the AI router
 * This captures the shape of all AI procedures independently of runtime configuration
 * Used for proper TypeScript inference in client code
 */
export type AIRouterType = ReturnType<typeof createAIRouter>;

// Export types for compatibility
export type { AIRouterConfig, AIRouterFactoryConfig } from './types';