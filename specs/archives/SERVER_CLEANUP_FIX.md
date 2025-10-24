# Automatic Server Cleanup - Implementation Summary

## Problem

Servers were not being automatically killed when:
1. Starting a new server on the same port
2. Pressing Ctrl+C to exit
3. Process terminates unexpectedly

This led to zombie processes occupying ports and requiring manual cleanup with `lsof` and `kill` commands.

## Solution Implemented

Added three layers of automatic cleanup:

### 1. **Signal Handlers for Graceful Shutdown** ✅

Automatically handles:
- **SIGINT** (Ctrl+C)
- **SIGTERM** (kill command)
- **beforeExit** (process exit)

```typescript
// In RpcAiServer constructor
this.setupSignalHandlers();

// Graceful shutdown on Ctrl+C or kill
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
```

**Result**: Pressing Ctrl+C now properly calls `server.stop()` and cleans up resources.

### 2. **Port Availability Check** ✅

Before starting, checks if the port is in use and optionally kills the existing process:

```typescript
// In start() method
await this.checkPortAvailability(this.config.port, this.config.autoKillExistingServer);
```

**Behavior**:
- If `autoKillExistingServer: false` (default): Warns about port in use
- If `autoKillExistingServer: true`: Automatically kills existing process

### 3. **Configuration Option** ✅

Added new config option:

```typescript
interface RpcAiServerConfig {
  port?: number;
  autoKillExistingServer?: boolean;  // Default: false
  // ...
}
```

**Usage**:
```typescript
const server = createRpcAiServer({
  port: 8001,
  autoKillExistingServer: true  // Auto-kill old servers
});
```

## Files Modified

1. **src/rpc-ai-server.ts**
   - Added `autoKillExistingServer` config option (line 60)
   - Added `setupSignalHandlers()` method (lines 714-742)
   - Added `checkPortAvailability()` method (lines 744-776)
   - Called signal handler setup in constructor (line 711)
   - Called port check in `start()` method (line 1690)

2. **tools/simple-agent/src/core/server.ts**
   - Enabled `autoKillExistingServer: true` (line 103)

## How It Works

### Scenario 1: Normal Exit (Ctrl+C)
```
User presses Ctrl+C
  ↓
SIGINT signal received
  ↓
setupSignalHandlers() catches it
  ↓
Calls gracefulShutdown('SIGINT')
  ↓
Calls server.stop()
  ↓
Closes all connections
  ↓
Process exits cleanly
```

### Scenario 2: Starting New Server
```
new server.start()
  ↓
checkPortAvailability(port, autoKillExistingServer)
  ↓
If autoKillExistingServer === true:
  ├─ Find process on port (lsof -ti:8001)
  ├─ Kill process (kill -9 <pid>)
  ├─ Wait 500ms for port release
  └─ Continue with start()
  ↓
Server starts on clean port
```

### Scenario 3: Process Termination
```
Process receives SIGTERM
  ↓
setupSignalHandlers() catches it
  ↓
Calls gracefulShutdown('SIGTERM')
  ↓
Calls server.stop()
  ↓
Process exits with code 0
```

## Testing

### Test 1: Graceful Shutdown
```bash
# Start server
node test-server.js

# Press Ctrl+C
# Expected output:
# 🛑 Received SIGINT, shutting down gracefully...
# ✅ Server stopped successfully
```

### Test 2: Auto-Kill Existing Server
```bash
# Start first server (don't stop it)
node test-server.js &

# Start second server with autoKillExistingServer: true
node test-server2.js

# Expected output:
# ⚠️  Port 8001 is in use by process 12345, killing...
# ✅ Killed process 12345 on port 8001
# 🚀 RPC AI Server running on port 8001
```

### Test 3: Manual Warning
```bash
# Start first server
node test-server.js &

# Start second server with autoKillExistingServer: false (default)
node test-server2.js

# Expected output:
# ⚠️  Port 8001 is already in use by process 12345
#    Tip: Set config.autoKillExistingServer = true to automatically kill old servers
```

## Benefits

✅ No more manual `lsof -ti:8001 | xargs kill -9`
✅ Clean exit on Ctrl+C
✅ Automatic cleanup of zombie processes
✅ Safe defaults (auto-kill disabled by default)
✅ Cross-platform (works on Linux/macOS)
✅ Simple configuration option

## Breaking Changes

None - this is fully backward compatible:
- `autoKillExistingServer` defaults to `false` (safe behavior)
- Signal handlers are always enabled (improves reliability)
- Port checking is always performed (informational warnings only by default)

## Usage in simple-agent

Simple-agent now automatically kills old servers on restart:

```typescript
// In tools/simple-agent/src/core/server.ts
const server = createRpcAiServer({
  port: 8001,
  autoKillExistingServer: true,  // ← Enabled by default
  // ...
});
```

**Result**: No need to manually kill old simple-agent processes - just restart and it handles cleanup automatically!

## Platform Support

- ✅ Linux (uses `lsof` and `kill`)
- ✅ macOS (uses `lsof` and `kill`)
- ⚠️  Windows (port checking skipped, signal handlers still work)

On Windows, the port checking is gracefully skipped but signal handlers still provide clean shutdown on Ctrl+C.
