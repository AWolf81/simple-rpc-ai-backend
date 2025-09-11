/**
 * Centralized Model Registry for AI Providers
 *
 * Manages model definitions, deprecation warnings, capabilities,
 * and allows for extension by consuming applications.
 */
/**
 * Default model registries for all supported providers
 */
export const DEFAULT_MODEL_REGISTRIES = {
    anthropic: {
        provider: 'anthropic',
        defaultModel: 'claude-opus-4-1-20250805',
        webSearchCapabilities: {
            supportsNative: true,
            recommendedPreference: 'ai-web-search',
            description: 'Claude has excellent native web search with domain filtering and location targeting'
        },
        models: [
            // Current Active Models
            {
                id: 'claude-opus-4-1-20250805',
                name: 'Claude Opus 4.1',
                provider: 'anthropic',
                description: 'Our most capable and intelligent model yet',
                contextWindow: 200000,
                capabilities: ['text', 'vision', 'reasoning', 'multimodal', 'function-calling', 'web-search', 'computer-use'],
                status: 'active',
                trainingDataCutoff: 'March 2025',
                webSearchSupport: true,
                nativeWebSearch: true
            },
            {
                id: 'claude-opus-4-20250514',
                name: 'Claude Opus 4',
                provider: 'anthropic',
                description: 'Previous flagship model with excellent reasoning',
                contextWindow: 200000,
                capabilities: ['text', 'vision', 'reasoning', 'multimodal', 'function-calling', 'web-search'],
                status: 'active',
                trainingDataCutoff: 'March 2025',
                webSearchSupport: true,
                nativeWebSearch: true
            },
            {
                id: 'claude-sonnet-4-20250514',
                name: 'Claude Sonnet 4',
                provider: 'anthropic',
                description: 'High-performance model with 1M context beta available',
                contextWindow: 200000, // 1M context available in beta
                capabilities: ['text', 'vision', 'reasoning', 'multimodal', 'function-calling', 'web-search'],
                status: 'active',
                trainingDataCutoff: 'March 2025',
                webSearchSupport: true,
                nativeWebSearch: true
            },
            {
                id: 'claude-sonnet-3-7-20241125',
                name: 'Claude Sonnet 3.7',
                provider: 'anthropic',
                description: 'High-performance model with early extended thinking',
                contextWindow: 200000,
                capabilities: ['text', 'vision', 'reasoning', 'multimodal', 'function-calling'],
                status: 'active',
                trainingDataCutoff: 'November 2024',
                webSearchSupport: false,
                nativeWebSearch: false
            },
            {
                id: 'claude-haiku-3-5-20241022',
                name: 'Claude Haiku 3.5',
                provider: 'anthropic',
                description: 'Fastest model with excellent performance',
                contextWindow: 200000,
                capabilities: ['text', 'vision', 'code', 'multimodal'],
                status: 'active',
                trainingDataCutoff: 'July 2024',
                webSearchSupport: false,
                nativeWebSearch: false
            },
            {
                id: 'claude-haiku-3-20240307',
                name: 'Claude Haiku 3',
                provider: 'anthropic',
                description: 'Fast and compact model',
                contextWindow: 200000,
                capabilities: ['text', 'code'],
                status: 'active',
                trainingDataCutoff: 'August 2023',
                webSearchSupport: false,
                nativeWebSearch: false
            },
            // Deprecated Models
            {
                id: 'claude-3-5-sonnet-20241022',
                name: 'Claude 3.5 Sonnet',
                provider: 'anthropic',
                description: 'Legacy model - use Claude Sonnet 4 instead',
                contextWindow: 200000,
                capabilities: ['text', 'vision', 'code', 'multimodal'],
                status: 'deprecated',
                deprecationDate: '2025-03-01',
                replacementModel: 'claude-sonnet-4-20250514',
                trainingDataCutoff: 'April 2024',
                webSearchSupport: false,
                nativeWebSearch: false
            },
            {
                id: 'claude-3-opus-20240229',
                name: 'Claude 3 Opus',
                provider: 'anthropic',
                description: 'Legacy flagship model - use Claude Opus 4.1 instead',
                contextWindow: 200000,
                capabilities: ['text', 'vision', 'reasoning', 'multimodal'],
                status: 'deprecated',
                deprecationDate: '2025-03-01',
                replacementModel: 'claude-opus-4-1-20250805',
                trainingDataCutoff: 'August 2023',
                webSearchSupport: false,
                nativeWebSearch: false
            }
        ]
    },
    openai: {
        provider: 'openai',
        defaultModel: 'gpt-4o',
        webSearchCapabilities: {
            supportsNative: true,
            recommendedPreference: 'ai-web-search',
            description: 'GPT-4 has native web browsing capabilities'
        },
        models: [
            {
                id: 'gpt-4o',
                name: 'GPT-4o',
                provider: 'openai',
                description: 'Most capable GPT-4 model with vision and reasoning',
                contextWindow: 128000,
                capabilities: ['text', 'vision', 'reasoning', 'multimodal', 'function-calling', 'web-search'],
                status: 'active',
                webSearchSupport: true,
                nativeWebSearch: true
            },
            {
                id: 'gpt-4o-mini',
                name: 'GPT-4o Mini',
                provider: 'openai',
                description: 'Smaller, faster version of GPT-4o',
                contextWindow: 128000,
                capabilities: ['text', 'vision', 'code', 'multimodal', 'function-calling'],
                status: 'active',
                webSearchSupport: false,
                nativeWebSearch: false
            },
            {
                id: 'gpt-4-turbo',
                name: 'GPT-4 Turbo',
                provider: 'openai',
                description: 'Fast GPT-4 with large context window',
                contextWindow: 128000,
                capabilities: ['text', 'vision', 'reasoning', 'multimodal', 'function-calling'],
                status: 'active',
                webSearchSupport: true,
                nativeWebSearch: true
            },
            {
                id: 'gpt-3.5-turbo',
                name: 'GPT-3.5 Turbo',
                provider: 'openai',
                description: 'Legacy model - consider upgrading to GPT-4o Mini',
                contextWindow: 16384,
                capabilities: ['text', 'code', 'function-calling'],
                status: 'deprecated',
                deprecationDate: '2024-12-31',
                replacementModel: 'gpt-4o-mini',
                webSearchSupport: false,
                nativeWebSearch: false
            }
        ]
    },
    google: {
        provider: 'google',
        defaultModel: 'gemini-2.5-flash',
        webSearchCapabilities: {
            supportsNative: true,
            recommendedPreference: 'ai-web-search',
            description: 'Gemini has Google Search grounding for real-time web information'
        },
        models: [
            {
                id: 'gemini-2.5-flash',
                name: 'Gemini 2.5 Flash',
                provider: 'google',
                description: 'Latest fast Gemini model with enhanced capabilities',
                contextWindow: 1000000,
                capabilities: ['text', 'vision', 'code', 'reasoning', 'multimodal', 'function-calling', 'web-search'],
                status: 'active',
                webSearchSupport: true,
                nativeWebSearch: true
            },
            {
                id: 'gemini-1.5-pro',
                name: 'Gemini 1.5 Pro',
                provider: 'google',
                description: 'High-performance model with large context',
                contextWindow: 2000000,
                capabilities: ['text', 'vision', 'reasoning', 'multimodal', 'function-calling', 'web-search'],
                status: 'active',
                webSearchSupport: true,
                nativeWebSearch: true
            },
            {
                id: 'gemini-1.5-flash',
                name: 'Gemini 1.5 Flash',
                provider: 'google',
                description: 'Fast model with good performance',
                contextWindow: 1000000,
                capabilities: ['text', 'vision', 'code', 'multimodal', 'function-calling'],
                status: 'active',
                webSearchSupport: false,
                nativeWebSearch: false
            },
            {
                id: 'gemini-1.0-pro',
                name: 'Gemini 1.0 Pro',
                provider: 'google',
                description: 'Legacy model - use Gemini 1.5 Pro instead',
                contextWindow: 32768,
                capabilities: ['text', 'reasoning'],
                status: 'deprecated',
                deprecationDate: '2024-12-31',
                replacementModel: 'gemini-1.5-pro',
                webSearchSupport: false,
                nativeWebSearch: false
            }
        ]
    },
    openrouter: {
        provider: 'openrouter',
        defaultModel: 'anthropic/claude-3.5-sonnet',
        webSearchCapabilities: {
            supportsNative: true,
            recommendedPreference: 'ai-web-search',
            description: 'OpenRouter has universal web search via Exa.ai across 400+ models ($4 per 1000 results)'
        },
        models: [
            // Top Anthropic models via OpenRouter
            {
                id: 'anthropic/claude-3.5-sonnet',
                name: 'Claude 3.5 Sonnet (OpenRouter)',
                provider: 'openrouter',
                description: 'Anthropic Claude 3.5 Sonnet via OpenRouter',
                contextWindow: 200000,
                capabilities: ['text', 'vision', 'reasoning', 'multimodal', 'web-search'],
                status: 'active',
                webSearchSupport: true,
                nativeWebSearch: true
            },
            {
                id: 'anthropic/claude-3-opus',
                name: 'Claude 3 Opus (OpenRouter)',
                provider: 'openrouter',
                description: 'Anthropic Claude 3 Opus via OpenRouter',
                contextWindow: 200000,
                capabilities: ['text', 'vision', 'reasoning', 'multimodal', 'web-search'],
                status: 'active',
                webSearchSupport: true,
                nativeWebSearch: true
            },
            // Top OpenAI models via OpenRouter  
            {
                id: 'openai/gpt-4o',
                name: 'GPT-4o (OpenRouter)',
                provider: 'openrouter',
                description: 'OpenAI GPT-4o via OpenRouter',
                contextWindow: 128000,
                capabilities: ['text', 'vision', 'reasoning', 'multimodal', 'web-search'],
                status: 'active',
                webSearchSupport: true,
                nativeWebSearch: true
            },
            {
                id: 'openai/gpt-4-turbo',
                name: 'GPT-4 Turbo (OpenRouter)',
                provider: 'openrouter',
                description: 'OpenAI GPT-4 Turbo via OpenRouter',
                contextWindow: 128000,
                capabilities: ['text', 'vision', 'reasoning', 'multimodal', 'web-search'],
                status: 'active',
                webSearchSupport: true,
                nativeWebSearch: true
            },
            // Google models via OpenRouter
            {
                id: 'google/gemini-pro',
                name: 'Gemini Pro (OpenRouter)',
                provider: 'openrouter',
                description: 'Google Gemini Pro via OpenRouter',
                contextWindow: 128000,
                capabilities: ['text', 'reasoning', 'web-search'],
                status: 'active',
                webSearchSupport: true,
                nativeWebSearch: true
            },
            // Perplexity models with built-in online search
            {
                id: 'perplexity/llama-3.1-sonar-large-128k-online',
                name: 'Perplexity Sonar Large Online',
                provider: 'openrouter',
                description: 'Perplexity model with built-in web search capabilities',
                contextWindow: 128000,
                capabilities: ['text', 'reasoning', 'web-search'],
                status: 'active',
                webSearchSupport: true,
                nativeWebSearch: true
            },
            {
                id: 'perplexity/llama-3.1-sonar-small-128k-online',
                name: 'Perplexity Sonar Small Online',
                provider: 'openrouter',
                description: 'Smaller Perplexity model with built-in web search',
                contextWindow: 128000,
                capabilities: ['text', 'reasoning', 'web-search'],
                status: 'active',
                webSearchSupport: true,
                nativeWebSearch: true
            },
            // Meta Llama models
            {
                id: 'meta-llama/llama-3.1-405b',
                name: 'Llama 3.1 405B',
                provider: 'openrouter',
                description: 'Meta\'s largest Llama model',
                contextWindow: 128000,
                capabilities: ['text', 'reasoning', 'web-search'],
                status: 'active',
                webSearchSupport: true,
                nativeWebSearch: true
            },
            // Other notable models
            {
                id: 'qwen/qwq-32b-preview',
                name: 'QwQ 32B Preview',
                provider: 'openrouter',
                description: 'Qwen QwQ reasoning model',
                contextWindow: 32768,
                capabilities: ['text', 'reasoning', 'web-search'],
                status: 'preview',
                webSearchSupport: true,
                nativeWebSearch: true
            }
        ]
    }
};
/**
 * Model Registry Manager - handles model operations and extensions
 */
export class ModelRegistryManager {
    registries;
    constructor(useDefaults = true) {
        this.registries = useDefaults ? { ...DEFAULT_MODEL_REGISTRIES } : {};
    }
    /**
     * Get all models for a provider
     */
    getModelsForProvider(provider) {
        return this.registries[provider]?.models || [];
    }
    /**
     * Get a specific model by ID and provider
     */
    getModel(provider, modelId) {
        return this.registries[provider]?.models.find(model => model.id === modelId);
    }
    /**
     * Get default model for a provider
     */
    getDefaultModel(provider) {
        return this.registries[provider]?.defaultModel;
    }
    /**
     * Get web search capabilities for a provider
     */
    getWebSearchCapabilities(provider) {
        return this.registries[provider]?.webSearchCapabilities;
    }
    /**
     * Add or update a provider registry
     */
    addProviderRegistry(registry) {
        this.registries[registry.provider] = registry;
    }
    /**
     * Extend existing provider with additional models
     */
    extendProvider(provider, models, newDefaultModel) {
        if (!this.registries[provider]) {
            throw new Error(`Provider ${provider} not found`);
        }
        // Add new models, avoiding duplicates
        const existingIds = new Set(this.registries[provider].models.map(m => m.id));
        const newModels = models.filter(model => !existingIds.has(model.id));
        this.registries[provider].models.push(...newModels);
        // Update default model if provided
        if (newDefaultModel) {
            this.registries[provider].defaultModel = newDefaultModel;
        }
    }
    /**
     * Replace models for a provider (preserves other provider settings)
     */
    replaceProviderModels(provider, models, newDefaultModel) {
        if (!this.registries[provider]) {
            throw new Error(`Provider ${provider} not found`);
        }
        this.registries[provider].models = models;
        if (newDefaultModel) {
            this.registries[provider].defaultModel = newDefaultModel;
        }
    }
    /**
     * Update a specific model
     */
    updateModel(provider, modelId, updates) {
        const providerRegistry = this.registries[provider];
        if (!providerRegistry) {
            throw new Error(`Provider ${provider} not found`);
        }
        const modelIndex = providerRegistry.models.findIndex(m => m.id === modelId);
        if (modelIndex === -1) {
            throw new Error(`Model ${modelId} not found for provider ${provider}`);
        }
        providerRegistry.models[modelIndex] = { ...providerRegistry.models[modelIndex], ...updates };
    }
    /**
     * Get deprecated models with warnings
     */
    getDeprecatedModels(provider) {
        const providers = provider ? [provider] : Object.keys(this.registries);
        const deprecatedModels = [];
        for (const providerName of providers) {
            const registry = this.registries[providerName];
            if (!registry)
                continue;
            const deprecated = registry.models
                .filter(model => model.status === 'deprecated')
                .map(model => ({
                ...model,
                warning: this.createDeprecationWarning(model)
            }));
            deprecatedModels.push(...deprecated);
        }
        return deprecatedModels;
    }
    /**
     * Check if a model is deprecated and return warning
     */
    checkModelDeprecation(provider, modelId) {
        const model = this.getModel(provider, modelId);
        if (!model) {
            return { deprecated: false };
        }
        if (model.status === 'deprecated') {
            return {
                deprecated: true,
                warning: this.createDeprecationWarning(model)
            };
        }
        return { deprecated: false };
    }
    /**
     * Get all active models across all providers
     */
    getAllActiveModels() {
        const allModels = [];
        for (const registry of Object.values(this.registries)) {
            allModels.push(...registry.models.filter(model => model.status === 'active'));
        }
        return allModels;
    }
    /**
     * Search models by capability
     */
    findModelsByCapability(capability, provider) {
        const providers = provider ? [provider] : Object.keys(this.registries);
        const matchingModels = [];
        for (const providerName of providers) {
            const registry = this.registries[providerName];
            if (!registry)
                continue;
            const models = registry.models.filter(model => model.capabilities.includes(capability) && model.status === 'active');
            matchingModels.push(...models);
        }
        return matchingModels;
    }
    /**
     * Get registry snapshot for debugging/inspection
     */
    getRegistrySnapshot() {
        return JSON.parse(JSON.stringify(this.registries));
    }
    /**
     * Create deprecation warning message
     */
    createDeprecationWarning(model) {
        let warning = `⚠️  Model ${model.name} (${model.id}) is deprecated`;
        if (model.deprecationDate) {
            warning += ` as of ${model.deprecationDate}`;
        }
        if (model.replacementModel) {
            warning += `. Use ${model.replacementModel} instead`;
        }
        warning += '.';
        return warning;
    }
}
// Export singleton instance
export const modelRegistry = new ModelRegistryManager();
