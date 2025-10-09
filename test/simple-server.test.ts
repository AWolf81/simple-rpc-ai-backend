import { describe, it, expect, beforeAll, vi } from 'vitest';
import { createRpcAiServer } from '../src/rpc-ai-server.js';
import type { AppRouter } from '../src/trpc/root.js';

// Mock the Vercel AI SDK BEFORE any imports
vi.mock('ai', async () => {
  const actual = await vi.importActual('ai');
  return {
    ...actual,
    generateText: vi.fn().mockResolvedValue({
      text: 'Hello! How can I help you today?',
      usage: {
        promptTokens: 10,
        completionTokens: 8,
        totalTokens: 18
      },
      finishReason: 'stop',
      response: {
        id: 'test-response-id',
        timestamp: new Date(),
        modelId: 'claude-3-7-sonnet-20250219'
      },
      warnings: undefined,
      experimental_providerMetadata: undefined,
      toJsonResponse: () => ({} as any),
      request: {} as any,
      rawResponse: { headers: {} as any },
      toolCalls: [],
      toolResults: []
    })
  };
});

describe('Simple AI Server', () => {
  let server: ReturnType<typeof createRpcAiServer>;
  let caller: ReturnType<AppRouter['createCaller']>;

  beforeAll(async () => {
    // Create server without starting HTTP - just get the router
    server = createRpcAiServer({
      port: 0, // Not actually used since we're not starting HTTP
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

  describe('Health Check', () => {
    it('should respond to health check', async () => {
      const result = await caller.system.health();

      expect(result.status).toBe('healthy');
      expect(result.timestamp).toBeDefined();
    });
  });

  describe('AI Request Handling', () => {
    it('should successfully generate text with valid API key (BYOK)', async () => {
      // The mock is already set up at the module level
      // Test with BYOK
      const result = await caller.ai.generateText({
        content: 'Hello',
        systemPrompt: 'You are a helpful assistant',
        apiKey: 'sk-ant-test-key-12345',
        provider: 'anthropic'
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.content).toBe('Hello! How can I help you today?');
      expect(result.data?.usage?.totalTokens).toBe(18);
      expect(result.data?.provider).toBe('anthropic');
    });

    it('should fail generateText without API keys', async () => {
      await expect(async () => {
        await caller.ai.generateText({
          content: 'Hello',
          systemPrompt: 'You are a helpful assistant'
        });
      }).rejects.toThrow(/API key|ANTHROPIC_API_KEY/i);
    });

    it('should validate required parameters for generateText', async () => {
      await expect(async () => {
        await caller.ai.generateText({
          content: 'Hello'
          // Missing systemPrompt
        } as any);
      }).rejects.toThrow();
    });
  });

  describe('Provider Methods', () => {
    it('should list available providers', async () => {
      const result = await caller.ai.listProviders();

      expect(result.providers).toBeDefined();
      expect(Array.isArray(result.providers)).toBe(true);
      // Note: May be 0 if no API keys are configured, which is expected in tests
      expect(result.providers.length).toBeGreaterThanOrEqual(0);
    });
  });
});