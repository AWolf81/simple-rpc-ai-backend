import { UsageTracker, type UsageEvent } from './usage-tracker.js';
import { PostgreSQLAdapter } from '../database/postgres-adapter.js';
export interface BillingEvent {
    type: 'usage' | 'quota_exceeded' | 'tier_upgrade' | 'payment_failed' | 'subscription_cancelled';
    userId: string;
    organizationId?: string;
    amount: number;
    currency: 'usd';
    metadata: Record<string, any>;
    timestamp: Date;
}
export interface PlatformFeeConfig {
    percentage: number;
    minimumFee?: number;
    maximumFee?: number;
}
export interface BillingConfig {
    opensaasWebhookUrl?: string;
    opensaasApiKey?: string;
    stripeWebhookSecret?: string;
    lemonsqueezyWebhookSecret?: string;
    platformFee: PlatformFeeConfig;
    billingProvider: 'stripe' | 'lemonsqueezy' | 'opensaas';
    enableUsageBasedBilling: boolean;
    quotaWarningThresholds: number[];
}
export interface SubscriptionInfo {
    userId: string;
    tier: string;
    status: 'active' | 'cancelled' | 'expired' | 'trial';
    monthlyTokenQuota: number;
    currentUsage: number;
    billingPeriodStart: Date;
    billingPeriodEnd: Date;
    nextBillingDate: Date;
    amount: number;
    currency: string;
}
export declare class BillingEngine {
    private db;
    private usageTracker;
    private config;
    private logger;
    constructor(db: PostgreSQLAdapter, usageTracker: UsageTracker, config: BillingConfig);
    /**
     * Initialize billing database tables
     */
    initialize(): Promise<void>;
    /**
     * Calculate platform fee for a given cost
     */
    calculatePlatformFee(cost: number): number;
    /**
     * Create a billing event
     */
    createBillingEvent(event: Omit<BillingEvent, 'timestamp'>): Promise<string>;
    /**
     * Process usage event and create billing events if needed
     */
    processUsageEvent(usageEvent: UsageEvent): Promise<void>;
    /**
     * Check user quota and send alerts
     */
    checkQuotaAndAlert(userId: string): Promise<void>;
    /**
     * Send quota alert to user
     */
    private sendQuotaAlert;
    /**
     * Process a billing event (send to payment provider)
     */
    private processBillingEvent;
    /**
     * Send billing event to OpenSaaS
     */
    private sendToOpenSaaS;
    /**
     * Send billing event to Stripe
     */
    private sendToStripe;
    /**
     * Send billing event to LemonSqueezy
     */
    private sendToLemonSqueezy;
    /**
     * Handle quota exceeded scenario
     */
    handleQuotaExceeded(userId: string): Promise<{
        action: 'block' | 'allow_overage' | 'upgrade_prompt';
        message: string;
    }>;
    /**
     * Get subscription information for a user
     */
    getSubscriptionInfo(userId: string): Promise<SubscriptionInfo | null>;
    /**
     * Update subscription information (called from webhooks)
     */
    updateSubscriptionInfo(userId: string, info: Partial<SubscriptionInfo>): Promise<void>;
    /**
     * Get billing analytics
     */
    getBillingAnalytics(startDate?: Date, endDate?: Date): Promise<{
        totalRevenue: number;
        totalPlatformFees: number;
        totalEvents: number;
        eventsByType: Record<string, number>;
        revenueByTier: Record<string, number>;
        topUsers: Array<{
            userId: string;
            revenue: number;
            events: number;
        }>;
    }>;
    /**
     * Process webhook from payment provider
     */
    processWebhook(provider: string, payload: any, signature?: string): Promise<void>;
    /**
     * Verify webhook signature
     */
    private verifyWebhookSignature;
    /**
     * Process OpenSaaS webhook
     */
    private processOpenSaaSWebhook;
    /**
     * Process Stripe webhook
     */
    private processStripeWebhook;
    /**
     * Process LemonSqueezy webhook
     */
    private processLemonSqueezyWebhook;
    /**
     * Handle subscription update
     */
    private handleSubscriptionUpdate;
    /**
     * Handle subscription cancellation
     */
    private handleSubscriptionCancellation;
    /**
     * Handle payment success
     */
    private handlePaymentSuccess;
    /**
     * Handle payment failure
     */
    private handlePaymentFailure;
}
//# sourceMappingURL=billing-engine.d.ts.map