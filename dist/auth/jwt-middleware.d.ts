import type { Request, Response, NextFunction } from 'express';
export interface OpenSaaSJWTPayload {
    userId: string;
    email: string;
    organizationId?: string;
    subscriptionTier: string;
    monthlyTokenQuota: number;
    rpmLimit: number;
    tpmLimit: number;
    features: string[];
    iat: number;
    exp: number;
    iss: string;
    aud: string;
}
export interface AuthenticatedRequest extends Request {
    user?: OpenSaaSJWTPayload;
    authContext?: {
        type: 'opensaas';
        userId: string;
        email: string;
        organizationId?: string;
        subscriptionTier: string;
        quotaInfo: {
            monthlyTokenQuota: number;
            rpmLimit: number;
            tpmLimit: number;
        };
        features: string[];
    };
}
export interface SubscriptionTierConfig {
    name: string;
    monthlyTokenQuota: number;
    rpmLimit: number;
    tpmLimit: number;
    features: string[];
    concurrentRequests?: number;
}
export interface JWTMiddlewareConfig {
    opensaasPublicKey: string;
    audience: string;
    issuer: string;
    skipAuthForMethods?: string[];
    requireAuthForAllMethods?: boolean;
    clockTolerance?: number;
    subscriptionTiers?: Record<string, SubscriptionTierConfig>;
}
export declare class JWTMiddleware {
    private config;
    constructor(config: JWTMiddlewareConfig);
    /**
     * Express middleware to validate OpenSaaS JWT tokens
     */
    authenticate: (req: AuthenticatedRequest, res: Response, next: NextFunction) => void;
    /**
     * Validate JWT token and return payload
     */
    validateToken(token: string): OpenSaaSJWTPayload;
    /**
     * Extract user context from authenticated request
     */
    static getUserContext(req: AuthenticatedRequest): OpenSaaSJWTPayload | null;
    /**
     * Check if user has specific feature access
     */
    static hasFeature(req: AuthenticatedRequest, feature: string): boolean;
    /**
     * Check if user has sufficient subscription tier
     */
    static hasSubscriptionTier(req: AuthenticatedRequest, requiredTier: string, tierConfigs?: Record<string, SubscriptionTierConfig>): boolean;
    /**
     * Get user's quota information
     */
    static getQuotaInfo(req: AuthenticatedRequest): {
        monthlyTokenQuota: number;
        rpmLimit: number;
        tpmLimit: number;
    } | null;
}
/**
 * Default subscription tier limits for fallback scenarios
 */
export declare const DEFAULT_TIER_CONFIGS: Record<string, SubscriptionTierConfig>;
/**
 * Utility function to get tier configuration (custom or default)
 */
export declare function getTierConfig(tier: string, customTiers?: Record<string, SubscriptionTierConfig>): SubscriptionTierConfig | null;
/**
 * Utility function to merge custom tiers with defaults
 */
export declare function mergeWithDefaultTiers(customTiers?: Record<string, SubscriptionTierConfig>): Record<string, SubscriptionTierConfig>;
//# sourceMappingURL=jwt-middleware.d.ts.map