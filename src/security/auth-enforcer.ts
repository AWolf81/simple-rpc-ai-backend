/**
 * MCP Security: Auth Enforcement + Resource Tracking (Day 5)
 * 
 * Implements comprehensive authentication enforcement and resource usage tracking with:
 * - Enhanced authentication validation
 * - Resource consumption monitoring
 * - Usage quotas and billing integration
 * - Performance metrics tracking
 */

import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest, OpenSaaSJWTPayload } from '../auth/jwt-middleware';
import { SecurityLogger, SecurityEventType, SecuritySeverity } from './security-logger.js';
import { logger as appLogger } from '../utils/logger.js';

// Resource types for tracking
export enum ResourceType {
  AI_REQUEST = 'ai_request',
  MCP_TOOL_CALL = 'mcp_tool_call',
  DATA_TRANSFER = 'data_transfer',
  COMPUTATION_TIME = 'computation_time',
  STORAGE_USAGE = 'storage_usage',
  API_CALL = 'api_call'
}

// Resource usage entry
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

// Authentication enforcement configuration
export interface AuthEnforcementConfig {
  // Enable/disable auth enforcement entirely
  enabled?: boolean;                      // Enable auth enforcement (default: true)
  
  // Authentication requirements
  strictMode: boolean;                    // Require authentication for all endpoints
  allowedAnonymousEndpoints: string[];    // Endpoints that don't require auth
  requireEmailVerification: boolean;     // Require verified email
  requireActiveSubscription: boolean;    // Require active subscription
  
  // Token validation
  tokenValidation: {
    checkExpiration: boolean;             // Check token expiration
    checkAudience: boolean;               // Validate audience claim
    checkIssuer: boolean;                 // Validate issuer claim
    allowedIssuers: string[];            // Allowed token issuers
    clockSkewTolerance: number;          // Clock skew tolerance in seconds
  };
  
  // Resource tracking
  resourceTracking: {
    enabled: boolean;                     // Enable resource tracking
    trackAllRequests: boolean;            // Track all requests or just authenticated ones
    aggregationInterval: number;         // Aggregation interval in minutes
    retentionDays: number;               // Data retention in days
  };
  
  // Quota enforcement
  quotaEnforcement: {
    enabled: boolean;                     // Enable quota enforcement
    checkOnRequest: boolean;              // Check quotas on every request
    quotaBufferPercent: number;          // Buffer percentage before hard limit
    gracePeriodHours: number;            // Grace period after quota exceeded
  };
  
  // Performance tracking
  performanceTracking: {
    enabled: boolean;                     // Enable performance tracking
    trackResponseTimes: boolean;          // Track API response times
    trackResourceConsumption: boolean;    // Track compute resource usage
    alertSlowRequests: boolean;           // Alert on slow requests
    slowRequestThresholdMs: number;       // Threshold for slow requests
  };
}

// Usage statistics
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

// Default configuration
export const DEFAULT_AUTH_ENFORCEMENT_CONFIG: AuthEnforcementConfig = {
  enabled: true,
  strictMode: false,
  allowedAnonymousEndpoints: ['/health', '/mcp', '/trpc/ai.health'],
  requireEmailVerification: false,
  requireActiveSubscription: false,
  
  tokenValidation: {
    checkExpiration: true,
    checkAudience: true,
    checkIssuer: true,
    allowedIssuers: ['opensaas'],
    clockSkewTolerance: 30
  },
  
  resourceTracking: {
    enabled: true,
    trackAllRequests: true,
    aggregationInterval: 15, // 15 minutes
    retentionDays: 30
  },
  
  quotaEnforcement: {
    enabled: true,
    checkOnRequest: true,
    quotaBufferPercent: 10, // Warning at 90%
    gracePeriodHours: 24
  },
  
  performanceTracking: {
    enabled: true,
    trackResponseTimes: true,
    trackResourceConsumption: true,
    alertSlowRequests: true,
    slowRequestThresholdMs: 5000 // 5 seconds
  }
};

/**
 * Authentication Enforcer and Resource Tracker
 */
export class AuthEnforcer {
  private config: AuthEnforcementConfig;
  private securityLogger: SecurityLogger;
  private resourceUsageLog: ResourceUsage[] = [];
  private usageStats: UsageStatistics;
  private userQuotas: Map<string, any> = new Map(); // userId -> quota info
  private performanceMetrics: Map<string, number[]> = new Map(); // endpoint -> response times

  constructor(config: Partial<AuthEnforcementConfig> = {}, securityLogger?: SecurityLogger) {
    this.config = { ...DEFAULT_AUTH_ENFORCEMENT_CONFIG, ...config };
    this.securityLogger = securityLogger || new SecurityLogger();
    
    if (this.config.enabled) {
      this.usageStats = this.initializeUsageStats();
      this.startAggregationProcess();
      appLogger.debug('✅ Auth enforcement: Authentication enforcer and resource tracker initialized');
    } else {
      this.usageStats = this.initializeUsageStats(); // Minimal stats even when disabled
      appLogger.debug('ℹ️  Auth enforcement: Disabled (simple mode)');
    }
  }

  /**
   * Initialize usage statistics
   */
  private initializeUsageStats(): UsageStatistics {
    const resourceUsage: any = {};
    for (const resourceType of Object.values(ResourceType)) {
      resourceUsage[resourceType] = {
        total: 0,
        byTier: {},
        byUser: {}
      };
    }

    return {
      totalRequests: 0,
      authenticatedRequests: 0,
      anonymousRequests: 0,
      failedAuthRequests: 0,
      resourceUsage,
      performance: {
        averageResponseTime: 0,
        slowRequests: 0,
        errorRate: 0
      },
      quotaViolations: 0
    };
  }

  /**
   * Start aggregation and cleanup process
   */
  private startAggregationProcess() {
    if (!this.config.enabled || !this.config.resourceTracking.enabled) return;

    const intervalMs = this.config.resourceTracking.aggregationInterval * 60 * 1000;
    
    setInterval(() => {
      this.aggregateUsageData();
      this.cleanupOldData();
    }, intervalMs);
  }

  /**
   * Create enhanced authentication middleware
   */
  public createAuthEnforcementMiddleware() {
    return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      // Skip auth enforcement if disabled
      if (this.config.enabled === false) {
        return next();
      }
      
      const startTime = Date.now();
      
      try {
        // Track request start
        await this.trackRequestStart(req);
        
        // Check if endpoint requires authentication
        if (this.shouldEnforceAuth(req)) {
          const authResult = await this.enforceAuthentication(req);
          
          if (!authResult.success) {
            await this.securityLogger.logSecurityEvent({
              eventType: SecurityEventType.AUTH_FAILURE,
              severity: SecuritySeverity.HIGH,
              source: {
                ip: this.getClientIP(req),
                userAgent: req.get('User-Agent')
              },
              request: {
                method: req.method,
                path: req.path,
                headers: req.headers as Record<string, string>
              },
              details: {
                message: `Authentication enforcement failed: ${authResult.reason}`,
                context: { endpoint: req.path, reason: authResult.reason }
              }
            });
            
            return res.status(401).json({
              jsonrpc: '2.0',
              error: {
                code: -32000,
                message: 'Authentication required',
                data: { reason: authResult.reason }
              }
            });
          }
        }

        // Check quotas if user is authenticated
        if (req.user && this.config.quotaEnforcement.enabled) {
          const quotaResult = await this.checkUserQuotas(req.user);
          
          if (!quotaResult.allowed) {
            await this.securityLogger.logSecurityEvent({
              eventType: SecurityEventType.SUSPICIOUS_REQUEST,
              severity: SecuritySeverity.MEDIUM,
              source: {
                ip: this.getClientIP(req),
                userAgent: req.get('User-Agent'),
                userId: req.user.userId,
                email: req.user.email
              },
              request: {
                method: req.method,
                path: req.path,
                headers: req.headers as Record<string, string>
              },
              details: {
                message: `Quota exceeded: ${quotaResult.reason}`,
                context: { 
                  quotaType: quotaResult.quotaType,
                  used: quotaResult.used,
                  limit: quotaResult.limit
                }
              }
            });
            
            this.usageStats.quotaViolations++;
            
            return res.status(429).json({
              jsonrpc: '2.0',
              error: {
                code: -32000,
                message: 'Quota exceeded',
                data: quotaResult
              }
            });
          }
        }

        // Setup response tracking
        this.setupResponseTracking(req, res, startTime);
        
        next();
      } catch (error) {
        appLogger.error('❌ Auth enforcement: Middleware error:', error);
        next(); // Don't block requests on enforcement errors
      }
    };
  }

  /**
   * Check if authentication should be enforced for this request
   */
  private shouldEnforceAuth(req: Request): boolean {
    if (!this.config.strictMode) {
      return false; // Rely on individual endpoint auth requirements
    }
    
    const endpoint = req.path;
    if (!endpoint || !this.config.allowedAnonymousEndpoints) {
      return true; // Default to requiring auth if configuration is incomplete
    }
    
    return !this.config.allowedAnonymousEndpoints.some(allowed => 
      allowed && typeof allowed === 'string' && endpoint.startsWith(allowed)
    );
  }

  /**
   * Enforce authentication requirements
   */
  private async enforceAuthentication(req: AuthenticatedRequest): Promise<{
    success: boolean;
    reason?: string;
  }> {
    // Check if user is authenticated
    if (!req.user) {
      return { success: false, reason: 'No authentication token provided' };
    }

    const user = req.user;

    // Check token expiration
    if (this.config.tokenValidation.checkExpiration) {
      if (user.exp && Date.now() / 1000 > user.exp + this.config.tokenValidation.clockSkewTolerance) {
        return { success: false, reason: 'Token expired' };
      }
    }

    // Check issuer
    if (this.config.tokenValidation.checkIssuer) {
      if (!user.iss || !this.config.tokenValidation.allowedIssuers.includes(user.iss)) {
        return { success: false, reason: 'Invalid token issuer' };
      }
    }

    // Check email verification (if required)
    if (this.config.requireEmailVerification) {
      // This would require additional email verification status in the JWT
      // For now, we assume verified if email is present
      if (!user.email) {
        return { success: false, reason: 'Email verification required' };
      }
    }

    // Check active subscription (if required)
    if (this.config.requireActiveSubscription) {
      if (!user.subscriptionTier || user.subscriptionTier === 'free') {
        return { success: false, reason: 'Active subscription required' };
      }
    }

    return { success: true };
  }

  /**
   * Check user quotas
   */
  private async checkUserQuotas(user: OpenSaaSJWTPayload): Promise<{
    allowed: boolean;
    reason?: string;
    quotaType?: string;
    used?: number;
    limit?: number;
  }> {
    const userId = user.userId;
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-based month
    
    // Get user's current usage for this month
    const monthlyUsage = this.resourceUsageLog.filter(entry => {
      const entryDate = entry.timestamp;
      return entry.userId === userId &&
        entryDate.getFullYear() === currentYear &&
        entryDate.getMonth() === currentMonth;
    });

    // Calculate total tokens used this month
    const totalTokens = monthlyUsage.reduce((sum, entry) => {
      return sum + (entry.metadata.inputTokens || 0) + (entry.metadata.outputTokens || 0);
    }, 0);

    // Check against user's monthly quota
    if (totalTokens >= user.monthlyTokenQuota) {
      return {
        allowed: false,
        reason: 'Monthly token quota exceeded',
        quotaType: 'tokens',
        used: totalTokens,
        limit: user.monthlyTokenQuota
      };
    }

    // Check RPM (requests per minute) limit
    const lastMinute = new Date(Date.now() - 60 * 1000);
    const recentRequests = monthlyUsage.filter(entry => entry.timestamp >= lastMinute);
    
    if (recentRequests.length >= user.rpmLimit) {
      return {
        allowed: false,
        reason: 'Requests per minute limit exceeded',
        quotaType: 'rpm',
        used: recentRequests.length,
        limit: user.rpmLimit
      };
    }

    // Check if approaching quota (warning level)
    const quotaUsagePercent = (totalTokens / user.monthlyTokenQuota) * 100;
    const warningThreshold = 100 - this.config.quotaEnforcement.quotaBufferPercent;
    
    if (quotaUsagePercent >= warningThreshold) {
      await this.securityLogger.logSecurityEvent({
        eventType: SecurityEventType.SUSPICIOUS_REQUEST,
        severity: SecuritySeverity.LOW,
        source: {
          ip: 'system',
          userId: user.userId,
          email: user.email
        },
        request: {
          method: 'QUOTA_WARNING',
          path: '/quota-check',
          headers: {}
        },
        details: {
          message: `User approaching quota limit: ${quotaUsagePercent.toFixed(1)}% used`,
          context: { 
            used: totalTokens,
            limit: user.monthlyTokenQuota,
            percentage: quotaUsagePercent,
            tier: user.subscriptionTier
          }
        }
      });
    }

    return { allowed: true };
  }

  /**
   * Track resource usage
   */
  public async trackResourceUsage(usage: Partial<ResourceUsage>): Promise<void> {
    if (!this.config.resourceTracking.enabled) return;

    const fullUsage: ResourceUsage = {
      userId: usage.userId || 'anonymous',
      userEmail: usage.userEmail || 'unknown',
      resourceType: usage.resourceType || ResourceType.API_CALL,
      amount: usage.amount || 1,
      unit: usage.unit || 'request',
      timestamp: usage.timestamp || new Date(),
      metadata: usage.metadata || {},
      subscriptionTier: usage.subscriptionTier || 'free',
      organizationId: usage.organizationId
    };

    // Store usage entry
    this.resourceUsageLog.push(fullUsage);

    // Update statistics
    this.updateUsageStats(fullUsage);

    // Log high-value resource usage
    if (fullUsage.amount > 1000 || fullUsage.metadata.cost && fullUsage.metadata.cost > 10) {
      await this.securityLogger.logSecurityEvent({
        eventType: SecurityEventType.ADMIN_ACTION,
        severity: SecuritySeverity.LOW,
        source: {
          ip: 'system',
          userId: fullUsage.userId,
          email: fullUsage.userEmail
        },
        request: {
          method: 'RESOURCE_USAGE',
          path: '/resource-tracking',
          headers: {}
        },
        details: {
          message: `High resource usage recorded: ${fullUsage.amount} ${fullUsage.unit}`,
          context: { 
            resourceType: fullUsage.resourceType,
            amount: fullUsage.amount,
            cost: fullUsage.metadata.cost,
            tier: fullUsage.subscriptionTier
          }
        }
      });
    }
  }

  /**
   * Setup response tracking to measure performance and resource usage
   */
  private setupResponseTracking(req: AuthenticatedRequest, res: Response, startTime: number) {
    if (!this.config.performanceTracking.enabled) return;

    const originalSend = res.send.bind(res);
    const originalJson = res.json.bind(res);
    
    const trackResponse = (body?: any) => {
      const endTime = Date.now();
      const duration = endTime - startTime;
      const endpoint = req.path;
      
      // Track performance metrics
      if (this.config.performanceTracking.trackResponseTimes) {
        if (!this.performanceMetrics.has(endpoint)) {
          this.performanceMetrics.set(endpoint, []);
        }
        this.performanceMetrics.get(endpoint)!.push(duration);
        
        // Keep only last 1000 measurements per endpoint
        const metrics = this.performanceMetrics.get(endpoint)!;
        if (metrics.length > 1000) {
          metrics.splice(0, metrics.length - 1000);
        }
      }

      // Alert on slow requests
      if (this.config.performanceTracking.alertSlowRequests && 
          duration > this.config.performanceTracking.slowRequestThresholdMs) {
        this.usageStats.performance.slowRequests++;
        
        this.securityLogger.logSecurityEvent({
          eventType: SecurityEventType.ANOMALY_DETECTED,
          severity: SecuritySeverity.MEDIUM,
          source: {
            ip: this.getClientIP(req),
            userAgent: req.get('User-Agent'),
            userId: req.user?.userId,
            email: req.user?.email
          },
          request: {
            method: req.method,
            path: req.path,
            headers: req.headers as Record<string, string>
          },
          details: {
            message: `Slow request detected: ${duration}ms`,
            context: { 
              duration,
              threshold: this.config.performanceTracking.slowRequestThresholdMs,
              endpoint
            }
          }
        });
      }

      // Track resource usage for API call
      this.trackResourceUsage({
        userId: req.user?.userId || 'anonymous',
        userEmail: req.user?.email || 'unknown',
        resourceType: ResourceType.API_CALL,
        amount: 1,
        unit: 'request',
        metadata: {
          endpoint: req.path,
          duration,
          userAgent: req.get('User-Agent'),
          ip: this.getClientIP(req),
          statusCode: res.statusCode
        },
        subscriptionTier: req.user?.subscriptionTier || 'free',
        organizationId: req.user?.organizationId
      });

      // Update overall performance stats
      this.updatePerformanceStats(duration, res.statusCode);
    };

    res.send = function(body: any) {
      trackResponse(body);
      return originalSend(body);
    };

    res.json = function(body: any) {
      trackResponse(body);
      return originalJson(body);
    };
  }

  /**
   * Track request start
   */
  private async trackRequestStart(req: AuthenticatedRequest): Promise<void> {
    this.usageStats.totalRequests++;
    
    if (req.user) {
      this.usageStats.authenticatedRequests++;
    } else {
      this.usageStats.anonymousRequests++;
    }
  }

  /**
   * Update usage statistics
   */
  private updateUsageStats(usage: ResourceUsage): void {
    const resourceStats = this.usageStats.resourceUsage[usage.resourceType];
    
    resourceStats.total += usage.amount;
    
    // By tier
    if (!resourceStats.byTier[usage.subscriptionTier]) {
      resourceStats.byTier[usage.subscriptionTier] = 0;
    }
    resourceStats.byTier[usage.subscriptionTier] += usage.amount;
    
    // By user
    if (!resourceStats.byUser[usage.userId]) {
      resourceStats.byUser[usage.userId] = 0;
    }
    resourceStats.byUser[usage.userId] += usage.amount;
  }

  /**
   * Update performance statistics
   */
  private updatePerformanceStats(duration: number, statusCode: number): void {
    // Update average response time (simple moving average)
    const currentAvg = this.usageStats.performance.averageResponseTime;
    const newAvg = (currentAvg * (this.usageStats.totalRequests - 1) + duration) / this.usageStats.totalRequests;
    this.usageStats.performance.averageResponseTime = newAvg;
    
    // Track error rate
    if (statusCode >= 400) {
      const errorRequests = this.usageStats.performance.errorRate * this.usageStats.totalRequests + 1;
      this.usageStats.performance.errorRate = errorRequests / this.usageStats.totalRequests;
    } else {
      // Recalculate error rate
      const errorRequests = this.usageStats.performance.errorRate * (this.usageStats.totalRequests - 1);
      this.usageStats.performance.errorRate = errorRequests / this.usageStats.totalRequests;
    }
  }

  /**
   * Aggregate usage data periodically
   */
  private aggregateUsageData(): void {
    if (!this.config.enabled || !this.config.resourceTracking.enabled) return;
    
    // Only log if there are actual entries to aggregate
    if (this.resourceUsageLog.length > 0) {
      // This could store aggregated data to database for long-term storage
      appLogger.debug(`📊 Auth enforcement: Aggregated ${this.resourceUsageLog.length} usage entries`);
    }
  }

  /**
   * Clean up old data based on retention policy
   */
  private cleanupOldData(): void {
    if (!this.config.enabled || !this.config.resourceTracking.enabled) return;
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.resourceTracking.retentionDays);
    
    const initialCount = this.resourceUsageLog.length;
    this.resourceUsageLog = this.resourceUsageLog.filter(entry => entry.timestamp >= cutoffDate);
    
    const cleaned = initialCount - this.resourceUsageLog.length;
    if (cleaned > 0) {
      appLogger.debug(`🧹 Auth enforcement: Cleaned up ${cleaned} old usage entries`);
    }
  }

  /**
   * Get client IP address
   */
  private getClientIP(req: Request): string {
    return (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
           req.headers['x-real-ip'] as string ||
           req.connection?.remoteAddress ||
           req.socket?.remoteAddress ||
           'unknown';
  }

  /**
   * Get usage statistics
   */
  public getUsageStatistics(): UsageStatistics & { 
    config: AuthEnforcementConfig;
    activeUsers: number;
    topUsers: Array<{ userId: string; usage: number }>;
    performanceMetrics: Record<string, { avg: number; min: number; max: number }>;
  } {
    // Calculate active users (users with activity in last 24 hours)
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const activeUserIds = new Set(
      this.resourceUsageLog
        .filter(entry => entry.timestamp >= yesterday)
        .map(entry => entry.userId)
    );

    // Get top users by total API calls
    const userApiCalls: Record<string, number> = {};
    this.resourceUsageLog
      .filter(entry => entry.resourceType === ResourceType.API_CALL)
      .forEach(entry => {
        userApiCalls[entry.userId] = (userApiCalls[entry.userId] || 0) + entry.amount;
      });

    const topUsers = Object.entries(userApiCalls)
      .map(([userId, usage]) => ({ userId, usage }))
      .sort((a, b) => b.usage - a.usage)
      .slice(0, 10);

    // Calculate performance metrics per endpoint
    const performanceMetrics: Record<string, { avg: number; min: number; max: number }> = {};
    for (const [endpoint, times] of this.performanceMetrics.entries()) {
      if (times.length > 0) {
        performanceMetrics[endpoint] = {
          avg: times.reduce((sum, time) => sum + time, 0) / times.length,
          min: Math.min(...times),
          max: Math.max(...times)
        };
      }
    }

    return {
      ...this.usageStats,
      config: this.config,
      activeUsers: activeUserIds.size,
      topUsers,
      performanceMetrics
    };
  }

  /**
   * Get user-specific usage report
   */
  public getUserUsageReport(userId: string): {
    user: string;
    totalRequests: number;
    resourceUsage: Record<ResourceType, number>;
    monthlyTokens: number;
    averageResponseTime: number;
    lastActivity: Date | null;
    subscriptionTier: string;
  } {
    const userEntries = this.resourceUsageLog.filter(entry => entry.userId === userId);
    
    if (userEntries.length === 0) {
      return {
        user: userId,
        totalRequests: 0,
        resourceUsage: {} as Record<ResourceType, number>,
        monthlyTokens: 0,
        averageResponseTime: 0,
        lastActivity: null,
        subscriptionTier: 'unknown'
      };
    }

    const resourceUsage: Record<ResourceType, number> = {} as Record<ResourceType, number>;
    let totalTokens = 0;
    let totalResponseTime = 0;
    let responseTimeCount = 0;

    userEntries.forEach(entry => {
      resourceUsage[entry.resourceType] = (resourceUsage[entry.resourceType] || 0) + entry.amount;
      
      if (entry.metadata.inputTokens || entry.metadata.outputTokens) {
        totalTokens += (entry.metadata.inputTokens || 0) + (entry.metadata.outputTokens || 0);
      }
      
      if (entry.metadata.duration) {
        totalResponseTime += entry.metadata.duration;
        responseTimeCount++;
      }
    });

    const lastEntry = userEntries[userEntries.length - 1];
    
    return {
      user: userId,
      totalRequests: userEntries.length,
      resourceUsage,
      monthlyTokens: totalTokens,
      averageResponseTime: responseTimeCount > 0 ? totalResponseTime / responseTimeCount : 0,
      lastActivity: lastEntry.timestamp,
      subscriptionTier: lastEntry.subscriptionTier
    };
  }

  /**
   * Reset user quotas (admin function)
   */
  public resetUserQuotas(userId: string): boolean {
    // Remove user's usage entries for current month
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-based month
    
    const initialCount = this.resourceUsageLog.length;
    this.resourceUsageLog = this.resourceUsageLog.filter(entry => {
      if (entry.userId !== userId) return true;
      const entryDate = entry.timestamp;
      return !(entryDate.getFullYear() === currentYear && entryDate.getMonth() === currentMonth);
    });
    
    const removed = initialCount - this.resourceUsageLog.length;
    
    if (removed > 0) {
      this.securityLogger.logSecurityEvent({
        eventType: SecurityEventType.ADMIN_ACTION,
        severity: SecuritySeverity.MEDIUM,
        source: { 
          ip: 'admin-system',
          userId: 'admin' 
        },
        request: { method: 'ADMIN', path: '/quota-reset', headers: {} },
        details: {
          message: `Admin reset quotas for user ${userId}`,
          context: { userId, entriesRemoved: removed }
        }
      });
    }
    
    return removed > 0;
  }
}

/**
 * Default instance for easy use
 */
let defaultAuthEnforcer: AuthEnforcer | null = null;

/**
 * Get or create default auth enforcer instance
 */
export function getDefaultAuthEnforcer(config?: Partial<AuthEnforcementConfig>, securityLogger?: SecurityLogger): AuthEnforcer {
  if (!defaultAuthEnforcer) {
    defaultAuthEnforcer = new AuthEnforcer(config, securityLogger);
  }
  return defaultAuthEnforcer;
}

/**
 * Express middleware factory for auth enforcement
 */
export function createAuthEnforcementMiddleware(config?: Partial<AuthEnforcementConfig>, securityLogger?: SecurityLogger) {
  const enforcer = new AuthEnforcer(config, securityLogger);
  return {
    middleware: enforcer.createAuthEnforcementMiddleware(),
    enforcer
  };
}