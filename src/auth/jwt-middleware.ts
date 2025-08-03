import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';

export interface OpenSaaSJWTPayload {
  userId: string;
  email: string;
  organizationId?: string;
  subscriptionTier: string; // Made flexible to support any tier
  monthlyTokenQuota: number;
  rpmLimit: number;
  tpmLimit: number;
  features: string[];
  iat: number;
  exp: number;
  iss: string; // OpenSaaS issuer
  aud: string; // Our service identifier
}

export interface AuthenticatedRequest extends Request {
  user?: OpenSaaSJWTPayload;
  authContext?: {
    type: 'opensaas';
    userId: string;
    email: string;
    organizationId?: string;
    subscriptionTier: string;
    quotaInfo: {
      monthlyTokenQuota: number;
      rpmLimit: number;
      tpmLimit: number;
    };
    features: string[];
  };
}

export interface SubscriptionTierConfig {
  name: string;
  monthlyTokenQuota: number;
  rpmLimit: number;
  tpmLimit: number;
  features: string[];
  concurrentRequests?: number;
}

export interface JWTMiddlewareConfig {
  opensaasPublicKey: string;
  audience: string; // Our service identifier
  issuer: string; // OpenSaaS issuer
  skipAuthForMethods?: string[]; // Methods that don't require auth
  requireAuthForAllMethods?: boolean; // If true, all methods require auth
  clockTolerance?: number; // JWT clock tolerance in seconds
  subscriptionTiers?: Record<string, SubscriptionTierConfig>; // Custom tier configurations
}

export class JWTMiddleware {
  private config: JWTMiddlewareConfig;

  constructor(config: JWTMiddlewareConfig) {
    this.config = config;
    
    if (!config.opensaasPublicKey) {
      throw new Error('OpenSaaS public key is required for JWT validation');
    }
  }

  /**
   * Express middleware to validate OpenSaaS JWT tokens
   */
  authenticate = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    // Skip auth for specific methods if configured
    const rpcMethod = req.body?.method;
    if (rpcMethod && this.config.skipAuthForMethods?.includes(rpcMethod)) {
      return next();
    }

    // Skip auth for health check and discovery endpoints
    if (req.path === '/health' || req.path === '/config' || rpcMethod === 'health' || rpcMethod === 'rpc.discover') {
      return next();
    }

    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // No token provided
      if (this.config.requireAuthForAllMethods) {
        res.status(401).json({
          error: {
            code: -32001,
            message: 'Authentication required',
            data: {
              reason: 'missing_token',
              authUrl: '/auth/opensaas'
            }
          }
        });
        return;
      }
      // Allow unauthenticated access for backward compatibility
      return next();
    }

    const token = authHeader.substring(7);

    try {
      const payload = this.validateToken(token);
      
      // Add user context to request
      req.user = payload;
      req.authContext = {
        type: 'opensaas',
        userId: payload.userId,
        email: payload.email,
        organizationId: payload.organizationId,
        subscriptionTier: payload.subscriptionTier,
        quotaInfo: {
          monthlyTokenQuota: payload.monthlyTokenQuota,
          rpmLimit: payload.rpmLimit,
          tpmLimit: payload.tpmLimit
        },
        features: payload.features
      };

      console.log(`🔐 Authenticated user: ${payload.email} (${payload.subscriptionTier})`);
      next();

    } catch (error: any) {
      console.error('❌ JWT validation failed:', error.message);
      
      res.status(401).json({
        error: {
          code: -32001,
          message: 'Invalid or expired authentication token',
          data: {
            reason: error.message.includes('expired') ? 'token_expired' : 'invalid_token',
            authUrl: '/auth/opensaas'
          }
        }
      });
    }
  };

  /**
   * Validate JWT token and return payload
   */
  validateToken(token: string): OpenSaaSJWTPayload {
    try {
      const payload = jwt.verify(token, this.config.opensaasPublicKey, {
        audience: this.config.audience,
        issuer: this.config.issuer,
        algorithms: ['RS256'], // OpenSaaS should use RS256
        clockTolerance: this.config.clockTolerance || 30 // 30 second tolerance
      }) as OpenSaaSJWTPayload;

      // Validate required fields
      if (!payload.userId || !payload.email || !payload.subscriptionTier) {
        throw new Error('Invalid token payload: missing required fields');
      }

      // Validate subscription tier against configured tiers
      if (this.config.subscriptionTiers && !this.config.subscriptionTiers[payload.subscriptionTier]) {
        throw new Error(`Invalid subscription tier in token: ${payload.subscriptionTier}`);
      }

      // Validate quota information
      if (typeof payload.monthlyTokenQuota !== 'number' || payload.monthlyTokenQuota < 0) {
        throw new Error('Invalid token quota information');
      }

      if (typeof payload.rpmLimit !== 'number' || payload.rpmLimit < 0) {
        throw new Error('Invalid RPM limit information');
      }

      if (typeof payload.tpmLimit !== 'number' || payload.tpmLimit < 0) {
        throw new Error('Invalid TPM limit information');
      }

      return payload;

    } catch (error: any) {
      if (error.name === 'TokenExpiredError') {
        throw new Error('Token has expired');
      } else if (error.name === 'JsonWebTokenError') {
        throw new Error('Invalid token signature');
      } else if (error.name === 'NotBeforeError') {
        throw new Error('Token not yet valid');
      } else {
        throw new Error(`Token validation failed: ${error.message}`);
      }
    }
  }

  /**
   * Extract user context from authenticated request
   */
  static getUserContext(req: AuthenticatedRequest): OpenSaaSJWTPayload | null {
    return req.user || null;
  }

  /**
   * Check if user has specific feature access
   */
  static hasFeature(req: AuthenticatedRequest, feature: string): boolean {
    return req.authContext?.features?.includes(feature) || false;
  }

  /**
   * Check if user has sufficient subscription tier
   */
  static hasSubscriptionTier(req: AuthenticatedRequest, requiredTier: string, tierConfigs?: Record<string, SubscriptionTierConfig>): boolean {
    const userTier = req.authContext?.subscriptionTier;
    if (!userTier) return false;

    // If custom tier configurations are provided, use them for comparison
    if (tierConfigs) {
      const userTierConfig = tierConfigs[userTier];
      const requiredTierConfig = tierConfigs[requiredTier];
      
      if (!userTierConfig || !requiredTierConfig) return false;
      
      // Compare based on token quota as a proxy for tier level
      return userTierConfig.monthlyTokenQuota >= requiredTierConfig.monthlyTokenQuota;
    }

    // Fallback to default hierarchy for backward compatibility
    const defaultHierarchy = { starter: 1, pro: 2, enterprise: 3 };
    const userLevel = defaultHierarchy[userTier as keyof typeof defaultHierarchy] || 0;
    const requiredLevel = defaultHierarchy[requiredTier as keyof typeof defaultHierarchy] || 0;
    
    return userLevel >= requiredLevel;
  }

  /**
   * Get user's quota information
   */
  static getQuotaInfo(req: AuthenticatedRequest): { monthlyTokenQuota: number; rpmLimit: number; tpmLimit: number } | null {
    return req.authContext?.quotaInfo || null;
  }
}

/**
 * Default subscription tier limits for fallback scenarios
 */
export const DEFAULT_TIER_CONFIGS: Record<string, SubscriptionTierConfig> = {
  starter: {
    name: 'Starter',
    monthlyTokenQuota: 10000,
    rpmLimit: 10,
    tpmLimit: 1000,
    concurrentRequests: 2,
    features: ['basic_ai']
  },
  pro: {
    name: 'Pro',
    monthlyTokenQuota: 100000,
    rpmLimit: 100,
    tpmLimit: 10000,
    concurrentRequests: 10,
    features: ['basic_ai', 'advanced_ai', 'priority_support']
  },
  enterprise: {
    name: 'Enterprise',
    monthlyTokenQuota: 1000000,
    rpmLimit: 1000,
    tpmLimit: 100000,
    concurrentRequests: 50,
    features: ['basic_ai', 'advanced_ai', 'priority_support', 'custom_models', 'analytics']
  }
};

/**
 * Utility function to get tier configuration (custom or default)
 */
export function getTierConfig(tier: string, customTiers?: Record<string, SubscriptionTierConfig>): SubscriptionTierConfig | null {
  if (customTiers && customTiers[tier]) {
    return customTiers[tier];
  }
  return DEFAULT_TIER_CONFIGS[tier] || null;
}

/**
 * Utility function to merge custom tiers with defaults
 */
export function mergeWithDefaultTiers(customTiers?: Record<string, SubscriptionTierConfig>): Record<string, SubscriptionTierConfig> {
  return { ...DEFAULT_TIER_CONFIGS, ...customTiers };
}