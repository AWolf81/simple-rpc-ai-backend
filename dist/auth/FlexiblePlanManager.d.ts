/**
 * Flexible Plan Manager
 *
 * Configurable user plans with custom quotas, providers, and reset intervals
 * Supports any number of plans with flexible configurations
 */
import * as winston from 'winston';
export interface PlanConfig {
    planId: string;
    displayName: string;
    description: string;
    keySource: 'byok' | 'server_provided' | 'server_optional';
    allowedProviders: string[];
    tokenQuotas: {
        [provider: string]: {
            maxTokensPerPeriod: number;
            resetInterval: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
            resetDay?: number;
        };
    };
    rateLimits: {
        requestsPerMinute: number;
        requestsPerHour: number;
        requestsPerDay: number;
    };
    features: {
        systemPrompts: string[];
        maxPromptLength: number;
        maxResponseLength: number;
        priorityQueue: boolean;
        analyticsAccess: boolean;
        customSystemPrompts: boolean;
    };
    costLimits?: {
        maxCostPerRequest: number;
        maxDailyCost: number;
        maxMonthlyCost: number;
    };
}
export interface UserUsage {
    userId: string;
    planId: string;
    currentPeriod: {
        startDate: Date;
        endDate: Date;
        tokenUsage: {
            [provider: string]: number;
        };
        requestCount: number;
        totalCost: number;
    };
    allTimeUsage: {
        totalTokens: {
            [provider: string]: number;
        };
        totalRequests: number;
        totalCost: number;
        accountCreated: Date;
    };
    rateLimitState: {
        requestsThisMinute: number;
        requestsThisHour: number;
        requestsThisDay: number;
        lastRequestTime: Date;
    };
}
export interface FlexiblePlanConfig {
    defaultPlan: string;
    plans: {
        [planId: string]: PlanConfig;
    };
    serverApiKeys: {
        [provider: string]: {
            apiKey: string;
            maxCostPerDay: number;
            enabled: boolean;
        };
    };
    settings: {
        enableUsageTracking: boolean;
        enableCostTracking: boolean;
        defaultResetTime: string;
        gracePeriodHours: number;
    };
}
/**
 * Manages flexible user plans and quota enforcement
 */
export declare class FlexiblePlanManager {
    private logger;
    private config;
    private userUsage;
    constructor(config: FlexiblePlanConfig, logger?: winston.Logger);
    /**
     * Get API key for user (handles BYOK vs server-provided)
     */
    getApiKeyForUser(userId: string, provider: string, userPlan: string, userApiKey?: string): Promise<{
        apiKey: string;
        source: 'byok' | 'server_provided';
        quotaRemaining?: number;
    }>;
    /**
     * Record usage after AI request
     */
    recordUsage(userId: string, provider: string, tokensUsed: number, estimatedCost: number): Promise<void>;
    /**
     * Check if user can make request (rate limits + quotas)
     */
    canUserMakeRequest(userId: string, provider: string, userPlan: string): Promise<{
        allowed: boolean;
        reason?: string;
        retryAfter?: number;
    }>;
    /**
     * Get user's current usage and limits
     */
    getUserUsageStatus(userId: string, userPlan: string): Promise<{
        plan: PlanConfig;
        usage: UserUsage;
        quotaStatus: {
            [provider: string]: {
                used: number;
                limit: number;
                resetDate: Date;
                percentUsed: number;
            };
        };
        rateLimitStatus: {
            requestsThisMinute: number;
            requestsThisHour: number;
            requestsThisDay: number;
            limits: {
                perMinute: number;
                perHour: number;
                perDay: number;
            };
        };
    }>;
    /**
     * Update user's plan
     */
    updateUserPlan(userId: string, newPlanId: string): Promise<void>;
    /**
     * Private helper methods
     */
    private validateConfig;
    private enforceQuotas;
    private checkRateLimits;
    private checkQuotas;
    private getServerApiKey;
    private getUserUsage;
    private initializeUserUsage;
    private resetUserQuotas;
    private calculateResetDate;
    private updateRateLimitCounters;
}
export default FlexiblePlanManager;
//# sourceMappingURL=FlexiblePlanManager.d.ts.map