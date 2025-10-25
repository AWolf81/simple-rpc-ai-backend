# XML Interaction Protocol - Remaining Integration Work

## Completed ✅

1. **Conversation State Manager** - [conversation-state-manager.ts](../../src/services/agents/conversation-state-manager.ts)
2. **XML Parser** - [xml-interaction-parser.ts](../../src/services/agents/skills/utils/xml-interaction-parser.ts)
3. **User-Interaction Scripts** - All output XML with exit code 42
4. **Tool Execution Detection** - [tools-converter.ts](../../src/services/agents/skills/tools-converter.ts) detects interactions

## Remaining Work 📋

### 1. Propagate Interaction Through AIService

**File:** `src/services/ai/ai-service.ts`

The AIService executes tools and needs to detect when a tool returns an interaction marker.

**Current Flow:**
```
Tool Execute → {__interaction_required__: true, interaction: {...}}
          ↓
AIService → Needs to detect and propagate this
          ↓
AI Agent Adapter → Needs to return interaction instead of normal result
          ↓
Agents Router → Return interaction to client
```

**Implementation:**

In `AIService.execute()`, after tool execution, check tool results:

```typescript
// In AIService.execute() - after tools are executed
if (result.toolCalls) {
  for (const toolCall of result.toolCalls) {
    const toolResult = toolCall.result;

    // Check for interaction marker
    if (toolResult && typeof toolResult === 'object' && toolResult.__interaction_required__) {
      // Interaction detected - return special result
      return {
        type: 'interaction_required',
        interaction: toolResult.interaction,
        toolName: toolResult.toolName,
        partialContent: result.content, // Any response before interaction
        toolCalls: result.toolCalls
      };
    }
  }
}

// Normal result
return {
  type: 'completed',
  content: result.content,
  ...result
};
```

### 2. Handle Interaction in AI Agent Adapter

**File:** `src/services/agents/adapters/ai-agent-adapter.ts`

The adapter receives the AIService result and needs to propagate interactions.

```typescript
// In AIAgentAdapter.execute()
const result = await this.aiService.execute({...});

// Check for interaction
if (result.type === 'interaction_required') {
  return {
    type: 'interaction_required',
    interaction: result.interaction,
    toolName: result.toolName,
    partialContent: result.partialContent,
    requestId,
    provider: 'anthropic',
    sdk: this.sdkType
  };
}

// Normal completion
return {
  type: 'completed',
  content: result.content,
  usage: result.usage,
  ...
};
```

### 3. Update Agents Router with Resume Endpoint

**File:** `src/trpc/routers/agents/index.ts`

Add conversation tracking and resume endpoint:

```typescript
import { getConversationStateManager } from '../../../services/agents/conversation-state-manager.js';

const conversationManager = getConversationStateManager();

export function createAgentRouter(config: AgentRouterConfig = {}) {
  return router({
    execute: publicProcedure
      .input(AgentExecuteRequestSchema.extend({
        conversationId: z.string().optional()
      }))
      .mutation(async ({ input }) => {
        // Get or create conversation
        let convId = input.conversationId;
        let state = convId ? conversationManager.get(convId) : null;

        if (!state) {
          state = conversationManager.create({
            messages: input.messages || [],
            model: input.model || 'claude-3-5-sonnet-20241022',
            provider: input.provider,
            systemPrompt: input.systemPrompt
          });
          convId = state.id;
        }

        // Execute agent
        const result = await agentService.execute(input, skillTools);

        // Check for interaction
        if (result.type === 'interaction_required') {
          // Save conversation state with pending interaction
          conversationManager.pause(
            convId!,
            result.interaction,
            { name: result.toolName, arguments: {} }
          );

          return {
            conversationId: convId,
            type: 'interaction_required',
            interaction: result.interaction,
            partialContent: result.partialContent
          };
        }

        // Normal completion
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
            message: 'No pending interaction for conversation'
          });
        }

        // Add user response to messages
        state.messages.push({
          role: 'user',
          content: Array.isArray(input.response)
            ? input.response.join(', ')
            : input.response
        });

        // Resume agent execution with new messages
        const result = await agentService.execute({
          prompt: `[User responded: ${JSON.stringify(input.response)}]`,
          messages: state.messages,
          model: state.model,
          provider: state.provider,
          systemPrompt: state.systemPrompt
        }, skillTools);

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
}
```

### 4. Update App.tsx for Interaction Handling

**File:** `tools/simple-agent/src/components/App.tsx`

Add conversation tracking and interaction handling:

```typescript
// Add state
const [pendingConversation, setPendingConversation] = useState<{
  conversationId: string;
  interaction: InteractionData;
} | null>(null);

// Update handleSubmit
async function handleSubmit(value: string) {
  const userMessage = value.trim();
  setInput('');

  // Add user message
  setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
  setIsLoading(true);

  try {
    const result = await client.agents.execute.mutate({
      prompt: userMessage,
      conversationId: pendingConversation?.conversationId,
      messages: priorConversation,
      model,
      provider
    });

    // Check for interaction
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

  } catch (error) {
    setMessages(prev => [...prev, {
      role: 'error',
      content: error.message
    }]);
  } finally {
    setIsLoading(false);
  }
}

// Add interaction response handler
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

// Update ChatHistory to use callback
<ChatHistory
  messages={messages}
  onInteractionResponse={handleInteractionResponse}
  onInteractionCancel={() => setPendingConversation(null)}
/>
```

## Testing Checklist

1. ✅ XML parser works with various inputs
2. ✅ Scripts output correct XML format
3. ✅ Tools-converter detects exit code 42 + XML
4. ⏳ AIService propagates interaction marker
5. ⏳ Adapter returns interaction result
6. ⏳ Router creates and resumes conversations
7. ⏳ App.tsx shows UI and handles responses
8. ⏳ End-to-end flow works

## Estimated Time Remaining

- AIService changes: 30 minutes
- Adapter changes: 20 minutes
- Router changes: 45 minutes
- App.tsx changes: 30 minutes
- Testing & debugging: 1-2 hours

**Total:** ~3-4 hours

## Next Steps

1. Update AIService to detect `__interaction_required__` marker
2. Update adapters to propagate interaction results
3. Add resume endpoint to agents router
4. Update App.tsx with interaction handling
5. Test complete flow end-to-end
