# 📡 Feature Spec: `listProviders` RPC Query (Enhanced with `@anolilab/ai-model-registry`)

## Overview

The `listProviders` RPC query allows clients to fetch the **available AI providers and models** directly from the backend.  

Instead of manually maintaining a `AI_PROVIDERS` array, the backend now integrates with [`@anolilab/ai-model-registry`](https://www.npmjs.com/package/@anolilab/ai-model-registry) to pull the most up-to-date provider + model metadata.

**Key difference**:  
- `ai-model-registry` contains *all* known providers/models (very large).  
- The **rpc backend filters this data** down to only the providers configured in `serviceProviders` or `byokProviders`.  
- This ensures the server stays **authoritative and curated**, while still benefiting from the rich registry metadata.
- During re-run of download and aggregate, we need to issue a warning if pricing changed or there are breaking changes. There is a comment `The following cost-related fields are never synchronized to preserve pricing accuracy:

  cost (entire cost object)
  input (input cost)
  output (output cost)
  inputCacheHit (cache hit pricing)
  imageGeneration (image generation pricing)
  videoGeneration (video generation pricing)` - what does it mean? Are prices just pulled once? How is a price update working?
- Add an easy override option to the server e.g. pulled pricing or information is wrong and we need to fix it temporarily.

---

## Installation & Setup

When users install the backend with `pnpm install`, the dependency `@anolilab/ai-model-registry` is pulled in automatically.  

No extra configuration is required — the backend handles:  
- Fetching registry metadata  
- Filtering it against configured providers  
- Returning only relevant information through `listProviders`
- Check the readme for tasks we need to do after installation - I think it would be good if we could run a script to pull just the needed information that are configured in our RPC ai backend for serviceProviders and byokProviders - see below commands. For production build we need to do the same but call `build:prod` in the end instead of `pnpm run build`:
  ```
  # Download data for a specific provider
  pnpm run download --provider openai
  pnpm run download --provider anthropic

  # Aggregate provider data (includes pricing enrichment and synchronization)
  pnpm run aggregate

  # Generate provider icons
  pnpm run generate-icons

  # Build the package
  pnpm run build

  # Build for production
  pnpm run build:prod
  ```

---

## API Definition

### RPC Method

```ts
listProviders: {
  query: () => Promise<ProviderConfig[]>; // filtered to just the serviceProviders - typing maybe differnt
}
listProvidersBYOK: {
  query: () => Promise<ProviderConfig[]>; // filtered to just the BYOK providers - typing maybe differnt
}
```

`List provider by user` RPC method is still needed to see all configured providers for a given user, but we already have it.