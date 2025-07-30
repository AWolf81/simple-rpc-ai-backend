/**
 * Simplified OAuth Authentication Manager
 * 
 * Uses VS Code's built-in authentication providers instead of private keys.
 * Much simpler and more secure approach using standard OAuth flows.
 */

import axios from 'axios';

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
  allowedUsers?: string[]; // Email addresses or user IDs
  allowedOrgs?: string[];  // GitHub orgs, Google domains, etc.
  requireVerifiedEmail?: boolean;
  sessionExpirationMs?: number;
}

export class OAuthAuthManager {
  private config: OAuthConfig;
  private activeSessions = new Map<string, OAuthSession>();

  constructor(config: OAuthConfig) {
    this.config = {
      sessionExpirationMs: 24 * 60 * 60 * 1000, // 24 hours
      requireVerifiedEmail: true,
      ...config
    };
  }

  /**
   * Authenticate extension using OAuth token from VS Code
   */
  async authenticateWithOAuth(
    extensionId: string,
    provider: 'github' | 'google' | 'microsoft',
    accessToken: string,
    deviceId: string
  ): Promise<OAuthSession> {
    
    // 1. Validate provider is allowed
    if (!this.config.allowedProviders.includes(provider)) {
      throw new Error(`OAuth provider '${provider}' not allowed`);
    }

    // 2. Validate token and get user info
    const userInfo = await this.validateOAuthToken(provider, accessToken);
    
    // 3. Check user is allowed
    if (this.config.allowedUsers?.length) {
      const isAllowed = this.config.allowedUsers.some(allowed => 
        allowed === userInfo.email || allowed === userInfo.id
      );
      
      if (!isAllowed) {
        throw new Error(`User '${userInfo.email}' not in allowed users list`);
      }
    }

    // 4. Check organization membership (if configured)
    if (this.config.allowedOrgs?.length && provider === 'github') {
      const userOrgs = await this.getUserOrganizations(provider, accessToken);
      const hasAllowedOrg = this.config.allowedOrgs.some(org =>
        userOrgs.includes(org)
      );
      
      if (!hasAllowedOrg) {
        throw new Error(`User not member of allowed organizations`);
      }
    }

    // 5. Check email verification
    if (this.config.requireVerifiedEmail && !userInfo.email) {
      throw new Error('Verified email required but not available');
    }

    // 6. Create session
    const session: OAuthSession = {
      userId: userInfo.id,
      deviceId,
      extensionId,
      authLevel: 'oauth',
      provider,
      accessToken,
      userInfo,
      isValid: true,
      expiresAt: new Date(Date.now() + this.config.sessionExpirationMs!),
      lastActivity: new Date()
    };

    // 7. Store session
    const sessionToken = this.generateSessionToken(session);
    this.activeSessions.set(sessionToken, session);

    console.log(`✅ OAuth authentication successful`);
    console.log(`   👤 User: ${userInfo.name} (${userInfo.email})`);
    console.log(`   🔐 Provider: ${provider}`);
    console.log(`   🎯 Extension: ${extensionId}`);

    return session;
  }

  /**
   * Validate OAuth token with provider
   */
  private async validateOAuthToken(
    provider: 'github' | 'google' | 'microsoft',
    accessToken: string
  ): Promise<{ id: string; email: string; name: string; avatar?: string }> {
    
    try {
      switch (provider) {
        case 'github': {
          const response = await axios.get('https://api.github.com/user', {
            headers: { Authorization: `Bearer ${accessToken}` }
          });
          
          const user = response.data;
          return {
            id: user.id.toString(),
            email: user.email,
            name: user.name || user.login,
            avatar: user.avatar_url
          };
        }

        case 'google': {
          const response = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: { Authorization: `Bearer ${accessToken}` }
          });
          
          const user = response.data;
          return {
            id: user.id,
            email: user.email,
            name: user.name,
            avatar: user.picture
          };
        }

        case 'microsoft': {
          const response = await axios.get('https://graph.microsoft.com/v1.0/me', {
            headers: { Authorization: `Bearer ${accessToken}` }
          });
          
          const user = response.data;
          return {
            id: user.id,
            email: user.mail || user.userPrincipalName,
            name: user.displayName,
            avatar: user.photo?.['@odata.mediaContentType'] ? 
              `https://graph.microsoft.com/v1.0/me/photo/$value` : undefined
          };
        }

        default:
          throw new Error(`Unsupported OAuth provider: ${provider}`);
      }
    } catch (error: any) {
      console.error(`❌ OAuth token validation failed for ${provider}:`, error.message);
      throw new Error(`Invalid OAuth token for ${provider}`);
    }
  }

  /**
   * Get user's organizations (GitHub only for now)
   */
  private async getUserOrganizations(
    provider: 'github' | 'google' | 'microsoft',
    accessToken: string
  ): Promise<string[]> {
    
    if (provider !== 'github') {
      return []; // Only GitHub orgs supported for now
    }

    try {
      const response = await axios.get('https://api.github.com/user/orgs', {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      
      return response.data.map((org: any) => org.login);
    } catch (error) {
      console.warn('⚠️ Could not fetch user organizations:', error);
      return [];
    }
  }

  /**
   * Generate session token
   */
  private generateSessionToken(session: OAuthSession): string {
    const crypto = require('crypto');
    const tokenData = [
      session.userId,
      session.deviceId,
      session.extensionId,
      session.provider,
      Date.now()
    ].join('|');

    const hash = crypto.createHash('sha256');
    hash.update(tokenData);
    return `oauth_${hash.digest('hex').substring(0, 32)}`;
  }

  /**
   * Validate session token
   */
  validateSession(sessionToken: string): OAuthSession | null {
    const session = this.activeSessions.get(sessionToken);
    
    if (!session || !session.isValid) {
      return null;
    }

    // Check expiration
    if (session.expiresAt && session.expiresAt < new Date()) {
      session.isValid = false;
      this.activeSessions.delete(sessionToken);
      return null;
    }

    // Update last activity
    session.lastActivity = new Date();
    return session;
  }

  /**
   * Get session by token
   */
  getSession(sessionToken: string): OAuthSession | null {
    return this.validateSession(sessionToken);
  }

  /**
   * Invalidate session
   */
  invalidateSession(sessionToken: string): void {
    const session = this.activeSessions.get(sessionToken);
    if (session) {
      session.isValid = false;
      this.activeSessions.delete(sessionToken);
    }
  }

  /**
   * Clean up expired sessions
   */
  cleanupExpiredSessions(): number {
    let cleaned = 0;
    const now = new Date();

    for (const [token, session] of this.activeSessions) {
      if (session.expiresAt && session.expiresAt < now) {
        this.activeSessions.delete(token);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`🧹 Cleaned up ${cleaned} expired OAuth sessions`);
    }

    return cleaned;
  }

  /**
   * Get authentication statistics
   */
  getStats(): {
    activeSessions: number;
    sessionsByProvider: Record<string, number>;
    sessionsByExtension: Record<string, number>;
    sessionsByUser: Record<string, number>;
  } {
    const stats = {
      activeSessions: this.activeSessions.size,
      sessionsByProvider: {} as Record<string, number>,
      sessionsByExtension: {} as Record<string, number>,
      sessionsByUser: {} as Record<string, number>
    };

    for (const session of this.activeSessions.values()) {
      // Count by provider
      stats.sessionsByProvider[session.provider] = 
        (stats.sessionsByProvider[session.provider] || 0) + 1;
      
      // Count by extension
      stats.sessionsByExtension[session.extensionId] = 
        (stats.sessionsByExtension[session.extensionId] || 0) + 1;
      
      // Count by user
      stats.sessionsByUser[session.userInfo.email] = 
        (stats.sessionsByUser[session.userInfo.email] || 0) + 1;
    }

    return stats;
  }

  /**
   * Refresh OAuth token if needed
   */
  async refreshTokenIfNeeded(sessionToken: string): Promise<boolean> {
    const session = this.activeSessions.get(sessionToken);
    if (!session) {
      return false;
    }

    // Check if token is close to expiring (1 hour threshold)
    const oneHour = 60 * 60 * 1000;
    if (session.expiresAt && (session.expiresAt.getTime() - Date.now()) < oneHour) {
      try {
        // Validate current token is still good
        await this.validateOAuthToken(session.provider, session.accessToken);
        
        // Update expiration
        session.expiresAt = new Date(Date.now() + this.config.sessionExpirationMs!);
        session.lastActivity = new Date();
        
        console.log(`🔄 Refreshed session for ${session.userInfo.email}`);
        return true;
      } catch (error) {
        console.warn(`⚠️ Token refresh failed for ${session.userInfo.email}:`, error);
        this.invalidateSession(sessionToken);
        return false;
      }
    }

    return true; // Token still valid
  }
}