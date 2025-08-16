/**
 * Usage Analytics Service
 *
 * Tracks usage information for both subscription and BYOK users.
 * For subscription users: Used for billing and limiting
 * For BYOK users: Used for analytics and display only (no limiting)
 */
import { PostgreSQLAdapter } from '../database/postgres-adapter.js';
export interface UsageRecord {
    id: string;
    userId: string;
    userType: 'subscription' | 'byok';
    provider: string;
    model?: string;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    estimatedCostUsd?: number;
    requestId?: string;
    method?: string;
    timestamp: Date;
    metadata?: any;
}
export interface UserStatus {
    userId: string;
    email?: string;
    userType: 'subscription' | 'byok' | 'unknown';
    hasSubscription: boolean;
    hasPurchases: boolean;
    totalPurchases?: number;
    totalAmountSpentCents?: number;
    subscriptionTier?: string;
    createdAt: Date;
}
export interface PurchaseRecord {
    id: string;
    userId: string;
    paymentId: string;
    purchaseType: 'subscription' | 'one_time';
    variantId?: string;
    quantity?: number;
    amountPaidCents: number;
    currency: string;
    processedAt: Date;
    lemonSqueezyData?: any;
}
export declare class UsageAnalyticsService {
    private db;
    constructor(db: PostgreSQLAdapter);
    /**
     * Record usage for any user (subscription or BYOK)
     */
    recordUsage(record: Omit<UsageRecord, 'id' | 'timestamp'>): Promise<string>;
    /**
     * Get user's usage history (for analytics display)
     */
    getUserUsageHistory(userId: string, limit?: number): Promise<UsageRecord[]>;
    /**
     * Get user's usage summary
     */
    getUserUsageSummary(userId: string, days?: number): Promise<{
        totalRequests: number;
        totalTokens: number;
        estimatedTotalCostUsd: number;
        averageTokensPerRequest: number;
        providerBreakdown: Array<{
            provider: string;
            requests: number;
            tokens: number;
            estimatedCostUsd: number;
        }>;
    }>;
    /**
     * Get user status (subscription vs BYOK, purchase history)
     */
    getUserStatus(userId: string): Promise<UserStatus>;
    /**
     * Record a purchase (subscription or one-time)
     */
    recordPurchase(purchase: Omit<PurchaseRecord, 'id' | 'processedAt'>): Promise<string>;
    /**
     * Get user's purchase history
     */
    getUserPurchaseHistory(userId: string, limit?: number): Promise<PurchaseRecord[]>;
    /**
     * Check if payment has already been processed
     */
    isPaymentProcessed(paymentId: string): Promise<boolean>;
    /**
     * Estimate cost based on provider and tokens
     */
    static estimateCost(provider: string, model: string, inputTokens: number, outputTokens: number): number;
}
//# sourceMappingURL=usage-analytics-service.d.ts.map