---
title: Registry
parent: Server API
grand_parent: Documentation
nav_order: 4
---

# Provider Registry

The Simple RPC AI Backend integrates with `@anolilab/ai-model-registry` to deliver curated provider and model metadata with resilient fallbacks.

## Architecture

1. **External Registry Package** – ships curated provider/model metadata via `@anolilab/ai-model-registry`.
2. **ProviderRegistryService** – filters providers, applies overrides, and exposes metadata via tRPC.
3. **Fallback Data** – ensures availability when the external registry package cannot be resolved.

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

## Monitoring & Resilience

The service relies on `@anolilab/ai-model-registry` at runtime. When the library is unavailable the backend serves the bundled fallback metadata and `getHealthStatus()` returns `status: 'unhealthy'` with the error message from the import. Hook that method into your own health endpoint or scheduler if you need alerts when the live registry is unreachable. Because data is loaded directly from the package there is no explicit cache directory to manage; customize pricing or model entries through `addPricingOverride` / `addModelOverride` as shown above.
