# User Interaction Protocol

## Problem

The user-interaction skill scripts need to trigger UI dialogs in the simple-agent CLI, but:
1. Scripts run in child processes (can't directly access Ink UI)
2. Agent execution is async and needs to pause for user input
3. Response needs to be sent back to continue agent execution

## Solution: Special Output Protocol

### 1. Script Output Format

When a user-interaction script needs UI input, it outputs a special JSON marker:

```json
{
  "__ui_interaction__": true,
  "type": "confirm",
  "title": "Confirm Action",
  "message": "Create file at /tmp?",
  "options": ["Yes", "No"],
  "enableAIInterpretation": true,
  "aiContext": "Creating file based on user request"
}
```

### 2. Agent Executor Detection

The agent executor (AIService) detects this special output in tool results:
- Checks if tool output contains `__ui_interaction__` marker
- Extracts interaction data
- Returns special response to simple-agent

### 3. Simple-Agent Handling

The App component:
1. Detects interaction in agent response
2. Adds interaction message to chat history
3. Renders UserInteractionDialog
4. User provides response
5. Sends response back to agent
6. Agent continues execution

### 4. Flow Diagram

```
User: "Create a file"
         ↓
Agent: Calls file_handling_write
         ↓
Skill: Detects needs approval
         ↓
Skill: Outputs {"__ui_interaction__": true, "type": "confirm", ...}
         ↓
Agent Executor: Detects UI interaction marker
         ↓
Agent Executor: Pauses, returns interaction to client
         ↓
Simple-Agent: Renders UserInteractionDialog
         ↓
User: Responds (yes/no/custom)
         ↓
Simple-Agent: Sends response back
         ↓
Agent: Continues with user's response
         ↓
Agent: Completes file creation
```

## Implementation Steps

### Step 1: Update User-Interaction Scripts

```typescript
// scripts/confirm.ts
async function main() {
  const args = parseArgs(process.argv.slice(2));

  // Output UI interaction marker
  const interaction = {
    __ui_interaction__: true,
    type: 'confirm',
    title: 'Confirmation Required',
    message: args.message,
    enableAIInterpretation: args.enableAIInterpretation || false,
    aiContext: args.aiContext
  };

  console.log(JSON.stringify(interaction));

  // Exit - response will come from UI
  process.exit(0);
}
```

### Step 2: Update Agent Executor

```typescript
// In AIService or agent executor
function processToolResult(result: ToolResult): ProcessedResult {
  // Check for UI interaction marker
  if (result.stdout && typeof result.stdout === 'string') {
    try {
      const parsed = JSON.parse(result.stdout);
      if (parsed.__ui_interaction__) {
        return {
          type: 'ui_interaction',
          interaction: parsed,
          toolName: result.toolName
        };
      }
    } catch {
      // Not JSON, normal output
    }
  }

  return {
    type: 'normal',
    result
  };
}
```

### Step 3: Update Simple-Agent App

```typescript
// In App.tsx
async function handleAgentExecution(userMessage: string) {
  const result = await client.agents.execute.mutate({
    prompt: userMessage,
    ...
  });

  // Check for UI interaction
  if (result.interaction) {
    // Add interaction message
    setMessages(prev => [...prev, {
      role: 'interaction',
      content: '',
      interaction: result.interaction
    }]);

    // Store pending agent state
    setPendingAgent({
      conversationId: result.conversationId,
      waitingForInput: true
    });

    return; // Wait for user response
  }

  // Normal response
  setMessages(prev => [...prev, {
    role: 'assistant',
    content: result.content
  }]);
}

function handleInteractionResponse(response: string | string[]) {
  // Resume agent with response
  await client.agents.resume.mutate({
    conversationId: pendingAgent.conversationId,
    interactionResponse: response
  });
}
```

## Alternative: Simpler Approach (For MVP)

Instead of full pause-and-resume, use a simpler pattern:

1. User-interaction skill returns JSON with interaction details
2. Agent sees the result and includes it in response
3. Simple-agent detects special format in agent's text response
4. Shows UI dialog
5. User responds
6. New message sent to agent with response

This avoids complex state management but requires agent to handle the flow.

## Decision

**Use Alternative (Simpler) Approach for MVP:**
- Less complex server-side changes
- Works with existing agent execution model
- Agent can be prompted to handle interaction flow
- Can upgrade to full pause-resume later if needed

## Implementation (Simpler Approach)

### Update Scripts

Output a special format that agent can recognize:

```json
{
  "status": "awaiting_user_input",
  "interaction": {
    "type": "confirm",
    "message": "Create file?"
  }
}
```

### Update Agent System Prompt

```
When you receive `"status": "awaiting_user_input"` from a tool:
1. Ask the user for their decision
2. Use the user's response to continue
3. Call the appropriate tool based on their answer
```

### Update Simple-Agent

- Detect when agent asks for confirmation
- Show UI dialog instead of text
- Feed response back to agent

This is simpler and works within existing architecture!
