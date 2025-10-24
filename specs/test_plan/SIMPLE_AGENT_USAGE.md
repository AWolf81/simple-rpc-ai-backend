# Simple Agent CLI - Usage Guide

## Overview

The `simple-agent` CLI is an **AI-powered interactive agent** that interprets natural language and makes JSON-RPC/tRPC calls on your behalf. It requires an AI provider (Anthropic, OpenAI, etc.) to function.

---

## ⚠️ Important: Not a Direct RPC Client

The simple-agent **is NOT** a direct JSON-RPC client like `curl`. It uses AI to:
1. Understand your natural language request
2. Determine which skills/methods to call
3. Make the appropriate RPC calls
4. Return human-friendly responses

### Wrong Approach ❌
```bash
# This will fail - treating it like curl
simple-agent
> agents.skills.list
❌ Error: Invalid params
```

### Correct Approach ✅
```bash
# This works - natural language with AI
simple-agent
> List all available skills
✅ AI interprets → calls agents.skills.list → returns friendly response
```

---

## Prerequisites

### 1. Running Server

Start the agent server **before** using simple-agent:

```bash
# Terminal 1: Start server
node examples/03-agents-basic/server.js

# Keep this running - you should see:
# ✅ Agent server running with skills system!
# 📚 Loaded Skills: file-handling, brand-guidelines, hello-world
```

### 2. AI Provider Configured

The simple-agent requires an AI provider. **New: Automatic configuration discovery!**

```bash
# Recommended: Initialize user config (one-time setup)
simple-agent init
echo "ANTHROPIC_API_KEY=your_key_here" >> ~/.simple-agent/.env

# Or use project .env file
echo "ANTHROPIC_API_KEY=your_key_here" >> .env

# Or export environment variable
export ANTHROPIC_API_KEY=your_key_here
```

**See:** [Configuration Guide](../../tools/simple-agent/CONFIGURATION.md) for full details on hierarchical config discovery.

---

## Usage

### Connect to Existing Server

```bash
# Terminal 2: Start simple-agent (connects to port 8000)
simple-agent

# Or specify port explicitly
simple-agent --port 8000

# Or use full URL
simple-agent --url http://localhost:8000
```

### Natural Language Interactions

Once connected, use natural language:

```
You: List all available skills

AI: I found 3 skills available:
1. file-handling - File system operations
2. brand-guidelines - Brand compliance validation
3. hello-world - Test skill with greetings and JSON validation


You: Tell me about the file-handling skill

AI: The file-handling skill provides comprehensive file system operations...
[Shows full skill details]


You: Validate the JSON file at /workspace/test.json

AI: I'll use the hello-world skill to validate that file...
[Executes skill, shows results]
```

---

## Direct RPC Testing (Without AI)

If you want to test RPC methods **directly without AI**, use `curl` instead:

### Test 1: List Skills

```bash
curl -X POST http://localhost:8000/rpc \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "agents.skills.list",
    "params": {},
    "id": 1
  }' | jq
```

### Test 2: Get Skill Details

```bash
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
```

### Test 3: Execute Script

```bash
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
    "id": 3
  }' | jq
```

---

## Troubleshooting

### Error: "Invalid params"

**Cause**: You're trying to use natural language without AI configured, or the AI is making an incorrect RPC call.

**Solutions**:
1. Ensure `ANTHROPIC_API_KEY` is set
2. Use `curl` for direct RPC testing (see above)
3. Check that the server is running (`http://localhost:8000/health`)

### Error: "Connection refused"

**Cause**: Server not running or wrong port.

**Solution**:
```bash
# Check server is running
curl http://localhost:8000/health

# Should return: {"status":"ok"}

# If not, start server:
node examples/03-agents-basic/server.js
```

### Simple-agent starts own server

**Cause**: No server found on default port 8000.

**What happens**:
```bash
simple-agent
# Output:
# ⚠️  No server found on port 8000, starting internal server on port 8001...
```

**Solution**: Start the example server first (port 8000), then simple-agent will connect to it.

---

## Command-Line Options

```bash
# Default: Connect to existing server on port 8000
simple-agent

# Connect to specific port
simple-agent --port 8001

# Connect to remote server
simple-agent --url https://my-server.com:8000

# Use specific AI model
simple-agent --model claude-sonnet-3-7

# Silent mode (no server logs)
simple-agent --silent
```

---

## Test Plan Clarification

When the [skill-testing-plan.md](./skill-testing-plan.md) says:

> You: List available skills

This means:
- **For simple-agent**: Type "List available skills" and let AI handle it ✅
- **For curl/direct testing**: Use the JSON-RPC format shown earlier ✅

The test plan is documenting the **AI interaction pattern**, not direct RPC calls.

---

## Examples

### Example 1: AI-Powered Workflow

```bash
# Start server
node examples/03-agents-basic/server.js &

# Start simple-agent
export ANTHROPIC_API_KEY=sk-...
simple-agent

# Natural language interactions:
You: What skills do you have?
AI: I have 3 skills: file-handling, brand-guidelines, and hello-world...

You: Greet me formally
AI: [Uses hello-world skill]
Good day. How may I assist you?

You: Now validate this JSON file: /workspace/config.json
AI: [Uses hello-world validation script]
✅ Valid JSON - Type: object, Keys: 5
```

### Example 2: Direct RPC Testing (No AI)

```bash
# Start server
node examples/03-agents-basic/server.js

# Direct RPC calls with curl:
curl -X POST http://localhost:8000/rpc \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"agents.skills.list","params":{},"id":1}' \
  | jq '.result.skills[] | {id, name, description}'
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    USER                                 │
│                                                         │
│  Natural language:                                      │
│  "List available skills"                                │
│  "Validate my JSON file"                                │
│  "Tell me about file-handling"                          │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│              SIMPLE-AGENT CLI                           │
│                                                         │
│  - Ink UI (terminal interface)                          │
│  - AI integration (Anthropic/OpenAI)                    │
│  - Natural language → RPC translation                   │
└────────────────┬────────────────────────────────────────┘
                 │
                 │ JSON-RPC / tRPC calls
                 ▼
┌─────────────────────────────────────────────────────────┐
│            RPC AI BACKEND SERVER                        │
│                                                         │
│  - Skills system                                        │
│  - Sandbox execution                                    │
│  - File operations                                      │
└─────────────────────────────────────────────────────────┘
```

---

## Summary

- **Simple-agent** = AI-powered natural language interface
- **curl** = Direct JSON-RPC testing
- Both are valid, but serve different purposes
- Test plans show AI interactions (natural language)
- For direct testing, use the JSON-RPC examples provided

Use simple-agent for:
- Interactive exploration
- AI-powered workflows
- Natural language convenience

Use curl for:
- Automated testing
- CI/CD integration
- Direct method validation
