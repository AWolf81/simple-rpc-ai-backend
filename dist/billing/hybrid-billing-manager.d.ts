/**
 * Hybrid Billing Manager
 *
 * Manages both BYOK and server-provided credits with OpenSaaS integration
 * Automatically chooses payment method based on user preferences and balance
 */
import { SimpleKeyManager } from '../auth/key-manager.js';
export interface BillingConfig {
    serverMode: 'byok_only' | 'credits_only' | 'hybrid' | 'user_choice';
    defaultUserMode: 'byok' | 'credits' | 'auto_fallback';
    freeCreditsPerMonth: number;
    maxCreditBalance: number;
    lowBalanceThreshold: number;
    openSaasApiKey: string;
    openSaasApiUrl: string;
    webhookSecret: string;
    serverAI: {
        anthropic?: string;
        openai?: string;
        google?: string;
    };
}
export interface UserBillingPreference {
    userId: string;
    preferredMode: 'byok' | 'credits' | 'auto_fallback';
    maxMonthlySpend: number;
    creditBalance: number;
    monthlyUsage: number;
    lastResetDate: Date;
    isActive: boolean;
    byokProviders: string[];
}
export interface UsageRecord {
    userId: string;
    requestId: string;
    provider: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    estimatedCost: number;
    actualCost?: number;
    paymentMethod: 'byok' | 'credits';
    timestamp: Date;
    analysisType: string;
}
export interface PaymentMethodResult {
    method: 'byok' | 'credits';
    provider?: string;
    apiKey?: string;
    reason: string;
    estimatedCost: number;
    remainingCredits?: number;
}
type Provider = 'anthropic' | 'openai' | 'google';
type Model = 'claude-3-5-sonnet' | 'claude-3-haiku' | 'gpt-4o' | 'gpt-4o-mini' | 'gpt-3.5-turbo' | 'gemini-1.5-pro' | 'gemini-1.5-flash';
export interface OpenSaaSClient {
    checkBalance(userId: string): Promise<{
        balance: number;
        isActive: boolean;
    }>;
    recordUsage(userId: string, usage: UsageRecord): Promise<void>;
    getUserBilling(userId: string): Promise<UserBillingPreference | null>;
    updateUserBilling(userId: string, updates: Partial<UserBillingPreference>): Promise<void>;
}
export declare class HybridBillingManager {
    private config;
    private keyManager;
    private openSaasClient;
    constructor(config: BillingConfig, keyManager: SimpleKeyManager, openSaasClient: OpenSaaSClient);
    /**
     * Determine payment method for a request
     */
    getPaymentMethod(userId: string, provider: Provider, model: Model, estimatedTokens: number): Promise<PaymentMethodResult>;
    /**
     * Get BYOK payment method
     */
    private getBYOKMethod;
    /**
     * Get server credits payment method
     */
    private getCreditsMethod;
    /**
     * Check if user can use credits
     */
    canUseCredits(userId: string, estimatedCost: number): Promise<{
        canUse: boolean;
        balance: number;
        reason: string;
    }>;
    /**
     * Record usage for billing
     */
    recordUsage(usage: UsageRecord): Promise<void>;
    /**
     * Deduct credits from user balance
     */
    private deductCredits;
    /**
     * Get user billing preferences
     */
    getUserBillingPreference(userId: string): Promise<UserBillingPreference>;
    /**
     * Update user billing preferences
     */
    updateUserBillingPreference(userId: string, updates: Partial<UserBillingPreference>): Promise<void>;
    /**
     * Estimate cost for AI request
     */
    private estimateCost;
    /**
     * Get cost per token for provider/model
     */
    private getCostPerToken;
    /**
     * Check if monthly usage should be reset
     */
    private shouldResetMonthlyUsage;
    /**
     * Get user billing status
     */
    getBillingStatus(userId: string): Promise<{
        preferredMode: string;
        creditBalance: number;
        monthlyUsage: number;
        monthlyLimit: number;
        isActive: boolean;
        lowBalanceWarning: boolean;
        byokProviders: string[];
    }>;
    /**
     * Add credits to user account (called by OpenSaaS webhooks)
     */
    addCredits(userId: string, amount: number, reason: string): Promise<void>;
}
export {};
//# sourceMappingURL=hybrid-billing-manager.d.ts.map