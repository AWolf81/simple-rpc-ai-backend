# Enhanced Approval Dialog System

## Overview

Improved user-interaction approval system with four response options, persistent settings, and AI interpretation for custom responses.

## New Features

### 1. Enhanced Approval Options

Users now have four choices when approving operations:

1. **Allow** - Approve this one time only
2. **Allow (don't ask again)** - Approve and save as persistent setting
3. **Deny** - Reject this operation
4. **Custom response** - Enter free-form text for AI interpretation

### 2. Persistent Settings Manager

**Location**: `~/.simple-agent/settings.json`

**Features**:
- Stores approval permissions permanently
- Survives server restarts
- Optional expiration timestamps
- Skill + script + arguments matching

**API**:
```typescript
import { getSettingsManager } from 'simple-agent/utils/settings-manager';

const settings = getSettingsManager();

// Add persistent approval
settings.addApprovalPermission(
  'file-handling',
  'scripts/delete.ts',
  ['/tmp/test.txt'],
  true  // approved
);

// Check if approved
const isApproved = settings.hasApprovalPermission(
  'file-handling',
  'scripts/delete.ts',
  ['/tmp/test.txt']
);

// Clear all permissions
settings.clearAllPermissions();
```

### 3. Custom Response with AI Interpretation

When selecting "Custom response", users can type free-form text like:
- "Yes, but add error handling first"
- "No, use a different file path"
- "Don't do it because it's the wrong directory"

The AI interprets the response and adjusts its behavior accordingly.

### 4. Enhanced UI

**SelectDialog** now supports:
- Custom text input mode (activated when selecting "Custom response")
- Yellow-bordered custom response UI
- Real-time text input with backspace support
- ESC to go back to selection mode

## Usage Examples

### Basic Approval with Persistence

```typescript
// Server setup with enhanced options
const server = createRpcAiServer({
  agents: {
    skills: {
      approvalCallback: createInteractiveApprovalCallback({
        approvalOptions: [
          'Allow',
          'Allow (don\'t ask again)',
          'Deny',
          'Custom response'
        ],
        allowCustomReason: true
      })
    }
  }
});
```

### User Experience

**Scenario 1: First-time approval with "don't ask again"**
```
User: delete /tmp/test.txt
[Approval Dialog appears]
Options:
  1. Allow
▶ 2. Allow (don't ask again)
  3. Deny
  4. Custom response

User: [Presses Enter on option 2]
Agent: File deleted successfully

[Next time - no dialog, automatically approved]
```

**Scenario 2: Custom response**
```
User: delete /important/file.txt
[Approval Dialog appears]
User: [Selects "Custom response"]

🤖 Custom Response
Enter your custom response (AI will interpret):
> Don't delete it, move it to /backup instead_

Agent: I understand. Instead of deleting, I'll move the file to /backup.
[Executes file move instead]
```

## Configuration

### Approval Options

Default options can be customized:

```typescript
approvalOptions: [
  'Allow',
  'Allow (don't ask again)',
  'Deny',
  'Custom response'
]
```

### Settings File Structure

`~/.simple-agent/settings.json`:
```json
{
  "version": "1.0.0",
  "approvalPermissions": [
    {
      "skillName": "file-handling",
      "scriptPath": "scripts/delete.ts",
      "args": ["/tmp/test.txt"],
      "approved": true,
      "timestamp": 1730000000000,
      "expiresAt": 1730086400000  // Optional
    }
  ],
  "preferences": {
    "autoApproveReadOperations": false,
    "confirmDestructiveActions": true
  }
}
```

## Technical Implementation

### Files Modified

1. **settings-manager.ts** (NEW)
   - Persistent storage for approval permissions
   - JSON-based settings file at `~/.simple-agent/settings.json`
   - Expiration support

2. **interactive-approval-callback.ts**
   - Updated default options to 4 choices
   - Added `customResponse` field to response
   - Enhanced response parsing logic

3. **approval-manager.ts**
   - Added `customResponse?: string` to `ApprovalResponse` interface

4. **UserInteractionDialog.tsx**
   - Added custom mode to SelectDialog
   - Custom text input UI with yellow border
   - ESC to go back, Enter to submit

5. **server.ts**
   - Updated approval options configuration
   - Enabled `allowCustomReason: true`

### Response Flow

```
User selects option → SelectDialog
  ├─ "Allow" → { choice: "Allow" }
  ├─ "Allow (don't ask again)" → { choice: "Allow (don't ask again)", rememberChoice: true }
  ├─ "Deny" → { choice: "Deny" }
  └─ "Custom response" → Enters custom mode
       └─ User types text → { choice: "Custom response", customResponse: "..." }

Response → interactive-approval-callback.ts
  ├─ Parses JSON
  ├─ Checks for "don't ask again"
  └─ Returns ApprovalResponse with customResponse

ApprovalResponse → approval-manager.ts
  └─ If rememberChoice: true → Stores in settings.json

If customResponse exists → Agent receives it for interpretation
```

## Benefits

✅ **User Convenience**: "Don't ask again" saves time for repeated operations
✅ **Flexibility**: Custom responses allow nuanced user input
✅ **Persistence**: Settings survive server restarts
✅ **AI-Powered**: AI interprets natural language responses
✅ **Backwards Compatible**: Works with existing approval system
✅ **User Control**: Settings can be manually edited or cleared

## Future Enhancements

- Settings management UI commands (`/permissions list`, `/permissions clear`)
- Per-skill approval policies
- Time-based expiration (approve for 1 hour, 1 day, etc.)
- Pattern-based approvals (approve all `/tmp/*` deletes)
- Export/import settings for team sharing

## Testing

```bash
# Create test file
echo "test" > /tmp/test_approval.md

# Start agent
pnpm --filter simple-agent dev

# Test scenarios:
# 1. Select "Allow" - should ask again next time
# 2. Select "Allow (don't ask again)" - should NOT ask next time
# 3. Select "Deny" - should deny operation
# 4. Select "Custom response" - type: "yes but check if backup exists first"
```

## Related Documentation

- [Approval System Usage Guide](../agents/APPROVAL_SYSTEM.md)
- [User Interaction UI](../agents/USER_INTERACTION_UI.md)
- [Agent Skills Documentation](../agents/README.md)
