# XML Interaction Protocol - Implementation Status

## Completed ✅

### 1. XML Parser Infrastructure
- ✅ Created `xml-interaction-parser.ts` using `fast-xml-parser`
- ✅ Implemented `parseInteractionXML()` for robust parsing
- ✅ Implemented `generateInteractionXML()` for XML generation
- ✅ Implemented `InteractionStreamParser` for streaming support
- ✅ Added response XML parsing and generation

### 2. User-Interaction Scripts
All scripts now output XML markers instead of JSON:
- ✅ `confirm.ts` - Outputs `<interaction type="confirm">` XML
- ✅ `select.ts` - Outputs `<interaction type="select">` XML
- ✅ `input.ts` - Outputs `<interaction type="input">` XML
- ✅ `approval-dialog.ts` - Outputs `<interaction type="approval">` XML

**Exit Code Convention:**
- Exit code `42` indicates UI interaction needed
- Allows graceful detection even if XML parsing fails

### 3. Non-Interactive Modes
All scripts support non-interactive modes via `USER_INTERACTION_MODE` env var:
- `auto-approve` - Automatically approve
- `auto-deny` - Automatically deny
- `default` - Use default value
- `xml` (default) - Output XML and exit with code 42

### 4. TypeScript Type Fixes
- ✅ Fixed `ApprovalCallback` type mismatch in `types.ts`
- ✅ Added `requestId` and `timestamp` to callback response type

### 5. Documentation
- ✅ `XML_INTERACTION_PROTOCOL.md` - Complete protocol specification
- ✅ `USER_INTERACTION_UI.md` - UI component documentation
- ✅ Examples in `agent-user-interaction-example.ts`

## In Progress 🚧

### TypeScript Compilation
- Type error in `skills/manager.ts` has been fixed
- Need to run build to verify

## Remaining Work 📋

### 1. Agent Executor Integration
**File:** `src/services/agents/executor.ts` or `src/services/AIService.ts`

```typescript
import {
  parseInteractionXML,
  extractInteractionXML,
  containsInteraction
} from './skills/utils/xml-interaction-parser.js';

async function executeToolCall(toolCall: ToolCall): Promise<ToolResult> {
  const result = await runTool(toolCall);

  // Check exit code 42 (interaction needed)
  if (result.exitCode === 42) {
    // Try to parse XML from stdout
    const xml = extractInteractionXML(result.stdout);
    if (xml) {
      const interaction = parseInteractionXML(xml);
      if (interaction) {
        return {
          type: 'interaction_required',
          interaction,
          toolName: toolCall.name,
          originalResult: result
        };
      }
    }
  }

  return result;
}
```

### 2. Conversation State Management
**File:** `src/services/agents/conversation-state-manager.ts` (new file)

```typescript
export interface ConversationState {
  id: string;
  messages: Message[];
  pendingInteraction?: {
    toolName: string;
    interaction: InteractionData;
    toolCall: ToolCall;
    timestamp: number;
  };
  model: string;
  provider?: string;
  systemPrompt?: string;
}

export class ConversationStateManager {
  private states = new Map<string, ConversationState>();
  private ttl = 30 * 60 * 1000; // 30 minutes

  create(state: Omit<ConversationState, 'id'>): string {
    const id = generateId();
    this.states.set(id, { ...state, id });
    this.scheduleCleanup(id);
    return id;
  }

  pause(id: string, interaction: InteractionData, toolCall: ToolCall) {
    const state = this.states.get(id);
    if (state) {
      state.pendingInteraction = {
        toolName: toolCall.name,
        interaction,
        toolCall,
        timestamp: Date.now()
      };
    }
  }

  resume(id: string, response: string | string[]): ConversationState | null {
    const state = this.states.get(id);
    if (!state?.pendingInteraction) return null;

    state.pendingInteraction = undefined;
    return state;
  }

  get(id: string): ConversationState | null {
    return this.states.get(id) || null;
  }

  delete(id: string) {
    this.states.delete(id);
  }

  private scheduleCleanup(id: string) {
    setTimeout(() => this.delete(id), this.ttl);
  }
}
```

### 3. tRPC Router Updates
**File:** `src/trpc/routers/agents.ts`

Add conversation tracking and resume endpoint:

```typescript
import { ConversationStateManager } from '../../services/agents/conversation-state-manager.js';

const conversationManager = new ConversationStateManager();

export const agentsRouter = router({
  execute: publicProcedure
    .input(z.object({
      prompt: z.string(),
      conversationId: z.string().optional(),
      messages: z.array(messageSchema).optional(),
      // ... other fields
    }))
    .mutation(async ({ input, ctx }) => {
      const convId = input.conversationId || generateId();

      // Create or get conversation state
      let state = conversationManager.get(convId);
      if (!state) {
        state = {
          id: convId,
          messages: input.messages || [],
          model: input.model,
          provider: input.provider,
          systemPrompt: input.systemPrompt
        };
        conversationManager.create(state);
      }

      // Execute agent
      const result = await executeAgent(input, state);

      // Check for interaction
      if (result.interaction) {
        conversationManager.pause(convId, result.interaction, result.toolCall);

        return {
          conversationId: convId,
          type: 'interaction_required',
          interaction: result.interaction,
          partialContent: result.partialContent
        };
      }

      return {
        conversationId: convId,
        type: 'completed',
        content: result.content,
        usage: result.usage,
        toolCalls: result.toolCalls
      };
    }),

  resume: publicProcedure
    .input(z.object({
      conversationId: z.string(),
      response: z.union([z.string(), z.array(z.string())])
    }))
    .mutation(async ({ input }) => {
      const state = conversationManager.get(input.conversationId);
      if (!state?.pendingInteraction) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'No pending interaction found for conversation'
        });
      }

      // Add user response to conversation
      state.messages.push({
        role: 'user',
        content: `[User interaction response: ${JSON.stringify(input.response)}]`
      });

      // Resume execution with response
      const result = await continueAgentWithResponse(state, input.response);

      // Clear pending interaction
      conversationManager.resume(input.conversationId, input.response);

      return {
        conversationId: input.conversationId,
        type: 'completed',
        content: result.content,
        usage: result.usage,
        toolCalls: result.toolCalls
      };
    })
});
```

### 4. Simple-Agent App.tsx Integration
**File:** `tools/simple-agent/src/components/App.tsx`

Add conversation tracking and interaction handling:

```typescript
const [pendingConversation, setPendingConversation] = useState<{
  conversationId: string;
  interaction: InteractionData;
} | null>(null);

async function handleSubmit(value: string) {
  // ... existing code

  const result = await client.agents.execute.mutate({
    prompt: userMessage,
    conversationId: pendingConversation?.conversationId,
    messages: priorConversation,
    model,
    provider
  });

  if (result.type === 'interaction_required') {
    // Add interaction message to UI
    setMessages(prev => [...prev, {
      role: 'interaction',
      content: '',
      interaction: result.interaction
    }]);

    setPendingConversation({
      conversationId: result.conversationId,
      interaction: result.interaction
    });

    setIsLoading(false);
    return;
  }

  // Normal completion
  setMessages(prev => [...prev, {
    role: 'assistant',
    content: result.content,
    usage: result.usage,
    toolCalls: result.toolCalls
  }]);

  setIsLoading(false);
}

function handleInteractionResponse(response: string | string[]) {
  if (!pendingConversation) return;

  setIsLoading(true);

  // Remove interaction message, add user response
  setMessages(prev => {
    const withoutInteraction = prev.filter(m => m.role !== 'interaction');
    return [...withoutInteraction, {
      role: 'user',
      content: Array.isArray(response) ? response.join(', ') : response
    }];
  });

  // Resume agent
  client.agents.resume.mutate({
    conversationId: pendingConversation.conversationId,
    response
  }).then(result => {
    setMessages(prev => [...prev, {
      role: 'assistant',
      content: result.content,
      usage: result.usage,
      toolCalls: result.toolCalls
    }]);
    setPendingConversation(null);
  }).catch(error => {
    setMessages(prev => [...prev, {
      role: 'error',
      content: error.message
    }]);
  }).finally(() => {
    setIsLoading(false);
  });
}
```

### 5. ChatHistory Integration
**Already completed!** The ChatHistory component already supports interaction messages and callbacks.

## Testing Plan

### Unit Tests
1. Test XML parser with various inputs
2. Test streaming parser with partial XML
3. Test script XML output
4. Test conversation state management

### Integration Tests
1. Test agent execution → interaction detection
2. Test pause and resume flow
3. Test interaction response handling
4. Test conversation cleanup

### End-to-End Tests
1. Create file with confirmation
2. Multi-select options
3. Free-form input with AI interpretation
4. Nested interactions

## Next Steps

1. **Fix TypeScript build** - Verify compilation succeeds
2. **Implement conversation state manager** - New file
3. **Update agent executor** - Detect XML interactions
4. **Update agents router** - Add resume endpoint
5. **Update App.tsx** - Handle interactions and resume
6. **Test end-to-end** - Complete flow in simple-agent

## Estimated Remaining Time

- Conversation state manager: 30 minutes
- Agent executor updates: 45 minutes
- Router updates: 30 minutes
- App.tsx integration: 45 minutes
- Testing and debugging: 1-2 hours

**Total:** ~3-4 hours to full completion

## Benefits Achieved

✅ **Streaming-friendly** - XML can be detected in partial streams
✅ **Robust parsing** - fast-xml-parser handles malformed input
✅ **Clear protocol** - Exit code 42 + XML marker
✅ **Backward compatible** - Non-interactive modes preserved
✅ **Type-safe** - Full TypeScript support
✅ **Well-documented** - Complete specs and examples
