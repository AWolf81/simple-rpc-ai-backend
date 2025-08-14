import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createSimpleAIServer } from '../src/server-simple.js';
import { RPCClient } from '../src/client.js';

describe('Simple AI Server', () => {
  let server: any;
  let client: RPCClient;

  beforeAll(async () => {
    // Create and start server
    server = createSimpleAIServer({
      port: 8002, // Use different port to avoid conflicts
      serviceProviders: {
        anthropic: { priority: 1 }, // Will work without API keys for health checks
        openai: { priority: 2 },
        google: { priority: 3 }
      }
    });
    
    await server.start();
    client = new RPCClient('http://localhost:8002');
    
    // Give server a moment to fully start
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  afterAll(async () => {
    if (server) {
      await server.stop();
    }
  });

  describe('Health Check', () => {
    it('should respond to health endpoint', async () => {
      const response = await fetch('http://localhost:8002/health');
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.status).toBe('healthy');
      expect(data.timestamp).toBeDefined();
    });

    it('should respond to JSON-RPC health method', async () => {
      const result = await client.request('health', {});
      
      expect(result.status).toBe('healthy');
      expect(result.timestamp).toBeDefined();
    });
  });

  describe('AI Request Handling', () => {
    it('should handle executeAIRequest method (will fail without API keys)', async () => {
      try {
        await client.request('executeAIRequest', {
          content: 'Hello',
          systemPrompt: 'You are a helpful assistant'
        });
        // If this doesn't throw, something is wrong with our error handling
        expect(false).toBe(true);
      } catch (error: any) {
        // Should fail because no API keys are configured
        expect(error.message).toContain('AI service error');
      }
    });

    it('should validate required parameters for executeAIRequest', async () => {
      try {
        await client.request('executeAIRequest', {
          content: 'Hello'
          // Missing systemPrompt
        });
        expect(false).toBe(true);
      } catch (error: any) {
        expect(error.message).toContain('content and systemPrompt are required');
      }
    });
  });

  describe('Unknown Methods', () => {
    it('should handle unknown methods gracefully', async () => {
      try {
        await client.request('unknownMethod', {});
        expect(false).toBe(true);
      } catch (error: any) {
        expect(error.message).toContain('Method not found');
      }
    });
  });
});