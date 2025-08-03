/**
 * Default OpenSaaS monetization configuration
 */
export const DEFAULT_OPENSAAS_CONFIG = {
    authentication: {
        requireAuthForAllMethods: false,
        skipAuthForMethods: ['health', 'rpc.discover']
    },
    usageTracking: {
        enableDetailedLogging: true,
        retentionDays: 90
    },
    quotaManagement: {
        warningThresholds: [80, 95],
        enableOverageCharges: true,
        maxOveragePercentage: 20
    },
    billing: {
        platformFee: {
            percentage: 20, // 20% platform fee
            minimumFee: 0.01 // Minimum $0.01 fee
        },
        billingProvider: 'opensaas',
        enableUsageBasedBilling: true,
        quotaWarningThresholds: [80, 95]
    },
    rateLimiting: {
        windowSizeMs: 60000, // 1 minute
        enableConcurrencyLimit: true,
        keyPrefix: 'ratelimit:'
    }
};
/**
 * Example custom subscription tiers configuration
 */
export const EXAMPLE_CUSTOM_TIERS = {
    // Free tier
    free: {
        name: 'Free',
        monthlyTokenQuota: 1000,
        rpmLimit: 5,
        tpmLimit: 100,
        concurrentRequests: 1,
        features: ['basic_ai']
    },
    // Basic tier
    basic: {
        name: 'Basic',
        monthlyTokenQuota: 10000,
        rpmLimit: 20,
        tpmLimit: 2000,
        concurrentRequests: 3,
        features: ['basic_ai', 'email_support']
    },
    // Premium tier
    premium: {
        name: 'Premium',
        monthlyTokenQuota: 100000,
        rpmLimit: 200,
        tpmLimit: 20000,
        concurrentRequests: 15,
        features: ['basic_ai', 'advanced_ai', 'priority_support', 'analytics']
    },
    // Business tier
    business: {
        name: 'Business',
        monthlyTokenQuota: 500000,
        rpmLimit: 500,
        tpmLimit: 50000,
        concurrentRequests: 25,
        features: ['basic_ai', 'advanced_ai', 'priority_support', 'analytics', 'custom_models', 'sla']
    },
    // Enterprise tier
    enterprise: {
        name: 'Enterprise',
        monthlyTokenQuota: 2000000,
        rpmLimit: 2000,
        tpmLimit: 200000,
        concurrentRequests: 100,
        features: ['basic_ai', 'advanced_ai', 'priority_support', 'analytics', 'custom_models', 'sla', 'dedicated_support']
    }
};
/**
 * Merge user configuration with defaults
 */
export function mergeOpenSaaSConfig(userConfig) {
    return {
        ...DEFAULT_OPENSAAS_CONFIG,
        ...userConfig,
        authentication: {
            ...DEFAULT_OPENSAAS_CONFIG.authentication,
            ...userConfig.authentication
        },
        usageTracking: {
            ...DEFAULT_OPENSAAS_CONFIG.usageTracking,
            ...userConfig.usageTracking
        },
        quotaManagement: {
            ...DEFAULT_OPENSAAS_CONFIG.quotaManagement,
            ...userConfig.quotaManagement
        },
        billing: {
            ...DEFAULT_OPENSAAS_CONFIG.billing,
            ...userConfig.billing,
            platformFee: {
                ...DEFAULT_OPENSAAS_CONFIG.billing.platformFee,
                ...userConfig.billing.platformFee
            }
        },
        rateLimiting: {
            ...DEFAULT_OPENSAAS_CONFIG.rateLimiting,
            ...userConfig.rateLimiting
        }
    };
}
/**
 * Validate OpenSaaS configuration
 */
export function validateOpenSaaSConfig(config) {
    if (!config.opensaas) {
        throw new Error('OpenSaaS configuration is required');
    }
    if (!config.opensaas.publicKey) {
        throw new Error('OpenSaaS public key is required');
    }
    if (!config.opensaas.audience) {
        throw new Error('OpenSaaS audience is required');
    }
    if (!config.opensaas.issuer) {
        throw new Error('OpenSaaS issuer is required');
    }
    if (!config.billing) {
        throw new Error('Billing configuration is required');
    }
    if (!config.billing.platformFee || typeof config.billing.platformFee.percentage !== 'number') {
        throw new Error('Platform fee percentage is required');
    }
    if (config.billing.platformFee.percentage < 0 || config.billing.platformFee.percentage > 100) {
        throw new Error('Platform fee percentage must be between 0 and 100');
    }
    // Validate custom subscription tiers if provided
    if (config.subscriptionTiers) {
        for (const [tierName, tierConfig] of Object.entries(config.subscriptionTiers)) {
            if (!tierConfig.name) {
                throw new Error(`Subscription tier '${tierName}' must have a name`);
            }
            if (typeof tierConfig.monthlyTokenQuota !== 'number' || tierConfig.monthlyTokenQuota < 0) {
                throw new Error(`Subscription tier '${tierName}' must have a valid monthly token quota`);
            }
            if (typeof tierConfig.rpmLimit !== 'number' || tierConfig.rpmLimit < 0) {
                throw new Error(`Subscription tier '${tierName}' must have a valid RPM limit`);
            }
            if (typeof tierConfig.tpmLimit !== 'number' || tierConfig.tpmLimit < 0) {
                throw new Error(`Subscription tier '${tierName}' must have a valid TPM limit`);
            }
            if (!Array.isArray(tierConfig.features)) {
                throw new Error(`Subscription tier '${tierName}' must have a features array`);
            }
        }
    }
}
/**
 * Helper function to create a simple OpenSaaS config
 */
export function createOpenSaaSConfig(params) {
    const config = {
        opensaas: {
            publicKey: params.opensaasPublicKey,
            audience: params.audience,
            issuer: params.issuer
        },
        billing: {
            platformFee: {
                percentage: params.platformFeePercentage || 20
            },
            billingProvider: params.billingProvider || 'opensaas',
            enableUsageBasedBilling: true,
            quotaWarningThresholds: [80, 95]
        }
    };
    if (params.customTiers) {
        config.subscriptionTiers = params.customTiers;
    }
    if (params.redisUrl) {
        config.rateLimiting = {
            redisUrl: params.redisUrl,
            windowSizeMs: 60000,
            enableConcurrencyLimit: true
        };
    }
    return mergeOpenSaaSConfig(config);
}
//# sourceMappingURL=opensaas-config.js.map