# Tool Output Testing Guide

## Problem: AI Embellishes Tool Results

When you execute a skill script via the AI agent, you might see output that's different from the actual script output.

### Example

**Direct script execution:**
```bash
$ npx tsx examples/03-agents-basic/custom-skills/hello-world/scripts/greet.ts "Charlie"
Hello, Charlie!
```

**Agent execution:**
```bash
$ npx tsx tools/simple-agent/dist/cli.ts exec "Execute the greet script with name 'Charlie'"
```

Output:
```
Hello, Charlie!
Welcome to our service.
We hope you have a great experience!
```

**Why?** The AI receives the tool result (`Hello, Charlie!`) and then **generates a response** that includes additional context.

## How Tool Execution Works

### 1. **Tool Returns Raw Output**

The skill tool converter ([tools-converter.ts:98-104](src/services/agents/skills/tools-converter.ts#L98-L104)) returns:

```typescript
{
  success: true,
  exitCode: 0,
  stdout: "Hello, Charlie!\n",  // ← Raw script output
  stderr: "",
  duration: 152
}
```

### 2. **AI Receives Tool Result**

The AI gets this structured result and sees:
- ✅ Tool executed successfully
- 📄 Output: "Hello, Charlie!"

### 3. **AI Generates Response**

The AI then generates a human-friendly response that may include:
- The tool output
- Additional context or explanation
- Formatting improvements
- Related suggestions

This is **intentional behavior** - the AI is designed to be helpful and conversational, not just a pass-through for tool output.

## How to Test Tool Output Directly

### Option 1: Direct Script Execution (Recommended)

```bash
# Navigate to script directory
cd examples/03-agents-basic/custom-skills/hello-world/scripts

# Execute script directly
npx tsx greet.ts "Charlie"
# Output: Hello, Charlie!

# With formal flag
npx tsx greet.ts "Charlie" --formal
# Output: Good day, Charlie. How may I assist you?
```

This gives you **exactly** what the script outputs, with no AI interpretation.

### Option 2: Log Tool Results (For Debugging)

Enable debug logging to see the raw tool results:

```bash
LOG_LEVEL=debug npx tsx tools/simple-agent/dist/cli.ts exec "Use greet tool with name Charlie"
```

Look for lines like:
```
🔧 Executing tool: hello_world_greet (ID: tool_abc123)
🔧 Parsed script args: { scriptArgs: ['Charlie'], stdin: undefined, cwd: undefined }
✅ Tool execution result: {
  success: true,
  exitCode: 0,
  stdout: "Hello, Charlie!\n",
  stderr: "",
  duration: 152
}
```

### Option 3: Test via tRPC Direct Call (Advanced)

You can call the agent service directly via tRPC to get structured results:

```typescript
import { createTypedAIClient } from 'simple-rpc-ai-backend';

const client = createTypedAIClient({
  links: [httpBatchLink({ url: 'http://localhost:8000/trpc' })]
});

// Call agent with tool
const result = await client.agents.execute.mutate({
  prompt: 'Execute the greet script with name "Charlie"',
  context: {
    skills: [/* skill objects */]
  }
});

console.log('AI Response:', result.content);
// Console will also log tool results separately
```

## Understanding the Difference

| Method | Output Type | Use Case |
|--------|-------------|----------|
| **Direct Script** | Raw stdout | Testing script logic |
| **Debug Logs** | Structured result | Debugging tool execution |
| **Agent Execution** | AI-enhanced response | Production use |

## Why AI Embellishment is Actually Good

The AI's behavior of adding context is **intentional and beneficial**:

1. **User-Friendly**: Provides explanation and context
2. **Error Handling**: Interprets errors and suggests fixes
3. **Multi-Step Tasks**: Chains multiple tool calls
4. **Natural Language**: Converts structured data to readable text

### Example: Error Handling

**Raw script output:**
```
Error: Name required
Usage: tsx greet.ts <name> [--formal]
```

**AI-enhanced response:**
```
It looks like the greeting script needs a name parameter.
Let me run it correctly with your name.

[Executes tool with correct parameters]

Hello, Charlie!

I've generated a personalized greeting for you. Would you like
a formal greeting instead? I can add the --formal flag.
```

## Best Practice: When to Use Each Method

### Use Direct Script Execution When:
- ✅ Testing script logic
- ✅ Verifying output format
- ✅ Debugging script bugs
- ✅ Running automated tests

### Use Agent Execution When:
- ✅ Production usage
- ✅ User-facing features
- ✅ Multi-step workflows
- ✅ Natural language interfaces

### Use Debug Logs When:
- ✅ Debugging tool integration
- ✅ Verifying tool arguments
- ✅ Checking exit codes
- ✅ Investigating failures

## Comparing Test Results

To verify your tool works correctly:

1. **Test script directly:**
   ```bash
   npx tsx greet.ts "Charlie"
   # Expected: Hello, Charlie!
   ```

2. **Test via agent with debug logs:**
   ```bash
   LOG_LEVEL=debug npx tsx tools/simple-agent/dist/cli.ts exec "greet Charlie"
   ```

3. **Check debug logs show:**
   ```
   stdout: "Hello, Charlie!\n"
   ```

4. **Verify AI response includes:**
   - The actual greeting
   - Possibly additional context (this is fine!)

If the **debug log stdout matches direct execution**, your tool is working correctly. Any additional text in the AI response is intentional enhancement.

## Common Issues

### Issue: "Tool output doesn't match script output"

**Diagnosis:**
- Check debug logs: `LOG_LEVEL=debug`
- Verify `stdout:` field in logs
- Compare with direct script execution

**Resolution:**
- If `stdout` matches → AI is enhancing (expected)
- If `stdout` differs → Tool bug (needs fixing)

### Issue: "AI adds too much context"

**Diagnosis:**
- This is expected behavior
- AI is being helpful, not incorrect

**Resolution:**
- Adjust system prompt to request minimal responses
- Example: "Return only the raw tool output, no additional text"

### Issue: "Tool arguments not passed correctly"

**Diagnosis:**
- Check debug logs for `scriptArgs`
- Verify argument parsing in `tools-converter.ts`

**Resolution:**
- Tool expects positional args: `[name]`
- AI might pass: `{ name: "Charlie" }`
- Converter handles this automatically

## Advanced: Controlling AI Response Style

You can control how much the AI embellishes by adjusting the system prompt:

```typescript
// Minimal embellishment
const result = await agentService.execute({
  prompt: 'Execute greet script with name Charlie',
  systemPrompt: 'Execute tools and return their raw output. Do not add explanations.',
  // ...
});

// Maximum embellishment
const result = await agentService.execute({
  prompt: 'Execute greet script with name Charlie',
  systemPrompt: 'You are a friendly assistant. Explain tool results in detail.',
  // ...
});
```

## Summary

- ✅ **Tool output is correct** - Raw stdout matches script execution
- ✅ **AI embellishment is expected** - Provides better UX
- ✅ **Test scripts directly** - For verifying script logic
- ✅ **Use debug logs** - For verifying tool integration
- ✅ **Use agent execution** - For production and user-facing features

The "extra" text in agent responses is a **feature, not a bug**.
