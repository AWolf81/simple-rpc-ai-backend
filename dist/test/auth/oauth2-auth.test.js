import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
// Mock OAuth2 libraries
vi.mock('oauth2-server', () => ({
    OAuth2Server: vi.fn()
}));
vi.mock('passport', () => ({
    use: vi.fn(),
    authenticate: vi.fn(),
    serializeUser: vi.fn(),
    deserializeUser: vi.fn()
}));
vi.mock('passport-google-oauth20', () => ({
    Strategy: vi.fn()
}));
vi.mock('passport-github2', () => ({
    Strategy: vi.fn()
}));
// Mock JWT library
vi.mock('jsonwebtoken', () => ({
    verify: vi.fn(),
    sign: vi.fn(),
    decode: vi.fn()
}));
// Mock RPC client
const mockRPCClient = {
    request: vi.fn()
};
vi.mock('../../src/client.js', () => ({
    RPCClient: vi.fn().mockImplementation(() => mockRPCClient)
}));
describe.skip('OAuth2 Authentication for API Key Storage (REMOVED FEATURE - OAuth2 auth removed)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });
    afterEach(() => {
        vi.resetAllMocks();
    });
    describe('Google OAuth2 Integration', () => {
        it('should authenticate user with Google OAuth2', async () => {
            const googleProfile = {
                id: 'google-12345',
                emails: [{ value: 'user@gmail.com' }],
                displayName: 'John Doe',
                provider: 'google'
            };
            // Mock JWT creation with Google OAuth data
            const { sign } = await import('jsonwebtoken');
            const mockSign = vi.mocked(sign);
            const mockJWT = 'eyJ...google-oauth-jwt';
            mockSign.mockReturnValue(mockJWT);
            const token = sign({
                userId: `google-${googleProfile.id}`,
                email: googleProfile.emails[0].value,
                provider: 'google',
                googleId: googleProfile.id
            }, 'secret', { expiresIn: '1h' });
            expect(token).toBe(mockJWT);
        });
        it('should store API key with Google OAuth JWT', async () => {
            const googleOAuthJWT = 'eyJ...google-oauth-jwt';
            // Mock JWT validation
            const { verify } = await import('jsonwebtoken');
            const mockVerify = vi.mocked(verify);
            mockVerify.mockReturnValue({
                userId: 'google-12345',
                email: 'user@gmail.com',
                provider: 'google',
                googleId: '12345'
            });
            // Mock RPC call
            mockRPCClient.request.mockResolvedValueOnce({
                success: true,
                keyId: 'google-user-key-id',
                message: 'API key stored for Google OAuth user'
            });
            const result = await mockRPCClient.request('storeUserKey', {
                jwt: googleOAuthJWT,
                provider: 'anthropic',
                apiKey: 'sk-ant-google-user-key'
            });
            expect(result.success).toBe(true);
            expect(result.message).toContain('Google OAuth user');
        });
        it('should handle Google OAuth user with existing account', async () => {
            const googleJWT = 'eyJ...existing-google-user-jwt';
            const { verify } = await import('jsonwebtoken');
            const mockVerify = vi.mocked(verify);
            mockVerify.mockReturnValue({
                userId: 'user-123', // Original user ID
                email: 'user@gmail.com',
                googleId: '12345', // Added Google OAuth
                alternateUserIds: ['google-12345']
            });
            mockRPCClient.request.mockResolvedValueOnce({
                success: true,
                message: 'Existing user linked with Google OAuth'
            });
            const result = await mockRPCClient.request('linkOAuthAccount', {
                jwt: googleJWT,
                oauthProvider: 'google'
            });
            expect(result.message).toContain('linked with Google OAuth');
        });
    });
    describe('GitHub OAuth2 Integration', () => {
        it('should authenticate user with GitHub OAuth2', async () => {
            const githubProfile = {
                id: 'github-67890',
                username: 'johndoe',
                emails: [{ value: 'john@github.com' }],
                displayName: 'John Doe',
                provider: 'github'
            };
            // Mock JWT creation with GitHub OAuth data
            const { sign } = await import('jsonwebtoken');
            const mockSign = vi.mocked(sign);
            const mockJWT = 'eyJ...github-oauth-jwt';
            mockSign.mockReturnValue(mockJWT);
            const token = sign({
                userId: `github-${githubProfile.id}`,
                email: githubProfile.emails[0].value,
                provider: 'github',
                githubId: githubProfile.id,
                username: githubProfile.username
            }, 'secret', { expiresIn: '1h' });
            expect(token).toBe(mockJWT);
        });
        it('should store API key with GitHub OAuth JWT', async () => {
            const githubOAuthJWT = 'eyJ...github-oauth-jwt';
            const { verify } = await import('jsonwebtoken');
            const mockVerify = vi.mocked(verify);
            mockVerify.mockReturnValue({
                userId: 'github-67890',
                email: 'john@github.com',
                provider: 'github',
                githubId: '67890',
                username: 'johndoe'
            });
            mockRPCClient.request.mockResolvedValueOnce({
                success: true,
                keyId: 'github-user-key-id',
                message: 'API key stored for GitHub OAuth user'
            });
            const result = await mockRPCClient.request('storeUserKey', {
                jwt: githubOAuthJWT,
                provider: 'openai',
                apiKey: 'sk-github-user-openai-key'
            });
            expect(result.success).toBe(true);
            expect(result.message).toContain('GitHub OAuth user');
        });
    });
    describe('Multi-Provider OAuth2 Support', () => {
        it('should support user with multiple OAuth providers', async () => {
            // User has both Google and GitHub OAuth linked
            const multiProviderJWT = 'eyJ...multi-provider-jwt';
            const { verify } = await import('jsonwebtoken');
            const mockVerify = vi.mocked(verify);
            mockVerify.mockReturnValue({
                userId: 'user-123',
                email: 'user@company.com',
                googleId: '12345',
                githubId: '67890',
                alternateUserIds: ['google-12345', 'github-67890']
            });
            mockRPCClient.request.mockResolvedValueOnce({
                success: true,
                providers: [
                    { provider: 'anthropic', hasKey: true },
                    { provider: 'openai', hasKey: true }
                ],
                linkedAccounts: ['google', 'github']
            });
            const result = await mockRPCClient.request('getUserProviders', {
                jwt: multiProviderJWT
            });
            expect(result.linkedAccounts).toContain('google');
            expect(result.linkedAccounts).toContain('github');
            expect(result.providers).toHaveLength(2);
        });
        it('should maintain same vault across OAuth providers', async () => {
            // Store key with Google OAuth
            const googleJWT = 'eyJ...google-jwt';
            const { verify } = await import('jsonwebtoken');
            const mockVerify = vi.mocked(verify);
            mockVerify.mockReturnValueOnce({
                userId: 'user-123',
                email: 'user@company.com',
                googleId: '12345'
            });
            mockRPCClient.request.mockResolvedValueOnce({
                success: true,
                keyId: 'shared-key-id'
            });
            await mockRPCClient.request('storeUserKey', {
                jwt: googleJWT,
                provider: 'anthropic',
                apiKey: 'shared-api-key'
            });
            // Retrieve same key with GitHub OAuth (same user)
            const githubJWT = 'eyJ...github-jwt-same-user';
            mockVerify.mockReturnValueOnce({
                userId: 'user-123',
                email: 'user@company.com',
                githubId: '67890',
                googleId: '12345' // Still has Google ID
            });
            mockRPCClient.request.mockResolvedValueOnce({
                success: true,
                apiKey: 'shared-api-key'
            });
            const result = await mockRPCClient.request('getUserKey', {
                jwt: githubJWT,
                provider: 'anthropic'
            });
            expect(result.apiKey).toBe('shared-api-key');
        });
    });
    describe('OAuth2 Device Flow for CLI/Desktop Apps', () => {
        it('should support device authorization flow', async () => {
            mockRPCClient.request.mockResolvedValueOnce({
                device_code: 'device-12345',
                user_code: 'ABCD-EFGH',
                verification_uri: 'https://auth.company.com/device',
                interval: 5,
                expires_in: 600
            });
            const deviceAuth = await mockRPCClient.request('initializeDeviceAuth', {
                client_id: 'cli-app-client-id',
                scope: 'api-key-management'
            });
            expect(deviceAuth.device_code).toBe('device-12345');
            expect(deviceAuth.user_code).toBe('ABCD-EFGH');
            expect(deviceAuth.verification_uri).toContain('device');
        });
        it('should poll for device authorization completion', async () => {
            // First poll - authorization pending
            mockRPCClient.request.mockResolvedValueOnce({
                error: 'authorization_pending'
            });
            let result = await mockRPCClient.request('pollDeviceAuth', {
                device_code: 'device-12345'
            });
            expect(result.error).toBe('authorization_pending');
            // Second poll - authorization complete
            mockRPCClient.request.mockResolvedValueOnce({
                access_token: 'oauth-access-token',
                jwt: 'eyJ...device-flow-jwt',
                user: {
                    userId: 'device-user-123',
                    email: 'device@company.com'
                }
            });
            result = await mockRPCClient.request('pollDeviceAuth', {
                device_code: 'device-12345'
            });
            expect(result.access_token).toBe('oauth-access-token');
            expect(result.jwt).toBe('eyJ...device-flow-jwt');
        });
    });
    describe('OAuth2 Security and Error Handling', () => {
        it('should handle invalid OAuth2 state parameter', async () => {
            mockRPCClient.request.mockResolvedValueOnce({
                error: 'invalid_request',
                error_description: 'Invalid state parameter'
            });
            const result = await mockRPCClient.request('handleOAuthCallback', {
                code: 'auth-code-123',
                state: 'invalid-state'
            });
            expect(result.error).toBe('invalid_request');
            expect(result.error_description).toContain('Invalid state');
        });
        it('should handle OAuth2 access denied', async () => {
            mockRPCClient.request.mockResolvedValueOnce({
                error: 'access_denied',
                error_description: 'User denied access'
            });
            const result = await mockRPCClient.request('handleOAuthCallback', {
                error: 'access_denied'
            });
            expect(result.error).toBe('access_denied');
            expect(result.error_description).toContain('User denied access');
        });
        it('should handle expired OAuth2 authorization codes', async () => {
            mockRPCClient.request.mockResolvedValueOnce({
                error: 'invalid_grant',
                error_description: 'Authorization code expired'
            });
            const result = await mockRPCClient.request('handleOAuthCallback', {
                code: 'expired-auth-code'
            });
            expect(result.error).toBe('invalid_grant');
            expect(result.error_description).toContain('expired');
        });
        it('should refresh OAuth2 tokens when needed', async () => {
            mockRPCClient.request.mockResolvedValueOnce({
                access_token: 'new-access-token',
                refresh_token: 'new-refresh-token',
                jwt: 'eyJ...refreshed-jwt'
            });
            const result = await mockRPCClient.request('refreshOAuthToken', {
                refresh_token: 'existing-refresh-token'
            });
            expect(result.access_token).toBe('new-access-token');
            expect(result.jwt).toBe('eyJ...refreshed-jwt');
        });
    });
});
