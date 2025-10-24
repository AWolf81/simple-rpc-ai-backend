# Daytona Sandbox Provider - Manual Test Plan

## Overview
The Daytona Sandbox Provider executes scripts in secure development environments with session management and Git integration.

**Provider:** `DaytonaSandboxProvider`
**Session Type:** Persistent (reusable sessions)
**Prerequisites:** `@daytonaio/sdk` package, Daytona API key

---

## Setup

### Installation
```bash
pnpm add @daytonaio/sdk
```

### Authentication
```bash
export DAYTONA_API_KEY=your_api_key_here
```

### Configuration
```typescript
import { DaytonaSandboxProvider } from 'simple-rpc-ai-backend/providers';

const provider = new DaytonaSandboxProvider({
  apiKey: process.env.DAYTONA_API_KEY,
  defaultLanguage: 'node',
  defaultTimeout: 30000,
  reuseSession: true // Reuse sandboxes for efficiency
});
```

---

## Test 1: Python Sandbox Creation

**Objective:** Verify Python environment initialization

**Steps:**
1. Configure with `language: 'python'`
2. Execute Python script:
```python
print("Hello from Daytona")
import sys
print(f"Python: {sys.version}")
```

**Expected Results:**
- ✅ exitCode: 0
- ✅ stdout contains: "Hello from Daytona"
- ✅ Python environment ready

---

## Test 2: TypeScript Sandbox

**Objective:** Verify TypeScript environment with tsx

**Steps:**
1. Configure with `language: 'typescript'`
2. Execute TypeScript:
```typescript
const message: string = "TypeScript works";
console.log(message);
```

**Expected Results:**
- ✅ TypeScript compiles
- ✅ Output: "TypeScript works"
- ✅ tsx runtime available

---

## Test 3: Session Reuse

**Objective:** Verify session persistence between executions

**Steps:**
1. Enable `reuseSession: true`
2. First execution: Create file
```python
with open('/workspace/state.txt', 'w') as f:
    f.write('persistent')
```

3. Second execution: Read file
```python
with open('/workspace/state.txt', 'r') as f:
    print(f.read())
```

**Expected Results:**
- ✅ First execution creates file
- ✅ Second execution reads: "persistent"
- ✅ Same sandbox reused
- ✅ State preserved

---

## Test 4: Fresh Sessions

**Objective:** Verify clean state with `reuseSession: false`

**Steps:**
1. Configure `reuseSession: false`
2. First execution: Create file
3. Second execution: Check file exists

**Expected Results:**
- ✅ First execution succeeds
- ✅ Second execution: file not found
- ✅ New sandbox created each time

---

## Test 5: File Upload

**Objective:** Verify local file upload to sandbox

**Steps:**
1. Create local script with dependencies
2. Upload via `fs.uploadFile()`
3. Execute uploaded script

**Expected Results:**
- ✅ File uploaded successfully
- ✅ Script executes from `/workspace/`
- ✅ File accessible in sandbox

---

## Test 6: File System Operations

**Objective:** Verify file I/O capabilities

**Steps:**
1. Upload file
2. Read file via `fs.readFile()`
3. List files via `fs.listFiles()`
4. Delete file via `fs.deleteFile()`

**Expected Results:**
- ✅ All operations succeed
- ✅ File content matches upload
- ✅ Listing shows all files
- ✅ Deletion removes file

---

## Test 7: Working Directory

**Objective:** Verify cwd parameter in session

**Steps:**
1. Create session with `cwd: '/workspace/project'`
2. Execute script:
```python
import os
print(os.getcwd())
```

**Expected Results:**
- ✅ cwd: "/workspace/project"
- ✅ Session respects working directory

---

## Test 8: Environment Variables

**Objective:** Verify custom environment in session

**Steps:**
1. Create session with env:
```typescript
env: {
  API_KEY: 'test123',
  DEBUG: 'true'
}
```

2. Execute script reading env

**Expected Results:**
- ✅ API_KEY: "test123"
- ✅ DEBUG: "true"
- ✅ Environment isolated per session

---

## Test 9: Code Run (Direct Execution)

**Objective:** Verify `codeRun()` for quick execution

**Steps:**
1. Use `sandbox.process.codeRun()` directly:
```typescript
const result = await sandbox.process.codeRun(
  'console.log("Quick test")',
  { timeout: 5000 }
);
```

**Expected Results:**
- ✅ result: "Quick test\n"
- ✅ No script upload needed
- ✅ Fast execution

---

## Test 10: Session Command Execution

**Objective:** Verify interactive session commands

**Steps:**
1. Create session
2. Execute multiple commands:
   - `cd /workspace`
   - `echo "test" > file.txt`
   - `cat file.txt`

**Expected Results:**
- ✅ All commands execute in same session
- ✅ State preserved between commands
- ✅ Output captured correctly

---

## Test 11: Timeout Handling

**Objective:** Verify timeout enforcement

**Steps:**
1. Execute long-running script:
```python
import time
time.sleep(60)
```

2. Set timeout: 5000ms

**Expected Results:**
- ✅ Script killed after 5 seconds
- ✅ Timeout error returned
- ✅ Session remains usable

---

## Test 12: Error Recovery

**Objective:** Verify sandbox survives script errors

**Steps:**
1. Execute failing script:
```python
raise Exception("Test error")
```

2. Execute successful script:
```python
print("Recovery test")
```

**Expected Results:**
- ✅ First execution: error captured
- ✅ Second execution: succeeds
- ✅ Sandbox not corrupted

---

## Test 13: Language Server Protocol

**Objective:** Verify LSP integration (if applicable)

**Steps:**
1. Create TypeScript file
2. Query LSP for completions/diagnostics
3. Verify IntelliSense works

**Expected Results:**
- ✅ LSP server available
- ✅ Code intelligence working
- ✅ Type checking functional

---

## Test 14: Git Integration

**Objective:** Verify Git repository operations

**Steps:**
1. Clone repository (if SDK supports)
2. List files
3. Execute script from repo

**Expected Results:**
- ✅ Repository cloned
- ✅ Files accessible
- ✅ Scripts executable

---

## Test 15: Concurrent Sessions

**Objective:** Verify multiple independent sessions

**Steps:**
1. Create 3 sessions with different languages
2. Execute scripts in parallel
3. Verify isolation

**Expected Results:**
- ✅ All sessions run simultaneously
- ✅ No interference
- ✅ Each session independent

---

## Performance Benchmarks

| Test | Expected Duration | Notes |
|------|------------------|-------|
| Sandbox creation | 5-10s | Initial setup |
| Code run (direct) | < 1s | No upload needed |
| Script upload + run | 2-5s | File transfer overhead |
| Session command | < 1s | Persistent session |
| Sandbox deletion | 1-3s | Cleanup |

---

## Session Management Best Practices

**When to reuse sessions:**
- Multiple executions for same user
- Related tasks needing shared state
- Cost optimization
- Performance improvement

**When to create fresh sessions:**
- Different users
- Unrelated tasks
- Security isolation required
- Clean state needed

---

## Security Checklist

- [ ] API key authentication required
- [ ] Sessions isolated per user
- [ ] File system access controlled
- [ ] Environment variables isolated
- [ ] Timeout enforced
- [ ] Error handling robust
- [ ] Session cleanup on shutdown

---

## Known Limitations

1. **Platform:** Requires Daytona account and API key
2. **Network:** Requires internet connectivity
3. **Cost:** Metered usage based on sandbox time
4. **State:** Persistent sessions use more resources
5. **Language:** Limited to supported runtimes (Python, Node, TypeScript)
6. **LSP:** Advanced features may require additional setup
