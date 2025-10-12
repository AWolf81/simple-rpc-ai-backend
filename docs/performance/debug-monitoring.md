---
title: Debug & Monitoring
parent: Performance
grand_parent: Documentation
nav_order: 2
---

# Debug & Performance Monitoring

Configure detailed performance timing logs and debug output for troubleshooting and optimization.

---

## Enable Performance Timing Logs

Track detailed performance metrics for debugging and optimization.

### Via Environment Variable (Recommended for Development)

```bash
# Enable timing logs
ENABLE_TIMING=true pnpm dev

# Or for specific examples
ENABLE_TIMING=true pnpm dev:server:basic
```

### Via Server Configuration

```typescript
import { createRpcAiServer } from 'simple-rpc-ai-backend';

const server = createRpcAiServer({
  debug: {
    enableTiming: true  // Enable detailed timing logs
  }
});
```

---

## Timing Output Format

When timing is enabled, you'll see hierarchical timing breakdowns for each request:

### Example: AI Generation Request

```
[TIMING-RPC] ┌─ Started at 2025-10-02T06:15:00.423Z
[TIMING-RPC] ├─ Request parsed: 0.10ms (total: 0.10ms)
[TIMING-RPC] ├─ Context created: 0.29ms (total: 0.39ms)
[TIMING-RPC] ├─ Caller created: 0.22ms (total: 0.61ms)
[TIMING-RPC] ├─ Procedure resolved: 0.10ms (total: 0.71ms)
  [TIMING-AI] ┌─ Started
  [TIMING-AI] ├─ Input parsed: 0.10ms (total: 0.10ms)
  [TIMING-AI] ├─ Calling aiService.execute: 0.05ms (total: 0.15ms)
    [TIMING-SERVICE] ┌─ Started
    [TIMING-SERVICE] ├─ Request validation: 0.06ms (total: 0.06ms)
    [TIMING-SERVICE] ├─ Model retrieved: 6.70ms (total: 6.75ms)
    [TIMING-SERVICE] ├─ Prepared AI execution: 0.51ms (total: 7.26ms)
    [TIMING-SERVICE] ├─ Calling generateText (Vercel AI SDK): 0.52ms (total: 7.78ms)
    [TIMING-SERVICE] ├─ generateText completed: 1538.23ms (total: 1546.01ms)
    [TIMING-SERVICE] └─ Total time: 1546.14ms
  [TIMING-AI] ├─ AI execution completed: 1546.90ms (total: 1547.04ms)
  [TIMING-AI] └─ Total time: 1547.12ms
[TIMING-RPC] ├─ Procedure ai.generateText executed: 1548.27ms (total: 1548.56ms)
[TIMING-RPC] ├─ Response sent: 0.56ms (total: 1549.12ms)
[TIMING-RPC] └─ Total time: 1549.18ms
```

### Timing Breakdown Analysis

| Layer | Time | Percentage | Description |
|-------|------|------------|-------------|
| **RPC Layer** | 0.71ms | 0.05% | JSON-RPC parsing and routing |
| **AI Procedure** | 0.15ms | 0.01% | Parameter parsing and validation |
| **Service Layer (Setup)** | 7.26ms | 0.47% | Model retrieval and execution prep |
| **Anthropic API Call** | 1538ms | 99.24% | External API network request |
| **Response Formatting** | 0.56ms | 0.04% | JSON serialization |
| **Total Server Overhead** | ~8ms | 0.56% | All non-API time |

---

## Verbose Debug Logs

Control verbose debug output via the `LOG_LEVEL` environment variable.

### Log Levels

```bash
# Show all debug logs (verbose)
LOG_LEVEL=debug pnpm dev
# Output: 🔍 Model selection, 🔧 provider config, 📝 deprecation warnings

# Show only info and above (production default)
LOG_LEVEL=info pnpm dev
# Output: Standard operation logs

# Show only warnings and errors
LOG_LEVEL=warn pnpm dev
# Output: Problems and errors only

# Show only errors
LOG_LEVEL=error pnpm dev
# Output: Errors only

# Silence all logs
LOG_LEVEL=silent pnpm dev
# Output: None
```

### Via Configuration

```typescript
const server = createRpcAiServer({
  monitoring: {
    logging: {
      level: 'debug',  // 'debug' | 'info' | 'warn' | 'error' | 'silent'
      format: 'pretty' // 'pretty' | 'json'
    }
  }
});
```

### Debug Log Examples

**Model Selection (`LOG_LEVEL=debug`):**
```
🔍 [AI Service] Model selection for provider 'anthropic'
🔍 [AI Service] Available models: claude-3-7-sonnet-20250219, claude-3-5-sonnet-20241022
🔍 [AI Service] Selected model: claude-3-7-sonnet-20250219 (default)
```

**Provider Configuration (`LOG_LEVEL=debug`):**
```
🔧 [Config] Provider 'anthropic' initialized
🔧 [Config] API Key: sk-ant-*** (from env: ANTHROPIC_API_KEY)
🔧 [Config] Default model: claude-3-5-sonnet-20241022
🔧 [Config] System prompts: default, code-review, documentation
```

**Configuration Warnings (`LOG_LEVEL=warn`):**
```
⚠️  [Config] Nested 'ai' configuration object detected
⚠️  [Config] This pattern is deprecated - move AI config to root level
⚠️  [Config] See: docs/common-configurations/provider-configuration.md
```

---

## Configuration Matrix

### Recommended Settings by Environment

| Environment | `enableTiming` | `LOG_LEVEL` | Purpose |
|-------------|----------------|-------------|---------|
| **Development** | `true` | `debug` | Full visibility for debugging |
| **Staging** | `false` | `info` | Standard logging, no timing overhead |
| **Production** | `false` | `warn` | Errors and warnings only |
| **Performance Testing** | `true` | `error` | Timing data without log noise |
| **CI/CD** | `false` | `info` | Test output visibility |

### Combined Configuration Example

```typescript
const isDev = process.env.NODE_ENV === 'development';
const isTesting = process.env.NODE_ENV === 'test';

const server = createRpcAiServer({
  debug: {
    enableTiming: isDev || isTesting  // Timing in dev/test only
  },
  monitoring: {
    logging: {
      level: isDev ? 'debug' : 'info',
      format: isDev ? 'pretty' : 'json'  // JSON for log aggregation
    }
  }
});
```

---

## Performance Impact

### Timing Overhead

| Metric | Impact |
|--------|--------|
| **CPU Overhead** | <0.1ms per request |
| **Memory** | ~1KB per request (timing data) |
| **Log Volume** | ~500 bytes per request |
| **Production Impact** | Negligible (<0.01% of request time) |

**Recommendation:** Safe to enable in production for short-term debugging, but disable for normal operation to reduce log volume.

### Verbose Log Overhead

| Log Level | Output Volume | CPU Impact |
|-----------|---------------|------------|
| `silent` | 0 bytes | 0% |
| `error` | ~100 bytes/request | <0.01% |
| `warn` | ~200 bytes/request | <0.01% |
| `info` | ~500 bytes/request | <0.05% |
| `debug` | ~2KB/request | <0.1% |

**Recommendation:** Use `info` or `warn` in production. Enable `debug` only when actively troubleshooting.

---

## Use Cases

### 1. Performance Analysis

**Goal:** Identify bottlenecks in request pipeline

```bash
# Enable timing only (minimal overhead)
ENABLE_TIMING=true LOG_LEVEL=error pnpm dev

# Make test requests
curl -X POST http://localhost:8000/rpc \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"ai.generateText","params":{...},"id":1}'

# Analyze timing output to find slow operations
```

### 2. Load Testing

**Goal:** Monitor timing during sustained load

```bash
# Start server with timing
ENABLE_TIMING=true pnpm dev

# In another terminal, run load test
ab -n 1000 -c 100 http://localhost:8000/health

# Watch for:
# - Increasing request times (resource exhaustion)
# - Consistent timing (stable performance)
# - Memory growth (potential leaks)
```

### 3. Production Debugging

**Goal:** Diagnose slow requests in production

```typescript
// Enable temporarily via feature flag or admin endpoint
let debugEnabled = false;

adminRouter.enableDebug = publicProcedure
  .meta({ requiresAuth: true, requiresAdmin: true })
  .mutation(() => {
    debugEnabled = true;
    setTimeout(() => { debugEnabled = false; }, 5 * 60 * 1000); // Auto-disable after 5min
    return { success: true, message: 'Debug enabled for 5 minutes' };
  });

// Use in server config
const server = createRpcAiServer({
  debug: {
    enableTiming: () => debugEnabled  // Dynamic function
  }
});
```

### 4. Optimization Validation

**Goal:** Validate improvements after code changes

```bash
# Before optimization
ENABLE_TIMING=true node examples/01-basic-server/server.js > before.log 2>&1

# Make code changes...

# After optimization
ENABLE_TIMING=true node examples/01-basic-server/server.js > after.log 2>&1

# Compare timing data
diff before.log after.log
```

---

## Monitoring Integrations

### Structured Logging (JSON Format)

```typescript
const server = createRpcAiServer({
  monitoring: {
    logging: {
      level: 'info',
      format: 'json'  // Machine-readable logs
    }
  }
});
```

**Output:**
```json
{
  "timestamp": "2025-10-02T06:15:00.423Z",
  "level": "info",
  "message": "Request completed",
  "method": "ai.generateText",
  "duration": 1549,
  "provider": "anthropic",
  "model": "claude-3-7-sonnet-20250219"
}
```

**Integration:** Send to log aggregation services (Datadog, Splunk, CloudWatch, etc.)

### Custom Timing Middleware

```typescript
import { initializeTiming, logTiming, resetTiming } from 'simple-rpc-ai-backend';

// Custom Express middleware
app.use((req, res, next) => {
  if (process.env.ENABLE_TIMING === 'true') {
    initializeTiming();

    res.on('finish', () => {
      const timing = resetTiming();

      // Send to monitoring service
      metrics.recordTiming({
        path: req.path,
        method: req.method,
        duration: timing.total,
        timestamp: Date.now()
      });
    });
  }

  next();
});
```

### Prometheus Metrics

```typescript
import { register, Counter, Histogram } from 'prom-client';

const requestDuration = new Histogram({
  name: 'rpc_request_duration_seconds',
  help: 'Duration of RPC requests in seconds',
  labelNames: ['method', 'provider']
});

const requestCounter = new Counter({
  name: 'rpc_requests_total',
  help: 'Total number of RPC requests',
  labelNames: ['method', 'status']
});

// Expose metrics endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});
```

---

## Troubleshooting

### Timing Logs Not Appearing

**Problem:** `ENABLE_TIMING=true` set but no timing logs

**Solutions:**
```bash
# 1. Check environment variable is set
echo $ENABLE_TIMING  # Should output: true

# 2. Set at runtime (not in .env file)
ENABLE_TIMING=true node server.js

# 3. Use configuration instead
# In server.js:
debug: { enableTiming: true }
```

### Log Spam from Dependencies

**Problem:** Too many logs from third-party libraries

**Solution:**
```typescript
// Suppress verbose dependency logs
const server = createRpcAiServer({
  monitoring: {
    logging: {
      level: 'info',
      suppress: [
        'tRPC',      // Suppress tRPC internal logs
        'Vercel AI', // Suppress AI SDK logs
        'Prisma'     // Suppress Prisma logs
      ]
    }
  }
});
```

### Performance Regression Detection

**Problem:** Need to detect when performance degrades

**Solution:**
```typescript
// Add timing assertions in tests
import { expect } from 'vitest';
import { logTiming, resetTiming } from 'simple-rpc-ai-backend';

test('ai.generateText performance', async () => {
  const result = await client.ai.generateText.mutate({...});

  const timing = resetTiming();

  // Assert server overhead is acceptable
  expect(timing.serverOverhead).toBeLessThan(10); // <10ms
  expect(timing.total).toBeGreaterThan(1000); // AI call takes time
});
```

---

## See Also

- [Benchmarks]({% link performance/benchmarks.md %}) - Performance test results and validation
- [Server Configuration]({% link common-configurations/configuration.md %}) - Complete configuration reference
- [Environment Variables]({% link common-configurations/environment.md %}) - Environment-based settings
