---
name: user-interaction
description: Interactive dialogs for user input, approval, and multiple choice scenarios
version: 1.0.0
author: simple-rpc-ai-backend
license: MIT
capabilities:
  - user-interaction
  - approval-dialogs
  - multiple-choice
  - confirmation
scripts:
  - path: scripts/approval-dialog.ts
    runtime: typescript
    description: Show approval dialog with customizable options
    args:
      - name: title
        description: Dialog title
        type: string
        required: true
      - name: message
        description: Question or message to display
        type: string
        required: true
      - name: options
        description: JSON array of options (e.g., ["Yes", "No", "Cancel"])
        type: string
        required: false
        default: '["Yes", "No"]'
      - name: allow-custom
        flag: --allow-custom
        description: Allow user to provide custom response
        type: boolean
        default: false

  - path: scripts/confirm.ts
    runtime: typescript
    description: Simple yes/no confirmation dialog
    args:
      - name: message
        description: Confirmation message
        type: string
        required: true
      - name: default
        flag: --default
        description: Default choice (yes/no)
        type: string
        enum: [yes, no]
        default: no

  - path: scripts/input.ts
    runtime: typescript
    description: Prompt user for text input
    args:
      - name: prompt
        description: Input prompt message
        type: string
        required: true
      - name: default
        flag: --default
        description: Default value
        type: string
        required: false
      - name: multiline
        flag: --multiline
        description: Allow multiline input
        type: boolean
        default: false

  - path: scripts/select.ts
    runtime: typescript
    description: Show a selection menu with multiple options
    args:
      - name: prompt
        description: Selection prompt
        type: string
        required: true
      - name: choices
        description: JSON array of choices
        type: string
        required: true
      - name: multi
        flag: --multi
        description: Allow multiple selections
        type: boolean
        default: false
---

# User Interaction Skill

Provides interactive dialogs for user input, approvals, and multiple choice scenarios in simple-agent.

## Communication Style After User Interaction

**IMPORTANT**: When responding after receiving user confirmation or input:

- ✅ **Be direct and concise** - Skip formal pleasantries
- ❌ **Avoid**: "Thank you", "Please", "as discussed", "based on your approval"
- ✅ **Start with a brief action statement** of what you're doing now
- ❌ **Don't say**: "Thank you for confirming. As discussed, I will now proceed to delete the file."
- ✅ **Instead say**: "Deleting /tmp/cache now."

## Confirmation Loop Prevention

**CRITICAL**: Once the user has approved an operation, **DO NOT** ask for confirmation again.

- ✅ **Ask once**: Use user-interaction tools to get approval before destructive operations
- ❌ **Never repeat**: If you see messages like "User approved", "Permission granted", or "[SYSTEM]: User has ALREADY APPROVED" in the conversation, the user has ALREADY confirmed
- ✅ **Execute immediately**: When you see approval confirmation in the conversation, proceed directly with the requested action
- ❌ **Don't re-confirm**: Do NOT call user_interaction_confirm or user_interaction_approval_dialog again after receiving approval

**Example - Correct Flow**:
1. User: "delete /tmp/file.txt"
2. Agent: *calls user_interaction_confirm* → Shows dialog
3. User: "yes"
4. Agent: "Deleting /tmp/file.txt now." *calls file_handling_delete* ✅

**Example - Incorrect Flow (NEVER DO THIS)**:
1. User: "delete /tmp/file.txt"
2. Agent: *calls user_interaction_confirm* → Shows dialog
3. User: "yes"
4. Agent: *calls user_interaction_confirm AGAIN* → Shows dialog ❌ WRONG!

## Purpose

This skill enables agents to interact with users through various dialog types:
- **Approval Dialogs**: Get user approval with predefined options
- **Confirmations**: Simple yes/no questions
- **Text Input**: Collect free-form text from users
- **Selections**: Multiple choice menus

## Scripts

### approval-dialog.ts

Flexible approval dialog with customizable options. Perfect for permission requests, operation confirmations, and decision points.

**Example Usage:**
```typescript
// Basic approval (Yes/No)
await executeScript('user-interaction', {
  scriptName: 'scripts/approval-dialog.ts',
  args: [
    'Permission Required',
    'Allow this operation to modify files?'
  ]
});

// Custom options
await executeScript('user-interaction', {
  scriptName: 'scripts/approval-dialog.ts',
  args: [
    'Approval Required',
    'Execute rm -rf /tmp/cache?',
    '["Yes", "Yes (always ask)", "No", "Other"]',
    '--allow-custom'
  ]
});
```

**Options Format:**
- Standard: `["Yes", "No"]`
- Approval system: `["Yes", "Yes (always ask)", "No", "Other"]`
- Custom: Any array of strings

**Return Format:**
```json
{
  "approved": true,
  "choice": "Yes",
  "customReason": "Not needed - using alternative approach",
  "rememberChoice": false
}
```

### confirm.ts

Simple yes/no confirmation dialog.

**Example:**
```typescript
await executeScript('user-interaction', {
  scriptName: 'scripts/confirm.ts',
  args: ['Continue with deployment?', '--default', 'no']
});
```

**Return:**
```json
{
  "confirmed": true,
  "answer": "yes"
}
```

### input.ts

Prompt user for text input.

**Example:**
```typescript
// Single line
await executeScript('user-interaction', {
  scriptName: 'scripts/input.ts',
  args: ['Enter commit message:']
});

// Multiline
await executeScript('user-interaction', {
  scriptName: 'scripts/input.ts',
  args: ['Enter description:', '--multiline']
});
```

**Return:**
```json
{
  "value": "User entered text",
  "provided": true
}
```

### select.ts

Multiple choice selection menu.

**Example:**
```typescript
// Single selection
await executeScript('user-interaction', {
  scriptName: 'scripts/select.ts',
  args: [
    'Choose deployment environment:',
    '["Development", "Staging", "Production"]'
  ]
});

// Multiple selections
await executeScript('user-interaction', {
  scriptName: 'scripts/select.ts',
  args: [
    'Select features to enable:',
    '["Analytics", "Logging", "Monitoring", "Alerts"]',
    '--multi'
  ]
});
```

**Return:**
```json
{
  "selected": ["Production"],
  "indices": [2]
}
```

## Integration with Approval System

This skill integrates seamlessly with the approval system:

```typescript
import { ApprovalManager } from './utils/approval-manager';
import { SkillManager } from './skills/manager';

const approvalCallback = async (request) => {
  // Use approval-dialog skill
  const result = await skillManager.executeScript('user-interaction', {
    scriptName: 'scripts/approval-dialog.ts',
    args: [
      '⚠️  Approval Required',
      `Command: ${request.command}\nWarnings: ${request.safetyValidation?.warnings.join('\n')}`,
      '["Yes", "Yes (always ask)", "No", "Other"]',
      '--allow-custom'
    ]
  });

  return {
    approved: result.stdout.approved,
    rememberChoice: result.stdout.choice === 'Yes (always ask)' ? false : result.stdout.approved
  };
};
```

## UI Patterns

### Approval Dialog Pattern
```
╔═══════════════════════════════════════════════════════╗
║              ⚠️  Permission Required                  ║
╚═══════════════════════════════════════════════════════╝

Command: rm -rf /tmp/cache
Warnings:
  ⚠️  Recursive deletion in current directory

Options:
  1. Yes
  2. Yes (always ask)
  3. No
  4. Other (provide reason)

Your choice [1-4]:
```

### Confirmation Pattern
```
? Continue with deployment? (y/N)
```

### Input Pattern
```
> Enter commit message:
_
```

### Selection Pattern
```
? Choose deployment environment:
  ○ Development
  ○ Staging
  ● Production
```

## Best Practices

1. **Clear Messages**: Make prompts clear and actionable
2. **Sensible Defaults**: Provide safe defaults (e.g., "No" for destructive operations)
3. **Validation**: Validate user input appropriately
4. **Timeouts**: Implement timeouts for automated scenarios
5. **Accessibility**: Support both interactive and non-interactive modes

## Non-Interactive Mode

For CI/CD or automated scenarios, set environment variables:

```bash
# Auto-approve all
export USER_INTERACTION_MODE=auto-approve

# Auto-deny all
export USER_INTERACTION_MODE=auto-deny

# Use defaults
export USER_INTERACTION_MODE=default
```

Scripts check these variables and respond accordingly without blocking.

## Examples

### Safety Approval
```typescript
const result = await callTool('approval_dialog', {
  title: 'Safety Check',
  message: 'Execute: rm -rf node_modules',
  options: '["Yes", "Yes (always ask)", "No", "Other"]',
  'allow-custom': true
});

if (!result.approved) {
  console.log('Operation cancelled:', result.customReason);
}
```

### Git Operations
```typescript
const confirmed = await callTool('confirm', {
  message: 'Push to remote repository?',
  default: 'no'
});

if (confirmed.confirmed) {
  // Execute git push
}
```

### Configuration Choice
```typescript
const env = await callTool('select', {
  prompt: 'Select environment:',
  choices: '["dev", "staging", "prod"]'
});

console.log('Deploying to:', env.selected[0]);
```
