# SSE Persistent Connection Implementation Plan

## Current Status
✅ SSE transport type added
✅ Basic SSE connection and stream parsing
✅ Debug logging comprehensive
⚠️ Stream closes after init, losing session state

## Required Changes for Smithery

### 1. Store Persistent Reader (Line 294)
```typescript
// In setupSSEStream():
const reader = response.body.getReader();
this.ssePersistentReader = reader;  // Store for reuse!
```

### 2. Keep Stream Alive (Line 306-317)
```typescript
if (done) {
  console.log(`🛑 Stream ended`);
  this.ssePersistentReader = null;
  this.connected = false;  // Now we truly disconnect
  this.emit('disconnected');
  break;
}
// Remove the "keeping alive" logic - we're actually keeping it alive now
```

### 3. Refactor sendSSERequest (Line 382-451)
Current: Creates new SSE stream per request
Needed: POST request, response comes via persistent stream

```typescript
private async sendSSERequest(message: MCPMessage): Promise<any> {
  // For notifications
  if (!message.id) {
    await fetch(this.config.url, {
      method: 'POST',
      headers,
      body: JSON.stringify(message)
    });
    return;
  }

  // For requests: POST and wait for response via persistent stream
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      this.pendingRequests.delete(message.id!);
      reject(new Error('SSE request timeout'));
    }, this.config.timeout || 30000);

    this.pendingRequests.set(message.id!, { resolve, reject, timeout });

    // Send request - response will come via persistent SSE stream
    fetch(this.config.url!, {
      method: 'POST',
      headers,
      body: JSON.stringify(message)
    }).catch(err => {
      this.pendingRequests.delete(message.id!);
      clearTimeout(timeout);
      reject(err);
    });
  });
}
```

### 4. Remove readSSEResponse Method (Line 456-507)
Not needed anymore - all responses come via persistent stream

## Testing Plan
1. Enable remote MCP in server.js
2. Start server - watch for persistent stream logs
3. Curl tools/list - should work without "Server not initialized"
4. Curl multiple times - stream should stay open

## Implementation Time
~30 minutes to refactor + test

## Files to Modify
- `src/mcp/remote-mcp-client.ts` (3 methods)
- `examples/02-mcp-server/server.js` (re-enable)
