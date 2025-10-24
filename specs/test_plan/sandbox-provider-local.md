# Local Sandbox Provider - Manual Test Plan

## Overview
The Local Sandbox Provider executes scripts on the same machine as the server, using native process isolation with path, timeout, and memory restrictions.

**Provider:** `LocalSandboxProvider` (default)
**Session Type:** Persistent (process-per-execution)
**Prerequisites:** Python 3, Node.js 22+, Bash

---

## Test 1: Basic Python Execution

**Objective:** Verify Python script execution with output capture

**Steps:**
1. Create test script: `/tmp/test-python.py`
```python
print("Hello from Python")
print(2 + 2)
```

2. Execute via tRPC:
```typescript
await trpc.agents.skills.executeScript.mutate({
  skillId: 'script-caller',
  scriptName: '/tmp/test-python.py', // Or use custom script
  args: []
});
```

**Expected Results:**
- ✅ exitCode: 0
- ✅ stdout contains: "Hello from Python\n4"
- ✅ stderr: empty
- ✅ duration < 5000ms

---

## Test 1a: Script Caller – Path Execution

**Objective:** Verify the `script-caller` skill can execute an existing Python script via `scriptInvocation`.

**Steps:**
1. Ensure `/tmp/test-python.py` from Test 1 exists.
2. Execute via tRPC:
```typescript
await trpc.agents.skills.executeScript.mutation({
  skillId: 'script-caller',
  // scriptInvocation is required for script-caller
  scriptInvocation: {
    mode: 'path',
    scriptPath: '/tmp/test-python.py',
    runtime: 'python'
  }
});
```

**Expected Results:**
- ✅ exitCode: 0
- ✅ stdout contains: "Hello from Python\n4"
- ✅ stderr: empty
- ✅ `scriptName` omitted and resolved automatically

---

## Test 1b: Script Caller – Inline Execution

**Objective:** Verify inline snippets are executed when provided as `scriptInvocation`.

**Steps:**
1. Execute inline via tRPC:
```typescript
await trpc.agents.skills.executeScript.mutation({
  skillId: 'script-caller',
  scriptInvocation: {
    mode: 'inline',
    runtime: 'python',
    source: 'print("inline hello")\nprint(2 + 2)'
  }
});
```

**Expected Results:**
- ✅ exitCode: 0
- ✅ stdout contains: "inline hello\n4"
- ✅ stderr: empty
- ✅ Temporary script cleaned up (no files left under /tmp/script-caller-*)

---

## Test 2: Path Traversal Protection

**Objective:** Verify sandbox blocks access outside allowedPaths

**Steps:**
1. Create script attempting to read `/etc/passwd`:
```python
with open('/etc/passwd', 'r') as f:
    print(f.read())
```

2. Execute script

**Expected Results:**
- ✅ Error thrown: "Script path is not within allowed paths"
- ✅ Script never executes
- ✅ No file access occurs

---

## Test 3: Timeout Enforcement

**Objective:** Verify scripts are killed after timeout

**Steps:**
1. Create infinite loop script:
```python
import time
while True:
    time.sleep(1)
```

2. Execute with 5-second timeout:
```typescript
sandbox: { timeout: 5000 }
```

**Expected Results:**
- ✅ Script killed after ~5 seconds
- ✅ timedOut: true
- ✅ error: "Script timed out after 5000ms"
- ✅ Process terminated with SIGTERM/SIGKILL

---

## Test 4: Memory Limit Enforcement

**Objective:** Verify memory-intensive scripts are killed

**Steps:**
1. Create memory hog script:
```python
data = []
while True:
    data.append(' ' * 1024 * 1024)  # Allocate 1MB per iteration
```

2. Execute with 100MB limit:
```typescript
sandbox: { maxMemory: 100 * 1024 * 1024 }
```

**Expected Results:**
- ✅ Script killed when exceeding 100MB
- ✅ memoryExceeded: true
- ✅ error contains: "exceeded memory limit"

---

## Test 5: Network Isolation

**Objective:** Verify network access is blocked when disabled

**Steps:**
1. Create network access script:
```python
import urllib.request
try:
    urllib.request.urlopen('https://google.com')
    print("SUCCESS")
except Exception as e:
    print(f"BLOCKED: {e}")
```

2. Execute with `networkAccess: false`

**Expected Results:**
- ✅ Network request fails
- ✅ Output contains "BLOCKED" or connection error
- ✅ No external connections made

---

## Test 6: TypeScript Execution

**Objective:** Verify TypeScript runtime with tsx

**Steps:**
1. Create TypeScript script:
```typescript
interface Greeting {
  message: string;
}
const greet: Greeting = { message: 'Hello TypeScript' };
console.log(greet.message);
```

2. Execute with `runtime: 'typescript'`

**Expected Results:**
- ✅ exitCode: 0
- ✅ stdout: "Hello TypeScript"
- ✅ TypeScript compiled and executed

---

## Test 7: Script Arguments Passing

**Objective:** Verify command-line arguments are passed correctly

**Steps:**
1. Create argument script:
```python
import sys
print(f"Args: {sys.argv[1:]}")
print(f"Count: {len(sys.argv) - 1}")
```

2. Execute with args:
```typescript
args: ['arg1', 'arg2', 'test value']
```

**Expected Results:**
- ✅ stdout contains: "Args: ['arg1', 'arg2', 'test value']"
- ✅ stdout contains: "Count: 3"

---

## Test 8: Working Directory Control

**Objective:** Verify cwd parameter sets working directory

**Steps:**
1. Create directory: `/workspace/project`
2. Create script:
```python
import os
print(os.getcwd())
```

3. Execute with `cwd: '/workspace/project'`

**Expected Results:**
- ✅ stdout contains: "/workspace/project"
- ✅ cwd validated against allowedPaths

---

## Test 9: STDIN Input

**Objective:** Verify stdin data is passed to script

**Steps:**
1. Create input script:
```python
import sys
data = sys.stdin.read()
print(f"Received: {data}")
```

2. Execute with `stdin: 'test input data'`

**Expected Results:**
- ✅ stdout contains: "Received: test input data"

---

## Test 10: Shell Script Execution

**Objective:** Verify bash script execution

**Steps:**
1. Create shell script:
```bash
#!/bin/bash
echo "Shell test"
ls -la /workspace
```

2. Execute with `runtime: 'shell'`

**Expected Results:**
- ✅ exitCode: 0
- ✅ stdout contains: "Shell test"
- ✅ File listing from /workspace shown

---

## Test 11: Output Size Limits

**Objective:** Verify output is truncated at 1MB

**Steps:**
1. Create large output script:
```python
for i in range(100000):
    print('X' * 1000)
```

2. Execute script

**Expected Results:**
- ✅ Output truncated at 1MB
- ✅ Message: "[Output truncated...]"
- ✅ Script killed after truncation

---

## Test 12: Environment Variable Isolation

**Objective:** Verify environment variables are controlled

**Steps:**
1. Create env script:
```python
import os
print(f"PATH: {os.environ.get('PATH', 'NONE')}")
print(f"CUSTOM: {os.environ.get('CUSTOM_VAR', 'NONE')}")
```

2. Execute with custom env:
```typescript
sandbox: {
  environmentVars: { CUSTOM_VAR: 'test123' }
}
```

**Expected Results:**
- ✅ PATH present (from default)
- ✅ CUSTOM_VAR: "test123"
- ✅ No other sensitive environment variables

---

## Test 13: Network Allowlist Enforcement

**Objective:** Verify host-level allowlists when network access is explicitly enabled

**Steps:**
1. Execute script that requests `https://api.github.com/` with sandbox overrides:
```typescript
sandbox: {
  networkAccess: true,
  allowedNetworkHosts: ['example.com']
}
```
2. Execute the same script with `allowedNetworkHosts: ['api.github.com']`

**Expected Results:**
- ✅ First run fails with `Network access ... denied by sandbox policy`
- ✅ Second run succeeds and returns HTTP response
- ✅ `securityWarnings` remains empty when allowlist satisfied

---

## Test 14: Filesystem Read/Write Restrictions

**Objective:** Ensure explicit read/write allowlists are respected

**Steps:**
1. Configure sandbox:
```typescript
sandbox: {
  allowedPaths: ['/workspace'],
  allowedReadPaths: ['/workspace/config'],
  allowedWritePaths: ['/workspace/tmp']
}
```
2. Attempt to `open('/workspace/secret.txt')` for reading
3. Attempt to `open('/workspace/config/settings.json', 'w')`
4. Attempt to `open('/workspace/tmp/output.log', 'w')`

**Expected Results:**
- ✅ Reads restricted to `/workspace/config`
- ✅ Writes outside `/workspace/tmp` rejected with PermissionError
- ✅ `/workspace/tmp/output.log` accept writes
- ✅ Node runtimes fail fast before file handles are created

---

## Test 15: macOS Violation Monitoring

**Objective:** Capture sandbox violations from the macOS system log

**Steps:**
1. Run the local provider on macOS with `monitorViolations: true`
2. Execute a script that attempts to read `/etc/passwd`

**Expected Results:**
- ✅ Execution fails with sandbox violation
- ✅ `violationLogs` contains entries from `com.apple.security.sandbox`
- ✅ `stderr` includes appended "Sandbox violations detected" section

---

## Performance Benchmarks

| Test | Expected Duration | Max Memory |
|------|------------------|------------|
| Simple Python print | < 500ms | < 50MB |
| TypeScript compilation | < 2000ms | < 200MB |
| File I/O operations | < 1000ms | < 100MB |
| Shell command chain | < 1000ms | < 50MB |

---

## Security Checklist

- [ ] Path traversal attempts blocked
- [ ] Memory limits enforced
- [ ] Timeout limits enforced
- [ ] Network access blocked when disabled
- [ ] Output size limited
- [ ] Environment sanitized
- [ ] Python site packages isolated
- [ ] No sudo/root access

---

## Known Limitations

1. **Platform:** Linux/macOS only (uses `ps` for memory monitoring)
2. **Memory Monitoring:** 1-second polling interval (may exceed limit briefly)
3. **Network Blocking:** Node/TypeScript use permission flags; shell runtime still environment-based
4. **Process Isolation:** User-level only (no container or VM boundary)
