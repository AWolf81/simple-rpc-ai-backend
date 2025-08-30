# AI Model Registry Integration Guide

This guide shows how AI backends using simple-rpc-ai-backend can extend, replace, or modify the AI model registry to add custom providers or override model configurations.

## Quick Start

The simple-rpc-ai-backend package works **out of the box** with no setup required. The `@anolilab/ai-model-registry` dependency provides live model data with intelligent fallbacks.

```bash
npm install simple-rpc-ai-backend
# Ready to use immediately - no setup needed!
```

### How It Works

1. **Live Registry Data**: Uses `@anolilab/ai-model-registry` for current models and pricing
2. **Intelligent Fallbacks**: Built-in fallback data when registry unavailable  
3. **Zero Configuration**: Works immediately after install
4. **Corporate Friendly**: Graceful fallbacks for restricted environments

## Registry Architecture

The system uses a three-tier approach:

1. **External Registry** (`@anolilab/ai-model-registry`) - Comprehensive, up-to-date model database
2. **Provider Registry Service** (`src/services/provider-registry.ts`) - Integration layer with fallbacks  
3. **Fallback Data** - Hardcoded fallbacks when registry is unavailable

## Configuration Options

### Environment Variables

```bash
# Configure which providers to include
AI_SERVICE_PROVIDERS=anthropic,openai,google
AI_BYOK_PROVIDERS=anthropic,openai,google,custom-provider

# Then run setup
npm run registry:setup
```

### Programmatic Configuration

```typescript
import { ProviderRegistryService } from 'simple-rpc-ai-backend';

const registry = new ProviderRegistryService(
  ['anthropic', 'openai'],  // Service providers
  ['anthropic', 'openai', 'custom-provider'], // BYOK providers  
  ['free'] // Free tier providers
);
```

## Extending the Registry

### Option 1: Add Custom Provider to External Registry

Best for providers you want to share across projects:

```bash
# Contribute to @anolilab/ai-model-registry
npm run registry:download --provider your-provider
```

### Option 2: Extend via Provider Registry Service

For project-specific customizations:

```typescript
import { createAIServer, ProviderRegistryService } from 'simple-rpc-ai-backend';

// Create custom provider registry
const customRegistry = new ProviderRegistryService(
  ['anthropic', 'openai', 'custom-ai'], // Add custom-ai
  ['anthropic', 'openai', 'custom-ai']
);

// Add pricing overrides for incorrect registry data
customRegistry.addPricingOverride({
  provider: 'custom-ai',
  model: 'custom-model-v1',
  pricing: {
    input: 5.0,   // $5 per 1K input tokens
    output: 15.0  // $15 per 1K output tokens
  },
  reason: 'Registry data is outdated for this model'
});

const server = createAIServer({
  serviceProviders: ['anthropic', 'openai', 'custom-ai'],
  registryService: customRegistry // Use custom registry
});
```

### Option 3: Modify Existing Providers

```typescript
// Override pricing for existing models
customRegistry.addPricingOverride({
  provider: 'openai',
  model: 'gpt-4o', 
  pricing: {
    input: 2.5,
    output: 10.0
  },
  reason: 'Enterprise pricing tier'
});

// Provider-level override (affects all models)
customRegistry.addPricingOverride({
  provider: 'anthropic',
  pricing: {
    input: 1.0,
    output: 5.0
  },
  reason: 'Custom contract pricing'
});
```

## Registry Scripts & Monitoring

### Available Scripts

```bash
npm run registry:health        # Check current registry health
npm run registry:check-updates # Check for new models and pricing changes
```

### Zero Setup Required

No setup scripts needed! The registry works automatically:

- ✅ **`@anolilab/ai-model-registry` dependency** provides live data
- ✅ **ProviderRegistryService** handles integration with fallbacks
- ✅ **Automatic provider detection** based on your configuration
- ✅ **Built-in fallback models** for offline/restricted environments
- ✅ **Graceful error handling** - never breaks your application

### Configuration via Environment Variables

```bash
# Configure which providers to use (optional)
export AI_SERVICE_PROVIDERS=anthropic,openai,custom-ai
export AI_BYOK_PROVIDERS=anthropic,openai,custom-ai
```

The system automatically uses only the providers you configure in your AI service.

## Custom Provider Implementation

### Step 1: Add Provider to Environment

```bash
AI_SERVICE_PROVIDERS=anthropic,openai,custom-ai
AI_BYOK_PROVIDERS=anthropic,openai,custom-ai
```

### Step 2: Implement Provider in AI Service

```typescript
// In your AI backend
import { AIService } from 'simple-rpc-ai-backend';

const aiService = new AIService({
  serviceProviders: {
    'custom-ai': {
      apiKey: process.env.CUSTOM_AI_API_KEY,
      priority: 1
    }
  },
  byokProviders: ['custom-ai'],
  // Registry will automatically include custom-ai if configured
});
```

### Step 3: Add Fallback Models (Optional)

Extend the fallback data in your implementation:

```typescript
// Create extended provider registry service
class ExtendedProviderRegistry extends ProviderRegistryService {
  private getFallbackModels(providerName: string): ModelConfig[] {
    if (providerName === 'custom-ai') {
      return [
        {
          id: 'custom-model-v1',
          name: 'Custom Model V1',
          contextLength: 100000,
          inputCostPer1k: 5.0,
          outputCostPer1k: 15.0,
          capabilities: ['text', 'reasoning', 'custom-feature']
        }
      ];
    }
    
    return super.getFallbackModels(providerName);
  }
}
```

## Health Monitoring

### Check Registry Status

```typescript
import { createTypedAIClient } from 'simple-rpc-ai-backend';

const client = createTypedAIClient({ /* config */ });
const health = await client.ai.getRegistryHealth.query();

console.log('Registry Status:', health.status);
console.log('Available Providers:', health.providers.available);
console.log('Pricing Overrides:', health.pricing.overrides);
```

### Continuous Monitoring

```bash
# Monitor registry health every 5 minutes
npm run registry:monitor --continuous 5
```

## Troubleshooting

### Registry Setup Fails

```bash
# Try safe setup (won't block builds)
npm run registry:setup:safe

# Check specific provider
npm run registry:download --provider anthropic

# Check health
npm run registry:health
```

### Missing Models/Providers

1. **Check configuration**: Verify `AI_SERVICE_PROVIDERS` includes your provider
2. **Re-run setup**: `npm run registry:setup`
3. **Check fallbacks**: Provider registry includes hardcoded fallbacks
4. **Add custom fallbacks**: Extend `ProviderRegistryService` as shown above

### Pricing Issues

```typescript
// Add pricing override
registry.addPricingOverride({
  provider: 'provider-name',
  model: 'model-id', // Optional - affects all models if omitted
  pricing: { input: 1.0, output: 3.0 },
  reason: 'Registry data is incorrect'
});
```

## Production Deployment

### Recommended Setup

```bash
# In CI/CD or build process
npm run registry:setup

# In production, registry runs automatically
npm install
npm run build:prod  # Includes registry:prepare
```

### Environment Configuration

```bash
# Production environment variables
AI_SERVICE_PROVIDERS=anthropic,openai,google
AI_BYOK_PROVIDERS=anthropic,openai,google
AI_REGISTRY_CACHE_TTL=3600  # Cache for 1 hour
```

### Health Monitoring

```bash
# Add to monitoring/alerting
npm run registry:health
# Returns exit code 0 if healthy, 1 if degraded/unavailable
```

## Best Practices

1. **Use Environment Variables**: Configure providers via environment rather than code
2. **Add Health Checks**: Monitor registry status in production
3. **Implement Fallbacks**: Always have fallback model data
4. **Override Pricing Carefully**: Document and track pricing overrides
5. **Monitor for Changes**: Set up alerts for pricing or model changes
6. **Test Provider Integration**: Verify custom providers work with the AI service

## Integration Examples

### Basic Extension

```typescript
// server.ts
import { createAIServer } from 'simple-rpc-ai-backend';

const server = createAIServer({
  serviceProviders: {
    anthropic: { apiKey: process.env.ANTHROPIC_API_KEY },
    openai: { apiKey: process.env.OPENAI_API_KEY },
    'custom-ai': { apiKey: process.env.CUSTOM_AI_KEY }
  }
});

server.start();
```

### Advanced Customization

```typescript
// advanced-setup.ts
import { ProviderRegistryService, createAIServer } from 'simple-rpc-ai-backend';

class CustomProviderRegistry extends ProviderRegistryService {
  constructor() {
    super(
      ['anthropic', 'openai', 'custom-ai'], // service
      ['anthropic', 'openai', 'custom-ai'], // byok
      ['free'] // free tier
    );
    
    this.setupCustomPricing();
  }
  
  private setupCustomPricing() {
    // Add enterprise pricing
    this.addPricingOverride({
      provider: 'anthropic',
      pricing: { input: 1.0, output: 5.0 },
      reason: 'Enterprise contract pricing'
    });
  }
}

const customRegistry = new CustomProviderRegistry();
const server = createAIServer({ registryService: customRegistry });
server.start();
```

This integration guide provides flexible options for AI backends to customize the model registry while maintaining compatibility with the external registry system and ensuring reliable fallbacks.