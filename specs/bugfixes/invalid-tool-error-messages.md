# Bug Fix: Improved Error Messages for Invalid Tool Calls and Denials

**Date**: 2025-10-31
**Issue**: Misleading "MCP service not available" error when AI models hallucinate invalid tool names or repeatedly call denied tools

## Problem

When an AI model made invalid tool calls (e.g., calling a non-existent tool named `"call"`), or repeatedly attempted to use denied tools, the error messages were confusing:

1. **Invalid tool calls** → `"MCP service not available"` (misleading - suggests MCP is broken)
2. **Denied tool calls** → `"Script execution denied: scripts/delete.ts"` (AI models didn't understand this meant "stop trying")

### Example Failure Scenario

```
User: delete /tmp/test_delete_approval_v2.md
[User denies deletion via "Remember: Deny all"]

Iteration 1: file_handling_delete → "Script execution denied"
Iteration 2: file_handling_delete → "Script execution denied" (cached)
Iteration 3: call (invalid tool!) → "MCP service not available"

AI Response: "MCP service not available" - apologizes for technical issues
```

The AI model hallucinated a tool called `"call"` and received a misleading error message, causing it to incorrectly blame "technical issues with the MCP service."

## Root Cause

1. **Generic error message** in [ai-service.ts:1737-1742](../../src/services/ai/ai-service.ts#L1737-L1742) returned `"MCP service not available"` for any invalid tool
2. **Unclear denial message** in [manager.ts:279](../../src/services/agents/skills/manager.ts#L279) didn't instruct AI to stop retrying
3. **No guidance** telling the AI model that repeated attempts were futile

## Solution

### 1. Clarify Invalid Tool Errors

**File**: `src/services/ai/ai-service.ts`

**Before**:
```typescript
result = { error: 'MCP service not available' };
```

**After**:
```typescript
result = {
  error: `Invalid tool: '${toolCall.toolName}' not found. Available tools: ${availableCustomTools.join(', ') || 'none'}`
};
```

**Impact**: AI models now receive clear feedback about what went wrong and which tools are actually available.

### 2. Improve Denial Error Messages

**File**: `src/services/agents/skills/manager.ts`

**Before**:
```typescript
throw new Error(`Script execution denied: ${request.scriptName}`);
```

**After**:
```typescript
throw new Error(`Action denied by user security settings. Do not retry this operation. Please explain to the user that their security settings blocked: ${request.scriptName}`);
```

**Impact**:
- ✅ AI models understand the action was blocked by user choice (not a technical error)
- ✅ Explicit instruction: "Do not retry this operation"
- ✅ Guidance to explain the situation to the user

### 3. Fixed Pre-existing TypeScript Error

**File**: `src/services/ai/ai-service.ts:733-738`

**Issue**: `toolCallId` property caused compilation error

**Fix**: Added `as any` type assertion to tool history tracking

## Expected Behavior After Fix

### Scenario 1: Invalid Tool Call
```
AI calls: call (doesn't exist)
Error: "Invalid tool: 'call' not found. Available tools: file_handling_read, file_handling_write, ..."
AI Response: Acknowledges the tool doesn't exist, uses correct tools
```

### Scenario 2: Denied Tool Call
```
User denies: file_handling_delete
Error: "Action denied by user security settings. Do not retry this operation. Please explain to the user that their security settings blocked: scripts/delete.ts"
AI Response: "Your security settings have blocked file deletion. Would you like to adjust your approval settings?"
```

## Testing

To verify the fix:

1. **Test invalid tool call**:
   - Use an AI model prone to hallucination
   - Check error message includes "Invalid tool" and lists available tools

2. **Test denied tool with remember**:
   - Request file deletion
   - Choose "Remember: Deny all" for delete operations
   - Request deletion again
   - Verify AI explains the denial instead of retrying

3. **Build verification**:
   ```bash
   pnpm build
   pnpm typecheck
   ```

## Files Changed

- `src/services/ai/ai-service.ts` (lines 1737, 1742, 733-738)
- `src/services/agents/skills/manager.ts` (line 279)

## Benefits

✅ **Clearer error messages** - AI and users understand what went wrong
✅ **Better AI behavior** - Models stop retrying after explicit denials
✅ **Reduced confusion** - No more misleading "MCP service not available" for unrelated issues
✅ **Improved UX** - AI explains security settings to users instead of apologizing for "technical issues"

## Related Issues

- Duplicate tool call caching: [docs/bugfixes/DUPLICATE_TOOL_CALLS.md](../../docs/bugfixes/DUPLICATE_TOOL_CALLS.md)
- File deletion approval system: [docs/agents/APPROVAL_SYSTEM.md](../../docs/agents/APPROVAL_SYSTEM.md)
