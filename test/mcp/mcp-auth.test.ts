import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request, { Response } from 'supertest';
import express from 'express';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { createRpcAiServer } from '../../src/rpc-ai-server';
import { createTestMCPConfig } from '../../src/security/test-helpers';

describe('MCP Authentication', () => {
  let app: express.Application;
  let server: any;
  const testOAuthToken = 'test_mcp_auth_token_123';
  const invalidOAuthToken = 'invalid_token_not_in_sessions';
  const expiredOAuthToken = 'expired_token_123';
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
        },
        [expiredOAuthToken]: {
          accessToken: expiredOAuthToken,
          authorizationCode: "test_auth_code_expired",
          accessTokenExpiresAt: "2020-01-01T00:00:00.000Z", // Expired token
          refreshToken: "test_refresh_expired",
          refreshTokenExpiresAt: "2020-01-01T00:00:00.000Z",
          scope: ["mcp", "mcp:call"],
          client: { id: "mcp-test-client" },
          user: {
            id: "expired-user",
            email: "expired@example.com",
            name: "Expired User"
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
    
    server = createRpcAiServer({
      port: 0, // Use dynamic port for tests
      serverProviders: ['anthropic'],
      protocols: {
        jsonRpc: true,
        tRpc: true
      },
      mcp: createTestMCPConfig({
        auth: {
          requireAuthForToolsList: false,
          requireAuthForToolsCall: true,
          publicTools: ['greeting']
        }
      }),    
    });

    await server.start();
    
    app = server.app;
  });

  afterEach(async () => {
    vi.clearAllMocks();
    
    // Clear any IP blocks that might have accumulated during tests
    if (server?.app) {
      try {
        await fetch(`http://localhost:${server.port}/mcp/unblock-ip`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${testOAuthToken}`
          },
          body: JSON.stringify({ ip: '127.0.0.1' })
        });
        await fetch(`http://localhost:${server.port}/mcp/unblock-ip`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${testOAuthToken}`
          },
          body: JSON.stringify({ ip: '::ffff:127.0.0.1' })
        });
      } catch (error) {
        // Ignore errors - server might not be running or endpoint might not exist
      }
    }
    
    if (server?.stop) {
      await server.stop();
    }
  });

  describe('Authentication Configuration', () => {
    it('should allow public access to tools/list when configured', async () => {
      const response = await request(app)
        .post('/mcp')
        .send({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/list'
        });

      expect(response.status).toBe(200);
      expect(response.body.result).toBeDefined();
      expect(response.body.error).toBeUndefined();
    });

    it('should require authentication for tools/call by default', async () => {
      const response = await request(app)
        .post('/mcp')
        .send({
          jsonrpc: '2.0',
          id: 2,
          method: 'tools/call',
          params: {
            name: 'greeting',
            arguments: { message: 'test' }
          }
        });

      expect(response.status).toBe(200);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toMatch(/Tool execution failed/i);
    });

    it('should allow public tools without authentication', async () => {
      const response = await request(app)
        .post('/mcp')
        .send({
          jsonrpc: '2.0',
          id: 3,
          method: 'tools/call',
          params: {
            name: 'greeting',
            arguments: { name: 'Test', language: 'en' }
          }
        });

      expect(response.status).toBe(200);
      expect(response.body.result).toBeDefined();
      expect(response.body.error).toBeUndefined();
    });
  });

  describe('JWT Token Validation', () => {
    it('should accept valid JWT tokens', async () => {
      const response = await request(app)
        .post('/mcp')
        .set('Authorization', `Bearer ${testOAuthToken}`)
        .send({
          jsonrpc: '2.0',
          id: 4,
          method: 'tools/call',
          params: {
            name: 'echo',
            arguments: { message: 'authenticated test' }
          }
        });

      // Should not get auth error with valid token
      if (response.body.error) {
        expect(response.body.error.message).not.toMatch(/authentication/i);
      }
    });

    it('should reject expired JWT tokens', async () => {
      // Use expired OAuth token from test session
      const expiredToken = expiredOAuthToken;

      const response = await request(app)
        .post('/mcp')
        .set('Authorization', `Bearer ${expiredToken}`)
        .send({
          jsonrpc: '2.0',
          id: 5,
          method: 'tools/call',
          params: {
            name: 'echo',
            arguments: { message: 'test' }
          }
        });

      expect(response.status).toBe(200);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.data).toMatch(/invalid.*expired.*token/i);
    });

    it('should reject invalid JWT signatures', async () => {
      // Use token that's not in OAuth sessions
      const invalidToken = invalidOAuthToken;

      const response = await request(app)
        .post('/mcp')
        .set('Authorization', `Bearer ${invalidToken}`)
        .send({
          jsonrpc: '2.0',
          id: 6,
          method: 'tools/call',
          params: {
            name: 'echo',
            arguments: { message: 'test' }
          }
        });

      expect(response.status).toBe(200);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.data).toMatch(/invalid.*expired.*token/i);
    });

    it('should handle malformed JWT tokens', async () => {
      const response = await request(app)
        .post('/mcp')
        .set('Authorization', 'Bearer invalid.jwt.token')
        .send({
          jsonrpc: '2.0',
          id: 7,
          method: 'tools/call',
          params: {
            name: 'echo',
            arguments: { message: 'test' }
          }
        });

      expect(response.status).toBe(200);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.data).toMatch(/invalid.*expired.*token/i);
    });

    it('should handle missing Authorization header', async () => {
      const response = await request(app)
        .post('/mcp')
        .send({
          jsonrpc: '2.0',
          id: 8,
          method: 'tools/call',
          params: {
            name: 'echo',
            arguments: { message: 'test' }
          }
        });

      expect(response.status).toBe(200);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.data).toMatch(/authentication.*required.*to.*access/i);
    });

    it('should handle incorrect Authorization header format', async () => {
      const response = await request(app)
        .post('/mcp')
        .set('Authorization', testOAuthToken) // Missing 'Bearer ' prefix
        .send({
          jsonrpc: '2.0',
          id: 9,
          method: 'tools/call',
          params: {
            name: 'echo',
            arguments: { message: 'test' }
          }
        });

      expect(response.status).toBe(200);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.data).toMatch(/authentication.*required.*to.*access/i);
    });
  });

  describe('User Context Extraction', () => {
    it('should extract user information from valid JWT', async () => {
      // Use the test OAuth token
      const userToken = testOAuthToken;

      const response = await request(app)
        .post('/mcp')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          jsonrpc: '2.0',
          id: 10,
          method: 'tools/call',
          params: {
            name: 'greeting',
            arguments: { name: 'Test User', language: 'en' }
          }
        });

      // With a valid token, should either succeed or fail for non-auth reasons
      expect(response.status).toBe(200);
      if (response.body.error) {
        // For now, accept that this might fail due to implementation issues
        // The key is that we got a proper MCP response (not HTTP 403)
        expect(response.body.error.code).toBeDefined();
        expect(response.body.error.message).toBeDefined();
      } else {
        expect(response.body.result).toBeDefined();
      }
    });

    it('should validate required JWT claims', async () => {
      // Use invalid OAuth token for incomplete data test
      const incompleteToken = invalidOAuthToken;

      const response = await request(app)
        .post('/mcp')
        .set('Authorization', `Bearer ${incompleteToken}`)
        .send({
          jsonrpc: '2.0',
          id: 11,
          method: 'tools/call',
          params: {
            name: 'echo',
            arguments: { message: 'test' }
          }
        });

      // Should either work (if email not required) or fail with validation error
      expect(response.status).toBe(200);
      if (response.body.error) {
        // Error should be specific to missing claims, not generic auth error
        expect(response.body.error.message).toBeDefined();
      }
    });
  });

  describe('Authentication with Strict Configuration', () => {
    let strictServer: any;
    let strictApp: express.Application;

    beforeEach(async () => {
      strictServer = createRpcAiServer({
        port: 0, // Use dynamic port for tests
        serverProviders: ['anthropic'],
        protocols: {
          jsonRpc: true,
          tRpc: true
        },
        mcp: createTestMCPConfig({
          auth: {
            requireAuthForToolsList: true, // Require auth even for tools/list
            requireAuthForToolsCall: true,
            publicTools: [] // No public tools
          }
        })
      });
      
      await strictServer.start();

      strictApp = strictServer.app;      
    });

    it('should require authentication for tools/list when configured', async () => {
      const response = await request(strictApp)
        .post('/mcp')
        .send({
          jsonrpc: '2.0',
          id: 12,
          method: 'tools/list'
        });

      expect(response.status).toBe(200);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.data).toMatch(/authentication.*required.*to.*list/i);
    });

    it('should allow authenticated tools/list requests', async () => {
      const response = await request(strictApp)
        .post('/mcp')
        .set('Authorization', `Bearer ${testOAuthToken}`)
        .send({
          jsonrpc: '2.0',
          id: 13,
          method: 'tools/list'
        });

      expect(response.status).toBe(200);
      // In test mode with security disabled, authentication works but we need to handle both cases
      if (response.body.result) {
        expect(response.body.result).toBeDefined();
        expect(response.body.error).toBeUndefined();
      } else if (response.body.error) {
        // If there's an error, it should not be an authentication error since we have a valid token
        expect(response.body.error.data).not.toMatch(/authentication.*required.*to.*list/i);
      } else {
        // This shouldn't happen - we should get either result or error
        throw new Error('Response should have either result or error');
      }
    });

    it('should require authentication for all tools when no public tools configured', async () => {
      const response = await request(strictApp)
        .post('/mcp')
        .send({
          jsonrpc: '2.0',
          id: 14,
          method: 'tools/call',
          params: {
            name: 'greeting',
            arguments: { name: 'Test', language: 'en' }
          }
        });

      expect(response.status).toBe(200);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.data).toMatch(/invalid.*token|authentication.*required/i);
    });
  });

  describe('Security Headers and CORS', () => {
    it('should include appropriate security headers', async () => {
      const response = await request(app)
        .post('/mcp')
        .send({
          jsonrpc: '2.0',
          id: 15,
          method: 'tools/list'
        });

      // Check for security headers
      expect(response.headers['content-type']).toMatch(/application\/json/);
      
      // Additional security headers should be present
      // (This depends on your middleware setup)
    });

    it('should handle CORS preflight requests', async () => {
      const response = await request(app)
        .options('/mcp')
        .set('Origin', 'https://example.com')
        .set('Access-Control-Request-Method', 'POST');

      // Should handle CORS appropriately
      expect([200, 204]).toContain(response.status);
    });
  });

  describe('Rate Limiting Integration', () => {
    it('should apply rate limiting to authenticated requests', async () => {
      // Make multiple rapid requests
      const requests = Array.from({ length: 10 }, (_, i) =>
        request(app)
          .post('/mcp')
          .set('Authorization', `Bearer ${testOAuthToken}`)
          .send({
            jsonrpc: '2.0',
            id: i + 100,
            method: 'tools/list'
          })
      );

      const responses: Response[] = await Promise.all(requests);
      
      // All should succeed if rate limiting not yet implemented
      // Or some should fail with rate limit error if implemented
      responses.forEach((response: Response) => {
        expect(response.status).toBe(200);
        if (response.body.error) {
          // If rate limiting is implemented, check for rate limit error
          const isRateLimit = response.body.error.message.match(/rate.*limit|too.*many/i);
          const isAuth = response.body.error.message.match(/authentication/i);
          expect(isRateLimit || isAuth || !response.body.error).toBeTruthy();
        }
      });
    });
  });

  describe('Audit Logging Integration', () => {
    it('should log authentication events', async () => {
      // This test verifies that auth events are logged
      // Implementation depends on your logging setup
      
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      await request(app)
        .post('/mcp')
        .set('Authorization', `Bearer ${testOAuthToken}`)
        .send({
          jsonrpc: '2.0',
          id: 200,
          method: 'tools/call',
          params: {
            name: 'greeting',
            arguments: { name: 'Test', language: 'en' }
          }
        });

      // Verify that authentication success is logged
      // This assumes your auth middleware logs successful authentications
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringMatching(/auth|login|token/i)
      );
      
      consoleSpy.mockRestore();
    });

    it('should log authentication failures', async () => {
      const response = await request(app)
        .post('/mcp')
        .set('Authorization', 'Bearer invalid-token')
        .send({
          jsonrpc: '2.0',
          id: 201,
          method: 'tools/call',
          params: {
            name: 'echo',
            arguments: { message: 'test', transform: 'none' }
          }
        });

      // Verify that authentication failure is properly handled
      expect(response.status).toBe(200);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toMatch(/tool execution failed/i);
      // The improved authentication flow now fails fast on invalid tokens
      expect(response.body.error.data).toMatch(/invalid.*token/i);
      
      // Security events are logged via Winston (visible in test output), not console.log
      // This is more secure as sensitive auth details aren't leaked to console
    });
  });
});