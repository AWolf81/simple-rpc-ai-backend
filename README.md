# Simple RPC AI Backend

> **🚀 One server for all your AI needs – JSON-RPC, tRPC, and MCP with secure prompt management and per-provider guardrails.**

[![codecov](https://codecov.io/gh/AWolf81/simple-rpc-ai-backend/branch/master/graph/badge.svg?token=LB25iUAO1h)](https://codecov.io/gh/AWolf81/simple-rpc-ai-backend)
[![Test Simple RPC AI Backend](https://github.com/AWolf81/simple-rpc-ai-backend/actions/workflows/test.yml/badge.svg)](https://github.com/AWolf81/simple-rpc-ai-backend/actions/workflows/test.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)

Secure, platform-agnostic AI backend with **system prompt protection** for enterprise environments.

**🏷️ Status: Early Access (v0.1.x)** – Core features are functional and tested, but the API may evolve based on user feedback. Production use is possible with thorough validation in your environment first.

**Highlights**
- 🔐 Server-side system prompts (no client exposure)
- 🌐 Multi-protocol: JSON-RPC, tRPC, MCP (Model Context Protocol)
- 🔑 Encrypted API key storage (AES-256-GCM) + BYOK support
- 🔒 OAuth providers (Google, GitHub) for extensions and MCP clients
- 🏢 Corporate proxy aware (dev panel + CLI)
- 🤖 1,700+ AI models from 33+ providers
- 🧩 Custom router extensions with automatic MCP tool discovery

👉 **Need the full documentation?** Visit **[📖 Documentation](https://awolf81.github.io/simple-rpc-ai-backend/)** or run `pnpm jekyll:dev` for a local preview.

---

## 💡 Why This Package?

- **The problem:** Client-side AI integrations leak system prompts and API keys through DevTools, proxies, or request inspection.
- **The solution:** Move orchestration to a server that locks prompts behind JSON-RPC/tRPC endpoints, logs usage, and enforces rate limits per provider.
- **Where it shines:** VS Code extensions, MCP servers, browser tooling, internal dashboards, and any environment that needs secure prompt management with multi-provider support.

---

## 🚀 Quick Start (Package Consumers)

Install the server into your app and start serving AI requests in minutes.

```bash
pnpm add simple-rpc-ai-backend
```

Create a minimal server with custom tRPC routes (TypeScript):

```ts
import { createRpcAiServer, router, publicProcedure } from 'simple-rpc-ai-backend';
import { z } from 'zod';

const mathRouter = router({
  add: publicProcedure
    .input(z.object({ a: z.number(), b: z.number() }))
    .mutation(({ input }) => ({ result: input.a + input.b })),
  multiply: publicProcedure
    .input(z.object({ a: z.number(), b: z.number() }))
    .mutation(({ input }) => ({ result: input.a * input.b }))
});

const utilsRouter = router({
  ping: publicProcedure.query(() => ({ pong: true })),
  echo: publicProcedure
    .input(z.object({ message: z.string() }))
    .mutation(({ input }) => ({ message: input.message }))
});

const customRouter = router({
  // Add domain-specific procedures here
});

const server = createRpcAiServer({
  port: Number(process.env.SERVER_PORT ?? 8000),
  serverProviders: ['anthropic', 'openai'],
  mcp: { enabled: true },
  customRouters: {
    math: mathRouter,
    utils: utilsRouter,
    custom: customRouter
  }
});

await server.start();
```

Call it with JSON-RPC:

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

For local development inside this repository (contributors/maintainers), see the **[Developer Guide](https://awolf81.github.io/simple-rpc-ai-backend/developer/)**.

---

## 🛠️ Consumer Tools

`simple-rpc-dev-panel` – **Interactive API explorer**  
- 📊 Visual interface for all tRPC procedures  
- 🎮 Live tRPC playground with IntelliSense  
- 🔍 MCP scanner for security analysis (Alpha)  
- 📝 Auto-generated API documentation  

```bash
npx simple-rpc-dev-panel
# Opens http://localhost:8080 by default
```

`simple-rpc-gen-methods` – **Generate tRPC method metadata**  
- 🔧 Configurable router filtering  
- 📄 Generates `dist/trpc-methods.json` for the dev panel  
- 🎯 Smart defaults (AI + MCP enabled)  

```bash
npx simple-rpc-gen-methods
```

`check-mcp-security` (Experimental) – **Scan MCP servers for security gaps**  
- 🔒 Detect unsafe tool configurations  
- ⚠️ Flag risky file access patterns  
- 📋 Produce security reports  

```bash
npx check-mcp-security --url http://localhost:8000/mcp
```

> ℹ️ Configure these tools via `.simplerpcaibackendrc` – see **[Common Configurations](https://awolf81.github.io/simple-rpc-ai-backend/common-configurations/)**.

---

## 📸 Screenshots

**Dev Panel – API Explorer**
![Dev Panel Screenshot](https://raw.githubusercontent.com/AWolf81/simple-rpc-ai-backend/develop/docs/images/dev_panel_screenshot_2025-10-04%2023-07-11.png)

**tRPC Playground**
![tRPC Playground Screenshot](https://raw.githubusercontent.com/AWolf81/simple-rpc-ai-backend/develop/docs/images/trpc_playground_screenshot_2025-10-04%2023-11-12.png)

**MCP Inspector (MCP Jam)**
![MCP Jam Screenshot](https://raw.githubusercontent.com/AWolf81/simple-rpc-ai-backend/develop/docs/images/mcp_jam_screenshot_2025-10-04%2023-09-28.png)

---

## 📚 Documentation & Samples

**📖 [Complete Documentation](https://awolf81.github.io/simple-rpc-ai-backend/)**
Full guides, API reference, and examples hosted on GitHub Pages. Includes:

- **[Getting Started](https://awolf81.github.io/simple-rpc-ai-backend/getting-started/)** – Installation, quick start, and basic usage
- **[Server API Reference](https://awolf81.github.io/simple-rpc-ai-backend/server-api/)** – Complete API documentation with examples
- **[Common Configurations](https://awolf81.github.io/simple-rpc-ai-backend/common-configurations/)** – Recipes for typical use cases
- **[Developer Guide](https://awolf81.github.io/simple-rpc-ai-backend/developer/)** – Contributing, architecture, and internals

**💻 Sample Projects**
Working examples in the [`examples/`](examples/) directory:
- `01-basic-server` – Minimal JSON-RPC + tRPC setup
- `02-mcp-server` – Full MCP implementation with OAuth
- `03-custom-routers` – Extend with your own tRPC routers
- `04-byok-usage` – Bring-your-own-key patterns
- And more...

**🔧 Local Development**

Preview docs locally with Jekyll:

```bash
pnpm jekyll:setup   # One-time: install Ruby gems
pnpm jekyll:dev     # Launch live preview at http://localhost:4000
```

Deploy to GitHub Pages:

```bash
pnpm jekyll:deploy  # Build and push to gh-pages branch
```

> 💡 **Windows users:** If styles are missing, specify an absolute `--baseurl` path when building manually.

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
