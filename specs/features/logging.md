# MCP Logging, Auditing, and Security Event Detection Specification

## Overview

This specification defines a comprehensive logging, auditing, and security event detection system for MCP servers. The system provides enterprise-grade observability, security monitoring, and configurable alerting capabilities suitable for production deployments.

## Status
📝 **Draft** - Ready for implementation

## Architecture

### Core Components

1. **Security Logger** (`SecurityLogger` class) - Central logging service
2. **Event Detection Engine** - Monitors for security and operational anomalies  
3. **Alert Manager** - Configurable notification system
4. **MCP Function Signature Monitor** - Detects schema changes in MCP tools
5. **SIEM Integration** - Enterprise log forwarding

### Current Implementation Status

✅ **COMPLETED**:
- Comprehensive security event logging with Winston
- Network filtering with IP/geo-based blocking
- Anomaly detection with configurable thresholds
- Express middleware for MCP request monitoring
- Auto-blocking after security event thresholds
- SIEM integration (JSON/CEF/LEEF formats)
- Alert system with webhook/email notifications

## Logging Capabilities

### Current Logging Features

#### Security Event Types
```typescript
enum SecurityEventType {
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
  SYSTEM_OVERRIDE_ATTEMPT = 'system_override_attempt'
}
```

#### Structured Log Format
Each security event includes:
- **Timestamp** (ISO format)
- **Event Type & Severity** (LOW/MEDIUM/HIGH/CRITICAL)
- **Source Information** (IP, user agent, user ID, geolocation)
- **Request Details** (method, path, headers, MCP method, tool name)
- **Context & Analysis** (risk score, blocked reasons, actions taken)
- **Correlation ID** for cross-service tracing

#### Network Security Filtering
- **IP Whitelist/Blacklist** - Always allow/block specific IPs
- **Geolocation Filtering** - Country-based blocking
- **Tor/VPN/Proxy Detection** - Block anonymization services  
- **Auto-blocking** - Temporary bans after security event thresholds
- **Custom Rules** - Configurable request filtering logic

#### Anomaly Detection
Monitors for:
- **High Request Rates** - Unusual requests per minute
- **Multiple User Agents** - Too many user agents from single IP
- **Endpoint Scanning** - Accessing many different endpoints
- **High Error Rates** - Percentage of failed requests

## Required Enhancements

### 1. MCP Function Signature Change Detection

**Current Gap**: No monitoring for MCP tool schema changes that could indicate tampering or security issues.

**Implementation Needed**:

```typescript
interface MCPFunctionMonitor {
  // Configurable change detection sensitivity
  changeDetectionLevel: 'strict' | 'moderate' | 'loose';
  
  // Percentage thresholds for change alerts
  changeThresholds: {
    strict: 0,      // Alert on any change
    moderate: 20,   // Alert if >20% of schema changes
    loose: 60     // Alert if >60% of schema changes  
  };
  
  // Auto-disable tools on suspicious changes
  autoDisableOnChange: boolean;
  
  // Whitelist of expected schema changes
  allowedChanges: {
    toolName: string;
    expectedChanges: string[];
    validUntil: Date;
  }[];
}
```

**Detection Mechanisms**:

1. **Schema Fingerprinting** - Hash tool schemas to detect changes
2. **Semantic Analysis** - Detect parameter additions, removals, type changes
3. **Behavioral Monitoring** - Track tool execution patterns
4. **Version Control Integration** - Compare against known good schemas

### 2. Enhanced Security Event Triggers

**New Event Types Needed**:

```typescript
enum EnhancedSecurityEventType {
  // MCP-specific events
  MCP_TOOL_SCHEMA_CHANGED = 'mcp_tool_schema_changed',
  MCP_TOOL_AUTO_DISABLED = 'mcp_tool_auto_disabled', 
  MCP_SUSPICIOUS_TOOL_CALL = 'mcp_suspicious_tool_call',
  MCP_TOOL_EXECUTION_TIMEOUT = 'mcp_tool_execution_timeout',
  MCP_RESOURCE_ACCESS_VIOLATION = 'mcp_resource_access_violation',
  
  // Advanced threat detection
  CREDENTIAL_STUFFING_DETECTED = 'credential_stuffing_detected',
  BRUTE_FORCE_ATTACK = 'brute_force_attack',
  API_KEY_COMPROMISE_SUSPECTED = 'api_key_compromise_suspected',
  PRIVILEGE_ESCALATION_ATTEMPT = 'privilege_escalation_attempt',
  DATA_EXFILTRATION_SUSPECTED = 'data_exfiltration_suspected',
  
  // Compliance and audit
  COMPLIANCE_VIOLATION = 'compliance_violation',
  AUDIT_LOG_TAMPERING = 'audit_log_tampering',
  UNAUTHORIZED_CONFIGURATION_CHANGE = 'unauthorized_config_change'
}
```

### 3. Configurable Alert Thresholds

**Admin Notification Triggers**:

```typescript
interface AlertConfiguration {
  // MCP function signature changes
  functionSignatureChanges: {
    enabled: boolean;
    sensitivity: 'strict' | 'moderate' | 'loose';
    notificationChannels: ('email' | 'webhook' | 'slack' | 'sms')[];
    escalationTiers: {
      immediate: string[];  // Critical changes
      hourly: string[];     // Moderate changes  
      daily: string[];      // Minor changes
    };
  };
  
  // Security event clustering
  securityEventClustering: {
    enabled: boolean;
    windowMinutes: number;
    thresholds: {
      [eventType: string]: {
        count: number;
        severity: SecuritySeverity;
        action: 'log' | 'alert' | 'block' | 'escalate';
      };
    };
  };
  
  // Behavioral anomalies  
  behavioralAnomalies: {
    enabled: boolean;
    baselineTrainingDays: number;
    sensitivityMultiplier: number;
    alertOnDeviation: boolean;
  };
}
```

### 4. Advanced Logging Metadata

**Enhanced Contextual Information**:

```typescript
interface EnhancedSecurityEvent {
  // Existing fields...
  
  // MCP-specific context
  mcpContext: {
    toolName?: string;
    toolVersion?: string;
    schemaHash?: string;
    executionTime?: number;
    resourcesAccessed?: string[];
    parametersHash?: string;
  };
  
  // Security analysis
  threatIntelligence: {
    ipReputation?: 'clean' | 'suspicious' | 'malicious';
    knownAttackPatterns?: string[];
    confidenceScore?: number;
    riskFactors?: string[];
  };
  
  // Compliance tracking
  compliance: {
    dataClassification?: 'public' | 'internal' | 'confidential' | 'restricted';
    regulatoryFlags?: ('GDPR' | 'HIPAA' | 'SOX' | 'PCI-DSS')[];
    retentionPeriod?: number;
  };
  
  // Performance metrics
  performance: {
    responseTime?: number;
    memoryUsage?: number;
    cpuUsage?: number;
    networkLatency?: number;
  };
}
```

## Implementation Plan

### Phase 1: MCP Function Signature Monitoring (Week 1-2)

```typescript
class MCPSchemaMonitor {
  private schemaHashes: Map<string, string> = new Map();
  private baselineSchemas: Map<string, any> = new Map();
  
  /**
   * Monitor tRPC procedures for schema changes
   */
  async monitorSchemaChanges(router: any): Promise<void> {
    const currentProcedures = this.extractProcedures(router);
    
    for (const [name, procedure] of currentProcedures) {
      const currentSchema = this.hashSchema(procedure.inputSchema);
      const previousHash = this.schemaHashes.get(name);
      
      if (previousHash && previousHash !== currentSchema) {
        await this.handleSchemaChange(name, procedure, previousHash, currentSchema);
      }
      
      this.schemaHashes.set(name, currentSchema);
    }
  }
  
  private async handleSchemaChange(
    toolName: string, 
    procedure: any,
    oldHash: string, 
    newHash: string
  ): Promise<void> {
    const changeAnalysis = this.analyzeSchemaChange(procedure);
    const severity = this.calculateChangeSeverity(changeAnalysis);
    
    // Log security event
    await securityLogger.logSecurityEvent({
      eventType: SecurityEventType.MCP_TOOL_SCHEMA_CHANGED,
      severity,
      source: { ip: 'system' },
      request: { method: 'SCHEMA_MONITOR', path: '/schema-change', headers: {} },
      details: {
        message: `MCP tool schema changed: ${toolName}`,
        context: {
          toolName,
          oldHash,
          newHash,
          changeAnalysis,
          autoDisabled: severity === SecuritySeverity.CRITICAL
        }
      }
    });
    
    // Auto-disable if critical change
    if (severity === SecuritySeverity.CRITICAL && this.config.autoDisableOnChange) {
      await this.disableTool(toolName, 'Critical schema change detected');
    }
  }
}
```

### Phase 2: Enhanced Threat Detection (Week 3-4)

```typescript
class ThreatDetectionEngine {
  private behaviorProfiles: Map<string, UserBehaviorProfile> = new Map();
  
  /**
   * Analyze request patterns for threats
   */
  async analyzeRequest(event: SecurityEvent): Promise<ThreatAnalysis> {
    const analysis: ThreatAnalysis = {
      riskScore: 0,
      threats: [],
      recommendedActions: []
    };
    
    // Credential stuffing detection
    if (await this.detectCredentialStuffing(event)) {
      analysis.threats.push('credential_stuffing');
      analysis.riskScore += 7;
    }
    
    // Behavioral anomaly detection
    const behaviorAnomaly = await this.detectBehavioralAnomaly(event);
    if (behaviorAnomaly.score > 0.7) {
      analysis.threats.push('behavioral_anomaly');
      analysis.riskScore += behaviorAnomaly.score * 5;
    }
    
    // API key compromise detection
    if (await this.detectApiKeyCompromise(event)) {
      analysis.threats.push('api_key_compromise');
      analysis.riskScore += 9;
    }
    
    return analysis;
  }
}
```

### Phase 3: Advanced Alerting & Escalation (Week 5-6)

```typescript
class AlertManager {
  private escalationRules: Map<string, EscalationRule> = new Map();
  
  /**
   * Process security event and determine alerting strategy
   */
  async processEvent(event: EnhancedSecurityEvent): Promise<void> {
    const alertStrategy = this.determineAlertStrategy(event);
    
    // Immediate critical alerts
    if (alertStrategy.immediate) {
      await this.sendImmediateAlert(event);
    }
    
    // Clustered event analysis
    await this.addToCluster(event);
    const clusterAnalysis = await this.analyzeEventClusters();
    
    if (clusterAnalysis.requiresAlert) {
      await this.sendClusterAlert(clusterAnalysis);
    }
    
    // Escalation handling
    if (event.severity === SecuritySeverity.CRITICAL) {
      await this.initiateEscalation(event);
    }
  }
  
  private async sendImmediateAlert(event: EnhancedSecurityEvent): Promise<void> {
    const alert: SecurityAlert = {
      id: generateAlertId(),
      timestamp: new Date().toISOString(),
      severity: event.severity,
      title: this.generateAlertTitle(event),
      description: this.generateAlertDescription(event),
      recommendedActions: this.getRecommendedActions(event),
      sourceEvent: event
    };
    
    // Send via configured channels
    await Promise.all([
      this.sendEmailAlert(alert),
      this.sendWebhookAlert(alert),
      this.sendSlackAlert(alert)
    ]);
  }
}
```

## Configuration Examples

### Strict Security Configuration
```typescript
const strictSecurityConfig: SecurityLoggerConfig = {
  enabled: true,
  networkFilter: {
    enabled: true,
    blockTor: true,
    blockVPN: true,
    blockProxies: true,
    autoBlockThreshold: 3,  // Block after 3 events
    autoBlockDuration: 120  // 2 hour blocks
  },
  anomalyDetection: {
    enabled: true,
    windowMinutes: 5,
    thresholds: {
      requestsPerMinute: 30,
      uniqueUserAgents: 3,
      distinctEndpoints: 10,
      errorRate: 25
    }
  },
  mcpFunctionMonitoring: {
    changeDetectionLevel: 'strict',
    autoDisableOnChange: true,
    alertOnAnyChange: true
  }
};
```

### Moderate Security Configuration
```typescript
const moderateSecurityConfig: SecurityLoggerConfig = {
  enabled: true,
  networkFilter: {
    enabled: true,
    blockTor: false,
    blockVPN: false, 
    blockProxies: true,
    autoBlockThreshold: 10,
    autoBlockDuration: 60
  },
  anomalyDetection: {
    enabled: true,
    windowMinutes: 15,
    thresholds: {
      requestsPerMinute: 100,
      uniqueUserAgents: 10,
      distinctEndpoints: 25,
      errorRate: 50
    }
  },
  mcpFunctionMonitoring: {
    changeDetectionLevel: 'moderate',
    autoDisableOnChange: false,
    changeThreshold: 20  // Alert if >20% schema change
  }
};
```

## Integration Points

### 1. MCP Server Integration
```typescript
// In mcp-server.ts
const securityLogger = new SecurityLogger(securityConfig);

app.use('/mcp', 
  securityLogger.createNetworkFilterMiddleware(),
  securityLogger.createMCPLoggingMiddleware()
);

// Monitor tool schema changes
const schemaMonitor = new MCPSchemaMonitor(securityLogger);
setInterval(() => {
  schemaMonitor.monitorSchemaChanges(mcpRouter);
}, 60000); // Check every minute
```

### 2. tRPC Router Integration  
```typescript
// In trpc/routers/mcp.ts
const securityLogger = getDefaultSecurityLogger();

export const mcpRouter = router({
  listTools: publicProcedure
    .meta({ 
      mcp: { 
        description: 'List available MCP tools',
        monitorSchemaChanges: true 
      } 
    })
    .query(async ({ ctx }) => {
      // Log tool access
      await securityLogger.logSecurityEvent({
        eventType: SecurityEventType.AUTH_SUCCESS,
        severity: SecuritySeverity.LOW,
        source: { ip: ctx.req.ip },
        request: { method: 'tools/list', path: '/mcp', headers: {} },
        details: { message: 'MCP tools listed' }
      });
      
      return discoverMCPTools();
    })
});
```

### 3. SIEM Integration
```typescript
// Configure SIEM forwarding
const siemConfig = {
  enabled: true,
  webhook: 'https://siem.company.com/api/events',
  apiKey: process.env.SIEM_API_KEY,
  format: 'json' // or 'cef', 'leef'
};

const securityLogger = new SecurityLogger({
  siem: siemConfig
});
```

## Monitoring Dashboards

### Key Metrics to Track

1. **Security Events Per Hour** (by severity)
2. **Top Blocked IPs and Countries**  
3. **MCP Tool Schema Changes** (frequency and types)
4. **Anomaly Detection Triggers**
5. **Failed Authentication Attempts**
6. **Auto-disabled Tools and Reasons**
7. **Alert Response Times**
8. **SIEM Integration Health**

### Sample Dashboard Queries

```sql
-- Security events by severity (last 24 hours)
SELECT severity, COUNT(*) as count
FROM security_events 
WHERE timestamp > NOW() - INTERVAL 24 HOUR
GROUP BY severity;

-- Top attacked endpoints
SELECT request_path, COUNT(*) as attack_count
FROM security_events
WHERE event_type IN ('command_injection_attempt', 'template_injection_attempt')
AND timestamp > NOW() - INTERVAL 7 DAY  
GROUP BY request_path
ORDER BY attack_count DESC;

-- MCP schema change frequency
SELECT tool_name, COUNT(*) as change_count
FROM security_events
WHERE event_type = 'mcp_tool_schema_changed'
AND timestamp > NOW() - INTERVAL 30 DAY
GROUP BY tool_name;
```

## Compliance Considerations

### Data Retention
- **Security logs**: 7 years (compliance requirement)
- **Audit logs**: 3 years (regulatory requirement)  
- **Performance logs**: 90 days (operational need)
- **Debug logs**: 30 days (troubleshooting)

### Data Privacy
- **PII Scrubbing**: Automatically remove/mask personal information
- **Credential Protection**: Never log API keys, passwords, or tokens
- **Anonymization**: Option to anonymize IP addresses for GDPR compliance

### Access Controls
- **Role-based log access**: Admin, Security, Audit roles
- **Log integrity**: Cryptographic hashing to prevent tampering
- **Export capabilities**: Support for compliance audits

## Testing Strategy

### Security Event Simulation
```typescript
// Test injection detection
const injectionTest = {
  method: 'tools/call',
  params: {
    name: 'execute',
    arguments: { command: 'cat /etc/passwd; rm -rf /' }
  }
};

// Test anomaly detection  
const anomalyTest = async () => {
  // Generate 200 requests from same IP in 1 minute
  for (let i = 0; i < 200; i++) {
    await makeTestRequest();
  }
};

// Test schema change detection
const schemaChangeTest = {
  addParameter: true,
  removeParameter: true,  
  changeParameterType: true,
  addRequiredField: true
};
```

## Success Metrics

1. **Mean Time to Detection (MTTD)** < 5 minutes for critical events
2. **Mean Time to Response (MTTR)** < 30 minutes for critical alerts  
3. **False Positive Rate** < 5% for security alerts
4. **Schema Change Detection** > 99% accuracy
5. **Log Integrity** 100% (no tampering detected)
6. **SIEM Integration** > 99.9% uptime
7. **Compliance Audit** 100% pass rate

## Future Enhancements

1. **Machine Learning Integration** - AI-powered threat detection
2. **Behavioral Biometrics** - Advanced user behavior analysis  
3. **Threat Intelligence Feeds** - External threat data integration
4. **Automated Response** - Self-healing security responses
5. **Privacy-Preserving Analytics** - Differential privacy techniques
6. **Distributed Logging** - Multi-node log aggregation
7. **Real-time Streaming** - WebSocket/SSE event feeds