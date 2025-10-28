# Bug Fix: Duplicate Tool Call Prevention

## Issue Description

**Problem**: When using the delete skill (or any approval-required tool), the agent was calling the tool multiple times in a single AI response, causing duplicate approval dialogs.

**Example**:
```
User: delete /tmp/test.md
Agent: [Calls file_handling_delete TWICE with same arguments]
System: Shows approval dialog
User: Allow
System: File deleted
System: Shows ANOTHER approval dialog (for duplicate call)
User: Allow (again)
System: File not found (already deleted)
```

**Audit Log Evidence**:
```
2025-10-27T19:15:30.076Z [v1juwm] START
2025-10-27T19:15:30.076Z [v1juwm] PATH /tmp/test_delete_approval_v2.md
2025-10-27T19:15:30.077Z [v1juwm] DELETED /tmp/test_delete_approval_v2.md
2025-10-27T19:15:30.868Z [434h8a] START           ← DUPLICATE CALL
2025-10-27T19:15:30.868Z [434h8a] PATH /tmp/test_delete_approval_v2.md
2025-10-27T19:15:30.869Z [434h8a] NOT_FOUND /tmp/test_delete_approval_v2.md
```

## Root Cause

The AI model (Anthropic Claude, OpenAI GPT, etc.) was generating **multiple tool calls with identical arguments in a single response**. This happens when:

1. The AI doesn't properly understand it should wait for tool results before making another call
2. The model "forgets" it already requested the tool in the same turn
3. The AI gets confused about execution state

While the agent system prompt includes "No duplicates: Never call same tool with identical arguments twice" ([AGENT.md:45](../../src/services/agents/builtin/main-agent/AGENT.md#L45)), AI models don't always follow this instruction perfectly.

## Solution

Added **server-side deduplication** in the tool execution loop to filter out duplicate tool calls before execution.

### Implementation

**File**: [src/services/ai/ai-service.ts](../../src/services/ai/ai-service.ts)

**Location**: Lines 651-670 in the tool execution loop

**Code**:
```typescript
// Deduplicate tool calls - prevent AI from calling same tool with same args multiple times in one turn
const seenToolSignatures = new Set<string>();
const deduplicatedToolCalls = currentResult.toolCalls.filter((tc: any) => {
  const signature = `${tc.toolName}:${JSON.stringify(tc.args || {})}`;
  if (seenToolSignatures.has(signature)) {
    logger.warn(`⚠️  Skipping duplicate tool call: ${tc.toolName} with args ${JSON.stringify(tc.args)}`);
    return false;
  }
  seenToolSignatures.add(signature);
  return true;
});

if (deduplicatedToolCalls.length < currentResult.toolCalls.length) {
  logger.info(`🔧 Deduplicated ${currentResult.toolCalls.length} tool calls down to ${deduplicatedToolCalls.length}`);
}

// Use deduplicated tool calls for execution
const toolCallsToExecute = deduplicatedToolCalls.length < currentResult.toolCalls.length
  ? deduplicatedToolCalls
  : currentResult.toolCalls;
```

### How It Works

1. **Before tool execution**: Check all requested tool calls in the current AI response
2. **Generate signature**: Create unique identifier: `toolName:JSON(args)`
3. **Filter duplicates**: Keep only the first occurrence of each unique tool+args combination
4. **Log warnings**: Alert about skipped duplicate calls for debugging
5. **Execute once**: Only execute the deduplicated set of tool calls

### Benefits

✅ **Single approval**: User only sees one approval dialog per unique tool call
✅ **No wasted API calls**: Duplicate tools aren't executed
✅ **Logged for debugging**: Warnings show when duplicates are detected
✅ **Zero breaking changes**: Transparent to existing code
✅ **Works for all tools**: Not specific to delete skill - applies to all tool calls

## Testing

### Manual Test
```bash
# Create test file
echo "test content" > /tmp/test_delete_dedup.md

# Start simple-agent
pnpm --filter simple-agent dev

# In agent CLI:
> delete /tmp/test_delete_dedup.md
> Allow

# Expected: Single approval dialog, file deleted, no second prompt
```

### What to Look For

**Before Fix**:
```
User: delete /tmp/test.md
[Approval Dialog 1] ← First tool call
User: Allow
[Approval Dialog 2] ← Duplicate tool call
User: Allow
Error: File not found
```

**After Fix**:
```
User: delete /tmp/test.md
[Approval Dialog 1] ← Only call
User: Allow
✅ File deleted successfully
```

### Log Output (Success)
```
🔄 Tool iteration 1/4...
⚠️  Skipping duplicate tool call: file_handling_delete with args {"file-path":"/tmp/test.md"}
🔧 Deduplicated 2 tool calls down to 1
✅ Tool execution completed: 1 total tool call(s) executed
```

## Related Files

- [src/services/ai/ai-service.ts:651-670](../../src/services/ai/ai-service.ts) - Deduplication logic
- [src/services/agents/builtin/main-agent/AGENT.md:45](../../src/services/agents/builtin/main-agent/AGENT.md#L45) - "No duplicates" instruction
- [src/services/agents/skills/builtin/file-handling/scripts/delete.ts](../../src/services/agents/skills/builtin/file-handling/scripts/delete.ts) - Delete script
- [CLAUDE.md](../../CLAUDE.md) - Updated with file deletion safety workflow

## Notes

- **Scope**: This fix prevents duplicates **within a single AI response turn**. Cross-turn duplicates are already handled by the conversation state manager.
- **Performance**: Minimal overhead - O(n) where n = number of tool calls in response (typically 1-3)
- **AI Models**: Works with all providers (Anthropic, OpenAI, Google, etc.)
- **Tool Types**: Applies to all tools (skills, MCP, custom tools)

## Future Improvements

Consider tracking tool calls across turns to prevent:
```
Turn 1: Agent calls file_handling_delete → User approves → File deleted
Turn 2: Agent calls file_handling_delete AGAIN with same args
```

This could be handled by the conversation state manager's `approvedTools` set, which already tracks approved tool+args combinations.
