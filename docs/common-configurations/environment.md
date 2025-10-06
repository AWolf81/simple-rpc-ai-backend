---
layout: default
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

```bash
export REGISTRY_CACHE_PATH=.cache/registry
export REGISTRY_REFRESH_INTERVAL=3600
```

Use `pnpm run registry:setup` to prefetch data before deployments and `pnpm run registry:health` to validate availability.

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
