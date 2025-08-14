import type { SubscriptionTierConfig } from '../auth/jwt-middleware.js';
import type { BillingConfig } from '../billing/billing-engine.js';
import type { RateLimitConfig } from '../middleware/rate-limiter.js';
/**
 * OpenSaaS monetization configuration for the AI server
 */
export interface OpenSaaSMonetizationConfig {
    opensaas: {
        publicKey: string;
        audience: string;
        issuer: string;
        clockTolerance?: number;
    };
    subscriptionTiers?: Record<string, SubscriptionTierConfig>;
    billing: BillingConfig;
    rateLimiting?: RateLimitConfig;
    authentication?: {
        requireAuthForAllMethods?: boolean;
        skipAuthForMethods?: string[];
    };
    usageTracking?: {
        enableDetailedLogging?: boolean;
        retentionDays?: number;
    };
    quotaManagement?: {
        warningThresholds?: number[];
        enableOverageCharges?: boolean;
        maxOveragePercentage?: number;
    };
    webhooks?: {
        opensaasWebhookUrl?: string;
        stripeWebhookSecret?: string;
        lemonsqueezyWebhookSecret?: string;
    };
}
/**
 * Extended AI server configuration with OpenSaaS monetization
 */
export interface MonetizedAIServerConfig {
    port?: number;
    database?: {
        type?: 'sqlite' | 'postgresql' | 'mysql';
        connectionString?: string;
        path?: string;
        host?: string;
        port?: number;
        database?: string;
        user?: string;
        password?: string;
        ssl?: boolean;
    };
    serviceProviders?: any;
    cors?: {
        origin?: string | string[];
        credentials?: boolean;
    };
    systemPrompts?: Record<string, any>;
    opensaasMonetization?: OpenSaaSMonetizationConfig;
    requireAuth?: boolean;
    rateLimit?: {
        windowMs?: number;
        max?: number;
    };
}
/**
 * Default OpenSaaS monetization configuration
 */
export declare const DEFAULT_OPENSAAS_CONFIG: Partial<OpenSaaSMonetizationConfig>;
/**
 * Example custom subscription tiers configuration
 */
export declare const EXAMPLE_CUSTOM_TIERS: Record<string, SubscriptionTierConfig>;
/**
 * Merge user configuration with defaults
 */
export declare function mergeOpenSaaSConfig(userConfig: OpenSaaSMonetizationConfig): OpenSaaSMonetizationConfig;
/**
 * Validate OpenSaaS configuration
 */
export declare function validateOpenSaaSConfig(config: OpenSaaSMonetizationConfig): void;
/**
 * Helper function to create a simple OpenSaaS config
 */
export declare function createOpenSaaSConfig(params: {
    opensaasPublicKey: string;
    audience: string;
    issuer: string;
    customTiers?: Record<string, SubscriptionTierConfig>;
    platformFeePercentage?: number;
    redisUrl?: string;
    billingProvider?: 'opensaas' | 'stripe' | 'lemonsqueezy';
}): OpenSaaSMonetizationConfig;
//# sourceMappingURL=opensaas-config.d.ts.map