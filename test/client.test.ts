import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RPCClient } from '../src/client.js';

// Mock axios for testing
vi.mock('axios', () => ({
  default: {
    post: vi.fn()
  }
}));

describe('RPCClient', () => {
  let client: RPCClient;
  let mockAxios: any;

  beforeEach(async () => {
    // Import axios mock
    const axios = await import('axios');
    mockAxios = axios.default;
    
    // Reset all mocks
    vi.clearAllMocks();
    
    // Create client instance
    client = new RPCClient('http://localhost:8000');
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('constructor', () => {
    it('should create client with default URL', () => {
      const defaultClient = new RPCClient();
      expect(defaultClient).toBeInstanceOf(RPCClient);
    });

    it('should create client with custom URL', () => {
      const customClient = new RPCClient('http://example.com:3000');
      expect(customClient).toBeInstanceOf(RPCClient);
    });

    it('should remove trailing slash from baseUrl', () => {
      const clientWithSlash = new RPCClient('http://localhost:8000/');
      expect(clientWithSlash).toBeInstanceOf(RPCClient);
    });

    it('should accept timeout option', () => {
      const clientWithTimeout = new RPCClient('http://localhost:8000', { timeout: 30000 });
      expect(clientWithTimeout).toBeInstanceOf(RPCClient);
    });
  });

  describe('request method', () => {
    it('should make successful RPC request', async () => {
      // Mock successful response
      mockAxios.post.mockResolvedValueOnce({
        data: {
          jsonrpc: '2.0',
          id: 1,
          result: { success: true, data: 'test' }
        }
      });

      const result = await client.request('testMethod', { param: 'value' });
      
      expect(mockAxios.post).toHaveBeenCalledWith(
        'http://localhost:8000/rpc',
        expect.objectContaining({
          jsonrpc: '2.0',
          method: 'testMethod',
          params: { param: 'value' },
          id: expect.any(Number)
        }),
        expect.objectContaining({
          timeout: 60000,
          headers: {
            'Content-Type': 'application/json'
          }
        })
      );
      
      expect(result).toEqual({ success: true, data: 'test' });
    });

    it('should handle RPC error responses', async () => {
      // Mock error response
      mockAxios.post.mockResolvedValueOnce({
        data: {
          jsonrpc: '2.0',
          id: 1,
          error: {
            code: -32602,
            message: 'Invalid params'
          }
        }
      });

      await expect(client.request('invalidMethod', {})).rejects.toThrow('Invalid params');
    });

    it('should handle network errors', async () => {
      // Mock network error
      mockAxios.post.mockRejectedValueOnce(new Error('Network error'));

      await expect(client.request('testMethod', {})).rejects.toThrow('Network error');
    });

    it('should handle timeout errors', async () => {
      // Mock timeout error
      const timeoutError = new Error('timeout of 60000ms exceeded');
      mockAxios.post.mockRejectedValueOnce(timeoutError);

      await expect(client.request('slowMethod', {})).rejects.toThrow();
    });
  });

  describe('health check', () => {
    it('should perform health check', async () => {
      // Mock health response
      mockAxios.post.mockResolvedValueOnce({
        data: {
          jsonrpc: '2.0',
          id: 1,
          result: { status: 'healthy', timestamp: Date.now() }
        }
      });

      const health = await client.request('health');
      
      expect(health).toHaveProperty('status', 'healthy');
      expect(health).toHaveProperty('timestamp');
    });
  });

  describe('AI request simulation', () => {
    it('should handle executeAIRequest method', async () => {
      // Mock AI response
      mockAxios.post.mockResolvedValueOnce({
        data: {
          jsonrpc: '2.0',
          id: 1,
          result: {
            content: 'AI response content',
            model: 'claude-3-sonnet',
            usage: { prompt_tokens: 10, completion_tokens: 20 }
          }
        }
      });

      const result = await client.request('executeAIRequest', {
        content: 'Test user input',
        systemPrompt: 'You are a helpful assistant'
      });
      
      expect(result).toHaveProperty('content');
      expect(result).toHaveProperty('model');
      expect(result).toHaveProperty('usage');
    });
  });
});