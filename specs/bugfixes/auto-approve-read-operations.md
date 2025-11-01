# Bug Fix: Respect `autoApproveReadOperations` Setting

**Date**: 2025-10-31
**Issue**: The `autoApproveReadOperations: false` setting was being ignored - read operations were always auto-approved

## Problem

Users could set `autoApproveReadOperations: false` in their preferences, but read operations (like `file_handling_read`, `file_handling_grep`, `file_handling_search_files`) were still executed without asking for approval.

**User's settings**:
```json
{
  "version": "1.0.0",
  "approvalPermissions": [],
  "preferences": {
    "autoApproveReadOperations": false,  // ❌ Being ignored
    "confirmDestructiveActions": true
  },
  "permissions": {}
}
```

**Expected behavior**: Show approval dialog for all read operations
**Actual behavior**: Read operations executed without prompting

## Root Cause

Two issues prevented the setting from working:

### Issue 1: Approval Manager Never Called for Read Operations

In [manager.ts:257](../../src/services/agents/skills/manager.ts#L257), the approval manager was only called if:
```typescript
if (safetyValidation.requiresApproval || skill.metadata.requiresApproval) {
  // Call approval manager
}
```

Since `read.ts`, `grep.ts`, and `search-files.ts` don't have `requiresApproval: true` in their SKILL.md, the approval manager was never consulted.

### Issue 2: Policy Decision Didn't Check Preferences

In [approval-manager.ts:477](../../src/services/agents/skills/utils/approval-manager.ts#L477), the `evaluatePolicyDecision` method checked file system permissions but never consulted the `autoApproveReadOperations` preference:

```typescript
private evaluatePolicyDecision(scriptName: string, args: string[]): 'allow' | 'deny' | 'prompt' {
  const action = this.getFileOperationAction(scriptName);
  // ...
  const decision = this.settingsManager.evaluateFileSystemPermission(action, targetPath);
  // ❌ Never checked: preferences.autoApproveReadOperations
}
```

## Solution

### 1. Always Call Approval Manager (with Circular Dependency Fix)

**File**: `src/services/agents/skills/manager.ts`

**Before**:
```typescript
if (safetyValidation.requiresApproval || skill.metadata.requiresApproval) {
  if (this.approvalManager) {
    // Request approval
  }
}
```

**After**:
```typescript
// Always check with approval manager - it will handle policies, preferences, and remembered choices
// UNLESS skipApproval is explicitly set (for internal/system calls like user-interaction dialogs)
if (this.approvalManager && !request.skipApproval) {
  // Request approval (manager decides if prompt is needed)
}
```

**Rationale**: The approval manager is smart enough to handle all the logic:
- Remembered choices (approved/denied)
- Permission allowlist/denylist
- Policy decisions (including preferences)
- Safety validations

By always calling it, we let it make the decision rather than pre-filtering at the manager level.

**Circular Dependency Prevention**: The `skipApproval` flag prevents infinite loops when the approval callback itself needs to execute scripts (e.g., `user-interaction` dialogs).

### 2. Check `autoApproveReadOperations` in Policy Decision

**File**: `src/services/agents/skills/utils/approval-manager.ts`

**Before**:
```typescript
private evaluatePolicyDecision(scriptName: string, args: string[]): 'allow' | 'deny' | 'prompt' {
  const action = this.getFileOperationAction(scriptName);
  // ...
  const decision = this.settingsManager.evaluateFileSystemPermission(action, targetPath);
  return decision === 'allow' ? 'allow' : 'prompt';
}
```

**After**:
```typescript
private evaluatePolicyDecision(scriptName: string, args: string[]): 'allow' | 'deny' | 'prompt' {
  const action = this.getFileOperationAction(scriptName);
  // ...

  // Check autoApproveReadOperations preference
  const preferences = this.settingsManager.getPreferences();
  if (action === 'read' && preferences.autoApproveReadOperations === false) {
    logger.info(`🔒 Read operation requires approval (autoApproveReadOperations: false): ${scriptName}`);
    return 'prompt';
  }

  const decision = this.settingsManager.evaluateFileSystemPermission(action, targetPath);
  return decision === 'allow' ? 'allow' : 'prompt';
}
```

**Rationale**: Before checking file system permissions, we first check if the user has explicitly disabled auto-approval for read operations. If they have, we return `'prompt'` to force an approval dialog.

## Expected Behavior After Fix

### With `autoApproveReadOperations: true` (default)

```
User: read /home/user/project/README.md
System: ✅ Executes immediately (no prompt)
```

### With `autoApproveReadOperations: false`

```
User: read /home/user/project/README.md
System: Shows approval dialog with:
  - Script: scripts/read.ts
  - Args: /home/user/project/README.md
  - Options: Approve, Deny, Remember
```

### Read Operations Affected

The following file-handling scripts are now controlled by `autoApproveReadOperations`:
- ✅ `scripts/read.ts` - File reading
- ✅ `scripts/grep.ts` - Pattern searching
- ✅ `scripts/search-files.ts` - File finding
- ✅ `scripts/validate-path.ts` - Path validation

## Testing

To verify the fix:

1. **Test default behavior (auto-approve)**:
   ```bash
   # Start simple-agent (uses default settings)
   simple-agent

   # Request file read
   > read README.md
   ```

   **Expected**: File read executes immediately (no prompt)

2. **Test with approval required**:
   Set preference in `~/.simple-agent/settings.json`:
   ```json
   {
     "preferences": {
       "autoApproveReadOperations": false
     }
   }
   ```

   Restart simple-agent and request file read:
   ```bash
   > read README.md
   ```

   **Expected**: Approval dialog appears before reading

### 3. Prevent Circular Dependency in Approval Callbacks

**Files**:
- `src/services/agents/skills/types.ts` - Added `skipApproval` field
- `src/services/agents/skills/utils/interactive-approval-callback.ts` - Set `skipApproval: true`

**Problem**: The approval callback uses `user-interaction` skill to show dialogs. With our fix to always check approval, this created a circular dependency:
1. `file_handling_read` → approval manager
2. Approval manager → approval callback
3. Approval callback → `user_interaction_approval_dialog`
4. `user_interaction_approval_dialog` → approval manager (infinite loop!)

**Solution**: Added `skipApproval: true` when the approval callback calls `user-interaction` scripts:

```typescript
const executePromise = skillManager.executeScript('user-interaction', {
  scriptName: 'scripts/approval-dialog.ts',
  args: [...],
  skipApproval: true  // Prevent circular approval loop
});
```

## Files Changed

- [src/services/agents/skills/manager.ts](../../src/services/agents/skills/manager.ts) (line 258) - Check `skipApproval` flag
- [src/services/agents/skills/utils/approval-manager.ts](../../src/services/agents/skills/utils/approval-manager.ts) (line 491-496) - Check preference
- [src/services/agents/skills/types.ts](../../src/services/agents/skills/types.ts) (line 231) - Added `skipApproval` field
- [src/services/agents/skills/utils/interactive-approval-callback.ts](../../src/services/agents/skills/utils/interactive-approval-callback.ts) (line 124) - Set `skipApproval: true`
- [src/utils/settings-manager.ts](../../src/utils/settings-manager.ts) (line 49) - Changed default to `true`

## Benefits

✅ **User control restored** - Users can now require approval for all read operations
✅ **Privacy protection** - Prevents accidental reading of sensitive files
✅ **Consistent behavior** - Preference applies uniformly to all read operations
✅ **Granular control** - Works alongside file system permissions for fine-grained access control

## Related Documentation

- [Approval System Usage Guide](../../docs/agents/APPROVAL_SYSTEM.md)
- [User Interaction UI](../../docs/agents/USER_INTERACTION_UI.md)
- [Agent Skills System](../../docs/agents/README.md)
