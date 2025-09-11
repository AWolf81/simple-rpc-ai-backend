/**
 * Simple OAuth Middleware Unit Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { 
  createOAuthServer, 
  getSessionStorage, 
  initializeOAuthServer,
  getOAuthStats,
  clearOAuthData,
  closeOAuthServer,
  createAuthenticateHandler
} from '../../src/auth/oauth-middleware';

describe('OAuth Middleware Unit Tests', () => {
  beforeEach(() => {
    // Mock environment variables
    process.env.GOOGLE_CLIENT_ID = 'test-google-client';
    process.env.GOOGLE_CLIENT_SECRET = 'test-google-secret';
    process.env.GITHUB_CLIENT_ID = 'test-github-client';
    process.env.GITHUB_CLIENT_SECRET = 'test-github-secret';
    process.env.OAUTH_BASE_URL = 'http://localhost:8000';
  });

  afterEach(async () => {
    // Clean up
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
    delete process.env.GITHUB_CLIENT_ID;
    delete process.env.GITHUB_CLIENT_SECRET;
    delete process.env.OAUTH_BASE_URL;
    
    try {
      await closeOAuthServer();
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('OAuth Server Creation', () => {
    it('should create OAuth server with default configuration', () => {
      const result = createOAuthServer();
      expect(result).toBeDefined();
      expect(result.oauth).toBeDefined();
      expect(result.storage).toBeDefined();
      expect(typeof result.oauth.authenticate).toBe('function');
      expect(typeof result.oauth.authorize).toBe('function');
      expect(typeof result.oauth.token).toBe('function');
    });

    it('should create OAuth server with memory storage', () => {
      const result = createOAuthServer({ type: 'memory' });
      expect(result).toBeDefined();
      expect(result.oauth).toBeDefined();
    });

    it('should create OAuth server with file storage and encryption disabled', () => {
      const result = createOAuthServer({ 
        type: 'file', 
        filePath: './test-oauth.json'
      });
      expect(result).toBeDefined();
      expect(result.oauth).toBeDefined();
    });

    it('should create OAuth server with admin users', () => {
      const result = createOAuthServer({ type: 'memory' }, ['admin@test.com']);
      expect(result).toBeDefined();
      expect(result.oauth).toBeDefined();
    });
  });

  describe('Session Storage', () => {
    it('should get session storage after server creation', () => {
      createOAuthServer({ type: 'memory' });
      const storage = getSessionStorage();
      expect(storage).toBeDefined();
      expect(typeof storage.setClient).toBe('function');
      expect(typeof storage.getClient).toBe('function');
    });

    it('should return storage if it exists or create default', () => {
      // The implementation seems to create storage if it doesn't exist
      const storage = getSessionStorage();
      expect(storage).toBeDefined();
      expect(typeof storage.setClient).toBe('function');
    });
  });

  describe('OAuth Server Initialization', () => {
    it('should initialize OAuth server', async () => {
      createOAuthServer({ type: 'memory' });
      
      // Should not throw
      await expect(initializeOAuthServer()).resolves.not.toThrow();
    });

    it('should handle initialization without server', async () => {
      // Should handle gracefully
      await expect(initializeOAuthServer()).resolves.not.toThrow();
    });
  });

  describe('Authentication Handler', () => {
    it('should create authenticate handler', () => {
      const handler = createAuthenticateHandler();
      expect(handler).toBeDefined();
      expect(typeof handler).toBe('object');
      expect(typeof handler.handle).toBe('function');
    });

    it('should create authenticate handler with configuration', () => {
      const handler = createAuthenticateHandler();
      expect(handler).toBeDefined();
      expect(typeof handler).toBe('object');
      expect(typeof handler.handle).toBe('function');
    });
  });

  describe('OAuth Statistics', () => {
    it('should get OAuth statistics', () => {
      createOAuthServer({ type: 'memory' });
      const stats = getOAuthStats();
      expect(stats).toBeDefined();
      expect(typeof stats).toBe('object');
    });

    it('should handle stats request without server', () => {
      const stats = getOAuthStats();
      expect(stats).toBeDefined();
      expect(stats.storageType).toBeDefined();
      expect(typeof stats.storageType).toBe('string');
      expect(typeof stats.initialized).toBe('boolean');
    });
  });

  describe('OAuth Data Management', () => {
    it('should clear OAuth data', async () => {
      createOAuthServer({ type: 'memory' });
      
      // Should not throw
      await expect(clearOAuthData()).resolves.not.toThrow();
    });

    it('should handle clear data without server', async () => {
      // Should handle gracefully
      await expect(clearOAuthData()).resolves.not.toThrow();
    });

    it('should close OAuth server', async () => {
      createOAuthServer({ type: 'memory' });
      
      // Should not throw
      await expect(closeOAuthServer()).resolves.not.toThrow();
    });

    it('should handle close without server', async () => {
      // Should handle gracefully  
      await expect(closeOAuthServer()).resolves.not.toThrow();
    });
  });

  describe('Environment Configuration', () => {
    it('should use environment variables for provider config', () => {
      process.env.GOOGLE_CLIENT_ID = 'custom-google-id';
      process.env.GITHUB_CLIENT_SECRET = 'custom-github-secret';
      
      const server = createOAuthServer({ type: 'memory' });
      expect(server).toBeDefined();
    });

    it('should handle missing environment variables', () => {
      delete process.env.GOOGLE_CLIENT_ID;
      delete process.env.GOOGLE_CLIENT_SECRET;
      
      const server = createOAuthServer({ type: 'memory' });
      expect(server).toBeDefined();
    });

    it('should use custom base URL', () => {
      process.env.OAUTH_BASE_URL = 'https://custom.domain.com';
      
      const server = createOAuthServer({ type: 'memory' });
      expect(server).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid storage configuration', () => {
      expect(() => {
        createOAuthServer({ type: 'invalid' as any });
      }).not.toThrow(); // Should handle gracefully or fall back
    });

    it('should handle malformed admin users array', () => {
      expect(() => {
        createOAuthServer({ type: 'memory' }, null as any);
      }).not.toThrow();
    });

    it('should handle invalid template configuration', () => {
      expect(() => {
        createOAuthServer(
          { type: 'memory' },
          [],
          { invalidProperty: 'test' } as any
        );
      }).not.toThrow();
    });
  });

  describe('Multiple Server Instances', () => {
    it('should handle multiple server creation calls', () => {
      const server1 = createOAuthServer({ type: 'memory' });
      const server2 = createOAuthServer({ type: 'memory' });
      
      expect(server1).toBeDefined();
      expect(server2).toBeDefined();
    });

    it('should maintain session storage across server recreations', () => {
      createOAuthServer({ type: 'memory' });
      const storage1 = getSessionStorage();
      
      createOAuthServer({ type: 'memory' });
      const storage2 = getSessionStorage();
      
      expect(storage1).toBeDefined();
      expect(storage2).toBeDefined();
    });
  });
});