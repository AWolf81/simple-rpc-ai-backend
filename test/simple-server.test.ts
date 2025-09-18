import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createRpcAiServer } from '../src/rpc-ai-server.js';
import { RPCClient } from '../src/client.js';

describe('Simple AI Server', () => {
  let server: any;
  let client: RPCClient;

  beforeAll(async () => {
    // Create and start server
    server = createRpcAiServer({
      port: 8002, // Use different port to avoid conflicts
      protocols: { jsonRpc: true, tRpc: false }
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
      // Health method doesn't require parameters
      const result = await client.request('health');
      
      expect(result.status).toBe('healthy');
      expect(result.timestamp).toBeDefined();
    });
  });

  describe('AI Request Handling', () => {
    it('should handle generateText method (will fail without API keys)', async () => {
      try {
        await client.request('generateText', {
          content: 'Hello',
          systemPrompt: 'You are a helpful assistant'
        });
        // If this doesn't throw, something is wrong with our error handling
        expect(false).toBe(true);
      } catch (error: any) {
        // Should fail because no API keys are configured - expect Invalid params for now
        expect(error.message).toContain('Invalid params');
      }
    });

    it('should validate required parameters for generateText', async () => {
      try {
        await client.request('generateText', {
          content: 'Hello'
          // Missing systemPrompt
        });
        expect(false).toBe(true);
      } catch (error: any) {
        // Zod validation failure maps to Invalid params
        expect(error.message).toContain('Invalid params');
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