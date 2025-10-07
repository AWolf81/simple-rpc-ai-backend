---
title: Environment Configuration
parent: Common Configurations
grand_parent: Documentation
nav_order: 1
---

# Environment Configuration

Centralize key environment variables that control provider access, registry behavior, and runtime features.

## Core Variables

| Variable | Purpose |
| --- | --- |
| `SERVER_PORT` | HTTP port for the RPC server (default `8080`). |
| `NODE_ENV` | Controls production vs development logging and caching. |
| `SERVER_WORKSPACE_DIR` | Default server-managed workspace path. |

## Provider Selection

Configure which AI providers are active at runtime.

```bash
export AI_SERVICE_PROVIDERS=anthropic,openai,google
export AI_BYOK_PROVIDERS=anthropic,openai,google,custom-ai
export AI_FREE_TIER_PROVIDERS=free
```

These values feed the `ProviderRegistryService`, shaping both service-managed and user-managed provider lists.

Service providers correspond to server-managed credentials that the platform funds, while BYOK (bring your own key) providers expect end users to supply their own API keys at runtime. Maintaining both lists lets you present distinct pricing tiers without code changes.

## Registry Management

At install time the backend pulls the latest model catalogue from `@anolilab/ai-model-registry`. Runtime reads always go through that library, so there is no manual cache path or refresh interval to configure.

To override pricing or models:

```ts
import { ProviderRegistryService } from 'simple-rpc-ai-backend';

const registry = new ProviderRegistryService(
  ['anthropic', 'openai'],      // service-managed providers
  ['anthropic', 'openai'],      // BYOK providers
  []
);

registry.addPricingOverride({
  provider: 'openai',
  model: 'gpt-4o',
  pricing: { input: 2.5, output: 10 },
  reason: 'Enterprise contract'
});

registry.addModelOverride({
  provider: 'anthropic',
  id: 'claude-3-7-sonnet-20250219',
  name: 'Claude 3.7 Sonnet',
  capabilities: ['text', 'json'],
  contextWindow: 200000
});
```

Place overrides in your server bootstrap (before `createRpcAiServer`) so the dev panel and MCP surface the updated metadata.

## Workspace Controls

```bash
export SERVER_WORKSPACES_ENABLE_API=true
export SERVER_WORKSPACES_CONFIG=./config/server-workspaces.json
```

The JSON configuration allows fine-grained read/write settings, path restrictions, and file size limits for each workspace entry.

## Authentication Values

Set provider secrets and OAuth credentials in `.env` files that are never committed.

```bash
export ANTHROPIC_API_KEY=...
export OPENAI_API_KEY=...
export GOOGLE_API_KEY=...

# OAuth example
export GOOGLE_CLIENT_ID=...
export GOOGLE_CLIENT_SECRET=...
```

Rotate keys regularly and load them through your container orchestration platform when deploying.
