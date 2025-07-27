/**
 * User Manager - Handles user lifecycle and progressive authentication
 * 
 * Supports anonymous users upgrading to OAuth and Passkey authentication
 */

import { createHash, randomBytes } from 'crypto';
import { v4 as uuidv4 } from 'uuid';

export interface User {
  userId: string;
  isAnonymous: boolean;
  
  // OAuth fields (optional)
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
  // User operations
  createUser(userData: Partial<User>): Promise<User>;
  findUserById(userId: string): Promise<User | null>;
  findUserByOAuth(provider: string, oauthId: string): Promise<User | null>;
  updateUser(userId: string, updates: Partial<User>): Promise<User>;
  
  // Device operations
  createDevice(deviceData: Partial<UserDevice>): Promise<UserDevice>;
  findDeviceById(deviceId: string): Promise<UserDevice | null>;
  findUserDevices(userId: string): Promise<UserDevice[]>;
  updateDevice(deviceId: string, updates: Partial<UserDevice>): Promise<UserDevice>;
}

export class UserManager {
  constructor(private db: DatabaseAdapter) {}

  /**
   * Generate a stable device ID from device characteristics
   */
  generateDeviceId(machineId: string, additionalInfo?: any): string {
    const deviceInfo = {
      machineId,
      ...additionalInfo
    };
    
    return createHash('sha256')
      .update(JSON.stringify(deviceInfo))
      .digest('hex')
      .substring(0, 32);
  }

  /**
   * Generate a unique user ID
   */
  generateUserId(): string {
    return `user_${uuidv4().replace(/-/g, '').substring(0, 24)}`;
  }

  /**
   * Get or create anonymous user for a device
   */
  async getOrCreateAnonymousUser(deviceId: string, deviceName?: string): Promise<User> {
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
  async upgradeToOAuth(userId: string, oauthData: OAuthData): Promise<User> {
    // Check if OAuth account already exists
    const existingOAuthUser = await this.db.findUserByOAuth(
      oauthData.provider, 
      oauthData.oauthId
    );

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
  async linkDeviceToUser(userId: string, deviceId: string, deviceName?: string): Promise<UserDevice> {
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
      } else {
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
  async getUserDevices(userId: string): Promise<UserDevice[]> {
    return await this.db.findUserDevices(userId);
  }

  /**
   * Upgrade user plan (free → pro)
   */
  async upgradeUserPlan(userId: string, plan: 'pro'): Promise<User> {
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
  hasFeature(user: User, feature: string): boolean {
    return user.features.includes(feature);
  }

  /**
   * Get user authentication level
   */
  getAuthLevel(user: User): 'anonymous' | 'oauth' | 'pro' {
    if (user.plan === 'pro') return 'pro';
    if (!user.isAnonymous) return 'oauth';
    return 'anonymous';
  }

  /**
   * Merge anonymous user data into existing OAuth user
   * (Private helper method)
   */
  private async mergeAnonymousIntoExisting(
    anonymousUserId: string, 
    existingUserId: string
  ): Promise<void> {
    // This would need to:
    // 1. Transfer all keys from anonymous user to existing user
    // 2. Transfer all devices from anonymous user to existing user
    // 3. Delete anonymous user
    // Implementation depends on the specific database adapter
    
    // For now, we'll throw an error to prevent data loss
    throw new Error(
      'OAuth account already exists. Manual data migration required. ' +
      `Anonymous user: ${anonymousUserId}, Existing user: ${existingUserId}`
    );
  }

  /**
   * Deactivate a device (user logs out or device is compromised)
   */
  async deactivateDevice(deviceId: string): Promise<void> {
    await this.db.updateDevice(deviceId, { 
      isActive: false,
      lastSeen: new Date()
    });
  }

  /**
   * Clean up inactive devices (maintenance task)
   */
  async cleanupInactiveDevices(inactiveDays: number = 90): Promise<number> {
    // This would be implemented in the database adapter
    // Return number of devices cleaned up
    return 0;
  }
}