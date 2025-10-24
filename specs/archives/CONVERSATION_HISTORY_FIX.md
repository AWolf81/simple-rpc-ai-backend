# Conversation History Fix Summary

## Problem
Simple-agent was experiencing OpenRouter API errors when executing skills:
```
Invalid prompt: The messages must be a ModelMessage[]. If you have passed a UIMessage[],
you can use convertToModelMessages to convert them.
```

## Root Cause
Two issues were found:

1. **AIService**: The `execute()` method only supported single-message requests and didn't have conversation history support
2. **Agent Adapter Bug**: The adapter was building a messages array but then passing the wrong variable (`request.messages` instead of the built `conversationHistory`) to AIService

## Solution Implemented

### 1. Updated ExecuteRequest Interface
**File**: [src/services/ai/ai-service.ts:191](src/services/ai/ai-service.ts#L191)

Added conversation history support:
```typescript
export interface ExecuteRequest {
  content: string;
  promptId?: string;
  systemPrompt?: string;
  messages?: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>; // NEW
  tools?: Array<{...}>;
  // ...
}
```

### 2. Updated execute() Method
**File**: [src/services/ai/ai-service.ts:502-515](src/services/ai/ai-service.ts#L502-L515)

Now properly handles conversation history:
```typescript
// Build messages array - use provided messages or create new one
let conversationMessages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
if (request.messages && request.messages.length > 0) {
  // Use provided conversation history and append current message
  conversationMessages = [
    ...request.messages,
    { role: 'user', content: userPrompt }
  ];
} else {
  // Simple single-message case
  conversationMessages = [
    { role: 'user', content: userPrompt }
  ];
}
```

### 3. Fixed AI Agent Adapter
**File**: [src/services/agents/adapters/ai-agent-adapter.ts:94-108,145](src/services/agents/adapters/ai-agent-adapter.ts#L94-L108)

**Bug**: The adapter was building a `messages` array but passing `request.messages` instead.

**Fix**: Properly build conversation history and pass it to AIService:
```typescript
// Build conversation messages from history (AIService will append current prompt)
const conversationHistory: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> = [];

// Add conversation history if provided
if (request.messages) {
  request.messages.forEach(m => {
    conversationHistory.push({
      role: m.role as 'user' | 'assistant' | 'system',
      content: m.content
    });
  });
}

// Later in execute call:
const result = await this.aiService.execute({
  content: request.prompt,
  systemPrompt: systemPrompt,
  messages: conversationHistory, // FIXED - Pass cleaned conversation history
  tools: aiServiceTools.length > 0 ? aiServiceTools : undefined,
  // ...
});
```

## Testing
Verified with comprehensive tests:

### Basic AIService Tests (`test-conversation-history.js`)
1. ✅ Simple message without history - Works
2. ✅ Message with conversation history - Works

### Agent Execution Tests (`test-agent-conversation.js`)
1. ✅ Simple agent request (no history) - Works with OpenRouter
2. ✅ Agent request with conversation history - Works with OpenRouter
3. ✅ **Execute greet skill with conversation history** - No more OpenRouter error! 🎉

The OpenRouter error is now **completely resolved** and conversation history is properly maintained across multiple turns in both basic AI calls and agent executions.

## Files Modified
- `src/services/ai/ai-service.ts` - Added messages support and debug logging
- `src/services/agents/adapters/ai-agent-adapter.ts` - Fixed conversation history handling

## Impact
- ✅ Fixes OpenRouter skill execution errors
- ✅ Enables proper conversation history for all AI providers (Anthropic, OpenAI, Google, OpenRouter)
- ✅ Maintains backward compatibility (messages parameter is optional)
- ✅ Works with agent execution, skills, and direct AI calls
- ✅ No breaking changes to existing code

## How to Use in simple-agent
Simple-agent will automatically benefit from this fix. Just rebuild:

```bash
# In the project root
pnpm build

# In tools/simple-agent
cd tools/simple-agent && pnpm build
```

Then run simple-agent normally - conversation history will work automatically!
