# API Keys

This document explains how API keys are managed and used in the Simple RPC AI Backend.

## Overview

The server supports two types of API keys:

1. **Server Keys** - Configured at the server level, shared across all users
2. **BYOK (Bring Your Own Key)** - User-provided keys for personalized billing

## API Key Priority Flow

When a request is made, the server determines which API key to use following this priority:

```
1. User BYOK (if authenticated) → User provides their own API key
2. Server Keys (if configured) → Server-managed keys for the provider
3. Request Rejected → No valid key found
```

### Detailed Flow

```typescript
// Request comes in with provider='anthropic'

// Step 1: Check for BYOK (user authenticated + has stored key)
if (user.isAuthenticated && user.hasStoredKey('anthropic')) {
  apiKey = user.getStoredKey('anthropic');  // User's personal key
}

// Step 2: Check server configuration
else if (serverProviders.includes('anthropic')) {
  apiKey = process.env.ANTHROPIC_API_KEY;  // Server key from env
}

// Step 3: No valid key found
else {
  throw new Error('API key required for public usage');
}
```

## Server Keys

### Configuration

Server keys are configured via the `providers` or `serverProviders` option:

```typescript
import { createRpcAiServer } from 'simple-rpc-ai-backend';

const server = createRpcAiServer({
  providers: ['anthropic', 'openai', 'google']
});
```

### Environment Variables

The server reads API keys from environment variables:

```bash
# .env file
ANTHROPIC_API_KEY=sk-ant-api03-...
OPENAI_API_KEY=sk-proj-...
GOOGLE_API_KEY=AIzaSy...
OPENROUTER_API_KEY=sk-or-v1-...
HUGGINGFACE_API_KEY=hf_...
```

### Provider Validation

When `providers` is configured, the server validates all requests:

```typescript
// ✅ ALLOWED: Only anthropic and openai
createRpcAiServer({
  providers: ['anthropic', 'openai']
})

// ❌ BLOCKED: Request with provider='google' will be rejected
// Error: Provider 'google' is not allowed. Allowed providers: anthropic, openai
```

### Special Configurations

#### Allow All Providers (BYOK Mode)

```typescript
// undefined = auto-detect all providers from environment variables
createRpcAiServer()  // No providers specified

// Will auto-detect: ANTHROPIC_API_KEY, OPENAI_API_KEY, etc.
// Allows users to use any provider with their own API keys
```

#### Block All Providers

```typescript
// Empty array = block all AI providers
createRpcAiServer({
  providers: []
})

// All AI requests will be rejected
// Useful for servers that only expose MCP/system tools
```

## BYOK (Bring Your Own Key)

### Overview

BYOK allows authenticated users to provide their own API keys, enabling:
- Personal billing (charged directly to user's provider account)
- Custom model access (if user has special access)
- Privacy (keys stored encrypted)

### Storing Keys

Users can store their keys via the `user.storeApiKey` method:

```typescript
await client.user.storeApiKey.mutate({
  email: 'user@example.com',
  provider: 'anthropic',
  apiKey: 'sk-ant-api03-...',
  encryptionKey: 'user-password-derived-key'
});
```

### Using BYOK

When a user makes a request with authentication:

```typescript
// User's stored key is automatically used
const result = await client.ai.generateText.mutate({
  content: 'Hello',
  systemPrompt: 'default',
  provider: 'anthropic'
  // No apiKey needed - uses stored BYOK
});
```

### Key Priority with BYOK

```
Authenticated User Request:
1. User's stored BYOK → Personal key (if available)
2. Server key → Shared key (fallback)
3. Error → No key available

Public/Anonymous Request:
1. Server key → Shared key (only option)
2. Error → No key available
```

## Extended Provider Configuration

For advanced use cases, use object-based configuration:

```typescript
createRpcAiServer({
  providers: [
    // Simple string (uses env var)
    'anthropic',

    // Extended config with explicit key
    {
      name: 'openai',
      apiKey: process.env.CUSTOM_OPENAI_KEY,  // Explicit key
      defaultModel: 'gpt-4o',                  // Default model
      systemPrompts: {
        'coding': 'You are an expert programmer'
      }
    },

    // Custom provider (OpenAI-compatible)
    {
      name: 'deepseek',
      type: 'openai',                          // Use OpenAI SDK
      apiKey: process.env.DEEPSEEK_KEY,
      baseUrl: 'https://api.deepseek.com/v1',
      defaultModel: 'deepseek-chat'
    }
  ]
})
```

## Security Best Practices

### Server Keys

1. **Environment Variables** - Never hardcode keys in source code
2. **Rotation** - Rotate server keys periodically
3. **Monitoring** - Monitor usage for anomalies
4. **Least Privilege** - Only configure providers you actually use

```typescript
// ✅ GOOD: Explicit provider list
providers: ['anthropic', 'openai']

// ⚠️ RISKY: Allow all (only for trusted environments)
providers: undefined
```

### BYOK Keys

1. **Encryption** - All BYOK keys are encrypted at rest (AES-256-GCM)
2. **User-Scoped** - Keys are isolated per user
3. **No Server Access** - Encrypted with user-derived key (server can't decrypt)
4. **Deletion** - Users can delete their keys anytime

## Examples

### Scenario 1: Public API (Server Keys Only)

```typescript
// Server provides all keys
const server = createRpcAiServer({
  providers: ['anthropic', 'openai']
});

// Anonymous users can make requests using server keys
// No authentication required
```

### Scenario 2: Enterprise (BYOK Required)

```typescript
// No server keys - users must provide their own
const server = createRpcAiServer({
  providers: []  // Block all
});

// All requests must include authentication + BYOK
// Perfect for enterprise where each user has their own provider account
```

### Scenario 3: Hybrid (Server + BYOK)

```typescript
// Provide fallback server keys
const server = createRpcAiServer({
  providers: ['anthropic']  // Server has Anthropic key
});

// Users can:
// - Use server's Anthropic key (anonymous or authenticated)
// - Use their own OpenAI key (BYOK, authenticated only)
// - Cannot use Google (not configured)
```

### Scenario 4: Multi-Provider with Fallback

```typescript
const server = createRpcAiServer({
  providers: [
    {
      name: 'anthropic',
      apiKey: process.env.ANTHROPIC_KEY,
      defaultModel: 'claude-3-5-sonnet-20241022'
    },
    {
      name: 'openai',
      apiKey: process.env.OPENAI_KEY,
      defaultModel: 'gpt-4o'
    }
  ]
});

// If Anthropic request fails, client can fallback to OpenAI
// Both providers configured with server keys
```

## API Reference

### Provider Configuration Types

```typescript
type ProviderConfig =
  | string                    // 'anthropic' - simple string
  | {                         // Extended configuration
      name: string;           // Provider name
      apiKey?: string;        // Explicit API key (optional, uses env if not provided)
      defaultModel?: string;  // Default model for this provider
      systemPrompts?: Record<string, string>;
      modelRestrictions?: {
        allowedModels?: string[];
        blockedModels?: string[];
      };

      // For custom providers
      type?: 'openai' | 'anthropic' | 'google';
      baseUrl?: string;
    };
```

### Configuration Options

| Option | Type | Description |
|--------|------|-------------|
| `providers` | `ProviderConfig[]` | Provider whitelist (recommended) |
| `serverProviders` | `string[]` | Legacy provider list (same as `providers`) |
| `byokProviders` | `string[]` | Additional BYOK-only providers |

### Behavior Matrix

| Config | Behavior |
|--------|----------|
| `providers: undefined` | Allow all providers with env vars (BYOK mode) |
| `providers: []` | Block all providers |
| `providers: ['anthropic']` | Only Anthropic allowed |
| `providers: [{name: 'anthropic', apiKey: '...'}]` | Anthropic with explicit key |

## See Also

- [Configuration Guide](./configuration.md)
- [Authentication](../authentication.md)
- [BYOK Setup](../guides/byok-setup.md)
