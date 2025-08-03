import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest, SubscriptionTierConfig } from '../auth/jwt-middleware.js';
export interface RateLimits {
    requestsPerMinute: number;
    tokensPerMinute: number;
    concurrentRequests: number;
}
export interface RateLimitConfig {
    redis?: {
        host: string;
        port: number;
        password?: string;
        db?: number;
    };
    redisUrl?: string;
    keyPrefix?: string;
    windowSizeMs?: number;
    enableConcurrencyLimit?: boolean;
    subscriptionTiers?: Record<string, SubscriptionTierConfig>;
}
export interface RateLimitResult {
    allowed: boolean;
    limit: number;
    current: number;
    remaining: number;
    resetTime: number;
    retryAfter?: number;
}
/**
 * Default rate limits per subscription tier
 */
export declare const DEFAULT_TIER_LIMITS: Record<string, RateLimits>;
export declare class RateLimiter {
    private redis;
    private config;
    private keyPrefix;
    private windowSizeMs;
    private enableConcurrencyLimit;
    private memoryStore;
    private concurrentRequests;
    constructor(config?: RateLimitConfig);
    private initializeRedis;
    /**
     * Express middleware for rate limiting
     */
    middleware: () => (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void>;
    /**
     * Check token-based rate limiting after AI request
     */
    checkTokenRateLimit(userId: string, tier: string, estimatedTokens: number): Promise<RateLimitResult>;
    /**
     * Record actual token usage after AI request completion
     */
    recordTokenUsage(userId: string, tier: string, actualTokens: number): Promise<void>;
    /**
     * Get rate limits for a tier (custom or default)
     */
    private getTierLimits;
    /**
     * Get rate limits for a user based on their subscription tier
     */
    private getUserLimits;
    /**
     * Check rate limit using sliding window algorithm
     */
    private checkRateLimit;
    /**
     * Memory-based rate limiting fallback
     */
    private checkRateLimitMemory;
    /**
     * Check concurrent request limits
     */
    private checkConcurrentRequests;
    /**
     * Increment concurrent request counter
     */
    private incrementConcurrentRequests;
    /**
     * Decrement concurrent request counter
     */
    private decrementConcurrentRequests;
    /**
     * Send rate limit exceeded error response
     */
    private sendRateLimitError;
    /**
     * Get current rate limit status for a user
     */
    getRateLimitStatus(userId: string, tier: string): Promise<{
        rpm: RateLimitResult;
        tpm: RateLimitResult;
        concurrent: RateLimitResult;
    }>;
    /**
     * Reset rate limits for a user (admin function)
     */
    resetUserRateLimits(userId: string): Promise<void>;
    /**
     * Clean up expired entries (call periodically)
     */
    cleanup(): Promise<void>;
    /**
     * Close Redis connection
     */
    close(): Promise<void>;
}
//# sourceMappingURL=rate-limiter.d.ts.map