/**
 * MCP Security: Auth Enforcement + Resource Tracking (Day 5)
 *
 * Implements comprehensive authentication enforcement and resource usage tracking with:
 * - Enhanced authentication validation
 * - Resource consumption monitoring
 * - Usage quotas and billing integration
 * - Performance metrics tracking
 */
import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../auth/jwt-middleware';
import { SecurityLogger } from './security-logger';
export declare enum ResourceType {
    AI_REQUEST = "ai_request",
    MCP_TOOL_CALL = "mcp_tool_call",
    DATA_TRANSFER = "data_transfer",
    COMPUTATION_TIME = "computation_time",
    STORAGE_USAGE = "storage_usage",
    API_CALL = "api_call"
}
export interface ResourceUsage {
    userId: string;
    userEmail: string;
    resourceType: ResourceType;
    amount: number;
    unit: string;
    timestamp: Date;
    metadata: {
        toolName?: string;
        provider?: string;
        model?: string;
        inputTokens?: number;
        outputTokens?: number;
        duration?: number;
        cost?: number;
        endpoint?: string;
        userAgent?: string;
        ip?: string;
        statusCode?: number;
    };
    subscriptionTier: string;
    organizationId?: string;
}
export interface AuthEnforcementConfig {
    enabled?: boolean;
    strictMode: boolean;
    allowedAnonymousEndpoints: string[];
    requireEmailVerification: boolean;
    requireActiveSubscription: boolean;
    tokenValidation: {
        checkExpiration: boolean;
        checkAudience: boolean;
        checkIssuer: boolean;
        allowedIssuers: string[];
        clockSkewTolerance: number;
    };
    resourceTracking: {
        enabled: boolean;
        trackAllRequests: boolean;
        aggregationInterval: number;
        retentionDays: number;
    };
    quotaEnforcement: {
        enabled: boolean;
        checkOnRequest: boolean;
        quotaBufferPercent: number;
        gracePeriodHours: number;
    };
    performanceTracking: {
        enabled: boolean;
        trackResponseTimes: boolean;
        trackResourceConsumption: boolean;
        alertSlowRequests: boolean;
        slowRequestThresholdMs: number;
    };
}
export interface UsageStatistics {
    totalRequests: number;
    authenticatedRequests: number;
    anonymousRequests: number;
    failedAuthRequests: number;
    resourceUsage: {
        [key in ResourceType]: {
            total: number;
            byTier: Record<string, number>;
            byUser: Record<string, number>;
        };
    };
    performance: {
        averageResponseTime: number;
        slowRequests: number;
        errorRate: number;
    };
    quotaViolations: number;
}
export declare const DEFAULT_AUTH_ENFORCEMENT_CONFIG: AuthEnforcementConfig;
/**
 * Authentication Enforcer and Resource Tracker
 */
export declare class AuthEnforcer {
    private config;
    private securityLogger;
    private resourceUsageLog;
    private usageStats;
    private userQuotas;
    private performanceMetrics;
    constructor(config?: Partial<AuthEnforcementConfig>, securityLogger?: SecurityLogger);
    /**
     * Initialize usage statistics
     */
    private initializeUsageStats;
    /**
     * Start aggregation and cleanup process
     */
    private startAggregationProcess;
    /**
     * Create enhanced authentication middleware
     */
    createAuthEnforcementMiddleware(): (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void | Response<any, Record<string, any>>>;
    /**
     * Check if authentication should be enforced for this request
     */
    private shouldEnforceAuth;
    /**
     * Enforce authentication requirements
     */
    private enforceAuthentication;
    /**
     * Check user quotas
     */
    private checkUserQuotas;
    /**
     * Track resource usage
     */
    trackResourceUsage(usage: Partial<ResourceUsage>): Promise<void>;
    /**
     * Setup response tracking to measure performance and resource usage
     */
    private setupResponseTracking;
    /**
     * Track request start
     */
    private trackRequestStart;
    /**
     * Update usage statistics
     */
    private updateUsageStats;
    /**
     * Update performance statistics
     */
    private updatePerformanceStats;
    /**
     * Aggregate usage data periodically
     */
    private aggregateUsageData;
    /**
     * Clean up old data based on retention policy
     */
    private cleanupOldData;
    /**
     * Get client IP address
     */
    private getClientIP;
    /**
     * Get usage statistics
     */
    getUsageStatistics(): UsageStatistics & {
        config: AuthEnforcementConfig;
        activeUsers: number;
        topUsers: Array<{
            userId: string;
            usage: number;
        }>;
        performanceMetrics: Record<string, {
            avg: number;
            min: number;
            max: number;
        }>;
    };
    /**
     * Get user-specific usage report
     */
    getUserUsageReport(userId: string): {
        user: string;
        totalRequests: number;
        resourceUsage: Record<ResourceType, number>;
        monthlyTokens: number;
        averageResponseTime: number;
        lastActivity: Date | null;
        subscriptionTier: string;
    };
    /**
     * Reset user quotas (admin function)
     */
    resetUserQuotas(userId: string): boolean;
}
/**
 * Get or create default auth enforcer instance
 */
export declare function getDefaultAuthEnforcer(config?: Partial<AuthEnforcementConfig>, securityLogger?: SecurityLogger): AuthEnforcer;
/**
 * Express middleware factory for auth enforcement
 */
export declare function createAuthEnforcementMiddleware(config?: Partial<AuthEnforcementConfig>, securityLogger?: SecurityLogger): {
    middleware: (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void | Response<any, Record<string, any>>>;
    enforcer: AuthEnforcer;
};
//# sourceMappingURL=auth-enforcer.d.ts.map