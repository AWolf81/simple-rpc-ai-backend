---
layout: default
title: Registry
parent: Server API
grand_parent: Documentation
nav_order: 4
---

# Provider Registry

The Simple RPC AI Backend integrates with `@anolilab/ai-model-registry` to deliver curated provider and model metadata with resilient fallbacks.

## Architecture

1. **External Registry** – pulls live provider/model data.
2. **ProviderRegistryService** – filters providers, applies overrides, and exposes metadata via tRPC.
3. **Fallback Data** – ensures availability when the external registry is offline.

## Quick Start

```bash
pnpm install
# Registry data is available immediately with sensible defaults
```

### Programmatic Usage

```typescript
import { ProviderRegistryService } from 'simple-rpc-ai-backend';

const registry = new ProviderRegistryService(
  ['anthropic', 'openai'],
  ['anthropic', 'openai', 'custom-ai'],
  ['free']
);
```

## tRPC Methods

- `ai.listProviders` – service-managed providers with metadata and pricing.
- `ai.listProvidersBYOK` – BYOK providers that expect user-supplied keys.

```typescript
const { providers, source } = await client.ai.listProviders.query();
```

## Configuration

```bash
export AI_SERVICE_PROVIDERS=anthropic,openai,google
export AI_BYOK_PROVIDERS=anthropic,openai,google,custom-ai
```

Run helper scripts as needed:

```bash
pnpm run registry:setup        # Prefetch all data
pnpm run registry:download -- openai
pnpm run registry:health       # Check registry availability
```

## Pricing Overrides

```typescript
registry.addPricingOverride({
  provider: 'openai',
  model: 'gpt-4o',
  pricing: {
    input: 2.5,
    output: 10
  },
  reason: 'Enterprise contract pricing'
});
```

Apply provider-level overrides by omitting the `model` property.

## Monitoring

Use `pnpm run registry:monitor` or custom scripts (see `examples/registry-health-monitoring.js`) to track freshness and detect outages early.

## Zero-Downtime Strategy

- Prefetch data during deployments with `registry:setup`.
- Store cached registry files in mounted volumes or persistent disks.
- Keep fallbacks updated with manual overrides for critical models.
