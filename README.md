# Simple RPC AI Backend

> **🚀 One server for all your AI needs - supports JSON-RPC, tRPC, and MCP with configurable limits.**

[![codecov](https://codecov.io/gh/AWolf81/simple-rpc-ai-backend/branch/master/graph/badge.svg?token=LB25iUAO1h)](https://codecov.io/gh/AWolf81/simple-rpc-ai-backend)
[![Test Simple RPC AI Backend](https://github.com/AWolf81/simple-rpc-ai-backend/actions/workflows/test.yml/badge.svg)](https://github.com/AWolf81/simple-rpc-ai-backend/actions/workflows/test.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)

Secure, platform-agnostic AI backend with **system prompt protection** for enterprise environments. Works behind corporate firewalls with zero client-side configuration.

**Key Features:**
- 🔐 Server-side system prompts (no client exposure)
- 🌐 Multi-protocol: JSON-RPC, tRPC, MCP (Model Context Protocol)
- 🔑 Encrypted API key storage (AES-256-GCM)
- 🚀 Progressive authentication (anonymous → OAuth → Pro)
- 🏢 Corporate proxy bypass
- 🤖 1,700+ AI models from 33+ providers
- 🧩 Custom router extensions with MCP auto-discovery

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

## 📋 Installation

```bash
npm install simple-rpc-ai-backend
# or
pnpm add simple-rpc-ai-backend
```

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
    enableMCP: true,
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
    method: 'executeAIRequest',
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

const result = await client.ai.executeAIRequest.mutate({
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
    enableMCP: true,
    auth: {
      requireAuthForToolsList: false,    // Public discovery
      requireAuthForToolsCall: true      // Protected execution
    },
    ai: {
      enabled: true,                     // AI-powered tools
      useServerConfig: true,             // Inherit AI config
      restrictToSampling: true           // Security: sampling only
    }
  }
});
```

**MCP Roots vs Server Workspaces:**
- **MCP Roots**: Client-managed folders (user's workspace) - discovered via `roots/list`
- **Server Workspaces**: Server-managed directories (`/opt/templates`) - configured in server

See [docs/SERVER_WORKSPACES_VS_MCP_ROOTS.md](./docs/SERVER_WORKSPACES_VS_MCP_ROOTS.md)

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

**AI**: `executeAIRequest`, `health`  
**Auth**: `initializeSession`, `upgradeToOAuth`, `getAuthStatus`  
**BYOK**: `storeUserKey`, `getUserKey`, `validateUserKey`, `rotateUserKey`, `deleteUserKey`

## 🛠️ Development

```bash
pnpm dev:docs              # Start server + dev panel
pnpm build                 # Build TypeScript
pnpm test:coverage         # Run tests (80% threshold)
```

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

## 🤝 Contributing

Requirements: Node.js 22+, 80% coverage, TypeScript strict

```bash
pnpm build && pnpm test:coverage && pnpm typecheck
```

## 📄 License

MIT - see [LICENSE](./LICENSE)

## 💡 Why This Package?

**Problem**: Enterprise AI needs system prompt protection + corporate proxy bypass  
**Solution**: Server-side AI backend with encrypted keys + standard HTTPS  
**Use Cases**: VS Code extensions, web apps, CLI tools, MCP servers

---

**Built with [Claude Code](https://claude.ai/code)**
