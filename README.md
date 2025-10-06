# Simple RPC AI Backend

> **🚀 One server for all your AI needs - supports JSON-RPC, tRPC, and MCP with configurable limits.**

[![codecov](https://codecov.io/gh/AWolf81/simple-rpc-ai-backend/branch/master/graph/badge.svg?token=LB25iUAO1h)](https://codecov.io/gh/AWolf81/simple-rpc-ai-backend)
[![Test Simple RPC AI Backend](https://github.com/AWolf81/simple-rpc-ai-backend/actions/workflows/test.yml/badge.svg)](https://github.com/AWolf81/simple-rpc-ai-backend/actions/workflows/test.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)

Secure, platform-agnostic AI backend with **system prompt protection** for enterprise environments.

**🏷️ Status: Early Access (v0.1.0)** - Core features are functional and tested, but the API may evolve based on user feedback. Production use is possible but recommended with thorough testing in your environment first.

**Key Features:**
- 🔐 Server-side system prompts (no client exposure)
- 🌐 Multi-protocol: JSON-RPC, tRPC, MCP (Model Context Protocol)
- 🔑 Encrypted API key storage (AES-256-GCM)
- 🔒 OAuth authentication (Google, GitHub) for extensions and MCP
- 🏢 Corporate proxy bypass for client side apps
- 🤖 1,700+ AI models from 33+ providers
- 🧩 Custom router extensions with MCP auto-discovery

## 💡 Why This Package?

**Problem**: Client-side AI exposes system prompts through network inspection, proxies, or browser DevTools
**Solution**: Server-side AI backend keeps prompts secure + works with any network environment
**Use Cases**: VS Code extensions, web apps, CLI tools, MCP servers

## 🛠️ Consumer Tools

The package includes these binaries for development and deployment:

### `simple-rpc-dev-panel`
**Interactive API explorer with live testing**
- 📊 Visual interface for all tRPC procedures
- 🎮 Live tRPC playground with IntelliSense
- 🔍 MCP scanner for security analysis (Alpha - experimental)
- 📝 Auto-generated API documentation

```bash
npx simple-rpc-dev-panel
# Opens at http://localhost:8080
```

Config via `.simplerpcaibackendrc`:
```json
{
  "devPanel": {
    "port": 8080,
    "autoOpenBrowser": true
  }
}
```

### `simple-rpc-gen-methods`
**Generate tRPC method documentation**
- 🔧 Configurable router filtering
- 📄 Generates `dist/trpc-methods.json` for dev panel
- 🎯 Smart defaults (AI + MCP enabled)

```bash
npx simple-rpc-gen-methods
```

Config via `.simplerpcaibackendrc`:
```json
{
  "trpcMethodGen": {
    "customRoutersPath": "./methods/index.js",
    "enableAI": true,
    "enableMCP": true,
    "enableSystem": false
  }
}
```

### `check-mcp-security` (Experimental)
**Scan MCP servers for security issues**
- 🔒 Detects unsafe tool configurations
- ⚠️ Identifies potential data leaks
- 📋 Generates security reports

```bash
npx check-mcp-security --url http://localhost:8000/mcp
```

**Status:** Experimental - Not recommended for production use yet. Use dev panel MCP scanner (Alpha) for interactive testing.

### Screenshots

**Dev Panel - API Explorer**
![Dev Panel Screenshot](https://raw.githubusercontent.com/AWolf81/simple-rpc-ai-backend/master/docs/images/dev_panel_screenshot_2025-10-04%2023-07-11.png)
*Interactive API explorer with live testing and auto-generated documentation*

**tRPC Playground**
![tRPC Playground Screenshot](https://raw.githubusercontent.com/AWolf81/simple-rpc-ai-backend/master/docs/images/trpc_playground_screenshot_2025-10-04%2023-11-12.png)
*Type-safe tRPC testing with IntelliSense and full custom router support*
→ [sachinraja/trpc-playground](https://github.com/sachinraja/trpc-playground)

**MCP Inspector (MCP Jam)**
![MCP Jam Screenshot](https://raw.githubusercontent.com/AWolf81/simple-rpc-ai-backend/master/docs/images/mcp_jam_screenshot_2025-10-04%2023-09-28.png)
*Live MCP tool discovery and testing with protocol compliance verification*
→ [MCPJam/inspector](https://github.com/MCPJam/inspector)

---

## 🎯 Reference Projects

### MCP Browser Playground *(Coming Soon)*
**Live browser preview with AI chat integration**

An MCP server that bridges AI chat clients with CodeSandbox, providing live browser previews directly in your development workflow.

**Features:**
- 🌐 Connect any AI chat client to CodeSandbox via MCP
- 👀 Live browser preview in a browser extension
- 🔧 Real-time code editing with instant feedback
- 🤖 AI-powered development workflow

**Repository:** *(Link will be added soon)*

Built with `simple-rpc-ai-backend` to demonstrate:
- Custom MCP server implementation
- Browser extension integration
- Real-time collaboration features
- AI-powered development tools

---

## 📋 Development Roadmap

### ✅ Completed
- [x] JSON-RPC server
- [x] tRPC methods
- [x] AI service integration
- [x] Dev panel + playgrounds (OpenRPC + tRPC playground)
- [x] MCP protocol implementation
- [x] MCP OAuth authentication
- [x] Extension OAuth (generic OAuth callback handler)
- [x] `.simplerpcaibackendrc` configuration file
- [x] Consumer-friendly defaults and tooling

### 🔄 In Progress
- [ ] Progressive authentication (anonymous → OAuth → Pro) for VS Code extensions
- [ ] Bring-your-own key testing (CRUD and usage)
- [ ] MCP remote servers support
- [ ] Billing & token tracking system
- [ ] OpenSaaS JWT handling for user auth
- [ ] PostgreSQL for billing persistence
- [ ] MCP security scanner improvements (dev panel + bin tool)
- [ ] Test examples 03 to 07 - mainly worked with example 02-mcp-server
- [ ] Test coverage increase (→ 60% - 80%+)
- [ ] API stability for 1.0.0 release

## 🚀 Quick Start

```typescript
import { createRpcAiServer } from 'simple-rpc-ai-backend';

// Basic setup
const server = createRpcAiServer({
  ai: {
    providers: {
      anthropic: { apiKey: process.env.ANTHROPIC_API_KEY },
      openai: { apiKey: process.env.OPENAI_API_KEY }
    }
  }
});
await server.start();
// Server running at http://localhost:8000
```

**Try it with curl:**

```bash
curl -X POST http://localhost:8000/rpc \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "ai.generateText",
    "params": {
      "content": "Explain quantum computing in simple terms",
      "provider": "anthropic",
      "model": "claude-3-5-sonnet-20241022"
    },
    "id": 1
  }'
```

**Example Response:**

```json
{
  "jsonrpc": "2.0",
  "result": {
    "text": "Quantum computing is a new type of computing that uses the principles of quantum mechanics...",
    "usage": {
      "inputTokens": 12,
      "outputTokens": 156,
      "totalTokens": 168
    },
    "model": "claude-3-5-sonnet-20241022",
    "provider": "anthropic",
    "finishReason": "stop"
  },
  "id": 1
}
```

## 📋 Installation

```bash
npm install simple-rpc-ai-backend
# or
pnpm add simple-rpc-ai-backend
```

## 🧰 Troubleshooting

- **Error**: `Error [ERR_PACKAGE_PATH_NOT_EXPORTED]: No "exports" main defined ...` with stack frames from `node:internal/modules/esm/resolve` while running under `tsx`
- **Why**: When the consuming project lacks `"type": "module"` in `package.json`, `tsx` falls back to CommonJS resolution and Node cannot load this package's ESM export map
- **Fix**: Opt the consuming server into ESM by declaring `"type": "module"` in its `package.json`, or otherwise run the code in an ESM runtime

```jsonc
// package.json
{
  "name": "your-server",
  "type": "module",
  "dependencies": {
    "simple-rpc-ai-backend": "^0.1.4"
  }
}
```

- **Next**: Restart the process (or rerun `tsx ...`) so Node picks up the module type change

### Base Package Routers

The installed package includes these core routers (50 procedures, 19 MCP tools):

- **ai.*** - AI generation, model management, providers
- **mcp.*** - Model Context Protocol tools and resources
- **system.*** - File operations, workspace management
- **admin.*** - Server status, health checks, configuration
- **auth.*** - Authentication and session management
- **billing.*** - Usage analytics, virtual tokens
- **user.*** - User management, API keys (BYOK)

### Custom Routers (Examples Only)

Custom routers like `math.*`, `utility.*`, `file.*`, and `prompts.*` are provided as **examples** in the `examples/` directory. Copy them to your project or create your own:

```typescript
import { router, publicProcedure } from 'simple-rpc-ai-backend';

const mathRouter = router({
  add: publicProcedure
    .input(z.object({ a: z.number(), b: z.number() }))
    .mutation(({ input }) => ({ result: input.a + input.b }))
});

const server = createRpcAiServer({
  customRouters: { math: mathRouter }
});
```

See `examples/02-mcp-server/methods/` for reference implementations.

## 🎯 Usage Examples

### Server Setup

```typescript
import { createRpcAiServer, AI_LIMIT_PRESETS } from 'simple-rpc-ai-backend';

const server = createRpcAiServer({
  port: 8000,
  ai: {
    providers: {
      anthropic: { apiKey: process.env.ANTHROPIC_API_KEY },
      openai: { apiKey: process.env.OPENAI_API_KEY }
    }
  },
  aiLimits: AI_LIMIT_PRESETS.standard,
  mcp: {
    enabled: true,
    ai: { enabled: true, useServerConfig: true }
  }
});

await server.start();
```

### JSON-RPC Client (Universal)

```typescript
const response = await fetch('http://localhost:8000/rpc', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    jsonrpc: '2.0',
    method: 'ai.generateText',
    params: {
      content: 'Explain quantum computing',
      systemPrompt: 'You are a physics teacher',
      provider: 'anthropic'
    },
    id: 1
  })
});
```

### tRPC Client (TypeScript)

```typescript
import { createTypedAIClient } from 'simple-rpc-ai-backend';
import { httpBatchLink } from '@trpc/client';

const client = createTypedAIClient({
  links: [httpBatchLink({ url: 'http://localhost:8000/trpc' })]
});

const result = await client.ai.generateText.mutate({
  content: 'Explain quantum computing',
  provider: 'anthropic'
});
```

### Custom MCP Tools

```typescript
import { createRpcAiServer, router, publicProcedure, createMCPTool } from 'simple-rpc-ai-backend';
import { z } from 'zod';

const mathRouter = router({
  add: publicProcedure
    .meta(createMCPTool({ name: 'add', description: 'Add numbers' }))
    .input(z.object({ a: z.number(), b: z.number() }))
    .query(({ input }) => ({ result: input.a + input.b }))
});

const server = createRpcAiServer({
  customRouters: { math: mathRouter }
});
// Auto-exposed via tRPC, JSON-RPC, and MCP
```

#### Working with complex MCP tools (`getPromptTemplate`)

Some tools expose nested arguments that are awkward for current MCP clients. The reference prompt tools in [`examples/02-mcp-server/methods/prompt-access.js`](examples/02-mcp-server/methods/prompt-access.js) show a reliable call sequence:

1. **Discover prompts** – call `getPrompts` via `tools/call` to list available prompt IDs plus example invocations.
   ```jsonc
   {
     "jsonrpc": "2.0",
     "method": "tools/call",
     "params": {
       "name": "getPrompts",
       "arguments": {}
     },
     "id": 1
   }
   ```

2. **Inspect a prompt** – call `getPromptTemplate` with just the `name`. The response includes `template`, `variables`, and `exampleArguments` to guide the final request.
   ```jsonc
   {
     "jsonrpc": "2.0",
     "method": "tools/call",
     "params": {
       "name": "getPromptTemplate",
       "arguments": { "name": "explain-concept" }
     },
     "id": 2
   }
   ```

3. **Render the prompt** – send the same call again with `argumentsJson` populated using the guidance from step 2.
   ```jsonc
   {
     "jsonrpc": "2.0",
     "method": "tools/call",
     "params": {
       "name": "getPromptTemplate",
       "arguments": {
         "name": "explain-concept",
         "argumentsJson": "{\"concept\":\"event loop\",\"level\":\"beginner\",\"includeExamples\":\"yes\"}"
       }
     },
     "id": 3
   }
   ```

Following this pattern makes it easy for an AI agent to self-discover complex prompts, read the built-in usage notes, and only send structured arguments once it knows exactly what the tool expects.

## 🔐 API Key Management

### PostgreSQL (Production)

```typescript
const server = createRpcAiServer({
  secretManager: {
    type: 'postgres',
    connection: { host: 'localhost', database: 'aikeys' }
  }
});
```

### File Storage (Development)

```typescript
const server = createRpcAiServer({
  secretManager: {
    type: 'file',
    filePath: './keys/user-keys.json'
  }
});
```

## 🔧 Model Context Protocol (MCP)

MCP enables AI assistants to discover and use your tools automatically.

```typescript
// Add MCP metadata to any tRPC procedure
greet: publicProcedure
  .meta({ mcp: { title: "Greeting", description: "Generate greetings" } })
  .input(z.object({ name: z.string() }))
  .mutation(({ input }) => ({ message: `Hello, ${input.name}!` }))
```

**MCP Configuration:**

```typescript
const server = createRpcAiServer({
  mcp: {
    enabled: true,                       // Enable MCP server
    auth: {
      requireAuthForToolsList: false,    // Public discovery
      requireAuthForToolsCall: true      // Protected execution
    },
    ai: {
      // AI-Powered MCP Tools Configuration
      enabled: false,                    // Default: false - explicit opt-in required
      useServerConfig: true,             // Default: true - use same AI providers as ai.generateText
      restrictToSampling: true,          // Default: true - only MCP sampling tools can use AI
      allowByokOverride: false           // Default: false - server API keys only (secure)
    }
  }
});
```

**MCP AI Tools - What They Do:**
- **When `ai.enabled: false`** (default): MCP protocol works, but AI-powered tools are disabled
  - ❌ `generateWithApproval` - Shows helpful error with config instructions
  - ✅ `requestElicitation` - Works (no AI needed, pure workflow)
  - ✅ All other MCP tools - Work normally

- **When `ai.enabled: true`**: Enables AI content generation via MCP sampling protocol
  - ✅ `generateWithApproval` - Real AI generation using server's configured providers
  - `restrictToSampling: true` - Only MCP sampling tools use AI (recommended for security)
  - `useServerConfig: true` - Uses same API keys/providers as `ai.generateText`
  - `allowByokOverride: false` - Prevents BYOK API keys in MCP calls (secure default)

**When to Use:**
- **Most apps**: Keep `ai.enabled: false` - MCP protocol without AI-powered generation
- **AI workflows**: Set `ai.enabled: true` - Enable MCP sampling for AI content generation
- **Cost control**: Use `useServerConfig: false` + `mcpProviders` to set budget models for MCP

**MCP Roots vs Server Workspaces:**
- **MCP Roots**: Client-managed folders (user's workspace) - discovered via `roots/list`
- **Server Workspaces**: Server-managed directories (`/opt/templates`) - configured in server

See [docs/SERVER_WORKSPACES_VS_MCP_ROOTS.md](./docs/SERVER_WORKSPACES_VS_MCP_ROOTS.md)

## 📊 Performance Benchmarks

### AI Generation Performance (ai.generateText)

**Test Configuration:**
- **Request**: "Hey there, nice to meet you" (27 chars)
- **System Prompt**: "default" → "You are a helpful AI assistant." (36 chars)
- **Provider**: Anthropic Claude 3.7 Sonnet (claude-3-7-sonnet-20250219)
- **Hardware**: AWOW AK10 Pro Mini PC
  - CPU: Intel N100 (4 cores, up to 3.4 GHz)
  - RAM: 16GB DDR4
  - Storage: 1TB NVMe SSD
  - OS: Ubuntu 25.04 (Kernel 6.14.0)

**Timing Breakdown:**
```
┌─ JSON-RPC Request Parsing          0.71 ms  (0.05%)
├─ tRPC Procedure Resolution         0.07 ms  (0.00%)
├─ AI Service Initialization         6.87 ms  (0.46%)
│  ├─ Request Validation             0.04 ms
│  ├─ Model Retrieval                6.09 ms
│  └─ Execution Preparation          0.16 ms
├─ Anthropic API Call            1,477.06 ms (99.24%)
└─ Response Formatting               0.64 ms  (0.04%)

Total Request Time:              1,488.40 ms
Server Overhead:                     8.29 ms  (0.56%)
```

**Key Findings:**
- ✅ **Server overhead**: <10ms (0.56% of total time)
- ✅ **AI API bottleneck**: 99.24% of time waiting for provider response
- ✅ **Efficient routing**: tRPC v11 caller + JSON-RPC bridge = 0.71ms
- ✅ **Scalable**: Server can handle 100+ concurrent requests (I/O bound, not CPU bound)

**Performance Validation (Cost-Free):**

```bash
# 1. Test server overhead only (no AI API calls)
curl -X POST http://localhost:8000/rpc \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"system.health","id":1}'
# Expected: <5ms response time

# 2. Load test - Health endpoint (baseline performance)
# Install: sudo apt-get install apache2-utils (Ubuntu/Debian)
#          brew install apache2 (macOS)
ab -n 1000 -c 100 http://localhost:8000/health
# Expected: ~3000 req/sec (0.32ms per request)
# Actual result: 3128 req/sec on Intel N100

# 3. Load test - Simulated AI delay (realistic AI scenario)
# Create post.json: echo '{"jsonrpc":"2.0","method":"test.simulateAI","params":{},"id":1}' > post.json
ab -n 100 -c 10 -p post.json -T application/json http://localhost:8000/rpc
# Expected: ~6.5 req/sec with 10 concurrent (limited by 1.5s simulated delay)
# Actual result: 6.04 req/sec, 1504ms avg (1500ms delay + 4ms overhead = 0.27%)
# This tests server behavior under realistic AI workload without API costs

# 4. Test tRPC procedure resolution
curl http://localhost:8000/trpc/admin.healthCheck
# Expected: <10ms response time

# 5. Memory profiling (watch for leaks during sustained load)
node --expose-gc --max-old-space-size=512 examples/01-basic-server/server.js
# Monitor with: watch -n 1 'ps aux | grep node | grep -v grep'
# Or: watch -n 2 'ps -o pid,rss,cmd -p $(pgrep node)'
```

**Production Considerations:**
- **Parallel Requests**: Server can handle 100+ concurrent AI requests (66 req/sec with 1.5s latency)
- **Real Bottleneck**: AI provider rate limits (typically 50-100 req/min = 1.67 req/sec max)
- **Sequential Requests**: No memory leaks, clean async/await execution
- **Rate Limiting**: Add `express-rate-limit` to prevent API quota exhaustion (429 errors)
- **Monitoring**: Track `x-ratelimit-remaining` headers from AI providers

**Throughput Math:**
```
10 concurrent requests  / 1.5s latency = 6.67 req/sec
100 concurrent requests / 1.5s latency = 66.67 req/sec (theoretical)
But: Anthropic limits ~100 req/min = 1.67 req/sec (actual production limit)
```

## 🐛 Debug & Performance Monitoring

### Enable Performance Timing Logs

Track detailed performance metrics for debugging and optimization:

```bash
# Via environment variable (recommended for development)
ENABLE_TIMING=true pnpm dev:server:basic

# Via server configuration
const server = createRpcAiServer({
  debug: {
    enableTiming: true  // Enable detailed timing logs
  }
});
```

**Example timing output:**
```
[TIMING-RPC] ┌─ Started at 2025-10-02T06:15:00.423Z
[TIMING-RPC] ├─ Request parsed: 0.10ms (total: 0.10ms)
[TIMING-RPC] ├─ Context created: 0.29ms (total: 0.39ms)
[TIMING-RPC] ├─ Caller created: 0.22ms (total: 0.61ms)
[TIMING-RPC] ├─ Procedure resolved: 0.10ms (total: 0.71ms)
  [TIMING-AI] ┌─ Started
  [TIMING-AI] ├─ Input parsed: 0.10ms (total: 0.10ms)
  [TIMING-AI] ├─ Calling aiService.execute: 0.05ms (total: 0.15ms)
    [TIMING-SERVICE] ┌─ Started
    [TIMING-SERVICE] ├─ Request validation: 0.06ms (total: 0.06ms)
    [TIMING-SERVICE] ├─ Model retrieved: 6.70ms (total: 6.75ms)
    [TIMING-SERVICE] ├─ Prepared AI execution: 0.51ms (total: 7.26ms)
    [TIMING-SERVICE] ├─ Calling generateText (Vercel AI SDK): 0.52ms (total: 7.78ms)
    [TIMING-SERVICE] ├─ generateText completed: 1538.23ms (total: 1546.01ms)
    [TIMING-SERVICE] └─ Total time: 1546.14ms
  [TIMING-AI] ├─ AI execution completed: 1546.90ms (total: 1547.04ms)
  [TIMING-AI] └─ Total time: 1547.12ms
[TIMING-RPC] ├─ Procedure ai.generateText executed: 1548.27ms (total: 1548.56ms)
[TIMING-RPC] ├─ Response sent: 0.56ms (total: 1549.12ms)
[TIMING-RPC] └─ Total time: 1549.18ms
```

**Timing Breakdown:**
- **RPC layer**: 0.71ms routing overhead
- **AI procedure**: 0.15ms parameter parsing
- **SERVICE layer**: 7.26ms model setup + 1538ms Anthropic API call
- **Total server overhead**: ~8ms (0.5% of request time)

**Use Cases:**
- **Performance Analysis**: Identify bottlenecks in your request pipeline
- **Load Testing**: Monitor timing during sustained load tests
- **Production Debugging**: Enable temporarily to diagnose slow requests
- **Optimization**: Validate improvements after code changes

**Verbose Debug Logs:**

Control verbose debug logs (🔍, 🔧, 📝) via LOG_LEVEL environment variable:

```bash
# Show all debug logs (verbose)
LOG_LEVEL=debug pnpm dev

# Show only info and above (production default)
LOG_LEVEL=info pnpm dev

# Show only warnings and errors
LOG_LEVEL=warn pnpm dev
```

```typescript
const server = createRpcAiServer({
  debug: {
    enableTiming: true        // Performance timing only
  }
});
```

**⚠️ Important:**
- Timing logs add minimal overhead (<0.1ms) but generate significant console output
- Verbose logs show model selection, provider config, deprecation warnings
- Disable both in production unless actively debugging

## ⚙️ Configuration

### AI Limit Presets

```typescript
import { AI_LIMIT_PRESETS } from 'simple-rpc-ai-backend';

aiLimits: AI_LIMIT_PRESETS.minimal      // 10KB, 1-4K tokens
aiLimits: AI_LIMIT_PRESETS.standard     // 500KB, 1-32K tokens (default)
aiLimits: AI_LIMIT_PRESETS.developer    // 1MB, 1-128K tokens
aiLimits: AI_LIMIT_PRESETS.enterprise   // 5MB, 1-200K tokens
```

### Environment Variables

```bash
# Required
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...

# Optional
PORT=8000
LOG_LEVEL=info                    # silent|error|warn|info|debug
TRPC_GEN_AI_ENABLED=true          # Include AI methods
TRPC_GEN_MCP_ENABLED=true         # Include MCP methods
```

## 📚 Key Methods

**AI**: `ai.generateText`, `health`  
**Auth**: `initializeSession`, `upgradeToOAuth`, `getAuthStatus`  
**BYOK**: `storeUserKey`, `getUserKey`, `validateUserKey`, `rotateUserKey`, `deleteUserKey`

## 🛠️ Development

### Build Commands

```bash
pnpm build                 # Base build (50 procedures, no custom routers)
pnpm build:mcp            # Build with example 02 custom routers (61 procedures)
pnpm build:basic          # Build with example 01 routers (minimal)
```

**What gets built:**
- **Base** (`pnpm build`): Only core package routers (ai, mcp, system, admin, auth, billing, user)
- **MCP** (`pnpm build:mcp`): Base + custom example routers (math, utility, file, prompts)
- **Basic** (`pnpm build:basic`): Base + test router only

This ensures the package distribution (`npm install`) only includes base routers, while contributors can build with examples for testing.

### Development Servers

```bash
pnpm dev:docs              # Start server + dev panel
pnpm dev:server:basic      # Basic AI server (port 8000)
pnpm dev:server            # Full MCP server (port 8001)
pnpm test:coverage         # Run tests (80% threshold)
```

> 💡 Tip: If you use Husky pre-commit hooks, install GitGuardian's CLI with `pipx install ggshield` (or a dedicated virtualenv) so secret scans run locally without touching the system Python.

**Dev URLs:**
- Dev Panel: `http://localhost:8080`
- tRPC Playground: `http://localhost:8080/api/trpc-playground`
- MCP Inspector: `http://localhost:8080/mcp`

## 🔄 Protocol Comparison

| Feature | JSON-RPC | tRPC | MCP |
|---------|----------|------|-----|
| **Language** | Any | TypeScript | Any |
| **Type Safety** | Runtime | Compile-time | Runtime |
| **AI Discovery** | ❌ | ❌ | ✅ |
| **Use Case** | Universal | TypeScript | AI tools |

## 🔐 Security

- ✅ System prompts server-side only
- ✅ AES-256-GCM encrypted keys
- ✅ JWT authentication
- ✅ Rate limiting per IP
- ✅ Input validation (Zod)
- ✅ Corporate proxy friendly

## 📖 Documentation

- [Server Workspaces vs MCP Roots](./docs/SERVER_WORKSPACES_VS_MCP_ROOTS.md)
- [CLAUDE.md](./CLAUDE.md) - Developer guide
- [API Docs](http://localhost:8080) - Interactive explorer

## ⚠️ Status

**Alpha** - Core complete, API may change

**Production Ready**: JSON-RPC, AI service, PostgreSQL, MCP, auth
**In Progress**: OAuth, billing, test coverage (60%+ → 80%)

## 📋 TODO

### Tests & Implementation
- [ ] **Hugging Face Provider**: Fix and complete implementation
  - [ ] Fix `huggingfaceMethod` config not being respected (always uses textGeneration)
  - [ ] Fix test mocks for proper chatCompletion testing
  - [ ] Complete test coverage for textGeneration/chatCompletion modes
  - [ ] Verify fallback behavior works correctly
  - Files: `src/services/ai/ai-service.ts` (lines 43-146), `test/huggingface-provider*.test.ts`

- [ ] **Model Restrictions**: Update tests for hybrid registry architecture
  - [ ] Fix Anthropic tests to use hybrid registry instead of fallbacks
  - [ ] Update OpenRouter model expectations (returning empty arrays)
  - [ ] Verify model filtering works with new registry system
  - Files: `test/model-restrictions.test.ts`, `src/services/ai/model-registry.ts` (line 370)

### Core Features
- [ ] **Model Registry Safety**: Review curated model additions in `src/services/ai/hybrid-model-registry.ts`
  - Ensure production IDs are correct for new Gemini, GPT-4.5, and o3 models

- [ ] **OAuth Flow Documentation**: Add MCP OAuth authentication flow diagram to docs

- [ ] **Test Coverage**: Increase from 60% to 80% threshold (see `vitest.config.ts`)

- [ ] **Billing Integration**: Complete OpenSaaS integration in `src/billing/opensaas-integration.ts`

## 🤝 Contributing

Requirements: Node.js 22+, 80% coverage, TypeScript strict

```bash
pnpm build && pnpm test:coverage && pnpm typecheck
```

## 📄 License

MIT - see [LICENSE](./LICENSE)

---

**Built with [Claude Code](https://claude.ai/code)**
