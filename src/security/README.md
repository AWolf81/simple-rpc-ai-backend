# Security Test Helpers

This module provides utilities to easily disable security features during testing, making it much easier to write and run tests without hitting rate limits or security blocks.

## Quick Start

### For Tests

```typescript
import { createTestMCPConfig } from '../src/security/test-helpers';

// Use in your test server configuration
const server = createRpcAiServer({
  mcp: createTestMCPConfig()
});
```

### Environment Variables

You can also disable security features using environment variables:

```bash
# Disable all MCP security features
DISABLE_MCP_SECURITY=true npm test

# Or disable specific features
DISABLE_RATE_LIMITING=true npm test
DISABLE_SECURITY_LOGGING=true npm test
```

## What Gets Disabled

When using the test helpers, the following security features are disabled:

### Rate Limiting
- Express-level rate limiting (set to 0 requests)
- MCP-specific rate limiting 
- Tool-specific rate limits
- Burst protection

### Security Logging
- Network filtering (IP blocking, geolocation, etc.)
- Security event logging
- Anomaly detection
- SIEM integration
- Alert thresholds

### What Stays Enabled

The following security features remain active for testing the security logic itself:
- Input sanitization (for testing security filters)
- Authentication checks (for testing auth logic)
- Scope validation (for testing authorization)

## Manual Configuration

If you need more control, you can manually configure disabled security:

```typescript
import { DISABLED_RATE_LIMITING, DISABLED_SECURITY_LOGGING } from '../src/security/test-helpers';

const server = createRpcAiServer({
  mcp: {
    enableMCP: true,
    rateLimiting: DISABLED_RATE_LIMITING,
    securityLogging: DISABLED_SECURITY_LOGGING,
    // ... other config
  }
});
```

## Automatic Detection

The helpers automatically detect test environments:
- `NODE_ENV=test`
- `VITEST=true` 
- `JEST_WORKER_ID` is set
- Command line contains 'vitest' or 'jest'

## Production Safety

These helpers will only disable security features when:
1. Explicitly called with the test helper functions, OR
2. Running in a detected test environment, OR  
3. Environment variables are explicitly set

In production environments, all security features remain fully active by default.