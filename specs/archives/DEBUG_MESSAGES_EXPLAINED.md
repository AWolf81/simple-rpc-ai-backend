# Debug Messages Explained

## Overview

When running simple-agent with `LOG_LEVEL=debug`, you'll see various messages that may look like errors but are actually harmless or informational. This document explains each type of message.

## Harmless Warning Messages

### 1. "Could not read directory" Messages

```
Could not read directory: /path/to/skill/references
Could not read directory: /path/to/skill/scripts
Could not read directory: /path/to/skill/commands
Could not read directory: /path/to/skill/templates
Could not read directory: /path/to/skill/examples
```

**What it means**: The skill loader is checking for optional directories that enhance skills with additional resources.

**Why it happens**: These directories are **optional**. Skills can have:
- `references/` - Additional reference documentation
- `scripts/` - Executable scripts (TypeScript, Python, etc.)
- `commands/` - CLI commands
- `templates/` - File templates
- `examples/` - Usage examples

**Is it a problem?** ❌ **No** - This is normal. Most skills don't use all optional directories.

**File**: [src/services/agents/skills/parser.ts:381](src/services/agents/skills/parser.ts#L381)

**Severity**: `debug` level - informational only

---

### 2. "Matched route: (none)" Messages

```
Requested URL: /agents.skills.list?input=%7B...%7D
Matched route: (none)
Method: GET
```

**What it means**: Express's default logger doesn't understand tRPC's dynamic routing, so it reports "(none)" even though the route actually matched and worked.

**Why it happens**: tRPC uses Express middleware that handles routing internally. Express's built-in logger runs before tRPC's middleware, so it doesn't see the route match.

**Is it a problem?** ❌ **No** - The request actually succeeds! You'll see:
```
✅ Loaded skill: main-agent
✅ Loaded skill: file-handling
✅ Loaded skill: hello-world
```

This proves the requests worked.

**How to verify**: Check for success messages after the "(none)" warnings. If skills load, everything is working.

---

## Success Indicators

When everything is working correctly, you'll see:

```bash
✅ Loaded skill: main-agent
✅ Loaded skill: file-handling
✅ Loaded skill: hello-world
✅ Loaded 3 skills from 3 sources
✅ Skill system initialized with 3 skills
```

And in the simple-agent UI:
```
✅ Loaded 3 skill(s): main-agent, file-handling, hello-world
```

## Actual Error Messages

### Skills System Error (FIXED)

**Before** (v0.x):
```
⚠️ Skills system error: Unable to transform response from server
```

**Cause**: Date objects in skill metadata couldn't be serialized by tRPC.

**Fix**: [src/trpc/routers/agents/skills.ts:81](src/trpc/routers/agents/skills.ts#L81)
```typescript
loadedAt: skill.loadedAt?.toISOString() || new Date().toISOString()
```

**Status**: ✅ **Fixed** in current version

---

### Tool Execution Error (FIXED)

**Before** (v0.x):
```
Anthropic API error: messages.2.content.1: each tool_use must have a single result.
'Found multiple tool_result blocks with id: tool_u_01BH...'
```

**Cause**: Manual tool-result message construction created duplicates.

**Fix**: [src/services/ai/ai-service.ts:1301-1355](src/services/ai/ai-service.ts#L1301-L1355)

Switched to Vercel AI SDK's `toolInvocations` pattern.

**Status**: ✅ **Fixed** in current version

---

## Reducing Debug Noise

If you want quieter logs:

### Option 1: Use INFO level (Recommended)
```bash
LOG_LEVEL=info npx tsx src/cli.ts chat
```

Shows only important messages, hides debug noise.

### Option 2: Use WARN level
```bash
LOG_LEVEL=warn npx tsx src/cli.ts chat
```

Shows only warnings and errors.

### Option 3: Default (No LOG_LEVEL)
```bash
npx tsx src/cli.ts chat
```

Shows standard output without debug messages.

---

## Debug Log Categories

### Always Safe to Ignore

- ✅ "Could not read directory" for optional skill directories
- ✅ "Matched route: (none)" for tRPC requests
- ✅ Deprecation warnings for models (informational)

### Worth Investigating

- ⚠️ "Skills system error" - Check configuration
- ⚠️ "Tool execution failed" - Check tool arguments
- ⚠️ "Agent execution failed" - Check API keys and model availability

### Requires Action

- ❌ "Missing API Key" - Add API key to .env file
- ❌ "Rate limit exceeded" - Wait or upgrade plan
- ❌ "Model not found" - Check model name spelling

---

## Log Level Recommendations

| Use Case | LOG_LEVEL | What You See |
|----------|-----------|--------------|
| **Production** | (none) or `info` | Clean output, important messages only |
| **Debugging Skills** | `debug` | All skill loading details, optional directories |
| **Debugging Tools** | `debug` | Tool execution traces, arguments, results |
| **Debugging tRPC** | `debug` | All HTTP requests, route matching attempts |
| **Silent** | `error` | Errors only |

---

## Example: Normal Debug Output

This is what a **successful** skill load looks like with `LOG_LEVEL=debug`:

```bash
$ LOG_LEVEL=debug npx tsx src/cli.ts chat

Could not read directory: /path/to/skills/builtin/main-agent/references
Could not read directory: /path/to/skills/builtin/main-agent/scripts
Could not read directory: /path/to/skills/builtin/main-agent/commands
...
✅ Loaded skill: main-agent
✅ Loaded skill: file-handling
✅ Loaded skill: hello-world
✅ Loaded 3 skills from 3 sources
✅ Skill system initialized with 3 skills

Requested URL: /agents.skills.list?input=%7B%22json%22%3Anull...
Matched route: (none)
Method: GET
```

**All of this is normal!** The ✅ messages confirm success.

---

## When to Report an Issue

Report an issue if you see:

1. **No skills loaded** after multiple attempts
2. **Actual errors** (not warnings) in skill loading
3. **Tool execution failures** that shouldn't fail
4. **API errors** that aren't about missing keys

**Where to report**: [GitHub Issues](https://github.com/your-org/simple-rpc-ai-backend/issues)

---

## Related Documentation

- [TOOL_OUTPUT_UI_IMPLEMENTATION.md](TOOL_OUTPUT_UI_IMPLEMENTATION.md) - Tool execution display
- [DUPLICATE_TOOL_RESULTS_FIX.md](DUPLICATE_TOOL_RESULTS_FIX.md) - Tool calling architecture
- [TOOL_OUTPUT_TESTING_GUIDE.md](TOOL_OUTPUT_TESTING_GUIDE.md) - Testing methodology
