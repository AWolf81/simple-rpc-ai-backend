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
import winston from 'winston';
import fs from 'fs/promises';
import path from 'path';

// Security event types
export enum SecurityEventType {
  AUTH_SUCCESS = 'auth_success',
  AUTH_FAILURE = 'auth_failure',
  AUTH_BYPASS_ATTEMPT = 'auth_bypass_attempt',
  RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded',
  SUSPICIOUS_REQUEST = 'suspicious_request',
  TOOL_ACCESS_DENIED = 'tool_access_denied',
  ADMIN_ACTION = 'admin_action',
  IP_BLOCKED = 'ip_blocked',
  GEOLOCATION_BLOCKED = 'geolocation_blocked',
  ANOMALY_DETECTED = 'anomaly_detected',
  MALICIOUS_PAYLOAD = 'malicious_payload',
  COMMAND_INJECTION_ATTEMPT = 'command_injection_attempt',
  TEMPLATE_INJECTION_ATTEMPT = 'template_injection_attempt',
  SYSTEM_OVERRIDE_ATTEMPT = 'system_override_attempt',
  // MCP-specific events
  MCP_TOOL_SCHEMA_CHANGED = 'mcp_tool_schema_changed',
  MCP_TOOL_AUTO_DISABLED = 'mcp_tool_auto_disabled',
  MCP_SUSPICIOUS_TOOL_CALL = 'mcp_suspicious_tool_call',
  MCP_TOOL_EXECUTION_TIMEOUT = 'mcp_tool_execution_timeout',
  MCP_RESOURCE_ACCESS_VIOLATION = 'mcp_resource_access_violation'
}

// Security event severity levels
export enum SecuritySeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

// Security event interface
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

// Network filtering configuration
export interface NetworkFilterConfig {
  // Enable/disable network filtering entirely
  enabled?: boolean;               // Enable network filtering (default: true)
  
  // IP-based filtering
  ipWhitelist: string[];           // Always allow these IPs
  ipBlacklist: string[];           // Always block these IPs
  
  // Geolocation filtering
  countryBlacklist: string[];      // Block these country codes
  countryWhitelist: string[];      // Only allow these countries (empty = allow all)
  
  // Tor/VPN detection
  blockTor: boolean;               // Block Tor exit nodes
  blockVPN: boolean;               // Block known VPN providers
  blockProxies: boolean;           // Block known proxy services
  
  // Rate-based blocking
  autoBlockThreshold: number;      // Auto-block after N security events
  autoBlockDuration: number;       // Block duration in minutes
  
  // Custom rules
  customRules: NetworkRule[];
}

// Custom network filtering rule
export interface NetworkRule {
  name: string;
  condition: (req: Request, geoData?: GeoLocationData) => boolean;
  action: 'block' | 'log' | 'challenge';
  severity: SecuritySeverity;
  message: string;
}

// Geolocation data interface
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

// Security logger configuration
export interface SecurityLoggerConfig {
  // Enable/disable security logging entirely
  enabled?: boolean;               // Enable security logging (default: true)
  
  // Logging settings
  logLevel: string;                // winston log level
  logFile: string;                 // Log file path
  maxFileSize: string;             // Max log file size
  maxFiles: number;                // Max number of log files
  
  // SIEM integration
  siem: {
    enabled: boolean;
    webhook?: string;              // SIEM webhook URL
    apiKey?: string;               // SIEM API key
    format: 'json' | 'cef' | 'leef'; // SIEM format
  };
  
  // Alert configuration
  alerts: {
    enabled: boolean;
    webhook?: string;              // Alert webhook URL
    email?: string;                // Alert email address
    thresholds: {
      [key in SecuritySeverity]: number; // Events per hour to trigger alert
    };
  };
  
  // Network filtering
  networkFilter: NetworkFilterConfig;
  
  // Anomaly detection
  anomalyDetection: {
    enabled: boolean;
    windowMinutes: number;         // Analysis window
    thresholds: {
      requestsPerMinute: number;   // Unusual request rate
      uniqueUserAgents: number;    // Too many user agents from one IP
      distinctEndpoints: number;   // Accessing too many endpoints
      errorRate: number;           // High error rate %
    };
  };
}

// Default configuration
export const DEFAULT_SECURITY_CONFIG: SecurityLoggerConfig = {
  enabled: true,
  logLevel: 'info',
  logFile: './logs/security.log',
  maxFileSize: '50MB',
  maxFiles: 10,
  
  siem: {
    enabled: false,
    format: 'json'
  },
  
  alerts: {
    enabled: true,
    thresholds: {
      [SecuritySeverity.LOW]: 50,
      [SecuritySeverity.MEDIUM]: 20,
      [SecuritySeverity.HIGH]: 5,
      [SecuritySeverity.CRITICAL]: 1
    }
  },
  
  networkFilter: {
    enabled: true,
    ipWhitelist: [],
    ipBlacklist: [],
    countryBlacklist: [],
    countryWhitelist: [],
    blockTor: true,
    blockVPN: false,
    blockProxies: true,
    autoBlockThreshold: 10,
    autoBlockDuration: 60,
    customRules: []
  },
  
  anomalyDetection: {
    enabled: true,
    windowMinutes: 15,
    thresholds: {
      requestsPerMinute: 100,
      uniqueUserAgents: 10,
      distinctEndpoints: 20,
      errorRate: 50
    }
  }
};

/**
 * Security Logger and Network Filter Service
 */
export class SecurityLogger {
  private config: SecurityLoggerConfig;
  private logger!: winston.Logger;
  private blockedIPs: Map<string, { until: number; reason: string }> = new Map();
  private securityEvents: Map<string, SecurityEvent[]> = new Map(); // IP -> events
  private alertCounters: Map<SecuritySeverity, number> = new Map();
  private anomalyData: Map<string, any> = new Map();

  constructor(config: Partial<SecurityLoggerConfig> = {}) {
    this.config = { ...DEFAULT_SECURITY_CONFIG, ...config };
    this.initializeLogger();
    this.initializeAlertCounters();
    this.startAnomalyDetection();
    
    console.log('✅ Security logging: Security logger and network filter initialized');
  }

  /**
   * Initialize Winston logger
   */
  private initializeLogger() {
    // Ensure log directory exists
    const logDir = path.dirname(this.config.logFile);
    fs.mkdir(logDir, { recursive: true }).catch(console.error);

    this.logger = winston.createLogger({
      level: this.config.logLevel,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      transports: [
        // File transport for security logs
        new winston.transports.File({
          filename: this.config.logFile,
          maxsize: parseInt(this.config.maxFileSize) || 50000000,
          maxFiles: this.config.maxFiles,
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json()
          )
        }),
        // Console transport for development
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple(),
            winston.format.printf((info: any) => {
              const { timestamp, level, message, eventType, severity, source } = info;
              if (eventType) {
                return `${timestamp} [${level}] 🔒 ${eventType} (${severity}) from ${source?.ip || 'unknown'}: ${message}`;
              }
              return `${timestamp} [${level}] ${message}`;
            })
          )
        })
      ]
    });
  }

  /**
   * Initialize alert counters
   */
  private initializeAlertCounters() {
    for (const severity of Object.values(SecuritySeverity)) {
      this.alertCounters.set(severity, 0);
    }
    
    // Reset counters every hour
    setInterval(() => {
      this.alertCounters.clear();
      this.initializeAlertCounters();
    }, 60 * 60 * 1000);
  }

  /**
   * Start anomaly detection monitoring
   */
  private startAnomalyDetection() {
    if (!this.config.anomalyDetection.enabled) return;
    
    const windowMs = this.config.anomalyDetection.windowMinutes * 60 * 1000;
    
    setInterval(() => {
      this.performAnomalyDetection();
    }, windowMs / 4); // Check 4 times per window
  }

  private isLogging: boolean = false;

  /**
   * Map custom security severity to Winston log levels
   */
  private mapSeverityToLogLevel(severity: SecuritySeverity): string {
    switch (severity) {
      case SecuritySeverity.LOW:
        return 'info';
      case SecuritySeverity.MEDIUM:
        return 'warn';
      case SecuritySeverity.HIGH:
        return 'error';
      case SecuritySeverity.CRITICAL:
        return 'error';
      default:
        return 'warn';
    }
  }

  /**
   * Log a security event
   */
  public async logSecurityEvent(event: Partial<SecurityEvent>): Promise<void> {
    // Skip all logging if security logging is disabled
    if (this.config.enabled === false) {
      return;
    }
    
    // Prevent infinite recursion by checking if we're already in a logging context
    if (this.isLogging) {
      console.warn('⚠️ Prevented recursive security logging call');
      return;
    }

    this.isLogging = true;
    try {
    const fullEvent: SecurityEvent = {
      timestamp: new Date().toISOString(),
      eventType: event.eventType || SecurityEventType.SUSPICIOUS_REQUEST,
      severity: event.severity || SecuritySeverity.MEDIUM,
      source: {
        ip: event.source?.ip || 'unknown',
        userAgent: event.source?.userAgent,
        userId: event.source?.userId,
        email: event.source?.email,
        country: event.source?.country,
        city: event.source?.city
      },
      request: {
        method: event.request?.method || 'UNKNOWN',
        path: event.request?.path || '/',
        headers: event.request?.headers || {},
        body: event.request?.body,
        mcpMethod: event.request?.mcpMethod,
        toolName: event.request?.toolName
      },
      details: {
        message: event.details?.message || 'Security event occurred',
        context: event.details?.context,
        riskScore: event.details?.riskScore,
        blockedBy: event.details?.blockedBy,
        actionTaken: event.details?.actionTaken
      },
      correlationId: event.correlationId || this.generateCorrelationId()
    };

    // Store event for analysis
    const ip = fullEvent.source.ip;
    if (!this.securityEvents.has(ip)) {
      this.securityEvents.set(ip, []);
    }
    this.securityEvents.get(ip)!.push(fullEvent);

    // Log the event
    this.logger.log(this.mapSeverityToLogLevel(fullEvent.severity), fullEvent.details.message, fullEvent);

    // Update alert counters
    const currentCount = this.alertCounters.get(fullEvent.severity) || 0;
    this.alertCounters.set(fullEvent.severity, currentCount + 1);

    // Send to SIEM if configured
    if (this.config.siem.enabled) {
      await this.sendToSIEM(fullEvent);
    }

    // Check for auto-blocking
    await this.checkAutoBlock(ip);

    // Check alert thresholds
    await this.checkAlertThresholds(fullEvent.severity);
    } finally {
      this.isLogging = false;
    }
  }

  /**
   * Create network filtering middleware
   */
  public createNetworkFilterMiddleware() {
    return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        // Skip all filtering if security logging or network filtering is disabled
        if (this.config.enabled === false || this.config.networkFilter.enabled === false) {
          return next();
        }
        
        const clientIP = this.getClientIP(req);
        
        // Check if IP is currently blocked
        if (this.isIPBlocked(clientIP)) {
          const blockInfo = this.blockedIPs.get(clientIP)!;
          
          await this.logSecurityEvent({
            eventType: SecurityEventType.IP_BLOCKED,
            severity: SecuritySeverity.HIGH,
            source: {
              ip: clientIP,
              userAgent: req.get('User-Agent')
            },
            request: {
              method: req.method,
              path: req.path,
              headers: req.headers as Record<string, string>
            },
            details: {
              message: `Blocked IP attempted access: ${blockInfo.reason}`,
              context: { blockReason: blockInfo.reason, blockedUntil: new Date(blockInfo.until) }
            }
          });
          
          return res.status(403).json({
            jsonrpc: '2.0',
            error: {
              code: -32000,
              message: 'Access denied. IP address is blocked.'
            }
          });
        }

        // Get geolocation data
        const geoData = await this.getGeoLocationData(clientIP);
        
        // Apply network filters
        const filterResult = await this.applyNetworkFilters(req, geoData);
        
        if (filterResult.blocked) {
          await this.logSecurityEvent({
            eventType: filterResult.eventType || SecurityEventType.SUSPICIOUS_REQUEST,
            severity: filterResult.severity || SecuritySeverity.MEDIUM,
            source: {
              ip: clientIP,
              userAgent: req.get('User-Agent'),
              country: geoData?.country,
              city: geoData?.city
            },
            request: {
              method: req.method,
              path: req.path,
              headers: req.headers as Record<string, string>
            },
            details: {
              message: filterResult.message,
              context: { geoData, filterResult },
              blockedBy: filterResult.blockedBy,
              actionTaken: 'Request blocked'
            }
          });
          
          return res.status(403).json({
            jsonrpc: '2.0',
            error: {
              code: -32000,
              message: 'Access denied by security policy.'
            }
          });
        }

        // Add security headers
        this.addSecurityHeaders(res);
        
        next();
      } catch (error) {
        console.error('❌ Security logging: Network filter error:', error);
        // Don't block on filter errors, just log them
        next();
      }
    };
  }

  /**
   * Create MCP request logging middleware
   */
  public createMCPLoggingMiddleware() {
    return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      // Skip all logging if security logging is disabled
      if (this.config.enabled === false) {
        return next();
      }
      
      const clientIP = this.getClientIP(req);
      const userAgent = req.get('User-Agent');
      const userInfo = req.user;
      
      // Log MCP request
      const mcpBody = req.body;
      const mcpMethod = mcpBody?.method;
      const toolName = mcpBody?.params?.name;
      
      // Detect potential security issues
      await this.analyzeRequest(req, clientIP, userAgent, userInfo);
      
      // Store original res.json to intercept responses
      const originalJson = res.json.bind(res);
      const logger = this;
      res.json = function(body: any) {
        // Log response
        const isError = body.error !== undefined;
        const statusCode = res.statusCode;

        // Log the response asynchronously
        setImmediate(async () => {
          if (isError) {
            // Determine if this is an auth failure or validation error
            const errorMessage = body.error?.message || 'Unknown error';
            const errorCode = body.error?.code;

            // Authentication-related errors (should count toward blocking)
            const isAuthError = (
              errorCode === -32001 || // Unauthorized
              errorCode === -32002 || // Insufficient permissions
              errorMessage.toLowerCase().includes('unauthorized') ||
              errorMessage.toLowerCase().includes('forbidden') ||
              errorMessage.toLowerCase().includes('authentication') ||
              errorMessage.toLowerCase().includes('invalid token') ||
              errorMessage.toLowerCase().includes('access denied')
            );

            // Parameter validation errors (should NOT count toward blocking)
            const isValidationError = (
              errorCode === -32602 || // Invalid params
              errorMessage.includes('Required parameter missing') ||
              errorMessage.includes('Invalid value for') ||
              errorMessage.includes('Resource not found') ||
              errorMessage.includes('Template validation failed') ||
              errorMessage.includes('Parameter validation failed')
            );

            let eventType: SecurityEventType;
            let severity: SecuritySeverity;

            if (isAuthError) {
              eventType = SecurityEventType.AUTH_FAILURE;
              severity = statusCode >= 500 ? SecuritySeverity.HIGH : SecuritySeverity.MEDIUM;
            } else if (isValidationError) {
              eventType = SecurityEventType.SUSPICIOUS_REQUEST;
              severity = SecuritySeverity.LOW; // Much lower severity for validation errors
            } else {
              // Generic error - treat as suspicious but not auth failure
              eventType = SecurityEventType.SUSPICIOUS_REQUEST;
              severity = statusCode >= 500 ? SecuritySeverity.MEDIUM : SecuritySeverity.LOW;
            }

            await logger.logSecurityEvent({
              eventType,
              severity,
              source: {
                ip: clientIP,
                userAgent,
                userId: userInfo?.userId,
                email: userInfo?.email
              },
              request: {
                method: req.method,
                path: req.path,
                headers: req.headers as Record<string, string>,
                mcpMethod,
                toolName
              },
              details: {
                message: `MCP request failed: ${errorMessage}`,
                context: {
                  statusCode,
                  errorCode,
                  isAuthError,
                  isValidationError
                }
              }
            });
          } else if (userInfo) {
            // Log successful authenticated access
            await logger.logSecurityEvent({
              eventType: SecurityEventType.AUTH_SUCCESS,
              severity: SecuritySeverity.LOW,
              source: {
                ip: clientIP,
                userAgent,
                userId: userInfo.userId,
                email: userInfo.email
              },
              request: {
                method: req.method,
                path: req.path,
                headers: req.headers as Record<string, string>,
                mcpMethod,
                toolName
              },
              details: {
                message: `Successful MCP access: ${mcpMethod}${toolName ? ` (${toolName})` : ''}`,
                context: { subscriptionTier: userInfo.subscriptionTier }
              }
            });
          }
        });
        
        return originalJson(body);
      };
      
      next();
    };
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
   * Check if IP is currently blocked
   */
  private isIPBlocked(ip: string): boolean {
    // Skip IP blocking if security logging is disabled
    if (this.config.enabled === false) {
      return false;
    }
    
    const blockInfo = this.blockedIPs.get(ip);
    if (!blockInfo) return false;
    
    if (Date.now() > blockInfo.until) {
      this.blockedIPs.delete(ip);
      return false;
    }
    
    return true;
  }

  /**
   * Get geolocation data for IP (mock implementation - use real service in production)
   */
  private async getGeoLocationData(ip: string): Promise<GeoLocationData | null> {
    // Mock implementation - in production, use services like MaxMind, IPGeolocation, etc.
    try {
      // Simulate geolocation lookup
      if (ip === 'unknown' || ip.startsWith('127.') || ip.startsWith('192.168.')) {
        return null;
      }
      
      return {
        country: 'United States',
        countryCode: 'US',
        city: 'Unknown',
        region: 'Unknown',
        isp: 'Unknown ISP',
        isVPN: false,
        isTor: false,
        isProxy: false,
        riskScore: 0
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Apply network filtering rules
   */
  private async applyNetworkFilters(req: Request, geoData: GeoLocationData | null): Promise<{
    blocked: boolean;
    eventType?: SecurityEventType;
    severity?: SecuritySeverity;
    message: string;
    blockedBy?: string[];
  }> {
    const clientIP = this.getClientIP(req);
    const blockedBy: string[] = [];

    // IP whitelist check (always allow)
    if (this.config.networkFilter.ipWhitelist.includes(clientIP)) {
      return { blocked: false, message: 'IP whitelisted' };
    }

    // IP blacklist check
    if (this.config.networkFilter.ipBlacklist.includes(clientIP)) {
      blockedBy.push('IP blacklist');
    }

    // Geolocation filtering
    if (geoData) {
      // Country blacklist
      if (this.config.networkFilter.countryBlacklist.includes(geoData.countryCode)) {
        blockedBy.push('Country blacklist');
      }
      
      // Country whitelist (if configured)
      if (this.config.networkFilter.countryWhitelist.length > 0 &&
          !this.config.networkFilter.countryWhitelist.includes(geoData.countryCode)) {
        blockedBy.push('Country not whitelisted');
      }
      
      // Tor/VPN/Proxy detection
      if (this.config.networkFilter.blockTor && geoData.isTor) {
        blockedBy.push('Tor network');
      }
      
      if (this.config.networkFilter.blockVPN && geoData.isVPN) {
        blockedBy.push('VPN detected');
      }
      
      if (this.config.networkFilter.blockProxies && geoData.isProxy) {
        blockedBy.push('Proxy detected');
      }
    }

    // Custom rules
    for (const rule of this.config.networkFilter.customRules) {
      try {
        if (rule.condition(req, geoData || undefined)) {
          if (rule.action === 'block') {
            blockedBy.push(rule.name);
          }
        }
      } catch (error) {
        console.error(`❌ Security logging: Custom rule error (${rule.name}):`, error);
      }
    }

    if (blockedBy.length > 0) {
      return {
        blocked: true,
        eventType: SecurityEventType.IP_BLOCKED,
        severity: SecuritySeverity.HIGH,
        message: `Request blocked by network filters: ${blockedBy.join(', ')}`,
        blockedBy
      };
    }

    return { blocked: false, message: 'Passed network filters' };
  }

  /**
   * Add security headers to response
   */
  private addSecurityHeaders(res: Response): void {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  }

  /**
   * Analyze request for security issues
   */
  private async analyzeRequest(req: AuthenticatedRequest, ip: string, userAgent?: string, userInfo?: any): Promise<void> {
    // Skip request analysis if security logging is disabled
    if (this.config.enabled === false) {
      return;
    }
    
    const mcpBody = req.body;
    
    // Check for malicious patterns in MCP requests
    if (mcpBody && typeof mcpBody === 'object') {
      const requestStr = JSON.stringify(mcpBody);
      
      // Command injection patterns
      const commandPatterns = [
        /\$\([^)]*\)/g,    // $(command)
        /`[^`]*`/g,        // `command`
        /;\s*\w+/g,        // ; command
        /\|\s*\w+/g,       // | command
        /&&\s*\w+/g        // && command
      ];
      
      for (const pattern of commandPatterns) {
        if (pattern.test(requestStr)) {
          await this.logSecurityEvent({
            eventType: SecurityEventType.COMMAND_INJECTION_ATTEMPT,
            severity: SecuritySeverity.HIGH,
            source: { ip, userAgent, userId: userInfo?.userId, email: userInfo?.email },
            request: {
              method: req.method,
              path: req.path,
              headers: req.headers as Record<string, string>,
              body: mcpBody
            },
            details: {
              message: `Command injection attempt detected in MCP request`,
              context: { pattern: pattern.source, matchedContent: requestStr.match(pattern) },
              riskScore: 8
            }
          });
          break;
        }
      }
      
      // Template injection patterns
      const templatePatterns = [
        /\{\{.*?\}\}/g,        // {{template}}
        /\$\{.*?\}/g,          // ${template}
        /#\{.*?\}/g            // #{template}
      ];
      
      for (const pattern of templatePatterns) {
        if (pattern.test(requestStr)) {
          await this.logSecurityEvent({
            eventType: SecurityEventType.TEMPLATE_INJECTION_ATTEMPT,
            severity: SecuritySeverity.HIGH,
            source: { ip, userAgent, userId: userInfo?.userId, email: userInfo?.email },
            request: {
              method: req.method,
              path: req.path,
              headers: req.headers as Record<string, string>,
              body: mcpBody
            },
            details: {
              message: `Template injection attempt detected in MCP request`,
              context: { pattern: pattern.source, matchedContent: requestStr.match(pattern) },
              riskScore: 7
            }
          });
          break;
        }
      }
      
      // System override patterns
      const systemPatterns = [
        /SYSTEM\s*:/gi,
        /ignore\s+.*?previous/gi,
        /INSTRUCTION_OVERRIDE/gi,
        /SYSTEM_OVERRIDE/gi
      ];
      
      for (const pattern of systemPatterns) {
        if (pattern.test(requestStr)) {
          await this.logSecurityEvent({
            eventType: SecurityEventType.SYSTEM_OVERRIDE_ATTEMPT,
            severity: SecuritySeverity.HIGH,
            source: { ip, userAgent, userId: userInfo?.userId, email: userInfo?.email },
            request: {
              method: req.method,
              path: req.path,
              headers: req.headers as Record<string, string>,
              body: mcpBody
            },
            details: {
              message: `System override attempt detected in MCP request`,
              context: { pattern: pattern.source },
              riskScore: 9
            }
          });
          break;
        }
      }
    }
  }

  /**
   * Check if IP should be auto-blocked
   */
  private async checkAutoBlock(ip: string): Promise<void> {
    // Skip auto-blocking if security logging is disabled
    if (this.config.enabled === false) {
      return;
    }

    const events = this.securityEvents.get(ip) || [];
    const recentEvents = events.filter(e =>
      Date.now() - new Date(e.timestamp).getTime() < 60 * 60 * 1000 // Last hour
    );

    // Only count serious security events for auto-blocking, not validation errors
    const blockingEvents = recentEvents.filter(e =>
      e.eventType === SecurityEventType.AUTH_FAILURE ||
      e.eventType === SecurityEventType.AUTH_BYPASS_ATTEMPT ||
      e.eventType === SecurityEventType.COMMAND_INJECTION_ATTEMPT ||
      e.eventType === SecurityEventType.TEMPLATE_INJECTION_ATTEMPT ||
      e.eventType === SecurityEventType.SYSTEM_OVERRIDE_ATTEMPT ||
      e.eventType === SecurityEventType.MALICIOUS_PAYLOAD ||
      e.severity === SecuritySeverity.HIGH ||
      e.severity === SecuritySeverity.CRITICAL
    );

    if (blockingEvents.length >= this.config.networkFilter.autoBlockThreshold) {
      const blockUntil = Date.now() + (this.config.networkFilter.autoBlockDuration * 60 * 1000);
      this.blockedIPs.set(ip, {
        until: blockUntil,
        reason: `Auto-blocked after ${blockingEvents.length} serious security events`
      });
      
      await this.logSecurityEvent({
        eventType: SecurityEventType.IP_BLOCKED,
        severity: SecuritySeverity.CRITICAL,
        source: { ip },
        request: { method: 'AUTO', path: '/auto-block', headers: {} },
        details: {
          message: `IP auto-blocked after ${blockingEvents.length} serious security events`,
          context: { 
            blockDuration: this.config.networkFilter.autoBlockDuration,
            eventCount: recentEvents.length,
            blockUntil: new Date(blockUntil)
          },
          actionTaken: 'IP blocked'
        }
      });
    }
  }

  /**
   * Check alert thresholds
   */
  private async checkAlertThresholds(severity: SecuritySeverity): Promise<void> {
    const count = this.alertCounters.get(severity) || 0;
    const threshold = this.config.alerts.thresholds[severity];
    
    if (count >= threshold) {
      await this.sendAlert(severity, count, threshold);
    }
  }

  /**
   * Send alert notification
   */
  private async sendAlert(severity: SecuritySeverity, count: number, threshold: number): Promise<void> {
    if (!this.config.alerts.enabled) return;
    
    const message = `Security Alert: ${count} ${severity} security events in the last hour (threshold: ${threshold})`;
    
    try {
      if (this.config.alerts.webhook) {
        // Send webhook alert (implement based on your webhook service)
        console.log(`🚨 Security alert: ${message}`);
      }
      
      if (this.config.alerts.email) {
        // Send email alert (implement based on your email service)
        console.log(`📧 Security alert email: ${message}`);
      }
      
      // Log the alert
      await this.logSecurityEvent({
        eventType: SecurityEventType.ANOMALY_DETECTED,
        severity: SecuritySeverity.CRITICAL,
        source: { ip: 'system' },
        request: { method: 'ALERT', path: '/security-alert', headers: {} },
        details: {
          message,
          context: { severity, count, threshold }
        }
      });
      
    } catch (error) {
      console.error('❌ Security logging: Failed to send alert:', error);
    }
  }

  /**
   * Perform anomaly detection
   */
  private performAnomalyDetection(): void {
    if (!this.config.anomalyDetection.enabled) return;
    
    const windowMs = this.config.anomalyDetection.windowMinutes * 60 * 1000;
    const now = Date.now();
    const windowStart = now - windowMs;
    
    // Analyze patterns per IP
    for (const [ip, events] of this.securityEvents.entries()) {
      const recentEvents = events.filter(e => 
        new Date(e.timestamp).getTime() > windowStart
      );
      
      if (recentEvents.length === 0) continue;
      
      const analysis = {
        requestsPerMinute: recentEvents.length / this.config.anomalyDetection.windowMinutes,
        uniqueUserAgents: new Set(recentEvents.map(e => e.source.userAgent)).size,
        distinctEndpoints: new Set(recentEvents.map(e => e.request.path)).size,
        errorRate: (recentEvents.filter(e => e.eventType === SecurityEventType.AUTH_FAILURE).length / recentEvents.length) * 100
      };
      
      const thresholds = this.config.anomalyDetection.thresholds;
      const anomalies: string[] = [];
      
      if (analysis.requestsPerMinute > thresholds.requestsPerMinute) {
        anomalies.push(`High request rate: ${analysis.requestsPerMinute.toFixed(1)}/min`);
      }
      
      if (analysis.uniqueUserAgents > thresholds.uniqueUserAgents) {
        anomalies.push(`Too many user agents: ${analysis.uniqueUserAgents}`);
      }
      
      if (analysis.distinctEndpoints > thresholds.distinctEndpoints) {
        anomalies.push(`Too many endpoints: ${analysis.distinctEndpoints}`);
      }
      
      if (analysis.errorRate > thresholds.errorRate) {
        anomalies.push(`High error rate: ${analysis.errorRate.toFixed(1)}%`);
      }
      
      if (anomalies.length > 0) {
        this.logSecurityEvent({
          eventType: SecurityEventType.ANOMALY_DETECTED,
          severity: SecuritySeverity.HIGH,
          source: { ip },
          request: { method: 'ANALYSIS', path: '/anomaly-detection', headers: {} },
          details: {
            message: `Anomalous behavior detected: ${anomalies.join(', ')}`,
            context: { analysis, thresholds, windowMinutes: this.config.anomalyDetection.windowMinutes },
            riskScore: Math.min(10, anomalies.length * 3)
          }
        });
      }
    }
  }

  /**
   * Send event to SIEM system
   */
  private async sendToSIEM(event: SecurityEvent): Promise<void> {
    if (!this.config.siem.enabled || !this.config.siem.webhook) return;
    
    try {
      let payload: any;
      
      switch (this.config.siem.format) {
        case 'cef':
          payload = this.formatCEF(event);
          break;
        case 'leef':
          payload = this.formatLEEF(event);
          break;
        default:
          payload = event;
      }
      
      // Send to SIEM (implement based on your SIEM system)
      console.log(`📊 SIEM: ${JSON.stringify(payload)}`);
      
    } catch (error) {
      console.error('❌ Security logging: Failed to send to SIEM:', error);
    }
  }

  /**
   * Format event as Common Event Format (CEF)
   */
  private formatCEF(event: SecurityEvent): string {
    return `CEF:0|SimpleRPC|MCPSecurity|1.0|${event.eventType}|${event.details.message}|${this.severityToCEF(event.severity)}|src=${event.source.ip} suser=${event.source.email || 'anonymous'} requestMethod=${event.request.method} requestClientApplication=${event.source.userAgent || 'unknown'}`;
  }

  /**
   * Format event as Log Event Extended Format (LEEF)
   */
  private formatLEEF(event: SecurityEvent): string {
    return `LEEF:2.0|SimpleRPC|MCPSecurity|1.0|${event.eventType}|devTime=${event.timestamp}|src=${event.source.ip}|sev=${this.severityToLEEF(event.severity)}|msg=${event.details.message}`;
  }

  /**
   * Convert severity to CEF format
   */
  private severityToCEF(severity: SecuritySeverity): number {
    switch (severity) {
      case SecuritySeverity.LOW: return 3;
      case SecuritySeverity.MEDIUM: return 5;
      case SecuritySeverity.HIGH: return 7;
      case SecuritySeverity.CRITICAL: return 10;
      default: return 5;
    }
  }

  /**
   * Convert severity to LEEF format
   */
  private severityToLEEF(severity: SecuritySeverity): number {
    return this.severityToCEF(severity);
  }

  /**
   * Generate correlation ID
   */
  private generateCorrelationId(): string {
    return `mcp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get security statistics
   */
  public getSecurityStats() {
    const stats = {
      blockedIPs: this.blockedIPs.size,
      totalEvents: Array.from(this.securityEvents.values()).reduce((sum, events) => sum + events.length, 0),
      alertCounters: Object.fromEntries(this.alertCounters),
      activeIPs: this.securityEvents.size,
      config: {
        siemEnabled: this.config.siem.enabled,
        alertsEnabled: this.config.alerts.enabled,
        anomalyDetectionEnabled: this.config.anomalyDetection.enabled,
        networkFiltersActive: {
          ipBlacklist: this.config.networkFilter.ipBlacklist.length,
          ipWhitelist: this.config.networkFilter.ipWhitelist.length,
          countryBlacklist: this.config.networkFilter.countryBlacklist.length,
          customRules: this.config.networkFilter.customRules.length
        }
      }
    };
    
    return stats;
  }

  /**
   * Manually block/unblock IP
   */
  public blockIP(ip: string, reason: string, durationMinutes: number = 60): void {
    const blockUntil = Date.now() + (durationMinutes * 60 * 1000);
    this.blockedIPs.set(ip, { until: blockUntil, reason });
    
    this.logSecurityEvent({
      eventType: SecurityEventType.IP_BLOCKED,
      severity: SecuritySeverity.HIGH,
      source: { ip },
      request: { method: 'MANUAL', path: '/admin-block', headers: {} },
      details: {
        message: `IP manually blocked: ${reason}`,
        context: { durationMinutes, blockUntil: new Date(blockUntil) },
        actionTaken: 'Manual IP block'
      }
    });
  }

  public unblockIP(ip: string): boolean {
    const wasBlocked = this.blockedIPs.has(ip);
    this.blockedIPs.delete(ip);
    
    if (wasBlocked) {
      this.logSecurityEvent({
        eventType: SecurityEventType.ADMIN_ACTION,
        severity: SecuritySeverity.LOW,
        source: { ip },
        request: { method: 'MANUAL', path: '/admin-unblock', headers: {} },
        details: {
          message: `IP manually unblocked`,
          actionTaken: 'Manual IP unblock'
        }
      });
    }
    
    return wasBlocked;
  }
}

/**
 * Default instance for easy use
 */
let defaultSecurityLogger: SecurityLogger | null = null;

/**
 * Get or create default security logger instance
 */
export function getDefaultSecurityLogger(config?: Partial<SecurityLoggerConfig>): SecurityLogger {
  if (!defaultSecurityLogger) {
    defaultSecurityLogger = new SecurityLogger(config);
  }
  return defaultSecurityLogger;
}

/**
 * Express middleware factory for security logging
 */
export function createSecurityLoggingMiddleware(config?: Partial<SecurityLoggerConfig>) {
  const logger = new SecurityLogger(config);
  return {
    networkFilter: logger.createNetworkFilterMiddleware(),
    mcpLogging: logger.createMCPLoggingMiddleware(),
    logger
  };
}