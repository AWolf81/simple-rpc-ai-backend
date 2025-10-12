# Smithery MCP Server Limitation

## Issue
Smithery's MCP implementation requires maintaining a persistent SSE connection to preserve server session state. When the SSE stream closes (even after successful initialization), subsequent requests fail with "Server not initialized".

## Root Cause
- Smithery sends the `initialize` response via SSE and then closes the stream
- Server state is tied to keeping that specific SSE connection alive
- Our current implementation doesn't maintain the persistent stream after initialization

## What We Implemented
✅ SSE transport type in RemoteMCPClient
✅ Proper MCP initialization with `notifications/initialized`
✅ Per-request SSE streams (for servers that support this pattern)
✅ Comprehensive debug logging

## What's Needed for Smithery
To fully support Smithery's pattern, we need to:

1. Keep the initial SSE connection from `initialize` open indefinitely
2. Send subsequent requests as separate HTTP POSTs to the same URL
3. Route all responses back through the persistent SSE stream (multiplexing)
4. Handle connection drops and reconnection with state recovery

This requires a more sophisticated SSE multiplexing implementation.

## Workaround for Web Search
Use Anthropic's native web search instead:
```javascript
metadata: {
  useWebSearch: true,
  webSearchPreference: 'ai-web-search'  // Requires Anthropic API access
}
```

## Testing Smithery Manually
The Smithery CLI works because it maintains the persistent connection:
```bash
npx -y @smithery/cli@latest run @nickclyde/duckduckgo-mcp-server --key YOUR_KEY
```

## Status
- SSE transport: ✅ Implemented
- Smithery compatibility: ⚠️ Requires persistent stream multiplexing (future work)
- Stdio-based MCP servers: ✅ Fully working
