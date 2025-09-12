# MCP Function Signature Monitoring System

## Overview

The MCP Function Signature Monitoring System provides real-time detection and alerting for schema changes in MCP tools, protecting against unauthorized modifications, tampering, and security vulnerabilities. The system supports differentiated policies for internal vs external MCP servers.

## Status
✅ **Complete** - Fully implemented and tested

## Architecture

### Core Components

1. **MCPFunctionMonitor** - Main monitoring service
2. **Schema Change Detection Engine** - Detects parameter additions, removals, type changes
3. **Risk Assessment Engine** - Evaluates security impact of changes
4. **Policy Engine** - Different rules for internal vs external servers
5. **Alert Manager** - Configurable notifications and escalation

## Key Features

### 1. Real-time Schema Monitoring
- **Continuous Monitoring** - Background detection of tRPC procedure schema changes
- **Hash-based Change Detection** - SHA-256 hashing for reliable change detection
- **Metadata Analysis** - Tracks parameter counts, types, security characteristics
- **Baseline Snapshots** - Persistent schema baselines for comparison

### 2. Comprehensive Change Detection
```typescript
enum SchemaChangeType {
  PARAMETER_ADDED = 'parameter_added',
  PARAMETER_REMOVED = 'parameter_removed', 
  TYPE_CHANGED = 'type_changed',
  REQUIRED_CHANGED = 'required_changed',
  DESCRIPTION_CHANGED = 'description_changed',
  ENUM_VALUES_CHANGED = 'enum_values_changed'
}
```

### 3. Risk-based Assessment
- **Impact Levels**: Low, Medium, High, Critical
- **Risk Scoring** (0-10 scale)
- **Security-aware Analysis**: File access, system commands, elevated privileges
- **Change Percentage Tracking**: Percentage of schema modified

### 4. Configurable Sensitivity Levels

#### Strict Mode (0% tolerance)
```typescript
const strictConfig = {
  changeDetectionLevel: 'strict',
  changeThresholds: { strict: 0 }, // Alert on any change
  autoDisableOnChange: true,
  alertOnAnyChange: true
}
```

#### Moderate Mode (20% tolerance) - Default
```typescript  
const moderateConfig = {
  changeDetectionLevel: 'moderate',
  changeThresholds: { moderate: 20 }, // Alert if >20% changed
  autoDisableOnChange: false,
  focusOnHighRiskChanges: true
}
```

#### Loose Mode (60% tolerance)
```typescript
const looseConfig = {
  changeDetectionLevel: 'loose', 
  changeThresholds: { loose: 60 }, // Alert if >60% changed
  autoDisableOnChange: false,
  alertOnCriticalOnly: true
}
```

## Internal vs External MCP Server Handling

### Policy Differentiation

The system supports different monitoring policies for internal vs external MCP servers:

```typescript
interface MCPServerPolicy {
  serverType: 'internal' | 'external';
  changeDetectionLevel: 'strict' | 'moderate' | 'loose';
  autoDisableOnChange: boolean;
  allowedChangeTypes: SchemaChangeType[];
  requiresApproval: boolean;
  escalationLevel: 'none' | 'team' | 'security' | 'executive';
}

const policyConfig = {
  internal: {
    serverType: 'internal',
    changeDetectionLevel: 'loose',    // Less strict for internal
    autoDisableOnChange: false,
    allowedChangeTypes: ['parameter_added', 'description_changed'],
    requiresApproval: false,
    escalationLevel: 'team'
  },
  external: {
    serverType: 'external', 
    changeDetectionLevel: 'strict',     // Very strict for external
    autoDisableOnChange: true,
    allowedChangeTypes: [],             // No changes allowed without approval
    requiresApproval: true,
    escalationLevel: 'security'
  }
}
```

### Server Classification

#### Automatic Classification
```typescript
class MCPServerClassifier {
  classifyServer(serverUrl: string, metadata: any): 'internal' | 'external' {
    // Internal server indicators
    if (serverUrl.includes('localhost') || 
        serverUrl.includes('127.0.0.1') ||
        serverUrl.includes('.internal.') ||
        metadata.trust_level === 'internal') {
      return 'internal';
    }
    
    // External by default
    return 'external';
  }
}
```

#### Manual Classification
```typescript
const serverRegistry = {
  'https://api.internal-service.company.com': 'internal',
  'https://trusted-partner.example.com': 'internal',
  'https://untrusted-third-party.com': 'external'
}
```

### Policy Enforcement

#### Internal Server Monitoring
- **Loose Monitoring**: Focus on critical changes only
- **Development Friendly**: Allow common development changes
- **Team Notifications**: Alert development teams, not security
- **Automatic Recovery**: Auto-approve expected internal changes

#### External Server Monitoring  
- **Strict Monitoring**: Every change is monitored and logged
- **Zero Trust**: No changes without explicit approval
- **Security Escalation**: Critical changes escalate to security team
- **Automatic Blocking**: Suspicious changes disable server immediately

## Security Features

### 1. Credential and PII Protection

The logging system implements comprehensive protection against credential exposure:

```typescript
class SecureLogSanitizer {
  private sensitivePatterns = [
    // API Keys
    /api[_-]?key[=:\s]+[a-zA-Z0-9_-]+/gi,
    /key[=:\s]+[a-zA-Z0-9_-]{20,}/gi,
    
    // Passwords
    /password[=:\s]+\S+/gi,
    /passwd[=:\s]+\S+/gi,
    /pwd[=:\s]+\S+/gi,
    
    // Tokens
    /token[=:\s]+[a-zA-Z0-9_.-]+/gi,
    /bearer\s+[a-zA-Z0-9_.-]+/gi,
    /jwt[=:\s]+[a-zA-Z0-9_.-]+/gi,
    
    // Database connections
    /mongodb:\/\/[^@]+@/gi,
    /postgres:\/\/[^@]+@/gi,
    /mysql:\/\/[^@]+@/gi,
    
    // Environment variables (common patterns)
    /[A-Z_]+_SECRET[=:\s]+\S+/gi,
    /[A-Z_]+_KEY[=:\s]+\S+/gi,
    /[A-Z_]+_PASSWORD[=:\s]+\S+/gi,
    
    // Email addresses (PII)
    /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi,
    
    // Phone numbers (PII)
    /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g,
    
    // Credit card numbers (PII)
    /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g,
    
    // Social Security Numbers (PII)
    /\b\d{3}-\d{2}-\d{4}\b/g
  ];

  sanitize(data: any): any {
    if (typeof data === 'string') {
      return this.sanitizeString(data);
    } else if (typeof data === 'object' && data !== null) {
      return this.sanitizeObject(data);
    }
    return data;
  }

  private sanitizeString(str: string): string {
    let sanitized = str;
    for (const pattern of this.sensitivePatterns) {
      sanitized = sanitized.replace(pattern, '[REDACTED]');
    }
    return sanitized;
  }

  private sanitizeObject(obj: any): any {
    const sanitized: any = Array.isArray(obj) ? [] : {};
    
    for (const [key, value] of Object.entries(obj)) {
      // Skip sensitive keys entirely
      if (this.isSensitiveKey(key)) {
        sanitized[key] = '[REDACTED]';
        continue;
      }
      
      sanitized[key] = this.sanitize(value);
    }
    
    return sanitized;
  }

  private isSensitiveKey(key: string): boolean {
    const sensitiveKeys = [
      'password', 'passwd', 'pwd',
      'secret', 'key', 'token',
      'api_key', 'apikey', 'access_key',
      'private_key', 'privatekey',
      'authorization', 'auth',
      'cookie', 'session',
      'email', 'phone', 'ssn',
      'credit_card', 'creditcard'
    ];
    
    const keyLower = key.toLowerCase();
    return sensitiveKeys.some(sensitive => 
      keyLower.includes(sensitive)
    );
  }
}
```

### 2. Structured Logging with Security Context

```typescript
interface SecureLogEntry {
  timestamp: string;
  eventType: string;
  severity: SecuritySeverity;
  source: {
    serverType: 'internal' | 'external';
    serverUrl?: string;
    ip: string;
    userAgent?: string;
  };
  change: {
    toolName: string;
    changeType: SchemaChangeType;
    riskScore: number;
    changePercentage: number;
    autoDisabled: boolean;
  };
  sanitizedContext: any; // All sensitive data removed
  correlationId: string;
}
```

### 3. Audit Trail

```typescript
class MCPAuditTrail {
  async logSchemaChange(change: SchemaChangeAnalysis, serverType: 'internal' | 'external') {
    const auditEntry = {
      timestamp: new Date().toISOString(),
      eventId: generateEventId(),
      serverType,
      toolName: change.toolName,
      changeDetails: this.sanitizer.sanitize(change.changes),
      riskAssessment: {
        score: change.riskScore,
        severity: change.severity,
        autoActions: {
          disabled: change.recommended.shouldDisable,
          escalated: change.recommended.shouldEscalate
        }
      },
      approvalStatus: serverType === 'external' ? 'pending' : 'auto-approved',
      reviewRequired: serverType === 'external'
    };
    
    await this.auditStore.save(auditEntry);
  }
}
```

## Configuration Examples

### Enterprise Production Configuration
```typescript
const enterpriseConfig: MCPFunctionMonitorConfig = {
  // Default to strict for all servers
  changeDetectionLevel: 'strict',
  autoDisableOnChange: true,
  monitoringIntervalMs: 30000, // Check every 30 seconds
  
  // Persistent storage for compliance
  persistSchemas: true,
  schemaStoragePath: '/var/lib/mcp-schemas',
  
  // Policy overrides by server type
  serverPolicies: {
    internal: {
      changeDetectionLevel: 'moderate',
      autoDisableOnChange: false,
      allowedChanges: [
        'parameter_added:optional',
        'description_changed',
        'enum_values_extended'
      ]
    },
    external: {
      changeDetectionLevel: 'strict',
      autoDisableOnChange: true,
      allowedChanges: [], // Nothing allowed without approval
      requireSecurityReview: true
    }
  },
  
  // Security settings
  sanitization: {
    enabled: true,
    strictMode: true,
    customPatterns: [
      /COMPANY_SECRET[=:\s]+\S+/gi,
      /INTERNAL_TOKEN[=:\s]+\S+/gi
    ]
  },
  
  // Audit settings
  audit: {
    retentionDays: 2555, // 7 years for compliance
    exportFormat: 'json',
    integrityChecking: true
  }
};
```

### Development Configuration
```typescript
const devConfig: MCPFunctionMonitorConfig = {
  changeDetectionLevel: 'loose',
  autoDisableOnChange: false,
  monitoringIntervalMs: 60000, // Every minute
  
  serverPolicies: {
    internal: {
      changeDetectionLevel: 'loose',
      autoDisableOnChange: false,
      alertOnCriticalOnly: true
    },
    external: {
      changeDetectionLevel: 'moderate', 
      autoDisableOnChange: false,
      requireApproval: false // More permissive in dev
    }
  },
  
  sanitization: {
    enabled: true,
    strictMode: false, // Less aggressive in dev
    logLevel: 'debug'
  }
};
```

## Implementation Integration

### tRPC Router Integration
```typescript
// In your tRPC router setup
import { MCPFunctionMonitor } from './security/mcp-function-monitor';
import { getDefaultSecurityLogger } from './security/security-logger';

const securityLogger = getDefaultSecurityLogger();
const mcpMonitor = new MCPFunctionMonitor(securityLogger, {
  changeDetectionLevel: 'moderate',
  serverPolicies: {
    internal: { changeDetectionLevel: 'loose' },
    external: { changeDetectionLevel: 'strict' }
  }
});

// Start monitoring your MCP router
mcpMonitor.startMonitoring(mcpRouter);

// Optional: Manual monitoring trigger
setInterval(() => {
  mcpMonitor.monitorSchemaChanges();
}, 60000);
```

### Server Classification
```typescript
// Automatic server classification in MCP handler
app.post('/mcp', (req: Request, res: Response) => {
  const serverType = classifyMCPServer(req.headers.origin);
  const policy = mcpMonitor.getPolicyForServerType(serverType);
  
  // Apply appropriate monitoring policy
  mcpMonitor.applyPolicy(policy, req.body.method);
});

function classifyMCPServer(origin?: string): 'internal' | 'external' {
  if (!origin) return 'external';
  
  const internalDomains = [
    'localhost',
    '.company.internal',
    '.trusted-partner.com'
  ];
  
  return internalDomains.some(domain => origin.includes(domain)) 
    ? 'internal' 
    : 'external';
}
```

## Monitoring and Alerting

### Dashboard Metrics
- **Schema Change Frequency** (internal vs external)
- **Risk Score Distribution** 
- **Auto-disabled Tools** by category
- **Policy Violations** and escalations
- **Response Times** for critical changes

### Alert Escalation
```typescript
const alertEscalation = {
  internal: {
    low: ['team-lead@company.com'],
    medium: ['dev-team@company.com'], 
    high: ['security-team@company.com'],
    critical: ['security-team@company.com', 'cto@company.com']
  },
  external: {
    low: ['security-team@company.com'],
    medium: ['security-team@company.com', 'compliance@company.com'],
    high: ['security-team@company.com', 'ciso@company.com'],
    critical: ['security-team@company.com', 'ciso@company.com', 'ceo@company.com']
  }
};
```

## Compliance and Governance

### Regulatory Compliance
- **SOX Compliance**: 7-year audit trail retention
- **GDPR**: PII anonymization in logs
- **HIPAA**: Healthcare data protection patterns
- **PCI-DSS**: Credit card data pattern detection

### Access Controls
- **Role-based Access**: Admin, Security, Audit, Developer roles
- **Audit Log Protection**: Immutable logging with integrity checks
- **Change Approval Workflow**: Required approvals for external server changes

## Testing Strategy

### Security Testing
```bash
# Test credential sanitization
npm run test:security -- --grep "should not log credentials"

# Test change detection accuracy
npm run test:monitor -- --grep "should detect schema changes"

# Test policy enforcement
npm run test:policy -- --grep "should apply correct policies"
```

### Performance Testing
- **Large Schema Handling**: 1000+ tools monitoring
- **High Frequency Changes**: Change detection under load
- **Memory Usage**: Long-running monitoring stability

## Future Enhancements

1. **Machine Learning**: AI-powered anomaly detection
2. **Behavioral Analysis**: User pattern monitoring
3. **Threat Intelligence**: External threat feed integration
4. **Automated Remediation**: Self-healing security responses
5. **Cross-server Correlation**: Multi-server change pattern analysis

## Conclusion

The MCP Function Signature Monitoring System provides enterprise-grade security monitoring with the flexibility to handle both internal development workflows and external security requirements. The differentiated policy system ensures development velocity while maintaining strict security controls where needed.