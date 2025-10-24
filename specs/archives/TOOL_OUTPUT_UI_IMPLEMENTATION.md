# Tool Output UI Implementation

## Overview

Successfully implemented a UI component system that displays **raw tool execution output** separately from AI-generated responses in the simple-agent CLI.

## Problem Solved

**Before:**
- Tool executions were invisible to the user
- AI responses included tool output mixed with AI commentary
- No way to verify what the tool actually returned vs. what the AI said

**After:**
- Tool executions shown in dedicated UI blocks
- Raw tool output (stdout, stderr, exit code, duration) displayed clearly
- AI response shown separately below tool execution
- User can verify exact tool behavior

## Architecture Changes

### 1. AIService - Track Tool Executions

**File**: [src/services/ai/ai-service.ts](src/services/ai/ai-service.ts)

Added tool execution tracking to `ExecuteResult`:

```typescript
export interface ExecuteResult {
  content: string;
  usage: { ... };
  model: string;
  provider?: string;
  toolCalls?: Array<{  // ← NEW
    name: string;
    arguments: any;
    result: any;
  }>;
}
```

Modified `formatExecuteResult()` to capture tool details:

```typescript
private formatExecuteResult(
  result: any,
  executionConfig: any,
  toolCalls?: any[],      // ← NEW
  toolResults?: any[]     // ← NEW
): ExecuteResult {
  // Format tool executions if present
  let formattedToolCalls: Array<{ name: string; arguments: any; result: any }> | undefined;
  if (toolCalls && toolResults) {
    formattedToolCalls = toolCalls.map((tc, index) => ({
      name: tc.toolName,
      arguments: tc.args,
      result: toolResults[index]?.result || {}
    }));
  }

  return {
    content: result.text,
    // ...
    toolCalls: formattedToolCalls  // ← NEW
  };
}
```

### 2. Agent Adapter - Pass Through Tool Executions

**File**: [src/services/agents/adapters/ai-agent-adapter.ts](src/services/agents/adapters/ai-agent-adapter.ts)

```typescript
return {
  content: result.content,
  usage: { ... },
  model: result.model,
  provider: result.provider || 'anthropic',
  sdk: this.sdkType,
  skillsTriggered,
  finishReason: result.finishReason,
  requestId,
  toolCalls: result.toolCalls  // ← NEW: Pass through from AIService
};
```

### 3. ChatHistory - Display Tool Executions

**File**: [tools/simple-agent/src/components/ChatHistory.tsx](tools/simple-agent/src/components/ChatHistory.tsx)

Added tool execution display to Message type and UI:

```typescript
type ToolCall = {
  name: string;
  arguments: any;
  result: any;
};

export type Message = {
  role: Role;
  content: string;
  usage?: Usage;
  toolCalls?: ToolCall[];  // ← NEW
};

// In assistant message rendering:
{message.toolCalls && message.toolCalls.length > 0 && (
  <Box flexDirection="column" marginBottom={1}>
    {message.toolCalls.map((toolCall, idx) => (
      <ToolExecutionBlock key={idx} toolCall={toolCall} />
    ))}
  </Box>
)}

{/* AI Response shown AFTER tool executions */}
<Text>{renderedContent}</Text>
```

### 4. ToolExecutionBlock Component

**File**: [tools/simple-agent/src/components/ChatHistory.tsx:152-210](tools/simple-agent/src/components/ChatHistory.tsx#L152-L210)

New component that displays:
- 🔧 Tool name
- Exit code (if available)
- Execution duration (if available)
- Tool arguments (JSON formatted)
- Raw stdout/stderr output

```typescript
function ToolExecutionBlock({ toolCall }: { toolCall: ToolCall }) {
  const { name, arguments: args, result } = toolCall;

  // Extract structured result (from skill execution)
  let output = '';
  let exitCode: number | undefined;
  let duration: number | undefined;

  if (result && typeof result === 'object') {
    exitCode = result.exitCode;
    duration = result.duration;
    output = result.stdout || result.error || JSON.stringify(result, null, 2);
  } else {
    output = typeof result === 'string' ? result : JSON.stringify(result, null, 2);
  }

  const isSuccess = exitCode === undefined || exitCode === 0;

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={isSuccess ? "gray" : "red"}  // Red border on failure
      paddingX={1}
      marginBottom={1}
    >
      {/* Tool Header */}
      <Box>
        <Text bold color="magenta">🔧 Tool:</Text>
        <Text color="magenta"> {name}</Text>
        {exitCode !== undefined && (
          <Text dimColor> (exit: {exitCode})</Text>
        )}
        {duration !== undefined && (
          <Text dimColor> ({duration}ms)</Text>
        )}
      </Box>

      {/* Tool Arguments */}
      {args && Object.keys(args).length > 0 && (
        <Box marginTop={0}>
          <Text dimColor>Args: {JSON.stringify(args)}</Text>
        </Box>
      )}

      {/* Tool Output */}
      <Box flexDirection="column" marginTop={0}>
        <Text dimColor>Output:</Text>
        <Box paddingLeft={1}>
          <Text color={isSuccess ? "white" : "red"}>{output.trim()}</Text>
        </Box>
      </Box>
    </Box>
  );
}
```

### 5. App Component - Pass Tool Calls to Messages

**File**: [tools/simple-agent/src/components/App.tsx:369-374](tools/simple-agent/src/components/App.tsx#L369-L374)

```typescript
setMessages(prev => [...prev, {
  role: 'assistant',
  content: result.message || '',
  usage: result.usage,
  toolCalls: result.toolCalls  // ← NEW: Pass through from agent result
}]);
```

## Example Output

**Before** (AI response only):
```
Agent: Hello, Charlie!
Welcome to our service.
We hope you have a great experience!

(Tokens: 150 • Prompt: 80 • Completion: 70)
```

**After** (Tool execution + AI response):
```
Agent:
  ╭────────────────────────────────────────╮
  │ 🔧 Tool: hello-world_greet (exit: 0) (152ms)
  │ Args: {"name":"Charlie"}
  │ Output:
  │   Hello, Charlie!
  ╰────────────────────────────────────────╯

  I've executed the greeting script for you. The tool
  returned a personalized greeting as requested.

  (Tokens: 150 • Prompt: 80 • Completion: 70)
```

## UI Features

### Visual Indicators
- 🔧 Tool emoji for easy identification
- **Magenta color** for tool names
- **Gray border** for successful execution
- **Red border** for failed execution (exit code ≠ 0)
- **Dimmed text** for metadata (args, labels)

### Information Displayed
1. **Tool Name**: The executed tool/skill
2. **Exit Code**: Process exit status (0 = success)
3. **Duration**: Execution time in milliseconds
4. **Arguments**: Input parameters (JSON formatted)
5. **Output**: Raw stdout or error message

### Error Handling
- Exit code shown in output
- Red text for error output
- Error messages from stderr displayed
- Failed tools highlighted with red border

## Bug Fixes

### Skills Loading Error

**Problem**: `⚠️ Skills system error: Unable to transform response from server`

**Cause**: The `agents.skills.list` endpoint returns `{ skills: [...] }` but the client expected a direct array.

**Fix**: [tools/simple-agent/src/components/App.tsx:145-146](tools/simple-agent/src/components/App.tsx#L145-L146)

```typescript
// Before
const skills = await client.agents.skills.list.query();

// After
const response = await client.agents.skills.list.query();
const skills = response?.skills || [];
```

## Benefits

1. **Transparency**: Users see exactly what tools return
2. **Debugging**: Easy to verify tool behavior vs. AI interpretation
3. **Trust**: Clear separation of tool facts vs. AI commentary
4. **Performance**: Duration shows execution time
5. **Error Diagnosis**: Exit codes and stderr help troubleshoot

## Testing

To test the new UI:

```bash
# Build the changes
pnpm build

# Start simple-agent
cd tools/simple-agent
pnpm start

# Execute a skill that uses tools
> Use the hello world skill to greet "Alice"
```

Expected output:
1. Tool execution block showing raw output
2. AI response interpreting/explaining the result

## Files Modified

- `src/services/ai/ai-service.ts` - Added tool execution tracking
- `src/services/agents/adapters/ai-agent-adapter.ts` - Pass through tool calls
- `tools/simple-agent/src/components/ChatHistory.tsx` - Tool UI component
- `tools/simple-agent/src/components/App.tsx` - Pass tool calls to messages, fixed skills loading

## Related Documentation

- [TOOL_OUTPUT_TESTING_GUIDE.md](TOOL_OUTPUT_TESTING_GUIDE.md) - How to test raw tool output
- [DUPLICATE_TOOL_RESULTS_FIX.md](DUPLICATE_TOOL_RESULTS_FIX.md) - Tool calling architecture fixes

## Future Enhancements

Potential improvements:
- Collapsible tool execution blocks
- Syntax highlighting for JSON output
- Tool execution timeline/trace view
- Filter messages to show only tool executions
- Export tool execution logs
