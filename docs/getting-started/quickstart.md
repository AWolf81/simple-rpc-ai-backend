---
title: Quickstart
parent: Getting Started
grand_parent: Documentation
nav_order: 3
---

# Quickstart

Launch the backend inside your own project and explore the MCP tools in minutes. This guide is **for package consumers** who install `simple-rpc-ai-backend` from npm.  
If you are contributing to the repository itself, see the [installation guide]({{ site.baseurl }}{% link getting-started/installation.md %}).

## 1. Install the Package

```bash
pnpm add simple-rpc-ai-backend
```

> 🛠️ Need a project scaffold? Create a TypeScript workspace (for example with `pnpm create vite my-app --template vanilla-ts`) and run the command above inside that folder.

## 2. Add Dev Tooling Scripts

Update your consumer `package.json` with helper commands that ship with the backend:

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

Run `pnpm trpc:build` whenever you add or rename tRPC routers—this regenerates `trpc-methods.json`, which powers the dev panel and JSON-RPC schema. The panel automatically launches MCP Jam when `@mcpjam/inspector` is present. If you prefer to omit MCP Jam, install with `pnpm install --no-optional` or prune after installation via `pnpm prune --prod --no-optional`. Tailor the `dev`/`build` scripts (or the optional `dev` composite script) as needed (e.g. different entry points, bundlers, or framework builds); the optional `dev` script uses [`concurrently`](https://www.npmjs.com/package/concurrently) to start the API server and dev panel together.

## 3. Configure Environment Variables

Create a `.env` file with provider keys and the server port:

```bash
SERVER_PORT=8000
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-openai-...
```

Other useful variables:

- `AI_SERVICE_PROVIDERS` – enables provider-backed API keys handled by the server.
- `AI_BYOK_PROVIDERS` – providers that expect user-supplied keys at runtime.

## 4. Bootstrap the Server

Create a file such as `src/server.ts`:

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

server.start();
```

> Re-run `pnpm trpc:build` after editing these routers so the dev panel and JSON-RPC schema stay in sync.

Run it with your preferred runtime (tsx, ts-node, or compiled JavaScript). For example:

```bash
pnpm tsx src/server.ts
```

You should see log output confirming workspace registration, provider availability, and tRPC endpoints.
In day-to-day development you’ll usually run `pnpm dev` (which boots both the API server and the dev panel via `concurrently`). If you prefer separate terminals, run `pnpm dev:server` and `pnpm dev:panel` individually.

## 5. Recommended Project Layout

Place custom routers under `src/trpc/routers/<namespace>/index.ts` so that the generator and dev panel can discover them automatically:

```
src/
  server.ts                # createRpcAiServer entry point
  trpc/
    root.ts
    routers/
      math/index.ts
      utils/index.ts
      custom/index.ts      # additional namespaces as needed
```

Wire them into `createRpcAiServer({ customRouters: { math: mathRouter, utils: utilsRouter, custom: customRouter } })` and re-run `pnpm trpc:build` so the dev panel sees the new procedures.

## 6. Explore the Server

Visit <http://localhost:8080> after running `pnpm dev` (or `pnpm dev:panel` plus `pnpm dev:server`). The dev panel lets you:

- Inspect available tRPC namespaces (`math`, `utils`, and any custom routers you register).
- Browse MCP tools and resources when `mcp.enabled` is `true`.
- Follow quick links to the bundled tRPC Playground and the MCP Jam inspector.

Keep a terminal open with `pnpm trpc:build` whenever you change router definitions so the UI reflects the latest procedures.
External clients (VS Code MCP extension, Claude Desktop, etc.) can still connect to the server URL from the logs to exercise the same tools.

---

### For Contributors / Maintainers

If you are developing the backend itself, use the repository workflow (clone, `pnpm install`, etc.) described in the [Installation]({{ site.baseurl }}{% link getting-started/installation.md %}) page. The Git URL `pnpm add git+https://github.com/AWolf81/simple-rpc-ai-backend.git` is intended for package developers only; consumers should stick to the npm version.
