# User Interaction Skill - Examples

Complete examples for using the user-interaction skill in various scenarios.

## Table of Contents

1. [Basic Approval Dialogs](#basic-approval-dialogs)
2. [Safety System Integration](#safety-system-integration)
3. [Multiple Choice Scenarios](#multiple-choice-scenarios)
4. [Custom Workflows](#custom-workflows)
5. [Non-Interactive Mode](#non-interactive-mode)

## Basic Approval Dialogs

### Simple Yes/No Confirmation

```typescript
import { SkillManager } from 'simple-rpc-ai-backend';

const skillManager = new SkillManager(config);
await skillManager.initialize();

// Simple confirmation
const result = await skillManager.executeScript('user-interaction', {
  scriptName: 'scripts/confirm.ts',
  args: ['Continue with deployment?', '--default', 'no']
});

const response = JSON.parse(result.stdout);
console.log('User confirmed:', response.confirmed);
// Output: { confirmed: true, answer: "yes" }
```

### Approval with Multiple Options

```typescript
const result = await skillManager.executeScript('user-interaction', {
  scriptName: 'scripts/approval-dialog.ts',
  args: [
    'Deployment Approval',
    'Deploy to production environment?',
    '["Yes", "Yes (always ask)", "No", "Other"]',
    '--allow-custom'
  ]
});

const response = JSON.parse(result.stdout);
console.log('Approved:', response.approved);
console.log('Choice:', response.choice);
console.log('Remember:', response.rememberChoice);

// Example responses:
// 1. User selects "Yes": { approved: true, choice: "Yes", rememberChoice: true }
// 2. User selects "Yes (always ask)": { approved: true, choice: "Yes (always ask)", rememberChoice: false }
// 3. User selects "No": { approved: false, choice: "No", rememberChoice: false }
// 4. User selects "Other" and types reason: { approved: false, choice: "Other", customReason: "Not ready yet", rememberChoice: false }
```

## Safety System Integration

### Basic Integration

```typescript
import { createRpcAiServer } from 'simple-rpc-ai-backend';
import { createInteractiveApprovalCallback } from 'simple-rpc-ai-backend/skills';

const server = createRpcAiServer({
  agents: {
    enabled: true,
    skills: {
      sources: [
        { type: 'builtin', name: 'file-handling' },
        { type: 'builtin', name: 'user-interaction' }
      ],

      // Configure approval system with interactive dialogs
      // skillManager is automatically injected - no need to pass it!
      approvalCallback: createInteractiveApprovalCallback({
        approvalOptions: ['Yes', 'Yes (always ask)', 'No', 'Other'],
        allowCustomReason: true,
        timeout: 60000 // 1 minute timeout
      })
    }
  }
});
```

**Note:** The `skillManager` is automatically injected by the server during initialization - you don't need to pass it manually!

### Custom Approval Logic

```typescript
import { ApprovalManager } from 'simple-rpc-ai-backend/skills/utils';

const approvalCallback = async (request) => {
  // Different options based on safety level
  let options;
  if (request.safetyValidation?.safetyLevel === 'critical') {
    options = ['No', 'Yes (provide reason)']; // Deny by default for critical
  } else if (request.safetyValidation?.safetyLevel === 'high') {
    options = ['Yes (one time)', 'No', 'Other'];
  } else {
    options = ['Yes', 'Yes (always allow)', 'No'];
  }

  const result = await skillManager.executeScript('user-interaction', {
    scriptName: 'scripts/approval-dialog.ts',
    args: [
      `⚠️  ${request.safetyValidation?.safetyLevel.toUpperCase()} Risk Operation`,
      `Command: ${request.command}\n\nWarnings:\n${request.safetyValidation?.warnings.join('\n')}`,
      JSON.stringify(options),
      '--allow-custom'
    ]
  });

  const response = JSON.parse(result.stdout);

  return {
    approved: response.approved,
    rememberChoice: response.choice.includes('always'),
    requestId: request.id,
    timestamp: new Date()
  };
};
```

### Logging Approval Decisions

```typescript
const approvalCallback = async (request) => {
  const result = await skillManager.executeScript('user-interaction', {
    scriptName: 'scripts/approval-dialog.ts',
    args: [
      'Approval Required',
      `Operation: ${request.command}`,
      '["Yes", "No", "Other"]',
      '--allow-custom'
    ]
  });

  const response = JSON.parse(result.stdout);

  // Log the decision
  console.log('Approval Decision:', {
    requestId: request.id,
    timestamp: new Date().toISOString(),
    command: request.command,
    approved: response.approved,
    choice: response.choice,
    customReason: response.customReason
  });

  // Optional: Save to database
  // await db.approvals.insert({ ... });

  return {
    approved: response.approved,
    rememberChoice: response.rememberChoice,
    requestId: request.id,
    timestamp: new Date()
  };
};
```

## Multiple Choice Scenarios

### Environment Selection

```typescript
const result = await skillManager.executeScript('user-interaction', {
  scriptName: 'scripts/select.ts',
  args: [
    'Select deployment environment:',
    '["Development", "Staging", "Production"]'
  ]
});

const selection = JSON.parse(result.stdout);
console.log('Selected environment:', selection.selected[0]);
// Output: { selected: ["Production"], indices: [2] }

// Use selection
switch (selection.selected[0]) {
  case 'Development':
    deployToDev();
    break;
  case 'Staging':
    deployToStaging();
    break;
  case 'Production':
    deployToProduction();
    break;
}
```

### Feature Configuration

```typescript
// Multi-select
const result = await skillManager.executeScript('user-interaction', {
  scriptName: 'scripts/select.ts',
  args: [
    'Select features to enable:',
    '["Analytics", "Logging", "Monitoring", "Alerts", "Caching"]',
    '--multi'
  ]
});

const features = JSON.parse(result.stdout);
console.log('Enabled features:', features.selected);
// Output: { selected: ["Analytics", "Monitoring", "Alerts"], indices: [0, 2, 3] }

// Enable selected features
features.selected.forEach(feature => {
  enableFeature(feature);
});
```

### Build Configuration

```typescript
const questions = [
  {
    prompt: 'Select build target:',
    choices: '["Development", "Production", "Testing"]'
  },
  {
    prompt: 'Select platforms:',
    choices: '["Web", "iOS", "Android", "Desktop"]',
    multi: true
  },
  {
    prompt: 'Enable optimizations?',
    type: 'confirm',
    message: 'Enable production optimizations?'
  }
];

const buildConfig: any = {};

// Target selection
const targetResult = await skillManager.executeScript('user-interaction', {
  scriptName: 'scripts/select.ts',
  args: [questions[0].prompt, questions[0].choices]
});
buildConfig.target = JSON.parse(targetResult.stdout).selected[0];

// Platform selection
const platformResult = await skillManager.executeScript('user-interaction', {
  scriptName: 'scripts/select.ts',
  args: [questions[1].prompt, questions[1].choices, '--multi']
});
buildConfig.platforms = JSON.parse(platformResult.stdout).selected;

// Optimization confirmation
const optimizeResult = await skillManager.executeScript('user-interaction', {
  scriptName: 'scripts/confirm.ts',
  args: [questions[2].message, '--default', 'yes']
});
buildConfig.optimize = JSON.parse(optimizeResult.stdout).confirmed;

console.log('Build configuration:', buildConfig);
// Output: { target: "Production", platforms: ["Web", "iOS"], optimize: true }
```

## Custom Workflows

### Git Commit Workflow

```typescript
// Get commit message
const messageResult = await skillManager.executeScript('user-interaction', {
  scriptName: 'scripts/input.ts',
  args: ['Enter commit message:', '--multiline']
});

const commitMessage = JSON.parse(messageResult.stdout).value;

// Select commit type
const typeResult = await skillManager.executeScript('user-interaction', {
  scriptName: 'scripts/select.ts',
  args: [
    'Select commit type:',
    '["feat", "fix", "docs", "style", "refactor", "test", "chore"]'
  ]
});

const commitType = JSON.parse(typeResult.stdout).selected[0];

// Confirm commit
const confirmResult = await skillManager.executeScript('user-interaction', {
  scriptName: 'scripts/confirm.ts',
  args: [`Create commit: ${commitType}: ${commitMessage}?`, '--default', 'yes']
});

if (JSON.parse(confirmResult.stdout).confirmed) {
  // Execute git commit
  await executeGitCommit(`${commitType}: ${commitMessage}`);
}
```

### Database Migration Approval

```typescript
const result = await skillManager.executeScript('user-interaction', {
  scriptName: 'scripts/approval-dialog.ts',
  args: [
    'Database Migration',
    'This will migrate the production database.\n\nChanges:\n  - Add users.email_verified column\n  - Drop users.legacy_field\n  - Update 1,234 records\n\nEstimated time: 5 minutes\nDowntime: 30 seconds',
    '["Yes, migrate now", "Yes, but backup first", "No, cancel", "Schedule for later"]',
    '--allow-custom'
  ]
});

const response = JSON.parse(result.stdout);

switch (response.choice) {
  case 'Yes, migrate now':
    await runMigration();
    break;
  case 'Yes, but backup first':
    await createBackup();
    await runMigration();
    break;
  case 'No, cancel':
    console.log('Migration cancelled');
    break;
  case 'Schedule for later':
    const timeResult = await skillManager.executeScript('user-interaction', {
      scriptName: 'scripts/input.ts',
      args: ['Enter scheduled time (YYYY-MM-DD HH:MM):']
    });
    await scheduleMigration(JSON.parse(timeResult.stdout).value);
    break;
}
```

### Code Review Workflow

```typescript
// Review approval
const reviewResult = await skillManager.executeScript('user-interaction', {
  scriptName: 'scripts/approval-dialog.ts',
  args: [
    'Code Review - PR #123',
    'Changes:\n  - 15 files changed\n  - 234 insertions, 89 deletions\n  - All tests passing\n  - No security issues found',
    '["Approve", "Request Changes", "Comment", "Dismiss"]',
    '--allow-custom'
  ]
});

const review = JSON.parse(reviewResult.stdout);

if (review.choice === 'Request Changes' || review.choice === 'Comment') {
  // Get feedback
  const feedbackResult = await skillManager.executeScript('user-interaction', {
    scriptName: 'scripts/input.ts',
    args: ['Enter your feedback:', '--multiline']
  });

  const feedback = JSON.parse(feedbackResult.stdout).value;

  await submitReview({
    action: review.choice.toLowerCase().replace(' ', '_'),
    comment: feedback
  });
} else if (review.choice === 'Approve') {
  await approveReview();
}
```

## Non-Interactive Mode

For CI/CD pipelines and automated scenarios:

### Environment Variables

```bash
# Auto-approve all prompts
export USER_INTERACTION_MODE=auto-approve

# Auto-deny all prompts
export USER_INTERACTION_MODE=auto-deny

# Use default values
export USER_INTERACTION_MODE=default
```

### Usage in Scripts

```bash
#!/bin/bash

# CI/CD environment - auto-approve
export USER_INTERACTION_MODE=auto-approve

# Run deployment script
node deploy.js

# Script will automatically approve all dialogs
```

### Conditional Interactive Mode

```typescript
const isCI = process.env.CI === 'true';

const approvalCallback = async (request) => {
  if (isCI) {
    // Auto-deny in CI unless explicitly allowed
    return {
      approved: false,
      requestId: request.id,
      timestamp: new Date()
    };
  }

  // Interactive mode in development
  const result = await skillManager.executeScript('user-interaction', {
    scriptName: 'scripts/approval-dialog.ts',
    args: [
      'Approval Required',
      `Operation: ${request.command}`,
      '["Yes", "No"]'
    ]
  });

  return {
    approved: JSON.parse(result.stdout).approved,
    requestId: request.id,
    timestamp: new Date()
  };
};
```

## Testing

### Unit Testing Approval Flows

```typescript
import { describe, it, expect, beforeEach } from 'vitest';

describe('Approval Dialog Integration', () => {
  beforeEach(() => {
    process.env.USER_INTERACTION_MODE = 'auto-approve';
  });

  it('should auto-approve in test mode', async () => {
    const result = await skillManager.executeScript('user-interaction', {
      scriptName: 'scripts/approval-dialog.ts',
      args: ['Test', 'Approve this?', '["Yes", "No"]']
    });

    const response = JSON.parse(result.stdout);
    expect(response.approved).toBe(true);
    expect(response.choice).toBe('auto-approved');
  });

  it('should handle confirmation', async () => {
    const result = await skillManager.executeScript('user-interaction', {
      scriptName: 'scripts/confirm.ts',
      args: ['Confirm this?']
    });

    const response = JSON.parse(result.stdout);
    expect(response.confirmed).toBe(true); // auto-approve mode
  });
});
```

## See Also

- [User Interaction Skill Documentation](../src/services/agents/skills/builtin/user-interaction/SKILL.md)
- [Approval System Guide](../docs/agents/APPROVAL_SYSTEM.md)
- [Safety Validator](../src/services/agents/skills/utils/safety-validator.ts)
