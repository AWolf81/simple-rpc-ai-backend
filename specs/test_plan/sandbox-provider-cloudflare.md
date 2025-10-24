# Cloudflare Sandbox Provider - Manual Test Plan

## Overview
The Cloudflare Sandbox Provider executes scripts in edge-native isolated containers on Cloudflare's global network using Durable Objects.

**Provider:** `CloudflareSandboxProvider`
**Session Type:** Persistent (Durable Object-based)
**Prerequisites:** `@cloudflare/sandbox` package, Cloudflare Workers environment, Docker (for local dev)

---

## Setup

### Installation
```bash
pnpm add @cloudflare/sandbox
```

### Local Development Prerequisites
```bash
# Ensure Docker is running
docker --version

# Create project from template
npm create cloudflare@latest -- my-sandbox --template=cloudflare/sandbox-sdk/examples/minimal
```

### Configuration
```typescript
import { CloudflareSandboxProvider } from 'simple-rpc-ai-backend/providers';
import { getSandbox } from '@cloudflare/sandbox';

// In Workers environment
const provider = new CloudflareSandboxProvider({
  sandboxNamespace: env.Sandbox, // DurableObjectNamespace
  sandboxId: 'skill-sandbox',
  defaultTimeout: 30000,
  workspacePath: '/workspace'
});
```

---

## Test 1: Basic Python Execution

**Objective:** Verify Python runtime in container

**Steps:**
1. Initialize provider in Workers environment
2. Execute Python script:
```python
print("Hello from Cloudflare Edge")
import sys
print(f"Python: {sys.version}")
```

**Expected Results:**
- ✅ exitCode: 0
- ✅ success: true
- ✅ stdout contains: "Hello from Cloudflare Edge"
- ✅ Python available

---

## Test 2: JavaScript/Node Execution

**Objective:** Verify Node.js runtime

**Steps:**
1. Execute JavaScript:
```javascript
console.log("Hello from Node");
console.log(process.version);
console.log(process.platform);
```

**Expected Results:**
- ✅ exitCode: 0
- ✅ Node version shown
- ✅ Platform: linux

---

## Test 3: File Write and Read

**Objective:** Verify file system persistence in Durable Object

**Steps:**
1. Write file:
```typescript
await sandbox.writeFile('/workspace/test.txt', 'Hello Edge');
```

2. Read file:
```typescript
const file = await sandbox.readFile('/workspace/test.txt');
console.log(file.content);
```

**Expected Results:**
- ✅ File written successfully
- ✅ Content: "Hello Edge"
- ✅ Persistence within sandbox session

---

## Test 4: File List Operation

**Objective:** Verify directory listing

**Steps:**
1. Create multiple files
2. List directory:
```typescript
const files = await sandbox.listFiles('/workspace');
console.log(files);
```

**Expected Results:**
- ✅ All files listed
- ✅ Array of file paths returned

---

## Test 5: File Deletion

**Objective:** Verify file cleanup

**Steps:**
1. Create file
2. Delete file:
```typescript
await sandbox.deleteFile('/workspace/test.txt');
```

3. Try to read (should fail)

**Expected Results:**
- ✅ File deleted successfully
- ✅ Read fails after deletion

---

## Test 6: Script Upload from Local

**Objective:** Verify local script upload to edge

**Steps:**
1. Provide local script path
2. Provider uploads to `/workspace/`
3. Execute uploaded script

**Expected Results:**
- ✅ Script uploaded successfully
- ✅ Executes from workspace
- ✅ Output captured

---

## Test 7: Command Arguments

**Objective:** Verify args passed correctly

**Steps:**
1. Execute with args:
```typescript
args: ['arg1', 'arg2', 'test value']
```

2. Script:
```python
import sys
print(sys.argv[1:])
```

**Expected Results:**
- ✅ All args received
- ✅ Spaces preserved
- ✅ Order maintained

---

## Test 8: Environment Variables

**Objective:** Verify custom environment

**Steps:**
1. Execute with env:
```typescript
env: {
  API_KEY: 'test123',
  DEBUG: 'true'
}
```

2. Script reads environment

**Expected Results:**
- ✅ All env vars available
- ✅ Values correct

---

## Test 9: Timeout Configuration

**Objective:** Verify timeout enforcement

**Steps:**
1. Execute long-running script with timeout: 10000
2. Verify kills after timeout

**Expected Results:**
- ✅ Script terminated
- ✅ Error indicates timeout

---

## Test 10: STDIN Input

**Objective:** Verify stdin data passing

**Steps:**
1. Execute with stdin data:
```typescript
stdin: 'test input\nline 2\nline 3'
```

2. Script reads from stdin

**Expected Results:**
- ✅ All lines received
- ✅ Formatting preserved

---

## Test 11: Git Clone (if supported)

**Objective:** Verify repository cloning

**Steps:**
1. Use git integration (if available):
```typescript
await sandbox.gitClone('https://github.com/user/repo', {
  branch: 'main',
  path: '/workspace/repo'
});
```

2. List files in repo

**Expected Results:**
- ✅ Repository cloned
- ✅ Files accessible
- ✅ Branch correct

---

## Test 12: Edge Location Testing

**Objective:** Verify execution at edge (global distribution)

**Steps:**
1. Deploy to Cloudflare Workers
2. Execute from different geographic locations
3. Measure latency

**Expected Results:**
- ✅ Low latency globally
- ✅ Consistent execution
- ✅ Edge-native performance

---

## Test 13: Persistent Sandbox State

**Objective:** Verify Durable Object persistence

**Steps:**
1. Execute script that creates state
2. Execute second script accessing same sandbox ID
3. Verify state preserved

**Expected Results:**
- ✅ Same Durable Object reused
- ✅ Files persist between requests
- ✅ State maintained

---

## Test 14: Health Check

**Objective:** Verify sandbox availability

**Steps:**
1. Call provider.healthCheck()
2. Verify simple echo command

**Expected Results:**
- ✅ Returns true
- ✅ Sandbox responsive
- ✅ Quick response (< 1s)

---

## Test 15: Error Handling

**Objective:** Verify error capture and cleanup

**Steps:**
1. Execute failing script
2. Verify error captured
3. Execute successful script (sandbox still usable)

**Expected Results:**
- ✅ Error in stderr
- ✅ exitCode: 1
- ✅ Sandbox not corrupted

---

## Test 16: Concurrent Executions (Same Sandbox)

**Objective:** Verify serialization within Durable Object

**Steps:**
1. Launch multiple exec() calls to same sandbox ID
2. Verify sequential execution

**Expected Results:**
- ✅ Commands execute in order
- ✅ No race conditions
- ✅ State consistency maintained

---

## Test 17: Multiple Sandbox Instances

**Objective:** Verify isolation between different sandbox IDs

**Steps:**
1. Create sandbox A
2. Create sandbox B
3. Verify independent state

**Expected Results:**
- ✅ Separate Durable Objects
- ✅ Complete isolation
- ✅ No state sharing

---

## Performance Benchmarks

| Test | Expected Duration | Notes |
|------|------------------|-------|
| Local dev (first run) | 2-3 minutes | Docker container build |
| Local dev (subsequent) | < 1s | Container cached |
| Production (cold start) | 2-3 minutes | First deployment provisioning |
| Production (warm) | < 500ms | Edge-native execution |
| File operations | < 100ms | In-memory/local storage |
| Git clone | 1-5s | Network dependent |

---

## Deployment Checklist

### Local Development
- [ ] Docker installed and running
- [ ] Template project created
- [ ] `npm run dev` successful
- [ ] Test endpoints responding

### Production Deployment
```bash
npx wrangler deploy
```

- [ ] Deployment successful
- [ ] Wait 2-3 minutes for provisioning
- [ ] Test production endpoints
- [ ] Verify global availability

---

## Workers Environment Considerations

**Durable Objects:**
- Persistent state within same sandbox ID
- Isolated state per sandbox ID
- Automatic serialization of requests

**Limitations:**
- Workers environment only (not standalone Node.js)
- Requires Cloudflare account
- Container provisioning time on first deploy

**Advantages:**
- Global edge distribution
- Low latency worldwide
- Persistent state via Durable Objects
- Scales automatically

---

## Security Checklist

- [ ] Container isolation enforced
- [ ] Durable Object access controlled
- [ ] File system isolated per sandbox
- [ ] Timeout enforced
- [ ] Error handling prevents state corruption
- [ ] Authentication at Workers level

---

## Known Limitations

1. **Platform:** Cloudflare Workers environment required (not standalone)
2. **Development:** Requires Docker for local testing
3. **First Run:** 2-3 minute cold start for container provisioning
4. **State:** Persistent within Durable Object (not ephemeral like Vercel)
5. **Cost:** Cloudflare Workers pricing + Durable Objects storage
6. **Preview URLs:** Requires proxy setup for exposed services

---

## Integration Example

```typescript
// wrangler.toml
durable_objects.bindings = [
  { name = "Sandbox", class_name = "Sandbox" }
]

// worker.ts
import { getSandbox, Sandbox } from '@cloudflare/sandbox';

export { Sandbox };

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const sandbox = getSandbox(env.Sandbox, 'my-sandbox');

    // Execute Python
    const result = await sandbox.exec('python3 -c "print(2+2)"');

    return Response.json({
      output: result.stdout,
      success: result.success
    });
  }
};
```
