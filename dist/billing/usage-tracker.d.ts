import { PostgreSQLAdapter } from '../database/postgres-adapter.js';
export interface UsageEvent {
    userId: string;
    organizationId?: string;
    requestId: string;
    method: string;
    provider: string;
    model?: string;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    cost: number;
    platformFee: number;
    totalCost: number;
    timestamp: Date;
    metadata?: Record<string, any>;
}
export interface UsageSummary {
    userId: string;
    organizationId?: string;
    period: string;
    totalTokens: number;
    totalCost: number;
    totalPlatformFees: number;
    requestCount: number;
    quotaUsed: number;
    quotaLimit: number;
    quotaPercentage: number;
    topProviders: Array<{
        provider: string;
        usage: number;
        percentage: number;
    }>;
    dailyBreakdown: Array<{
        date: string;
        tokens: number;
        cost: number;
        requests: number;
    }>;
}
export interface QuotaStatus {
    userId: string;
    quotaUsed: number;
    quotaLimit: number;
    quotaRemaining: number;
    quotaPercentage: number;
    resetDate: Date;
    isExceeded: boolean;
    warningThreshold: number;
    isNearLimit: boolean;
    estimatedDaysRemaining?: number;
}
/**
 * AI Provider pricing per 1K tokens (input/output)
 */
export declare const PROVIDER_PRICING: {
    readonly anthropic: {
        readonly 'claude-3-sonnet': {
            readonly input: 0.003;
            readonly output: 0.015;
        };
        readonly 'claude-3-haiku': {
            readonly input: 0.00025;
            readonly output: 0.00125;
        };
        readonly 'claude-3-opus': {
            readonly input: 0.015;
            readonly output: 0.075;
        };
        readonly 'claude-3.5-sonnet': {
            readonly input: 0.003;
            readonly output: 0.015;
        };
    };
    readonly openai: {
        readonly 'gpt-4': {
            readonly input: 0.03;
            readonly output: 0.06;
        };
        readonly 'gpt-4-turbo': {
            readonly input: 0.01;
            readonly output: 0.03;
        };
        readonly 'gpt-3.5-turbo': {
            readonly input: 0.0015;
            readonly output: 0.002;
        };
        readonly 'gpt-4o': {
            readonly input: 0.005;
            readonly output: 0.015;
        };
    };
    readonly google: {
        readonly 'gemini-pro': {
            readonly input: 0.0005;
            readonly output: 0.0015;
        };
        readonly 'gemini-pro-vision': {
            readonly input: 0.00025;
            readonly output: 0.0005;
        };
    };
};
export declare class UsageTracker {
    private db;
    private logger;
    private platformFeePercentage;
    constructor(db: PostgreSQLAdapter, platformFeePercentage?: number);
    /**
     * Initialize database tables for usage tracking
     */
    initialize(): Promise<void>;
    /**
     * Calculate cost for a provider/model combination
     */
    calculateCost(provider: string, model: string, inputTokens: number, outputTokens: number): {
        cost: number;
        platformFee: number;
        totalCost: number;
    };
    /**
     * Record a usage event
     */
    recordUsage(event: Omit<UsageEvent, 'totalTokens' | 'cost' | 'platformFee' | 'totalCost'>): Promise<UsageEvent>;
    /**
     * Update user quota usage
     */
    private updateUserQuota;
    /**
     * Get usage summary for a user
     */
    getUserUsage(userId: string, period?: 'current_month' | 'last_30_days' | 'last_7_days'): Promise<UsageSummary>;
    /**
     * Check if user has exceeded quota
     */
    checkQuotaExceeded(userId: string): Promise<boolean>;
    /**
     * Get detailed quota status for a user
     */
    getQuotaStatus(userId: string): Promise<QuotaStatus>;
    /**
     * Update user subscription tier and quota
     */
    updateUserSubscription(userId: string, subscriptionTier: string, // Made flexible to support any tier
    monthlyTokenLimit: number, organizationId?: string): Promise<void>;
    /**
     * Reset monthly quotas (typically run on the first day of each month)
     */
    resetMonthlyQuotas(): Promise<void>;
    /**
     * Get usage analytics for admin purposes
     */
    getUsageAnalytics(startDate?: Date, endDate?: Date): Promise<{
        totalUsers: number;
        totalTokens: number;
        totalCost: number;
        totalPlatformFees: number;
        totalRequests: number;
        providerBreakdown: Array<{
            provider: string;
            tokens: number;
            cost: number;
            requests: number;
            percentage: number;
        }>;
        tierBreakdown: Array<{
            tier: string;
            users: number;
            tokens: number;
            cost: number;
            percentage: number;
        }>;
    }>;
}
//# sourceMappingURL=usage-tracker.d.ts.map