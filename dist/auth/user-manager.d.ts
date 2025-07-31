/**
 * User Manager - Handles user lifecycle and progressive authentication
 *
 * Supports anonymous users upgrading to OAuth and Passkey authentication
 */
export interface User {
    userId: string;
    isAnonymous: boolean;
    oauthProvider?: 'github' | 'google' | 'microsoft';
    oauthId?: string;
    email?: string;
    plan: 'free' | 'pro';
    features: string[];
    createdAt: Date;
    updatedAt: Date;
}
export interface UserDevice {
    deviceId: string;
    userId: string;
    deviceName: string;
    deviceFingerprint: string;
    isActive: boolean;
    lastSeen: Date;
    createdAt: Date;
}
export interface OAuthData {
    provider: 'github' | 'google' | 'microsoft';
    oauthId: string;
    email: string;
    accessToken?: string;
}
export interface DatabaseAdapter {
    createUser(userData: Partial<User>): Promise<User>;
    findUserById(userId: string): Promise<User | null>;
    findUserByOAuth(provider: string, oauthId: string): Promise<User | null>;
    updateUser(userId: string, updates: Partial<User>): Promise<User>;
    createDevice(deviceData: Partial<UserDevice>): Promise<UserDevice>;
    findDeviceById(deviceId: string): Promise<UserDevice | null>;
    findUserDevices(userId: string): Promise<UserDevice[]>;
    updateDevice(deviceId: string, updates: Partial<UserDevice>): Promise<UserDevice>;
}
export declare class UserManager {
    private db;
    constructor(db: DatabaseAdapter);
    /**
     * Generate a stable device ID from device characteristics
     */
    generateDeviceId(machineId: string, additionalInfo?: any): string;
    /**
     * Generate a unique user ID
     */
    generateUserId(): string;
    /**
     * Get or create anonymous user for a device
     */
    getOrCreateAnonymousUser(deviceId: string, deviceName?: string): Promise<User>;
    /**
     * Upgrade anonymous user to OAuth account
     */
    upgradeToOAuth(userId: string, oauthData: OAuthData): Promise<User>;
    /**
     * Link a new device to an existing OAuth user
     */
    linkDeviceToUser(userId: string, deviceId: string, deviceName?: string): Promise<UserDevice>;
    /**
     * Get all devices for a user
     */
    getUserDevices(userId: string): Promise<UserDevice[]>;
    /**
     * Upgrade user plan (free → pro)
     */
    upgradeUserPlan(userId: string, plan: 'pro'): Promise<User>;
    /**
     * Validate user has required features
     */
    hasFeature(user: User, feature: string): boolean;
    /**
     * Get user authentication level
     */
    getAuthLevel(user: User): 'anonymous' | 'oauth' | 'pro';
    /**
     * Merge anonymous user data into existing OAuth user
     * (Private helper method)
     */
    private mergeAnonymousIntoExisting;
    /**
     * Deactivate a device (user logs out or device is compromised)
     */
    deactivateDevice(deviceId: string): Promise<void>;
    /**
     * Clean up inactive devices (maintenance task)
     */
    cleanupInactiveDevices(inactiveDays?: number): Promise<number>;
}
//# sourceMappingURL=user-manager.d.ts.map