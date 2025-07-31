/**
 * Simplified OAuth Authentication Manager
 *
 * Uses VS Code's built-in authentication providers instead of private keys.
 * Much simpler and more secure approach using standard OAuth flows.
 */
export interface OAuthSession {
    userId: string;
    deviceId: string;
    extensionId: string;
    authLevel: 'anonymous' | 'oauth' | 'pro';
    provider: 'github' | 'google' | 'microsoft';
    accessToken: string;
    userInfo: {
        id: string;
        email: string;
        name: string;
        avatar?: string;
    };
    isValid: boolean;
    expiresAt?: Date;
    lastActivity: Date;
}
export interface OAuthConfig {
    allowedProviders: ('github' | 'google' | 'microsoft')[];
    allowedUsers?: string[];
    allowedOrgs?: string[];
    requireVerifiedEmail?: boolean;
    sessionExpirationMs?: number;
}
export declare class OAuthAuthManager {
    private config;
    private activeSessions;
    constructor(config: OAuthConfig);
    /**
     * Authenticate extension using OAuth token from VS Code
     */
    authenticateWithOAuth(extensionId: string, provider: 'github' | 'google' | 'microsoft', accessToken: string, deviceId: string): Promise<OAuthSession>;
    /**
     * Validate OAuth token with provider
     */
    private validateOAuthToken;
    /**
     * Get user's organizations (GitHub only for now)
     */
    private getUserOrganizations;
    /**
     * Generate session token
     */
    private generateSessionToken;
    /**
     * Validate session token
     */
    validateSession(sessionToken: string): OAuthSession | null;
    /**
     * Get session by token
     */
    getSession(sessionToken: string): OAuthSession | null;
    /**
     * Invalidate session
     */
    invalidateSession(sessionToken: string): void;
    /**
     * Clean up expired sessions
     */
    cleanupExpiredSessions(): number;
    /**
     * Get authentication statistics
     */
    getStats(): {
        activeSessions: number;
        sessionsByProvider: Record<string, number>;
        sessionsByExtension: Record<string, number>;
        sessionsByUser: Record<string, number>;
    };
    /**
     * Refresh OAuth token if needed
     */
    refreshTokenIfNeeded(sessionToken: string): Promise<boolean>;
}
//# sourceMappingURL=oauth-auth-manager.d.ts.map