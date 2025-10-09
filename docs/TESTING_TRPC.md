# Testing tRPC Procedures

This guide explains the recommended approach for testing tRPC procedures in this project using the `createCaller` pattern.

## Overview

Instead of spinning up a HTTP server and making requests with `supertest`, we test tRPC procedures **directly** using the `createCaller` pattern. This approach is:

- ✅ **Faster** - No HTTP overhead, no server startup time
- ✅ **Type-safe** - Full TypeScript inference from AppRouter
- ✅ **Isolated** - No port conflicts, no network layer
- ✅ **Predictable** - No race conditions or async server issues
- ✅ **Easier to mock** - Direct control over context (user, apiKey, etc.)

## Basic Pattern

```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import { createRpcAiServer } from '../src/rpc-ai-server';
import type { AppRouter } from '../src/trpc/root';

describe('My Feature', () => {
  let server: ReturnType<typeof createRpcAiServer>;
  let caller: ReturnType<AppRouter['createCaller']>;

  beforeAll(async () => {
    // Create server (no HTTP needed!)
    server = createRpcAiServer({
      port: 0, // Not used since we're not starting HTTP
      protocols: { jsonRpc: true, tRpc: true }
    });

    // Create a tRPC caller with mock context
    const mockContext = {
      user: null,
      apiKey: undefined,
      req: undefined,
      res: undefined
    };

    caller = server.getRouter().createCaller(mockContext);
  });

  it('should work', async () => {
    const result = await caller.system.health();
    expect(result.status).toBe('healthy');
  });
});
```

## Using Context Helpers

We provide helper functions to make creating contexts easier:

```typescript
import { createContextInner, createTestCaller } from '../test/utils/trpc-context';

// Method 1: Using createContextInner
const ctx = await createContextInner({ user: null });
const caller = server.getRouter().createCaller(ctx);

// Method 2: Using createTestCaller (shorthand)
const { caller, context } = await createTestCaller(server, {
  user: { id: '123', email: 'test@example.com' }
});
```

## Testing Different Scenarios

### Anonymous User (No Authentication)

```typescript
it('should fail without API keys', async () => {
  const ctx = await createContextInner({});
  const caller = server.getRouter().createCaller(ctx);

  await expect(async () => {
    await caller.ai.generateText({
      content: 'Hello',
      systemPrompt: 'You are helpful'
    });
  }).rejects.toThrow(/API key|ANTHROPIC_API_KEY/i);
});
```

### Authenticated User

```typescript
it('should succeed with user context', async () => {
  const ctx = await createContextInner({
    user: { id: '123', email: 'test@example.com' }
  });
  const caller = server.getRouter().createCaller(ctx);

  const result = await caller.user.getCurrentUser();
  expect(result.user.email).toBe('test@example.com');
});
```

### BYOK (Bring Your Own Key)

```typescript
it('should work with user-provided API key', async () => {
  const ctx = await createContextInner({
    apiKey: 'sk-test-key-12345'
  });
  const caller = server.getRouter().createCaller(ctx);

  // The apiKey from context will be used
  const result = await caller.ai.generateText({
    content: 'Hello',
    systemPrompt: 'You are helpful'
  });

  expect(result.success).toBe(true);
});
```

## Mocking External Dependencies

When testing procedures that call external APIs (like AI providers), mock at the SDK level:

```typescript
import { vi } from 'vitest';

// Mock the Vercel AI SDK
vi.mock('ai', async () => {
  const actual = await vi.importActual('ai');
  return {
    ...actual,
    generateText: vi.fn().mockResolvedValue({
      text: 'Mocked AI response',
      usage: {
        promptTokens: 10,
        completionTokens: 8,
        totalTokens: 18
      },
      finishReason: 'stop',
      // ... other required fields
    })
  };
});

it('should use mocked AI response', async () => {
  const result = await caller.ai.generateText({
    content: 'Hello',
    systemPrompt: 'You are helpful',
    apiKey: 'sk-test-key'
  });

  expect(result.data.content).toBe('Mocked AI response');
});
```

## Testing Input Validation

```typescript
it('should validate required parameters', async () => {
  await expect(async () => {
    await caller.ai.generateText({
      content: 'Hello'
      // Missing systemPrompt
    } as any);
  }).rejects.toThrow();
});
```

## Complete Example

See [test/simple-server.test.ts](../test/simple-server.test.ts) for a complete working example that demonstrates:

- Creating a test server without HTTP
- Using `createCaller` with mock context
- Mocking the Vercel AI SDK
- Testing success and error cases
- Validating input parameters

## When to Use HTTP Testing

The `createCaller` pattern is perfect for testing **business logic**. However, you should still use HTTP testing (with `supertest`) when testing:

- **Protocol layer** - MCP protocol handlers, JSON-RPC formatting
- **HTTP middleware** - CORS, authentication middleware, rate limiting
- **Headers and responses** - Security headers, status codes
- **Integration** - Full request/response cycle

For these cases, see [test/mcp/mcp-security.test.ts](../test/mcp/mcp-security.test.ts) as an example.

## Benefits Summary

| Aspect | HTTP Testing | tRPC Caller Testing |
|--------|-------------|---------------------|
| Speed | Slow (~2s+) | Fast (~50ms) |
| Type Safety | None | Full TypeScript |
| Port Conflicts | Yes | No |
| Mocking | Complex | Simple |
| Best For | Protocol/middleware | Business logic |

## See Also

- [tRPC Testing Docs](https://trpc.io/docs/server/server-side-calls)
- [test/utils/trpc-context.ts](../test/utils/trpc-context.ts) - Context helpers
- [test/simple-server.test.ts](../test/simple-server.test.ts) - Complete example
