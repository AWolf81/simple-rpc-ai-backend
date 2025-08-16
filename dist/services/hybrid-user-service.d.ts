/**
 * Hybrid User Service
 *
 * Manages users with multiple payment methods:
 * - Subscription tokens (recurring)
 * - One-time token purchases
 * - BYOK (Bring Your Own Key)
 *
 * Handles consumption order preferences and fallback logic
 */
import { PostgreSQLAdapter } from '../database/postgres-adapter.js';
import { UsageAnalyticsService } from './usage-analytics-service.js';
export interface UserProfile {
    userId: string;
    email?: string;
    hasSubscription: boolean;
    hasOneTimePurchases: boolean;
    hasByokConfigured: boolean;
    consumptionOrder: ('subscription' | 'one_time' | 'byok')[];
    byokEnabled: boolean;
    byokProviders: Record<string, {
        enabled: boolean;
        apiKey?: string;
    }>;
    notifyTokenLowThreshold: number;
    notifyFallbackToByok: boolean;
    notifyOneTimeConsumed: boolean;
    subscriptionTier?: string;
    subscriptionStatus?: string;
    createdAt: Date;
    updatedAt: Date;
}
export interface TokenBalance {
    id: string;
    userId: string;
    balanceType: 'subscription' | 'one_time';
    virtualTokenBalance: number;
    totalTokensPurchased: number;
    totalTokensUsed: number;
    platformFeeCollected: number;
    purchaseSource?: string;
    purchaseDate?: Date;
    expiryDate?: Date;
    consumptionPriority: number;
}
export interface ConsumptionPlan {
    totalTokensNeeded: number;
    plan: Array<{
        type: 'subscription' | 'one_time' | 'byok';
        balanceId?: string;
        tokensToConsume: number;
        reason: string;
    }>;
    notifications: Array<{
        type: 'token_low' | 'fallback_to_byok' | 'one_time_consumed' | 'balance_exhausted';
        message: string;
        critical: boolean;
    }>;
}
export interface ConsumptionResult {
    success: boolean;
    tokensConsumed: number;
    actualConsumption: Array<{
        type: 'subscription' | 'one_time' | 'byok';
        balanceId?: string;
        tokensConsumed: number;
        newBalance?: number;
    }>;
    fallbackUsed: boolean;
    notifications: string[];
    usageLogId: string;
}
export declare class HybridUserService {
    private db;
    private usageAnalytics;
    constructor(db: PostgreSQLAdapter, usageAnalytics: UsageAnalyticsService);
    /**
     * Get or create user profile
     */
    ensureUserProfile(userId: string, email?: string): Promise<UserProfile>;
    /**
     * Get user profile with all capabilities and preferences
     */
    getUserProfile(userId: string): Promise<UserProfile | null>;
    /**
     * Update user preferences
     */
    updateUserPreferences(userId: string, preferences: {
        consumptionOrder?: ('subscription' | 'one_time' | 'byok')[];
        byokEnabled?: boolean;
        byokProviders?: Record<string, {
            enabled: boolean;
            apiKey?: string;
        }>;
        notifyTokenLowThreshold?: number;
        notifyFallbackToByok?: boolean;
        notifyOneTimeConsumed?: boolean;
    }): Promise<void>;
    /**
     * Get all token balances for user, ordered by consumption priority
     */
    getUserTokenBalances(userId: string): Promise<TokenBalance[]>;
    /**
     * Plan token consumption based on user preferences
     * IMPORTANT: BYOK is all-or-nothing (can't split tokens across managed/unmanaged balances)
     */
    planConsumption(userId: string, tokensNeeded: number, apiKey?: string): Promise<ConsumptionPlan>;
    /**
     * Execute token consumption based on plan
     * IMPORTANT: Plan is either all managed tokens OR all BYOK (no mixing)
     */
    executeConsumption(userId: string, tokensNeeded: number, provider: string, model?: string, requestId?: string, apiKey?: string): Promise<ConsumptionResult>;
    /**
     * Add tokens to user's balance (from purchases)
     */
    addTokens(userId: string, balanceType: 'subscription' | 'one_time', tokens: number, purchaseSource: string, purchaseId: string, priority?: number, expiryDate?: Date): Promise<string>;
    /**
     * Configure BYOK for user
     */
    configureBYOK(userId: string, providers: Record<string, {
        enabled: boolean;
        apiKey?: string;
    }>, enabled?: boolean): Promise<void>;
    /**
     * Get consumption history for user
     */
    getConsumptionHistory(userId: string, limit?: number): Promise<any[]>;
}
//# sourceMappingURL=hybrid-user-service.d.ts.map