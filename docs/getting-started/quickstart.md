---
layout: default
title: Quickstart
parent: Getting Started
grand_parent: Documentation
nav_order: 3
---

# Quickstart

Launch the backend inside your own project and explore the MCP tools in minutes. This guide is **for package consumers** who install `simple-rpc-ai-backend` from npm.  
If you are contributing to the repository itself, see the [installation guide](installation.md).

## 1. Install the Package

```bash
pnpm add simple-rpc-ai-backend
```

> 🛠️ Need a project scaffold? Create a TypeScript workspace (for example with `pnpm create vite my-app --template vanilla-ts`) and run the command above inside that folder.

## 2. Configure Environment Variables

Create a `.env` file with provider keys and the server port:

```bash
SERVER_PORT=8000
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-openai-...
```

Other useful variables:

- `AI_SERVICE_PROVIDERS` – enables provider-backed API keys handled by the server.
- `AI_BYOK_PROVIDERS` – providers that expect user-supplied keys at runtime.

## 3. Bootstrap the Server

Create a file such as `src/server.ts`:

```ts
import { createRpcAiServer } from 'simple-rpc-ai-backend';

const server = createRpcAiServer({
  port: Number(process.env.SERVER_PORT ?? 8000),
  ai: {
    providers: {
      anthropic: { apiKey: process.env.ANTHROPIC_API_KEY },
      openai: { apiKey: process.env.OPENAI_API_KEY }
    }
  },
  mcp: { enabled: true }
});

await server.start();
```

Run it with your preferred runtime (tsx, ts-node, or compiled JavaScript). For example:

```bash
pnpm tsx src/server.ts
```

You should see log output confirming workspace registration, provider availability, and tRPC endpoints.

## 4. Explore the MCP Tools

Connect an MCP client (such as MCP Jam or the VS Code MCP extension) to the server URL from the logs. Confirm that:

- Server workspaces are listed via `getServerWorkspaces`.
- MCP roots requested by clients show up under `roots/list`.
- Tool invocations (search, registry queries, resource fetches) respond successfully.

---

### For Contributors / Maintainers

If you are developing the backend itself, use the repository workflow (clone, `pnpm install`, etc.) described in the [Installation](installation.md) page. The Git URL `pnpm add git+https://github.com/AWolf81/simple-rpc-ai-backend.git` is intended for package developers only; consumers should stick to the npm version.
