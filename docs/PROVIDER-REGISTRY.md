# Enhanced Provider Registry Integration

This document explains the enhanced AI provider handling using `@anolilab/ai-model-registry` for curated, up-to-date provider and model information.

## Overview

The RPC AI Backend now integrates with [`@anolilab/ai-model-registry`](https://www.npmjs.com/package/@anolilab/ai-model-registry) to provide:

- **Up-to-date provider metadata** from a comprehensive registry
- **Filtered provider lists** based on your `serviceProviders` and `byokProviders` configuration
- **Rich model information** including pricing, capabilities, and context lengths
- **Pricing override system** for correcting inaccurate registry data
- **Fallback support** when registry is unavailable

## New RPC Methods

### `listProviders`
Returns service providers with enhanced metadata from the registry.

```typescript
const result = await client.ai.listProviders.query();
// Returns: { providers: ProviderConfig[], source: 'registry', lastUpdated: string }
```

### `listProvidersBYOK` 
Returns BYOK (Bring Your Own Key) providers with enhanced metadata.

```typescript
const result = await client.ai.listProvidersBYOK.query();
// Returns: { providers: ProviderConfig[], source: 'registry', lastUpdated: string }
```

## Enhanced Provider Data Structure

```typescript
interface ProviderConfig {
  name: string;
  displayName: string;
  models: ModelConfig[];
  priority: number;
  isServiceProvider: boolean;
  isByokProvider: boolean;
  pricing?: PricingInfo;
  metadata?: {
    description?: string;
    website?: string;
    apiKeyRequired: boolean;
    supportedFeatures: string[];
  };
}

interface ModelConfig {
  id: string;
  name: string;
  description?: string;
  contextLength: number;
  inputCostPer1k?: number;
  outputCostPer1k?: number;
  capabilities: string[];
}
```

## Setup and Configuration

### Automatic Setup
The registry is automatically configured when you install the backend:

```bash
pnpm install  # Installs @anolilab/ai-model-registry dependency
```

### Manual Provider Data Download
For production builds or when you want fresh data:

```bash
# Download data for all configured providers
pnpm run registry:setup

# Download data for specific provider
pnpm run registry:download -- openai

# Build with fresh registry data
pnpm run build:prod
```

### Environment Configuration
Configure which providers to include:

```bash
# Set service providers (server-managed API keys)
export AI_SERVICE_PROVIDERS=anthropic,openai,google

# Set BYOK providers (user-managed API keys)  
export AI_BYOK_PROVIDERS=anthropic,openai,google,groq
```

## Pricing Override System

When registry pricing data is incorrect, you can apply temporary overrides:

```typescript
import { ProviderRegistryService } from 'simple-rpc-ai-backend';

const registry = new ProviderRegistryService(['anthropic'], ['openai']);

// Override pricing for a specific model
registry.addPricingOverride({
  provider: 'anthropic',
  model: 'claude-3-5-sonnet-20241022',
  pricing: {
    input: 3.00,  // $3.00 per 1k input tokens
    output: 15.00 // $15.00 per 1k output tokens
  },
  reason: 'Registry pricing outdated - using official API pricing'
});

// Override pricing for entire provider
registry.addPricingOverride({
  provider: 'openai',
  pricing: {
    input: 5.00,
    output: 15.00
  },
  reason: 'Temporary pricing adjustment for cost analysis'
});
```

## Build Scripts

The package includes several scripts for managing provider data:

```bash
# Download provider data
pnpm run registry:setup

# Download specific provider
node scripts/setup-providers.js --provider anthropic

# Build with registry preparation
pnpm run build:prod

# Show help
node scripts/setup-providers.js --help
```

## Registry Health Monitoring

Monitor the health and status of the AI model registry integration:

### Health Check Scripts

```bash
# Single health check
pnpm run registry:health

# Continuous monitoring (every 5 minutes)
pnpm run registry:monitor

# Custom monitoring interval (every 10 minutes)
node examples/registry-health-monitoring.js --continuous 10
```

### Programmatic Health Monitoring

```typescript
import { createTypedAIClient } from 'simple-rpc-ai-backend';

const client = createTypedAIClient({
  links: [httpBatchLink({ url: 'http://localhost:8000/trpc' })]
});

// Get detailed health status
const health = await client.ai.getRegistryHealth.query();

console.log('Registry Status:', health.status);
console.log('Response Time:', health.performance.responseTimeMs, 'ms');
console.log('Available Providers:', health.providers.available);
console.log('Failed Providers:', health.providers.failed);
console.log('Pricing Overrides:', health.pricing.overrides);
```

### Health Status Values

| Status | Description | Action Required |
|--------|-------------|-----------------|
| `healthy` | ✅ All systems operational | None |
| `degraded` | ⚠️ Some providers failing | Check error details, consider `registry:setup` |
| `unavailable` | ❌ Registry offline | Check network, verify installation |
| `unknown` | ❓ Status unclear | Investigate connection issues |
| `error` | 💥 Health check failed | Check server logs |

### Alerting Integration

For production monitoring, integrate with your alerting system:

```typescript
// Example: Slack alerting
async function checkAndAlert() {
  const health = await client.ai.getRegistryHealth.query();
  
  if (health.status === 'unavailable') {
    await sendSlackAlert({
      channel: '#ai-ops',
      message: `🚨 AI Registry Down! Status: ${health.status}`,
      details: health.errors.join('\n')
    });
  }
  
  if (health.performance.responseTimeMs > 10000) {
    await sendSlackAlert({
      channel: '#ai-ops', 
      message: `🐌 Slow Registry Response: ${health.performance.responseTimeMs}ms`
    });
  }
}
```

## Pricing Change Detection

During re-aggregation, the system checks for pricing changes:

```typescript
const { hasChanges, changes } = await registry.checkForPricingChanges();

if (hasChanges) {
  console.warn('Pricing changes detected:', changes);
  // Apply overrides or update configurations as needed
}
```

## Fallback Behavior

When the registry is unavailable, the system falls back to:

1. **Built-in provider data** for common providers (Anthropic, OpenAI, Google)
2. **Basic model information** with standard capabilities
3. **Manual pricing overrides** if configured

This ensures your application continues working even if the registry service is down.

## Migration from Static Provider Lists

### Before (Static)
```typescript
const providers = [
  { name: 'anthropic', models: ['claude-3-5-sonnet'] },
  { name: 'openai', models: ['gpt-4o'] }
];
```

### After (Registry-Enhanced)
```typescript
// Automatic - just configure your providers
const serviceProviders = ['anthropic', 'openai'];
const byokProviders = ['anthropic', 'openai', 'groq'];

// Rich data automatically available
const result = await client.ai.listProviders.query();
// Each provider includes: pricing, capabilities, context lengths, descriptions
```

## Production Considerations

### Build Process
For production builds, include registry setup:

```bash
# Development
pnpm build

# Production (with fresh registry data)
pnpm run build:prod
```

### Monitoring
Monitor for pricing changes and registry availability:

- Set up alerts for pricing override warnings
- Monitor fallback usage in logs
- Regularly update registry data (weekly/monthly)

### Performance
- Registry data is cached after first load
- Fallback data is embedded in the build
- No runtime dependencies on external registry APIs

## Open Topics & Implementation Status

### ✅ Completed
- [x] AI model registry integration
- [x] Provider filtering by configuration
- [x] Enhanced `listProviders` and `listProvidersBYOK` methods
- [x] Pricing override system
- [x] Build scripts for provider data management
- [x] Fallback support for registry unavailability

### ⚠️ Open Questions

1. **Pricing Synchronization**
   - Registry comment mentions "cost fields are never synchronized"
   - **Question**: Are prices pulled once and frozen, or updated periodically?
   - **Current Implementation**: Uses registry pricing with override capability

2. **Pricing Update Workflow**
   - **Question**: How should pricing updates be handled in production?
   - **Suggested Approach**: 
     - Weekly/monthly registry updates
     - Notification system for significant pricing changes
     - Manual approval for pricing changes > 20%

3. **Cache Strategy**
   - **Question**: How long should registry data be cached?
   - **Current**: In-memory cache per server instance
   - **Consideration**: Add Redis cache for multi-instance deployments

4. **Provider Discovery**
   - **Question**: Should new providers be auto-added or require manual configuration?
   - **Current**: Manual configuration required (safe default)

### 🔄 Future Enhancements

1. **Advanced Pricing Management**
   ```typescript
   // Proposed: Pricing change approval workflow
   interface PricingChangeApproval {
     change: PricingChange;
     threshold: number;  // Auto-approve if change < threshold
     approver?: string;
     status: 'pending' | 'approved' | 'rejected';
   }
   ```

2. **Registry Health Monitoring**
   ```typescript
   // Proposed: Registry status endpoint
   GET /registry/status
   {
     "available": true,
     "lastUpdate": "2024-01-15T10:30:00Z",
     "providers": ["anthropic", "openai", "google"],
     "errors": []
   }
   ```

3. **Model Capability Filtering**
   ```typescript
   // Proposed: Filter by capabilities
   await client.ai.listProviders.query({ 
     capabilities: ['vision', 'code-generation'] 
   });
   ```

## Example Usage

See `examples/provider-registry-example.js` for a complete working example of the enhanced provider registry functionality.