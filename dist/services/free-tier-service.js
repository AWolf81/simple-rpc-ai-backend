/**
 * Free Tier Service
 *
 * Provides free AI model access with token limiting and rate limiting.
 * Uses server-side API keys to offer GPT-4o-mini and Gemini 2.0 Flash for free.
 */
export class FreeTierService {
    usage = new Map();
    serverApiKeys = new Map();
    freeModels = [];
    enabled = false;
    constructor(config) {
        this.enabled = config?.enabled ?? false;
        // Only initialize if explicitly enabled
        if (this.enabled) {
            this.initializeModels(config);
            this.configureServerKeys(config?.serverApiKeys || {});
        }
    }
    initializeModels(config) {
        if (config?.models && config.models.length > 0) {
            // Use custom models
            this.freeModels = config.models;
        }
        else {
            // Use default minimal models with conservative limits (5-10 prompts)
            this.freeModels = [
                {
                    id: 'gpt-4o-mini',
                    name: 'GPT-4o Mini (Free)',
                    provider: 'openai',
                    contextLength: 128000,
                    limits: config?.defaultLimits || {
                        tokensPerDay: 8000, // ~5-10 prompts (avg 800-1600 tokens each)
                        tokensPerMonth: 50000, // Conservative monthly limit
                        requestsPerHour: 20, // Prevent rapid-fire requests
                        maxTokensPerRequest: 2048 // Reasonable response size
                    },
                    capabilities: ['text', 'vision', 'speed', 'cost-effective'],
                    enabled: true
                }
            ];
        }
    }
    /**
     * Check if free tier is enabled
     */
    isEnabled() {
        return this.enabled;
    }
    /**
     * Get available free models
     */
    getAvailableModels() {
        if (!this.enabled) {
            return [];
        }
        return this.freeModels.filter(model => {
            // Only show models where we have server API keys
            return model.enabled && this.serverApiKeys.has(model.provider);
        });
    }
    /**
     * Check if user can make a request with given token count
     */
    async canMakeRequest(userId, modelId, estimatedTokens) {
        if (!this.enabled) {
            return { allowed: false, reason: 'Free tier is disabled' };
        }
        const model = this.freeModels.find(m => m.id === modelId);
        if (!model) {
            return { allowed: false, reason: 'Model not found in free tier' };
        }
        if (!model.enabled) {
            return { allowed: false, reason: 'Model temporarily disabled' };
        }
        if (!this.serverApiKeys.has(model.provider)) {
            return { allowed: false, reason: 'Server API key not configured for this provider' };
        }
        const usage = await this.getUserUsage(userId, modelId);
        const now = new Date();
        // Check token limits
        if (estimatedTokens > model.limits.maxTokensPerRequest) {
            return {
                allowed: false,
                reason: `Request too large. Max ${model.limits.maxTokensPerRequest} tokens per request`,
                limits: model.limits
            };
        }
        if (usage.tokensUsedToday + estimatedTokens > model.limits.tokensPerDay) {
            return {
                allowed: false,
                reason: `Daily limit exceeded. Used ${usage.tokensUsedToday}/${model.limits.tokensPerDay} tokens`,
                limits: model.limits
            };
        }
        if (usage.tokensUsedThisMonth + estimatedTokens > model.limits.tokensPerMonth) {
            return {
                allowed: false,
                reason: `Monthly limit exceeded. Used ${usage.tokensUsedThisMonth}/${model.limits.tokensPerMonth} tokens`,
                limits: model.limits
            };
        }
        // Check rate limits
        if (usage.requestsThisHour >= model.limits.requestsPerHour) {
            return {
                allowed: false,
                reason: `Rate limit exceeded. Made ${usage.requestsThisHour}/${model.limits.requestsPerHour} requests this hour`,
                limits: model.limits
            };
        }
        return { allowed: true, limits: model.limits };
    }
    /**
     * Record usage after successful request
     */
    async recordUsage(userId, modelId, tokensUsed) {
        const usage = await this.getUserUsage(userId, modelId);
        const now = new Date();
        // Reset counters if needed
        this.resetCountersIfNeeded(usage, now);
        // Update usage
        usage.tokensUsedToday += tokensUsed;
        usage.tokensUsedThisMonth += tokensUsed;
        usage.requestsThisHour += 1;
        this.usage.set(`${userId}:${modelId}`, usage);
    }
    /**
     * Get user's current usage
     */
    async getUserUsage(userId, modelId) {
        const key = `${userId}:${modelId}`;
        let usage = this.usage.get(key);
        if (!usage) {
            const now = new Date();
            usage = {
                userId,
                model: modelId,
                tokensUsedToday: 0,
                tokensUsedThisMonth: 0,
                requestsThisHour: 0,
                lastReset: {
                    daily: now.toISOString(),
                    monthly: now.toISOString(),
                    hourly: now.toISOString()
                }
            };
            this.usage.set(key, usage);
        }
        // Reset counters if needed
        this.resetCountersIfNeeded(usage, new Date());
        return usage;
    }
    /**
     * Get usage summary for user across all models
     */
    async getUserSummary(userId) {
        const summary = [];
        let shouldRecommendUpgrade = false;
        for (const model of this.getAvailableModels()) {
            const usage = await this.getUserUsage(userId, model.id);
            const percentUsed = {
                daily: (usage.tokensUsedToday / model.limits.tokensPerDay) * 100,
                monthly: (usage.tokensUsedThisMonth / model.limits.tokensPerMonth) * 100,
                hourly: (usage.requestsThisHour / model.limits.requestsPerHour) * 100
            };
            summary.push({
                modelId: model.id,
                modelName: model.name,
                usage,
                limits: model.limits,
                percentUsed
            });
            // Recommend upgrade if user is using >75% of any limit
            if (percentUsed.daily > 75 || percentUsed.monthly > 75 || percentUsed.hourly > 75) {
                shouldRecommendUpgrade = true;
            }
        }
        return {
            models: summary,
            recommendUpgrade: shouldRecommendUpgrade
        };
    }
    /**
     * Get server API key for provider
     */
    getServerApiKey(provider) {
        return this.serverApiKeys.get(provider);
    }
    /**
     * Configure server API keys - supports any provider
     */
    configureServerKeys(keys) {
        for (const [provider, apiKey] of Object.entries(keys)) {
            if (apiKey) {
                this.serverApiKeys.set(provider, apiKey);
            }
        }
    }
    /**
     * Add a custom model to free tier
     */
    addFreeModel(model) {
        if (!this.enabled) {
            throw new Error('Free tier must be enabled to add models');
        }
        // Remove existing model with same ID
        this.freeModels = this.freeModels.filter(m => m.id !== model.id);
        this.freeModels.push(model);
    }
    /**
     * Reset usage counters when time periods expire
     */
    resetCountersIfNeeded(usage, now) {
        const lastDaily = new Date(usage.lastReset.daily);
        const lastMonthly = new Date(usage.lastReset.monthly);
        const lastHourly = new Date(usage.lastReset.hourly);
        // Reset daily counter (different day)
        if (now.getDate() !== lastDaily.getDate() ||
            now.getMonth() !== lastDaily.getMonth() ||
            now.getFullYear() !== lastDaily.getFullYear()) {
            usage.tokensUsedToday = 0;
            usage.lastReset.daily = now.toISOString();
        }
        // Reset monthly counter (different month)
        if (now.getMonth() !== lastMonthly.getMonth() ||
            now.getFullYear() !== lastMonthly.getFullYear()) {
            usage.tokensUsedThisMonth = 0;
            usage.lastReset.monthly = now.toISOString();
        }
        // Reset hourly counter (different hour)
        if (now.getHours() !== lastHourly.getHours() ||
            now.getDate() !== lastHourly.getDate() ||
            now.getMonth() !== lastHourly.getMonth() ||
            now.getFullYear() !== lastHourly.getFullYear()) {
            usage.requestsThisHour = 0;
            usage.lastReset.hourly = now.toISOString();
        }
    }
    /**
     * Enable/disable specific models
     */
    setModelEnabled(modelId, enabled) {
        const model = this.freeModels.find(m => m.id === modelId);
        if (model) {
            model.enabled = enabled;
        }
    }
    /**
     * Get estimated tokens for content (rough approximation)
     */
    estimateTokens(content) {
        // Rough approximation: 1 token ≈ 4 characters for most models
        return Math.ceil(content.length / 4);
    }
}
