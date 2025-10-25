# User Interaction UI Components

The simple-agent CLI provides interactive UI components for user interactions during agent execution. These components support keyboard navigation and optional AI interpretation of free-form responses.

## Overview

The user interaction system consists of three main components:

1. **SelectDialog** - Choose from options with arrow key navigation
2. **InputDialog** - Free-form text input with optional AI interpretation
3. **ConfirmDialog** - Yes/No confirmation with optional custom responses

## Components

### SelectDialog

Arrow key navigation for choosing from a list of options. Supports both single and multi-select modes.

**Features:**
- ↑↓ arrow key navigation
- Single or multi-select mode
- Space bar to toggle in multi-select mode
- Visual indicators for selection

**Example Usage:**
```typescript
// In agent execution, add an interaction message
const interactionMessage = {
  role: 'interaction',
  content: '',
  interaction: {
    type: 'select',
    title: 'Choose Action',
    message: 'What would you like to do?',
    options: [
      'Create new file',
      'Edit existing file',
      'Delete file',
      'Cancel'
    ]
  }
};
```

**Multi-Select Example:**
```typescript
const interactionMessage = {
  role: 'interaction',
  content: '',
  interaction: {
    type: 'select',
    title: 'Choose Files',
    message: 'Select files to process (use Space to toggle)',
    options: ['file1.ts', 'file2.ts', 'file3.ts'],
    multiSelect: true
  }
};
```

### InputDialog

Free-form text input with optional AI interpretation. Perfect for letting users provide custom instructions or responses.

**Features:**
- Free-form text input
- Optional AI interpretation mode
- Backspace/Delete support
- Escape to cancel

**Example Usage:**
```typescript
// Basic input (no AI interpretation)
const interactionMessage = {
  role: 'interaction',
  content: '',
  interaction: {
    type: 'input',
    title: 'Enter Filename',
    message: 'What should we name the new file?',
    defaultValue: 'untitled.ts'
  }
};
```

**AI Interpretation Example:**
```typescript
// AI will interpret the user's free-form response
const interactionMessage = {
  role: 'interaction',
  content: '',
  interaction: {
    type: 'input',
    title: 'Provide Instructions',
    message: 'How should we proceed?',
    enableAIInterpretation: true,
    aiContext: 'User is deciding whether to create a new React component'
  }
};
```

**AI Interpretation Behavior:**
When `enableAIInterpretation: true`, users can provide natural language responses:
- "yes" → AI interprets as affirmative
- "no" → AI interprets as negative
- "do it but add TypeScript types first" → AI extracts conditional approval
- "don't do it" → AI interprets as rejection
- "not now" → AI interprets as postponement

### ConfirmDialog

Yes/No confirmation with optional custom response mode for AI interpretation.

**Features:**
- ↑↓ arrow key navigation or y/n keys
- Optional custom response mode (press 'c')
- AI interpretation of custom responses

**Example Usage:**
```typescript
// Basic confirmation
const interactionMessage = {
  role: 'interaction',
  content: '',
  interaction: {
    type: 'confirm',
    title: 'Confirm Action',
    message: 'Are you sure you want to delete this file?'
  }
};
```

**AI Interpretation Example:**
```typescript
// Allow custom responses with AI interpretation
const interactionMessage = {
  role: 'interaction',
  content: '',
  interaction: {
    type: 'confirm',
    title: 'Confirm Deployment',
    message: 'Deploy to production?',
    enableAIInterpretation: true,
    aiContext: 'Deploying version 2.1.0 to production environment'
  }
};
```

When `enableAIInterpretation: true`, users can:
- Press 'y' for yes
- Press 'n' for no
- Press 'c' for custom response (AI will interpret)

## Integration with Agents

To use these components in your agent, you need to:

1. **Add interaction message to chat history**
2. **Handle the user's response**
3. **Continue agent execution based on response**

### Example: Agent with User Interaction

```typescript
import { createRpcAiServer } from 'simple-rpc-ai-backend';

// Create server with agents enabled
const server = createRpcAiServer({
  agents: {
    enabled: true,
    skills: {
      sources: [
        { type: 'builtin', name: 'user-interaction' }
      ]
    }
  }
});

// Agent execution
const result = await client.agents.execute.mutate({
  messages: [
    {
      role: 'user',
      content: 'Create a new React component for me'
    }
  ]
});

// When agent needs user input, it will call the user-interaction skill
// The skill returns a special response that simple-agent UI will render as an interactive dialog
```

### Example: Custom Agent Tool with Interaction

```typescript
// In your agent's tool execution
async function executeWithConfirmation(action: string) {
  // Request user confirmation via user-interaction skill
  const confirmResult = await executeSkill('user_interaction_confirm', {
    message: `Confirm: ${action}?`,
    'enable-ai-interpretation': true
  });

  // confirmResult.stdout contains the user's response
  const response = confirmResult.stdout.trim();

  if (response === 'yes') {
    // Proceed with action
    return await performAction(action);
  } else {
    // User declined
    return { cancelled: true, reason: response };
  }
}
```

## Message Format

The interaction messages follow this structure:

```typescript
type InteractionMessage = {
  role: 'interaction';
  content: string; // Optional description
  interaction: {
    type: 'select' | 'input' | 'confirm';
    title: string;
    message: string;
    options?: string[]; // For select type
    defaultValue?: string; // For input type
    multiSelect?: boolean; // For select type
    enableAIInterpretation?: boolean; // Enable AI interpretation
    aiContext?: string; // Context for AI interpretation
  };
};
```

## Keyboard Controls

### SelectDialog
- **↑/↓** - Navigate options
- **Space** - Toggle selection (multi-select mode)
- **Enter** - Confirm selection
- **Esc** - Cancel (if onCancel provided)

### InputDialog
- **Type** - Enter text
- **Backspace/Delete** - Remove last character
- **Enter** - Submit input
- **Esc** - Cancel (if onCancel provided)

### ConfirmDialog
- **↑/↓ or ←/→** - Navigate Yes/No
- **y/Y** - Quick yes
- **n/N** - Quick no
- **c/C** - Custom response (if AI interpretation enabled)
- **Enter** - Confirm selection
- **Esc** - Cancel (if onCancel provided)

## AI Interpretation Flow

When AI interpretation is enabled:

1. **User enters response** - Can be yes/no or free-form text
2. **Confirmation dialog** - Shows what will be sent to AI
3. **AI processes response** - Extracts intent and context
4. **Agent receives structured response** - Continue based on interpretation

**Example Flow:**
```
User types: "yes but add error handling first"
         ↓
AI interprets: {
  approval: true,
  conditions: ["add error handling first"],
  priority: "high"
}
         ↓
Agent receives: Conditional approval with prerequisite
         ↓
Agent adjusts plan: Add error handling, then proceed
```

## Best Practices

1. **Use appropriate dialog type:**
   - Select for fixed options
   - Input for free-form responses
   - Confirm for yes/no decisions

2. **Enable AI interpretation when:**
   - Users might want to give conditional approval
   - Natural language responses add value
   - Context matters for decision making

3. **Provide clear context:**
   - Set descriptive `title` and `message`
   - Include `aiContext` when using AI interpretation
   - Use `defaultValue` for sensible defaults

4. **Handle responses gracefully:**
   - Always handle cancellation
   - Validate AI-interpreted responses
   - Provide feedback on user's choice

## See Also

- [User Interaction Skill](../../src/services/agents/skills/builtin/user-interaction/SKILL.md) - Backend skill implementation
- [Approval System](./APPROVAL_SYSTEM.md) - Security and safety controls
- [Agent Skills Documentation](./README.md) - Complete skills system overview
