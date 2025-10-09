---
title: Tools
parent: Server API
grand_parent: Documentation
nav_order: 3
---

# Tool Integration

The recommended way to expose AI tooling is through the bundled tRPC routers. They keep system prompts on the server, automatically bridge to JSON-RPC for MCP clients, and give you full control over authentication and billing.

## Use the AI Router in a Custom Server

The quickest path is to reuse the exported `createAppRouter` helper. It wires up the AI router, MCP router, and supporting services so you can mount everything under a single namespace.

```typescript
import { createAppRouter } from 'simple-rpc-ai-backend';

export const appRouter = createAppRouter(
  {
    config: {
      tokens: { defaultMaxTokens: 4096 },
      systemPrompt: { maxLength: 25_000 }
    }
  },
  /* tokenTrackingEnabled */ false,
  /* dbAdapter */ undefined,
  /* serverProviders */ ['anthropic', 'openai'],
  /* byokProviders */ ['anthropic', 'openai', 'google']
);
```

Client code can then call the generated procedures through tRPC:

```typescript
const result = await trpc.ai.generateText.mutate({
  content: sourceCode,
  systemPrompt: 'security_review',
  metadata: { name: 'VS Code extension' }
});
```

Behind the scenes the router routes requests through `AIService.execute`, enforces rate limits, tracks token balances, and decides whether to use managed credentials or BYOK keys.

## Sampling Workflows for MCP

When you enable MCP tooling, the `mcp` router publishes sampling procedures such as `generateWithApproval`. They wrap the same AI router so you get consistent behaviour while letting MCP clients handle multi-step approvals.

```typescript
import { createRpcAiServer } from 'simple-rpc-ai-backend';

const mcpServer = createRpcAiServer({
  mcp: {
    enabled: true,
    ai: {
      enabled: true,
      restrictToSampling: true
    }
  }
});
```

MCP-compatible clients then call `mcp.generateWithApproval` to trigger the sampling protocol. The router handles message construction, approval loops, and finally calls the shared AI router via `aiService.execute`.

## Provider-Native Web Search

Switch between MCP tools and provider-native web search by setting the `webSearchPreference` metadata when calling `ai.generateText`:

```typescript
await trpc.ai.generateText.mutate({
  content: 'Summarise the latest MCP updates',
  systemPrompt: 'research_assistant',
  metadata: {
    type: 'research',
    webSearchPreference: 'ai-web-search' // or 'mcp'
  },
  options: {
    model: 'gpt-4o',
    maxTokens: 1024
  }
});
```

- `'mcp'` uses registered MCP tools such as `web_search` and `registryLookup`.
- `'ai-web-search'` tells the providers (Anthropic, OpenAI, Google, OpenRouter) to use their own browsing APIs.

## Best Practices

- Expose only the tRPC procedures you need—MCP and JSON-RPC inherit them automatically.
- Group tool-specific scopes and rate limits around the router rather than instantiating `AIService` directly.
- Prefer metadata-driven behaviour (e.g., `webSearchPreference`, `provider`) so clients can experiment without server redeploys.
- Keep provider allowlists in `AI_SERVICE_PROVIDERS`/`AI_BYOK_PROVIDERS` so the router enforces business rules consistently.
