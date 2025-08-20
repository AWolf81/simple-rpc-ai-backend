/**
 * Provider Registry Service
 *
 * Integrates with @anolilab/ai-model-registry to provide curated AI provider information
 * filtered to only the providers configured in serviceProviders and byokProviders.
 */
// Registry integration helpers (with fallback for build compatibility)
let registryAvailable;
async function getRegistryProviders() {
    if (registryAvailable === false) {
        return [];
    }
    try {
        // Use eval to avoid TypeScript module resolution issues at build time
        const registryModule = '@anolilab/ai-model-registry';
        const registry = await eval('import')(registryModule);
        registryAvailable = true;
        return registry.getProviders?.() || [];
    }
    catch (error) {
        registryAvailable = false;
        console.warn('AI model registry not available, using fallback');
        return [];
    }
}
async function getRegistryModels(options) {
    if (registryAvailable === false) {
        return [];
    }
    try {
        // Use eval to avoid TypeScript module resolution issues at build time
        const registryModule = '@anolilab/ai-model-registry';
        const registry = await eval('import')(registryModule);
        registryAvailable = true;
        return registry.getModels?.(options) || [];
    }
    catch (error) {
        registryAvailable = false;
        console.warn(`Models not available for ${options.provider}, using fallback`);
        return [];
    }
}
export class ProviderRegistryService {
    serviceProviders;
    byokProviders;
    pricingOverrides = new Map();
    lastRegistryUpdate = null;
    constructor(serviceProviders = [], byokProviders = []) {
        this.serviceProviders = serviceProviders;
        this.byokProviders = byokProviders;
    }
    /**
     * Get filtered providers based on configuration
     */
    async getConfiguredProviders(type = 'all') {
        try {
            // Get all providers from registry
            const registryProviders = await getRegistryProviders();
            const filteredProviders = [];
            // Get all unique configured providers
            const allConfiguredProviders = [...new Set([...this.serviceProviders, ...this.byokProviders])];
            for (const providerName of allConfiguredProviders) {
                const isServiceProvider = this.serviceProviders.includes(providerName);
                const isByokProvider = this.byokProviders.includes(providerName);
                // Filter by type if specified
                if (type === 'service' && !isServiceProvider)
                    continue;
                if (type === 'byok' && !isByokProvider)
                    continue;
                // Get models for this provider
                const models = await this.getProviderModels(providerName);
                const providerConfig = {
                    name: providerName,
                    displayName: this.getProviderDisplayName(providerName),
                    models,
                    priority: this.calculatePriority(providerName, isServiceProvider),
                    isServiceProvider,
                    isByokProvider,
                    metadata: {
                        description: `AI provider: ${providerName}`,
                        website: `https://${providerName}.com`,
                        apiKeyRequired: true,
                        supportedFeatures: ['text-generation', 'chat']
                    }
                };
                filteredProviders.push(providerConfig);
            }
            // Sort by priority
            return filteredProviders.sort((a, b) => a.priority - b.priority);
        }
        catch (error) {
            console.warn('Failed to fetch providers from registry, falling back to default:', error);
            return this.getFallbackProviders(type);
        }
    }
    /**
     * Get models for a specific provider
     */
    async getProviderModels(providerName) {
        try {
            const models = await getRegistryModels({ provider: providerName });
            return models.map((model) => ({
                id: model.id,
                name: model.name || model.id,
                description: model.description,
                contextLength: model.contextLength || 4096,
                inputCostPer1k: this.getOverriddenPrice(providerName, model.id, 'input') ?? model.pricing?.input,
                outputCostPer1k: this.getOverriddenPrice(providerName, model.id, 'output') ?? model.pricing?.output,
                capabilities: model.capabilities || []
            }));
        }
        catch (error) {
            console.warn(`Failed to fetch models for ${providerName}:`, error);
            return this.getFallbackModels(providerName);
        }
    }
    /**
     * Get display name for provider
     */
    getProviderDisplayName(providerName) {
        const displayNames = {
            'anthropic': 'Anthropic',
            'openai': 'OpenAI',
            'google': 'Google',
            'meta': 'Meta',
            'groq': 'Groq',
            'deepseek': 'DeepSeek'
        };
        return displayNames[providerName] || providerName.charAt(0).toUpperCase() + providerName.slice(1);
    }
    /**
     * Get fallback models when registry is unavailable
     */
    getFallbackModels(providerName) {
        const fallbackModels = {
            'anthropic': [
                {
                    id: 'claude-3-5-sonnet-20241022',
                    name: 'Claude 3.5 Sonnet',
                    contextLength: 200000,
                    capabilities: ['text', 'reasoning', 'code']
                },
                {
                    id: 'claude-3-haiku-20240307',
                    name: 'Claude 3 Haiku',
                    contextLength: 200000,
                    capabilities: ['text', 'speed']
                }
            ],
            'openai': [
                {
                    id: 'gpt-4o',
                    name: 'GPT-4o',
                    contextLength: 128000,
                    capabilities: ['text', 'vision', 'reasoning']
                },
                {
                    id: 'gpt-4o-mini',
                    name: 'GPT-4o Mini',
                    contextLength: 128000,
                    capabilities: ['text', 'speed', 'cost-effective']
                }
            ],
            'google': [
                {
                    id: 'gemini-1.5-pro',
                    name: 'Gemini 1.5 Pro',
                    contextLength: 2000000,
                    capabilities: ['text', 'vision', 'large-context']
                },
                {
                    id: 'gemini-1.5-flash',
                    name: 'Gemini 1.5 Flash',
                    contextLength: 1000000,
                    capabilities: ['text', 'speed', 'large-context']
                }
            ]
        };
        return fallbackModels[providerName] || [];
    }
    /**
     * Calculate provider priority (service providers get higher priority)
     */
    calculatePriority(providerName, isServiceProvider) {
        const basePriority = isServiceProvider ? 100 : 200;
        const providerIndex = [...this.serviceProviders, ...this.byokProviders].indexOf(providerName);
        return basePriority + providerIndex;
    }
    /**
     * Add pricing override for incorrect registry data
     */
    addPricingOverride(override) {
        const key = override.model ? `${override.provider}:${override.model}` : override.provider;
        const fullOverride = {
            ...override,
            appliedAt: new Date().toISOString()
        };
        if (!this.pricingOverrides.has(key)) {
            this.pricingOverrides.set(key, []);
        }
        this.pricingOverrides.get(key).push(fullOverride);
        console.info(`Applied pricing override for ${key}:`, fullOverride);
    }
    /**
     * Get overridden price if available
     */
    getOverriddenPrice(provider, model, type) {
        // Check model-specific override first
        const modelKey = `${provider}:${model}`;
        const modelOverrides = this.pricingOverrides.get(modelKey);
        if (modelOverrides && modelOverrides.length > 0) {
            const latest = modelOverrides[modelOverrides.length - 1];
            return latest.pricing[type];
        }
        // Check provider-level override
        const providerOverrides = this.pricingOverrides.get(provider);
        if (providerOverrides && providerOverrides.length > 0) {
            const latest = providerOverrides[providerOverrides.length - 1];
            return latest.pricing[type];
        }
        return undefined;
    }
    /**
     * Fallback providers when registry is unavailable
     */
    getFallbackProviders(type) {
        const fallbackData = [
            {
                name: 'anthropic',
                displayName: 'Anthropic',
                models: [
                    {
                        id: 'claude-3-5-sonnet-20241022',
                        name: 'Claude 3.5 Sonnet',
                        contextLength: 200000,
                        capabilities: ['text', 'reasoning', 'code']
                    },
                    {
                        id: 'claude-3-haiku-20240307',
                        name: 'Claude 3 Haiku',
                        contextLength: 200000,
                        capabilities: ['text', 'speed']
                    }
                ],
                priority: 1,
                isServiceProvider: this.serviceProviders.includes('anthropic'),
                isByokProvider: this.byokProviders.includes('anthropic')
            },
            {
                name: 'openai',
                displayName: 'OpenAI',
                models: [
                    {
                        id: 'gpt-4o',
                        name: 'GPT-4o',
                        contextLength: 128000,
                        capabilities: ['text', 'vision', 'reasoning']
                    },
                    {
                        id: 'gpt-4o-mini',
                        name: 'GPT-4o Mini',
                        contextLength: 128000,
                        capabilities: ['text', 'speed', 'cost-effective']
                    }
                ],
                priority: 2,
                isServiceProvider: this.serviceProviders.includes('openai'),
                isByokProvider: this.byokProviders.includes('openai')
            },
            {
                name: 'google',
                displayName: 'Google',
                models: [
                    {
                        id: 'gemini-1.5-pro',
                        name: 'Gemini 1.5 Pro',
                        contextLength: 2000000,
                        capabilities: ['text', 'vision', 'large-context']
                    },
                    {
                        id: 'gemini-1.5-flash',
                        name: 'Gemini 1.5 Flash',
                        contextLength: 1000000,
                        capabilities: ['text', 'speed', 'large-context']
                    }
                ],
                priority: 3,
                isServiceProvider: this.serviceProviders.includes('google'),
                isByokProvider: this.byokProviders.includes('google')
            }
        ];
        return fallbackData.filter(provider => {
            if (type === 'service')
                return provider.isServiceProvider;
            if (type === 'byok')
                return provider.isByokProvider;
            return provider.isServiceProvider || provider.isByokProvider;
        });
    }
    /**
     * Check for pricing changes and warn
     */
    async checkForPricingChanges() {
        // This would be called during re-aggregation
        // Implementation depends on how the registry tracks changes
        const changes = [];
        // TODO: Implement actual change detection
        // This is a placeholder for the warning system mentioned in the spec
        return {
            hasChanges: changes.length > 0,
            changes
        };
    }
    /**
     * Update configuration
     */
    updateConfiguration(serviceProviders, byokProviders) {
        this.serviceProviders = serviceProviders;
        this.byokProviders = byokProviders;
    }
    /**
     * Get registry health status
     */
    async getHealthStatus() {
        const healthCheck = {
            status: 'unknown',
            available: false,
            lastUpdate: this.lastRegistryUpdate?.toISOString() || null,
            providers: {
                configured: [...new Set([...this.serviceProviders, ...this.byokProviders])],
                available: [],
                failed: []
            },
            pricing: {
                overrides: this.pricingOverrides.size,
                totalOverrideCount: Array.from(this.pricingOverrides.values()).reduce((total, overrides) => total + overrides.length, 0)
            },
            errors: [],
            performance: {
                responseTimeMs: 0,
                cacheHit: false
            }
        };
        const startTime = Date.now();
        try {
            // Test registry connectivity
            const providers = await getRegistryProviders();
            const responseTime = Date.now() - startTime;
            if (providers.length > 0) {
                healthCheck.status = 'healthy';
                healthCheck.available = true;
                healthCheck.providers.available = providers;
                healthCheck.performance.responseTimeMs = responseTime;
                healthCheck.performance.cacheHit = registryAvailable === true;
                // Test a few configured providers
                for (const provider of healthCheck.providers.configured.slice(0, 3)) {
                    try {
                        await getRegistryModels({ provider });
                    }
                    catch (error) {
                        healthCheck.providers.failed.push(provider);
                        healthCheck.errors.push(`Failed to fetch models for ${provider}: ${error instanceof Error ? error.message : 'Unknown error'}`);
                    }
                }
                if (healthCheck.providers.failed.length > 0) {
                    healthCheck.status = 'degraded';
                }
            }
            else {
                healthCheck.status = 'unavailable';
                healthCheck.errors.push('Registry returned no providers');
            }
        }
        catch (error) {
            healthCheck.status = 'unavailable';
            healthCheck.available = false;
            healthCheck.performance.responseTimeMs = Date.now() - startTime;
            healthCheck.errors.push(`Registry connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
        return healthCheck;
    }
}
//# sourceMappingURL=provider-registry.js.map