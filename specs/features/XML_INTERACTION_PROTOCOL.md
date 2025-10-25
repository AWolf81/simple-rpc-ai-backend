# XML Interaction Protocol

## Design Rationale

**Why XML over JSON:**
1. **Streaming-friendly**: Can parse incomplete XML streams
2. **Less brittle**: Doesn't break on formatting issues
3. **Clear boundaries**: `<interaction>...</interaction>` tags are unambiguous
4. **Partial parsing**: Can detect start tag before content arrives
5. **Robust**: Works even if JSON is mixed in (agent output)

## Protocol Specification

### XML Format

```xml
<interaction type="confirm">
  <title>Confirm Action</title>
  <message>Create file at /tmp/claude_summary.md?</message>
  <enable-ai-interpretation>true</enable-ai-interpretation>
  <ai-context>User requested file creation based on CLAUDE.md summary</ai-context>
</interaction>
```

### Supported Interaction Types

#### 1. Confirm Dialog

```xml
<interaction type="confirm">
  <title>Confirmation Required</title>
  <message>Delete file /tmp/example.txt?</message>
  <enable-ai-interpretation>true</enable-ai-interpretation>
  <ai-context>User requested file deletion</ai-context>
</interaction>
```

#### 2. Select Dialog

```xml
<interaction type="select">
  <title>Choose Action</title>
  <message>What would you like to do with the file?</message>
  <options>
    <option>Create new file</option>
    <option>Edit existing file</option>
    <option>Delete file</option>
    <option>Cancel</option>
  </options>
  <multi-select>false</multi-select>
</interaction>
```

#### 3. Input Dialog

```xml
<interaction type="input">
  <title>Enter Filename</title>
  <message>What should we name the new file?</message>
  <default-value>untitled.ts</default-value>
  <enable-ai-interpretation>true</enable-ai-interpretation>
  <ai-context>User wants to create a React component file</ai-context>
</interaction>
```

#### 4. Multi-Select Dialog

```xml
<interaction type="select">
  <title>Select Features</title>
  <message>Choose features to include (use Space to toggle):</message>
  <options>
    <option>TypeScript props interface</option>
    <option>useState hook</option>
    <option>useEffect hook</option>
    <option>CSS modules</option>
  </options>
  <multi-select>true</multi-select>
</interaction>
```

## Response Format

After user responds, the response is provided as:

```xml
<interaction-response>
  <value>yes</value>
</interaction-response>
```

Or for multi-select:

```xml
<interaction-response>
  <values>
    <value>TypeScript props interface</value>
    <value>useState hook</value>
  </values>
</interaction-response>
```

## Streaming Detection

### Partial XML Detection

```typescript
function detectInteractionStart(chunk: string): boolean {
  return chunk.includes('<interaction');
}

function detectInteractionEnd(chunk: string): boolean {
  return chunk.includes('</interaction>');
}

function extractInteraction(buffer: string): InteractionData | null {
  const match = buffer.match(/<interaction[^>]*>[\s\S]*?<\/interaction>/);
  if (match) {
    return parseInteractionXML(match[0]);
  }
  return null;
}
```

### Stream Processing

```typescript
class InteractionStreamParser {
  private buffer = '';
  private inInteraction = false;

  process(chunk: string): InteractionData | null {
    this.buffer += chunk;

    // Start of interaction
    if (!this.inInteraction && this.buffer.includes('<interaction')) {
      this.inInteraction = true;
    }

    // End of interaction
    if (this.inInteraction && this.buffer.includes('</interaction>')) {
      const interaction = extractInteraction(this.buffer);
      this.reset();
      return interaction;
    }

    return null;
  }

  reset() {
    this.buffer = '';
    this.inInteraction = false;
  }
}
```

## Implementation Flow

### 1. Script Output (user-interaction skill)

```typescript
// scripts/confirm.ts
function outputInteraction(args: ConfirmArgs) {
  const xml = `
<interaction type="confirm">
  <title>${escapeXML(args.title || 'Confirmation Required')}</title>
  <message>${escapeXML(args.message)}</message>
  <enable-ai-interpretation>${args.enableAIInterpretation || false}</enable-ai-interpretation>
  ${args.aiContext ? `<ai-context>${escapeXML(args.aiContext)}</ai-context>` : ''}
</interaction>
  `.trim();

  console.log(xml);
  process.exit(42); // Special exit code: awaiting user input
}
```

### 2. Agent Executor Detection

```typescript
// src/services/agents/executor.ts
async function executeToolCall(toolCall: ToolCall): Promise<ToolResult> {
  const result = await runTool(toolCall);

  // Check for interaction XML in output
  const interaction = extractInteraction(result.stdout);

  if (interaction) {
    return {
      type: 'interaction_required',
      interaction,
      toolName: toolCall.name,
      exitCode: result.exitCode
    };
  }

  return result;
}
```

### 3. Conversation State Management

```typescript
// src/services/agents/conversation-state.ts
interface ConversationState {
  id: string;
  messages: Message[];
  pendingInteraction?: {
    toolName: string;
    interaction: InteractionData;
    timestamp: number;
  };
  model: string;
  provider?: string;
  systemPrompt?: string;
}

class ConversationStateManager {
  private states = new Map<string, ConversationState>();

  pause(id: string, interaction: InteractionData, toolName: string) {
    const state = this.states.get(id);
    if (state) {
      state.pendingInteraction = {
        toolName,
        interaction,
        timestamp: Date.now()
      };
    }
  }

  resume(id: string, response: string | string[]): ConversationState | null {
    const state = this.states.get(id);
    if (!state?.pendingInteraction) return null;

    // Add interaction response to conversation
    state.messages.push({
      role: 'user',
      content: `User response: ${JSON.stringify(response)}`
    });

    state.pendingInteraction = undefined;
    return state;
  }
}
```

### 4. tRPC Router Updates

```typescript
// Add to agents router
export const agentsRouter = router({
  execute: publicProcedure
    .input(z.object({
      prompt: z.string(),
      conversationId: z.string().optional(),
      // ... other fields
    }))
    .mutation(async ({ input }) => {
      const convId = input.conversationId || generateId();

      // Execute agent
      const result = await executeAgent(input);

      // Check for interaction
      if (result.interaction) {
        // Save state
        conversationStateManager.pause(convId, result.interaction, result.toolName);

        return {
          conversationId: convId,
          type: 'interaction_required',
          interaction: result.interaction,
          partialResponse: result.partialContent
        };
      }

      return {
        conversationId: convId,
        type: 'completed',
        content: result.content,
        usage: result.usage
      };
    }),

  resume: publicProcedure
    .input(z.object({
      conversationId: z.string(),
      response: z.union([z.string(), z.array(z.string())])
    }))
    .mutation(async ({ input }) => {
      const state = conversationStateManager.resume(
        input.conversationId,
        input.response
      );

      if (!state) {
        throw new Error('No pending interaction found');
      }

      // Continue agent execution with response
      const result = await continueAgent(state, input.response);

      return {
        conversationId: input.conversationId,
        content: result.content,
        usage: result.usage
      };
    })
});
```

### 5. Simple-Agent Integration

```typescript
// App.tsx
const [pendingConversation, setPendingConversation] = useState<{
  conversationId: string;
  interaction: InteractionData;
} | null>(null);

async function handleSubmit(value: string) {
  // ... existing code

  const result = await client.agents.execute.mutate({
    prompt: userMessage,
    conversationId: pendingConversation?.conversationId,
    // ... other fields
  });

  if (result.type === 'interaction_required') {
    // Show UI dialog
    setMessages(prev => [...prev, {
      role: 'interaction',
      content: '',
      interaction: result.interaction
    }]);

    setPendingConversation({
      conversationId: result.conversationId,
      interaction: result.interaction
    });

    return;
  }

  // Normal completion
  setMessages(prev => [...prev, {
    role: 'assistant',
    content: result.content,
    usage: result.usage
  }]);
}

function handleInteractionResponse(response: string | string[]) {
  if (!pendingConversation) return;

  // Resume agent
  setIsLoading(true);

  client.agents.resume.mutate({
    conversationId: pendingConversation.conversationId,
    response
  }).then(result => {
    setMessages(prev => [...prev, {
      role: 'assistant',
      content: result.content,
      usage: result.usage
    }]);
    setPendingConversation(null);
  }).finally(() => {
    setIsLoading(false);
  });
}
```

## XML Escaping

```typescript
function escapeXML(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function unescapeXML(str: string): string {
  return str
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}
```

## Error Handling

```typescript
// Handle malformed XML gracefully
try {
  const interaction = parseInteractionXML(xml);
} catch (error) {
  console.error('Failed to parse interaction XML:', error);
  // Fall back to text-based interaction or error message
  return {
    type: 'error',
    message: 'Failed to parse interaction request'
  };
}
```

## Benefits

1. **Streaming-friendly**: Can detect `<interaction>` tag immediately
2. **Robust parsing**: XML parsers handle malformed input better
3. **Clear boundaries**: No ambiguity about where interaction starts/ends
4. **Mixed content**: Agent can output text + XML without issues
5. **Future-proof**: Easy to add new attributes/elements
6. **Debuggable**: Easy to see XML tags in logs

## Example Complete Flow

```
1. Agent calls: file_handling_write("Create /tmp/file.txt")
   ↓
2. Skill outputs:
   <interaction type="confirm">
     <message>Create /tmp/file.txt?</message>
   </interaction>
   ↓
3. Agent executor detects XML, pauses execution
   ↓
4. Returns to simple-agent with interaction data
   ↓
5. Simple-agent renders ConfirmDialog
   ↓
6. User presses 'y' (yes)
   ↓
7. Simple-agent calls agents.resume({ conversationId, response: "yes" })
   ↓
8. Agent executor continues with "yes" response
   ↓
9. Skill creates file
   ↓
10. Agent completes, returns success message
```
