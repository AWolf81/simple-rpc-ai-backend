import { Redis } from 'ioredis';
/**
 * Default rate limits per subscription tier
 */
export const DEFAULT_TIER_LIMITS = {
    starter: {
        requestsPerMinute: 10,
        tokensPerMinute: 1000,
        concurrentRequests: 2
    },
    pro: {
        requestsPerMinute: 100,
        tokensPerMinute: 10000,
        concurrentRequests: 10
    },
    enterprise: {
        requestsPerMinute: 1000,
        tokensPerMinute: 100000,
        concurrentRequests: 50
    },
    // Default for unauthenticated users
    anonymous: {
        requestsPerMinute: 5,
        tokensPerMinute: 500,
        concurrentRequests: 1
    }
};
/**
 * Convert SubscriptionTierConfig to RateLimits
 */
function tierConfigToRateLimits(tierConfig) {
    return {
        requestsPerMinute: tierConfig.rpmLimit,
        tokensPerMinute: tierConfig.tpmLimit,
        concurrentRequests: tierConfig.concurrentRequests || 2
    };
}
export class RateLimiter {
    redis = null;
    config;
    keyPrefix;
    windowSizeMs;
    enableConcurrencyLimit;
    // In-memory fallback for when Redis is not available
    memoryStore = new Map();
    concurrentRequests = new Map();
    constructor(config = {}) {
        this.config = config;
        this.keyPrefix = config.keyPrefix || 'ratelimit:';
        this.windowSizeMs = config.windowSizeMs || 60000; // 1 minute
        this.enableConcurrencyLimit = config.enableConcurrencyLimit ?? true;
        this.initializeRedis();
    }
    async initializeRedis() {
        try {
            if (this.config.redisUrl) {
                this.redis = new Redis(this.config.redisUrl);
            }
            else if (this.config.redis) {
                this.redis = new Redis(this.config.redis);
            }
            else {
                // Try to connect to default Redis instance
                this.redis = new Redis({
                    host: 'localhost',
                    port: 6379,
                    lazyConnect: true,
                    maxRetriesPerRequest: 3
                });
            }
            if (this.redis) {
                // Test connection
                await this.redis.ping();
                console.log('✅ Connected to Redis for rate limiting');
            }
        }
        catch (error) {
            console.warn('⚠️  Redis connection failed, using in-memory rate limiting:', error.message);
            this.redis = null;
        }
    }
    /**
     * Express middleware for rate limiting
     */
    middleware = () => {
        return async (req, res, next) => {
            try {
                // Skip rate limiting for health checks
                if (req.path === '/health' || req.path === '/config') {
                    return next();
                }
                // Get user identifier and limits
                const userId = req.authContext?.userId || req.ip || 'anonymous';
                const tier = req.authContext?.subscriptionTier || 'anonymous';
                const limits = this.getUserLimits(req);
                // Check RPM limit
                const rpmResult = await this.checkRateLimit(`rpm:${userId}`, limits.requestsPerMinute, 1, this.windowSizeMs);
                if (!rpmResult.allowed) {
                    return this.sendRateLimitError(res, 'Request rate limit exceeded', rpmResult);
                }
                // Check concurrent requests limit
                if (this.enableConcurrencyLimit) {
                    const concurrentResult = await this.checkConcurrentRequests(userId, limits.concurrentRequests);
                    if (!concurrentResult.allowed) {
                        return this.sendRateLimitError(res, 'Concurrent request limit exceeded', concurrentResult);
                    }
                    // Track concurrent request
                    this.incrementConcurrentRequests(userId);
                    // Decrement on response finish
                    res.on('finish', () => {
                        this.decrementConcurrentRequests(userId);
                    });
                }
                // Add rate limit headers
                res.set({
                    'X-RateLimit-Limit-RPM': limits.requestsPerMinute.toString(),
                    'X-RateLimit-Remaining-RPM': rpmResult.remaining.toString(),
                    'X-RateLimit-Reset': new Date(rpmResult.resetTime).toISOString()
                });
                // Store request info for token-based rate limiting (checked after AI request)
                req.rateLimitInfo = {
                    userId,
                    tier,
                    limits,
                    rpmResult
                };
                next();
            }
            catch (error) {
                console.error('Rate limiter error:', error);
                // Don't block requests on rate limiter errors
                next();
            }
        };
    };
    /**
     * Check token-based rate limiting after AI request
     */
    async checkTokenRateLimit(userId, tier, estimatedTokens) {
        const limits = this.getTierLimits(tier);
        return this.checkRateLimit(`tpm:${userId}`, limits.tokensPerMinute, estimatedTokens, this.windowSizeMs);
    }
    /**
     * Record actual token usage after AI request completion
     */
    async recordTokenUsage(userId, tier, actualTokens) {
        const limits = this.getTierLimits(tier);
        // Record actual token usage (this might exceed the estimated amount)
        await this.checkRateLimit(`tpm:${userId}`, limits.tokensPerMinute, actualTokens, this.windowSizeMs);
    }
    /**
     * Get rate limits for a tier (custom or default)
     */
    getTierLimits(tier) {
        // Check custom subscription tiers first
        if (this.config.subscriptionTiers && this.config.subscriptionTiers[tier]) {
            return tierConfigToRateLimits(this.config.subscriptionTiers[tier]);
        }
        // Fallback to default tier limits
        return DEFAULT_TIER_LIMITS[tier] || DEFAULT_TIER_LIMITS.anonymous;
    }
    /**
     * Get rate limits for a user based on their subscription tier
     */
    getUserLimits(req) {
        const tier = req.authContext?.subscriptionTier || 'anonymous';
        // Use custom limits from JWT if available
        if (req.authContext?.quotaInfo) {
            const tierLimits = this.getTierLimits(tier);
            return {
                requestsPerMinute: req.authContext.quotaInfo.rpmLimit,
                tokensPerMinute: req.authContext.quotaInfo.tpmLimit,
                concurrentRequests: tierLimits.concurrentRequests
            };
        }
        return this.getTierLimits(tier);
    }
    /**
     * Check rate limit using sliding window algorithm
     */
    async checkRateLimit(key, limit, increment = 1, windowMs = this.windowSizeMs) {
        const now = Date.now();
        const windowStart = now - windowMs;
        const resetTime = now + windowMs;
        const fullKey = `${this.keyPrefix}${key}`;
        if (this.redis) {
            try {
                // Use Lua script for atomic operations
                const luaScript = `
          local key = KEYS[1]
          local now = tonumber(ARGV[1])
          local windowStart = tonumber(ARGV[2])
          local increment = tonumber(ARGV[3])
          local limit = tonumber(ARGV[4])
          local windowMs = tonumber(ARGV[5])
          
          -- Remove expired entries
          redis.call('ZREMRANGEBYSCORE', key, 0, windowStart)
          
          -- Get current count
          local current = redis.call('ZCARD', key)
          
          -- Check if adding increment would exceed limit
          if current + increment > limit then
            local resetTime = now + windowMs
            return {0, limit, current, limit - current, resetTime}
          end
          
          -- Add current request(s)
          for i = 1, increment do
            redis.call('ZADD', key, now + i, now + i)
          end
          
          -- Set expiration
          redis.call('EXPIRE', key, math.ceil(windowMs / 1000))
          
          local newCurrent = current + increment
          local remaining = limit - newCurrent
          local resetTime = now + windowMs
          
          return {1, limit, newCurrent, remaining, resetTime}
        `;
                const result = await this.redis.eval(luaScript, 1, fullKey, now.toString(), windowStart.toString(), increment.toString(), limit.toString(), windowMs.toString());
                return {
                    allowed: result[0] === 1,
                    limit: result[1],
                    current: result[2],
                    remaining: result[3],
                    resetTime: result[4],
                    retryAfter: result[0] === 0 ? Math.ceil((result[4] - now) / 1000) : undefined
                };
            }
            catch (error) {
                console.error('Redis rate limit error:', error);
                // Fallback to memory store
            }
        }
        // Memory-based fallback
        return this.checkRateLimitMemory(fullKey, limit, increment, windowMs, now, resetTime);
    }
    /**
     * Memory-based rate limiting fallback
     */
    checkRateLimitMemory(key, limit, increment, windowMs, now, resetTime) {
        const record = this.memoryStore.get(key);
        if (!record || now >= record.resetTime) {
            // Create new record
            const newRecord = {
                count: increment,
                resetTime,
                tokens: increment
            };
            this.memoryStore.set(key, newRecord);
            return {
                allowed: increment <= limit,
                limit,
                current: increment,
                remaining: Math.max(0, limit - increment),
                resetTime,
                retryAfter: increment > limit ? Math.ceil(windowMs / 1000) : undefined
            };
        }
        // Update existing record
        const newCount = record.count + increment;
        if (newCount > limit) {
            return {
                allowed: false,
                limit,
                current: record.count,
                remaining: Math.max(0, limit - record.count),
                resetTime: record.resetTime,
                retryAfter: Math.ceil((record.resetTime - now) / 1000)
            };
        }
        record.count = newCount;
        this.memoryStore.set(key, record);
        return {
            allowed: true,
            limit,
            current: newCount,
            remaining: Math.max(0, limit - newCount),
            resetTime: record.resetTime
        };
    }
    /**
     * Check concurrent request limits
     */
    async checkConcurrentRequests(userId, limit) {
        const current = this.concurrentRequests.get(userId) || 0;
        if (current >= limit) {
            return {
                allowed: false,
                limit,
                current,
                remaining: 0,
                resetTime: Date.now() + 1000, // Retry after 1 second
                retryAfter: 1
            };
        }
        return {
            allowed: true,
            limit,
            current,
            remaining: limit - current,
            resetTime: Date.now() + 60000 // 1 minute from now
        };
    }
    /**
     * Increment concurrent request counter
     */
    incrementConcurrentRequests(userId) {
        const current = this.concurrentRequests.get(userId) || 0;
        this.concurrentRequests.set(userId, current + 1);
    }
    /**
     * Decrement concurrent request counter
     */
    decrementConcurrentRequests(userId) {
        const current = this.concurrentRequests.get(userId) || 0;
        if (current <= 1) {
            this.concurrentRequests.delete(userId);
        }
        else {
            this.concurrentRequests.set(userId, current - 1);
        }
    }
    /**
     * Send rate limit exceeded error response
     */
    sendRateLimitError(res, message, result) {
        res.status(429).json({
            error: {
                code: -32002,
                message,
                data: {
                    limit: result.limit,
                    current: result.current,
                    remaining: result.remaining,
                    resetTime: new Date(result.resetTime).toISOString(),
                    retryAfter: result.retryAfter
                }
            }
        });
    }
    /**
     * Get current rate limit status for a user
     */
    async getRateLimitStatus(userId, tier) {
        const limits = this.getTierLimits(tier);
        // Check current status without incrementing
        const [rpmResult, tpmResult] = await Promise.all([
            this.checkRateLimit(`rpm:${userId}`, limits.requestsPerMinute, 0),
            this.checkRateLimit(`tpm:${userId}`, limits.tokensPerMinute, 0)
        ]);
        const concurrentResult = await this.checkConcurrentRequests(userId, limits.concurrentRequests);
        return {
            rpm: rpmResult,
            tpm: tpmResult,
            concurrent: concurrentResult
        };
    }
    /**
     * Reset rate limits for a user (admin function)
     */
    async resetUserRateLimits(userId) {
        const keys = [
            `${this.keyPrefix}rpm:${userId}`,
            `${this.keyPrefix}tpm:${userId}`
        ];
        if (this.redis) {
            await this.redis.del(...keys);
        }
        else {
            for (const key of keys) {
                this.memoryStore.delete(key);
            }
        }
        // Reset concurrent requests
        this.concurrentRequests.delete(userId);
    }
    /**
     * Clean up expired entries (call periodically)
     */
    async cleanup() {
        const now = Date.now();
        // Clean memory store
        for (const [key, record] of this.memoryStore.entries()) {
            if (now >= record.resetTime) {
                this.memoryStore.delete(key);
            }
        }
        // Redis cleanup is handled by expiration
    }
    /**
     * Close Redis connection
     */
    async close() {
        if (this.redis) {
            await this.redis.quit();
        }
    }
}
//# sourceMappingURL=rate-limiter.js.map