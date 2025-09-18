/**
 * Hybrid Model Registry
 *
 * Combines @anolilab/ai-model-registry metadata with production-safe versioned model IDs.
 * Provides DX-friendly interface with production guarantees.
 */
import { getModelsByProvider } from '@anolilab/ai-model-registry';
import productionModelsData from '../data/production-models.json' with { type: 'json' };
const productionModels = productionModelsData;
export class HybridModelRegistry {
    config;
    cache = new Map();
    cacheExpiry = 5 * 60 * 1000; // 5 minutes
    lastCacheTime = 0;
    constructor(config = {}) {
        this.config = config;
        this.config = {
            enablePricingOverrides: true,
            productionMode: process.env.NODE_ENV === 'production',
            fallbackToAliases: false,
            allowDeprecatedModels: false,
            warnOnDeprecated: true,
            ...config
        };
    }
    /**
     * Get list of providers that support production model mapping
     */
    getSupportedProviders() {
        return Object.keys(productionModels.providers);
    }
    /**
     * Check if a provider supports production model mapping
     */
    supportsProductionMapping(provider) {
        return this.getSupportedProviders().includes(provider);
    }
    /**
     * Get models for a provider with hybrid data
     */
    async getModelsByProvider(provider) {
        const cacheKey = provider.toLowerCase();
        // Check cache
        if (this.cache.has(cacheKey) && this.isCacheValid()) {
            return this.cache.get(cacheKey);
        }
        // Get registry data
        const registryModels = getModelsByProvider(this.capitalizeProvider(provider));
        const productionMapping = productionModels.providers[provider];
        if (!productionMapping) {
            throw new Error(`Provider "${provider}" not supported in hybrid registry. Supported providers: ${this.getSupportedProviders().join(', ')}`);
        }
        // Combine registry + production data
        const hybridModels = [];
        for (const registryModel of registryModels) {
            const modelId = registryModel.id;
            const productionModel = productionMapping.models[modelId];
            if (!productionModel) {
                // Registry model without production mapping
                if (this.config.fallbackToAliases) {
                    console.warn(`⚠️ Model "${modelId}" found in registry but missing production mapping`);
                    // Use registry alias as fallback
                    hybridModels.push(this.createHybridModel(registryModel, {
                        productionId: modelId,
                        releaseDate: registryModel.releaseDate || 'unknown',
                        status: 'stable',
                        verified: new Date().toISOString().split('T')[0],
                        pricingOverride: null
                    }, productionMapping));
                }
                // Silently skip when fallbackToAliases is false (default behavior)
                continue;
            }
            const hybridModel = this.createHybridModel(registryModel, productionModel, productionMapping);
            // Apply deprecation filtering
            if (this.shouldIncludeModel(hybridModel)) {
                hybridModels.push(hybridModel);
            }
        }
        // Cache results
        this.cache.set(cacheKey, hybridModels);
        this.lastCacheTime = Date.now();
        return hybridModels;
    }
    /**
     * Get the best production model for a provider
     */
    async getProductionModel(provider, mode = 'best') {
        const models = await this.getModelsByProvider(provider);
        if (models.length === 0) {
            throw new Error(`No models available for provider: ${provider}`);
        }
        // Selection logic based on mode
        switch (mode) {
            case 'best':
                // Highest capability (usually Opus/GPT-4o/Gemini Pro)
                return models.find(m => m.id.includes('opus') ||
                    m.id.includes('gpt-4o') ||
                    m.id.includes('gemini-2') ||
                    m.id.includes('pro')) || models[0];
            case 'fast':
                // Fastest/cheapest (usually Haiku/Mini/Flash)
                return models.find(m => m.id.includes('haiku') ||
                    m.id.includes('mini') ||
                    m.id.includes('flash')) || models[models.length - 1];
            case 'balanced':
                // Balanced (usually Sonnet/Turbo)
                return models.find(m => m.id.includes('sonnet') ||
                    m.id.includes('turbo')) || models[Math.floor(models.length / 2)];
            default:
                return models[0];
        }
    }
    /**
     * Get model by exact ID (supports both alias and production IDs)
     */
    async getModelById(provider, modelId) {
        const models = await this.getModelsByProvider(provider);
        // Try exact match on alias ID first
        let model = models.find(m => m.id === modelId);
        // Try exact match on production ID
        if (!model) {
            model = models.find(m => m.productionId === modelId);
        }
        return model || null;
    }
    /**
     * Validate production model mapping against registry
     */
    async validateProductionMapping() {
        const errors = [];
        const warnings = [];
        for (const [provider, mapping] of Object.entries(productionModels.providers)) {
            try {
                // Check if registry has data for this provider
                const registryModels = getModelsByProvider(this.capitalizeProvider(provider));
                const registryIds = registryModels.map(m => m.id);
                // Check missing mappings (only warn if fallbackToAliases is enabled)
                const missingInProduction = registryIds.filter(id => !mapping.models[id]);
                if (missingInProduction.length > 0 && this.config.fallbackToAliases) {
                    warnings.push(`${provider}: Missing production mappings for: ${missingInProduction.join(', ')}`);
                }
                // Check extra mappings
                const productionIds = Object.keys(mapping.models);
                const extraInProduction = productionIds.filter(id => !registryIds.includes(id));
                if (extraInProduction.length > 0) {
                    warnings.push(`${provider}: Extra production mappings for: ${extraInProduction.join(', ')}`);
                }
                // Validate pricing overrides
                for (const [modelId, productionModel] of Object.entries(mapping.models)) {
                    const registryModel = registryModels.find(m => m.id === modelId);
                    if (registryModel && productionModel.pricingOverride) {
                        // Could add pricing validation logic here
                        warnings.push(`${provider}/${modelId}: Has pricing override - verify accuracy`);
                    }
                }
            }
            catch (error) {
                errors.push(`${provider}: Failed to validate - ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }
        return {
            valid: errors.length === 0,
            errors,
            warnings
        };
    }
    /**
     * Check if a model should be included based on deprecation settings
     */
    shouldIncludeModel(model) {
        if (model.production.status !== 'deprecated') {
            return true;
        }
        // Handle deprecated models
        if (this.config.warnOnDeprecated) {
            console.warn(`⚠️ Deprecated model detected: ${model.id}`);
            if (model.production.recommendedReplacement) {
                console.warn(`   📋 Recommended replacement: ${model.production.recommendedReplacement}`);
            }
            if (model.production.deprecationReason) {
                console.warn(`   📝 Reason: ${model.production.deprecationReason}`);
            }
            if (model.production.deprecatedSince) {
                console.warn(`   📅 Deprecated since: ${model.production.deprecatedSince}`);
            }
        }
        if (!this.config.allowDeprecatedModels) {
            console.warn(`❌ Excluding deprecated model: ${model.id}`);
            return false;
        }
        return true;
    }
    createHybridModel(registryModel, productionModel, providerMapping) {
        return {
            // IDs
            id: registryModel.id,
            productionId: productionModel.productionId,
            name: registryModel.name || registryModel.id,
            provider: registryModel.provider,
            // Pricing (registry or override)
            cost: {
                input: productionModel.pricingOverride?.input ?? registryModel.cost?.input ?? 0,
                output: productionModel.pricingOverride?.output ?? registryModel.cost?.output ?? 0,
                inputCacheHit: productionModel.pricingOverride?.inputCacheHit ?? registryModel.cost?.inputCacheHit,
            },
            // Capabilities
            limit: {
                context: registryModel.limit?.context ?? 0,
                output: registryModel.limit?.output,
            },
            modalities: {
                input: registryModel.modalities?.input ?? ['text'],
                output: registryModel.modalities?.output ?? ['text'],
            },
            // Production metadata
            production: {
                releaseDate: productionModel.releaseDate,
                status: productionModel.status,
                verified: productionModel.verified,
                requiresVersioning: providerMapping.requiresVersioning,
                deprecatedSince: productionModel.deprecatedSince,
                recommendedReplacement: productionModel.recommendedReplacement,
                deprecationReason: productionModel.deprecationReason,
            },
            // Features
            features: {
                vision: registryModel.vision ?? false,
                streamingSupported: registryModel.streamingSupported ?? true,
                toolCall: registryModel.toolCall ?? false,
                reasoning: registryModel.reasoning ?? false,
                extendedThinking: registryModel.extendedThinking ?? false,
            }
        };
    }
    capitalizeProvider(provider) {
        const providerMap = {
            'anthropic': 'Anthropic',
            'openai': 'OpenAI',
            'google': 'Google',
            'openrouter': 'OpenRouter'
        };
        return providerMap[provider] || provider.charAt(0).toUpperCase() + provider.slice(1);
    }
    isCacheValid() {
        return (Date.now() - this.lastCacheTime) < this.cacheExpiry;
    }
    /**
     * Clear cache (useful for testing)
     */
    clearCache() {
        this.cache.clear();
        this.lastCacheTime = 0;
    }
    /**
     * Get production model ID for API calls
     */
    getProductionModelId(aliasId, provider) {
        const mapping = productionModels.providers[provider];
        if (!mapping)
            return aliasId;
        const model = mapping.models[aliasId];
        if (this.config.productionMode && mapping.requiresVersioning) {
            return model?.productionId || aliasId;
        }
        // In development, allow aliases
        return aliasId;
    }
}
// Export default instance
export const hybridRegistry = new HybridModelRegistry();
