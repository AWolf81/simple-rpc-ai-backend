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
    roles: UserRole[];
}
export type UserRole = 'user' | 'admin' | 'super_admin';
export interface UserRoleInfo {
    email: string;
    roles: UserRole[];
    grantedBy: string;
    grantedAt: Date;
}
export interface OAuthConfig {
    allowedProviders: ('github' | 'google' | 'microsoft')[];
    accessMode?: 'open' | 'allowlist' | 'development';
    allowedUsers?: string[];
    allowedOrgs?: string[];
    requireVerifiedEmail?: boolean;
    sessionExpirationMs?: number;
    blacklistedUsers?: string[];
    blacklistedIPs?: string[];
    rateLimiting?: {
        maxRequestsPerHour?: number;
        maxSessionsPerUser?: number;
        autoBlacklistThreshold?: number;
    };
    userLimits?: {
        maxUsers?: number;
        maxActiveUsers?: number;
        waitlistEnabled?: boolean;
        adminBypassLimits?: boolean;
    };
    persistUserManagement?: boolean;
    superAdmins?: string[];
    initialAdmins?: string[];
}
export declare class OAuthAuthManager {
    private config;
    private activeSessions;
    private dbAdapter;
    private dynamicBlacklist;
    private dynamicAllowlist;
    private requestCounts;
    private violationCounts;
    private userRoles;
    private registeredUsers;
    private waitlist;
    constructor(config: OAuthConfig);
    /**
     * Initialize roles from configuration
     */
    private initializeRoles;
    /**
     * Authenticate extension using OAuth token from VS Code
     */
    authenticateWithOAuth(extensionId: string, provider: 'github' | 'google' | 'microsoft', accessToken: string, deviceId: string): Promise<{
        session: OAuthSession;
        sessionToken: string;
    }>;
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
     * Check if user is blacklisted
     */
    private isUserBlacklisted;
    /**
     * Admin: Blacklist a user
     */
    blacklistUser(emailOrId: string, reason?: string): void;
    /**
     * Admin: Remove user from blacklist
     */
    unblacklistUser(emailOrId: string): void;
    /**
     * Check if user is in allowlist (static config + dynamic)
     */
    private isUserAllowed;
    /**
     * Admin: Add user to allowlist (for allowlist mode)
     */
    allowUser(emailOrId: string, reason?: string): void;
    /**
     * Admin: Remove user from allowlist
     */
    disallowUser(emailOrId: string): void;
    /**
     * Admin: Change access mode on the fly
     */
    setAccessMode(mode: 'open' | 'allowlist' | 'development'): void;
    /**
     * Get user roles
     */
    getUserRoles(email: string): UserRole[];
    /**
     * Check if user has specific role
     */
    hasRole(email: string, role: UserRole): boolean;
    /**
     * Check if user is admin (admin or super_admin)
     */
    isAdmin(email: string): boolean;
    /**
     * Check if user is super admin
     */
    isSuperAdmin(email: string): boolean;
    /**
     * Admin: Grant role to user (requires appropriate permissions)
     */
    grantRole(targetEmail: string, role: UserRole, grantedByEmail: string): void;
    /**
     * Admin: Revoke role from user (requires appropriate permissions)
     */
    revokeRole(targetEmail: string, role: UserRole, revokedByEmail: string): void;
    /**
     * Update roles in existing sessions
     */
    private updateSessionRoles;
    /**
     * Get all user roles (admin function)
     */
    getAllUserRoles(): UserRoleInfo[];
    /**
     * Check rate limiting and auto-blacklist
     */
    private checkRateLimit;
    /**
     * Admin: Get security statistics
     */
    getSecurityStats(): {
        blacklistedUsers: string[];
        activeViolations: Record<string, number>;
        requestCounts: Record<string, {
            count: number;
            resetsIn: number;
        }>;
        suspiciousActivity: string[];
    };
    /**
     * Check user limits for public beta launches
     */
    private checkUserLimits;
    /**
     * Add user to waitlist when user limit is reached
     */
    private addToWaitlist;
    /**
     * Admin: Get user statistics including limits
     */
    getUserStats(): {
        currentUsers: number;
        maxUsers: number | null;
        activeUsers: number;
        maxActiveUsers: number | null;
        waitlistCount: number;
        limitReached: boolean;
        limitsEnabled: boolean;
    };
    /**
     * Admin: Set user limit (runtime configuration)
     */
    setUserLimit(newLimit: number, changedByEmail: string): void;
    /**
     * Admin: Add more user slots temporarily
     */
    addUserSlots(additionalSlots: number, grantedByEmail: string): void;
    /**
     * Admin: Get waitlist
     */
    getWaitlist(): Array<{
        email: string;
        requestedAt: Date;
        provider: string;
    }>;
    /**
     * Admin: Process waitlist when slots become available
     */
    private processWaitlist;
    /**
     * Admin: Remove user from waitlist
     */
    removeFromWaitlist(email: string, removedByEmail: string): boolean;
    /**
     * Admin: Grant special access to user (above user limit)
     * This allows specific users to authenticate even when the user limit is reached
     */
    grantSpecialAccess(email: string, reason: string, grantedByEmail: string): void;
    /**
     * Admin: Promote user from waitlist to access (above limit)
     * This is a convenience method for granting access to specific waitlisted users
     */
    promoteFromWaitlist(email: string, promotedByEmail: string): boolean;
    /**
     * Admin: Revoke special access (user goes back to normal limit rules)
     */
    revokeSpecialAccess(email: string, revokedByEmail: string): boolean;
    /**
     * Admin: Get list of users with special access
     */
    getSpecialAccessUsers(): string[];
    /**
     * Admin: Bulk grant access to multiple users (e.g., coworkers, friends)
     */
    bulkGrantSpecialAccess(emails: string[], reason: string, grantedByEmail: string): {
        granted: string[];
        skipped: string[];
    };
    /**
     * Refresh OAuth token if needed
     */
    refreshTokenIfNeeded(sessionToken: string): Promise<boolean>;
}
//# sourceMappingURL=oauth-auth-manager.d.ts.map