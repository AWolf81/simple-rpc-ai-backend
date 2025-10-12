---
title: Benchmarks
parent: Performance
grand_parent: Documentation
nav_order: 1
---

# Performance Benchmarks

Real-world performance measurements and load testing results for the Simple RPC AI Backend.

---

## AI Generation Performance (`ai.generateText`)

### Test Configuration

**Request Details:**
- **Input**: "Hey there, nice to meet you" (27 characters)
- **System Prompt**: "default" → "You are a helpful AI assistant." (36 characters)
- **Provider**: Anthropic Claude 3.7 Sonnet (claude-3-7-sonnet-20250219)

**Hardware:**
- **Device**: AWOW AK10 Pro Mini PC
- **CPU**: Intel N100 (4 cores, up to 3.4 GHz)
- **RAM**: 16GB DDR4
- **Storage**: 1TB NVMe SSD
- **OS**: Ubuntu 25.04 (Kernel 6.14.0)

### Timing Breakdown

```
┌─ JSON-RPC Request Parsing          0.71 ms  (0.05%)
├─ tRPC Procedure Resolution         0.07 ms  (0.00%)
├─ AI Service Initialization         6.87 ms  (0.46%)
│  ├─ Request Validation             0.04 ms
│  ├─ Model Retrieval                6.09 ms
│  └─ Execution Preparation          0.16 ms
├─ Anthropic API Call            1,477.06 ms (99.24%)
└─ Response Formatting               0.64 ms  (0.04%)

Total Request Time:              1,488.40 ms
Server Overhead:                     8.29 ms  (0.56%)
```

### Key Findings

- ✅ **Server overhead**: <10ms (0.56% of total time)
- ✅ **AI API bottleneck**: 99.24% of time waiting for provider response
- ✅ **Efficient routing**: tRPC v11 caller + JSON-RPC bridge = 0.71ms
- ✅ **Scalable**: Server can handle 100+ concurrent requests (I/O bound, not CPU bound)

---

## Performance Validation (Cost-Free)

### 1. Server Overhead Test (No AI API Calls)

```bash
# Test server routing and response formatting only
curl -X POST http://localhost:8000/rpc \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"system.health","id":1}'

# Expected: <5ms response time
```

### 2. Load Test - Health Endpoint (Baseline Performance)

```bash
# Install Apache Bench (ab)
# Ubuntu/Debian: sudo apt-get install apache2-utils
# macOS: brew install apache2

# Run load test
ab -n 1000 -c 100 http://localhost:8000/health

# Expected: ~3000 req/sec (0.32ms per request)
# Actual result: 3128 req/sec on Intel N100
```

**Sample Output:**
```
Concurrency Level:      100
Time taken for tests:   0.320 seconds
Complete requests:      1000
Failed requests:        0
Requests per second:    3128.13 [#/sec] (mean)
Time per request:       31.97 [ms] (mean)
Time per request:       0.320 [ms] (mean, across all concurrent requests)
```

### 3. Load Test - Simulated AI Delay (Realistic AI Scenario)

```bash
# Create test payload
echo '{"jsonrpc":"2.0","method":"test.simulateAI","params":{},"id":1}' > post.json

# Run load test with POST request
ab -n 100 -c 10 -p post.json -T application/json http://localhost:8000/rpc

# Expected: ~6.5 req/sec with 10 concurrent (limited by 1.5s simulated delay)
# Actual result: 6.04 req/sec, 1504ms avg (1500ms delay + 4ms overhead = 0.27%)
```

**Benefits:**
- Tests server behavior under realistic AI workload
- No API costs incurred
- Validates concurrent request handling
- Measures server overhead under load

**Sample Output:**
```
Concurrency Level:      10
Time taken for tests:   16.556 seconds
Complete requests:      100
Failed requests:        0
Requests per second:    6.04 [#/sec] (mean)
Time per request:       1655.6 [ms] (mean)
Time per request:       165.56 [ms] (mean, across all concurrent requests)

Connection Times (ms)
              min  mean[+/-sd] median   max
Total:       1502 1504   1.8   1504  1508

Percentage of the requests served within a certain time (ms)
  50%   1504
  66%   1505
  75%   1505
  80%   1506
  90%   1507
  95%   1508
  98%   1508
  99%   1508
 100%   1508 (longest request)
```

### 4. tRPC Procedure Resolution Test

```bash
# Test tRPC endpoint directly
curl http://localhost:8000/trpc/admin.healthCheck

# Expected: <10ms response time
```

### 5. Memory Profiling (Leak Detection)

```bash
# Start server with memory constraints for testing
node --expose-gc --max-old-space-size=512 examples/01-basic-server/server.js

# Monitor memory usage during sustained load
watch -n 1 'ps aux | grep node | grep -v grep'

# Or more detailed view
watch -n 2 'ps -o pid,rss,cmd -p $(pgrep node)'
```

**What to Monitor:**
- RSS (Resident Set Size) should stabilize after warmup
- No continuous memory growth indicates no leaks
- Memory should decrease during idle periods (GC working)

---

## Production Considerations

### Concurrent Request Handling

| Scenario | Configuration | Result |
|----------|--------------|--------|
| **Parallel Requests** | 100 concurrent | Server handles 66 req/sec with 1.5s latency |
| **Sequential Requests** | Single thread | No memory leaks, clean async/await execution |
| **Real Bottleneck** | AI Provider | Rate limits typically 50-100 req/min = 1.67 req/sec max |

### Throughput Math

```
Theory:
  10 concurrent requests  / 1.5s latency = 6.67 req/sec
  100 concurrent requests / 1.5s latency = 66.67 req/sec (theoretical max)

Reality:
  Anthropic limits: ~100 req/min = 1.67 req/sec (actual production limit)
  OpenAI GPT-4: ~3 req/min = 0.05 req/sec (tier 1)
  OpenAI GPT-4: ~500 req/min = 8.33 req/sec (tier 5)
```

**Key Insight:** AI provider rate limits are the bottleneck, not server capacity.

### Recommended Optimizations

#### 1. Rate Limiting

```typescript
import { createRpcAiServer } from 'simple-rpc-ai-backend';

const server = createRpcAiServer({
  rateLimit: {
    windowMs: 15 * 60 * 1000,  // 15 minutes
    max: 100                    // 100 requests per window
  }
});
```

**Purpose:** Prevent API quota exhaustion and 429 errors from AI providers.

#### 2. Response Caching

```typescript
// Cache identical requests to reduce API calls
const cache = new Map();

const getCachedOrGenerate = async (content, systemPrompt) => {
  const key = `${content}:${systemPrompt}`;

  if (cache.has(key)) {
    return cache.get(key);
  }

  const result = await client.ai.generateText.mutate({
    content,
    systemPrompt
  });

  cache.set(key, result);
  setTimeout(() => cache.delete(key), 5 * 60 * 1000); // 5 min TTL

  return result;
};
```

#### 3. Provider Monitoring

```bash
# Track rate limit headers in responses
curl -i http://localhost:8000/rpc \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"ai.generateText","params":{...},"id":1}' \
  | grep -i ratelimit

# Common headers:
# x-ratelimit-limit: 100
# x-ratelimit-remaining: 47
# x-ratelimit-reset: 1696847280
```

#### 4. Load Balancing Multiple Keys

```typescript
const server = createRpcAiServer({
  providers: [
    {
      name: 'anthropic-1',
      type: 'anthropic',
      apiKey: process.env.ANTHROPIC_KEY_1
    },
    {
      name: 'anthropic-2',
      type: 'anthropic',
      apiKey: process.env.ANTHROPIC_KEY_2
    }
  ]
});

// Round-robin or random selection between keys
```

**⚠️ Note:** Automatic load balancing is not currently implemented. Multiple providers with different server endpoints (e.g., multiple Anthropic instances) have not been tested. Manual provider selection is required via the `provider` parameter in requests.

---

## Performance Comparison

### Server Overhead by Endpoint

| Endpoint | Protocol | Avg Time | Overhead |
|----------|----------|----------|----------|
| `/health` | HTTP GET | 0.32ms | N/A (baseline) |
| `/trpc/admin.healthCheck` | tRPC | 2.1ms | +1.78ms (routing) |
| `/rpc` (system.health) | JSON-RPC | 4.5ms | +4.18ms (parsing + bridge) |
| `/rpc` (ai.generateText) | JSON-RPC + AI | 1488ms | +8ms (0.56% overhead) |

**Analysis:**
- Pure HTTP: 0.32ms (fastest)
- tRPC overhead: +1.78ms (type safety + validation)
- JSON-RPC overhead: +4.18ms (parsing + tRPC bridge)
- AI operations: Server overhead negligible (<1%)

### Scaling Characteristics

| Metric | Value | Notes |
|--------|-------|-------|
| **CPU Usage** | <5% idle, <15% under load | I/O bound workload |
| **Memory** | ~80MB base, +2MB per 100 concurrent | Stable, no leaks |
| **Network I/O** | Dependent on AI provider | Typically 1-5kb/request |
| **Disk I/O** | Minimal | Logs only (can disable in production) |

---

## Benchmark History

Track performance improvements across versions:

| Version | Total Time | Server Overhead | Notes |
|---------|------------|-----------------|-------|
| v0.1.0 | 1652ms | 164ms (9.9%) | Initial release |
| v0.1.5 | 1521ms | 33ms (2.2%) | Optimized tRPC bridge |
| v0.1.8 | 1488ms | 8ms (0.56%) | **Current** - Caller optimization |

**95% reduction in server overhead** from v0.1.0 to v0.1.8.

### Automated Benchmark Testing

**Status:** Planned ([Issue #11](https://github.com/AWolf81/simple-rpc-ai-backend/issues/11))

Automated performance regression testing via GitHub Actions is planned to:
- Run benchmarks on every merge to `master`/`next` branches
- Track performance trends across versions
- Auto-update this benchmark history table
- Fail CI builds on >20% performance regression

This will ensure consistent performance tracking and early detection of regressions.

---

## See Also

- [Debug & Monitoring]({% link performance/debug-monitoring.md %}) - Enable timing logs and debug mode
- [Server Configuration]({% link common-configurations/configuration.md %}) - Rate limiting and optimization settings
- [Getting Started]({% link getting-started/quickstart.md %}) - Set up your first server
