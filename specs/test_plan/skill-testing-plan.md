# Agent Skills System - Manual Testing Guide

This guide walks you through testing the complete agent skills system using the `simple-agent` CLI.

## Prerequisites

```bash
# 1. Build the project
pnpm build

# 2. Start the server with skills enabled
node examples/03-agents-basic/server.js

# Keep this terminal running - open a new terminal for testing
```

The server should start on port 8000 with:
- ✅ Built-in `file-handling` skill
- ✅ Custom `brand-guidelines` skill
- ✅ Custom `hello-world` skill (test skill)

## Test 1: List All Skills

```bash
# Using curl (JSON-RPC)
curl -X POST http://localhost:8000/rpc \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "agents.skills.list",
    "params": {},
    "id": 1
  }' | jq

# Expected output: List of 3 skills with metadata
```

**What to verify:**
- ✅ 3 skills returned
- ✅ Each has `id`, `name`, `description`
- ✅ `level1Tokens` is ~100 or less
- ✅ `sourceType` is correct (builtin, local)

**Result**:
- No errors
- 3 skills returned
- Questions for later? capabilities is there a naming guide? e.g. file hanlding has file-read, file-write, file-search and directory-operations.

## Test 2: Get Skill Details

```bash
# Get hello-world skill details
curl -X POST http://localhost:8000/rpc \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "agents.skills.get",
    "params": {
      "skillId": "hello-world"
    },
    "id": 2
  }' | jq

# Expected: Full skill details including metadata and instructions
```

**What to verify:**
- ✅ `metadata` contains frontmatter data - OK
- ✅ `instructions` contains SKILL.md body - OK
- ✅ `level1Tokens` and `level2Tokens` shown - OK 116 & 270 for level 1 and 2
- ✅ `scripts` array has 2 scripts - OK
- ✅ `allowedPaths` is ["/workspace", "/tmp"] - OK

**Result**

OK

## Test 3: Validate Skill Structure

```bash
# Validate the hello-world skill
curl -X POST http://localhost:8000/rpc \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "agents.skills.validate",
    "params": {
      "skillId": "hello-world"
    },
    "id": 3
  }' | jq

# Expected: Validation results with metrics
```

**What to verify:**
- ✅ `valid: true`
- ✅ `errors: []` (empty array)
- ✅ `warnings: []` or minor warnings only
- ✅ `metrics.level1Tokens` < 100
- ✅ `metrics.level2Tokens` < 5000
- ✅ `metrics.scripts` shows 2 scripts with `safe: true`
- ✅ `recommendations` array (may be empty)

**Result**

!!NOK!! - fails with: 
{
  "jsonrpc": "2.0",
  "id": 3,
  "error": {
    "code": -32603,
    "message": "Internal error",
    "data": "require is not defined"
  }
}

## Test 4: Get Token Metrics

```bash
# Get detailed token usage metrics
curl -X POST http://localhost:8000/rpc \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "agents.skills.metrics",
    "params": {
      "skillId": "hello-world"
    },
    "id": 4
  }' | jq

# Expected: Detailed token breakdown
```

**What to verify:**
- ✅ `level1` (metadata) ~85 tokens --> OK slightly more 116
- ✅ `level2` (instructions) ~200 tokens --> OK 270
- ✅ `level3` = 0 (resources not loaded yet) --> OK, 481 for level3
- ✅ `breakdown` shows per-section counts --> OK, total count matches sum

**Result**

OK

## Test 5: Execute Script (Simple Greeting)

```bash
# Execute the greeting script
curl -X POST http://localhost:8000/rpc \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "agents.skills.executeScript",
    "params": {
      "skillId": "hello-world",
      "scriptName": "scripts/greet.ts",
      "args": ["Alice"]
    },
    "id": 5
  }' | jq

# Expected: "Hello, Alice!"
```

**What to verify:**
- ✅ `exitCode: 0` --> OK
- ✅ `stdout: "Hello, Alice!\n"` --> OK
- ✅ `stderr: ""` --> OK
- ✅ `duration` < 5000ms --> OK 576
- ✅ `timedOut: false` --> OK

**Result**

OK
```
{
  "jsonrpc": "2.0",
  "id": 5,
  "result": {
    "exitCode": 0,
    "stdout": "Hello, Alice!\n",
    "stderr": "",
    "duration": 576,
    "timedOut": false
  }
}
```

## Test 6: Execute Script with Flags

```bash
# Execute greeting with formal flag
curl -X POST http://localhost:8000/rpc \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "agents.skills.executeScript",
    "params": {
      "skillId": "hello-world",
      "scriptName": "scripts/greet.ts",
      "args": ["Bob", "--formal"]
    },
    "id": 6
  }' | jq

# Expected: "Good day, Bob. How may I assist you?"
```

**What to verify:**
- ✅ `exitCode: 0` --> OK
- ✅ `stdout` contains formal greeting --> OK
- ✅ Argument parsing works correctly --> OK

**Result**

OK
{
  "jsonrpc": "2.0",
  "id": 6,
  "result": {
    "exitCode": 0,
    "stdout": "Good day, Bob. How may I assist you?\n",
    "stderr": "",
    "duration": 620,
    "timedOut": false
  }
}

## Test 7: Execute JSON Validator (Success)

First, create a test JSON file:

```bash
# Create test JSON file
mkdir -p /tmp/workspace
echo '{"name": "test", "value": 42}' > /tmp/workspace/test.json
```

Then validate it:

```bash
curl -X POST http://localhost:8000/rpc \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "agents.skills.executeScript",
    "params": {
      "skillId": "hello-world",
      "scriptName": "scripts/validate-json.ts",
      "args": ["/tmp/workspace/test.json"]
    },
    "id": 7
  }' | jq

# Expected: "✅ Valid JSON"
```

**What to verify:**
- ✅ `exitCode: 0` --> OK
- ✅ `stdout` contains "✅ Valid JSON" --> OK
- ✅ Shows type and key count --> OK

**Result**

OK

```
{
  "jsonrpc": "2.0",
  "id": 7,
  "result": {
    "exitCode": 0,
    "stdout": "✅ Valid JSON\nType: object\nKeys: 2\n",
    "stderr": "",
    "duration": 665,
    "timedOut": false
  }
}
```

## Test 8: Execute JSON Validator (Failure)

```bash
# Create invalid JSON
echo '{invalid json}' > /tmp/workspace/invalid.json

# Try to validate
curl -X POST http://localhost:8000/rpc \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "agents.skills.executeScript",
    "params": {
      "skillId": "hello-world",
      "scriptName": "scripts/validate-json.ts",
      "args": ["/tmp/workspace/invalid.json"]
    },
    "id": 8
  }' | jq

# Expected: Error with exitCode: 1
```

**What to verify:**
- ✅ `exitCode: 1` --> OK
- ✅ `stderr` contains "❌ Invalid JSON" --> OK
- ✅ Error message describes the issue --> OK

** Result **

OK

```
{
  "jsonrpc": "2.0",
  "id": 8,
  "result": {
    "exitCode": 1,
    "stdout": "",
    "stderr": "❌ Invalid JSON\nError: Expected property name or '}' in JSON at position 1 (line 1 column 2)\n",
    "duration": 647,
    "timedOut": false
  }
}
```

## Test 9: Match Skills by Capability

```bash
# Find all skills with 'testing' capability
curl -X POST http://localhost:8000/rpc \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "agents.skills.match",
    "params": {
      "capabilities": ["testing"]
    },
    "id": 9
  }' | jq

# Expected: Returns hello-world skill
```

**What to verify:**
- ✅ Returns 1 skill (hello-world) --> OK
- ✅ Has `capabilities: ["testing", "demonstration"]` --> OK

## Test 10: Get Skills Statistics

```bash
# Get overall system statistics
curl -X POST http://localhost:8000/rpc \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "agents.skills.stats",
    "params": {},
    "id": 10
  }' | jq

# Expected: System-wide statistics
```

**What to verify:**
- ✅ `totalSkills: 3` --> OK
- ✅ `bySource.builtin: 1` --> OK
- ✅ `bySource.local: 2` --> OK
- ✅ `totalLevel1Tokens` < 300 --> OK
- ✅ `totalLevel2Tokens` < 10000 --> OK

** Result **

OK
Question. Are total level 1 and level 2 important?


## Test 11: Using simple-agent CLI (AI-Powered Interactive)

⚠️ **Important**: The simple-agent CLI is an **AI-powered agent** that uses natural language, not a direct RPC client. It requires an AI provider (Anthropic/OpenAI) configured.

**Prerequisites:**
```bash
# 1. Ensure server is running (from earlier steps)
# Server should be on http://localhost:8000

# 2. Set AI provider API key
export ANTHROPIC_API_KEY=your_key_here
```

**Usage:**
```bash
# Run simple-agent (connects to existing server on port 8000)
simple-agent

# Natural language interactions:
You: List available skills
AI: [Interprets request, calls agents.skills.list, returns friendly response]

You: Tell me about the hello-world skill
AI: [Calls agents.skills.get with skillId: "hello-world"]

You: Execute the greet script with name "Charlie"
AI: [Calls agents.skills.executeScript with appropriate parameters]
```

**What to verify:**
- ✅ Simple-agent connects to existing server (shows: "✅ Connected to existing server on port 8000")
  - OR starts internal server (shows: "⚠️ No server found on port 8000, starting internal server on port 8001...")
- ✅ AI provider configured (shows API key status or "🆓 Using free OpenRouter model")
- ✅ AI interprets natural language requests
- ✅ RPC calls are made automatically
- ✅ Results are returned in human-friendly format

**Troubleshooting:**
- **Clear error message** if no AI configured: Shows helpful setup instructions with 3 options (free model, Anthropic, quick test)
- **Automatic fallback**: If no API key found, automatically uses free OpenRouter model
- **Server auto-start**: If no server on port 8000, starts internal server on port 8001
- For **direct RPC testing without AI**, use `curl` (see other tests)

**See also**: [SIMPLE_AGENT_USAGE.md](./SIMPLE_AGENT_USAGE.md) for detailed usage guide

## Test 12: Security Validation

### Test Path Restriction

```bash
# Try to access file outside /workspace
curl -X POST http://localhost:8000/rpc \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "agents.skills.executeScript",
    "params": {
      "skillId": "hello-world",
      "scriptName": "scripts/validate-json.ts",
      "args": ["/etc/passwd"]
    },
    "id": 12
  }' | jq

# Expected: exitCode: 1, error about path restriction
```

**What to verify:**
- ✅ Script refuses to access `/etc/passwd`
- ✅ Error message mentions allowed paths

### Test Timeout

```bash
# Create a slow script (if needed)
cat > /tmp/workspace/slow.json << 'EOF'
{"test": "data"}
EOF

# Normal execution should be fast
# (The sandbox has a 30s timeout by default)
```

## Test 13: Progressive Disclosure Verification

```bash
# 1. List skills (Level 1 only - metadata)
curl -s -X POST http://localhost:8000/rpc \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"agents.skills.list","params":{},"id":1}' \
  | jq '.result.skills[] | {id, level1Tokens, hasResources}'

# 2. Get skill details (Level 2 loaded - instructions)
curl -s -X POST http://localhost:8000/rpc \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"agents.skills.get","params":{"skillId":"hello-world"},"id":2}' \
  | jq '.result | {level1Tokens, level2Tokens, hasResources}'

# 3. Execute script (Level 3 accessed - resources on-demand)
curl -s -X POST http://localhost:8000/rpc \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"agents.skills.executeScript","params":{"skillId":"hello-world","scriptName":"scripts/greet.ts","args":["Test"]},"id":3}' \
  | jq '.result.stdout'
```

**What to verify:**
- ✅ Level 1: Fast, minimal tokens
- ✅ Level 2: Instructions loaded, still <5k tokens
- ✅ Level 3: Scripts loaded only when executed

## Troubleshooting

### Skill not found
```bash
# Check if server started correctly
curl http://localhost:8000/health

# Check logs for skill loading errors
```

### Script execution fails
```bash
# Verify tsx is available
which tsx

# Test script directly
tsx examples/03-agents-basic/custom-skills/hello-world/scripts/greet.ts Alice
```

### TypeScript build issues
```bash
# Rebuild the project
pnpm build

# Check for compilation errors
pnpm typecheck
```

## Test 14: Agent Integration - Skill Usage

**Objective:** Verify agents can discover and use skills during AI-powered execution

### Prerequisites
- Server with skills enabled
- AI provider configured (Anthropic, OpenAI, or Google)
- Agent system enabled

### Test 14.1: Agent Discovers Available Skills

```bash
# Request AI generation with skill discovery enabled
curl -X POST http://localhost:8000/rpc \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "jsonrpc": "2.0",
    "method": "ai.generateText",
    "params": {
      "content": "List all available skills",
      "enableSkills": true
    },
    "id": 14
  }' | jq
```

**Expected Results:**
- ✅ Agent lists 3 skills (file-handling, brand-guidelines, hello-world)
- ✅ Response includes skill names and brief descriptions
- ✅ Agent accessed `agents.skills.list` internally

### Test 14.2: Agent Uses Skill to Complete Task

```bash
# Create test file for validation
echo '{"test": "data"}' > /tmp/workspace/agent-test.json

# Ask agent to validate the JSON file using skills
curl -X POST http://localhost:8000/rpc \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "jsonrpc": "2.0",
    "method": "ai.generateText",
    "params": {
      "content": "Validate the JSON file at /tmp/workspace/agent-test.json",
      "enableSkills": true,
      "systemPrompt": "You have access to skills for validation tasks. Use the hello-world skill to validate JSON files."
    },
    "id": 15
  }' | jq
```

**Expected Results:**
- ✅ Agent identifies hello-world skill has JSON validation capability
- ✅ Agent calls `agents.skills.executeScript` with correct parameters
- ✅ Agent reports validation result based on script output
- ✅ Response indicates file is valid JSON

### Test 14.3: Agent Handles Skill Execution Errors

```bash
# Create invalid JSON
echo '{invalid}' > /tmp/workspace/bad.json

# Ask agent to validate
curl -X POST http://localhost:8000/rpc \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "jsonrpc": "2.0",
    "method": "ai.generateText",
    "params": {
      "content": "Validate the JSON file at /tmp/workspace/bad.json",
      "enableSkills": true
    },
    "id": 16
  }' | jq
```

**Expected Results:**
- ✅ Agent executes validation skill
- ✅ Agent receives exitCode: 1 and error message
- ✅ Agent reports to user that JSON is invalid
- ✅ Agent includes specific error details from stderr

### Test 14.4: Agent Matches Skills by Capability

```bash
# Ask agent to find appropriate skill
curl -X POST http://localhost:8000/rpc \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "jsonrpc": "2.0",
    "method": "ai.generateText",
    "params": {
      "content": "I need to perform testing. Which skills can help?",
      "enableSkills": true
    },
    "id": 17
  }' | jq
```

**Expected Results:**
- ✅ Agent uses `agents.skills.match` with `capabilities: ["testing"]`
- ✅ Agent identifies hello-world skill
- ✅ Agent explains skill capabilities

### Test 14.5: Multi-Step Workflow with Skills

```bash
# Complex task requiring multiple skills
curl -X POST http://localhost:8000/rpc \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "jsonrpc": "2.0",
    "method": "ai.generateText",
    "params": {
      "content": "Greet the user Alice formally, then validate the file /tmp/workspace/agent-test.json",
      "enableSkills": true
    },
    "id": 18
  }' | jq
```

**Expected Results:**
- ✅ Agent executes greet.ts script with args: ["Alice", "--formal"]
- ✅ Agent executes validate-json.ts with args: ["/tmp/workspace/agent-test.json"]
- ✅ Agent combines results in coherent response
- ✅ Both operations complete successfully

## Success Criteria

All tests pass if:
- ✅ All 3 skills load successfully
- ✅ Validation returns `valid: true`
- ✅ Token counts within limits (L1: ~100, L2: <5k)
- ✅ Scripts execute correctly
- ✅ Security restrictions enforced
- ✅ Error handling works properly
- ✅ Progressive disclosure verified
- ✅ Agents can discover and use skills (Test 14)
- ✅ Agents handle skill errors gracefully (Test 14.3)
- ✅ Multi-step skill workflows function (Test 14.5)

## Next Steps

After successful testing:
1. Create your own custom skills
2. Distribute skills via GitHub/npm
3. Integrate with agent execution and orchestration
4. Add dev panel UI for skill validation
5. Implement sub-agent capabilities for parallel execution

## Reference

- **Feature Spec**: [specs/features/agent-skills-system.md](specs/features/agent-skills-system.md)
- **Architecture**: [specs/architecture.md](specs/architecture.md)
- **Implementation**: [AGENT_SKILLS_IMPLEMENTATION.md](AGENT_SKILLS_IMPLEMENTATION.md)
- **Example Config**: [examples/03-agents-basic/server.js](examples/03-agents-basic/server.js)
