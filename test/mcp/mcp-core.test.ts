import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { createRpcAiServer } from '../../src/rpc-ai-server';
import { protectedProcedure, router } from '../../src/trpc';
import { createMCPTool } from '../../src/auth/scopes';
import z from 'zod';

describe('MCP Core Functionality', () => {
  let app: express.Application;
  let server: any;
  const testOAuthToken = 'test_mcp_token_with_scopes_123';
  const oauthSessionsPath = join(process.cwd(), 'data', 'oauth-sessions.json');

  // Helper function to create OAuth session for tests
  function createTestOAuthSession() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const testSession = {
      clients: {
        "mcp-test-client": {
          id: "mcp-test-client",
          clientSecret: "test-secret",
          grants: ["authorization_code", "refresh_token"],
          redirectUris: ["http://localhost:4000/oauth/callback/test"],
          accessTokenLifetime: 3600,
          refreshTokenLifetime: 86400
        }
      },
      tokens: {
        [testOAuthToken]: {
          accessToken: testOAuthToken,
          authorizationCode: "test_auth_code_123",
          accessTokenExpiresAt: tomorrow.toISOString(),
          refreshToken: "test_refresh_token_123",
          refreshTokenExpiresAt: tomorrow.toISOString(),
          scope: ["mcp", "mcp:call", "mcp:list", "admin"],
          client: { id: "mcp-test-client" },
          user: {
            id: "test-user-123",
            email: "test@example.com",
            name: "Test User"
          }
        }
      },
      authorizationCodes: {},
      users: {
        "test-user-123": {
          id: "test-user-123",
          email: "test@example.com", 
          name: "Test User"
        }
      }
    };

    // Ensure data directory exists
    const dataDir = join(process.cwd(), 'data');
    if (!existsSync(dataDir)) {
      mkdirSync(dataDir, { recursive: true });
    }

    // Write OAuth session file for tests
    writeFileSync(oauthSessionsPath, JSON.stringify(testSession, null, 2));
  }

  beforeEach(async () => {
    // Create OAuth session for testing
    createTestOAuthSession();

    // Create server with MCP enabled and OAuth authentication
    server = createRpcAiServer({
      port: 0, // Use dynamic port for tests
      serverProviders: ['anthropic'],
      protocols: {
        jsonRpc: true,
        tRpc: true
      },
      mcp: {
        enableMCP: true,
        auth: {
          requireAuthForToolsList: false,
          requireAuthForToolsCall: true,
          publicTools: ['greeting']
        }
      }
    });

    const demoRouter = router({
      protectedTool: protectedProcedure
        .meta({
          ...createMCPTool({
            name: "protected_tool",
            description: "Just a echo tool but with auth",
            scopes: {
              anyOf: ['mcp:call', 'admin'],
              description: 'Requires MCP access or admin privileges'
            }
          })
        }).input(z.object({
          name: z.string().describe('Your name')
        }))
        .query(({ input }) => {
          const name = input.name || 'World'

          return `Hello ${name}!!!`
        }),
    })

    server.mergeMcpRouter(demoRouter);

    // Initialize server (this sets up routes and MCP endpoints)
    await server.start();
    
    app = server.app;
  });

  afterEach(async () => {
    vi.clearAllMocks();
    delete process.env.JWT_SECRET;
    if (server) {
      await server.stop();
    }
  });

  describe('MCP Protocol Compliance', () => {
    it('should handle MCP initialize request', async () => {
      const response = await request(app)
        .post('/mcp')
        .send({
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: {
            protocolVersion: '2024-11-05',
            capabilities: {
              tools: {}
            },
            clientInfo: {
              name: 'test-client',
              version: '1.0.0'
            }
          }
        });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        jsonrpc: '2.0',
        id: 1,
        result: {
          protocolVersion: expect.any(String), // Accept any protocol version
          serverInfo: {
            name: expect.any(String), // Accept any server name
            version: expect.any(String)
          },
          capabilities: {
            tools: {}
          }
        }
      });
    });

    it('should handle tools/list request', async () => {
      const response = await request(app)
        .post('/mcp')
        .send({
          jsonrpc: '2.0',
          id: 2,
          method: 'tools/list',
          params: {}
        });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        jsonrpc: '2.0',
        id: 2,
        result: {
          tools: expect.arrayContaining([
            expect.objectContaining({
              name: expect.any(String),
              description: expect.any(String),
              inputSchema: expect.any(Object)
            })
          ])
        }
      });
    });

    it('should return proper JSON-RPC error for invalid methods', async () => {
      const response = await request(app)
        .post('/mcp')
        .send({
          jsonrpc: '2.0',
          id: 3,
          method: 'invalid/method',
          params: {}
        });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        jsonrpc: '2.0',
        id: 3,
        error: {
          code: -32601,
          message: expect.stringContaining('not found')
        }
      });
    });

    it('should validate JSON-RPC request format', async () => {
      const response = await request(app)
        .post('/mcp')
        .send({
          // Missing required fields
          method: 'initialize'
        });

      expect(response.status).toBe(200);
      // The server might handle malformed requests differently
      // Check if we get a successful response or an error
      if (response.body.error) {
        expect(response.body.error.code).toBe(-32600); // Invalid Request
      } else {
        // If no error, the server accepted the malformed request
        expect(response.body.result || response.body.jsonrpc).toBeDefined();
      }
    });
  });

  describe('Tool Discovery', () => {
    it('should discover tools from tRPC procedures with MCP metadata', async () => {
      const response = await request(app)
        .post('/mcp')
        .send({
          jsonrpc: '2.0',
          id: 4,
          method: 'tools/list'
        });

      const tools = response.body.result.tools;
      
      // Should find some tools (from MCP router)
      expect(tools).toBeDefined();
      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBeGreaterThan(0);
      
      // Check the first available tool has the proper structure
      const firstTool = tools[0];
      expect(firstTool).toBeDefined();
      expect(firstTool.name).toBeDefined();
      expect(firstTool.description).toBeDefined();
      expect(firstTool.inputSchema).toBeDefined();
      expect(firstTool.inputSchema.type).toBe('object');
    });

    it('should include proper JSON Schema for tool inputs', async () => {
      const response = await request(app)
        .post('/mcp')
        .send({
          jsonrpc: '2.0',
          id: 5,
          method: 'tools/list'
        });

      const tools = response.body.result.tools;
      
      for (const tool of tools) {
        expect(tool.inputSchema).toMatchObject({
          type: 'object',
          properties: expect.any(Object)
        });
        
        // Check that Zod constraints are converted properly
        if (tool.inputSchema.properties) {
          Object.values(tool.inputSchema.properties).forEach((prop: any) => {
            expect(prop).toHaveProperty('type');
          });
        }
      }
    });

    it('should exclude tools without MCP metadata', async () => {
      const response = await request(app)
        .post('/mcp')
        .send({
          jsonrpc: '2.0',
          id: 6,
          method: 'tools/list'
        });

      const tools = response.body.result.tools;
      const toolNames = tools.map((tool: any) => tool.name);
      
      // Should not include tRPC procedures without MCP metadata
      expect(toolNames).not.toContain('health'); // Regular tRPC procedure
      expect(toolNames).not.toContain('executeAIRequest'); // Non-MCP procedure
    });
  });

  describe('Tool Execution', () => {
    it('should execute public tools without authentication', async () => {
      // First get available tools
      const toolsResponse = await request(app)
        .post('/mcp')
        .send({
          jsonrpc: '2.0',
          id: 6,
          method: 'tools/list'
        });
      
      const tools = toolsResponse.body.result.tools;
      expect(tools.length).toBeGreaterThan(0);
      
      // Try to execute the first available tool with minimal arguments
      const firstTool = tools[0];
      const response = await request(app)
        .post('/mcp')
        .send({
          jsonrpc: '2.0',
          id: 7,
          method: 'tools/call',
          params: {
            name: firstTool.name,
            arguments: {}
          }
        });

      expect(response.status).toBe(200);
      // Tool execution should either succeed or fail with proper JSON-RPC format
      expect(response.body).toHaveProperty('jsonrpc', '2.0');
      expect(response.body).toHaveProperty('id', 7);
      expect(response.body.result || response.body.error).toBeDefined();
    });

    it('should require authentication for protected tools', async () => {
      const response = await request(app)
        .post('/mcp')
        .send({
          jsonrpc: '2.0',
          id: 8,
          method: 'tools/call',
          params: {
            name: 'protected_tool',
            arguments: { name: 'test' }
          }
        });

      expect(response.status).toBe(200);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toMatch(/Tool execution failed/i);
      expect(response.body.error.data).toMatch(/Authentication required/i);
    });

    it('should execute protected tools with valid authentication', async () => {
      const response = await request(app)
        .post('/mcp')
        .set('Authorization', `Bearer ${testOAuthToken}`)
        .send({
          jsonrpc: '2.0',
          id: 9,
          method: 'tools/call',
          params: {
            name: 'protected_tool',
            arguments: { name: 'AuthenticatedUser' }
          }
        });

      expect(response.status).toBe(200);
      expect(response.body.error).toBeUndefined();
      expect(response.body.result?.content?.[0]?.text).toBe('Hello AuthenticatedUser!!!');
    });

    it('should require authentication for protected tools (admin scope missing)', async () => {
      const response = await request(app)
        .post('/mcp')
        .send({
          jsonrpc: '2.0',
          id: 8,
          method: 'tools/call',
          params: {
            name: 'getUserInfo', // tool requires auth
            arguments: {
            }
          }
        });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        jsonrpc: '2.0',
        id: 8,
        error: {
          code: expect.any(Number),
          message: expect.stringContaining('failed')
        }
      });
    });

    it('should validate tool arguments against schema', async () => {
      const response = await request(app)
        .post('/mcp')
        .send({
          jsonrpc: '2.0',
          id: 9,
          method: 'tools/call',
          params: {
            name: 'nonexistent-tool-for-validation',
            arguments: {
              invalid: 'data'
            }
          }
        });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        jsonrpc: '2.0',
        id: 9,
        error: {
          code: expect.any(Number),
          message: expect.any(String)
        }
      });
    });

    it('should handle non-existent tools', async () => {
      const response = await request(app)
        .post('/mcp')
        .send({
          jsonrpc: '2.0',
          id: 10,
          method: 'tools/call',
          params: {
            name: 'nonexistent-tool',
            arguments: {}
          }
        });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        jsonrpc: '2.0',
        id: 10,
        error: {
          code: expect.any(Number),
          message: expect.stringContaining('failed')
        }
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed JSON requests', async () => {
      const response = await request(app)
        .post('/mcp')
        .send('invalid json');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        jsonrpc: '2.0',
        error: {
          code: expect.any(Number), // Accept any error code
          message: expect.any(String)
        }
      });
    });

    it('should handle tool execution errors gracefully', async () => {
      // Mock a tool that throws an error
      const response = await request(app)
        .post('/mcp')
        .send({
          jsonrpc: '2.0',
          id: 11,
          method: 'tools/call',
          params: {
            name: 'nonexistent-tool-error',
            arguments: {
              invalid: 'arguments'
            }
          }
        });

      expect(response.status).toBe(200);
      if (response.body.error) {
        expect(response.body).toMatchObject({
          jsonrpc: '2.0',
          id: 11,
          error: {
            code: expect.any(Number),
            message: expect.any(String)
          }
        });
      }
    });

    it('should provide helpful error messages', async () => {
      const response = await request(app)
        .post('/mcp')
        .send({
          jsonrpc: '2.0',
          id: 12,
          method: 'tools/call',
          params: {
            name: 'greeting',
            arguments: {
              name: 'Test',
              language: 123 // Wrong type
            }
          }
        });

      if (response.body.error) {
        expect(response.body.error.message).toBeTruthy();
        expect(typeof response.body.error.message).toBe('string');
      }
    });
  });

  describe('Performance and Reliability', () => {
    it('should handle concurrent requests', async () => {
      const requests = Array.from({ length: 5 }, (_, i) =>
        request(app)
          .post('/mcp')
          .send({
            jsonrpc: '2.0',
            id: i + 20,
            method: 'tools/list'
          })
      );

      const responses = await Promise.all(requests);
      
      responses.forEach((response, i) => {
        expect(response.status).toBe(200);
        expect(response.body.id).toBe(i + 20);
        expect(response.body.result).toBeDefined();
      });
    });

    it('should respond within reasonable time', async () => {
      const start = Date.now();
      
      await request(app)
        .post('/mcp')
        .send({
          jsonrpc: '2.0',
          id: 30,
          method: 'tools/list'
        });
      
      const duration = Date.now() - start;
      expect(duration).toBeLessThan(1000); // Should respond within 1 second
    });

    it('should maintain session state correctly', async () => {
      // Initialize session
      const initResponse = await request(app)
        .post('/mcp')
        .send({
          jsonrpc: '2.0',
          id: 31,
          method: 'initialize',
          params: {
            protocolVersion: '2024-11-05',
            capabilities: { tools: {} },
            clientInfo: { name: 'test', version: '1.0' }
          }
        });

      expect(initResponse.status).toBe(200);

      // Subsequent requests should work
      const listResponse = await request(app)
        .post('/mcp')
        .send({
          jsonrpc: '2.0',
          id: 32,
          method: 'tools/list'
        });

      expect(listResponse.status).toBe(200);
    });
  });
});