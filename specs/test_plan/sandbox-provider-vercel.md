# Vercel Sandbox Provider - Manual Test Plan

## Overview
The Vercel Sandbox Provider executes scripts in ephemeral serverless containers on Vercel's infrastructure.

**Provider:** `VercelSandboxProvider`
**Session Type:** Ephemeral (new container per execution)
**Prerequisites:** `@vercel/sandbox` package, Vercel authentication

---

## Setup

### Installation
```bash
pnpm add @vercel/sandbox
```

### Authentication
```bash
vercel link
vercel env pull
```

### Configuration
```typescript
import { VercelSandboxProvider } from 'simple-rpc-ai-backend/providers';

const provider = new VercelSandboxProvider({
  teamId: process.env.VERCEL_TEAM_ID,
  projectId: process.env.VERCEL_PROJECT_ID,
  token: process.env.VERCEL_TOKEN,
  runtime: 'node22', // or 'python3.13'
  vcpus: 4,
  defaultTimeout: 300000 // 5 minutes
});
```

---

## Test 1: Basic Python Execution

**Objective:** Verify Python 3.13 runtime execution

**Steps:**
1. Configure sandbox with `runtime: 'python3.13'`
2. Execute simple Python script:
```python
print("Hello from Vercel Sandbox")
import sys
print(f"Python: {sys.version}")
```

**Expected Results:**
- ✅ exitCode: 0
- ✅ stdout contains: "Hello from Vercel Sandbox"
- ✅ Python version: 3.13.x
- ✅ Sandbox created and destroyed

---

## Test 2: Node.js 22 Runtime

**Objective:** Verify Node.js 22 execution environment

**Steps:**
1. Configure with `runtime: 'node22'`
2. Execute JavaScript:
```javascript
console.log("Hello from Node");
console.log(process.version);
```

**Expected Results:**
- ✅ exitCode: 0
- ✅ Node version: v22.x.x
- ✅ Execution completes successfully

---

## Test 3: Script Upload and Execution

**Objective:** Verify local scripts are uploaded correctly

**Steps:**
1. Create local script: `/workspace/test.py`
2. Execute via provider
3. Verify script uploaded to `/vercel/sandbox/test.py`

**Expected Results:**
- ✅ Script uploaded successfully
- ✅ Executes from remote path
- ✅ Output captured correctly

---

## Test 4: Command Arguments

**Objective:** Verify args passed to script

**Steps:**
1. Create arg test script:
```python
import sys
for i, arg in enumerate(sys.argv[1:]):
    print(f"Arg {i}: {arg}")
```

2. Execute with args: `['test1', 'test2', 'value with spaces']`

**Expected Results:**
- ✅ All arguments received
- ✅ Spaces preserved in arguments

---

## Test 5: STDIN Input

**Objective:** Verify stdin data delivery

**Steps:**
1. Create stdin script:
```python
import sys
data = sys.stdin.read()
print(f"Received: {len(data)} bytes")
```

2. Execute with large stdin (10KB)

**Expected Results:**
- ✅ Full data received
- ✅ No truncation

---

## Test 6: Long-Running Task

**Objective:** Verify extended timeout support

**Steps:**
1. Create sleep script:
```python
import time
time.sleep(120)  # 2 minutes
print("Complete")
```

2. Configure timeout: 180000 (3 minutes)

**Expected Results:**
- ✅ Script completes successfully
- ✅ Output: "Complete"
- ✅ No timeout error

---

## Test 7: High CPU Task

**Objective:** Verify CPU allocation (4 vCPUs)

**Steps:**
1. Create CPU-intensive script:
```python
import multiprocessing
print(f"CPUs available: {multiprocessing.cpu_count()}")

# CPU-intensive work
result = sum(i**2 for i in range(10000000))
print(f"Result: {result}")
```

**Expected Results:**
- ✅ 4 vCPUs available
- ✅ Computation completes
- ✅ Performance acceptable

---

## Test 8: Error Handling

**Objective:** Verify error capture and reporting

**Steps:**
1. Create failing script:
```python
raise ValueError("Test error")
```

**Expected Results:**
- ✅ exitCode: 1
- ✅ stderr contains: "ValueError: Test error"
- ✅ Sandbox cleaned up

---

## Test 9: Multiple Sequential Executions

**Objective:** Verify ephemeral nature (new sandbox each time)

**Steps:**
1. Execute script that creates file:
```python
with open('/tmp/test.txt', 'w') as f:
    f.write('test')
```

2. Execute second script that checks file:
```python
import os
print(os.path.exists('/tmp/test.txt'))
```

**Expected Results:**
- ✅ First execution succeeds
- ✅ Second execution: file not found (new sandbox)
- ✅ Clean state verified

---

## Test 10: Sudo Access

**Objective:** Verify sudo capabilities when needed

**Steps:**
1. Configure with `sudo: true` in command options
2. Execute privileged command:
```bash
sudo apt-get update
```

**Expected Results:**
- ✅ Command executes with sudo
- ✅ No permission errors

---

## Test 11: Shell Script Execution

**Objective:** Verify bash in node22 runtime

**Steps:**
1. Runtime: `node22`
2. Execute shell script:
```bash
#!/bin/bash
echo "Shell works"
ls -la
```

**Expected Results:**
- ✅ Bash available
- ✅ Shell commands execute
- ✅ Output captured

---

## Test 12: Concurrent Executions

**Objective:** Verify parallel sandbox creation

**Steps:**
1. Launch 5 executions simultaneously
2. Each with unique identifier

**Expected Results:**
- ✅ All 5 complete successfully
- ✅ No interference between sandboxes
- ✅ All outputs distinct

---

## Performance Benchmarks

| Test | Expected Duration | Notes |
|------|------------------|-------|
| First execution | 15-30s | Cold start (container build) |
| Subsequent executions | 2-5s | Warm containers possible |
| Python script | < 5s | After warm-up |
| Node script | < 3s | After warm-up |
| Long task (2min) | ~120s | Extended timeout |

---

## Cost Considerations

**Pricing:** Pay-per-use serverless pricing
- Compute time charged
- First execution has cold start overhead
- Higher vCPU count = higher cost

**Limits by Tier:**
- Hobby: 45 minutes max timeout
- Pro/Enterprise: 5 hours max timeout

---

## Security Checklist

- [ ] Scripts isolated in ephemeral containers
- [ ] No persistence between executions
- [ ] Timeout enforced
- [ ] stdout/stderr captured
- [ ] Error cleanup verified
- [ ] Authentication required (team/project ID)

---

## Known Limitations

1. **Platform:** Requires Vercel account and authentication
2. **Cold Start:** First execution slow (container build)
3. **Ephemeral:** No state preserved between executions
4. **Network:** Requires internet connectivity to Vercel
5. **Cost:** Metered usage (not suitable for high-frequency tasks)
6. **OS:** Amazon Linux 2023 base (may differ from local environment)
