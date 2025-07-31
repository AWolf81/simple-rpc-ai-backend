/**
 * Progressive Authentication Manager
 *
 * Handles the flow from anonymous → OAuth → Passkey authentication
 * Integrates with VS Code authentication API for seamless OAuth
 */
import { UserManager, OAuthData } from './user-manager.js';
import { SimpleKeyManager } from './key-manager.js';
export interface AuthSession {
    userId: string;
    deviceId: string;
    authLevel: 'anonymous' | 'oauth' | 'passkey' | 'pro';
    isValid: boolean;
    expiresAt?: Date;
    lastActivity: Date;
    extensionId?: string;
    extensionVersion?: string;
    jwtToken?: string;
    tokenExpiresAt?: Date;
}
export interface OAuthProvider {
    provider: 'github' | 'google' | 'microsoft';
    scopes: string[];
    validateToken(token: string): Promise<OAuthData>;
}
export interface PasskeyCredential {
    credentialId: string;
    userId: string;
    publicKey: string;
    counter: number;
    deviceName: string;
}
export interface AuthUpgradeOptions {
    triggerReason: 'multi_device' | 'premium_features' | 'security' | 'manual';
    deviceName?: string;
    skipPrompts?: boolean;
}
export declare class AuthManager {
    private userManager;
    private keyManager;
    private oauthProviders;
    private activeSessions;
    constructor(userManager: UserManager, keyManager: SimpleKeyManager, oauthProviders: Map<string, OAuthProvider>);
    /**
     * Initialize user session (anonymous or existing)
     */
    initializeSession(deviceId: string, deviceName?: string): Promise<AuthSession>;
    /**
     * Get current session for device
     */
    getSession(deviceId: string): AuthSession | null;
    /**
     * Check if user should be prompted for authentication upgrade
     */
    shouldSuggestUpgrade(session: AuthSession, triggerReason: string): boolean;
    /**
     * Upgrade anonymous user to OAuth
     */
    upgradeToOAuth(deviceId: string, provider: string, oauthToken: string, options?: AuthUpgradeOptions): Promise<AuthSession>;
    /**
     * Link a new device to authenticated user
     */
    linkDevice(existingDeviceId: string, newDeviceId: string, newDeviceName?: string): Promise<AuthSession>;
    /**
     * Generate device linking code for OAuth users
     */
    generateDeviceLinkCode(email: string): Promise<{
        code: string;
        expiresAt: Date;
    }>;
    /**
     * Link device using email code
     */
    linkDeviceWithCode(newDeviceId: string, code: string, deviceName?: string): Promise<AuthSession>;
    /**
     * Upgrade to Pro plan
     */
    upgradeToPro(deviceId: string): Promise<AuthSession>;
    /**
     * Check if user has required features
     */
    hasFeature(deviceId: string, feature: string): Promise<boolean>;
    /**
     * Get user's authentication status and available upgrades
     */
    getAuthStatus(deviceId: string): Promise<{
        authLevel: string;
        features: string[];
        availableUpgrades: string[];
        deviceCount: number;
        hasValidKeys: boolean;
    }>;
    /**
     * Invalidate session (logout)
     */
    invalidateSession(deviceId: string): void;
    /**
     * Clean up expired sessions (maintenance task)
     */
    cleanupExpiredSessions(): number;
    /**
     * Get all users (helper method - would be implemented properly with database)
     */
    private getAllUsers;
}
//# sourceMappingURL=auth-manager.d.ts.map