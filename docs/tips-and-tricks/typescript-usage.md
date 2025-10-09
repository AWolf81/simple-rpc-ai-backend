---
title: TypeScript Usage
parent: Tips & Tricks
grand_parent: Documentation
nav_order: 2
---

# TypeScript Usage Guide

Recommended TypeScript patterns for using `simple-rpc-ai-backend` in your projects.

## Installation

```bash
pnpm add simple-rpc-ai-backend
```

The package ships with full type definitions—no extra typings required.

## Type-Safe Server Configuration

### Using `satisfies`

```ts
import { createRpcAiServer, type RpcAiServerConfig } from 'simple-rpc-ai-backend';

const config = {
  port: 8000,
  serverProviders: ['anthropic', 'openai'],
  protocols: { jsonRpc: true, tRpc: true },
  mcp: {
    enabled: true,
    transports: { http: true, stdio: false }
  }
} satisfies RpcAiServerConfig;

const server = createRpcAiServer(config);
```

Benefits:
- ✅ Type checking for configuration keys
- ✅ Literal types preserved for better IntelliSense
- ✅ Less casting compared to `as`

### Using `defineRpcAiServerConfig`

```ts
import { createRpcAiServer, defineRpcAiServerConfig } from 'simple-rpc-ai-backend';

const config = defineRpcAiServerConfig({
  port: 8000,
  systemPrompts: {
    default: 'You are a helpful assistant'
  }
});

const server = createRpcAiServer(config);
```

## Type-Safe tRPC Client

```ts
import { createTypedAIClient } from 'simple-rpc-ai-backend';
import { httpBatchLink } from '@trpc/client';
import type { AppRouter } from 'simple-rpc-ai-backend';

const client = createTypedAIClient({
  links: [
    httpBatchLink({
      url: 'http://localhost:8000/trpc',
      headers: () => ({ Authorization: 'Bearer token' })
    })
  ]
});

const result = await client.ai.generateText.mutate({
  content: 'Explain context bridges',
  provider: 'anthropic'
});
```

## Narrowing Procedure Output

```ts
const res = await client.system.health.query();

if (res.status === 'healthy') {
  // TypeScript understands res since the schema enforces it
}
```

## tRPC Router Augmentation

```ts
import { router, publicProcedure } from 'simple-rpc-ai-backend';
import { z } from 'zod';

export const mathRouter = router({
  add: publicProcedure
    .input(z.object({ a: z.number(), b: z.number() }))
    .mutation(({ input }) => ({ result: input.a + input.b }))
});
```

Then merge it into your server via `customRouters`.

## Utility Types

- `AppRouter` – full router type, useful for caller factories
- `RpcAiServerConfig` – configuration schema
- `McpToolMeta` – metadata for MCP tool annotations

Import them directly from the package when extending your own code.
