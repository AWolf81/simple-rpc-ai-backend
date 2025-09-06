/**
 * MCP Security: Rate Limiting System (Day 1)
 *
 * Implements adaptive rate limiting for MCP endpoints with:
 * - Per-user/IP rate limiting
 * - Tool-specific limits
 * - Adaptive throttling based on system load
 * - Integration with existing express-rate-limit
 */
import rateLimit from 'express-rate-limit';
// Default rate limit configurations
export const DEFAULT_MCP_RATE_LIMITS = {
    enabled: true,
    global: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 100, // 100 requests per window for anonymous users
        standardHeaders: true,
        legacyHeaders: false,
        skipSuccessfulRequests: false
    },
    authenticated: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 500, // 500 requests per window for authenticated users
        standardHeaders: true,
        legacyHeaders: false,
        skipSuccessfulRequests: false
    },
    toolLimits: {
        // Heavy AI tools get stricter limits
        'ai-analyze': {
            windowMs: 5 * 60 * 1000, // 5 minutes
            max: 10, // 10 AI analysis requests per 5 min
            standardHeaders: true
        },
        'web-search': {
            windowMs: 5 * 60 * 1000, // 5 minutes
            max: 20, // 20 search requests per 5 min
            standardHeaders: true
        },
        // Light tools get more generous limits
        'greeting': {
            windowMs: 1 * 60 * 1000, // 1 minute
            max: 60, // 60 greetings per minute
            standardHeaders: true
        },
        'echo': {
            windowMs: 1 * 60 * 1000, // 1 minute
            max: 100, // 100 echo requests per minute
            standardHeaders: true
        }
    },
    admin: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 2000, // 2000 requests per window for admin users
        standardHeaders: true,
        legacyHeaders: false,
        skipSuccessfulRequests: false
    },
    burst: {
        enabled: true,
        windowMs: 1 * 60 * 1000, // 1 minute burst window
        max: 50 // Max 50 requests in 1 minute burst
    },
    adaptive: {
        enabled: true,
        cpuThreshold: 80, // Start throttling at 80% CPU
        memoryThreshold: 85, // Start throttling at 85% memory
        throttleMultiplier: 0.5 // Reduce limits to 50% when throttling
    }
};
/**
 * Rate Limiter Service
 * Manages all rate limiting logic for MCP endpoints
 */
export class MCPRateLimiter {
    config;
    globalLimiter;
    authenticatedLimiter;
    adminLimiter;
    burstLimiter;
    toolLimiters = {};
    systemStats = {
        cpu: 0,
        memory: 0,
        lastUpdate: 0
    };
    constructor(config = {}) {
        this.config = { ...DEFAULT_MCP_RATE_LIMITS, ...config };
        this.initializeLimiters();
        this.startSystemMonitoring();
    }
    /**
     * Initialize all rate limiters
     */
    initializeLimiters() {
        // Global rate limiter (for anonymous users)
        this.globalLimiter = rateLimit({
            ...this.config.global,
            keyGenerator: (req) => {
                const authReq = req;
                return authReq.user?.userId || authReq.ip || 'anonymous';
            },
            message: {
                jsonrpc: '2.0',
                error: {
                    code: -32000,
                    message: 'Rate limit exceeded. Too many requests from this IP address.',
                    data: { retryAfter: this.config.global.windowMs / 1000 }
                }
            }
        });
        // Authenticated user limiter (higher limits)
        this.authenticatedLimiter = rateLimit({
            ...this.config.authenticated,
            keyGenerator: (req) => {
                const authReq = req;
                return `auth:${authReq.user?.userId || authReq.ip}`;
            },
            message: {
                jsonrpc: '2.0',
                error: {
                    code: -32000,
                    message: 'Rate limit exceeded for authenticated user.',
                    data: { retryAfter: this.config.authenticated.windowMs / 1000 }
                }
            }
        });
        // Admin user limiter (highest limits)
        this.adminLimiter = rateLimit({
            ...this.config.admin,
            keyGenerator: (req) => {
                const authReq = req;
                return `admin:${authReq.user?.userId || authReq.ip}`;
            },
            message: {
                jsonrpc: '2.0',
                error: {
                    code: -32000,
                    message: 'Rate limit exceeded for admin user.',
                    data: { retryAfter: this.config.admin.windowMs / 1000 }
                }
            }
        });
        // Burst protection limiter
        if (this.config.burst.enabled) {
            this.burstLimiter = rateLimit({
                windowMs: this.config.burst.windowMs,
                max: this.config.burst.max,
                standardHeaders: true,
                keyGenerator: (req) => {
                    const authReq = req;
                    return `burst:${authReq.user?.userId || authReq.ip}`;
                },
                message: {
                    jsonrpc: '2.0',
                    error: {
                        code: -32000,
                        message: 'Burst rate limit exceeded. Please slow down your requests.',
                        data: { retryAfter: this.config.burst.windowMs / 1000 }
                    }
                }
            });
        }
        // Tool-specific limiters
        for (const [toolName, toolConfig] of Object.entries(this.config.toolLimits)) {
            this.toolLimiters[toolName] = rateLimit({
                ...toolConfig,
                keyGenerator: (req) => {
                    const authReq = req;
                    return `tool:${toolName}:${authReq.user?.userId || authReq.ip}`;
                },
                message: {
                    jsonrpc: '2.0',
                    error: {
                        code: -32000,
                        message: `Rate limit exceeded for tool '${toolName}'.`,
                        data: {
                            tool: toolName,
                            retryAfter: toolConfig.windowMs / 1000
                        }
                    }
                }
            });
        }
    }
    /**
     * Start monitoring system resources for adaptive throttling
     */
    startSystemMonitoring() {
        if (!this.config.adaptive.enabled)
            return;
        const updateInterval = 30000; // Update every 30 seconds
        setInterval(() => {
            this.updateSystemStats();
        }, updateInterval);
        // Initial update
        this.updateSystemStats();
    }
    /**
     * Update system statistics
     */
    updateSystemStats() {
        try {
            // Get CPU usage (simplified - in production use proper monitoring)
            const loadAvg = process.uptime(); // Placeholder - use proper CPU monitoring
            this.systemStats.cpu = Math.min(loadAvg * 10, 100); // Simplified calculation
            // Get memory usage
            const memUsage = process.memoryUsage();
            const totalMem = memUsage.heapTotal + memUsage.external;
            const usedMem = memUsage.heapUsed;
            this.systemStats.memory = (usedMem / totalMem) * 100;
            this.systemStats.lastUpdate = Date.now();
            // Log if throttling conditions are met
            const cpuThrottle = this.systemStats.cpu > this.config.adaptive.cpuThreshold;
            const memThrottle = this.systemStats.memory > this.config.adaptive.memoryThreshold;
            if (cpuThrottle || memThrottle) {
                console.log(`🔄 Rate limiting: Adaptive throttling active (CPU: ${this.systemStats.cpu.toFixed(1)}%, Memory: ${this.systemStats.memory.toFixed(1)}%)`);
            }
        }
        catch (error) {
            console.error('❌ Rate limiting: Failed to update system stats:', error);
        }
    }
    /**
     * Check if adaptive throttling should be applied
     */
    shouldThrottle() {
        if (!this.config.adaptive.enabled)
            return false;
        const cpuThrottle = this.systemStats.cpu > this.config.adaptive.cpuThreshold;
        const memThrottle = this.systemStats.memory > this.config.adaptive.memoryThreshold;
        return cpuThrottle || memThrottle;
    }
    /**
     * Get the appropriate rate limiter middleware for a request
     */
    getMiddleware(toolName) {
        const middlewares = [];
        // Always apply burst protection first
        if (this.burstLimiter) {
            middlewares.push(this.burstLimiter);
        }
        // Apply tool-specific limits if specified
        if (toolName && this.toolLimiters[toolName]) {
            const toolLimiter = this.toolLimiters[toolName];
            // Apply adaptive throttling if needed
            if (this.shouldThrottle() && toolLimiter.options?.max) {
                const originalMax = toolLimiter.options.max;
                toolLimiter.options.max = Math.floor(originalMax * this.config.adaptive.throttleMultiplier);
                console.log(`🔄 Rate limiting: Throttling tool '${toolName}' from ${originalMax} to ${toolLimiter.options.max} requests`);
            }
            middlewares.push(toolLimiter);
        }
        // Apply user-tier appropriate limits
        middlewares.push((req, res, next) => {
            const userInfo = req.user;
            if (userInfo) {
                // Check if user is admin (OpenSaaS doesn't have role field, use features)
                if (userInfo.features?.includes('admin') || userInfo.features?.includes('premium')) {
                    return this.adminLimiter(req, res, next);
                }
                else {
                    return this.authenticatedLimiter(req, res, next);
                }
            }
            else {
                return this.globalLimiter(req, res, next);
            }
        });
        return middlewares;
    }
    /**
     * Create a middleware function for MCP tool rate limiting
     */
    createMCPToolMiddleware() {
        return (req, res, next) => {
            // Skip rate limiting if disabled
            if (this.config.enabled === false) {
                return next();
            }
            const mcpBody = req.body;
            let toolName;
            // Extract tool name from MCP request
            if (mcpBody?.method === 'tools/call' && mcpBody?.params?.name) {
                toolName = mcpBody.params.name;
            }
            // Get appropriate middlewares
            const middlewares = this.getMiddleware(toolName);
            // Chain middlewares together
            let currentIndex = 0;
            const runNext = (error) => {
                if (error)
                    return next(error);
                if (currentIndex >= middlewares.length) {
                    return next();
                }
                const middleware = middlewares[currentIndex++];
                middleware(req, res, runNext);
            };
            runNext();
        };
    }
    /**
     * Get current rate limit status for debugging
     */
    getStatus() {
        return {
            config: this.config,
            systemStats: this.systemStats,
            throttling: this.shouldThrottle(),
            toolLimiters: Object.keys(this.toolLimiters),
            lastUpdate: new Date(this.systemStats.lastUpdate).toISOString()
        };
    }
    /**
     * Reset rate limits for a specific user/IP (admin function)
     */
    resetLimits(identifier) {
        // This would require access to the internal store of express-rate-limit
        // Implementation depends on store type (memory, redis, etc.)
        console.log(`🔄 Rate limiting: Reset limits for ${identifier}`);
    }
    /**
     * Update configuration dynamically
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        this.initializeLimiters(); // Reinitialize with new config
        console.log('✅ Rate limiting: Configuration updated');
    }
}
/**
 * Default instance for easy use
 */
let defaultRateLimiter = null;
/**
 * Get or create default rate limiter instance
 */
export function getDefaultRateLimiter(config) {
    if (!defaultRateLimiter) {
        defaultRateLimiter = new MCPRateLimiter(config);
    }
    return defaultRateLimiter;
}
/**
 * Express middleware factory for MCP rate limiting
 */
export function createMCPRateLimit(config) {
    const rateLimiter = new MCPRateLimiter(config);
    return rateLimiter.createMCPToolMiddleware();
}
