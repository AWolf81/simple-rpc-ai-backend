# Skill Approval System - Usage Guide

Guide for configuring and using the approval system in your simple-rpc-ai-backend or simple-agent applications.

## Quick Start

### Enable Approval System

```typescript
import { createRpcAiServer } from 'simple-rpc-ai-backend';

const server = createRpcAiServer({
  agents: {
    enabled: true,
    skills: {
      sources: [
        { type: 'builtin', name: 'file-handling' },
        { type: 'builtin', name: 'git-commit-helper' }
      ],

      // Configure permissions (optional)
      permissions: {
        allow: [
          'Bash(pnpm build:*)',
          'Bash(pnpm test:*)',
          'Read(/home/user/project/**)'
        ],
        deny: [
          'Bash(rm -rf /)'
        ],
        ask: [
          'Bash(git push:*)'
        ]
      },

      // Configure approval callback (optional)
      approvalCallback: async (request) => {
        // Your approval logic here
        console.log('Approval required for:', request.command);

        return {
          approved: true,  // or false to deny
          rememberChoice: false  // Remember this decision
        };
      }
    }
  }
});
```

## Permission Patterns

### Pattern Syntax

**Exact Match:**
```typescript
'Bash(ls -la)'  // Only "ls -la" exactly
```

**Wildcard (`*`):**
```typescript
'Bash(pnpm build:*)'     // pnpm build:cjs, pnpm build:esm, etc.
'Bash(npm run *)'         // npm run test, npm run build, etc.
```

**Glob (`**`):**
```typescript
'Read(/project/**)'       // Any file under /project
'Write(/output/**)'       // Any file under /output
```

**Domain-based:**
```typescript
'WebFetch(domain:github.com)'          // GitHub only
'WebFetch(domain:*.npmjs.org)'         // Any npmjs subdomain
```

### Permission Lists

**Allow List** (auto-approve):
```typescript
permissions: {
  allow: [
    'Bash(pnpm build:*)',
    'Bash(pnpm test:*)',
    'Read(/project/**)'
  ]
}
```

**Deny List** (block execution):
```typescript
permissions: {
  deny: [
    'Bash(rm -rf /)',
    'Bash(chmod 777 /)'
  ]
}
```

**Ask List** (require approval):
```typescript
permissions: {
  ask: [
    'Bash(git push:*)',
    'Bash(pnpm add:*)'
  ]
}
```

### Priority

Patterns are checked in priority order:
1. **Deny** (highest) - Blocks execution
2. **Ask** - Requires approval
3. **Allow** (lowest) - Auto-approves

```typescript
permissions: {
  allow: ['Bash(rm:*)'],        // Allow rm commands
  deny: ['Bash(rm -rf /*)'],    // But block dangerous ones
  ask: ['Bash(rm -rf *)']       // And ask for recursive deletes
}
```

## Approval Callbacks

### Basic Callback

```typescript
approvalCallback: async (request) => {
  return {
    approved: true,
    rememberChoice: false
  };
}
```

### Request Object

```typescript
interface ApprovalRequest {
  id: string;
  type: 'skill-execution' | 'network-operation' | 'file-operation';
  scriptName?: string;      // e.g., "delete-file.ts"
  command?: string;          // e.g., "rm -rf temp"
  args?: string[];           // e.g., ["-rf", "temp"]
  url?: string;              // For network operations
  method?: string;           // For network operations
  safetyValidation?: {
    warnings: string[];
    safetyLevel: 'low' | 'medium' | 'high' | 'critical';
  };
  timestamp: Date;
}
```

### Advanced Callback Examples

**Console Approval:**
```typescript
import readline from 'readline';

approvalCallback: async (request) => {
  console.log('\n⚠️  APPROVAL REQUIRED');
  console.log('Command:', request.command);
  console.log('Warnings:', request.safetyValidation?.warnings);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const answer = await new Promise<string>(resolve => {
    rl.question('Approve? (yes/no): ', resolve);
  });

  rl.close();

  return {
    approved: answer.toLowerCase() === 'yes',
    rememberChoice: false
  };
}
```

**Slack Notification:**
```typescript
import { WebClient } from '@slack/web-api';

const slack = new WebClient(process.env.SLACK_TOKEN);

approvalCallback: async (request) => {
  // Send approval request to Slack
  await slack.chat.postMessage({
    channel: '#approvals',
    text: `Approval needed: ${request.command}`,
    blocks: [
      {
        type: 'section',
        text: { type: 'mrkdwn', text: `*Command:* \`${request.command}\`` }
      },
      {
        type: 'actions',
        elements: [
          { type: 'button', text: { type: 'plain_text', text: 'Approve' }, value: 'approve' },
          { type: 'button', text: { type: 'plain_text', text: 'Deny' }, value: 'deny' }
        ]
      }
    ]
  });

  // Wait for response (implement your own logic)
  const approved = await waitForSlackResponse(request.id);

  return { approved, rememberChoice: false };
}
```

**Remember Choices:**
```typescript
approvalCallback: async (request) => {
  // Auto-approve safe operations and remember
  if (request.safetyValidation?.safetyLevel === 'low') {
    return {
      approved: true,
      rememberChoice: true  // Don't ask again for this exact command
    };
  }

  // For dangerous operations, always ask
  const approved = await askUser(request);
  return {
    approved,
    rememberChoice: false  // Always ask for dangerous operations
  };
}
```

## Skill-Level Safety

Configure safety in your skill's `SKILL.md`:

### Require Approval for All Scripts

```yaml
---
name: dangerous-ops
requiresApproval: true
---
```

### Custom Block Patterns

```yaml
---
name: file-ops
safetyChecks:
  blockPatterns:
    - "rm.*important\\.txt"
    - "chmod.*critical"
  warnPatterns:
    - "mv.*production"
---
```

### Script-Level Safety

```yaml
---
name: file-ops
scripts:
  - path: scripts/delete-all.ts
    runtime: typescript
    safety:
      level: critical
      requiresApproval: true
      dangerousArgs: ["--force", "--no-confirm"]
      maxTargets: 10
---
```

### Safety Levels

| Level | Behavior |
|-------|----------|
| `low` | No approval required |
| `medium` | Approval if warning patterns match |
| `high` | Always requires approval |
| `critical` | Always requires approval + extra warnings |

## Network Operations

### Default Behavior

- **GET, HEAD, OPTIONS:** Allowed without approval
- **POST, PUT, PATCH, DELETE:** Requires approval

### Example Usage

```typescript
// Safe - no approval needed
await fetch('https://api.github.com/repos/user/repo', {
  method: 'GET'
});

// Requires approval
await fetch('https://api.github.com/repos/user/repo/issues', {
  method: 'POST',
  body: JSON.stringify({ title: 'New issue' })
});
```

### Override Network Safety

```typescript
// Disable approval for mutations (not recommended)
const server = createRpcAiServer({
  agents: {
    skills: {
      // ... other config
      networkSafety: {
        requireApprovalForMutations: false
      }
    }
  }
});
```

## Built-in Safety Features

The system automatically blocks dangerous commands:

### Blocked Operations (Cannot Execute)
- `rm -rf /` - Root filesystem deletion
- `rm -rf /bin|etc|usr|...` - System directories
- `chmod 777 /` - Dangerous permissions
- `:(){:|:&};:` - Fork bombs
- `kill -9 1` - Kill init process
- `dd if=/dev/zero of=/dev/sda` - Disk wipe

### Operations Requiring Approval
- `rm -rf *` - Recursive deletion
- `git push --force` - Force push
- `chmod -R 777` - Recursive permissions
- `rm -rf node_modules` - Delete dependencies

See full list in [Technical Spec](../../specs/features/APPROVAL_SYSTEM.md).

## Simple Agent Integration

### Configuration File

Create `.simple-agent/config.json`:

```json
{
  "skills": {
    "permissions": {
      "allow": [
        "Bash(pnpm build:*)",
        "Read(/home/user/project/**)"
      ],
      "deny": [
        "Bash(rm -rf /)"
      ],
      "ask": [
        "Bash(git push:*)"
      ]
    }
  }
}
```

### Programmatic Configuration

```typescript
import { SimpleAgent } from 'simple-agent';

const agent = new SimpleAgent({
  skills: {
    permissions: {
      allow: ['Bash(pnpm test:*)'],
      deny: [],
      ask: ['Bash(git push:*)']
    },
    approvalCallback: async (request) => {
      // Your approval logic
      return { approved: true };
    }
  }
});
```

## Testing

### Run Safety Tests

```bash
# In Docker (recommended for destructive tests)
./scripts/test-safety-docker.sh

# Or manually
docker-compose -f test/agents/skills/safety/docker-compose.safety-test.yml up
```

### Test Your Configuration

```typescript
import { PermissionAllowlist } from 'simple-rpc-ai-backend/skills';

const allowlist = new PermissionAllowlist({
  allow: ['Bash(pnpm build:*)'],
  deny: ['Bash(rm -rf /)'],
  ask: []
});

// Test pattern
const result = allowlist.check('Bash(pnpm build:esm)');
console.log(result.result);  // 'allow', 'deny', or 'ask'
console.log(result.matchedPattern);  // 'Bash(pnpm build:*)'
```

## Troubleshooting

### Command Blocked Unexpectedly

Check if it matches a block pattern:
```bash
# Enable debug logging
LOG_LEVEL=debug pnpm start
```

Look for messages like:
```
🚫 Script execution blocked: rm
Reason: Blocked: Command matches forbidden pattern: "rm -rf /test"
```

### Permission Not Matching

Verify your pattern syntax:
```typescript
// ❌ Wrong
'Bash(pnpm build*)'  // Missing colon

// ✅ Correct
'Bash(pnpm build:*)'
```

### Approval Not Requested

Ensure callback is configured:
```typescript
if (!server.config.agents?.skills?.approvalCallback) {
  console.error('No approval callback configured!');
}
```

## Best Practices

### 1. Start with Empty Allow List

```typescript
permissions: {
  allow: [],  // Start empty
  deny: [/* critical patterns only */],
  ask: []  // Everything else requires approval
}
```

Add patterns as you identify safe operations.

### 2. Use Deny for Critical Safety

```typescript
permissions: {
  deny: [
    'Bash(rm -rf /)',
    'Bash(rm -rf /*)',
    'Bash(chmod 777 /)'
  ]
}
```

### 3. Remember Choices Wisely

Only remember for truly safe, repetitive operations:

```typescript
approvalCallback: async (request) => {
  const isSafe = request.safetyValidation?.safetyLevel === 'low';

  return {
    approved: true,
    rememberChoice: isSafe  // Only for safe operations
  };
}
```

### 4. Log All Approvals

```typescript
approvalCallback: async (request) => {
  // Log to file/database
  await logApprovalRequest(request);

  const approved = await getApproval(request);

  // Log decision
  await logApprovalDecision(request.id, approved);

  return { approved, rememberChoice: false };
}
```

### 5. Timeout Approvals

```typescript
approvalCallback: async (request) => {
  const timeout = 30000; // 30 seconds

  const approved = await Promise.race([
    getApproval(request),
    new Promise<boolean>(resolve =>
      setTimeout(() => resolve(false), timeout)
    )
  ]);

  return { approved, rememberChoice: false };
}
```

## Examples

### Development Environment

```typescript
const server = createRpcAiServer({
  agents: {
    skills: {
      permissions: {
        allow: [
          'Bash(pnpm *)',
          'Bash(npm *)',
          'Bash(git add *)',
          'Bash(git commit *)',
          'Read(/home/user/project/**)',
          'Write(/home/user/project/**)'
        ],
        deny: [
          'Bash(rm -rf /)',
          'Bash(chmod 777 /)'
        ],
        ask: [
          'Bash(git push *)',
          'Bash(rm -rf *)'
        ]
      },
      approvalCallback: async (request) => {
        // Auto-approve in development
        console.log('Auto-approving:', request.command);
        return { approved: true, rememberChoice: true };
      }
    }
  }
});
```

### Production Environment

```typescript
const server = createRpcAiServer({
  agents: {
    skills: {
      permissions: {
        allow: [
          'Read(/var/www/app/**)'
        ],
        deny: [
          'Bash(rm *)',
          'Bash(chmod *)',
          'Write(/etc/**)'
        ],
        ask: [
          'Bash(git pull)',
          'Bash(systemctl restart app)'
        ]
      },
      approvalCallback: async (request) => {
        // Send to approval queue
        const ticket = await createApprovalTicket(request);

        // Wait for manual approval
        const approved = await waitForApproval(ticket.id, 300000); // 5 min timeout

        return { approved, rememberChoice: false };
      }
    }
  }
});
```

## See Also

- [Technical Specification](../../specs/features/APPROVAL_SYSTEM.md)
- [Safety Test Plan](../../specs/test_plan/safety_approval_system.md)
- [Skills System Guide](./README.md)
