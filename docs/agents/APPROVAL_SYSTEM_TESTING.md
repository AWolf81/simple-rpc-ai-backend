# Testing the Approval System - Safe Examples

Quick guide for testing the approval system with safe prompts that won't damage your system.

## Quick Test Prompts for simple-agent

### 1. Safe File Deletion (Recommended)

This is the safest test - creates and deletes a temporary file:

```bash
# Start simple-agent with approval system
simple-agent chat

# Then ask:
You: "Create a file /tmp/test-approval.txt with content 'test', then delete it using rm command"
```

**What happens:**
1. Agent creates `/tmp/test-approval.txt` (no approval needed - safe operation)
2. Agent tries to run `rm /tmp/test-approval.txt` (triggers approval because of `rm` command)
3. You see the approval dialog with options

**Why it's safe:**
- Only touches `/tmp` directory (temporary files)
- File is created by the agent itself
- No risk to system or important files

---

### 2. Recursive Delete in /tmp

Test warning patterns with a safe recursive delete:

```bash
You: "Create a directory /tmp/test-dir with a subdirectory and some files, then delete it recursively"
```

**What happens:**
- Agent creates `/tmp/test-dir/subdir/file.txt`
- Agent tries `rm -rf /tmp/test-dir`
- **Triggers warning:** "Recursive deletion" with safety level warnings

**Why it's safe:**
- Only affects `/tmp/test-dir` (temporary)
- You control what's in the directory (created by agent)

---

### 3. Permission Change Test

Test permission warnings:

```bash
You: "Create /tmp/test-perms.txt and change its permissions to 777"
```

**What happens:**
- Creates `/tmp/test-perms.txt`
- Tries `chmod 777 /tmp/test-perms.txt`
- **Triggers warning:** "Permission change" (if configured)

**Why it's safe:**
- Only affects one temporary file
- 777 permissions on a temp file are harmless

---

### 4. Git Operation Test

Test git-related approvals (if you're in a git repo):

```bash
You: "Show me the git status, then stage the README.md file"
```

**What happens:**
- `git status` runs (safe, read-only)
- `git add README.md` may trigger approval (if configured)

**Why it's safe:**
- Read-only operations don't need approval
- `git add` is easily reversible with `git reset`

---

### 5. Multiple Choice Test

Test the approval dialog options:

```bash
You: "List files in /tmp, then try to delete all .txt files in /tmp"
```

**What happens:**
- Lists files (safe)
- Tries `rm /tmp/*.txt` or similar
- Shows approval dialog with all 4 options:
  - Yes
  - Yes (always ask)
  - No
  - Other (custom reason)

**Try each option:**
1. Select "No" first to test denial
2. Re-run and select "Yes" to approve
3. Re-run and select "Other" to provide custom reason

---

## Test Configuration

### Minimal Test Setup

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

      // Simplified approval callback (no skillManager needed!)
      approvalCallback: createInteractiveApprovalCallback()
    }
  }
});
```

### Custom Options Test

```typescript
approvalCallback: createInteractiveApprovalCallback({
  approvalOptions: ['Yes', 'Yes (always ask)', 'No', 'Cancel'],
  allowCustomReason: true,
  timeout: 30000 // 30 seconds
})
```

---

## Expected Dialog Output

When approval is triggered, you should see:

```
╔═══════════════════════════════════════════════════════════╗
║              ⚠️  Approval Required                        ║
╚═══════════════════════════════════════════════════════════╝

Script: scripts/delete-file.ts
Arguments: /tmp/test-approval.txt
Command: rm /tmp/test-approval.txt
Safety Level: MEDIUM

Warnings:
  ⚠️  File deletion operation

─────────────────────────────────────────────────────────────

Options:
  1. Yes
  2. Yes (always ask)
  3. No
  4. Other (provide custom reason)

─────────────────────────────────────────────────────────────

Your choice [1-4]: _
```

---

## Testing Different Scenarios

### Test 1: Approval and Execute
```
Your choice [1-4]: 1
✓ Response recorded
{ "approved": true, "choice": "Yes", "rememberChoice": true }

Agent: File deleted successfully.
```

### Test 2: Deny with Reason
```
Your choice [1-4]: 4
Please provide a reason: Not ready to delete yet
✓ Response recorded
{ "approved": false, "choice": "Other", "customReason": "Not ready to delete yet" }

Agent: Operation cancelled.
```

### Test 3: Always Ask
```
Your choice [1-4]: 2
✓ Response recorded
{ "approved": true, "choice": "Yes (always ask)", "rememberChoice": false }

Agent: File deleted successfully. (Will ask again next time)
```

---

## Advanced: Testing Blocked Operations

To see the safety validator in action (blocks without asking):

```bash
# DON'T actually run this - just to show the concept
You: "Delete the root directory"

# Agent will say something like:
Agent: I cannot execute that command. It matches a forbidden safety pattern:
       🚫 BLOCKED: Attempting to delete root filesystem
       Command: rm -rf /
```

**Safe alternative to test blocking:**
```bash
You: "What would happen if I tried to run 'rm -rf /' command?"

# Agent should explain it's blocked without trying to execute
```

---

## Debugging Tips

### Check if Approval System is Active

```bash
You: "Check if the approval system is configured"
```

Agent should have access to the configuration and can tell you.

### Check Available Skills

```bash
You: "List all available skills"
```

Should include `user-interaction` skill if approval dialogs are working.

### Test Non-Interactive Mode

Set environment variable before starting:

```bash
export USER_INTERACTION_MODE=auto-deny
simple-agent chat
```

Then try a delete command - should auto-deny without prompting.

---

## Recommended Test Sequence

1. **Start simple:** Create and delete a single file in `/tmp`
2. **Test denial:** Run same command, select "No"
3. **Test custom reason:** Run again, select "Other", provide reason
4. **Test remember:** Run again, select "Yes", verify it remembers
5. **Test recursive:** Create directory structure, delete recursively
6. **Clean up:** Manually verify `/tmp` is clean

---

## Safety Checklist

Before testing with real files:

- [ ] Only test in `/tmp` directory
- [ ] Create test files/directories yourself first
- [ ] Never point at system directories (`/etc`, `/usr`, `/bin`, etc.)
- [ ] Never test with your home directory (`~`)
- [ ] Have a backup if testing in a real project
- [ ] Start with read-only operations first

---

## Example Test Script

Save this as `test-approval.sh`:

```bash
#!/bin/bash

echo "Setting up test environment..."

# Create test files
mkdir -p /tmp/approval-test
echo "test 1" > /tmp/approval-test/file1.txt
echo "test 2" > /tmp/approval-test/file2.txt
mkdir -p /tmp/approval-test/subdir
echo "test 3" > /tmp/approval-test/subdir/file3.txt

echo "Test files created in /tmp/approval-test"
echo "You can now test the approval system!"
echo ""
echo "Try: 'Delete all files in /tmp/approval-test'"
echo ""

# When done, clean up:
# rm -rf /tmp/approval-test
```

Then:
```bash
chmod +x test-approval.sh
./test-approval.sh
simple-agent chat
```

---

## See Also

- [Approval System Guide](./APPROVAL_SYSTEM.md)
- [User Interaction Examples](../../examples/user-interaction-examples.md)
- [Safety Validator Patterns](../../specs/features/APPROVAL_SYSTEM.md#critical-block-patterns)
