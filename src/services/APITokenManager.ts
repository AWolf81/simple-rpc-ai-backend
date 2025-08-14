/**
 * API Token Manager
 * 
 * Manages API tokens for external client access to user keys
 * Stores tokens securely in Vaultwarden with scoped permissions
 */

import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PostgreSQLSecretManager } from './PostgreSQLSecretManager';
import * as winston from 'winston';

export type TokenScope = 
  | 'keys:read'           // Get API keys
  | 'keys:write'          // Store/update keys  
  | 'keys:delete'         // Delete keys
  | 'keys:list'           // List available providers
  | 'keys:rotate';        // Rotate keys

export interface APIToken {
  tokenId: string;
  userId: string;
  name: string;           // User-friendly name "My CLI App"
  hashedToken: string;    // bcrypt hash of actual token
  scopes: TokenScope[];
  rateLimits: {
    requestsPerHour: number;
    dailyLimit: number;
  };
  createdAt: Date;
  lastUsedAt?: Date;
  expiresAt?: Date;
  isActive: boolean;
}

export interface TokenCreationRequest {
  userId: string;
  name: string;
  scopes: TokenScope[];
  expiresInDays?: number;  // Optional expiration
  rateLimits?: {
    requestsPerHour?: number;
    dailyLimit?: number;
  };
}

export interface TokenUsage {
  tokenId: string;
  requestCount: number;
  lastHour: number;
  today: number;
  lastRequest: Date;
}

export class APITokenManager {
  private logger: winston.Logger;
  private readonly SALT_ROUNDS = 12;
  private readonly DEFAULT_RATE_LIMITS = {
    requestsPerHour: 100,
    dailyLimit: 1000,
  };

  // Token usage tracking (in production, use Redis)
  private tokenUsage = new Map<string, TokenUsage>();

  constructor(
    private pgsqlSecretManager: PostgreSQLSecretManager,
    logger?: winston.Logger
  ) {
    this.logger = logger || winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [new winston.transports.Console()]
    });
  }

  /**
   * Generate a secure API token
   */
  private generateToken(): string {
    // Format: srpc_<base64-encoded-random-bytes>
    const randomBytes = crypto.randomBytes(32);
    return `srpc_${randomBytes.toString('base64url')}`;
  }

  /**
   * Hash token for storage
   */
  private async hashToken(token: string): Promise<string> {
    return await bcrypt.hash(token, this.SALT_ROUNDS);
  }

  /**
   * Verify token against hash
   */
  private async verifyToken(token: string, hashedToken: string): Promise<boolean> {
    return await bcrypt.compare(token, hashedToken);
  }

  /**
   * Create new API token
   */
  async createAPIToken(request: TokenCreationRequest): Promise<{
    tokenId: string;
    token: string; // Only returned once
    metadata: Omit<APIToken, 'hashedToken'>;
  }> {
    const tokenId = crypto.randomUUID();
    const plainTextToken = this.generateToken();
    const hashedToken = await this.hashToken(plainTextToken);

    const tokenData: APIToken = {
      tokenId,
      userId: request.userId,
      name: request.name,
      hashedToken,
      scopes: request.scopes,
      rateLimits: {
        requestsPerHour: request.rateLimits?.requestsPerHour || this.DEFAULT_RATE_LIMITS.requestsPerHour,
        dailyLimit: request.rateLimits?.dailyLimit || this.DEFAULT_RATE_LIMITS.dailyLimit,
      },
      createdAt: new Date(),
      expiresAt: request.expiresInDays ? 
        new Date(Date.now() + request.expiresInDays * 24 * 60 * 60 * 1000) : 
        undefined,
      isActive: true,
    };

    // Store in Vaultwarden
    await this.storeTokenInVault(tokenData);

    this.logger.info('API token created', {
      tokenId,
      userId: request.userId,
      name: request.name,
      scopes: request.scopes,
    });

    const { hashedToken: _, ...metadata } = tokenData;
    return {
      tokenId,
      token: plainTextToken,
      metadata,
    };
  }

  /**
   * Store token data in Vault
   */
  private async storeTokenInVault(token: APIToken): Promise<void> {
    const secretName = `api-token-${token.tokenId}`;
    const secretValue = JSON.stringify({
      userId: token.userId,
      hashedToken: token.hashedToken,
      scopes: token.scopes,
      rateLimits: token.rateLimits,
      metadata: {
        name: token.name,
        createdAt: token.createdAt.toISOString(),
        lastUsedAt: token.lastUsedAt?.toISOString(),
        expiresAt: token.expiresAt?.toISOString(),
        isActive: token.isActive,
      },
    });

    // Store in token project (separate from API keys)
    await this.pgsqlSecretManager.storeUserKey( // this was this.vaultwarden.storeApiKey <----  we need to update!!
      'api-tokens', // Special "provider" for API tokens
      secretValue,
      token.tokenId
    );
  }

  /**
   * Validate API token and return user context
   */
  async validateToken(token: string): Promise<{
    isValid: boolean;
    userId?: string;
    scopes?: TokenScope[];
    rateLimits?: APIToken['rateLimits'];
    tokenId?: string;
    error?: string;
  }> {
    try {
      // Extract token ID from token (for efficient lookup)
      if (!token.startsWith('srpc_')) {
        return { isValid: false, error: 'Invalid token format' };
      }

      // Get all API tokens (in production, optimize this lookup)
      const tokenSecrets = await this.getAllTokenSecrets();

      for (const secret of tokenSecrets) {
        const isMatch = await this.verifyToken(token, secret.hashedToken);
        if (isMatch) {
          // Check if token is active and not expired
          if (!secret.isActive) {
            return { isValid: false, error: 'Token is disabled' };
          }

          if (secret.expiresAt && new Date() > secret.expiresAt) {
            return { isValid: false, error: 'Token has expired' };
          }

          // Check rate limits
          const rateLimitOk = await this.checkRateLimit(secret.tokenId, secret.rateLimits);
          if (!rateLimitOk) {
            return { isValid: false, error: 'Rate limit exceeded' };
          }

          // Update last used timestamp
          await this.updateLastUsed(secret.tokenId);

          return {
            isValid: true,
            userId: secret.userId,
            scopes: secret.scopes,
            rateLimits: secret.rateLimits,
            tokenId: secret.tokenId,
          };
        }
      }

      return { isValid: false, error: 'Invalid token' };

    } catch (error) {
      if(error instanceof Error) {
        this.logger.error('Token validation failed', { error: error.message });
      }
      return { isValid: false, error: 'Validation error' };
    }
  }

  /**
   * Get all token secrets from Vaultwarden
   */
  private async getAllTokenSecrets(): Promise<Array<APIToken & { tokenId: string }>> {
    // This is a simplified implementation
    // In production, you'd need a more efficient way to query tokens
    // Perhaps store token metadata separately for faster lookups
    
    // For now, return empty array - would need to implement token lookup
    this.logger.warn('getAllTokenSecrets not fully implemented - needs efficient token lookup');
    return [];
  }

  /**
   * Check rate limits for token
   */
  private async checkRateLimit(tokenId: string, limits: APIToken['rateLimits']): Promise<boolean> {
    const now = new Date();
    const usage = this.tokenUsage.get(tokenId);

    if (!usage) {
      // First use
      this.tokenUsage.set(tokenId, {
        tokenId,
        requestCount: 1,
        lastHour: 1,
        today: 1,
        lastRequest: now,
      });
      return true;
    }

    // Check hourly limit
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    if (usage.lastRequest < oneHourAgo) {
      usage.lastHour = 0;
    }

    // Check daily limit
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    if (usage.lastRequest < oneDayAgo) {
      usage.today = 0;
    }

    if (usage.lastHour >= limits.requestsPerHour) {
      this.logger.warn('Hourly rate limit exceeded', { tokenId, usage: usage.lastHour, limit: limits.requestsPerHour });
      return false;
    }

    if (usage.today >= limits.dailyLimit) {
      this.logger.warn('Daily rate limit exceeded', { tokenId, usage: usage.today, limit: limits.dailyLimit });
      return false;
    }

    // Update usage
    usage.requestCount++;
    usage.lastHour++;
    usage.today++;
    usage.lastRequest = now;
    
    return true;
  }

  /**
   * Update last used timestamp
   */
  private async updateLastUsed(tokenId: string): Promise<void> {
    // In production, batch these updates to avoid excessive Vaultwarden calls
    this.logger.debug('Token used', { tokenId, timestamp: new Date().toISOString() });
  }

  /**
   * List user's API tokens
   */
  async listUserTokens(userId: string): Promise<Array<Omit<APIToken, 'hashedToken'>>> {
    // Implementation would query Vaultwarden for user's tokens
    this.logger.warn('listUserTokens not fully implemented');
    return [];
  }

  /**
   * Revoke API token
   */
  async revokeToken(tokenId: string, userId: string): Promise<boolean> {
    try {
      // Delete from Vaultwarden --> needs to be improved, no need to pass User info as the APITokenManager needs to check it based on provided JWT token
      const deleted = await this.pgsqlSecretManager.deleteUserKey('api-tokens', tokenId); // <<<<<<<<<< was this.vaultwarden.deleteApiKey
      
      // Remove from usage tracking
      this.tokenUsage.delete(tokenId);

      this.logger.info('API token revoked', { tokenId, userId });
      return deleted.success; // <<<<<<<<<<<<< better error handling TBD

    } catch (error) {
      if (error instanceof Error)
      {
        this.logger.error('Failed to revoke token', { tokenId, error: error.message });
      }
      return false;
    }
  }

  /**
   * Check if user has permission for scope
   */
  hasScope(scopes: TokenScope[], requiredScope: TokenScope): boolean {
    return scopes.includes(requiredScope);
  }

  /**
   * Get token usage statistics
   */
  getTokenUsage(tokenId: string): TokenUsage | null {
    return this.tokenUsage.get(tokenId) || null;
  }

  /**
   * Clean up expired tokens (maintenance task)
   */
  async cleanupExpiredTokens(): Promise<number> {
    let cleaned = 0;
    
    // Implementation would query all tokens and remove expired ones
    this.logger.info('Token cleanup completed', { cleaned });
    
    return cleaned;
  }
}