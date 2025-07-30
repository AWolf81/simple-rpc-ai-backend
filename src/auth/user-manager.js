"use strict";
/**
 * User Manager - Handles user lifecycle and progressive authentication
 *
 * Supports anonymous users upgrading to OAuth and Passkey authentication
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserManager = void 0;
const crypto_1 = require("crypto");
const uuid_1 = require("uuid");
class UserManager {
    constructor(db) {
        this.db = db;
    }
    /**
     * Generate a stable device ID from device characteristics
     */
    generateDeviceId(machineId, additionalInfo) {
        const deviceInfo = {
            machineId,
            ...additionalInfo
        };
        return (0, crypto_1.createHash)('sha256')
            .update(JSON.stringify(deviceInfo))
            .digest('hex')
            .substring(0, 32);
    }
    /**
     * Generate a unique user ID
     */
    generateUserId() {
        return `user_${(0, uuid_1.v4)().replace(/-/g, '').substring(0, 24)}`;
    }
    /**
     * Get or create anonymous user for a device
     */
    async getOrCreateAnonymousUser(deviceId, deviceName) {
        // Check if device already exists
        const existingDevice = await this.db.findDeviceById(deviceId);
        if (existingDevice) {
            // Device exists, return associated user
            const user = await this.db.findUserById(existingDevice.userId);
            if (user) {
                // Update device last seen
                await this.db.updateDevice(deviceId, { lastSeen: new Date() });
                return user;
            }
        }
        // Create new anonymous user
        const newUser = await this.db.createUser({
            userId: this.generateUserId(),
            isAnonymous: true,
            plan: 'free',
            features: ['ai_analysis', 'key_storage'],
            createdAt: new Date(),
            updatedAt: new Date()
        });
        // Associate device with user
        await this.db.createDevice({
            deviceId,
            userId: newUser.userId,
            deviceName: deviceName || 'Unknown Device',
            deviceFingerprint: deviceId,
            isActive: true,
            lastSeen: new Date(),
            createdAt: new Date()
        });
        return newUser;
    }
    /**
     * Upgrade anonymous user to OAuth account
     */
    async upgradeToOAuth(userId, oauthData) {
        // Check if OAuth account already exists
        const existingOAuthUser = await this.db.findUserByOAuth(oauthData.provider, oauthData.oauthId);
        if (existingOAuthUser) {
            // OAuth account exists - need to merge anonymous data
            await this.mergeAnonymousIntoExisting(userId, existingOAuthUser.userId);
            return existingOAuthUser;
        }
        // Upgrade anonymous user to OAuth account
        const upgradedUser = await this.db.updateUser(userId, {
            isAnonymous: false,
            oauthProvider: oauthData.provider,
            oauthId: oauthData.oauthId,
            email: oauthData.email,
            features: ['ai_analysis', 'key_storage', 'multi_device', 'cloud_sync'],
            updatedAt: new Date()
        });
        return upgradedUser;
    }
    /**
     * Link a new device to an existing OAuth user
     */
    async linkDeviceToUser(userId, deviceId, deviceName) {
        const user = await this.db.findUserById(userId);
        if (!user) {
            throw new Error('User not found');
        }
        if (user.isAnonymous) {
            throw new Error('Cannot link devices to anonymous users. Upgrade to OAuth first.');
        }
        // Check if device already linked
        const existingDevice = await this.db.findDeviceById(deviceId);
        if (existingDevice) {
            if (existingDevice.userId === userId) {
                // Device already linked to this user
                return await this.db.updateDevice(deviceId, {
                    isActive: true,
                    lastSeen: new Date()
                });
            }
            else {
                throw new Error('Device already linked to another user');
            }
        }
        // Create new device association
        return await this.db.createDevice({
            deviceId,
            userId,
            deviceName: deviceName || 'Linked Device',
            deviceFingerprint: deviceId,
            isActive: true,
            lastSeen: new Date(),
            createdAt: new Date()
        });
    }
    /**
     * Get all devices for a user
     */
    async getUserDevices(userId) {
        return await this.db.findUserDevices(userId);
    }
    /**
     * Upgrade user plan (free → pro)
     */
    async upgradeUserPlan(userId, plan) {
        const proFeatures = [
            'ai_analysis',
            'key_storage',
            'multi_device',
            'cloud_sync',
            'premium_prompts',
            'custom_prompts',
            'priority_support',
            'usage_analytics'
        ];
        return await this.db.updateUser(userId, {
            plan,
            features: proFeatures,
            updatedAt: new Date()
        });
    }
    /**
     * Validate user has required features
     */
    hasFeature(user, feature) {
        return user.features.includes(feature);
    }
    /**
     * Get user authentication level
     */
    getAuthLevel(user) {
        if (user.plan === 'pro')
            return 'pro';
        if (!user.isAnonymous)
            return 'oauth';
        return 'anonymous';
    }
    /**
     * Merge anonymous user data into existing OAuth user
     * (Private helper method)
     */
    async mergeAnonymousIntoExisting(anonymousUserId, existingUserId) {
        // This would need to:
        // 1. Transfer all keys from anonymous user to existing user
        // 2. Transfer all devices from anonymous user to existing user
        // 3. Delete anonymous user
        // Implementation depends on the specific database adapter
        // For now, we'll throw an error to prevent data loss
        throw new Error('OAuth account already exists. Manual data migration required. ' +
            `Anonymous user: ${anonymousUserId}, Existing user: ${existingUserId}`);
    }
    /**
     * Deactivate a device (user logs out or device is compromised)
     */
    async deactivateDevice(deviceId) {
        await this.db.updateDevice(deviceId, {
            isActive: false,
            lastSeen: new Date()
        });
    }
    /**
     * Clean up inactive devices (maintenance task)
     */
    async cleanupInactiveDevices(inactiveDays = 90) {
        // This would be implemented in the database adapter
        // Return number of devices cleaned up
        return 0;
    }
}
exports.UserManager = UserManager;
//# sourceMappingURL=user-manager.js.map