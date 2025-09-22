/**
 * AI Router - Core AI functionality
 */
import { router } from '../../index.js';
import { AIService } from '../../../services/ai-service.js';
import { VirtualTokenService } from '../../../services/virtual-token-service.js';
import { UsageAnalyticsService } from '../../../services/usage-analytics-service.js';
import { createGenerationProcedures } from './methods/generation.js';
import { createProviderProcedures } from './methods/providers.js';
import { DEFAULT_CONFIG, createServiceProvidersConfig } from './types.js';
export function createAIRouter(factoryConfig = {}) {
    const { config = {}, tokenTrackingEnabled = false, dbAdapter, serverProviders = ['anthropic'], byokProviders = ['anthropic'], postgresRPCMethods, modelRestrictions } = factoryConfig;
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
    let virtualTokenService = null;
    let usageAnalyticsService = null;
    let hybridUserService = null; // TODO: Import proper type
    if (dbAdapter) {
        usageAnalyticsService = new UsageAnalyticsService(dbAdapter);
        if (tokenTrackingEnabled) {
            virtualTokenService = new VirtualTokenService(dbAdapter);
        }
    }
    // Create procedure groups
    const generationProcedures = createGenerationProcedures(mergedConfig, aiService, virtualTokenService, usageAnalyticsService, hybridUserService);
    const providerProcedures = createProviderProcedures(aiService, modelRestrictions);
    return router({
        ...generationProcedures,
        ...providerProcedures,
    });
}
// Default AI router instance with default configuration
export const aiRouter = createAIRouter();
