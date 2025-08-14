/**
 * Flexible Plan Manager
 *
 * Configurable user plans with custom quotas, providers, and reset intervals
 * Supports any number of plans with flexible configurations
 */
import * as winston from 'winston';
/**
 * Manages flexible user plans and quota enforcement
 */
export class FlexiblePlanManager {
    logger;
    config;
    userUsage = new Map();
    constructor(config, logger) {
        this.config = config;
        this.logger = logger || winston.createLogger({
            level: 'info',
            format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
            transports: [new winston.transports.Console()]
        });
        this.validateConfig();
    }
    /**
     * Get API key for user (handles BYOK vs server-provided)
     */
    async getApiKeyForUser(userId, provider, userPlan, userApiKey // User's BYOK key if available
    ) {
        const plan = this.config.plans[userPlan];
        if (!plan) {
            throw new Error(`Plan not found: ${userPlan}`);
        }
        // Check if provider is allowed for this plan
        if (!plan.allowedProviders.includes(provider)) {
            throw new Error(`Provider ${provider} not allowed for plan ${userPlan}`);
        }
        // Check quotas before providing key
        await this.enforceQuotas(userId, provider, userPlan);
        switch (plan.keySource) {
            case 'byok':
                if (!userApiKey) {
                    throw new Error(`Plan ${userPlan} requires user to provide their own API key`);
                }
                return {
                    apiKey: userApiKey,
                    source: 'byok'
                };
            case 'server_provided':
                const serverKey = this.getServerApiKey(provider);
                const usage = await this.getUserUsage(userId);
                const quota = plan.tokenQuotas[provider];
                const remaining = quota ? quota.maxTokensPerPeriod - (usage.currentPeriod.tokenUsage[provider] || 0) : undefined;
                return {
                    apiKey: serverKey,
                    source: 'server_provided',
                    quotaRemaining: remaining
                };
            case 'server_optional':
                // Free users can opt-in to server keys (trial mode)
                if (userApiKey) {
                    return {
                        apiKey: userApiKey,
                        source: 'byok'
                    };
                }
                else {
                    const serverKey = this.getServerApiKey(provider);
                    const usage = await this.getUserUsage(userId);
                    const quota = plan.tokenQuotas[provider];
                    const remaining = quota ? quota.maxTokensPerPeriod - (usage.currentPeriod.tokenUsage[provider] || 0) : undefined;
                    this.logger.info('Free user using server key (trial mode)', {
                        userId,
                        provider,
                        quotaRemaining: remaining
                    });
                    return {
                        apiKey: serverKey,
                        source: 'server_provided',
                        quotaRemaining: remaining
                    };
                }
            default:
                throw new Error(`Invalid key source: ${plan.keySource}`);
        }
    }
    /**
     * Record usage after AI request
     */
    async recordUsage(userId, provider, tokensUsed, estimatedCost) {
        let usage = this.userUsage.get(userId);
        if (!usage) {
            usage = await this.initializeUserUsage(userId);
        }
        // Update current period
        usage.currentPeriod.tokenUsage[provider] = (usage.currentPeriod.tokenUsage[provider] || 0) + tokensUsed;
        usage.currentPeriod.requestCount += 1;
        usage.currentPeriod.totalCost += estimatedCost;
        // Update all-time usage
        usage.allTimeUsage.totalTokens[provider] = (usage.allTimeUsage.totalTokens[provider] || 0) + tokensUsed;
        usage.allTimeUsage.totalRequests += 1;
        usage.allTimeUsage.totalCost += estimatedCost;
        // Update rate limit state
        const now = new Date();
        usage.rateLimitState.lastRequestTime = now;
        this.userUsage.set(userId, usage);
        this.logger.debug('Usage recorded', {
            userId,
            provider,
            tokensUsed,
            estimatedCost,
            totalTokensThisPeriod: usage.currentPeriod.tokenUsage[provider]
        });
    }
    /**
     * Check if user can make request (rate limits + quotas)
     */
    async canUserMakeRequest(userId, provider, userPlan) {
        const plan = this.config.plans[userPlan];
        if (!plan) {
            return { allowed: false, reason: `Plan not found: ${userPlan}` };
        }
        // Check rate limits
        const rateLimitCheck = await this.checkRateLimits(userId, plan);
        if (!rateLimitCheck.allowed) {
            return rateLimitCheck;
        }
        // Check quotas
        const quotaCheck = await this.checkQuotas(userId, provider, plan);
        if (!quotaCheck.allowed) {
            return quotaCheck;
        }
        return { allowed: true };
    }
    /**
     * Get user's current usage and limits
     */
    async getUserUsageStatus(userId, userPlan) {
        const plan = this.config.plans[userPlan];
        if (!plan) {
            throw new Error(`Plan not found: ${userPlan}`);
        }
        const usage = await this.getUserUsage(userId);
        const quotaStatus = {};
        for (const [provider, quota] of Object.entries(plan.tokenQuotas)) {
            const used = usage.currentPeriod.tokenUsage[provider] || 0;
            quotaStatus[provider] = {
                used,
                limit: quota.maxTokensPerPeriod,
                resetDate: usage.currentPeriod.endDate,
                percentUsed: (used / quota.maxTokensPerPeriod) * 100
            };
        }
        return {
            plan,
            usage,
            quotaStatus,
            rateLimitStatus: {
                requestsThisMinute: usage.rateLimitState.requestsThisMinute,
                requestsThisHour: usage.rateLimitState.requestsThisHour,
                requestsThisDay: usage.rateLimitState.requestsThisDay,
                limits: {
                    perMinute: plan.rateLimits.requestsPerMinute,
                    perHour: plan.rateLimits.requestsPerHour,
                    perDay: plan.rateLimits.requestsPerDay
                }
            }
        };
    }
    /**
     * Update user's plan
     */
    async updateUserPlan(userId, newPlanId) {
        const newPlan = this.config.plans[newPlanId];
        if (!newPlan) {
            throw new Error(`Plan not found: ${newPlanId}`);
        }
        const usage = await this.getUserUsage(userId);
        usage.planId = newPlanId;
        // Reset quotas when changing plans
        usage.currentPeriod = {
            startDate: new Date(),
            endDate: this.calculateResetDate(newPlan.tokenQuotas[Object.keys(newPlan.tokenQuotas)[0]]?.resetInterval || 'monthly'),
            tokenUsage: {},
            requestCount: 0,
            totalCost: 0
        };
        this.userUsage.set(userId, usage);
        this.logger.info('User plan updated', {
            userId,
            oldPlan: usage.planId,
            newPlan: newPlanId
        });
    }
    /**
     * Private helper methods
     */
    validateConfig() {
        if (!this.config.defaultPlan || !this.config.plans[this.config.defaultPlan]) {
            throw new Error('Invalid default plan configuration');
        }
        for (const [planId, plan] of Object.entries(this.config.plans)) {
            if (!plan.allowedProviders.length) {
                throw new Error(`Plan ${planId} has no allowed providers`);
            }
        }
    }
    async enforceQuotas(userId, provider, userPlan) {
        const canRequest = await this.canUserMakeRequest(userId, provider, userPlan);
        if (!canRequest.allowed) {
            throw new Error(canRequest.reason || 'Request not allowed');
        }
    }
    async checkRateLimits(userId, plan) {
        const usage = await this.getUserUsage(userId);
        const now = new Date();
        // Update rate limit counters
        this.updateRateLimitCounters(usage, now);
        if (usage.rateLimitState.requestsThisMinute >= plan.rateLimits.requestsPerMinute) {
            return {
                allowed: false,
                reason: 'Rate limit exceeded: too many requests per minute',
                retryAfter: 60
            };
        }
        if (usage.rateLimitState.requestsThisHour >= plan.rateLimits.requestsPerHour) {
            return {
                allowed: false,
                reason: 'Rate limit exceeded: too many requests per hour',
                retryAfter: 3600
            };
        }
        if (usage.rateLimitState.requestsThisDay >= plan.rateLimits.requestsPerDay) {
            return {
                allowed: false,
                reason: 'Rate limit exceeded: too many requests per day',
                retryAfter: 86400
            };
        }
        return { allowed: true };
    }
    async checkQuotas(userId, provider, plan) {
        const quota = plan.tokenQuotas[provider];
        if (!quota) {
            return { allowed: true }; // No quota defined
        }
        const usage = await this.getUserUsage(userId);
        const used = usage.currentPeriod.tokenUsage[provider] || 0;
        if (used >= quota.maxTokensPerPeriod) {
            const resetDate = usage.currentPeriod.endDate;
            return {
                allowed: false,
                reason: `Token quota exceeded for ${provider}. Resets on ${resetDate.toISOString()}`
            };
        }
        return { allowed: true };
    }
    getServerApiKey(provider) {
        const serverKey = this.config.serverApiKeys[provider];
        if (!serverKey || !serverKey.enabled) {
            throw new Error(`Server API key not available for provider: ${provider}`);
        }
        return serverKey.apiKey;
    }
    async getUserUsage(userId) {
        let usage = this.userUsage.get(userId);
        if (!usage) {
            usage = await this.initializeUserUsage(userId);
            this.userUsage.set(userId, usage);
        }
        // Check if we need to reset quotas
        if (new Date() > usage.currentPeriod.endDate) {
            await this.resetUserQuotas(usage);
        }
        return usage;
    }
    async initializeUserUsage(userId) {
        const now = new Date();
        const defaultPlan = this.config.plans[this.config.defaultPlan];
        const resetInterval = Object.values(defaultPlan.tokenQuotas)[0]?.resetInterval || 'monthly';
        return {
            userId,
            planId: this.config.defaultPlan,
            currentPeriod: {
                startDate: now,
                endDate: this.calculateResetDate(resetInterval),
                tokenUsage: {},
                requestCount: 0,
                totalCost: 0
            },
            allTimeUsage: {
                totalTokens: {},
                totalRequests: 0,
                totalCost: 0,
                accountCreated: now
            },
            rateLimitState: {
                requestsThisMinute: 0,
                requestsThisHour: 0,
                requestsThisDay: 0,
                lastRequestTime: now
            }
        };
    }
    async resetUserQuotas(usage) {
        const plan = this.config.plans[usage.planId];
        const resetInterval = Object.values(plan.tokenQuotas)[0]?.resetInterval || 'monthly';
        const now = new Date();
        usage.currentPeriod = {
            startDate: now,
            endDate: this.calculateResetDate(resetInterval),
            tokenUsage: {},
            requestCount: 0,
            totalCost: 0
        };
        this.logger.info('User quotas reset', {
            userId: usage.userId,
            resetInterval,
            nextReset: usage.currentPeriod.endDate
        });
    }
    calculateResetDate(resetInterval) {
        const now = new Date();
        switch (resetInterval) {
            case 'daily':
                const tomorrow = new Date(now);
                tomorrow.setDate(tomorrow.getDate() + 1);
                tomorrow.setHours(0, 0, 0, 0);
                return tomorrow;
            case 'weekly':
                const nextWeek = new Date(now);
                const daysUntilMonday = (8 - nextWeek.getDay()) % 7;
                nextWeek.setDate(nextWeek.getDate() + daysUntilMonday);
                nextWeek.setHours(0, 0, 0, 0);
                return nextWeek;
            case 'monthly':
                const nextMonth = new Date(now);
                nextMonth.setMonth(nextMonth.getMonth() + 1);
                nextMonth.setDate(1);
                nextMonth.setHours(0, 0, 0, 0);
                return nextMonth;
            case 'yearly':
                const nextYear = new Date(now);
                nextYear.setFullYear(nextYear.getFullYear() + 1);
                nextYear.setMonth(0, 1);
                nextYear.setHours(0, 0, 0, 0);
                return nextYear;
            case 'never':
                const never = new Date('2099-12-31');
                return never;
            default:
                throw new Error(`Invalid reset interval: ${resetInterval}`);
        }
    }
    updateRateLimitCounters(usage, now) {
        const lastRequest = usage.rateLimitState.lastRequestTime;
        const minutesDiff = Math.floor((now.getTime() - lastRequest.getTime()) / 60000);
        const hoursDiff = Math.floor((now.getTime() - lastRequest.getTime()) / 3600000);
        const daysDiff = Math.floor((now.getTime() - lastRequest.getTime()) / 86400000);
        // Reset counters based on time elapsed
        if (minutesDiff >= 1)
            usage.rateLimitState.requestsThisMinute = 0;
        if (hoursDiff >= 1)
            usage.rateLimitState.requestsThisHour = 0;
        if (daysDiff >= 1)
            usage.rateLimitState.requestsThisDay = 0;
    }
}
export default FlexiblePlanManager;
//# sourceMappingURL=FlexiblePlanManager.js.map