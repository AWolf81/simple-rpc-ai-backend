# Safety System Test Plan

Comprehensive test plan for the skill approval and safety system.

## Test Environment

### Docker Isolation
- **Purpose**: Test destructive commands safely without risking host system
- **Build**: `docker-compose -f test/agents/skills/safety/docker-compose.safety-test.yml build`
- **Run**: `docker-compose -f test/agents/skills/safety/docker-compose.safety-test.yml up`
- **Cleanup**: `docker-compose -f test/agents/skills/safety/docker-compose.safety-test.yml down -v`

### Test Directory Structure
```
/test-workspace/
  ├── safe-zone/          # Safe for deletion/modification
  │   ├── file1.txt
  │   └── file2.txt
  ├── danger-zone/        # Should trigger warnings
  │   └── important.txt
  ├── protected/          # Should be blocked
  │   └── critical.txt
  └── temp/               # Temporary operations
```

## Test Categories

### 1. Critical Block Patterns (MUST BLOCK)

These commands should **NEVER** execute:

#### 1.1 Root Filesystem Deletion
- [ ] `rm -rf /`
- [ ] `rm -rf /*`
- [ ] `rm --recursive --force /`
- [ ] Expected: Blocked with error message

#### 1.2 System Directory Deletion
- [ ] `rm -rf /bin`
- [ ] `rm -rf /etc`
- [ ] `rm -rf /usr`
- [ ] Expected: Blocked with error message

#### 1.3 Home Directory Destruction
- [ ] `rm -rf ~`
- [ ] `rm -rf ~/`
- [ ] Expected: Blocked with error message

#### 1.4 Dangerous Permissions
- [ ] `chmod 777 /`
- [ ] `chmod -R 777 /etc`
- [ ] Expected: Blocked with error message

#### 1.5 Fork Bombs
- [ ] `:(){:|:&};:`
- [ ] Expected: Blocked with error message

#### 1.6 Disk Wiping
- [ ] `dd if=/dev/zero of=/dev/sda`
- [ ] `dd if=/dev/random of=/`
- [ ] Expected: Blocked with error message

#### 1.7 Process Table Attacks
- [ ] `kill -9 1`
- [ ] `kill -9 -1`
- [ ] `pkill -9 init`
- [ ] Expected: Blocked with error message

### 2. Warning Patterns (MUST REQUIRE APPROVAL)

These commands should prompt for approval:

#### 2.1 Recursive Deletion (Current Directory)
- [ ] `rm -rf *` (in /test-workspace/temp)
- [ ] `rm -rf ./`
- [ ] Expected: Approval prompt, executes if approved

#### 2.2 Hidden File Deletion
- [ ] `rm -rf .*` (in /test-workspace/temp)
- [ ] Expected: Approval prompt

#### 2.3 Recursive Permission Changes
- [ ] `chmod -R 777 /test-workspace/temp`
- [ ] Expected: Approval prompt

#### 2.4 Git Force Operations
- [ ] `git push --force`
- [ ] `git reset --hard`
- [ ] `git clean -fd`
- [ ] Expected: Approval prompt

#### 2.5 Package Management Deletion
- [ ] `rm -rf node_modules`
- [ ] `rm package-lock.json`
- [ ] Expected: Approval prompt

### 3. Permission Allowlist Tests

#### 3.1 Exact Match
```typescript
permissions: {
  allow: ['Bash(ls -la)']
}
```
- [ ] `ls -la` → Allowed
- [ ] `ls -l` → Requires approval (not exact match)

#### 3.2 Wildcard Match
```typescript
permissions: {
  allow: ['Bash(pnpm build:*)']
}
```
- [ ] `pnpm build:cjs` → Allowed
- [ ] `pnpm build:esm` → Allowed
- [ ] `pnpm test` → Requires approval

#### 3.3 Glob Pattern Match
```typescript
permissions: {
  allow: ['Read(/test-workspace/**)']
}
```
- [ ] Read `/test-workspace/safe-zone/file1.txt` → Allowed
- [ ] Read `/test-workspace/danger-zone/important.txt` → Allowed
- [ ] Read `/etc/passwd` → Blocked/Requires approval

#### 3.4 Domain Allowlist
```typescript
permissions: {
  allow: ['WebFetch(domain:github.com)']
}
```
- [ ] `WebFetch https://github.com/user/repo` → Allowed
- [ ] `WebFetch https://example.com` → Requires approval

#### 3.5 Deny List Override
```typescript
permissions: {
  allow: ['Bash(rm:*)'],
  deny: ['Bash(rm -rf /*)']
}
```
- [ ] `rm /test-workspace/temp/file.txt` → Allowed
- [ ] `rm -rf /*` → Blocked (deny overrides allow)

### 4. Network Operation Safety

#### 4.1 GET Requests (Safe, No Approval)
- [ ] `curl -X GET https://api.example.com/data`
- [ ] Expected: Allowed without approval

#### 4.2 POST Requests (Requires Approval)
- [ ] `curl -X POST https://api.example.com/data`
- [ ] Expected: Approval prompt

#### 4.3 PUT/PATCH/DELETE (Requires Approval)
- [ ] `curl -X PUT https://api.example.com/data/1`
- [ ] `curl -X PATCH https://api.example.com/data/1`
- [ ] `curl -X DELETE https://api.example.com/data/1`
- [ ] Expected: Approval prompt for each

#### 4.4 Localhost Exception
- [ ] `curl -X POST http://localhost:3000/api`
- [ ] Expected: Warning but can approve (localhost is safer)

### 5. Skill-Level Safety Configuration

#### 5.1 Skill Requires Approval
```yaml
name: dangerous-skill
requiresApproval: true
```
- [ ] Any script execution → Requires approval

#### 5.2 Custom Block Patterns
```yaml
safetyChecks:
  blockPatterns:
    - "rm.*important\\.txt"
```
- [ ] `rm /test-workspace/danger-zone/important.txt` → Blocked
- [ ] `rm /test-workspace/safe-zone/file1.txt` → Allowed

#### 5.3 Custom Warn Patterns
```yaml
safetyChecks:
  warnPatterns:
    - "mv.*danger-zone"
```
- [ ] `mv file.txt /test-workspace/danger-zone/` → Requires approval

### 6. Script-Level Safety Configuration

#### 6.1 Safety Level: Critical
```yaml
scripts:
  - path: scripts/delete-all.ts
    safety:
      level: critical
      requiresApproval: true
```
- [ ] Execution → Always requires approval

#### 6.2 Dangerous Arguments
```yaml
scripts:
  - path: scripts/cleanup.ts
    safety:
      dangerousArgs: ["--force", "--no-confirm"]
```
- [ ] `cleanup.ts --force` → Requires approval
- [ ] `cleanup.ts` → Allowed

#### 6.3 Max Targets
```yaml
scripts:
  - path: scripts/batch-delete.ts
    safety:
      maxTargets: 5
```
- [ ] Delete 3 files → Allowed
- [ ] Delete 10 files → Requires approval

### 7. Approval Callback Integration

#### 7.1 Auto-Approve (Testing Only)
```typescript
approvalCallback: async () => ({ approved: true })
```
- [ ] Dangerous operation → Auto-approved (for testing)

#### 7.2 Auto-Deny
```typescript
approvalCallback: async () => ({ approved: false })
```
- [ ] Dangerous operation → Denied

#### 7.3 Remember Choice
```typescript
approvalCallback: async (request) => ({
  approved: true,
  rememberChoice: true
})
```
- [ ] First execution → Approval prompt
- [ ] Second execution (same command) → Auto-approved

### 8. Integration Tests

#### 8.1 SkillManager Integration
- [ ] Create SkillManager with permissions
- [ ] Execute allowed script → No approval
- [ ] Execute dangerous script → Approval prompt
- [ ] Execute blocked script → Error thrown

#### 8.2 ApprovalManager Integration
- [ ] Permission allowlist check before safety check
- [ ] Safety validation before approval request
- [ ] Remember choice functionality
- [ ] Clear remembered choices

### 9. Error Handling

#### 9.1 No Approval Callback Configured
- [ ] Dangerous operation without callback → Clear error message

#### 9.2 Blocked Operation
- [ ] Critical pattern → Error with reason

#### 9.3 Denied Operation
- [ ] User denies approval → Error with context

## Test Execution

### Run All Tests
```bash
# In Docker (recommended)
docker-compose -f test/agents/skills/safety/docker-compose.safety-test.yml up

# Locally (⚠️ DANGEROUS - only on test system)
pnpm test test/agents/skills/safety/
```

### Run Specific Test Suites
```bash
# Critical blocks only
pnpm test test/agents/skills/safety/critical-blocks.test.ts

# Permission allowlist
pnpm test test/agents/skills/safety/permission-allowlist.test.ts

# Network operations
pnpm test test/agents/skills/safety/network-operations.test.ts

# Integration
pnpm test test/agents/skills/safety/integration.test.ts
```

## Success Criteria

- ✅ All critical patterns blocked (0% false negatives)
- ✅ All warning patterns trigger approval
- ✅ Permission allowlist matches correctly (exact, wildcard, glob)
- ✅ Network mutations require approval (POST/PUT/PATCH/DELETE)
- ✅ Safe operations allowed without approval (GET requests, safe commands)
- ✅ Skill and script-level safety configs respected
- ✅ Approval callback integration works
- ✅ Clear error messages for blocked/denied operations
- ✅ No false positives (safe operations should not require approval unless configured)

## Reporting

### Test Results Location
- Docker: `/app/test-results/`
- Local: `./test-results/`

### Coverage Requirements
- Overall: >90%
- Safety validator: 100%
- Permission allowlist: 100%
- Approval manager: >95%

### CI/CD Integration
```yaml
# GitHub Actions example
- name: Run Safety Tests
  run: |
    docker-compose -f test/agents/skills/safety/docker-compose.safety-test.yml up --abort-on-container-exit
    docker-compose -f test/agents/skills/safety/docker-compose.safety-test.yml down -v
```

## Notes

- **NEVER** run destructive tests outside Docker on production systems
- Always verify Docker isolation before testing
- Review logs for any unexpected behavior
- Update patterns as new attack vectors are discovered
- Keep approval prompts user-friendly but informative
