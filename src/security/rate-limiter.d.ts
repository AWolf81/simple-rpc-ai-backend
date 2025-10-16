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
import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../auth/jwt-middleware';
export interface RateLimitConfig {
    windowMs: number;
    max: number;
    skipSuccessfulRequests?: boolean;
    skipFailedRequests?: boolean;
    standardHeaders?: boolean;
    legacyHeaders?: boolean;
}
export interface MCPRateLimitConfig {
    enabled?: boolean;
    global: RateLimitConfig;
    authenticated: RateLimitConfig;
    toolLimits: Record<string, RateLimitConfig>;
    admin: RateLimitConfig;
    burst: {
        enabled: boolean;
        windowMs: number;
        max: number;
    };
    adaptive: {
        enabled: boolean;
        cpuThreshold: number;
        memoryThreshold: number;
        throttleMultiplier: number;
    };
}
export declare const DEFAULT_MCP_RATE_LIMITS: MCPRateLimitConfig;
/**
 * Rate Limiter Service
 * Manages all rate limiting logic for MCP endpoints
 */
export declare class MCPRateLimiter {
    private config;
    private globalLimiter;
    private authenticatedLimiter;
    private adminLimiter;
    private burstLimiter;
    private toolLimiters;
    private toolLimiterConfigs;
    private systemStats;
    private lastCpuUsage;
    private lastCpuMeasurementTime;
    constructor(config?: Partial<MCPRateLimitConfig>);
    /**
     * Initialize all rate limiters
     */
    private initializeLimiters;
    /**
     * Start monitoring system resources for adaptive throttling
     */
    private startSystemMonitoring;
    /**
     * Update system statistics using Node.js built-in process.cpuUsage() and process.memoryUsage()
     */
    private updateSystemStats;
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
    private shouldThrottle;
    /**
     * Get load reduction level based on current system stress
     * Returns 0-3 indicating severity of load reduction needed
     */
    private getLoadReductionLevel;
    /**
     * Get the appropriate rate limiter middleware for a request
     */
    getMiddleware(toolName?: string): any[];
    /**
     * Get current system load and recommendations for load reduction
     */
    getLoadStatus(): {
        cpu: number;
        memory: number;
        loadLevel: number;
        status: string;
        recommendations: string[] | never[];
        thresholds: {
            cpu: number;
            memory: number;
        };
    };
    /**
     * Create a middleware function for MCP tool rate limiting
     */
    createMCPToolMiddleware(): (req: AuthenticatedRequest, res: Response, next: NextFunction) => void;
    /**
     * Get current rate limit status for debugging
     */
    getStatus(): {
        config: MCPRateLimitConfig;
        systemStats: {
            cpu: number;
            memory: number;
            lastUpdate: number;
        };
        throttling: boolean;
        toolLimiters: string[];
        lastUpdate: string;
    };
    /**
     * Reset rate limits for a specific user/IP (admin function)
     */
    resetLimits(identifier: string): void;
    /**
     * Update configuration dynamically
     */
    updateConfig(newConfig: Partial<MCPRateLimitConfig>): void;
}
/**
 * Get or create default rate limiter instance
 */
export declare function getDefaultRateLimiter(config?: Partial<MCPRateLimitConfig>): MCPRateLimiter;
/**
 * Express middleware factory for MCP rate limiting
 */
export declare function createMCPRateLimit(config?: Partial<MCPRateLimitConfig>): (req: AuthenticatedRequest, res: Response, next: NextFunction) => void;
//# sourceMappingURL=rate-limiter.d.ts.map