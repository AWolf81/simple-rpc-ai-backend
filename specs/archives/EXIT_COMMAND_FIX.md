# Exit Command Fix

## Problem

When using `/exit` or `/quit` in simple-agent, the command would stop the server but not properly exit the process:

```bash
You: /exit
✅ Server stopped

# Process hangs - user must press Ctrl+C

^C
🛑 Received SIGINT, shutting down gracefully...
✅ Server stopped
✅ Server stopped successfully
```

This caused:
1. **Hanging process** - User stuck waiting
2. **Double shutdown** - Server stopped twice
3. **Poor UX** - Requiring Ctrl+C after `/exit`

## Root Cause

The CLI wasn't waiting for the Ink app to exit before attempting cleanup:

### Before (Broken)
```typescript
// cli.ts
render(
  React.createElement(App, { ... })
);
// ❌ Execution continues immediately, not waiting for Ink exit
// ❌ No cleanup code runs
// ❌ Process hangs with server still running
```

### Issue Breakdown

1. **Ink `render()` returns immediately** - Doesn't block
2. **App calls `exit()`** - Exits Ink UI but not Node.js process
3. **Server still running** - Keeps Node.js event loop active
4. **No cleanup handler** - Server never stopped
5. **Process hangs** - Waiting for event loop to drain

## Solution

Use Ink's `waitUntilExit()` to properly sequence cleanup:

### After (Fixed)

**File**: [tools/simple-agent/src/cli.ts:176-197](tools/simple-agent/src/cli.ts#L176-L197)

```typescript
// Render Ink UI
const { waitUntilExit } = render(
  React.createElement(App, {
    serverUrl,
    model: defaultModel,
    provider: defaultProvider,
    server: server,
    enableFileProxy: isRemoteServer,
    workspaceDir: process.cwd(),
    verbose: options.verbose
  })
);

// Wait for the Ink app to exit, then cleanup
await waitUntilExit();

// Cleanup server if we started it
if (server && typeof server.stop === 'function') {
  console.log('🛑 Shutting down server...');
  await server.stop();
}

process.exit(0);
```

**File**: [tools/simple-agent/src/components/App.tsx:209-214](tools/simple-agent/src/components/App.tsx#L209-L214)

```typescript
const handleExit = () => {
  // Clear log file and exit Ink
  // Note: Server cleanup is handled by CLI after waitUntilExit()
  clearLogFile();
  exit();
};
```

## Execution Flow

### New Flow (Correct)

```
1. User types /exit
   ↓
2. App.tsx: handleExit() called
   ↓
3. App.tsx: clearLogFile()
   ↓
4. App.tsx: exit() — Exits Ink UI
   ↓
5. cli.ts: waitUntilExit() resolves
   ↓
6. cli.ts: "🛑 Shutting down server..."
   ↓
7. cli.ts: await server.stop()
   ↓
8. cli.ts: process.exit(0)
   ↓
9. ✅ Clean exit, no hanging
```

## Key Changes

### 1. CLI Waits for Ink Exit
- Use `await waitUntilExit()` to block until UI exits
- This ensures proper sequencing of cleanup

### 2. CLI Handles Server Cleanup
- Moved `server.stop()` from App to CLI
- Ensures cleanup happens **after** UI exits
- Prevents race conditions

### 3. Removed Async from handleExit
- No longer needs to be async (doesn't stop server)
- Simpler, faster exit path

### 4. Clean Process Exit
- Explicit `process.exit(0)` after cleanup
- Ensures Node.js process terminates

## Benefits

✅ **Immediate exit** - No hanging, no Ctrl+C needed
✅ **Clean shutdown** - Server stopped once, properly
✅ **Better UX** - Command works as expected
✅ **No race conditions** - Sequential cleanup

## Testing

```bash
# Build
pnpm build

# Start simple-agent
cd tools/simple-agent
./dist/cli.js chat

# Test exit
> /exit

# Expected output:
🛑 Shutting down server...
✅ Server stopped
# Process exits immediately
```

## Related Code

**Signal Handlers** (if needed in future):
```typescript
// Handle Ctrl+C gracefully
process.on('SIGINT', async () => {
  console.log('\n🛑 Received SIGINT, shutting down gracefully...');
  if (server?.stop) {
    await server.stop();
  }
  process.exit(0);
});
```

Currently not needed since `/exit` is the primary exit method and Ctrl+C naturally terminates the process.

## Files Modified

- `tools/simple-agent/src/cli.ts` - Added `waitUntilExit()` and cleanup
- `tools/simple-agent/src/components/App.tsx` - Simplified `handleExit()`

## Comparison

| Aspect | Before | After |
|--------|--------|-------|
| Exit command | `/exit` | `/exit` |
| User action | Must press Ctrl+C | Automatic exit |
| Server cleanup | None (hanging) | Proper cleanup |
| Process exit | Manual interrupt | Clean `process.exit(0)` |
| UX | Poor (confusing) | Excellent (instant) |

## Alternative Approaches Considered

### Approach 1: Signal Handlers
- **Pros**: Handles Ctrl+C uniformly
- **Cons**: Still need `waitUntilExit()` for `/exit`
- **Decision**: Not needed - `/exit` is primary exit method

### Approach 2: Exit from App Component
- **Pros**: All logic in one place
- **Cons**: Ink's `exit()` doesn't stop Node.js process
- **Decision**: Not viable - process would still hang

### Approach 3: process.exit() in App
- **Pros**: Immediate exit
- **Cons**: Doesn't cleanup server, abrupt exit
- **Decision**: Not acceptable - leaves server running

## Chosen Approach: waitUntilExit()

✅ **Best solution** - Proper sequencing
✅ **Clean separation** - UI exit → Cleanup → Process exit
✅ **Maintainable** - Clear, linear flow

---

## Summary

The `/exit` command now works correctly:
1. User types `/exit`
2. Ink UI exits immediately
3. Server shuts down cleanly
4. Process terminates
5. No manual intervention needed

**Status**: ✅ **Fixed** - Exit command works as expected
