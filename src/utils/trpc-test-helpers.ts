/**
 * tRPC Context Helpers for Testing
 *
 * Provides utilities for creating test contexts to use with tRPC's `createCaller` pattern.
 * This approach allows testing tRPC procedures without spinning up an HTTP server.
 *
 * Uses the same context structure as the real tRPC context for type safety.
 */

import type { Request, Response } from 'express';
import type { OpenSaaSJWTPayload } from '../auth/jwt-middleware';

/**
 * Options for creating a test context
 */
export interface CreateContextOptions {
  /** User from JWT token (null for anonymous) */
  user?: OpenSaaSJWTPayload | null;
  /** API key for BYOK (optional) */
  apiKey?: string | null;
  /** Partial Express request object (optional) */
  req?: Partial<Request>;
  /** Partial Express response object (optional) */
  res?: Partial<Response>;
}

/**
 * Inner function for creating context.
 * Matches the exact structure of createTRPCContext for type compatibility.
 *
 * @example
 * ```typescript
 * import { createContextInner } from 'simple-rpc-ai-backend';
 * import { createRpcAiServer } from 'simple-rpc-ai-backend';
 *
 * // Create context for anonymous user
 * const ctx = await createContextInner({});
 * const caller = server.getRouter().createCaller(ctx);
 *
 * // Create context for authenticated user
 * const authCtx = await createContextInner({
 *   user: {
 *     userId: '123',
 *     email: 'test@example.com',
 *     roles: ['user']
 *   },
 *   apiKey: 'sk-test-key'
 * });
 * const authCaller = server.getRouter().createCaller(authCtx);
 * ```
 */
export async function createContextInner(opts: CreateContextOptions = {}) {
  return {
    user: opts.user ?? null,
    apiKey: opts.apiKey ?? null,
    req: opts.req as any,
    res: opts.res as any
  };
}

/**
 * Type helper for inferring context type
 */
export type TestContext = Awaited<ReturnType<typeof createContextInner>>;

/**
 * Helper to create a caller with a specific context
 *
 * @example
 * ```typescript
 * import { createTestCaller } from '../test/utils/trpc-context';
 *
 * const { caller, context } = await createTestCaller(server, {
 *   user: { id: '123', email: 'test@example.com' }
 * });
 *
 * const result = await caller.system.health();
 * ```
 */
export async function createTestCaller(
  server: { getRouter: () => any },
  opts: CreateContextOptions = {}
) {
  const context = await createContextInner(opts);
  const caller = server.getRouter().createCaller(context);

  return { caller, context };
}
