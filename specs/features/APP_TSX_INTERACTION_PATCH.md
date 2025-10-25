# App.tsx Interaction Handling Patch

## Required Changes to App.tsx

### 1. Add State for Pending Conversation

Add after line 66 (after `toolProgressRef`):

```typescript
// Conversation tracking for interactions
const [pendingConversation, setPendingConversation] = useState<{
  conversationId: string;
  interaction: any;
} | null>(null);
const [conversationId, setConversationId] = useState<string | null>(null);
```

### 2. Update Agent Execute Call (line 407)

Replace:
```typescript
const result = await client.agents.execute.mutate({
  prompt: userMessage,
  systemPrompt: systemPrompt,
  provider: provider,
  model: model,
  messages: priorConversation
});
```

With:
```typescript
const result = await client.agents.execute.mutate({
  prompt: userMessage,
  systemPrompt: systemPrompt,
  provider: provider,
  model: model,
  messages: priorConversation,
  conversationId: conversationId || undefined  // Pass conversation ID if exists
});
```

### 3. Handle Interaction Response (after line 414)

Replace the result handling (lines 416-443) with:

```typescript
// Check for interaction requirement
if (result.type === 'interaction_required') {
  logger.info(`🔔 Interaction required - showing dialog`);

  // Store conversation ID
  setConversationId(result.conversationId);

  // Add interaction message to UI
  setMessages(prev => [...prev, {
    role: 'interaction',
    content: '',
    interaction: result.interaction
  }]);

  // Store pending conversation
  setPendingConversation({
    conversationId: result.conversationId,
    interaction: result.interaction
  });

  setIsLoading(false);
  return;
}

// Normal completion - update conversation ID
if (result.conversationId) {
  setConversationId(result.conversationId);
}

const progressFromResult = Array.isArray(result.progressMessages) && result.progressMessages.length > 0
  ? result.progressMessages
  : toolProgressRef.current;

if (progressFromResult.length > 0) {
  setToolProgress(progressFromResult);
  toolProgressRef.current = progressFromResult;
}

setMessages(prev => {
  const next = [...prev];
  if (progressFromResult.length > 0) {
    const summary = ['🛠️ Progress:']
      .concat(progressFromResult.map((msg, idx) => `${idx + 1}. ${msg}`))
      .join('\n');
    next.push({
      role: 'system',
      content: summary
    });
  }
  next.push({
    role: 'assistant',
    content: result.content || result.message || '',
    usage: result.usage,
    toolCalls: result.toolCalls
  });
  return next;
});
```

### 4. Add Interaction Response Handler

Add new function after `handleSubmit` (around line 475):

```typescript
const handleInteractionResponse = async (response: string | string[]) => {
  if (!pendingConversation) {
    logger.error('No pending conversation for interaction response');
    return;
  }

  setIsLoading(true);

  // Remove interaction message, add user response
  setMessages(prev => {
    const withoutInteraction = prev.filter(m => m.role !== 'interaction');
    const responseText = Array.isArray(response) ? response.join(', ') : response;
    return [...withoutInteraction, {
      role: 'user',
      content: responseText
    }];
  });

  try {
    // Resume agent with user response
    const result = await client.agents.resume.mutate({
      conversationId: pendingConversation.conversationId,
      response
    });

    // Check if another interaction is required
    if (result.type === 'interaction_required') {
      logger.info(`🔔 Another interaction required`);

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
    setPendingConversation(null);

    setMessages(prev => [...prev, {
      role: 'assistant',
      content: result.content || '',
      usage: result.usage,
      toolCalls: result.toolCalls
    }]);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    setMessages(prev => [...prev, {
      role: 'error',
      content: `Resume failed: ${errorMessage}`
    }]);
  } finally {
    setIsLoading(false);
  }
};

const handleInteractionCancel = () => {
  // Remove interaction message
  setMessages(prev => prev.filter(m => m.role !== 'interaction'));
  setPendingConversation(null);
  setIsLoading(false);
};
```

### 5. Update ChatHistory Component Call (around line 580)

Replace:
```typescript
<ChatHistory messages={messages} />
```

With:
```typescript
<ChatHistory
  messages={messages}
  onInteractionResponse={handleInteractionResponse}
  onInteractionCancel={handleInteractionCancel}
/>
```

## Summary of Changes

1. **State**: Added `pendingConversation` and `conversationId` tracking
2. **Execute**: Pass `conversationId` to maintain conversation across requests
3. **Detection**: Check for `result.type === 'interaction_required'`
4. **UI**: Add interaction message with special role `'interaction'`
5. **Resume**: Call `agents.resume` mutation with user response
6. **Handlers**: Added `handleInteractionResponse` and `handleInteractionCancel`
7. **Props**: Pass handlers to ChatHistory component

## Testing

After applying these changes:

1. Start simple-agent: `pnpm exec simple-agent`
2. Ask agent to create a file: "Create a file at /tmp with a summary"
3. Agent should call user-interaction skill
4. UI should show interactive dialog (SelectDialog, ConfirmDialog, or InputDialog)
5. Select response with arrow keys and press Enter
6. Agent should resume and complete the task

## Files Modified

- `tools/simple-agent/src/components/App.tsx` - Added interaction handling
- Already completed: `tools/simple-agent/src/components/ChatHistory.tsx` - Supports interaction messages
- Already completed: `tools/simple-agent/src/components/UserInteractionDialog.tsx` - Dialog components
