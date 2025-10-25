# Approval System - Technical Specification

**Status:** ✅ Implemented
**Version:** 1.0.0
**Last Updated:** 2025-01-25

## Overview

Multi-layer approval and safety system for skill execution that prevents destructive operations while allowing safe automation.

## Architecture

### Three-Layer Defense System

```
┌─────────────────────────────────────────────────────────┐
│                    Skill Execution                       │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│              Layer 1: Safety Validator                   │
│  - Critical block patterns (30+)                         │
│  - Warning patterns                                      │
│  - Network operation rules                               │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼ (if not blocked)
┌─────────────────────────────────────────────────────────┐
│         Layer 2: Permission Allowlist                    │
│  - Deny list (highest priority)                          │
│  - Ask list                                              │
│  - Allow list (lowest priority)                          │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼ (if allowed/ask)
┌─────────────────────────────────────────────────────────┐
│          Layer 3: Approval Manager                       │
│  - User approval callback                                │
│  - Remember choices                                      │
│  - Audit logging                                         │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼ (if approved)
                  Execute Script
```

## Components

### 1. Safety Validator
**File:** `src/services/agents/skills/utils/safety-validator.ts`

**Responsibilities:**
- Validate commands against critical block patterns
- Check warning patterns
- Validate network operations
- Format approval prompts

**Critical Block Patterns:**
- Root filesystem deletion: `rm -rf /`, `rm -rf /*`
- System directory deletion: `/bin`, `/etc`, `/usr`, etc.
- Fork bombs: `:(){:|:&};:`
- Disk wiping: `dd if=/dev/zero of=/dev/sda`
- Process attacks: `kill -9 1`, `kill -9 -1`
- Kernel manipulation: `echo > /proc/sys/kernel/*`
- Command injection: `; rm -rf`, `$(rm -rf)`, `| rm -rf`
- Null byte injection: `\x00`

**Warning Patterns:**
- Recursive deletion: `rm -rf *`, `rm -rf .*`
- Permission changes: `chmod -R 777`
- Git force operations: `git push --force`, `git reset --hard`
- Package management: `rm -rf node_modules`
- Mass operations: `find ... -exec rm`, `xargs rm`

**Network Operation Rules:**
- **Safe (no approval):** GET, HEAD, OPTIONS
- **Requires approval:** POST, PUT, PATCH, DELETE
- **Lower risk:** localhost, private IPs (10.x, 192.168.x, 172.16-31.x)
- **Higher risk:** External servers (extra warning)

### 2. Permission Allowlist
**File:** `src/services/agents/skills/utils/permission-allowlist.ts`

**Pattern Syntax:**
- Exact: `Bash(ls -la)`
- Wildcard: `Bash(pnpm build:*)`
- Glob: `Read(/project/**)`
- Domain: `WebFetch(domain:github.com)`

**Priority Order:**
1. Deny (highest - blocks execution)
2. Ask (medium - requires approval)
3. Allow (lowest - auto-approves)

**Pattern Matching:**
- Uses `minimatch` for glob support
- Case-sensitive by default
- Supports complex patterns

### 3. Approval Manager
**File:** `src/services/agents/skills/utils/approval-manager.ts`

**Features:**
- Coordinates safety validation and permission checks
- Manages approval callbacks
- Remembers user choices (with TTL)
- Formats user-friendly prompts
- Tracks approval history

**Approval Request Flow:**
```typescript
1. Check if blocked by safety validator → throw error
2. Check permission allowlist:
   - deny → return false
   - allow + no safety warnings → return true
   - ask or allow with warnings → proceed to step 3
3. Check remembered choices → return cached decision
4. Call approval callback → return user decision
5. Remember choice if requested
```

## Type System

### Core Types

```typescript
// Safety level enum
type SafetyLevel = 'low' | 'medium' | 'high' | 'critical';

// Script safety configuration
interface ScriptSafetyConfig {
  level: SafetyLevel;
  requiresApproval: boolean;
  blockPatterns?: string[];
  warnPatterns?: string[];
  dangerousArgs?: string[];
  maxTargets?: number;
}

// Skill metadata extensions
interface SkillMetadata {
  requiresApproval?: boolean;
  safetyChecks?: {
    blockPatterns?: string[];
    warnPatterns?: string[];
  };
}

// Script extensions
interface SkillScript {
  safety?: ScriptSafetyConfig;
  requiresApproval?: boolean;
}

// Loader configuration
interface SkillLoaderConfig {
  permissions?: {
    allow: string[];
    deny: string[];
    ask: string[];
  };
  approvalCallback?: (request: ApprovalRequest) => Promise<ApprovalResponse>;
}
```

### Request/Response Types

```typescript
interface ApprovalRequest {
  id: string;
  type: 'skill-execution' | 'network-operation' | 'file-operation';
  scriptName?: string;
  command?: string;
  args?: string[];
  url?: string;
  method?: string;
  safetyValidation?: SafetyValidationResult;
  permissionCheck?: PermissionCheck;
  timestamp: Date;
}

interface ApprovalResponse {
  requestId: string;
  approved: boolean;
  rememberChoice?: boolean;
  timestamp: Date;
}

interface SafetyValidationResult {
  allowed: boolean;
  requiresApproval: boolean;
  blocked: boolean;
  reason?: string;
  warnings: string[];
  safetyLevel: SafetyLevel;
  matchedBlockPattern?: string;
  matchedWarnPattern?: string;
}

interface PermissionCheck {
  result: 'allow' | 'deny' | 'ask';
  matched: boolean;
  matchedPattern?: string;
  reason?: string;
}
```

## Integration Points

### SkillManager Integration

**File:** `src/services/agents/skills/manager.ts`

**Initialization:**
```typescript
constructor(config: SkillLoaderConfig) {
  // Initialize approval system if configured
  if (config.permissions || config.approvalCallback) {
    this.approvalManager = new ApprovalManager(
      config.permissions,
      config.approvalCallback
    );
  }
}
```

**Execution Flow:**
```typescript
async executeScript(skillId, request) {
  // 1. Find script metadata
  const scriptMeta = skill.metadata.scripts?.find(...);

  // 2. Safety validation
  const safetyValidation = SafetyValidator.validate(
    scriptName,
    args,
    scriptMeta.safety,
    skill.metadata.safetyChecks
  );

  // 3. Check if blocked
  if (safetyValidation.blocked) {
    throw new Error(safetyValidation.reason);
  }

  // 4. Request approval if needed
  if (safetyValidation.requiresApproval || skill.metadata.requiresApproval) {
    const approved = await this.approvalManager.requestSkillExecutionApproval(...);
    if (!approved) {
      throw new Error('Script execution denied');
    }
  }

  // 5. Execute script
  return await this.sandbox.execute(...);
}
```

## Testing

### Test Environment

**Docker Isolation:**
- Container: `safety-test-env`
- User: `testuser` (non-root)
- Resources: 512MB RAM, 1 CPU
- Network: Disabled
- Filesystem: Read-only root with specific writable mounts

**Test Workspace:**
```
/test-workspace/
  ├── safe-zone/      # Safe for operations
  ├── danger-zone/    # Should trigger warnings
  ├── protected/      # Should be blocked
  └── temp/           # Temporary operations
```

### Test Suites

**1. Critical Blocks** (`critical-blocks.test.ts`)
- 10+ root filesystem deletion variations
- System directory deletion
- Fork bombs
- Disk wiping
- Process attacks
- Command injection
- ~60 test cases

**2. Permission Allowlist** (`permission-allowlist.test.ts`)
- Exact match
- Wildcard patterns
- Glob patterns
- Domain patterns
- Priority testing
- Dynamic additions
- ~50 test cases

**3. Network Operations** (`network-operations.test.ts`)
- GET/HEAD/OPTIONS (safe)
- POST/PUT/PATCH/DELETE (approval)
- Localhost detection
- Private IP detection
- External server warnings
- ~40 test cases

### Test Execution

```bash
# Docker (recommended)
docker-compose -f test/agents/skills/safety/docker-compose.safety-test.yml up

# Script
./scripts/test-safety-docker.sh

# Direct
pnpm test test/agents/skills/safety/
```

## Performance Considerations

### Pattern Matching
- **Complexity:** O(n) where n = number of patterns
- **Optimization:** Patterns checked in priority order (deny first)
- **Caching:** Minimatch compiles regex patterns once

### Approval Callbacks
- **Async:** Non-blocking, supports async approval flows
- **Timeout:** Should implement timeout in callback (recommended: 30s)
- **Cancellation:** Not yet implemented (future enhancement)

### Remember Choices
- **Storage:** In-memory Map (lost on restart)
- **TTL:** Not implemented (future enhancement)
- **Memory:** O(k) where k = number of remembered choices

## Security Considerations

### Defense in Depth
- Multiple layers prevent single point of failure
- Deny list overrides allow list (safe by default)
- No way to bypass critical blocks

### Attack Vectors Protected
- Command injection via parameters
- Path traversal via script names
- Null byte injection
- Fork bombs
- Disk destruction
- Process attacks

### Known Limitations
- Regex-based detection (can be evaded with obfuscation)
- No runtime monitoring (execution happens in sandbox)
- Remember choices stored in memory (lost on restart)

## Future Enhancements

### Planned
- [ ] Persistent storage for remembered choices
- [ ] TTL for remembered choices
- [ ] Approval timeout configuration
- [ ] Audit logging to database
- [ ] Risk scoring system
- [ ] Machine learning for pattern detection
- [ ] Rollback support for dangerous operations

### Under Consideration
- [ ] Approval policy engine (time-based, role-based)
- [ ] Session recording
- [ ] Compliance reports
- [ ] Workflow approval (multi-user)
- [ ] Approval templates

## Files

### Source Files
- `src/services/agents/skills/utils/permission-allowlist.ts` (176 lines)
- `src/services/agents/skills/utils/safety-validator.ts` (349 lines)
- `src/services/agents/skills/utils/approval-manager.ts` (247 lines)
- `src/services/agents/skills/types.ts` (extended)
- `src/services/agents/skills/manager.ts` (integrated)

### Test Files
- `test/agents/skills/safety/critical-blocks.test.ts` (293 lines)
- `test/agents/skills/safety/permission-allowlist.test.ts` (383 lines)
- `test/agents/skills/safety/network-operations.test.ts` (321 lines)
- `test/agents/skills/safety/Dockerfile.safety-test` (60 lines)
- `test/agents/skills/safety/docker-compose.safety-test.yml` (40 lines)

### Documentation
- `docs/agents/APPROVAL_SYSTEM.md` (user guide)
- `specs/test_plan/safety_approval_system.md` (test plan)
- `specs/features/APPROVAL_SYSTEM.md` (this file)

### Scripts
- `scripts/test-safety-docker.sh` (73 lines)

## Metrics

- **Total Lines:** ~3,000 (code + tests + docs)
- **Test Coverage:** Target >95%
- **Critical Patterns:** 30+
- **Warning Patterns:** 15+
- **Test Cases:** 150+

## References

- [User Documentation](../../docs/agents/APPROVAL_SYSTEM.md)
- [Test Plan](../test_plan/safety_approval_system.md)
- [Skills System](../../docs/agents/README.md)
