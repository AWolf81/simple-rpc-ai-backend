import { describe, it, expect, vi, beforeEach, afterEach, afterAll } from 'vitest';
import { Request, Response } from 'express';
import { 
  handleProviderLogin, 
  handleProviderCallback, 
  getIdentityProviders,
  createOAuthServer,
  closeOAuthServer 
} from '../../src/auth/oauth-middleware';

// Mock fetch for OIDC discovery and token exchange
const mockFetch = vi.fn();
const originalFetch = globalThis.fetch;
vi.stubGlobal('fetch', mockFetch);

// Mock crypto for state generation
vi.mock('crypto', async (importOriginal) => {
  const actual = await importOriginal<typeof import('crypto')>();
  return {
    ...actual,
    randomBytes: vi.fn(() => ({ toString: () => 'mock-state-123' }))
  };
});

// Mock PKCE functions
vi.mock('openid-client', () => ({
  randomPKCECodeVerifier: vi.fn(() => 'mock-code-verifier'),
  calculatePKCECodeChallenge: vi.fn(() => Promise.resolve('mock-code-challenge'))
}));

describe('OAuth Provider Integration Tests', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockSessionStorage: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockFetch.mockClear();
    
    // Set up environment variables for providers
    process.env.GOOGLE_CLIENT_ID = 'test-google-client-id';
    process.env.GOOGLE_CLIENT_SECRET = 'test-google-secret';
    process.env.GITHUB_CLIENT_ID = 'test-github-client-id';
    process.env.GITHUB_CLIENT_SECRET = 'test-github-secret';
    process.env.MICROSOFT_CLIENT_ID = 'test-microsoft-client-id';
    process.env.MICROSOFT_CLIENT_SECRET = 'test-microsoft-secret';
    process.env.OAUTH_BASE_URL = 'http://localhost:8000';

    // Create OAuth server for tests
    const { storage } = createOAuthServer({ type: 'memory' });
    mockSessionStorage = storage;
    
    // Note: OIDC configs are cached, so callback tests may not trigger discovery calls

    // Mock request and response objects
    mockReq = {
      params: {},
      query: {},
      session: {}
    };

    mockRes = {
      redirect: vi.fn(),
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
      send: vi.fn(),
      setHeader: vi.fn()
    };
  });

  afterEach(async () => {
    vi.resetAllMocks();
    mockFetch.mockClear();
    await closeOAuthServer();
    
    // Clean up environment variables
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
    delete process.env.GITHUB_CLIENT_ID;
    delete process.env.GITHUB_CLIENT_SECRET;
    delete process.env.MICROSOFT_CLIENT_ID;
    delete process.env.MICROSOFT_CLIENT_SECRET;
    delete process.env.OAUTH_BASE_URL;
  });

  // Restore original fetch after all tests
  afterAll(() => {
    vi.unstubAllGlobals();
    if (originalFetch) {
      globalThis.fetch = originalFetch;
    }
  });

  describe('Google OAuth2 Integration', () => {
    it('should initiate Google OIDC login flow', async () => {
      mockReq.params = { provider: 'google' };
      mockReq.query = { redirect_uri: 'http://localhost:4000/callback' };

      // Mock OIDC discovery
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          authorization_endpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
          token_endpoint: 'https://oauth2.googleapis.com/token',
          userinfo_endpoint: 'https://openidconnect.googleapis.com/v1/userinfo'
        })
      } as any);

      // Mock session storage setItem
      mockSessionStorage.setItem = vi.fn();

      await handleProviderLogin(mockReq as Request, mockRes as Response);

      expect(mockRes.redirect).toHaveBeenCalled();
      const redirectUrl = (mockRes.redirect as any).mock.calls[0][0];
      expect(redirectUrl).toContain('accounts.google.com');
      expect(redirectUrl).toContain('client_id=test-google-client-id');
      expect(redirectUrl).toContain('response_type=code');
      expect(redirectUrl).toContain('code_challenge');
    });

    it('should handle Google OAuth callback and create user', async () => {
      mockReq.params = { provider: 'google' };
      mockReq.query = { 
        code: 'google-auth-code-123',
        state: 'mock-state-123'
      };

      // Mock session storage for state verification
      mockSessionStorage.getItem = vi.fn().mockResolvedValue(JSON.stringify({
        provider: 'google',
        codeVerifier: 'mock-code-verifier',
        originalQuery: {}
      }));
      mockSessionStorage.setUser = vi.fn();
      mockSessionStorage.deleteItem = vi.fn();

      // Mock token exchange (OIDC config is cached from login test)
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            access_token: 'google-access-token'
          })
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            sub: 'google-12345',
            email: 'user@gmail.com',
            name: 'John Doe'
          })
        } as any);

      await handleProviderCallback(mockReq as Request, mockRes as Response);

      expect(mockSessionStorage.setUser).toHaveBeenCalledWith(
        'google:google-12345',
        expect.objectContaining({
          id: 'google:google-12345',
          email: 'user@gmail.com',
          name: 'John Doe',
          provider: 'google'
        })
      );
      expect(mockRes.redirect).toHaveBeenCalled();
    });

    it('should handle Google OAuth errors gracefully', async () => {
      mockReq.params = { provider: 'google' };
      mockReq.query = { 
        error: 'access_denied',
        error_description: 'User denied access'
      };

      await handleProviderCallback(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'authorization_denied',
          error_description: expect.stringContaining('google')
        })
      );
    });
  });

  describe('GitHub OAuth2 Integration', () => {
    it('should initiate GitHub OAuth2 login flow', async () => {
      mockReq.params = { provider: 'github' };
      mockReq.query = { redirect_uri: 'http://localhost:4000/callback' };

      // Mock session storage setItem
      mockSessionStorage.setItem = vi.fn();

      await handleProviderLogin(mockReq as Request, mockRes as Response);

      expect(mockRes.redirect).toHaveBeenCalled();
      const redirectUrl = (mockRes.redirect as any).mock.calls[0][0];
      expect(redirectUrl).toContain('github.com/login/oauth/authorize');
      expect(redirectUrl).toContain('client_id=test-github-client-id');
      expect(redirectUrl).toContain('response_type=code');
      expect(redirectUrl).toContain('scope=read%3Auser+user%3Aemail');
    });

    it('should handle GitHub OAuth callback and create user', async () => {
      mockReq.params = { provider: 'github' };
      mockReq.query = { 
        code: 'github-auth-code-123',
        state: 'mock-state-123'
      };

      // Mock session storage for state verification
      mockSessionStorage.getItem = vi.fn().mockResolvedValue(JSON.stringify({
        provider: 'github',
        codeVerifier: 'mock-code-verifier',
        originalQuery: {}
      }));
      mockSessionStorage.setUser = vi.fn();
      mockSessionStorage.deleteItem = vi.fn();

      // Mock token exchange and user profile fetch
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            access_token: 'github-access-token'
          })
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            id: 67890,
            login: 'johndoe',
            email: 'john@github.com',
            name: 'John Doe'
          })
        } as any);

      await handleProviderCallback(mockReq as Request, mockRes as Response);

      expect(mockSessionStorage.setUser).toHaveBeenCalledWith(
        'github:67890',
        expect.objectContaining({
          id: 'github:67890',
          email: 'john@github.com',
          name: 'John Doe',
          provider: 'github'
        })
      );
      expect(mockRes.redirect).toHaveBeenCalled();
    });

    it('should handle GitHub OAuth token exchange failure', async () => {
      mockReq.params = { provider: 'github' };
      mockReq.query = { 
        code: 'invalid-code',
        state: 'mock-state-123'
      };

      // Mock session storage for state verification
      mockSessionStorage.getItem = vi.fn().mockResolvedValue(JSON.stringify({
        provider: 'github',
        codeVerifier: 'mock-code-verifier',
        originalQuery: {}
      }));

      // Mock failed token exchange - no access_token returned
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          error: 'invalid_grant'
          // No access_token field - this will trigger the error
        })
      } as any);

      await handleProviderCallback(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'callback_error',
          error_description: expect.stringContaining('github')
        })
      );
    });
  });

  describe('Microsoft OAuth2 Integration', () => {
    it('should initiate Microsoft OIDC login flow', async () => {
      mockReq.params = { provider: 'microsoft' };
      mockReq.query = { redirect_uri: 'http://localhost:4000/callback' };

      // Mock OIDC discovery
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          authorization_endpoint: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
          token_endpoint: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
          userinfo_endpoint: 'https://graph.microsoft.com/oidc/userinfo'
        })
      } as any);

      // Mock session storage setItem
      mockSessionStorage.setItem = vi.fn();

      await handleProviderLogin(mockReq as Request, mockRes as Response);

      expect(mockRes.redirect).toHaveBeenCalled();
      const redirectUrl = (mockRes.redirect as any).mock.calls[0][0];
      expect(redirectUrl).toContain('login.microsoftonline.com');
      expect(redirectUrl).toContain('client_id=test-microsoft-client-id');
      expect(redirectUrl).toContain('response_type=code');
      expect(redirectUrl).toContain('code_challenge');
    });

    it('should handle Microsoft OAuth callback and create user', async () => {
      mockReq.params = { provider: 'microsoft' };
      mockReq.query = { 
        code: 'microsoft-auth-code-123',
        state: 'mock-state-123'
      };

      // Mock session storage for state verification
      mockSessionStorage.getItem = vi.fn().mockResolvedValue(JSON.stringify({
        provider: 'microsoft',
        codeVerifier: 'mock-code-verifier',
        originalQuery: {}
      }));
      mockSessionStorage.setUser = vi.fn();
      mockSessionStorage.deleteItem = vi.fn();

      // Mock token exchange (OIDC config is cached from login test)
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            access_token: 'microsoft-access-token'
          })
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            sub: 'microsoft-12345',
            email: 'user@company.com',
            name: 'Jane Smith'
          })
        } as any);

      await handleProviderCallback(mockReq as Request, mockRes as Response);

      expect(mockSessionStorage.setUser).toHaveBeenCalledWith(
        'microsoft:microsoft-12345',
        expect.objectContaining({
          id: 'microsoft:microsoft-12345',
          email: 'user@company.com',
          name: 'Jane Smith',
          provider: 'microsoft'
        })
      );
      expect(mockRes.redirect).toHaveBeenCalled();
    });
  });

  describe('Provider Configuration Tests', () => {
    it('should get identity providers configuration', () => {
      const providers = getIdentityProviders();
      
      expect(providers).toHaveProperty('google');
      expect(providers).toHaveProperty('github');
      expect(providers).toHaveProperty('microsoft');
      
      expect(providers.google.type).toBe('oidc');
      expect(providers.github.type).toBe('oauth2');
      expect(providers.microsoft.type).toBe('oidc');
      
      expect(providers.google.clientId).toBe('test-google-client-id');
      expect(providers.github.clientId).toBe('test-github-client-id');
      expect(providers.microsoft.clientId).toBe('test-microsoft-client-id');
    });

    it('should handle unknown provider', async () => {
      mockReq.params = { provider: 'unknown' };

      await handleProviderLogin(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'invalid_provider',
          error_description: expect.stringContaining('unknown'),
          supported_providers: expect.arrayContaining(['google', 'github', 'microsoft'])
        })
      );
    });

    it('should handle provider with missing credentials', async () => {
      // Remove client secret for Google
      delete process.env.GOOGLE_CLIENT_SECRET;
      
      mockReq.params = { provider: 'google' };

      await handleProviderLogin(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'provider_not_configured',
          error_description: expect.stringContaining('google')
        })
      );
    });
  });

  describe('OAuth State and Security Tests', () => {
    it('should handle invalid state parameter', async () => {
      mockReq.params = { provider: 'google' };
      mockReq.query = { 
        code: 'valid-code',
        state: 'invalid-state'
      };

      // Mock session storage returning null for invalid state
      mockSessionStorage.getItem = vi.fn().mockResolvedValue(null);

      await handleProviderCallback(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'invalid_state',
          error_description: expect.stringContaining('Invalid or expired state')
        })
      );
    });

    it('should handle state provider mismatch', async () => {
      mockReq.params = { provider: 'google' };
      mockReq.query = { 
        code: 'valid-code',
        state: 'mock-state-123'
      };

      // Mock session storage returning different provider
      mockSessionStorage.getItem = vi.fn().mockResolvedValue(JSON.stringify({
        provider: 'github', // Different provider
        codeVerifier: 'mock-code-verifier',
        originalQuery: {}
      }));

      await handleProviderCallback(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'state_mismatch',
          error_description: expect.stringContaining('provider mismatch')
        })
      );
    });

    it('should handle missing authorization code', async () => {
      mockReq.params = { provider: 'google' };
      mockReq.query = { 
        state: 'mock-state-123'
        // Missing code parameter
      };

      await handleProviderCallback(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'invalid_request',
          error_description: expect.stringContaining('Missing authorization code')
        })
      );
    });
  });

});