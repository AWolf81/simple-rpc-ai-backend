/**
 * Seamless OpenSaaS Integration
 *
 * Just provide webhook URL + secret, everything else works automatically
 * Auto-discovers user accounts, handles billing, manages credits
 */
import { HybridBillingManager, UserBillingPreference, UsageRecord } from './hybrid-billing-manager.js';
export interface SeamlessOpenSaaSConfig {
    webhookUrl: string;
    webhookSecret: string;
    defaultCredits?: number;
    maxCredits?: number;
    lowBalanceThreshold?: number;
}
export interface OpenSaaSWebhookEvent {
    type: 'user.created' | 'payment.completed' | 'subscription.updated' | 'credits.purchased' | 'user.updated';
    userId: string;
    data: any;
    timestamp: string;
}
export declare class SeamlessOpenSaaSIntegration {
    private config;
    private userCache;
    constructor(config: SeamlessOpenSaaSConfig);
    /**
     * Auto-register webhook handler (call this in your server setup)
     */
    registerWebhookHandler(app: any, billingManager: HybridBillingManager): void;
    /**
     * Create webhook handler middleware
     */
    private createWebhookHandler;
    /**
     * Handle different webhook events automatically
     */
    private handleWebhookEvent;
    /**
     * Auto-create user billing when they sign up in OpenSaaS
     */
    private handleUserCreated;
    /**
     * Auto-add credits when user makes payment
     */
    private handleCreditsAdded;
    /**
     * Auto-update user settings when subscription changes
     */
    private handleSubscriptionUpdated;
    /**
     * Auto-sync user profile changes
     */
    private handleUserUpdated;
    /**
     * Verify webhook signature automatically
     */
    private verifyWebhookSignature;
    /**
     * Auto-implement OpenSaaS client interface
     */
    createOpenSaaSClient(): {
        getUserBilling(userId: string): Promise<UserBillingPreference | null>;
        updateUserBilling(userId: string, updates: Partial<UserBillingPreference>): Promise<void>;
        recordUsage(userId: string, usage: UsageRecord): Promise<void>;
        checkBalance(userId: string): Promise<{
            balance: number;
            isActive: boolean;
        }>;
    };
    /**
     * Async usage reporting (doesn't block AI requests)
     */
    private reportUsageAsync;
    /**
     * Auto-setup billing routes
     */
    setupBillingRoutes(app: any, billingManager: HybridBillingManager): void;
    /**
     * Get configuration summary
     */
    getConfig(): {
        webhookUrl: string;
        defaultCredits: number | undefined;
        maxCredits: number | undefined;
        lowBalanceThreshold: number | undefined;
        featuresEnabled: string[];
    };
}
//# sourceMappingURL=opensaas-integration.d.ts.map