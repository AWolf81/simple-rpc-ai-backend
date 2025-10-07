---
title: Testing tRPC Procedures
parent: Tips & Tricks
grand_parent: Documentation
nav_order: 1
---

# Testing tRPC Procedures

This guide explains the recommended approach for testing tRPC procedures in this project using the `createCaller` pattern.

## Overview

Instead of spinning up an HTTP server and making requests with `supertest`, we test tRPC procedures **directly** using the `createCaller` pattern. This approach is:

- ✅ **Faster** – no HTTP overhead, no server startup time
- ✅ **Type-safe** – full TypeScript inference from `AppRouter`
- ✅ **Isolated** – no port conflicts or network plumbing
- ✅ **Predictable** – fewer race conditions and async server issues
- ✅ **Mockable** – direct control over context (user, apiKey, etc.)

## Basic Pattern

```ts
import { describe, it, expect, beforeAll } from 'vitest';
import { createRpcAiServer } from '../src/rpc-ai-server';
import type { AppRouter } from '../src/trpc/root';

describe('My Feature', () => {
  let server: ReturnType<typeof createRpcAiServer>;
  let caller: ReturnType<AppRouter['createCaller']>;

  beforeAll(async () => {
    server = createRpcAiServer({
      port: 0,
      protocols: { jsonRpc: true, tRpc: true }
    });

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

Use the helpers in `test/utils/trpc-context.ts` to keep tests concise:

```ts
import { createContextInner, createTestCaller } from '../test/utils/trpc-context';

const ctx = await createContextInner({});
const caller = server.getRouter().createCaller(ctx);

const { caller: withUser } = await createTestCaller(server, {
  user: { id: '123', email: 'test@example.com' }
});
```

## Testing Different Scenarios

### Anonymous User (No Authentication)

```ts
await expect(async () => {
  const ctx = await createContextInner({});
  const caller = server.getRouter().createCaller(ctx);

  await caller.ai.generateText({
    content: 'Hello',
    systemPrompt: 'You are helpful'
  });
}).rejects.toThrow(/API key/i);
```

### Authenticated User

```ts
const ctx = await createContextInner({
  user: { id: '123', email: 'test@example.com' }
});
const caller = server.getRouter().createCaller(ctx);

const result = await caller.user.getCurrentUser();
expect(result.user.email).toBe('test@example.com');
```

### BYOK (Bring Your Own Key)

```ts
const ctx = await createContextInner({
  apiKey: 'sk-test-key-12345'
});
const caller = server.getRouter().createCaller(ctx);

const result = await caller.ai.generateText({
  content: 'Hello',
  systemPrompt: 'You are helpful'
});

expect(result.success).toBe(true);
```

## Mocking External Dependencies

Use Vitest mocks to isolate third-party APIs:

```ts
vi.mock('@ai-sdk/anthropic', () => ({
  createClient: () => ({
    generateText: vi.fn().mockResolvedValue({ text: 'mocked' })
  })
}));
```

## Integration Tests

If you still want to exercise the HTTP stack, spin up the server in `beforeAll` with a random port:

```ts
beforeAll(async () => {
  server = createRpcAiServer({ port: 0 });
  await server.start();
});

afterAll(async () => {
  await server.stop();
});
```

Then use `fetch` or `supertest` against `server.getHttpAddress()`.

## Summary

- Prefer `createCaller` for most tests: fast, typed, deterministic.
- Mock context to simulate authentication or API keys.
- Only start the HTTP server when validating transport-level behaviour.
