/**
 * Progressive Authentication Manager
 * 
 * Handles the flow from anonymous → OAuth → Passkey authentication
 * Integrates with VS Code authentication API for seamless OAuth
 */

import { UserManager, User, OAuthData } from './user-manager.js';
import { SimpleKeyManager } from './key-manager.js';

export interface AuthSession {
  userId: string;
  deviceId: string;
  authLevel: 'anonymous' | 'oauth' | 'passkey' | 'pro';
  isValid: boolean;
  expiresAt?: Date;
  lastActivity: Date;
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

export class AuthManager {
  private activeSessions = new Map<string, AuthSession>();

  constructor(
    private userManager: UserManager,
    private keyManager: SimpleKeyManager,
    private oauthProviders: Map<string, OAuthProvider>
  ) {}

  /**
   * Initialize user session (anonymous or existing)
   */
  async initializeSession(deviceId: string, deviceName?: string): Promise<AuthSession> {
    // Check for existing session
    const existingSession = this.activeSessions.get(deviceId);
    if (existingSession && existingSession.isValid) {
      existingSession.lastActivity = new Date();
      return existingSession;
    }

    // Get or create anonymous user
    const user = await this.userManager.getOrCreateAnonymousUser(deviceId, deviceName);
    
    const session: AuthSession = {
      userId: user.userId,
      deviceId,
      authLevel: this.userManager.getAuthLevel(user) as any,
      isValid: true,
      lastActivity: new Date()
    };

    this.activeSessions.set(deviceId, session);
    return session;
  }

  /**
   * Get current session for device
   */
  getSession(deviceId: string): AuthSession | null {
    const session = this.activeSessions.get(deviceId);
    if (!session || !session.isValid) {
      return null;
    }

    session.lastActivity = new Date();
    return session;
  }

  /**
   * Check if user should be prompted for authentication upgrade
   */
  shouldSuggestUpgrade(session: AuthSession, triggerReason: string): boolean {
    switch (triggerReason) {
      case 'multi_device':
        return session.authLevel === 'anonymous';
      
      case 'premium_features':
        return session.authLevel !== 'pro';
      
      case 'security':
        return session.authLevel === 'anonymous' || session.authLevel === 'oauth';
      
      case 'high_usage':
        return session.authLevel === 'anonymous';
      
      default:
        return false;
    }
  }

  /**
   * Upgrade anonymous user to OAuth
   */
  async upgradeToOAuth(
    deviceId: string, 
    provider: string, 
    oauthToken: string,
    options: AuthUpgradeOptions = { triggerReason: 'manual' }
  ): Promise<AuthSession> {
    const session = this.getSession(deviceId);
    if (!session) {
      throw new Error('No active session found for device');
    }

    const oauthProvider = this.oauthProviders.get(provider);
    if (!oauthProvider) {
      throw new Error(`Unsupported OAuth provider: ${provider}`);
    }

    // Validate OAuth token and get user data
    const oauthData = await oauthProvider.validateToken(oauthToken);

    // Upgrade user account
    const upgradedUser = await this.userManager.upgradeToOAuth(session.userId, oauthData);

    // Update session
    session.authLevel = 'oauth';
    session.lastActivity = new Date();
    
    this.activeSessions.set(deviceId, session);

    return session;
  }

  /**
   * Link a new device to authenticated user
   */
  async linkDevice(
    existingDeviceId: string,
    newDeviceId: string,
    newDeviceName?: string
  ): Promise<AuthSession> {
    const existingSession = this.getSession(existingDeviceId);
    if (!existingSession || existingSession.authLevel === 'anonymous') {
      throw new Error('Cannot link devices for anonymous users. Please authenticate first.');
    }

    // Link device to user
    await this.userManager.linkDeviceToUser(
      existingSession.userId,
      newDeviceId,
      newDeviceName
    );

    // Create new session for linked device
    const newSession: AuthSession = {
      userId: existingSession.userId,
      deviceId: newDeviceId,
      authLevel: existingSession.authLevel,
      isValid: true,
      lastActivity: new Date()
    };

    this.activeSessions.set(newDeviceId, newSession);
    return newSession;
  }

  /**
   * Generate device linking code for OAuth users
   */
  async generateDeviceLinkCode(email: string): Promise<{ code: string; expiresAt: Date }> {
    // Find user by email
    const users = await this.getAllUsers(); // This would need to be implemented
    const user = users.find(u => u.email === email && !u.isAnonymous);
    
    if (!user) {
      throw new Error('No authenticated account found for this email');
    }

    // Generate 6-digit code
    const code = Math.random().toString().substr(2, 6);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    // Store code temporarily (in production, use Redis or database)
    // For now, we'll use in-memory storage
    const linkCodes = new Map<string, { userId: string; expiresAt: Date }>();
    linkCodes.set(code, { userId: user.userId, expiresAt });

    // TODO: Send email with code
    console.log(`Device link code for ${email}: ${code}`);

    return { code, expiresAt };
  }

  /**
   * Link device using email code
   */
  async linkDeviceWithCode(
    newDeviceId: string,
    code: string,
    deviceName?: string
  ): Promise<AuthSession> {
    // Validate code (this would be stored in Redis/database in production)
    const linkCodes = new Map<string, { userId: string; expiresAt: Date }>();
    const codeData = linkCodes.get(code);
    
    if (!codeData || codeData.expiresAt < new Date()) {
      throw new Error('Invalid or expired link code');
    }

    // Link device
    await this.userManager.linkDeviceToUser(codeData.userId, newDeviceId, deviceName);

    // Get user for auth level
    const users = await this.getAllUsers();
    const user = users.find(u => u.userId === codeData.userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Create session
    const session: AuthSession = {
      userId: codeData.userId,
      deviceId: newDeviceId,
      authLevel: this.userManager.getAuthLevel(user) as any,
      isValid: true,
      lastActivity: new Date()
    };

    this.activeSessions.set(newDeviceId, session);

    // Remove used code
    linkCodes.delete(code);

    return session;
  }

  /**
   * Upgrade to Pro plan
   */
  async upgradeToPro(deviceId: string): Promise<AuthSession> {
    const session = this.getSession(deviceId);
    if (!session) {
      throw new Error('No active session found');
    }

    if (session.authLevel === 'anonymous') {
      throw new Error('Please authenticate with OAuth before upgrading to Pro');
    }

    // Upgrade user plan
    await this.userManager.upgradeUserPlan(session.userId, 'pro');

    // Update session
    session.authLevel = 'pro';
    session.lastActivity = new Date();

    return session;
  }

  /**
   * Check if user has required features
   */
  async hasFeature(deviceId: string, feature: string): Promise<boolean> {
    const session = this.getSession(deviceId);
    if (!session) {
      return false;
    }

    const users = await this.getAllUsers();
    const user = users.find(u => u.userId === session.userId);
    if (!user) {
      return false;
    }

    return this.userManager.hasFeature(user, feature);
  }

  /**
   * Get user's authentication status and available upgrades
   */
  async getAuthStatus(deviceId: string): Promise<{
    authLevel: string;
    features: string[];
    availableUpgrades: string[];
    deviceCount: number;
    hasValidKeys: boolean;
  }> {
    const session = this.getSession(deviceId);
    if (!session) {
      throw new Error('No active session found');
    }

    const users = await this.getAllUsers();
    const user = users.find(u => u.userId === session.userId);
    if (!user) {
      throw new Error('User not found');
    }

    const devices = await this.userManager.getUserDevices(session.userId);
    const hasValidKeys = await this.keyManager.hasValidKeys(session.userId);

    const availableUpgrades = [];
    if (session.authLevel === 'anonymous') {
      availableUpgrades.push('oauth', 'multi_device');
    }
    if (session.authLevel === 'oauth') {
      availableUpgrades.push('passkey', 'pro');
    }
    if (session.authLevel === 'passkey') {
      availableUpgrades.push('pro');
    }

    return {
      authLevel: session.authLevel,
      features: user.features,
      availableUpgrades,
      deviceCount: devices.length,
      hasValidKeys
    };
  }

  /**
   * Invalidate session (logout)
   */
  invalidateSession(deviceId: string): void {
    const session = this.activeSessions.get(deviceId);
    if (session) {
      session.isValid = false;
      this.activeSessions.delete(deviceId);
    }
  }

  /**
   * Clean up expired sessions (maintenance task)
   */
  cleanupExpiredSessions(): number {
    let cleaned = 0;
    const now = new Date();
    
    for (const [deviceId, session] of this.activeSessions.entries()) {
      // Sessions inactive for 24 hours are considered expired
      const maxInactiveTime = 24 * 60 * 60 * 1000; // 24 hours
      if (now.getTime() - session.lastActivity.getTime() > maxInactiveTime) {
        this.activeSessions.delete(deviceId);
        cleaned++;
      }
    }

    return cleaned;
  }

  /**
   * Get all users (helper method - would be implemented properly with database)
   */
  private async getAllUsers(): Promise<User[]> {
    // This is a placeholder - in production this would query the database
    // For now, we'll return empty array
    return [];
  }
}