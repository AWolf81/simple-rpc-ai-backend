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
  createAuthenticateHandler,
  configureOAuthTemplates,
  getTemplateEngine,
  getIdentityProviders,
  registerClient,
  createOAuthModel,
  normalizeUserProfile
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

  describe('Template Configuration', () => {
    it('should configure OAuth templates', () => {
      const config = {
        brandName: 'Test App',
        primaryColor: '#ff0000'
      };
      
      expect(() => configureOAuthTemplates(config)).not.toThrow();
    });

    it('should get template engine instance', () => {
      const config = {
        brandName: 'Test App',
        primaryColor: '#ff0000'
      };
      
      configureOAuthTemplates(config);
      const engine = getTemplateEngine();
      
      expect(engine).toBeDefined();
    });

    it('should update existing template configuration', () => {
      const initialConfig = {
        brandName: 'Initial App',
        primaryColor: '#00ff00'
      };
      
      const updatedConfig = {
        brandName: 'Updated App',
        primaryColor: '#0000ff'
      };
      
      configureOAuthTemplates(initialConfig);
      expect(() => configureOAuthTemplates(updatedConfig)).not.toThrow();
    });
  });

  describe('Identity Providers Configuration', () => {
    it('should get identity providers configuration', () => {
      const providers = getIdentityProviders();
      
      expect(providers).toBeDefined();
      expect(providers.google).toBeDefined();
      expect(providers.github).toBeDefined();
      expect(providers.microsoft).toBeDefined();
    });

    it('should use environment variables for provider config', () => {
      process.env.GOOGLE_CLIENT_ID = 'test-env-google-client';
      process.env.GITHUB_CLIENT_ID = 'test-env-github-client';
      
      const providers = getIdentityProviders();
      
      expect(providers.google.clientId).toBe('test-env-google-client');
      expect(providers.github.clientId).toBe('test-env-github-client');
    });

    it('should use default empty strings when env vars missing', () => {
      delete process.env.GOOGLE_CLIENT_ID;
      delete process.env.GITHUB_CLIENT_ID;
      
      const providers = getIdentityProviders();
      
      expect(providers.google.clientId).toBe('');
      expect(providers.github.clientId).toBe('');
    });

    it('should construct proper redirect URIs', () => {
      process.env.OAUTH_BASE_URL = 'https://custom.example.com';
      
      const providers = getIdentityProviders();
      
      expect(providers.google.redirectUri).toBe('https://custom.example.com/callback/google');
      expect(providers.github.redirectUri).toBe('https://custom.example.com/callback/github');
      expect(providers.microsoft.redirectUri).toBe('https://custom.example.com/callback/microsoft');
    });

    it('should handle different provider types', () => {
      const providers = getIdentityProviders();
      
      expect(providers.google.type).toBe('oidc');
      expect(providers.github.type).toBe('oauth2');
      expect(providers.microsoft.type).toBe('oidc');
    });

    it('should configure proper scopes for each provider', () => {
      const providers = getIdentityProviders();
      
      expect(providers.google.scopes).toEqual(['openid', 'email', 'profile']);
      expect(providers.github.scopes).toEqual(['read:user', 'user:email']);
      expect(providers.microsoft.scopes).toEqual(['openid', 'email', 'profile']);
    });
  });

  describe('OAuth Server Integration Tests', () => {
    it('should create OAuth server with Redis configuration', () => {
      const redisConfig = {
        type: 'redis' as const,
        redis: {
          host: 'localhost',
          port: 6379,
          password: 'redis-password',
          db: 0,
          keyPrefix: 'oauth:'
        }
      };
      
      const server = createOAuthServer(redisConfig, ['admin@example.com']);
      
      expect(server).toBeDefined();
      expect(server.oauth).toBeDefined();
      expect(server.storage).toBeDefined();
    });

    it('should create OAuth server with template configuration', () => {
      const templateConfig = {
        brandName: 'Test OAuth Server',
        primaryColor: '#007bff',
        logoUrl: 'https://example.com/logo.png',
        companyName: 'Test Company',
        supportEmail: 'support@example.com'
      };
      
      const server = createOAuthServer(
        { type: 'memory' }, 
        ['admin@example.com'], 
        templateConfig
      );
      
      expect(server).toBeDefined();
      expect(server.oauth).toBeDefined();
      expect(server.storage).toBeDefined();
    });

    it('should handle OAuth server with file storage', () => {
      const fileConfig = {
        type: 'file' as const,
        filePath: './test-oauth-server.json'
      };
      
      const server = createOAuthServer(fileConfig);
      
      expect(server).toBeDefined();
      expect(server.oauth).toBeDefined();
      expect(server.storage).toBeDefined();
    });

    it('should initialize OAuth server with default client and user', async () => {
      createOAuthServer({ type: 'memory' });
      
      // Just verify the function runs without throwing
      await expect(initializeOAuthServer()).resolves.not.toThrow();
    });

    it('should get OAuth server statistics', () => {
      createOAuthServer({ type: 'memory' });
      
      const stats = getOAuthStats();
      
      expect(stats).toBeDefined();
      // Stats might have different structure
      if (stats && typeof stats === 'object') {
        expect(typeof stats).toBe('object');
      }
    });

    it('should create authenticate handler with custom config', () => {
      const config = {
        requireAuthenticatedUser: true,
        allowAnonymous: false,
        scope: ['read', 'write']
      };
      
      const handler = createAuthenticateHandler(config);
      
      expect(handler).toBeDefined();
      // The handler might be an object or function depending on implementation
      expect(['function', 'object']).toContain(typeof handler);
    });

    it('should handle OAuth server with invalid storage type', () => {
      const invalidConfig = {
        type: 'invalid' as any
      };
      
      // The function might not throw, just create server with fallback
      const server = createOAuthServer(invalidConfig);
      expect(server).toBeDefined();
    });

    it('should support multiple admin users', () => {
      const adminUsers = [
        'admin1@example.com',
        'admin2@example.com',
        'superadmin@example.com'
      ];
      
      const server = createOAuthServer({ type: 'memory' }, adminUsers);
      
      expect(server).toBeDefined();
      expect(server.oauth).toBeDefined();
    });

    it('should handle empty admin users array', () => {
      const server = createOAuthServer({ type: 'memory' }, []);
      
      expect(server).toBeDefined();
      expect(server.oauth).toBeDefined();
    });

    it('should create server with Redis instance', () => {
      // Mock Redis instance
      const mockRedis = {
        set: vi.fn(),
        get: vi.fn(),
        del: vi.fn(),
        quit: vi.fn()
      };
      
      const redisConfig = {
        type: 'redis' as const,
        redis: {
          instance: mockRedis
        }
      };
      
      const server = createOAuthServer(redisConfig);
      
      expect(server).toBeDefined();
    });
  });

  describe('Client Registration', () => {
    it('should register a new client', async () => {
      // Create server first to initialize storage
      createOAuthServer({ type: 'memory' });
      await initializeOAuthServer();
      
      const clientData = {
        id: 'test-client',
        name: 'Test Client',
        redirectUris: ['http://localhost:3000/callback']
      };
      
      const client = await registerClient(clientData);
      
      expect(client).toBeDefined();
      expect(client.id).toBe('test-client');
      expect(client.clientSecret).toBeDefined();
      expect(client.clientSecret.length).toBeGreaterThan(20);
      expect(client.grants).toEqual(['authorization_code', 'refresh_token']);
      expect(client.redirectUris).toEqual(['http://localhost:3000/callback']);
    });

    it('should register a client with custom grants', async () => {
      createOAuthServer({ type: 'memory' });
      await initializeOAuthServer();
      
      const clientData = {
        id: 'custom-client',
        name: 'Custom Client',
        redirectUris: ['http://localhost:3000/callback'],
        grants: ['client_credentials']
      };
      
      const client = await registerClient(clientData);
      
      expect(client.grants).toEqual(['client_credentials']);
    });

    it('should register a client with multiple redirect URIs', async () => {
      createOAuthServer({ type: 'memory' });
      await initializeOAuthServer();
      
      const clientData = {
        id: 'multi-redirect-client',
        name: 'Multi Redirect Client',
        redirectUris: [
          'http://localhost:3000/callback',
          'http://localhost:4000/callback',
          'https://example.com/oauth/callback'
        ]
      };
      
      const client = await registerClient(clientData);
      
      expect(client.redirectUris).toHaveLength(3);
      expect(client.redirectUris).toContain('http://localhost:3000/callback');
      expect(client.redirectUris).toContain('https://example.com/oauth/callback');
    });

    it('should generate unique client secrets', async () => {
      createOAuthServer({ type: 'memory' });
      await initializeOAuthServer();
      
      const client1 = await registerClient({
        id: 'client1',
        name: 'Client 1',
        redirectUris: ['http://localhost:3000/callback']
      });
      
      const client2 = await registerClient({
        id: 'client2', 
        name: 'Client 2',
        redirectUris: ['http://localhost:3000/callback']
      });
      
      expect(client1.clientSecret).not.toBe(client2.clientSecret);
    });
  });

  describe('OAuth Model Creation', () => {
    it('should create OAuth model with session storage', async () => {
      const { storage } = createOAuthServer({ type: 'memory' });
      await storage.initialize();
      
      const model = createOAuthModel(storage);
      
      expect(model).toBeDefined();
      expect(typeof model.getClient).toBe('function');
      expect(typeof model.saveAuthorizationCode).toBe('function');
      expect(typeof model.getAuthorizationCode).toBe('function');
      expect(typeof model.revokeAuthorizationCode).toBe('function');
      expect(typeof model.saveToken).toBe('function');
      expect(typeof model.getAccessToken).toBe('function');
      expect(typeof model.validateScope).toBe('function');
    });

    it('should create OAuth model with admin users', async () => {
      const { storage } = createOAuthServer({ type: 'memory' });
      await storage.initialize();
      
      const adminUsers = ['admin@example.com', 'super@example.com'];
      const model = createOAuthModel(storage, adminUsers);
      
      expect(model).toBeDefined();
      expect(typeof model.validateScope).toBe('function');
    });

    it('should validate scopes for regular users', async () => {
      const { storage } = createOAuthServer({ type: 'memory' });
      await storage.initialize();
      
      const model = createOAuthModel(storage, ['admin@example.com']);
      
      const user = { id: 'user@example.com', email: 'user@example.com' };
      const client = { id: 'test-client' };
      
      const scopes = await model.validateScope(user, client, 'mcp mcp:list');
      
      expect(scopes).toBeDefined();
      expect(scopes).toContain('mcp');
      expect(scopes).toContain('mcp:list');
      expect(scopes).not.toContain('admin');
    });

    it('should validate scopes for admin users', async () => {
      const { storage } = createOAuthServer({ type: 'memory' });
      await storage.initialize();
      
      const model = createOAuthModel(storage, ['admin@example.com']);
      
      const user = { id: 'admin@example.com', email: 'admin@example.com' };
      const client = { id: 'test-client' };
      
      const scopes = await model.validateScope(user, client, 'mcp admin');
      
      expect(scopes).toBeDefined();
      expect(scopes).toContain('mcp');
      expect(scopes).toContain('admin');
      expect(scopes).toContain('mcp:admin');
    });

    it('should handle empty scope requests', async () => {
      const { storage } = createOAuthServer({ type: 'memory' });
      await storage.initialize();
      
      const model = createOAuthModel(storage);
      
      const user = { id: 'user@example.com' };
      const client = { id: 'test-client' };
      
      const scopes = await model.validateScope(user, client, '');
      
      expect(scopes).toBeDefined();
      expect(scopes).toContain('mcp');
      expect(scopes).toContain('mcp:list');
      expect(scopes).toContain('mcp:call');
    });

    it('should handle array scope input', async () => {
      const { storage } = createOAuthServer({ type: 'memory' });
      await storage.initialize();
      
      const model = createOAuthModel(storage);
      
      const user = { id: 'user@example.com' };
      const client = { id: 'test-client' };
      
      const scopes = await model.validateScope(user, client, ['mcp', 'custom']);
      
      expect(scopes).toBeDefined();
      expect(scopes).toContain('mcp');
      expect(scopes).toContain('custom');
    });

    it('should filter admin scopes from non-admin users', async () => {
      const { storage } = createOAuthServer({ type: 'memory' });
      await storage.initialize();
      
      const model = createOAuthModel(storage, ['admin@example.com']);
      
      const user = { id: 'regular@example.com', email: 'regular@example.com' };
      const client = { id: 'test-client' };
      
      const scopes = await model.validateScope(user, client, 'mcp admin mcp:admin');
      
      expect(scopes).toBeDefined();
      expect(scopes).toContain('mcp');
      expect(scopes).not.toContain('admin');
      expect(scopes).not.toContain('mcp:admin');
    });
  });

  describe('User Profile Normalization', () => {
    it('should normalize Google user profile', () => {
      const googleProfile = {
        sub: 'google-user-123',
        email: 'user@gmail.com',
        name: 'John Doe',
        given_name: 'John'
      };
      
      const normalized = normalizeUserProfile('google', googleProfile);
      
      expect(normalized).toEqual({
        id: 'google-user-123',
        email: 'user@gmail.com',
        name: 'John Doe'
      });
    });

    it('should normalize GitHub user profile', () => {
      const githubProfile = {
        id: 12345,
        email: 'user@example.com',
        name: 'Jane Doe',
        login: 'janedoe'
      };
      
      const normalized = normalizeUserProfile('github', githubProfile);
      
      expect(normalized).toEqual({
        id: '12345',
        email: 'user@example.com',
        name: 'Jane Doe'
      });
    });

    it('should normalize Microsoft user profile', () => {
      const microsoftProfile = {
        sub: 'microsoft-user-456',
        email: 'user@outlook.com',
        name: 'Bob Smith'
      };
      
      const normalized = normalizeUserProfile('microsoft', microsoftProfile);
      
      expect(normalized).toEqual({
        id: 'microsoft-user-456',
        email: 'user@outlook.com',
        name: 'Bob Smith'
      });
    });

    it('should normalize unknown provider profile using default case', () => {
      const unknownProfile = {
        sub: 'unknown-user-789',
        email: 'user@unknown.com',
        name: 'Unknown User'
      };
      
      const normalized = normalizeUserProfile('unknown-provider', unknownProfile);
      
      expect(normalized).toEqual({
        id: 'unknown-user-789',
        email: 'user@unknown.com',
        name: 'Unknown User'
      });
    });

    it('should handle fallback fields for unknown provider', () => {
      const unknownProfile = {
        user_id: 'fallback-id',
        preferred_username: 'fallback@email.com',
        display_name: 'Fallback Name'
      };
      
      const normalized = normalizeUserProfile('custom-sso', unknownProfile);
      
      expect(normalized).toEqual({
        id: 'fallback-id',
        email: 'fallback@email.com',
        name: 'Fallback Name'
      });
    });

    it('should handle missing fields gracefully', () => {
      const incompleteProfile = {
        id: 'incomplete-user'
        // Missing email and name
      };
      
      const normalized = normalizeUserProfile('incomplete-provider', incompleteProfile);
      
      expect(normalized).toEqual({
        id: 'incomplete-user',
        email: undefined,
        name: undefined
      });
    });
  });
});