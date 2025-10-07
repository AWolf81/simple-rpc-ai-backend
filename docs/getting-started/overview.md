---
title: Project Overview
parent: Getting Started
grand_parent: Documentation
nav_order: 1
---

# Project Overview

The Simple RPC AI Backend exposes a tRPC-powered API that implements the Model Context Protocol for AI assistants. It provides:

- **Unified provider orchestration** across Anthropic, OpenAI, Google Gemini, OpenRouter, and custom registries.
- **MCP tooling and resource access** so assistants can browse workspaces, call tools, and retrieve documents.
- **Production-ready ergonomics** including workspace isolation, provider health checks, and registry fallbacks.

Use the links below to set up the project locally and explore the platform capabilities.

- [Installation]({{ site.baseurl }}{% link getting-started/installation.md %})
- [Quickstart]({{ site.baseurl }}{% link getting-started/quickstart.md %})

## Developer Tooling

The backend ships with a small set of helper UIs that make development and manual testing easier. Add the bundled CLIs to your consumer project for quick access:

```jsonc
// package.json
"scripts": {
  "trpc:build": "simple-rpc-gen-methods",
  "dev:panel": "simple-rpc-dev-panel --server-port 8000",
  "dev:server": "tsx watch src/index.ts",
  "dev": "concurrently \"pnpm dev:server\" \"pnpm dev:panel\"",
  "build": "tsc"
}

```

> Install the helper dev dependency once: `pnpm add -D concurrently`.

Run each command in a separate terminal once your server is listening:

| Tool | Default URL | Purpose |
| --- | --- | --- |
| **Dev Panel** (`pnpm dev:panel`) | <http://localhost:8080> | Dashboards for MCP tools, server workspaces, tRPC procedures, and the generated OpenRPC schema. Automatically launches MCP Jam if the optional dependency `@mcpjam/inspector` is available. |
| **tRPC Playground** | <http://localhost:8080/trpc-playground> | Interactive UI (bundled with the dev panel) to issue queries/mutations against `/trpc/*`. |
| **OpenRPC Inspector** | <https://inspector.open-rpc.org/?url=http://localhost:8000/openrpc.json> | Remote viewer for the JSON-RPC schema. Allow its origin in `cors.origin` (e.g. add `https://inspector.open-rpc.org`). |
| **OpenRPC Playground** | <https://playground.open-rpc.org/?url=http://localhost:8000/openrpc.json> | Interactive request builder for `/rpc`. Requires the same CORS adjustments as the inspector. |

> ℹ️ To skip MCP Jam entirely, install the backend with `pnpm install --no-optional` (or run `pnpm prune --prod --no-optional` after install). The dev panel simply omits MCP Jam when the optional dependency is absent.

> ℹ️ Re-run `pnpm trpc:build` whenever you change tRPC routers— the dev panel and JSON-RPC schema read from the generated `trpc-methods.json` and do not watch source files automatically.

> ℹ️ These CLIs respect `AI_SERVER_PORT`. Override it (for example `AI_SERVER_PORT=9000 pnpm dev:panel`) if your API server runs on a non-standard port. Adapt the `dev`/`build` scripts to match your app layout (multiple entry points, custom bundlers, etc.). For convenience you can start the API server and dev panel together via `pnpm dev` (using [`concurrently`](https://www.npmjs.com/package/concurrently)).

## Examples

The GitHub repository includes runnable samples under [`examples/`](https://github.com/AWolf81/simple-rpc-ai-backend/tree/develop/examples). They demonstrate how to compose routers, MCP integrations, and authentication flows:

- [`01-basic-server`](https://github.com/AWolf81/simple-rpc-ai-backend/tree/develop/examples/01-basic-server) – minimal tRPC/JSON-RPC setup. Pair it with the [Quickstart]({{ site.baseurl }}{% link getting-started/quickstart.md %}) for consumers.
- [`02-mcp-server`](https://github.com/AWolf81/simple-rpc-ai-backend/tree/develop/examples/02-mcp-server) – full MCP implementation with workspaces and tools. Cross reference [Server Workspaces vs MCP Roots]({{ site.baseurl }}{% link common-configurations/server-workspaces-vs-mcp-roots.md %}) and [MCP OAuth Authentication]({{ site.baseurl }}{% link common-configurations/mcp-oauth-authentication.md %}).
- [`04-mcp-tasks-server`](https://github.com/AWolf81/simple-rpc-ai-backend/tree/develop/examples/04-mcp-tasks-server) – showcases long-running MCP tasks and progress updates. See [Tools]({{ site.baseurl }}{% link server-api/tools.md %}) for protocol details.
- [`05-local-resources-server`](https://github.com/AWolf81/simple-rpc-ai-backend/tree/develop/examples/05-local-resources-server) – demonstrates exposing local files as MCP resources. Combine with [Server Workspaces]({{ site.baseurl }}{% link common-configurations/workspaces.md %}).

Clone an example, run `pnpm install`, then start the server with `pnpm dev` to explore the workflows via the dev panel.
