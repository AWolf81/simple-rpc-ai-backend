---
title: Provider Configuration
parent: Common Configurations
grand_parent: Documentation
nav_order: 2
---

# Unified Provider Configuration

The new unified `providers` configuration simplifies AI provider setup by supporting both simple strings and extended configuration objects in a single array.

## Quick Start

```typescript
import { createRpcAiServer } from 'simple-rpc-ai-backend';

const server = createRpcAiServer({
  providers: [  // New alias for serverProviders
    'anthropic',  // Simple: uses ANTHROPIC_API_KEY env var
    'openai',     // Simple: uses OPENAI_API_KEY env var
    {
      name: 'google',
      apiKey: process.env.GOOGLE_API_KEY,
      defaultModel: 'gemini-1.5-flash'
    }
  ]
});
```

---

## Configuration Forms

### Simple String Form

Use provider name strings for standard configurations that read API keys from environment variables:

```typescript
{
  providers: ['anthropic', 'openai', 'google']
}
```

**Environment variables used:**
- `anthropic` → `ANTHROPIC_API_KEY`
- `openai` → `OPENAI_API_KEY`
- `google` → `GOOGLE_API_KEY`
- `openrouter` → `OPENROUTER_API_KEY`
- `huggingface` → `HUGGINGFACE_API_KEY`

### Extended Object Form

Use configuration objects for per-provider customization:

```typescript
{
  providers: [
    {
      name: 'anthropic',
      apiKey: process.env.ANTHROPIC_API_KEY,  // Explicit API key
      defaultModel: 'claude-3-5-sonnet-20241022',
      systemPrompts: {
        'default': 'You are Claude, a helpful AI assistant'
      },
      modelRestrictions: {
        allowedModels: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022'],
        blockedModels: ['claude-2.1']
      }
    }
  ]
}
```

### Hybrid Configuration

Mix both forms in the same array:

```typescript
{
  providers: [
    'anthropic',  // String form
    'openai',     // String form
    {             // Object form
      name: 'google',
      apiKey: process.env.GOOGLE_API_KEY,
      defaultModel: 'gemini-1.5-flash'
    }
  ]
}
```

---

## Provider Configuration Options

### ProviderConfig Interface

```typescript
interface ProviderConfig {
  name: string;                           // Provider name
  apiKey?: string;                        // Explicit API key (overrides env var)
  defaultModel?: string;                  // Default model for this provider
  systemPrompts?: Record<string, string>; // Provider-specific system prompts
  modelRestrictions?: {                   // Provider-specific model restrictions
    allowedModels?: string[];             // Exact model names allowed
    allowedPatterns?: string[];           // Glob patterns (e.g., "gpt-4*")
    blockedModels?: string[];             // Models to block
  };

  // For custom providers (non-built-in)
  type?: 'openai' | 'anthropic' | 'google';  // Base provider type
  baseUrl?: string;                          // Custom API endpoint
  apiKeyHeader?: string;                     // Default: 'Authorization'
  apiKeyPrefix?: string;                     // Default: 'Bearer '
}
```

---

## Common Use Cases

### 1. Multi-Provider Setup with Cost Control

```typescript
{
  providers: [
    // Premium provider with model restrictions
    {
      name: 'anthropic',
      apiKey: process.env.ANTHROPIC_API_KEY,
      defaultModel: 'claude-3-5-haiku-20241022',  // Budget model
      modelRestrictions: {
        allowedModels: [
          'claude-3-5-haiku-20241022',
          'claude-3-5-sonnet-20241022'
        ],
        blockedModels: ['claude-opus-*']  // Block expensive models
      }
    },

    // Budget provider
    {
      name: 'openai',
      apiKey: process.env.OPENAI_API_KEY,
      defaultModel: 'gpt-4o-mini',
      modelRestrictions: {
        allowedPatterns: ['gpt-4o-mini*', 'gpt-3.5*']
      }
    }
  ]
}
```

### 2. Custom Provider Integration

```typescript
{
  providers: [
    'anthropic',  // Built-in provider

    // Custom OpenAI-compatible provider
    {
      name: 'deepseek',
      type: 'openai',  // Uses OpenAI SDK internally
      baseUrl: 'https://api.deepseek.com/v1',
      apiKey: process.env.DEEPSEEK_API_KEY,
      defaultModel: 'deepseek-chat'
    },

    // Custom Anthropic-compatible provider
    {
      name: 'claude-proxy',
      type: 'anthropic',
      baseUrl: 'https://proxy.company.com/v1',
      apiKey: process.env.INTERNAL_API_KEY,
      apiKeyHeader: 'X-API-Key',
      defaultModel: 'claude-3-5-sonnet-20241022'
    }
  ]
}
```

### 3. Provider-Specific System Prompts

```typescript
{
  providers: [
    {
      name: 'anthropic',
      systemPrompts: {
        'default': 'You are Claude, a helpful AI assistant created by Anthropic.',
        'code-review': 'You are an expert code reviewer with deep knowledge of software engineering best practices.'
      }
    },
    {
      name: 'openai',
      systemPrompts: {
        'default': 'You are ChatGPT, a helpful AI assistant created by OpenAI.',
        'code-review': 'You are a senior software engineer reviewing code for quality and maintainability.'
      }
    }
  ],

  // Global system prompts (used if provider-specific not found)
  systemPrompts: {
    'documentation': 'Generate clear, comprehensive documentation.'
  }
}
```

### 4. Testing vs Production Configuration

```typescript
const isProduction = process.env.NODE_ENV === 'production';

const server = createRpcAiServer({
  providers: isProduction
    ? [
        // Production: restricted models with monitoring
        {
          name: 'anthropic',
          apiKey: process.env.ANTHROPIC_API_KEY,
          defaultModel: 'claude-3-5-haiku-20241022',
          modelRestrictions: {
            allowedModels: ['claude-3-5-haiku-20241022', 'claude-3-5-sonnet-20241022']
          }
        }
      ]
    : [
        // Development: allow all models
        'anthropic',
        'openai',
        'google'
      ]
});
```

---

## Migration from Legacy Configuration

### Before (Legacy Split Configuration)

```typescript
{
  serverProviders: ['anthropic', 'openai'],
  byokProviders: ['google'],

  customProviders: [{
    name: 'deepseek',
    baseUrl: 'https://api.deepseek.com/v1',
    apiKeyHeader: 'Authorization',
    apiKeyPrefix: 'Bearer ',
    defaultModel: 'deepseek-chat'
  }],

  systemPrompts: {
    'code-review': 'You are an expert code reviewer...'
  },

  modelRestrictions: {
    anthropic: {
      allowedModels: ['claude-3-5-sonnet-20241022']
    }
  }
}
```

### After (Unified Configuration)

```typescript
{
  providers: [
    // Server providers with restrictions
    {
      name: 'anthropic',
      apiKey: process.env.ANTHROPIC_API_KEY,
      modelRestrictions: {
        allowedModels: ['claude-3-5-sonnet-20241022']
      }
    },
    'openai',  // Server provider (simple)

    // BYOK provider
    'google',

    // Custom provider
    {
      name: 'deepseek',
      type: 'openai',
      baseUrl: 'https://api.deepseek.com/v1',
      apiKey: process.env.DEEPSEEK_API_KEY,
      defaultModel: 'deepseek-chat'
    }
  ],

  systemPrompts: {
    'code-review': 'You are an expert code reviewer...'
  }
}
```

---

## Configuration Priority

When the same setting is specified in multiple places, the priority is:

1. **Provider-specific config** (in `ProviderConfig` object)
2. **Global config** (at root level)
3. **Environment variables**
4. **Built-in defaults**

### Example

```typescript
{
  providers: [
    {
      name: 'anthropic',
      apiKey: 'provider-specific-key',  // Highest priority
      systemPrompts: {
        'default': 'Provider-specific prompt'  // Overrides global
      }
    }
  ],

  systemPrompts: {
    'default': 'Global prompt',  // Lower priority
    'other': 'Used if not overridden'
  }
}
```

**Result:**
- Anthropic uses: `'provider-specific-key'` and `'Provider-specific prompt'`
- Other providers use: Environment variables and `'Global prompt'`

---

## Best Practices

### 1. Use String Form for Simple Cases

```typescript
// ✅ Good: Simple and readable
{
  providers: ['anthropic', 'openai', 'google']
}

// ❌ Unnecessary complexity
{
  providers: [
    { name: 'anthropic' },
    { name: 'openai' },
    { name: 'google' }
  ]
}
```

### 2. Use Object Form for Customization

```typescript
// ✅ Good: Clear why object form is needed
{
  providers: [
    'openai',  // Standard config
    {
      name: 'anthropic',
      defaultModel: 'claude-3-5-haiku-20241022',  // Custom default
      modelRestrictions: {
        allowedModels: ['claude-3-5-haiku-20241022']
      }
    }
  ]
}
```

### 3. Keep API Keys in Environment Variables

```typescript
// ✅ Good: Secure
{
  providers: [
    {
      name: 'anthropic',
      apiKey: process.env.ANTHROPIC_API_KEY
    }
  ]
}

// ❌ Bad: Hardcoded secrets
{
  providers: [
    {
      name: 'anthropic',
      apiKey: 'sk-ant-...'  // Never do this!
    }
  ]
}
```

### 4. Document Custom Providers

```typescript
{
  providers: [
    'anthropic',

    // Custom provider: DeepSeek via OpenAI-compatible API
    // Docs: https://platform.deepseek.com/api-docs
    {
      name: 'deepseek',
      type: 'openai',
      baseUrl: 'https://api.deepseek.com/v1',
      apiKey: process.env.DEEPSEEK_API_KEY,
      defaultModel: 'deepseek-chat'
    }
  ]
}
```

---

## Troubleshooting

### Provider Not Found

**Error:** `Provider 'xyz' not found in available providers`

**Solution:** Check that the provider name is correct and either:
1. Environment variable is set (e.g., `XYZ_API_KEY`)
2. `apiKey` is provided in the config object
3. Provider is listed in `providers` array

### Model Not Allowed

**Error:** `Model 'claude-opus-*' is not allowed for provider 'anthropic'`

**Solution:** Check `modelRestrictions` configuration:

```typescript
{
  providers: [
    {
      name: 'anthropic',
      modelRestrictions: {
        allowedModels: ['claude-3-5-sonnet-20241022'],  // Add your model here
        // OR use patterns:
        allowedPatterns: ['claude-3-5-*']
      }
    }
  ]
}
```

### Custom Provider Not Working

**Issue:** Custom provider connection fails

**Checklist:**
1. ✅ Is `type` specified? (e.g., `type: 'openai'`)
2. ✅ Is `baseUrl` correct and accessible?
3. ✅ Is `apiKey` provided or environment variable set?
4. ✅ Is the API OpenAI/Anthropic/Google compatible?

```typescript
{
  providers: [
    {
      name: 'my-custom-provider',
      type: 'openai',  // Required for custom providers
      baseUrl: 'https://api.example.com/v1',  // Check this URL
      apiKey: process.env.CUSTOM_API_KEY,     // Verify this is set
      defaultModel: 'model-name'
    }
  ]
}
```

---

## See Also

- [Server Configuration]({% link common-configurations/configuration.md %}) - Complete configuration options
- [Model Registry]({% link server-api/registry.md %}) - Available models and providers
- [API Keys]({% link common-configurations/api-keys.md %}) - Managing API keys and BYOK
