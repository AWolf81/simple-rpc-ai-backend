# CLAUDE.md

Simple RPC AI Backend - Secure, platform-agnostic AI integration with system prompt protection and MCP support.

## Quick Start

```bash
pnpm build && pnpm test:coverage && pnpm typecheck  # Build & validate
pnpm dev:docs             # Start server + dev panel + playground
LOG_LEVEL=info pnpm dev   # Quiet logs (debug/warn/error/silent)
```

**Dev URLs**: `http://localhost:8080` (dev panel), `http://localhost:8080/api/trpc-playground` (tRPC), `http://localhost:8080/mcp` (MCP)

## Core Concepts

**Mission**: System prompt protection + corporate proxy bypass for enterprise AI
**Architecture**: JSON-RPC + tRPC + MCP protocols on unified Express server
**Security**: AES-256-GCM encryption, OAuth authentication, server-side prompts


## Usage Patterns

### Server Setup
```typescript
import { createRpcAiServer } from 'simple-rpc-ai-backend';
const server = createRpcAiServer({
  serverProviders: ['anthropic', 'openai'],
  serverWorkspaces: {
    enabled: true,
    defaultWorkspace: {
      path: '/home/user/project',
      readOnly: false
    }
  },
  mcp: {
    enabled: true
  }
});
server.start();
```

### tRPC Client (TypeScript)
```typescript
import { createTypedAIClient } from 'simple-rpc-ai-backend';
import { httpBatchLink } from '@trpc/client';

const client = createTypedAIClient({
  links: [httpBatchLink({ url: 'http://localhost:8000/trpc', headers: { authorization: `Bearer ${token}` } })]
});

await client.ai.generateText.mutate({ content, systemPrompt });
```

### Custom MCP Tools
```typescript
import { router, publicProcedure, createMCPTool } from 'simple-rpc-ai-backend';
import { z } from 'zod';

const mathRouter = router({
  add: publicProcedure
    .meta({ ...createMCPTool({ name: 'add', description: 'Add numbers', category: 'math' }) })
    .input(z.object({ a: z.number(), b: z.number() }))
    .query(({ input }) => ({ result: input.a + input.b }))
});

const server = createRpcAiServer({ customRouters: { math: mathRouter } });
```

## Configuration Structure

**IMPORTANT**: AI provider configuration is at the **root level**, NOT nested under an `ai` property.

### ✅ Correct Configuration
```typescript
const server = createRpcAiServer({
  // AI configuration - at root level
  serverProviders: ['anthropic', 'openai'],      // Server-managed providers
  byokProviders: ['anthropic', 'openai'],        // Bring-your-own-key providers
  systemPrompts: { default: '...' },             // System prompts
  modelRestrictions: { anthropic: {...} },       // Model allow/block lists

  // MCP configuration
  mcp: {
    enabled: true,
    ai: {                                         // MCP-specific AI config (optional)
      enabled: true,
      useServerConfig: true                       // Use serverProviders above
    }
  }
});
```

### ❌ Incorrect Configuration (Don't Use)
```typescript
const server = createRpcAiServer({
  // ❌ WRONG - Don't nest providers under 'ai'
  ai: {
    providers: {
      anthropic: { apiKey: '...' }
    }
  }
});
```

**See**: [Configuration Documentation](docs/server-api/configuration.md) for complete reference.

## Key Methods

**AI**: `ai.generateText` (AI with system prompts), `health`
**Auth**: `initializeSession`, `upgradeToOAuth`, `getAuthStatus`
**BYOK**: `storeUserKey`, `getUserKey`, `validateUserKey`, `rotateUserKey`, `deleteUserKey` (email-based identifiers)

## Development URLs
- **Dev Panel**: `http://localhost:8080` - API explorer with MCP integration
- **tRPC Playground**: `http://localhost:8080/api/trpc-playground` - Type-safe testing with full custom router support
- **MCP Inspector**: `http://localhost:8080/mcp` - Tool explorer
- **OpenRPC Playground**: `http://localhost:3000` - JSON-RPC testing

### MCP Development Workflow
1. Add `meta({ mcp: {...} })` to tRPC procedure for tools
2. Add `meta(createMCPPrompt({...}))` to tRPC procedure for prompts
3. Visit `http://localhost:8080/mcp` for auto-discovery
4. Test with `tools/list`, `tools/call`, `prompts/list`, and `prompts/get`

### MCP Prompt Access Tools (Example Implementation)
The core library provides MCP prompts via `prompts/list` and `prompts/get` protocol methods. For programmatic access via tRPC/JSON-RPC, see the reference implementation in `examples/02-mcp-server/methods/prompt-access.js`:
- `getPrompts` - List all MCP prompts with metadata
- `getPromptTemplate` - Execute a prompt and get populated text

These are intentionally example-only to remain less opinionated. Copy to your custom routers as needed.

### tRPC Playground Zod Type Support
The playground automatically generates proper default values for all Zod types via `trpc-playground-fix.js`:

**Fully Supported Types:**
- ✅ Primitives: `ZodString`, `ZodNumber`, `ZodBoolean`, `ZodBigInt`, `ZodDate`
- ✅ Special Values: `ZodNull`, `ZodUndefined`, `ZodNaN`
- ✅ Complex Types: `ZodObject`, `ZodArray`, `ZodTuple`, `ZodRecord`
- ✅ Modifiers: `ZodOptional`, `ZodNullable`, `ZodDefault` (fixed!)
- ✅ Unions: `ZodUnion`, `ZodDiscriminatedUnion`, `ZodIntersection`
- ✅ Enums: `ZodEnum`, `ZodNativeEnum`
- ✅ Advanced: `ZodLazy`, `ZodLiteral`, `ZodMap`, `ZodSet`, `ZodPromise`

**Key Fix**: `ZodDefault` now properly extracts and uses actual default values (e.g., `.default(false)` → `false`, not empty string)

### AI-Free MCP Configuration
To use MCP without any AI interaction (automatically hides AI tools from MCP tools/list):
```typescript
const server = createRpcAiServer({
  mcp: {
    enabled: true,
    ai: {
      enabled: false          // Disables AI and automatically excludes AI tools from MCP
    }
  }
});
```
When `ai.enabled: false`, MCP clients only see non-AI tools (mcp.*, system.*, etc.) and cannot access any AI functionality.

### Configuration for Consuming Packages
When using the `simple-rpc-dev-panel` binary in consuming packages, the same environment variables work:

```bash
# In consuming package (works with binary)
TRPC_GEN_AI_ENABLED=false npx simple-rpc-dev-panel
TRPC_GEN_AI_ENABLED=false TRPC_GEN_MCP_AI_ENABLED=false npx simple-rpc-dev-panel

# Or when using the dev panel programmatically:
import { quickStartDevPanel } from 'simple-rpc-ai-backend/dev-panel';
process.env.TRPC_GEN_AI_ENABLED = 'false';
await quickStartDevPanel(8000);
```

## AI Provider Registry System

Uses `@anolilab/ai-model-registry` with intelligent curation:
- 1,700+ models from 33+ providers with automatic updates
- Smart curation extends registry with missing stable models
- Provider-specific handling (Google, Anthropic, OpenAI format conversion)
- Works offline with fallbacks

Registry tools: `pnpm registry:health`, `pnpm registry:check-updates`

## Testing

**Requirements**: 80% coverage, Node.js 22+, security-focused
**Test Types**: Unit, Integration, Security, Performance
**Run**: `pnpm test -- <filename>.test.ts`

### Known Issues
- `src/billing/opensaas-integration.ts`: TypeScript compilation errors
- `src/client.ts:398`: Replace demo hash with proper crypto
- Missing `rpc.discover` method implementation

## Platform Support
- **VS Code**: Primary target, OAuth authentication, server detection
- **Web**: Standard HTTP client, CORS support
- **CLI/Node.js**: Direct integration, full auth support

## Corporate Deployment
**Key Features**: Corporate proxy bypass, system prompt protection, zero client setup, centralized control
**Security**: AES-256-GCM encryption, OAuth authentication, session isolation

## MCP Integration: Dynamic tRPC Tool Exposure

### 🔀 MCP Roots vs Server Workspaces: Key Architecture Concepts

**Understanding the Distinction**: The Model Context Protocol separates client-managed roots from server-managed directories. This separation is crucial for proper MCP implementation and user control.

```
                  Model Context Protocol (MCP)

 ┌─────────────────────────────────────────────────────────────┐
 │                         CLIENT                              │
 │                                                             │
 │   User's local or mounted folders                           │
 │   (e.g. ~/projects, /mnt/shared/projectX)                   │
 │                                                             │
 │   • Client controls what to expose                          │
 │   • Advertises via MCP roots                                │
 │                                                             │
 │   roots/list  ────────────────────────────►                 │
 │                                                             │
 └─────────────────────────────────────────────────────────────┘
                 ▲
                 │
                 │ (MCP spec: server queries roots/list)
                 ▼
 ┌─────────────────────────────────────────────────────────────┐
 │                         SERVER                              │
 │                                                             │
 │   Server-managed directories                                │
 │   (e.g. /opt/templates, /srv/data, /home/server/project)    │
 │                                                             │
 │   • Configured in server config                             │
 │   • Exposed through tools (listFiles, readFile, etc.)       │
 │   • Not part of MCP roots                                   │
 │                                                             │
 │   serverWorkspaces / managedDirectories                     │
 │   (internal server concept)                                 │
 │                                                             │
 └─────────────────────────────────────────────────────────────┘
```

#### 🔑 Key Architectural Principles

**✅ MCP Roots (Client-Managed)**
- **Who owns it?** → The client
- **What for?** → To expose user-controlled locations (e.g. IDE workspace, local project folders)
- **How used?** → The server calls `roots/list` to discover what the client has exposed
- **Important** → The server should never configure or assume these; they are entirely under the user/client's control
- **MCP Spec Compliance** → Required part of the MCP spec to ensure servers ask users where they're allowed to operate
- **Capability Negotiation** → Client must advertise `{"roots": {"listChanged": true}}` during initialization
- **Error Handling** → Server returns `-32601 (Method not found)` if client doesn't support roots

**✅ Server Workspaces (Server-Managed)**
- **Who owns it?** → The server
- **What for?** → To expose the server's own resources (like `/opt/templates`, `/var/data`, `/home/server/project`)
- **How used?** → The server declares these in its own config and offers tools (`listFiles`, `readFile`) to interact with them
- **Important** → These are NOT MCP "roots" - they are a different concept because they don't come from the client

**🔀 Why They Must Be Kept Separate**
If you overload the word "roots" to mean both "client-exposed folders" and "server-exposed folders," it causes confusion:
- Clients will expect `roots/list` to reflect their workspace exposure
- But if a server stuffed its own folders in there, you'd mix two unrelated concerns

**📚 References**:
- [Model Context Protocol - Roots](https://modelcontextprotocol.io/docs/concepts/roots)
- [Complete Guide: Server Workspaces vs MCP Roots](./docs/common-configurations/server-workspaces-vs-mcp-roots.md)
- [Quick Reference: Workspace Concepts](./docs/WORKSPACE_QUICK_REFERENCE.md)

#### 🏷️ Configuration Example

```typescript
const server = createRpcAiServer({
  // Server-managed directories (not MCP roots)
  serverWorkspaces: {
    project: {
      path: '/home/user/project',
      name: 'Project Files',
      readOnly: false
    },
    templates: {
      path: '/opt/templates',
      name: 'Server Templates',
      readOnly: true
    }
  },

  // MCP roots are discovered dynamically via roots/list call to client
  mcp: {
    enabled: true,
    // Server will call client's roots/list to discover user workspaces
  }
});
```

### Model Context Protocol (MCP) Implementation Status: ✅ **COMPLETE**

**Current Status**: Full MCP server implementation with dynamic tRPC integration

### 🚀 Dynamic tRPC Method Handling for MCP Exposure

**Key Innovation**: tRPC procedures with `meta()` decorators are automatically exposed as MCP tools

#### **How to Add MCP Tools**
```typescript
// In any tRPC router - just add meta() with MCP information
newTool: publicProcedure
  .meta({
    mcp: {
      title: "Tool Name",
      description: "What this tool does",
      category: "utility"  // optional
    }
  })
  .input(z.object({ 
    param: z.string(),
    count: z.number().min(1).max(10)  // Validation constraints
  }))
  .mutation(async ({ input }) => {
    return `Result: ${input.param} (${input.count} times)`;
  })
```

#### **Automatic Discovery Process**
1. **Runtime Discovery**: Server scans all tRPC procedures for `meta.mcp` decorators
2. **Schema Generation**: Zod schemas → JSON Schema with full validation rules  
3. **Tool Registration**: Procedures become callable via MCP `tools/call`
4. **Validation Enforcement**: Input validation runs before execution

#### **Technical Implementation**
- **Discovery Method**: `discoverMCPToolsFromTRPC()` scans `router._def.procedures`
- **Schema Conversion**: Uses Zod's built-in `z.toJSONSchema` for proper constraint handling
- **Execution Path**: `procedure._def.resolver()` with input validation
- **Error Handling**: Zod validation errors → proper MCP error responses

#### **MCP Protocol Endpoints**
```typescript
// All endpoints automatically available at /mcp
POST /mcp  // MCP HTTP transport
{
  "method": "tools/list",     // → Dynamic discovery from tRPC
  "method": "tools/call",     // → Execute with validation
  "method": "initialize"      // → MCP handshake
}
```

### 🔧 **MCP Server Configuration**
```typescript
const server = createRpcAiServer({
  mcp: {
    enabled: true,
    auth: {
      requireAuthForToolsList: false,   // tools/list public by default
      requireAuthForToolsCall: true,    // tools/call requires auth
      publicTools: ['greeting']          // Exception list
    }
  }
});
```

### 📋 **Current MCP Tools Available**
- **greeting**: Generate friendly greetings with language support
- **echo**: Message repetition with transformation options
- **All tools**: Automatically discovered from tRPC router metadata

### 🎯 **MCP Benefits Realized**
- ✅ **Direct AI Integration**: Claude, ChatGPT, Gemini can discover and use tools
- ✅ **Zero Configuration**: Just add `meta()` to tRPC procedures
- ✅ **Full Validation**: Zod constraints enforced (`min/max`, `enum`, `required`)
- ✅ **Type Safety**: End-to-end TypeScript support
- ✅ **Authentication**: JWT-based protection with configurable public tools
- ✅ **Schema Compliance**: Proper JSON Schema generation for AI consumption

### 🤖 **AI-Powered Sampling & Elicitation**

**Key Feature**: Real AI integration with secure defaults and explicit opt-in controls.

#### **AI Sampling Configuration**
```typescript
const server = createRpcAiServer({
  mcp: {
    enabled: true,
    ai: {
      enabled: true,                    // Enable AI for MCP sampling tools (disabled by default)
      useServerConfig: true,            // Use same providers as ai.generateText
      restrictToSampling: true,         // Only sampling tools use AI (recommended)
      allowByokOverride: false          // Server keys only (secure default)
    }
  }
});
```

#### **Built-in AI Tools**
- **`generateWithApproval`**: AI content generation with MCP sampling protocol
  - Secure: Disabled by default, shows configuration help when AI not enabled
  - Real AI: Uses AIService with Vercel AI SDK for actual generation
  - Fallback: Graceful error handling with helpful fallback messages
  - Security: Uses server-configured API keys, not BYOK by default

- **`requestElicitation`**: User input/decision workflow support
  - No AI required: Pure workflow orchestration tool
  - Validation: Full input validation for confirmation, choice, input, approval types
  - Workflow: Demonstrates MCP elicitation protocol patterns

#### **Security-First Design**
```typescript
// AI disabled by default - explicit opt-in required
mcp: {
  ai: {
    enabled: false  // Default: Shows configuration help instead of AI generation
  }
}

// When enabled - secure server configuration (default)
mcp: {
  ai: {
    enabled: true,                    // Explicitly enable AI features
    useServerConfig: true,            // Use same providers/keys as ai.generateText
    restrictToSampling: true,         // Only sampling tools get AI (not general tools)
    allowByokOverride: false          // Server manages API keys (no BYOK for MCP)
  }
}
```

#### **MCP-Specific Configuration (useServerConfig: false)**
```typescript
// Independent MCP AI configuration - separate from main server
const server = createRpcAiServer({
  // Main server AI configuration (e.g., for ai.generateText)
  serverProviders: ['anthropic'],  // Premium provider for main API
  modelRestrictions: {
    anthropic: {
      allowedModels: ['claude-3-5-sonnet-20241022'] // Premium model
    }
  },

  mcp: {
    enabled: true,
    ai: {
      enabled: true,
      useServerConfig: false,         // Don't inherit from main server config

      // MCP-specific providers with different keys/models
      mcpProviders: {
        anthropic: {
          apiKey: process.env.MCP_ANTHROPIC_KEY,  // Different API key
          enabled: true,
          priority: 1,
          models: ['claude-3-5-haiku-20241022']   // Budget model for MCP
        },
        openai: {
          apiKey: process.env.MCP_OPENAI_KEY,
          enabled: true,
          priority: 2,
          models: ['gpt-4o-mini']                 // Budget model
        }
      },

      // MCP-specific AI service configuration
      aiServiceConfig: {
        defaultProvider: 'anthropic',
        maxTokens: 500,                // Lower limits for MCP tools
        temperature: 0.1,              // More deterministic for tool usage
        systemPrompts: {
          'sampling': 'You are a helpful assistant for MCP sampling tasks.'
        }
      },

      // MCP-specific model restrictions
      modelRestrictions: {
        anthropic: {
          allowedModels: ['claude-3-5-haiku-20241022'],
          blockedModels: ['claude-3-5-sonnet-20241022'] // Block expensive models
        }
      },

      restrictToSampling: true,
      allowByokOverride: false
    }
  }
});
```

#### **Use Cases for useServerConfig: false**
- **Cost Control**: Use budget models (haiku, gpt-4o-mini) for MCP tools vs premium models for main AI
- **Different Keys**: Separate billing/usage tracking between main AI and MCP functionality
- **Model Restrictions**: Restrict MCP to specific models while allowing full access for main AI
- **Performance Tuning**: Different temperature/token limits optimized for tool usage vs content generation

### 🔄 **Integration Architecture**
```typescript
// Unified server supports all protocols simultaneously
app.post('/rpc', handleJSONRPC);     // AI backend protocol
app.post('/trpc', handleTRPC);       // TypeScript client protocol
app.post('/mcp', handleMCP);         // Model Context Protocol

// Tools defined once, available everywhere:
// - tRPC: mcp.generateWithApproval, mcp.requestElicitation
// - JSON-RPC: mcp.generateWithApproval, mcp.requestElicitation
// - MCP: generateWithApproval, requestElicitation (auto-discovered)
```

### 🔐 **Security Integration**
- **System Prompt Protection**: MCP tools don't expose internal prompts
- **Corporate Proxy Friendly**: Standard HTTPS, no special requirements
- **OAuth Authentication**: Anonymous discovery → JWT authentication for execution
- **Input Validation**: All MCP tool calls validated against tRPC schemas

## Agent Skills System

The server includes a powerful skills system that allows AI agents to execute specialized tasks through sandboxed scripts. Skills provide reusable, documented capabilities that extend agent functionality.

### Built-in Skills

The following skills are included by default:

#### **file-handling**
Read, write, search, and manage files safely within the project root. Includes:
- `read.ts` - Read file contents with line-based offset/limit
- `grep.ts` - Search for regex patterns with context
- `search-files.ts` - Find files by glob patterns
- `validate-path.ts` - Validate paths are safe and accessible
- `delete.ts` - Delete files (requires user approval via user-interaction skill)

**Note**: When defining script arguments with command-line flags, use the `flag` field:
```yaml
args:
  - name: limit          # Property name in tool calls
    flag: --limit        # Actual command-line flag
    description: Max lines to read
    type: number
```

**File Deletion Safety**: The `delete.ts` script requires approval before execution (`requiresApproval: true`). When a user requests file deletion, the agent will:
1. Call `user_interaction_confirm` to ask for user permission
2. Wait for user confirmation (yes/no)
3. Only execute the deletion if approved
4. Validate the file exists before attempting deletion

#### **git-commit-helper**
Generate descriptive commit messages by analyzing git diffs and following conventional commits format.

#### **script-caller**
Execute workspace scripts with sandboxed runtimes (JavaScript, TypeScript, Python) in isolated environments.

#### **agent-creator**
Create and orchestrate specialized AI sub-agents that work together on complex tasks through sequential, parallel, or supervisor patterns.

#### **skill-creator**
Guide for creating effective skills with best practices for documentation, security, and integration.

### Using Skills in Agents

Skills are automatically loaded and converted to AI tools that agents can invoke:

```typescript
import { createRpcAiServer } from 'simple-rpc-ai-backend';

const server = createRpcAiServer({
  agents: {
    enabled: true,
    skills: {
      sources: [
        { type: 'builtin', name: 'file-handling' },
        { type: 'builtin', name: 'git-commit-helper' }
      ]
    }
  }
});
```

### Adding Custom Skills in Consuming Apps

Create custom skills by following the skill structure:

**1. Create skill directory:**
```
my-app/custom-skills/
  └── data-processor/
      ├── SKILL.md           # Metadata and documentation
      └── scripts/
          └── process.ts     # Executable script
```

**2. Define skill metadata (SKILL.md):**
```yaml
---
name: data-processor
description: Process and transform data files with validation
version: 1.0.0
capabilities:
  - data-processing
scripts:
  - path: scripts/process.ts
    runtime: typescript
    description: Process CSV data with validation
    args:
      - name: input-file
        description: Path to input CSV file
        type: string
        required: true
      - name: format
        flag: --format
        description: Output format (json|csv)
        type: string
        enum: [json, csv]
---

# Data Processor Skill

[Detailed documentation here...]
```

**3. Register with server:**
```typescript
import { createRpcAiServer } from 'simple-rpc-ai-backend';
import { join } from 'path';

const server = createRpcAiServer({
  agents: {
    enabled: true,
    skills: {
      sources: [
        // Built-in skills
        { type: 'builtin', name: 'file-handling' },

        // Custom local skill
        {
          type: 'local',
          path: join(process.cwd(), 'custom-skills/data-processor')
        }
      ]
    }
  }
});
```

**4. Agent automatically gets the tool:**
```typescript
const result = await client.agents.execute.mutate({
  messages: [{
    role: 'user',
    content: 'Process users.csv and convert to JSON format'
  }]
});

// Agent can now call: data_processor_process tool
// With args: { "input-file": "users.csv", "format": "json" }
```

### Working Directory Management

The server uses a temporary file approach to communicate the working directory to skill scripts, supporting multiple parallel instances without environment pollution.

**How it works:**
1. Each simple-agent instance creates a temp file: `/tmp/simple-agent-{randomId}-cwd`
2. File contains the absolute working directory path
3. Server reads from temp file and sets subprocess `cwd` accordingly
4. Cleanup happens automatically on server exit

**Key Benefits:**
- ✅ **Multiple parallel instances** - Each gets unique temp file
- ✅ **No environment pollution** - No global `PROJECT_ROOT` variable
- ✅ **Automatic cleanup** - Removed on server shutdown
- ✅ **Simple** - Just a file with a path

**Script Implementation:**
```typescript
// Skill scripts run with cwd set to project root
const PROJECT_ROOT = process.cwd();  // No env var needed!
const absolutePath = path.resolve(PROJECT_ROOT, './file.txt');
```

**Configuration:**
```typescript
import { CwdManager } from 'simple-rpc-ai-backend/tools/simple-agent/utils/cwd-manager';

// Create CWD manager
const cwdManager = new CwdManager('/home/user/project');
cwdManager.initialize();

const server = createRpcAiServer({
  agents: {
    skills: {
      sandbox: {
        cwdFilePath: cwdManager.getFilePath()  // Pass temp file path
      }
    }
  }
});

// Cleanup on exit
process.on('exit', () => cwdManager.cleanup());
```

**Inspired by:** Claude Code's temp file approach ([GH #8856](https://github.com/anthropics/claude-code/issues/8856))

### Skill Script Guidelines

**Argument Definition Best Practices:**
- Use `flag` field for command-line flags (e.g., `--limit`, `--format`)
- Use `name` field for the property name AI uses in tool calls
- Required positional arguments don't need flags
- Boolean flags typically don't need values

**Example:**
```yaml
# Positional argument (no flag)
- name: file-path
  type: string
  required: true

# Optional flag argument
- name: limit
  flag: --limit
  type: number
  description: Max items to process

# Boolean flag
- name: verbose
  flag: --verbose
  type: boolean
```

**Security:**
- Scripts run in sandboxed environments with restricted filesystem access
- Only project root and `/tmp` directories are accessible by default
- Network access is disabled unless explicitly allowed
- Memory and timeout limits enforced

### Skill Approval & Safety System

The skills system includes comprehensive safety and approval mechanisms to prevent destructive operations:

**Permission Allowlist** (Claude Code-style):
```typescript
const server = createRpcAiServer({
  agents: {
    skills: {
      sources: [{ type: 'builtin', name: 'file-handling' }],
      permissions: {
        allow: [
          'Bash(pnpm build:*)',
          'Read(/project/**)',
          'WebFetch(domain:github.com)'
        ],
        deny: ['Bash(rm -rf /)'],
        ask: ['Bash(git push:*)']
      },
      approvalCallback: async (request) => ({
        approved: true,
        rememberChoice: false
      })
    }
  }
});
```

**Safety Features:**
- **Critical Blocks**: Prevents `rm -rf /`, fork bombs, disk wiping, process attacks
- **Warning Patterns**: Requires approval for recursive deletion, permission changes
- **Network Safety**: POST/PUT/PATCH/DELETE require approval, GET is safe
- **Skill-Level Safety**: Configure safety in SKILL.md
- **Docker Testing**: Isolated environment for destructive command tests

**Safety Levels:**
```yaml
scripts:
  - path: scripts/dangerous.ts
    safety:
      level: critical  # low|medium|high|critical
      requiresApproval: true
      blockPatterns: ["rm.*critical"]
      dangerousArgs: ["--force"]
```

**Testing:**
```bash
# Run safety tests in Docker (isolated)
./scripts/test-safety-docker.sh

# Or manually
docker-compose -f test/agents/skills/safety/docker-compose.safety-test.yml up
```

**See also:**
- [Approval System Usage Guide](docs/agents/APPROVAL_SYSTEM.md) - How to configure and use
- [Technical Specification](specs/features/APPROVAL_SYSTEM.md) - Implementation details
- [Safety Test Plan](specs/test_plan/safety_approval_system.md) - Testing guide
- [User Interaction UI](docs/agents/USER_INTERACTION_UI.md) - Interactive dialogs in simple-agent CLI
- [Agent Skills Documentation](docs/agents/README.md) - Skills system overview
- [Skill Testing Guide](examples/03-agents-basic/custom-skills/hello-world/SKILL.md) - Create custom skills

### User Interaction UI (simple-agent CLI)

The simple-agent CLI provides interactive UI components for user interactions during agent execution. Agents can request user input through the `user-interaction` skill, which renders as interactive dialogs in the terminal.

**Available Interactions:**

**1. Select Dialog** - Choose from options with arrow keys
```typescript
// Agent calls user_interaction_select skill
{
  title: "Choose Action",
  options: ["Create file", "Edit file", "Delete file"],
  multiSelect: false  // or true for multi-select with Space bar
}
```

**2. Input Dialog** - Free-form text with optional AI interpretation
```typescript
// Agent calls user_interaction_input skill
{
  title: "Enter Filename",
  message: "What should we name the file?",
  enableAIInterpretation: true  // AI interprets responses like "yes but add X first"
}
```

**3. Confirm Dialog** - Yes/No with optional custom responses
```typescript
// Agent calls user_interaction_confirm skill
{
  message: "Create MyComponent.tsx?",
  enableAIInterpretation: true  // Allow custom responses with 'c' key
}
```

**AI Interpretation:**
When enabled, AI can interpret free-form user responses:
- "yes" → Direct approval
- "yes but add error handling first" → Conditional approval with prerequisite
- "don't do it" → Rejection
- "not now" → Postponement

**Keyboard Controls:**
- **↑↓** - Navigate options (Select/Confirm)
- **Space** - Toggle selection (multi-select mode)
- **y/n** - Quick yes/no (Confirm)
- **c** - Custom response (Confirm with AI interpretation)
- **Enter** - Submit
- **Esc** - Cancel
- **Backspace/Delete** - Edit text (Input mode)

**Example Usage:**
```typescript
// In agent system prompt:
const systemPrompt = `Use user_interaction tools to confirm actions:
- user_interaction_select: Choose from options
- user_interaction_input: Get user input (enable AI interpretation)
- user_interaction_confirm: Get confirmation (enable AI interpretation)

Always confirm before destructive operations.`;
```

**See:** [User Interaction UI Documentation](docs/agents/USER_INTERACTION_UI.md) for complete guide and examples.

## Security & Development Guidelines

**Security**: System prompt protection, AES-256-GCM encryption, no hardcoded secrets, input validation, rate limiting
**Contributing**: Security review required, 80% test coverage, TypeScript strict mode, comprehensive tests
**Pre-PR**: `pnpm build && pnpm test:coverage && pnpm typecheck`

## Key Principles
**Security**: System prompt protection, OAuth authentication, corporate proxy bypass
**Platform**: VS Code (primary), web, CLI support
**Architecture**: JSON-RPC compliance, MCP integration

## Current Status: ✅ Core Complete
- JSON-RPC server, PostgreSQL billing, AI service integration (Anthropic, OpenAI, Google)
- Platform-agnostic client, TypeScript compilation (0 errors), core tests

## MCP Troubleshooting

**UI Controls Not Working**: MCP clients may not send parameter changes. Avoid `.optional().default()` - make params required, handle defaults in code.

**Tools Not Discovered**: Check `mcp: { enabled: true }`, ensure `.meta({ mcp: {...} })` present, verify build success.

**Tool Execution Fails**: Check server logs for Zod validation errors, test via tRPC directly.

**Testing**: Use dev panel at `http://localhost:8080/mcp` or direct curl to `/mcp` endpoint.

## tRPC Playground Troubleshooting

**`SyntaxError: Unexpected token ')'`**: The tRPC Playground's execute button (▶️ Play) doesn't strip JavaScript comments before evaluation. **Workarounds**: (1) Add a blank line at the end of your code, (2) Use block comments `/* */` instead of line comments `//`, (3) Remove all comments, or (4) use the form inputs instead. This is a limitation of the third-party `trpc-playground` package.

## Core Reminders
- **System Prompt Protection**: Non-negotiable, corporate-friendly architecture
- **Platform Agnostic**: VS Code, web, CLI support required
- **MCP Integration**: Dynamic tRPC → MCP tool exposure via `meta()` decorators
- **Parameter Design**: Avoid `.optional().default()` for user-controllable MCP parameters
- **Skill Arguments**: Use `flag` field for command-line flags (not in `name` field) - see Agent Skills System section

# important-instruction-reminders
Do what has been asked; nothing more, nothing less.
NEVER create files unless they're absolutely necessary for achieving your goal.
ALWAYS prefer editing an existing file to creating a new one.
NEVER proactively create documentation files (*.md) or README files. Only create documentation files if explicitly requested by the User.
- ✅ **COMPLETED**: Add new JSON-RPC approach to memory - Implemented tRPC to JSON-RPC bridge extraction where JSON-RPC methods are dynamically extracted from tRPC methods, enabling dual protocol support on the same server
- ✅ **COMPLETED**: Comprehensive documentation of tRPC playground and MCP development panel
  - **Development Panel Suite**: Unified API explorer at `http://localhost:8080` with protocol integration
  - **tRPC Playground**: Type-safe testing with IntelliSense at `http://localhost:8080/api/trpc-playground`  
  - **MCP Jam Testing Tool**: Live MCP tool discovery and testing at `http://localhost:4000`
  - **Development Workflow**: 4-step process for adding and testing MCP tools
  - **Multi-Protocol Support**: tRPC, JSON-RPC, and MCP all accessible from one panel
- ✅ **COMPLETED**: Dynamic tRPC method handling for MCP exposure with metadata
  - **Key Feature**: tRPC procedures with `meta({ mcp: {...} })` automatically become MCP tools
  - **Discovery**: Runtime scanning of `router._def.procedures` for MCP metadata
  - **Validation**: Full Zod validation enforced via `inputParser.parse(args)`
  - **Schema**: Automatic Zod → JSON Schema conversion with constraints
  - **Execution**: Direct resolver calls with proper error handling
  - **Authentication**: JWT-based protection with configurable public tools
  - **Protocol**: Standard MCP HTTP transport at `/mcp` endpoint
- ✅ **COMPLETED**: Fixed all GitHub installation issues with comprehensive solution
  - **Problem 1**: `bcrypt` native module failed to build on Python 3.12+ due to missing `distutils`
  - **Solution 1**: Replaced `bcrypt` with pure JavaScript `bcryptjs` - no functionality loss
  - **Problem 2**: Missing JSON data files causing TypeScript build errors during postinstall
  - **Solution 2**: Fixed build order - assets copied **before** TypeScript compilation
  - **Problem 3**: Optional native dependencies (`cpu-features`, `ssh2`) causing install failures
  - **Solution 3**: Moved `@testcontainers/postgresql` to `optionalDependencies` + robust error handling
  - **Problem 4**: Build order issues in temporary GitHub install environment
  - **Solution 4**: Updated build script: `copy-assets → tsc → tsc-alias → build-methods`
  - **Benefits**: Zero native build dependencies, fault-tolerant asset copying, graceful optional deps
  - **Files Changed**: `package.json`, `src/services/APITokenManager.ts`, `.npmrc`, `scripts/safe-build.js`
  - **Requirements**: Node.js >=22.0.0 for tRPC compatibility
  - **Status**: GitHub installs now work reliably on all platforms with Python 3.8-3.13+
- ✅ **COMPLETED**: Agent Skills System documentation and bug fixes
  - **Documentation**: Comprehensive skills system guide added to CLAUDE.md
  - **Built-in Skills**: file-handling, git-commit-helper, script-caller, agent-creator, skill-creator
  - **Custom Skills**: Full guide for adding custom skills in consuming apps
  - **Bug Fix 1**: Fixed skill argument flag handling (use `flag` field, not prefix in `name`)
  - **Bug Fix 2**: Fixed UI line counting (trailing newline causing off-by-one error)
  - **Files Changed**: `SKILL.md` (file-handling), `ChatHistory.tsx`, `BUGFIX_FILE_LIMIT.md`
  - **Verification**: File limiting now works correctly (22 lines requested = 22 lines read)
  - **Guidelines**: Documented best practices for flag arguments, positional args, and boolean flags
- ✅ **COMPLETED**: Fixed double approval issue for file deletion
  - **Problem**: Agents were asking for permission twice - once manually, once via automatic safety system
  - **Solution**: Updated main-agent AGENT.md to clarify automatic approval behavior
  - **Key Changes**:
    - Added "Security & Automatic Approvals" section to main-agent AGENT.md
    - Enabled `requiresApproval: true` for file_handling_delete in SKILL.md
    - Updated delete.ts with better error messages (shows requested path and resolved path)
    - Documented file deletion safety workflow in CLAUDE.md
  - **How It Works Now**: Agent calls file_handling_delete directly → Safety system shows approval dialog → User approves/denies → Deletion proceeds if approved
  - **Files Changed**: `src/services/agents/builtin/main-agent/AGENT.md`, `src/services/agents/skills/builtin/file-handling/SKILL.md`, `src/services/agents/skills/builtin/file-handling/scripts/delete.ts`, `CLAUDE.md`
  - **Result**: Single approval dialog for file deletions, no redundant permission requests
- ✅ **COMPLETED**: Fixed duplicate tool call issue with server-side deduplication
  - **Problem**: AI models sometimes generate multiple identical tool calls in a single response, causing duplicate approval dialogs
  - **Solution**: Added deduplication logic in AIService tool execution loop (lines 651-670)
  - **How It Works**: Filters tool calls by signature (`toolName:JSON(args)`) before execution, keeping only first occurrence
  - **Benefits**: Single approval per unique tool call, no wasted API calls, works for all tools/providers
  - **Files Changed**: `src/services/ai/ai-service.ts`, `docs/bugfixes/DUPLICATE_TOOL_CALLS.md`
  - **Documentation**: Complete bug fix guide at [docs/bugfixes/DUPLICATE_TOOL_CALLS.md](docs/bugfixes/DUPLICATE_TOOL_CALLS.md)
  - **Result**: Zero duplicate approvals, clean tool execution logs
