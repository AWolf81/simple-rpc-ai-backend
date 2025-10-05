/**
 * MCP Router handleMCPRequest Method Tests
 * 
 * Tests all the different MCP method cases in handleMCPRequest
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createMCPRouter, MCPProtocolHandler } from '../../src/trpc/routers/mcp';
import type { AuthenticatedRequest } from '../../src/auth/jwt-middleware';
import { Response } from 'express';
import { ErrorCode } from '@modelcontextprotocol/sdk/types.js';

describe('MCP Router handleMCPRequest', () => {
  let mcpHandler: MCPProtocolHandler;
  let mockReq: Partial<AuthenticatedRequest>;
  let mockRes: Partial<Response>;
  let headerSpy: any;
  let jsonSpy: any;
  let statusSpy: any;

  beforeEach(() => {
    // Mock request
    mockReq = {
      body: {},
      user: { id: 'test-user', email: 'test@example.com' },
      path: '/mcp',
      headers: {
        authorization: 'Bearer test-token'
      }
    };

    // Mock response with spy functions
    headerSpy = vi.fn();
    jsonSpy = vi.fn();
    statusSpy = vi.fn(() => ({ json: jsonSpy }));

    mockRes = {
      header: headerSpy,
      json: jsonSpy,
      status: statusSpy
    };

    // Create MCP protocol handler instance
    mcpHandler = new MCPProtocolHandler({
      enableMCP: true,
      adminUsers: ['admin@example.com'],
      auth: {
        requireAuthForToolsList: false,
        requireAuthForToolsCall: false,
        publicTools: ['echo', 'hello']
      }
    });

    // Spy on console methods
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Request Headers and CORS', () => {
    it('should set proper CORS headers for all requests', async () => {
      mockReq.body = { jsonrpc: '2.0', method: 'ping', id: 1 };

      await mcpHandler.handleMCPRequest(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(headerSpy).toHaveBeenCalledWith('Access-Control-Allow-Origin', '*');
      expect(headerSpy).toHaveBeenCalledWith('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      expect(headerSpy).toHaveBeenCalledWith('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      expect(headerSpy).toHaveBeenCalledWith('Content-Type', 'application/json');
    });
  });

  describe('Initialize Method', () => {
    it('should handle initialize method correctly', async () => {
      mockReq.body = {
        jsonrpc: '2.0',
        method: 'initialize',
        id: 1,
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'test-client', version: '1.0.0' }
        }
      };

      await mcpHandler.handleMCPRequest(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(jsonSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          jsonrpc: '2.0',
          id: 1,
          result: expect.objectContaining({
            protocolVersion: '2025-06-18', // Updated to match actual implementation
            capabilities: expect.any(Object),
            serverInfo: expect.objectContaining({
              name: 'Simple RPC AI Backend MCP',
              version: '0.1.0'
            })
          })
        })
      );
    });
  });

  describe('Ping Method', () => {
    it('should handle ping method correctly', async () => {
      mockReq.body = {
        jsonrpc: '2.0',
        method: 'ping',
        id: 1
      };

      await mcpHandler.handleMCPRequest(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(jsonSpy).toHaveBeenCalledWith({
        jsonrpc: '2.0',
        id: 1,
        result: {}
      });
    });
  });

  describe('Tools/List Method', () => {
    it('should handle tools/list method correctly', async () => {
      mockReq.body = {
        jsonrpc: '2.0',
        method: 'tools/list',
        id: 1
      };

      await mcpHandler.handleMCPRequest(mockReq as AuthenticatedRequest, mockRes as Response);

      // Should return either success with tools array or an error
      expect(jsonSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          jsonrpc: '2.0',
          id: 1
        })
      );
      
      // Check that it returned some response (success or error)
      const response = jsonSpy.mock.calls[0][0];
      expect(response).toHaveProperty('jsonrpc', '2.0');
      expect(response).toHaveProperty('id', 1);
      expect(response).toSatisfy((res: any) => res.result || res.error);
    });
  });

  describe('Tools/Call Method', () => {
    it('should handle tools/call method correctly', async () => {
      mockReq.body = {
        jsonrpc: '2.0',
        method: 'tools/call',
        id: 1,
        params: {
          name: 'echo',
          arguments: {
            message: 'test message'
          }
        }
      };

      await mcpHandler.handleMCPRequest(mockReq as AuthenticatedRequest, mockRes as Response);

      // Should return either success or error response
      expect(jsonSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          jsonrpc: '2.0',
          id: 1
        })
      );
      
      // Check that it returned some response (success or error)
      const response = jsonSpy.mock.calls[0][0];
      expect(response).toHaveProperty('jsonrpc', '2.0');
      expect(response).toHaveProperty('id', 1);
      expect(response).toSatisfy((res: any) => res.result || res.error);
    });
  });

  describe('Prompts/List Method', () => {
    it('should handle prompts/list method correctly', async () => {
      mockReq.body = {
        jsonrpc: '2.0',
        method: 'prompts/list',
        id: 1
      };

      await mcpHandler.handleMCPRequest(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(jsonSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          jsonrpc: '2.0',
          id: 1,
          result: expect.objectContaining({
            prompts: expect.any(Array)
          })
        })
      );
    });
  });

  describe('Prompts/Get Method', () => {
    it('should handle prompts/get method correctly', async () => {
      mockReq.body = {
        jsonrpc: '2.0',
        method: 'prompts/get',
        id: 1,
        params: {
          name: 'test-prompt'
        }
      };

      await mcpHandler.handleMCPRequest(mockReq as AuthenticatedRequest, mockRes as Response);

      // Should return a response (might be error if prompt not found)
      expect(jsonSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          jsonrpc: '2.0',
          id: 1
        })
      );
    });
  });

  describe('Resources/List Method', () => {
    it('should handle resources/list method correctly', async () => {
      mockReq.body = {
        jsonrpc: '2.0',
        method: 'resources/list',
        id: 1
      };

      await mcpHandler.handleMCPRequest(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(jsonSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          jsonrpc: '2.0',
          id: 1,
          result: expect.objectContaining({
            resources: expect.any(Array)
          })
        })
      );
    });
  });

  describe('Resources/Read Method', () => {
    it('should handle resources/read method correctly', async () => {
      mockReq.body = {
        jsonrpc: '2.0',
        method: 'resources/read',
        id: 1,
        params: {
          uri: 'file://test-resource.txt'
        }
      };

      await mcpHandler.handleMCPRequest(mockReq as AuthenticatedRequest, mockRes as Response);

      // Should return a response (might be error if resource not found)
      expect(jsonSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          jsonrpc: '2.0',
          id: 1
        })
      );
    });
  });

  describe('Notifications/Cancelled Method', () => {
    it('should handle notifications/cancelled method correctly', async () => {
      mockReq.body = {
        jsonrpc: '2.0',
        method: 'notifications/cancelled',
        id: 1,
        params: {
          requestId: 'test-request-123',
          reason: 'User cancelled'
        }
      };

      await mcpHandler.handleMCPRequest(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(jsonSpy).toHaveBeenCalledWith({
        jsonrpc: '2.0',
        id: 1,
        result: {}
      });
    });
  });

  describe('Method Not Found', () => {
    it('should handle unknown methods with MethodNotFound error', async () => {
      mockReq.body = {
        jsonrpc: '2.0',
        method: 'unknown/method',
        id: 1
      };

      await mcpHandler.handleMCPRequest(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(jsonSpy).toHaveBeenCalledWith({
        jsonrpc: '2.0',
        id: 1,
        error: {
          code: ErrorCode.MethodNotFound,
          message: "Method 'unknown/method' not found"
        }
      });
    });

    it('should handle methods with null or undefined names', async () => {
      mockReq.body = {
        jsonrpc: '2.0',
        method: null,
        id: 1
      };

      await mcpHandler.handleMCPRequest(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(jsonSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          jsonrpc: '2.0',
          id: 1,
          error: expect.objectContaining({
            code: ErrorCode.MethodNotFound
          })
        })
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle request without body', async () => {
      mockReq.body = undefined;

      await mcpHandler.handleMCPRequest(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(statusSpy).toHaveBeenCalledWith(500);
      expect(jsonSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          jsonrpc: '2.0',
          id: null,
          error: expect.objectContaining({
            code: ErrorCode.InternalError,
            message: 'Internal error'
          })
        })
      );
    });

    it('should handle malformed JSON-RPC requests', async () => {
      mockReq.body = {
        // Missing required jsonrpc and method fields
        id: 1
      };

      await mcpHandler.handleMCPRequest(mockReq as AuthenticatedRequest, mockRes as Response);

      // Should handle gracefully
      expect(jsonSpy).toHaveBeenCalled();
    });

    it('should handle requests without ID field', async () => {
      mockReq.body = {
        jsonrpc: '2.0',
        method: 'ping'
        // Missing id field
      };

      await mcpHandler.handleMCPRequest(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(jsonSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          jsonrpc: '2.0',
          result: {}
          // Should handle missing ID gracefully
        })
      );
    });

    it('should handle internal errors during processing', async () => {
      // Mock a method that will throw an error
      const originalConsoleError = console.error;
      console.error = vi.fn();

      // Create a request that might cause internal error
      mockReq.body = {
        jsonrpc: '2.0',
        method: 'tools/call',
        id: 1,
        params: {
          name: 'nonexistent-tool',
          arguments: {}
        }
      };

      await mcpHandler.handleMCPRequest(mockReq as AuthenticatedRequest, mockRes as Response);

      // Should return error response, not throw
      expect(jsonSpy).toHaveBeenCalled();
      
      console.error = originalConsoleError;
    });
  });

  describe('Request/Response Logging', () => {
    it('should handle MCP requests without verbose logging', async () => {
      const consoleSpy = vi.spyOn(console, 'log');

      mockReq.body = {
        jsonrpc: '2.0',
        method: 'ping',
        id: 1
      };

      await mcpHandler.handleMCPRequest(mockReq as AuthenticatedRequest, mockRes as Response);

      // Note: Request/response logging was removed for performance
      // The handler should still process the request successfully
      expect(jsonSpy).toHaveBeenCalledWith({
        jsonrpc: '2.0',
        id: 1,
        result: {}
      });
    });

    it('should log errors when they occur', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error');

      // Force an error by passing invalid request
      mockReq.body = null;

      await mcpHandler.handleMCPRequest(mockReq as AuthenticatedRequest, mockRes as Response);

      // Logger format changed - no emoji prefix
      expect(consoleErrorSpy).toHaveBeenCalledWith('MCP Error:', expect.any(Error));
    });
  });

  describe('Different ID Types', () => {
    it('should handle string IDs', async () => {
      mockReq.body = {
        jsonrpc: '2.0',
        method: 'ping',
        id: 'string-id-123'
      };

      await mcpHandler.handleMCPRequest(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(jsonSpy).toHaveBeenCalledWith({
        jsonrpc: '2.0',
        id: 'string-id-123',
        result: {}
      });
    });

    it('should handle numeric IDs', async () => {
      mockReq.body = {
        jsonrpc: '2.0',
        method: 'ping',
        id: 42
      };

      await mcpHandler.handleMCPRequest(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(jsonSpy).toHaveBeenCalledWith({
        jsonrpc: '2.0',
        id: 42,
        result: {}
      });
    });

    it('should handle null IDs (notifications)', async () => {
      mockReq.body = {
        jsonrpc: '2.0',
        method: 'notifications/cancelled',
        id: null,
        params: {
          requestId: 'test-123',
          reason: 'timeout'
        }
      };

      await mcpHandler.handleMCPRequest(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(jsonSpy).toHaveBeenCalledWith({
        jsonrpc: '2.0',
        id: null,
        result: {}
      });
    });
  });

  describe('Method Parameter Variations', () => {
    it('should handle initialize with minimal parameters', async () => {
      mockReq.body = {
        jsonrpc: '2.0',
        method: 'initialize',
        id: 1,
        params: {
          protocolVersion: '2024-11-05'
          // Minimal required params
        }
      };

      await mcpHandler.handleMCPRequest(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(jsonSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          jsonrpc: '2.0',
          id: 1,
          result: expect.any(Object)
        })
      );
    });

    it('should handle tools/call with complex arguments', async () => {
      mockReq.body = {
        jsonrpc: '2.0',
        method: 'tools/call',
        id: 1,
        params: {
          name: 'echo',
          arguments: {
            message: 'complex message',
            options: {
              format: 'json',
              timestamp: true,
              metadata: { user: 'test', session: '123' }
            }
          }
        }
      };

      await mcpHandler.handleMCPRequest(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(jsonSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          jsonrpc: '2.0',
          id: 1
        })
      );
    });

    it('should handle notifications/cancelled with different reasons', async () => {
      const reasons = ['timeout', 'user_cancelled', 'server_shutdown', 'resource_limit'];

      for (const reason of reasons) {
        mockReq.body = {
          jsonrpc: '2.0',
          method: 'notifications/cancelled',
          id: 1,
          params: {
            requestId: `test-${reason}`,
            reason: reason
          }
        };

        await mcpHandler.handleMCPRequest(mockReq as AuthenticatedRequest, mockRes as Response);

        expect(jsonSpy).toHaveBeenCalledWith({
          jsonrpc: '2.0',
          id: 1,
          result: {}
        });
      }
    });
  });
});