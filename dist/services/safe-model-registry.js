/**
 * Safe Model Registry Service
 *
 * Provides safe access to @anolilab/ai-model-registry with validation,
 * caching, and fallback mechanisms to prevent financial and operational risks.
 */
import { getModelSafetyConfig, ModelValidator } from '../config/model-safety.js';
import { ModelRegistryManager } from './model-registry.js';
export class SafeModelRegistry {
    cache = new Map();
    config;
    fallbackRegistry;
    lastRegistryCheck = 0;
    constructor(customConfig) {
        this.config = customConfig ? { ...getModelSafetyConfig(), ...customConfig } : getModelSafetyConfig();
        this.fallbackRegistry = new ModelRegistryManager(true);
        this.logConfiguration();
    }
    logConfiguration() {
        const env = process.env.NODE_ENV || 'development';
        const mode = this.config.useRegistry ? '📡 Live Registry' : '🔒 Cached Models';
        console.log(`
🤖 AI Model Registry Configuration:
   Mode: ${mode}
   Environment: ${env}
   Price Updates: ${this.config.allowPriceUpdates ? '✅ Enabled' : '🔒 Disabled'}
   Validation: ${this.config.validationMode}
   
${this.config.useRegistry ? `
   💡 Using live models from @anolilab/ai-model-registry
   ${env === 'development' ? '🔒 For production, set: MODEL_REGISTRY_MODE=production' : ''}
` : `
   🔒 Using cached/validated models for safety
   🔄 Run: pnpm models:check to update
`}
    `.trim());
    }
    async getDefaultModel(provider) {
        try {
            if (this.config.useRegistry) {
                return await this.getLiveDefaultModel(provider);
            }
            else {
                return await this.getCachedDefaultModel(provider);
            }
        }
        catch (error) {
            console.warn('Failed to get default model for ' + provider + ':', error instanceof Error ? error.message : String(error));
            return this.getFallbackDefaultModel(provider);
        }
    }
    async getModelsByProvider(provider) {
        try {
            if (this.config.useRegistry) {
                return await this.getLiveModels(provider);
            }
            else {
                return await this.getCachedModels(provider);
            }
        }
        catch (error) {
            console.warn('Failed to get models for ' + provider + ':', error instanceof Error ? error.message : String(error));
            return this.getFallbackModels(provider);
        }
    }
    async getLiveDefaultModel(provider) {
        try {
            const registry = await import('@anolilab/ai-model-registry');
            const providerName = this.mapProviderName(provider);
            const models = registry.getModelsByProvider?.(providerName) || [];
            if (models.length > 0) {
                const validation = ModelValidator.validateModelData(models);
                if (!validation.valid && this.config.validationMode === 'strict') {
                    throw new Error('Model validation failed: ' + validation.errors.join(', '));
                }
                if (!validation.valid && this.config.validationMode === 'warn') {
                    console.warn('⚠️ Model validation warnings for ' + provider + ':', validation.errors);
                }
                const defaultModel = models[0]?.id || models[0]?.name;
                console.log('📡 Using live model from registry: ' + provider + '/' + defaultModel);
                return defaultModel;
            }
        }
        catch (error) {
            console.warn('Registry unavailable for ' + provider + ', using fallback:', error instanceof Error ? error.message : String(error));
        }
        return this.getFallbackDefaultModel(provider);
    }
    async getCachedDefaultModel(provider) {
        const cacheKey = 'default-' + provider;
        const cached = this.cache.get(cacheKey);
        if (cached && this.isCacheValid(cached.timestamp)) {
            return cached.data;
        }
        return this.getFallbackDefaultModel(provider);
    }
    getFallbackDefaultModel(provider) {
        try {
            const fallbackModel = this.fallbackRegistry.getDefaultModel(provider);
            console.log('🔄 Using fallback model: ' + provider + '/' + fallbackModel);
            return fallbackModel || 'unknown-model';
        }
        catch (error) {
            console.error('No fallback model available for ' + provider);
            return 'unknown-model';
        }
    }
    async getLiveModels(provider) {
        try {
            const registry = await import('@anolilab/ai-model-registry');
            const providerName = this.mapProviderName(provider);
            const models = registry.getModelsByProvider?.(providerName) || [];
            return models.map((model) => ({
                id: model.id || model.name,
                name: model.name || model.id,
                provider,
                pricing: model.pricing ? {
                    input: model.pricing.input || 0,
                    output: model.pricing.output || 0
                } : undefined,
                contextWindow: model.contextLength,
                capabilities: model.capabilities,
                source: 'registry'
            }));
        }
        catch (error) {
            return this.getFallbackModels(provider);
        }
    }
    async getCachedModels(provider) {
        return this.getFallbackModels(provider);
    }
    getFallbackModels(provider) {
        try {
            const models = this.fallbackRegistry.getModelsForProvider(provider);
            return models.map(model => ({
                id: model.id,
                name: model.name,
                provider: model.provider,
                pricing: model.pricing,
                contextWindow: model.contextWindow,
                capabilities: model.capabilities,
                source: 'fallback'
            }));
        }
        catch (error) {
            console.error('No fallback models available for ' + provider);
            return [];
        }
    }
    mapProviderName(provider) {
        const providerNameMap = {
            'anthropic': 'Anthropic',
            'openai': 'OpenAI',
            'google': 'Google',
            'openrouter': 'OpenRouter',
            'meta': 'Meta',
            'groq': 'Groq'
        };
        return providerNameMap[provider] ||
            provider.charAt(0).toUpperCase() + provider.slice(1);
    }
    isCacheValid(timestamp) {
        return (Date.now() - timestamp) < this.config.validationInterval;
    }
    async checkForUpdates() {
        try {
            const registry = await import('@anolilab/ai-model-registry');
            const providers = ['Anthropic', 'OpenAI', 'Google', 'OpenRouter'];
            const changes = [];
            for (const provider of providers) {
                const liveModels = registry.getModelsByProvider?.(provider) || [];
                const cachedModels = this.getFallbackModels(provider.toLowerCase());
                if (liveModels.length !== cachedModels.length) {
                    changes.push({
                        provider,
                        type: 'model_count',
                        old: cachedModels.length,
                        new: liveModels.length
                    });
                }
            }
            return {
                hasUpdates: changes.length > 0,
                changes
            };
        }
        catch (error) {
            console.error('Failed to check for updates:', error);
            return { hasUpdates: false, changes: [] };
        }
    }
    async getHealthStatus() {
        try {
            const registry = await import('@anolilab/ai-model-registry');
            const providers = registry.getProviders?.() || [];
            const models = registry.getAllModels?.() || [];
            return {
                status: 'healthy',
                providers: providers.length,
                models: models.length,
                config: this.config,
                lastCheck: new Date().toISOString()
            };
        }
        catch (error) {
            return {
                status: 'unhealthy',
                error: error instanceof Error ? error.message : String(error),
                config: this.config,
                lastCheck: new Date().toISOString()
            };
        }
    }
}
