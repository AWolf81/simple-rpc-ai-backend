import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AuthManager } from '../src/auth/auth-manager.js';
import { UserManager } from '../src/auth/user-manager.js';
import { SimpleKeyManager } from '../src/auth/key-manager.js';
// Mock dependencies
vi.mock('../src/auth/user-manager.js', () => ({
    UserManager: vi.fn().mockImplementation(() => ({
        createAnonymousUser: vi.fn(),
        getUserById: vi.fn(),
        updateUser: vi.fn(),
        getUserByOAuth: vi.fn()
    }))
}));
vi.mock('../src/auth/key-manager.js', () => ({
    SimpleKeyManager: vi.fn().mockImplementation(() => ({
        encryptKey: vi.fn(),
        decryptKey: vi.fn(),
        rotateKey: vi.fn(),
        deleteKey: vi.fn()
    }))
}));
describe.skip('AuthManager (REMOVED FEATURE - authentication system removed)', () => {
    let authManager;
    let mockUserManager;
    let mockKeyManager;
    let mockOAuthProviders;
    beforeEach(() => {
        // Create mock instances
        mockUserManager = new UserManager({});
        mockKeyManager = new SimpleKeyManager({});
        // Mock OAuth provider
        const mockGitHubProvider = {
            provider: 'github',
            scopes: ['user:email'],
            validateToken: vi.fn().mockResolvedValue({
                provider: 'github',
                providerId: 'github123',
                email: 'test@example.com',
                name: 'Test User',
                avatarUrl: 'https://avatar.url',
                accessToken: 'token123',
                refreshToken: 'refresh123',
                expiresAt: new Date(Date.now() + 3600000)
            })
        };
        mockOAuthProviders = new Map();
        mockOAuthProviders.set('github', mockGitHubProvider);
        // Create AuthManager instance
        authManager = new AuthManager(mockUserManager, mockKeyManager, mockOAuthProviders);
        // Reset all mocks
        vi.clearAllMocks();
    });
    afterEach(() => {
        vi.resetAllMocks();
    });
    describe('initializeSession', () => {
        it.skip('should create anonymous session for new user', async () => {
            const mockUser = {
                id: 'user123',
                deviceId: 'device123',
                authLevel: 'anonymous',
                createdAt: new Date(),
                lastActivity: new Date()
            };
            mockUserManager.createAnonymousUser.mockResolvedValueOnce(mockUser);
            const session = await authManager.initializeSession('device123');
            expect(session).toEqual({
                userId: 'user123',
                deviceId: 'device123',
                authLevel: 'anonymous',
                isValid: true,
                lastActivity: expect.any(Date)
            });
            expect(mockUserManager.createAnonymousUser).toHaveBeenCalledWith('device123');
        });
        it.skip('should restore existing session', async () => {
            const existingUser = {
                id: 'existing123',
                deviceId: 'device123',
                authLevel: 'oauth',
                createdAt: new Date(),
                lastActivity: new Date(),
                oauthData: {
                    provider: 'github',
                    providerId: 'github123',
                    email: 'test@example.com'
                }
            };
            mockUserManager.getUserById.mockResolvedValueOnce(existingUser);
            const session = await authManager.initializeSession('device123', 'existing123');
            expect(session.authLevel).toBe('oauth');
            expect(session.userId).toBe('existing123');
        });
        it.skip('should handle invalid user ID gracefully', async () => {
            mockUserManager.getUserById.mockResolvedValueOnce(null);
            mockUserManager.createAnonymousUser.mockResolvedValueOnce({
                id: 'new123',
                deviceId: 'device123',
                authLevel: 'anonymous',
                createdAt: new Date(),
                lastActivity: new Date()
            });
            const session = await authManager.initializeSession('device123', 'invalid-user');
            expect(session.authLevel).toBe('anonymous');
            expect(session.userId).toBe('new123');
        });
    });
    describe('upgradeToOAuth', () => {
        it.skip('should upgrade anonymous user to OAuth', async () => {
            // Setup existing anonymous session
            const anonymousSession = {
                userId: 'user123',
                deviceId: 'device123',
                authLevel: 'anonymous',
                isValid: true,
                lastActivity: new Date()
            };
            const mockUser = {
                id: 'user123',
                deviceId: 'device123',
                authLevel: 'anonymous',
                createdAt: new Date(),
                lastActivity: new Date()
            };
            const oauthData = {
                provider: 'github',
                providerId: 'github123',
                email: 'test@example.com',
                name: 'Test User',
                avatarUrl: 'https://avatar.url',
                accessToken: 'token123',
                refreshToken: 'refresh123',
                expiresAt: new Date(Date.now() + 3600000)
            };
            mockUserManager.getUserById.mockResolvedValueOnce(mockUser);
            mockUserManager.updateUser.mockResolvedValueOnce({
                ...mockUser,
                authLevel: 'oauth',
                oauthData
            });
            const upgradedSession = await authManager.upgradeToOAuth(anonymousSession, 'github', 'valid-token');
            expect(upgradedSession.authLevel).toBe('oauth');
            expect(mockUserManager.updateUser).toHaveBeenCalledWith('user123', {
                authLevel: 'oauth',
                oauthData,
                lastActivity: expect.any(Date)
            });
        });
        it.skip('should handle OAuth validation failure', async () => {
            const session = {
                userId: 'user123',
                deviceId: 'device123',
                authLevel: 'anonymous',
                isValid: true,
                lastActivity: new Date()
            };
            const mockProvider = mockOAuthProviders.get('github');
            mockProvider.validateToken = vi.fn().mockRejectedValueOnce(new Error('Invalid token'));
            await expect(authManager.upgradeToOAuth(session, 'github', 'invalid-token')).rejects.toThrow('Invalid token');
        });
        it('should handle unsupported OAuth provider', async () => {
            const session = {
                userId: 'user123',
                deviceId: 'device123',
                authLevel: 'anonymous',
                isValid: true,
                lastActivity: new Date()
            };
            await expect(authManager.upgradeToOAuth(session, 'unsupported', 'token')).rejects.toThrow();
        });
    });
    describe('getAuthStatus', () => {
        it.skip('should return current authentication status', async () => {
            const session = {
                userId: 'user123',
                deviceId: 'device123',
                authLevel: 'oauth',
                isValid: true,
                lastActivity: new Date()
            };
            const status = await authManager.getAuthStatus(session);
            expect(status).toEqual({
                authLevel: 'oauth',
                isValid: true,
                userId: 'user123',
                deviceId: 'device123',
                lastActivity: expect.any(Date)
            });
        });
        it.skip('should mark expired session as invalid', async () => {
            const expiredSession = {
                userId: 'user123',
                deviceId: 'device123',
                authLevel: 'oauth',
                isValid: true,
                expiresAt: new Date(Date.now() - 1000), // Expired 1 second ago
                lastActivity: new Date()
            };
            const status = await authManager.getAuthStatus(expiredSession);
            expect(status.isValid).toBe(false);
        });
    });
    describe('shouldSuggestUpgrade', () => {
        it.skip('should suggest upgrade for anonymous users after usage threshold', async () => {
            const session = {
                userId: 'user123',
                deviceId: 'device123',
                authLevel: 'anonymous',
                isValid: true,
                lastActivity: new Date()
            };
            // Mock usage data that exceeds threshold
            mockUserManager.getUserById.mockResolvedValueOnce({
                id: 'user123',
                requestCount: 10, // Above threshold
                authLevel: 'anonymous'
            });
            const shouldUpgrade = await authManager.shouldSuggestUpgrade(session, {
                triggerReason: 'multi_device'
            });
            expect(shouldUpgrade).toBe(true);
        });
        it('should not suggest upgrade for OAuth users', async () => {
            const session = {
                userId: 'user123',
                deviceId: 'device123',
                authLevel: 'oauth',
                isValid: true,
                lastActivity: new Date()
            };
            const shouldUpgrade = await authManager.shouldSuggestUpgrade(session, {
                triggerReason: 'premium_features'
            });
            expect(shouldUpgrade).toBe(false);
        });
    });
    describe('session management', () => {
        it.skip('should invalidate session', async () => {
            const session = {
                userId: 'user123',
                deviceId: 'device123',
                authLevel: 'oauth',
                isValid: true,
                lastActivity: new Date()
            };
            await authManager.invalidateSession(session);
            expect(session.isValid).toBe(false);
        });
        it('should cleanup expired sessions', async () => {
            // This tests internal session cleanup logic
            const result = await authManager.cleanupExpiredSessions();
            expect(typeof result).toBe('number'); // Should return count of cleaned sessions
        });
    });
});
