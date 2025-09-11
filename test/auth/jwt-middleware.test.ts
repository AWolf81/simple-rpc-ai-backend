import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { JWTMiddleware, type OpenSaaSJWTPayload, type AuthenticatedRequest } from '../../src/auth/jwt-middleware';

describe('JWTMiddleware', () => {
  let app: express.Application;
  let jwtMiddleware: JWTMiddleware;
  let privateKey: string;
  let publicKey: string;
  const issuer = 'test-issuer';
  const audience = 'test-audience';

  beforeEach(() => {
    // Generate RSA key pair for testing
    const { privateKey: priv, publicKey: pub } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    
    privateKey = priv;
    publicKey = pub;

    // Create JWT middleware
    jwtMiddleware = new JWTMiddleware({
      opensaasPublicKey: publicKey,
      audience,
      issuer,
      skipAuthForMethods: ['health'],
      requireAuthForAllMethods: false
    });

    // Create Express app for testing
    app = express();
    app.use(express.json());
  });

  describe('Constructor', () => {
    it('should throw error if public key is not provided', () => {
      expect(() => {
        new JWTMiddleware({
          opensaasPublicKey: '',
          audience,
          issuer
        });
      }).toThrow('OpenSaaS public key is required for JWT validation');
    });

    it('should create instance with valid configuration', () => {
      expect(jwtMiddleware).toBeInstanceOf(JWTMiddleware);
    });
  });

  describe('validateToken', () => {
    it('should validate a properly signed JWT token', () => {
      const payload: Partial<OpenSaaSJWTPayload> = {
        userId: 'test-user-123',
        email: 'test@example.com',
        subscriptionTier: 'pro',
        monthlyTokenQuota: 10000,
        rpmLimit: 100,
        tpmLimit: 5000,
        features: ['basic_ai', 'advanced_ai']
      };

      const token = jwt.sign(payload, privateKey, {
        algorithm: 'RS256',
        expiresIn: '1h',
        issuer,
        audience
      });

      const validated = jwtMiddleware.validateToken(token);
      
      expect(validated.userId).toBe('test-user-123');
      expect(validated.email).toBe('test@example.com');
      expect(validated.subscriptionTier).toBe('pro');
      expect(validated.monthlyTokenQuota).toBe(10000);
    });

    it('should reject token with invalid signature', () => {
      const payload: Partial<OpenSaaSJWTPayload> = {
        userId: 'test-user-123',
        email: 'test@example.com',
        subscriptionTier: 'pro',
        monthlyTokenQuota: 10000,
        rpmLimit: 100,
        tpmLimit: 5000,
        features: ['basic_ai']
      };

      // Sign with wrong key
      const wrongKey = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
      }).privateKey;

      const token = jwt.sign(payload, wrongKey, {
        algorithm: 'RS256',
        expiresIn: '1h',
        issuer,
        audience
      });

      expect(() => {
        jwtMiddleware.validateToken(token);
      }).toThrow('Invalid token signature');
    });

    it('should reject expired token', () => {
      const payload: Partial<OpenSaaSJWTPayload> = {
        userId: 'test-user-123',
        email: 'test@example.com',
        subscriptionTier: 'pro',
        monthlyTokenQuota: 10000,
        rpmLimit: 100,
        tpmLimit: 5000,
        features: ['basic_ai']
      };

      const token = jwt.sign(payload, privateKey, {
        algorithm: 'RS256',
        expiresIn: '-1h', // Already expired
        issuer,
        audience
      });

      expect(() => {
        jwtMiddleware.validateToken(token);
      }).toThrow('Token has expired');
    });

    it('should reject token with wrong issuer', () => {
      const payload: Partial<OpenSaaSJWTPayload> = {
        userId: 'test-user-123',
        email: 'test@example.com',
        subscriptionTier: 'pro',
        monthlyTokenQuota: 10000,
        rpmLimit: 100,
        tpmLimit: 5000,
        features: ['basic_ai']
      };

      const token = jwt.sign(payload, privateKey, {
        algorithm: 'RS256',
        expiresIn: '1h',
        issuer: 'wrong-issuer',
        audience
      });

      expect(() => {
        jwtMiddleware.validateToken(token);
      }).toThrow(/Token validation failed|Invalid token signature/);
    });

    it('should reject token with wrong audience', () => {
      const payload: Partial<OpenSaaSJWTPayload> = {
        userId: 'test-user-123',
        email: 'test@example.com',
        subscriptionTier: 'pro',
        monthlyTokenQuota: 10000,
        rpmLimit: 100,
        tpmLimit: 5000,
        features: ['basic_ai']
      };

      const token = jwt.sign(payload, privateKey, {
        algorithm: 'RS256',
        expiresIn: '1h',
        issuer,
        audience: 'wrong-audience'
      });

      expect(() => {
        jwtMiddleware.validateToken(token);
      }).toThrow(/Token validation failed|Invalid token signature/);
    });

    it('should reject token missing required fields', () => {
      const payload = {
        // Missing userId, email, subscriptionTier
        monthlyTokenQuota: 10000,
        rpmLimit: 100,
        tpmLimit: 5000,
        features: ['basic_ai']
      };

      const token = jwt.sign(payload, privateKey, {
        algorithm: 'RS256',
        expiresIn: '1h',
        issuer,
        audience
      });

      expect(() => {
        jwtMiddleware.validateToken(token);
      }).toThrow('Invalid token payload: missing required fields');
    });

    it('should reject token with invalid quota values', () => {
      const payload = {
        userId: 'test-user-123',
        email: 'test@example.com',
        subscriptionTier: 'pro',
        monthlyTokenQuota: -100, // Invalid negative value
        rpmLimit: 100,
        tpmLimit: 5000,
        features: ['basic_ai']
      };

      const token = jwt.sign(payload, privateKey, {
        algorithm: 'RS256',
        expiresIn: '1h',
        issuer,
        audience
      });

      expect(() => {
        jwtMiddleware.validateToken(token);
      }).toThrow('Invalid token quota information');
    });

    it('should validate subscription tier when configured', () => {
      const middleware = new JWTMiddleware({
        opensaasPublicKey: publicKey,
        audience,
        issuer,
        subscriptionTiers: {
          pro: {
            name: 'Pro',
            monthlyTokenQuota: 10000,
            rpmLimit: 100,
            tpmLimit: 5000,
            features: ['basic_ai', 'advanced_ai']
          }
        }
      });

      const payload: Partial<OpenSaaSJWTPayload> = {
        userId: 'test-user-123',
        email: 'test@example.com',
        subscriptionTier: 'invalid-tier',
        monthlyTokenQuota: 10000,
        rpmLimit: 100,
        tpmLimit: 5000,
        features: ['basic_ai']
      };

      const token = jwt.sign(payload, privateKey, {
        algorithm: 'RS256',
        expiresIn: '1h',
        issuer,
        audience
      });

      expect(() => {
        middleware.validateToken(token);
      }).toThrow('Invalid subscription tier in token: invalid-tier');
    });

    it('should handle malformed JWT token', () => {
      expect(() => {
        jwtMiddleware.validateToken('invalid.jwt.token');
      }).toThrow('Invalid token signature');
    });

    it('should handle token that is not yet valid', () => {
      const payload: Partial<OpenSaaSJWTPayload> = {
        userId: 'test-user-123',
        email: 'test@example.com',
        subscriptionTier: 'pro',
        monthlyTokenQuota: 10000,
        rpmLimit: 100,
        tpmLimit: 5000,
        features: ['basic_ai']
      };

      const token = jwt.sign(payload, privateKey, {
        algorithm: 'RS256',
        expiresIn: '1h',
        notBefore: '1h', // Not valid for 1 hour
        issuer,
        audience
      });

      expect(() => {
        jwtMiddleware.validateToken(token);
      }).toThrow('Token not yet valid');
    });
  });

  describe('authenticate middleware', () => {
    beforeEach(() => {
      app.use(jwtMiddleware.authenticate);
      app.get('/protected', (req: AuthenticatedRequest, res) => {
        res.json({
          authenticated: !!req.user,
          userId: req.user?.userId,
          email: req.user?.email
        });
      });
      app.post('/rpc', (req: AuthenticatedRequest, res) => {
        res.json({
          method: req.body?.method,
          authenticated: !!req.user,
          userId: req.user?.userId
        });
      });
    });

    it('should authenticate valid JWT token', async () => {
      const payload: Partial<OpenSaaSJWTPayload> = {
        userId: 'test-user-123',
        email: 'test@example.com',
        subscriptionTier: 'pro',
        monthlyTokenQuota: 10000,
        rpmLimit: 100,
        tpmLimit: 5000,
        features: ['basic_ai']
      };

      const token = jwt.sign(payload, privateKey, {
        algorithm: 'RS256',
        expiresIn: '1h',
        issuer,
        audience
      });

      const response = await request(app)
        .get('/protected')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.authenticated).toBe(true);
      expect(response.body.userId).toBe('test-user-123');
      expect(response.body.email).toBe('test@example.com');
    });

    it('should reject invalid JWT token', async () => {
      const response = await request(app)
        .get('/protected')
        .set('Authorization', 'Bearer invalid.jwt.token');

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe(-32001);
      expect(response.body.error.message).toMatch(/Invalid or expired authentication token/);
    });

    it('should skip authentication for configured methods', async () => {
      const response = await request(app)
        .post('/rpc')
        .send({ method: 'health' });

      expect(response.status).toBe(200);
      expect(response.body.method).toBe('health');
      expect(response.body.authenticated).toBe(false);
    });

    it('should skip authentication for health endpoints', async () => {
      app.get('/health', (req: AuthenticatedRequest, res) => {
        res.json({ status: 'ok', authenticated: !!req.user });
      });

      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('ok');
      expect(response.body.authenticated).toBe(false);
    });

    it('should skip authentication for config endpoints', async () => {
      app.get('/config', (req: AuthenticatedRequest, res) => {
        res.json({ config: 'data', authenticated: !!req.user });
      });

      const response = await request(app).get('/config');

      expect(response.status).toBe(200);
      expect(response.body.config).toBe('data');
      expect(response.body.authenticated).toBe(false);
    });

    it('should skip authentication for rpc.discover method', async () => {
      const response = await request(app)
        .post('/rpc')
        .send({ method: 'rpc.discover' });

      expect(response.status).toBe(200);
      expect(response.body.method).toBe('rpc.discover');
      expect(response.body.authenticated).toBe(false);
    });

    it('should handle missing Authorization header gracefully when not required', () => {
      const middleware = new JWTMiddleware({
        opensaasPublicKey: publicKey,
        audience,
        issuer,
        requireAuthForAllMethods: false
      });

      const testApp = express();
      testApp.use(express.json());
      testApp.use(middleware.authenticate);
      testApp.get('/test', (req: AuthenticatedRequest, res) => {
        res.json({ authenticated: !!req.user });
      });

      return request(testApp)
        .get('/test')
        .expect(200)
        .expect({ authenticated: false });
    });

    it('should require authentication when requireAuthForAllMethods is true', async () => {
      const strictMiddleware = new JWTMiddleware({
        opensaasPublicKey: publicKey,
        audience,
        issuer,
        requireAuthForAllMethods: true
      });

      const testApp = express();
      testApp.use(express.json());
      testApp.use(strictMiddleware.authenticate);
      testApp.get('/test', (req: AuthenticatedRequest, res) => {
        res.json({ authenticated: !!req.user });
      });

      const response = await request(testApp).get('/test');

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe(-32001);
      expect(response.body.error.message).toMatch(/Authentication required/);
    });

    it('should handle Bearer token with incorrect format', async () => {
      const response = await request(app)
        .get('/protected')
        .set('Authorization', 'InvalidFormat token');

      expect(response.status).toBe(200);
      expect(response.body.authenticated).toBe(false);
    });
  });

  describe('Static helper methods', () => {
    let mockReq: Partial<AuthenticatedRequest>;

    beforeEach(() => {
      mockReq = {
        user: {
          userId: 'test-user-123',
          email: 'test@example.com',
          subscriptionTier: 'pro',
          monthlyTokenQuota: 10000,
          rpmLimit: 100,
          tpmLimit: 5000,
          features: ['basic_ai', 'advanced_ai'],
          iat: Date.now() / 1000,
          exp: Date.now() / 1000 + 3600,
          iss: issuer,
          aud: audience
        },
        authContext: {
          type: 'opensaas',
          userId: 'test-user-123',
          email: 'test@example.com',
          subscriptionTier: 'pro',
          quotaInfo: {
            monthlyTokenQuota: 10000,
            rpmLimit: 100,
            tpmLimit: 5000
          },
          features: ['basic_ai', 'advanced_ai']
        }
      };
    });

    describe('getUserContext', () => {
      it('should return user context when present', () => {
        const context = JWTMiddleware.getUserContext(mockReq as AuthenticatedRequest);
        
        expect(context).toBeDefined();
        expect(context!.userId).toBe('test-user-123');
        expect(context!.email).toBe('test@example.com');
      });

      it('should return null when user context not present', () => {
        const emptyReq = {} as AuthenticatedRequest;
        const context = JWTMiddleware.getUserContext(emptyReq);
        
        expect(context).toBeNull();
      });
    });

    describe('hasFeature', () => {
      it('should return true when user has the feature', () => {
        const hasFeature = JWTMiddleware.hasFeature(mockReq as AuthenticatedRequest, 'basic_ai');
        expect(hasFeature).toBe(true);
      });

      it('should return false when user does not have the feature', () => {
        const hasFeature = JWTMiddleware.hasFeature(mockReq as AuthenticatedRequest, 'premium_feature');
        expect(hasFeature).toBe(false);
      });

      it('should return false when authContext is not present', () => {
        const emptyReq = {} as AuthenticatedRequest;
        const hasFeature = JWTMiddleware.hasFeature(emptyReq, 'basic_ai');
        expect(hasFeature).toBe(false);
      });
    });

    describe('hasSubscriptionTier', () => {
      it('should return true for same tier', () => {
        const hasTier = JWTMiddleware.hasSubscriptionTier(mockReq as AuthenticatedRequest, 'pro');
        expect(hasTier).toBe(true);
      });

      it('should return true for lower tier requirement', () => {
        const hasTier = JWTMiddleware.hasSubscriptionTier(mockReq as AuthenticatedRequest, 'starter');
        expect(hasTier).toBe(true);
      });

      it('should return false for higher tier requirement', () => {
        const hasTier = JWTMiddleware.hasSubscriptionTier(mockReq as AuthenticatedRequest, 'enterprise');
        expect(hasTier).toBe(false);
      });

      it('should work with custom tier configurations', () => {
        const customTiers = {
          starter: { name: 'Starter', monthlyTokenQuota: 1000, rpmLimit: 10, tpmLimit: 1000, features: [] },
          pro: { name: 'Pro', monthlyTokenQuota: 10000, rpmLimit: 100, tpmLimit: 5000, features: [] },
          enterprise: { name: 'Enterprise', monthlyTokenQuota: 100000, rpmLimit: 1000, tpmLimit: 50000, features: [] }
        };

        const hasTier = JWTMiddleware.hasSubscriptionTier(
          mockReq as AuthenticatedRequest,
          'starter',
          customTiers
        );
        expect(hasTier).toBe(true);
      });

      it('should return false when authContext is not present', () => {
        const emptyReq = {} as AuthenticatedRequest;
        const hasTier = JWTMiddleware.hasSubscriptionTier(emptyReq, 'pro');
        expect(hasTier).toBe(false);
      });
    });

    describe('getQuotaInfo', () => {
      it('should return quota info when present', () => {
        const quotaInfo = JWTMiddleware.getQuotaInfo(mockReq as AuthenticatedRequest);
        
        expect(quotaInfo).toBeDefined();
        expect(quotaInfo!.monthlyTokenQuota).toBe(10000);
        expect(quotaInfo!.rpmLimit).toBe(100);
        expect(quotaInfo!.tpmLimit).toBe(5000);
      });

      it('should return null when authContext is not present', () => {
        const emptyReq = {} as AuthenticatedRequest;
        const quotaInfo = JWTMiddleware.getQuotaInfo(emptyReq);
        
        expect(quotaInfo).toBeNull();
      });
    });
  });

  describe('Clock tolerance', () => {
    it('should use custom clock tolerance when configured', () => {
      const middleware = new JWTMiddleware({
        opensaasPublicKey: publicKey,
        audience,
        issuer,
        clockTolerance: 60 // 60 seconds tolerance
      });

      const payload: Partial<OpenSaaSJWTPayload> = {
        userId: 'test-user-123',
        email: 'test@example.com',
        subscriptionTier: 'pro',
        monthlyTokenQuota: 10000,
        rpmLimit: 100,
        tpmLimit: 5000,
        features: ['basic_ai']
      };

      // Token that would normally be slightly expired but within tolerance
      const token = jwt.sign(payload, privateKey, {
        algorithm: 'RS256',
        expiresIn: '-30s', // Expired 30 seconds ago
        issuer,
        audience
      });

      const validated = middleware.validateToken(token);
      expect(validated.userId).toBe('test-user-123');
    });
  });
});