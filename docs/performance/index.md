---
title: Performance
nav_order: 5
parent: Documentation
has_children: true
has_toc: true
---

# Performance

Understand server performance characteristics, benchmark results, and debugging tools for the Simple RPC AI Backend.

## Topics

- [Benchmarks]({% link performance/benchmarks.md %}) - Real-world performance metrics and load testing
- [Debug & Monitoring]({% link performance/debug-monitoring.md %}) - Performance timing and debug configuration

## Quick Performance Summary

- **Server Overhead**: <10ms (0.56% of total request time)
- **AI API Bottleneck**: 99.24% of time waiting for provider response
- **Routing Efficiency**: tRPC v11 caller + JSON-RPC bridge = 0.71ms
- **Scalability**: Handle 100+ concurrent requests (I/O bound, not CPU bound)
- **Health Endpoint**: ~3,000 req/sec baseline performance

## Enable Performance Monitoring

```bash
# Quick start: Enable timing logs
ENABLE_TIMING=true pnpm dev

# Or via configuration
const server = createRpcAiServer({
  debug: {
    enableTiming: true  // Detailed timing breakdown
  }
});
```

See [Debug & Monitoring]({% link performance/debug-monitoring.md %}) for complete configuration options.
