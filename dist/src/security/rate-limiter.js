/**
 * MCP Security: Rate Limiting System (Day 1)
 *
 * Implements adaptive rate limiting for MCP endpoints with:
 * - Per-user/IP rate limiting
 * - Tool-specific limits
 * - Adaptive throttling based on system load using Node.js built-ins
 * - Integration with existing express-rate-limit
 *
 * System Monitoring:
 * - Uses process.cpuUsage() and process.memoryUsage() (available since Node.js v6.1.0)
 * - For monitoring external/child processes, consider using 'pidusage' library
 * - Current implementation monitors this Node.js process only
 */
import rateLimit from 'express-rate-limit';
import os from 'os';
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
    toolLimiterConfigs = {}; // Store original max values
    systemStats = {
        cpu: 0,
        memory: 0,
        lastUpdate: 0
    };
    lastCpuUsage = null;
    lastCpuMeasurementTime = 0;
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
            // Store original max value for throttling
            this.toolLimiterConfigs[toolName] = { originalMax: toolConfig.max };
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
     * Update system statistics using Node.js built-in process.cpuUsage() and process.memoryUsage()
     */
    updateSystemStats() {
        try {
            // Get CPU usage using Node.js built-in process.cpuUsage()
            const currentCpuUsage = process.cpuUsage();
            const currentTime = Date.now();
            let debugInfo = { totalCpuDiff: 0, timeDiff: 0 };
            if (this.lastCpuUsage && this.lastCpuMeasurementTime) {
                // Calculate CPU percentage based on difference since last measurement
                const userDiff = currentCpuUsage.user - this.lastCpuUsage.user;
                const systemDiff = currentCpuUsage.system - this.lastCpuUsage.system;
                const totalCpuDiff = userDiff + systemDiff; // in microseconds
                // Calculate time difference in milliseconds, then convert to microseconds
                const timeDiff = (currentTime - this.lastCpuMeasurementTime) * 1000; // μs
                // Store debug info
                debugInfo = { totalCpuDiff, timeDiff };
                // Calculate CPU percentage: (CPU time used / real time elapsed) * 100
                // process.cpuUsage() returns values in microseconds
                const cpuPercent = (totalCpuDiff / timeDiff) * 100;
                this.systemStats.cpu = Math.min(Math.max(cpuPercent, 0), 100);
            }
            else {
                this.systemStats.cpu = 0; // First measurement, no baseline
            }
            this.lastCpuUsage = currentCpuUsage;
            this.lastCpuMeasurementTime = currentTime;
            // Get memory usage using Node.js built-in process.memoryUsage()
            const memUsage = process.memoryUsage();
            // Option 1: System-wide memory percentage (recommended for system load monitoring)
            const totalSystemMemory = os.totalmem();
            const freeSystemMemory = os.freemem();
            const usedSystemMemory = totalSystemMemory - freeSystemMemory;
            this.systemStats.memory = (usedSystemMemory / totalSystemMemory) * 100;
            // Option 2: Process-specific memory (uncomment if you prefer process-level monitoring)
            // this.systemStats.memory = (memUsage.heapUsed / memUsage.heapTotal) * 100;
            this.systemStats.lastUpdate = Date.now();
            // Log if throttling conditions are met (with proper formatting)
            const cpuThrottle = this.systemStats.cpu > this.config.adaptive.cpuThreshold;
            const memThrottle = this.systemStats.memory > this.config.adaptive.memoryThreshold;
            if (cpuThrottle || memThrottle) {
                console.log(`🔄 Rate limiting: Adaptive throttling active (CPU: ${this.systemStats.cpu.toFixed(1)}%, Memory: ${this.systemStats.memory.toFixed(1)}%)`);
                console.log(`   CPU measurement: ${debugInfo.totalCpuDiff}μs over ${debugInfo.timeDiff}μs = ${this.systemStats.cpu.toFixed(2)}%`);
            }
        }
        catch (error) {
            console.error('❌ Rate limiting: Failed to update system stats:', error);
        }
    }
    /**
     * Check if adaptive throttling should be applied
     *
     * CURRENT BEHAVIOR:
     * - Reduces rate limits by throttleMultiplier (e.g., 50% reduction)
     * - Only affects tool-specific rate limits
     * - Logs throttling action but no other measures
     *
     * BETTER MEASURES FOR LOAD REDUCTION:
     * 1. Request Prioritization: Process authenticated/premium users first
     * 2. Response Compression: Enable gzip for large AI responses
     * 3. Request Queuing: Queue non-critical requests during high load
     * 4. Graceful Degradation: Return simpler/cached responses
     * 5. Circuit Breaking: Temporarily disable expensive operations
     * 6. Load Shedding: Drop lowest-priority requests
     */
    shouldThrottle() {
        if (!this.config.adaptive.enabled)
            return false;
        const cpuThrottle = this.systemStats.cpu > this.config.adaptive.cpuThreshold;
        const memThrottle = this.systemStats.memory > this.config.adaptive.memoryThreshold;
        return cpuThrottle || memThrottle;
    }
    /**
     * Get load reduction level based on current system stress
     * Returns 0-3 indicating severity of load reduction needed
     */
    getLoadReductionLevel() {
        const cpuStress = this.systemStats.cpu / this.config.adaptive.cpuThreshold;
        const memStress = this.systemStats.memory / this.config.adaptive.memoryThreshold;
        const maxStress = Math.max(cpuStress, memStress);
        if (maxStress < 1.0)
            return 0; // No load reduction needed
        if (maxStress < 1.2)
            return 1; // Light throttling
        if (maxStress < 1.5)
            return 2; // Moderate throttling  
        return 3; // Aggressive throttling
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
        if (toolName && this.toolLimiters[toolName] && this.toolLimiterConfigs[toolName]) {
            const toolLimiter = this.toolLimiters[toolName];
            const toolConfig = this.toolLimiterConfigs[toolName];
            // Apply graduated throttling based on system load
            const loadLevel = this.getLoadReductionLevel();
            if (loadLevel > 0) {
                const originalMax = toolConfig.originalMax;
                // Graduated throttling multipliers
                const multipliers = [1.0, 0.8, 0.6, 0.4]; // Level 0-3
                const newMax = Math.floor(originalMax * multipliers[loadLevel]);
                console.log(`🔄 Rate limiting: Load level ${loadLevel} - throttling tool '${toolName}' from ${originalMax} to ${newMax} requests`);
                // Create a new rate limiter with throttled limits
                const throttledLimiter = rateLimit({
                    ...this.config.toolLimits[toolName],
                    max: newMax,
                    keyGenerator: (req) => {
                        const authReq = req;
                        return `tool:${toolName}:${authReq.user?.userId || authReq.ip}`;
                    },
                    // onLimitReached is deprecated in v7, use handler function instead
                    handler: (req, res) => {
                        res.set('X-Load-Level', loadLevel.toString());
                        res.set('X-Retry-After', '60'); // Suggest retry after 1 minute
                        res.status(503).json({
                            error: 'Service temporarily throttled due to high system load',
                            loadLevel,
                            retryAfter: 60,
                            suggestion: 'Consider reducing request frequency or using simpler operations'
                        });
                    },
                    message: {
                        jsonrpc: '2.0',
                        error: {
                            code: -32000,
                            message: `Rate limit exceeded for tool '${toolName}' (throttled due to high system load).`,
                            data: {
                                tool: toolName,
                                loadLevel,
                                retryAfter: this.config.toolLimits[toolName].windowMs / 1000
                            }
                        }
                    }
                });
                middlewares.push(throttledLimiter);
            }
            else {
                middlewares.push(toolLimiter);
            }
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
     * Get current system load and recommendations for load reduction
     */
    getLoadStatus() {
        const loadLevel = this.getLoadReductionLevel();
        const recommendations = {
            0: [], // No recommendations needed
            1: ['Consider batching smaller requests', 'Use caching where possible'],
            2: ['Reduce request frequency', 'Use simpler AI models if available', 'Implement exponential backoff'],
            3: ['Pause non-critical operations', 'Implement circuit breaker pattern', 'Consider scaling infrastructure']
        };
        return {
            cpu: this.systemStats.cpu,
            memory: this.systemStats.memory,
            loadLevel,
            status: ['normal', 'light_load', 'moderate_load', 'heavy_load'][loadLevel],
            recommendations: recommendations[loadLevel],
            thresholds: {
                cpu: this.config.adaptive.cpuThreshold,
                memory: this.config.adaptive.memoryThreshold
            }
        };
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
