/**
 * MCP Security: Security Logging + Network Filtering (Day 2)
 *
 * Implements comprehensive security logging and network-based filtering with:
 * - Structured security event logging
 * - IP-based filtering and geolocation blocking
 * - Anomaly detection and alerting
 * - Integration with SIEM systems
 */
import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../auth/jwt-middleware';
export declare enum SecurityEventType {
    AUTH_SUCCESS = "auth_success",
    AUTH_FAILURE = "auth_failure",
    AUTH_BYPASS_ATTEMPT = "auth_bypass_attempt",
    RATE_LIMIT_EXCEEDED = "rate_limit_exceeded",
    SUSPICIOUS_REQUEST = "suspicious_request",
    TOOL_ACCESS_DENIED = "tool_access_denied",
    ADMIN_ACTION = "admin_action",
    IP_BLOCKED = "ip_blocked",
    GEOLOCATION_BLOCKED = "geolocation_blocked",
    ANOMALY_DETECTED = "anomaly_detected",
    MALICIOUS_PAYLOAD = "malicious_payload",
    COMMAND_INJECTION_ATTEMPT = "command_injection_attempt",
    TEMPLATE_INJECTION_ATTEMPT = "template_injection_attempt",
    SYSTEM_OVERRIDE_ATTEMPT = "system_override_attempt",
    MCP_TOOL_SCHEMA_CHANGED = "mcp_tool_schema_changed",
    MCP_TOOL_AUTO_DISABLED = "mcp_tool_auto_disabled",
    MCP_SUSPICIOUS_TOOL_CALL = "mcp_suspicious_tool_call",
    MCP_TOOL_EXECUTION_TIMEOUT = "mcp_tool_execution_timeout",
    MCP_RESOURCE_ACCESS_VIOLATION = "mcp_resource_access_violation"
}
export declare enum SecuritySeverity {
    LOW = "low",
    MEDIUM = "medium",
    HIGH = "high",
    CRITICAL = "critical"
}
export interface SecurityEvent {
    timestamp: string;
    eventType: SecurityEventType;
    severity: SecuritySeverity;
    source: {
        ip: string;
        userAgent?: string;
        userId?: string;
        email?: string;
        country?: string;
        city?: string;
    };
    request: {
        method: string;
        path: string;
        headers: Record<string, string>;
        body?: any;
        mcpMethod?: string;
        toolName?: string;
    };
    details: {
        message: string;
        context?: Record<string, any>;
        riskScore?: number;
        blockedBy?: string[];
        actionTaken?: string;
    };
    correlationId?: string;
}
export interface NetworkFilterConfig {
    enabled?: boolean;
    ipWhitelist: string[];
    ipBlacklist: string[];
    countryBlacklist: string[];
    countryWhitelist: string[];
    blockTor: boolean;
    blockVPN: boolean;
    blockProxies: boolean;
    autoBlockThreshold: number;
    autoBlockDuration: number;
    customRules: NetworkRule[];
}
export interface NetworkRule {
    name: string;
    condition: (req: Request, geoData?: GeoLocationData) => boolean;
    action: 'block' | 'log' | 'challenge';
    severity: SecuritySeverity;
    message: string;
}
export interface GeoLocationData {
    country: string;
    countryCode: string;
    city: string;
    region: string;
    isp: string;
    isVPN: boolean;
    isTor: boolean;
    isProxy: boolean;
    riskScore: number;
}
export interface SecurityLoggerConfig {
    enabled?: boolean;
    logLevel: string;
    logFile: string;
    maxFileSize: string;
    maxFiles: number;
    siem: {
        enabled: boolean;
        webhook?: string;
        apiKey?: string;
        format: 'json' | 'cef' | 'leef';
    };
    alerts: {
        enabled: boolean;
        webhook?: string;
        email?: string;
        thresholds: {
            [key in SecuritySeverity]: number;
        };
    };
    networkFilter: NetworkFilterConfig;
    anomalyDetection: {
        enabled: boolean;
        windowMinutes: number;
        thresholds: {
            requestsPerMinute: number;
            uniqueUserAgents: number;
            distinctEndpoints: number;
            errorRate: number;
        };
    };
}
export declare const DEFAULT_SECURITY_CONFIG: SecurityLoggerConfig;
/**
 * Security Logger and Network Filter Service
 */
export declare class SecurityLogger {
    private config;
    private logger;
    private blockedIPs;
    private securityEvents;
    private alertCounters;
    private anomalyData;
    constructor(config?: Partial<SecurityLoggerConfig>);
    /**
     * Initialize Winston logger
     */
    private initializeLogger;
    /**
     * Initialize alert counters
     */
    private initializeAlertCounters;
    /**
     * Start anomaly detection monitoring
     */
    private startAnomalyDetection;
    private isLogging;
    /**
     * Map custom security severity to Winston log levels
     */
    private mapSeverityToLogLevel;
    /**
     * Log a security event
     */
    logSecurityEvent(event: Partial<SecurityEvent>): Promise<void>;
    /**
     * Create network filtering middleware
     */
    createNetworkFilterMiddleware(): (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void | Response<any, Record<string, any>>>;
    /**
     * Create MCP request logging middleware
     */
    createMCPLoggingMiddleware(): (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void>;
    /**
     * Get client IP address
     */
    private getClientIP;
    /**
     * Check if IP is currently blocked
     */
    private isIPBlocked;
    /**
     * Get geolocation data for IP (mock implementation - use real service in production)
     */
    private getGeoLocationData;
    /**
     * Apply network filtering rules
     */
    private applyNetworkFilters;
    /**
     * Add security headers to response
     */
    private addSecurityHeaders;
    /**
     * Analyze request for security issues
     */
    private analyzeRequest;
    /**
     * Check if IP should be auto-blocked
     */
    private checkAutoBlock;
    /**
     * Check alert thresholds
     */
    private checkAlertThresholds;
    /**
     * Send alert notification
     */
    private sendAlert;
    /**
     * Perform anomaly detection
     */
    private performAnomalyDetection;
    /**
     * Send event to SIEM system
     */
    private sendToSIEM;
    /**
     * Format event as Common Event Format (CEF)
     */
    private formatCEF;
    /**
     * Format event as Log Event Extended Format (LEEF)
     */
    private formatLEEF;
    /**
     * Convert severity to CEF format
     */
    private severityToCEF;
    /**
     * Convert severity to LEEF format
     */
    private severityToLEEF;
    /**
     * Generate correlation ID
     */
    private generateCorrelationId;
    /**
     * Get security statistics
     */
    getSecurityStats(): {
        blockedIPs: number;
        totalEvents: number;
        alertCounters: {
            [k: string]: number;
        };
        activeIPs: number;
        config: {
            siemEnabled: boolean;
            alertsEnabled: boolean;
            anomalyDetectionEnabled: boolean;
            networkFiltersActive: {
                ipBlacklist: number;
                ipWhitelist: number;
                countryBlacklist: number;
                customRules: number;
            };
        };
    };
    /**
     * Manually block/unblock IP
     */
    blockIP(ip: string, reason: string, durationMinutes?: number): void;
    unblockIP(ip: string): boolean;
}
/**
 * Get or create default security logger instance
 */
export declare function getDefaultSecurityLogger(config?: Partial<SecurityLoggerConfig>): SecurityLogger;
/**
 * Express middleware factory for security logging
 */
export declare function createSecurityLoggingMiddleware(config?: Partial<SecurityLoggerConfig>): {
    networkFilter: (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void | Response<any, Record<string, any>>>;
    mcpLogging: (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void>;
    logger: SecurityLogger;
};
//# sourceMappingURL=security-logger.d.ts.map