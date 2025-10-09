# TypeScript Usage Guide

This guide covers recommended TypeScript patterns for using `simple-rpc-ai-backend` in your projects.

## Installation for TypeScript Projects

```bash
npm install simple-rpc-ai-backend
# or
pnpm add simple-rpc-ai-backend
```

The package includes full TypeScript definitions out of the box.

## Type-Safe Server Configuration

### Using `satisfies` for Type Checking

Use the `satisfies` keyword to get type checking while preserving literal types:

```typescript
import { createRpcAiServer, type RpcAiServerConfig } from 'simple-rpc-ai-backend';

const config = {
  port: 8000,
  serverProviders: ['anthropic', 'openai'],
  protocols: {
    jsonRpc: true,
    tRpc: true
  },
  mcp: {
    enabled: true,
    transports: {
      http: true,
      stdio: false,
      sse: false
    }
  },
  systemPrompts: {
    default: 'You are a helpful assistant',
    coding: 'You are an expert programmer'
  }
} satisfies RpcAiServerConfig;

const server = createRpcAiServer(config);
```

**Benefits of `satisfies`:**
- ✅ Type checking - Catches configuration errors at compile time
- ✅ Preserves literal types - IntelliSense shows exact values
- ✅ No type widening - String literals stay as literals, not `string`

### Alternative: `defineRpcAiServerConfig` Helper

```typescript
import { createRpcAiServer, defineRpcAiServerConfig } from 'simple-rpc-ai-backend';

const config = defineRpcAiServerConfig({
  port: 8000,
  serverProviders: ['anthropic', 'openai'],
  // ... full type checking and IntelliSense
});

const server = createRpcAiServer(config);
```

## Type-Safe tRPC Client

### Creating a Typed Client

```typescript
import { createTypedAIClient } from 'simple-rpc-ai-backend';
import { httpBatchLink } from '@trpc/client';
import type { AppRouter } from 'simple-rpc-ai-backend';

const client = createTypedAIClient({
  links: [
    httpBatchLink({
      url: 'http://localhost:8000/trpc',
      headers: () => ({
        authorization: `Bearer ${getToken()}`
      })
    })
  ]
});

// Fully typed!
const result = await client.ai.generateText.mutate({
  content: 'Hello',
  systemPrompt: 'You are helpful',
  provider: 'anthropic' // TypeScript knows valid providers!
});
```

### Inferring Types from Router

```typescript
import type { AppRouter } from 'simple-rpc-ai-backend';
import type { inferRouterInputs, inferRouterOutputs } from '@trpc/server';

// Input types for all procedures
type RouterInput = inferRouterInputs<AppRouter>;
type GenerateTextInput = RouterInput['ai']['generateText'];

// Output types for all procedures
type RouterOutput = inferRouterOutputs<AppRouter>;
type GenerateTextOutput = RouterOutput['ai']['generateText'];

// Use in your code
function handleAIResponse(response: GenerateTextOutput) {
  if (response.success) {
    console.log(response.data.content);
  }
}
```

## Type-Safe Custom Routers

```typescript
import { router, publicProcedure, createMCPTool } from 'simple-rpc-ai-backend';
import { z } from 'zod';

// Define your router with full type safety
const customRouter = router({
  myProcedure: publicProcedure
    .meta(createMCPTool({
      name: 'myTool',
      description: 'Does something useful',
      category: 'custom'
    }))
    .input(z.object({
      text: z.string(),
      count: z.number().min(1).max(10)
    }))
    .mutation(async ({ input }) => {
      // input is fully typed!
      return {
        result: input.text.repeat(input.count)
      };
    })
});

// Add to server
const server = createRpcAiServer({
  customRouters: {
    custom: customRouter
  }
});

// Type-safe client usage
const result = await client.custom.myProcedure.mutate({
  text: 'Hello',
  count: 3 // TypeScript knows count must be 1-10
});
```

## Testing with Full Type Safety

```typescript
import { describe, it, expect } from 'vitest';
import { createRpcAiServer, createTestCaller } from 'simple-rpc-ai-backend';
import type { AppRouter } from 'simple-rpc-ai-backend';

describe('My Tests', () => {
  let server: ReturnType<typeof createRpcAiServer>;
  let caller: ReturnType<AppRouter['createCaller']>;

  beforeAll(async () => {
    server = createRpcAiServer({ port: 0 });

    // Use the helper - much simpler!
    const { caller: testCaller } = await createTestCaller(server, {
      user: { id: '123', email: 'test@example.com' },
      apiKey: 'sk-test-key'
    });

    caller = testCaller;
  });

  it('should have typed responses', async () => {
    const result = await caller.system.health();

    // TypeScript knows the shape!
    expect(result.status).toBe('healthy');
    expect(result.timestamp).toBeDefined();
  });
});
```

## Type Guards and Validation

### Runtime Type Validation with Zod

```typescript
import { z } from 'zod';

// Define schema
const aiResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    content: z.string(),
    usage: z.object({
      promptTokens: z.number(),
      completionTokens: z.number(),
      totalTokens: z.number()
    })
  }).optional(),
  error: z.string().optional()
});

// Type from schema
type AIResponse = z.infer<typeof aiResponseSchema>;

// Validate at runtime
function validateResponse(data: unknown): AIResponse {
  return aiResponseSchema.parse(data);
}
```

## Utility Types

The package exports useful utility types:

```typescript
import type {
  RpcAiServerConfig,
  AppRouter,
  ExecuteRequest,
  ExecuteResult,
  MCPConfig,
  ServiceProvider
} from 'simple-rpc-ai-backend';

// Use in your code
function processAIResult(result: ExecuteResult) {
  console.log(`Used ${result.usage.totalTokens} tokens`);
}

function configureProvider(provider: ServiceProvider) {
  // TypeScript knows all provider fields
}
```

## Common Patterns

### Type-Safe Environment Variables

**Important**: The library has **no required environment variables** - it works with BYOK (Bring Your Own Key). However, if you want to use server-side AI providers, you'll need to configure API keys.

#### Validation Pattern (Recommended)

```typescript
import { z } from 'zod';

const envSchema = z.object({
  // Server config
  PORT: z.string().transform(Number).default('8000'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Optional: Server-side AI provider keys (if not using BYOK)
  ANTHROPIC_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  GOOGLE_API_KEY: z.string().optional(),

  // Optional: OAuth configuration
  OAUTH_SECRET_KEY: z.string().optional(),

  // Optional: Database (if using billing/subscriptions)
  DATABASE_URL: z.string().optional()
});

const env = envSchema.parse(process.env);

const server = createRpcAiServer({
  port: env.PORT,

  // Only include providers with API keys
  serverProviders: [
    env.ANTHROPIC_API_KEY && 'anthropic',
    env.OPENAI_API_KEY && 'openai',
    env.GOOGLE_API_KEY && 'google'
  ].filter(Boolean) as Array<'anthropic' | 'openai' | 'google'>
});
```

#### Strict Validation (Require Keys)

If you want to **require** certain API keys:

```typescript
const envSchema = z.object({
  PORT: z.string().transform(Number).default('8000'),

  // REQUIRED: At least one provider must be configured
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  OPENAI_API_KEY: z.string().min(1).optional()
}).refine(
  (env) => env.ANTHROPIC_API_KEY || env.OPENAI_API_KEY,
  {
    message: 'At least one AI provider API key is required (ANTHROPIC_API_KEY or OPENAI_API_KEY)'
  }
);

// Will throw if no API keys are configured
const env = envSchema.parse(process.env);
```

#### BYOK-Only Mode (No Server Keys)

If you only want BYOK and no server-side AI:

```typescript
const server = createRpcAiServer({
  port: 8000,
  serverProviders: [], // Empty - users must provide their own API keys

  // Other features still work
  mcp: { enabled: true },
  protocols: { jsonRpc: true, tRpc: true }
});

// Users must now pass apiKey in their requests
await client.ai.generateText.mutate({
  content: 'Hello',
  systemPrompt: 'You are helpful',
  apiKey: 'sk-user-provided-key', // Required when no server providers
  provider: 'anthropic'
});
```

#### Using dotenv

```typescript
import 'dotenv/config';
import { z } from 'zod';

// Load .env file first, then validate
const env = z.object({
  ANTHROPIC_API_KEY: z.string().optional(),
  // ... rest of schema
}).parse(process.env);
```

### Discriminated Unions for Responses

```typescript
type AIResult =
  | { success: true; data: { content: string } }
  | { success: false; error: string };

function handleResult(result: AIResult) {
  if (result.success) {
    // TypeScript knows `data` exists
    console.log(result.data.content);
  } else {
    // TypeScript knows `error` exists
    console.error(result.error);
  }
}
```

## Migration from JavaScript

If you have existing JavaScript code:

1. **Rename files** from `.js` to `.ts`
2. **Add type annotations** gradually:
   ```typescript
   // Before (JS)
   const config = {
     port: 8000
   };

   // After (TS)
   const config: RpcAiServerConfig = {
     port: 8000
   };
   ```
3. **Use `satisfies`** for better inference:
   ```typescript
   const config = {
     port: 8000
   } satisfies RpcAiServerConfig;
   ```

## tsconfig.json Recommendations

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  }
}
```

## See Also

- [Testing Guide](./TESTING_TRPC.md) - Type-safe testing patterns
- [API Documentation](./API.md) - Full API reference with types
- [tRPC Docs](https://trpc.io/docs/client/vanilla/infer-types) - Type inference guide
