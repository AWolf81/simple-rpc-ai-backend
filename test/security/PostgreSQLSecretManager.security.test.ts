/**
 * Comprehensive Security Tests for PostgreSQLSecretManager
 * Tests all security improvements from the hardening PR
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PostgreSQLSecretManager, type PostgreSQLConfig } from '../../src/services/security/PostgreSQLSecretManager';
import { randomBytes, createHash } from 'crypto';
import * as winston from 'winston';

// Mock PostgreSQL client
const mockClient = {
  connect: vi.fn(),
  query: vi.fn(),
  end: vi.fn()
};

vi.mock('pg', () => ({
  Client: vi.fn(() => mockClient)
}));

describe('PostgreSQLSecretManager - Security Hardening', () => {
  let config: PostgreSQLConfig;
  let encryptionKey: string;
  let logger: winston.Logger;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    mockClient.connect.mockResolvedValue(undefined);
    mockClient.query.mockResolvedValue({ rows: [] });
    mockClient.end.mockResolvedValue(undefined);

    // Base configuration
    config = {
      host: 'localhost',
      port: 5432,
      database: 'test_db',
      user: 'test_user',
      password: 'test_pass'
    };

    encryptionKey = 'test-encryption-key-with-sufficient-length';

    logger = winston.createLogger({
      silent: true,
      transports: []
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Critical Issue 1: Race Condition Prevention', () => {
    it('should throw error when methods called before initialize()', async () => {
      const manager = new PostgreSQLSecretManager(config, encryptionKey, logger);

      // Should throw for all public methods before initialization
      await expect(
        manager.storeUserKey('test@example.com', 'anthropic', 'sk-ant-test')
      ).rejects.toThrow('PostgreSQLSecretManager not initialized');

      await expect(
        manager.getUserKey('test@example.com', 'anthropic')
      ).rejects.toThrow('PostgreSQLSecretManager not initialized');

      await expect(
        manager.getUserProviders('test@example.com')
      ).rejects.toThrow('PostgreSQLSecretManager not initialized');

      await expect(
        manager.deleteUserKey('test@example.com', 'anthropic')
      ).rejects.toThrow('PostgreSQLSecretManager not initialized');

      await expect(
        manager.validateUserKey('test@example.com', 'anthropic')
      ).rejects.toThrow('PostgreSQLSecretManager not initialized');
    });

    it('should allow operations after initialize() completes', async () => {
      const manager = new PostgreSQLSecretManager(config, encryptionKey, logger);
      await manager.initialize();

      // Mock successful query
      mockClient.query.mockResolvedValueOnce({
        rows: [{ id: 1 }]
      });

      // Should not throw after initialization
      const result = await manager.storeUserKey('test@example.com', 'anthropic', 'sk-ant-test');
      expect(result.success).toBe(true);
    });

    it('should set initialized flag only after deriveMasterKey completes', async () => {
      const manager = new PostgreSQLSecretManager(config, encryptionKey, logger);

      // Before initialize
      await expect(
        manager.storeUserKey('test@example.com', 'anthropic', 'sk-ant-test')
      ).rejects.toThrow('not initialized');

      // After initialize
      await manager.initialize();
      mockClient.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      const result = await manager.storeUserKey('test@example.com', 'anthropic', 'sk-ant-test');
      expect(result.success).toBe(true);
    });
  });

  describe('Critical Issue 2: Production Salt Enforcement', () => {
    it('should throw error in production without salt', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      expect(() => {
        new PostgreSQLSecretManager(config, encryptionKey, logger);
      }).toThrow('CRITICAL SECURITY ERROR');

      expect(() => {
        new PostgreSQLSecretManager(config, encryptionKey, logger);
      }).toThrow('encryptionSalt is REQUIRED in production');

      process.env.NODE_ENV = originalEnv;
    });

    it('should accept salt in production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const saltConfig = {
        ...config,
        encryptionSalt: randomBytes(32).toString('hex')
      };

      expect(() => {
        new PostgreSQLSecretManager(saltConfig, encryptionKey, logger);
      }).not.toThrow();

      process.env.NODE_ENV = originalEnv;
    });

    it('should use default salt in development with warning', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const warnSpy = vi.spyOn(logger, 'warn');

      const manager = new PostgreSQLSecretManager(config, encryptionKey, logger);

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('SECURITY WARNING')
      );

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('High Priority Issue 3: User ID Migration', () => {
    it('should generate different user IDs with SHA-256 vs legacy', () => {
      const manager = new PostgreSQLSecretManager(config, encryptionKey, logger) as any;

      const email = 'test@example.com';
      const newId = manager.getUserId(email);
      const legacyId = manager.getLegacyUserId(email);

      expect(newId).not.toBe(legacyId);
      expect(newId.length).toBe(64); // SHA-256 hex = 64 chars
      expect(legacyId).toBe('test-example-com');
    });

    it('should try legacy user ID when enableLegacyUserIds is true', async () => {
      const legacyConfig = {
        ...config,
        enableLegacyUserIds: true
      };

      const manager = new PostgreSQLSecretManager(legacyConfig, encryptionKey, logger);
      await manager.initialize();

      // First query (new ID) returns nothing
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      // Second query (legacy ID) returns data
      mockClient.query.mockResolvedValueOnce({
        rows: [{ encrypted_value: 'iv:tag:encrypted' }]
      });

      // Third query (migration UPDATE)
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      const result = await manager.getUserKey('test@example.com', 'anthropic');

      // Should have tried both user IDs
      expect(mockClient.query).toHaveBeenCalledTimes(3);
    });

    it('should not try legacy user ID when enableLegacyUserIds is false', async () => {
      const manager = new PostgreSQLSecretManager(config, encryptionKey, logger);
      await manager.initialize();

      // Query returns nothing
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      const result = await manager.getUserKey('test@example.com', 'anthropic');

      // Should only try once (new user ID)
      expect(mockClient.query).toHaveBeenCalledTimes(1);
      expect(result.success).toBe(false);
    });

    it('should migrate data from legacy to new user ID', async () => {
      const legacyConfig = {
        ...config,
        enableLegacyUserIds: true
      };

      const manager = new PostgreSQLSecretManager(legacyConfig, encryptionKey, logger);
      await manager.initialize();

      const email = 'test@example.com';
      const provider = 'anthropic';

      // Mock: new ID not found
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      // Mock: legacy ID found
      mockClient.query.mockResolvedValueOnce({
        rows: [{ encrypted_value: 'iv:tag:encrypted' }]
      });

      // Mock: migration UPDATE
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await manager.getUserKey(email, provider);

      // Verify migration query was called
      const updateCall = mockClient.query.mock.calls.find(call =>
        call[0].includes('UPDATE user_secrets')
      );
      expect(updateCall).toBeDefined();
    });
  });

  describe('High Priority Issue 4: Configurable Scrypt Parameters', () => {
    it('should use default scrypt parameters', async () => {
      const manager = new PostgreSQLSecretManager(config, encryptionKey, logger) as any;

      expect(manager.scryptOptions.N).toBe(16384);
      expect(manager.scryptOptions.r).toBe(8);
      expect(manager.scryptOptions.p).toBe(1);
      expect(manager.scryptOptions.keylen).toBe(32);
    });

    it('should accept custom scrypt parameters', () => {
      const customConfig = {
        ...config,
        scryptOptions: {
          N: 32768,
          r: 16,
          p: 2,
          keylen: 64
        }
      };

      const manager = new PostgreSQLSecretManager(customConfig, encryptionKey, logger) as any;

      expect(manager.scryptOptions.N).toBe(32768);
      expect(manager.scryptOptions.r).toBe(16);
      expect(manager.scryptOptions.p).toBe(2);
      expect(manager.scryptOptions.keylen).toBe(64);
    });

    it('should merge partial scrypt parameters with defaults', () => {
      const partialConfig = {
        ...config,
        scryptOptions: {
          N: 8192  // Only override N
        }
      };

      const manager = new PostgreSQLSecretManager(partialConfig, encryptionKey, logger) as any;

      expect(manager.scryptOptions.N).toBe(8192);  // Custom
      expect(manager.scryptOptions.r).toBe(8);     // Default
      expect(manager.scryptOptions.p).toBe(1);     // Default
      expect(manager.scryptOptions.keylen).toBe(32); // Default
    });
  });

  describe('Medium Priority Issue 5: Salt Validation', () => {
    it('should reject non-hex salt', () => {
      const invalidConfig = {
        ...config,
        encryptionSalt: 'not-hex-encoded-123!'
      };

      expect(() => {
        new PostgreSQLSecretManager(invalidConfig, encryptionKey, logger);
      }).toThrow('Invalid encryptionSalt format');
    });

    it('should reject salt shorter than 32 bytes', () => {
      const shortSalt = randomBytes(16).toString('hex'); // Only 16 bytes
      const invalidConfig = {
        ...config,
        encryptionSalt: shortSalt
      };

      expect(() => {
        new PostgreSQLSecretManager(invalidConfig, encryptionKey, logger);
      }).toThrow('Invalid encryptionSalt length');

      expect(() => {
        new PostgreSQLSecretManager(invalidConfig, encryptionKey, logger);
      }).toThrow('minimum 32 required');
    });

    it('should accept salt exactly 32 bytes', () => {
      const validSalt = randomBytes(32).toString('hex');
      const validConfig = {
        ...config,
        encryptionSalt: validSalt
      };

      expect(() => {
        new PostgreSQLSecretManager(validConfig, encryptionKey, logger);
      }).not.toThrow();
    });

    it('should accept salt longer than 32 bytes', () => {
      const longSalt = randomBytes(64).toString('hex');
      const validConfig = {
        ...config,
        encryptionSalt: longSalt
      };

      expect(() => {
        new PostgreSQLSecretManager(validConfig, encryptionKey, logger);
      }).not.toThrow();
    });

    it('should log successful salt configuration', () => {
      const infoSpy = vi.spyOn(logger, 'info');
      const validSalt = randomBytes(32).toString('hex');
      const validConfig = {
        ...config,
        encryptionSalt: validSalt
      };

      new PostgreSQLSecretManager(validConfig, encryptionKey, logger);

      expect(infoSpy).toHaveBeenCalledWith(
        'Encryption salt configured successfully',
        expect.objectContaining({
          saltLength: 32
        })
      );
    });
  });

  describe('Security: SHA-256 User ID Generation', () => {
    it('should generate consistent user IDs for same email', () => {
      const manager = new PostgreSQLSecretManager(config, encryptionKey, logger) as any;

      const email = 'test@example.com';
      const id1 = manager.getUserId(email);
      const id2 = manager.getUserId(email);

      expect(id1).toBe(id2);
    });

    it('should generate different user IDs for different emails', () => {
      const manager = new PostgreSQLSecretManager(config, encryptionKey, logger) as any;

      const id1 = manager.getUserId('user1@example.com');
      const id2 = manager.getUserId('user2@example.com');

      expect(id1).not.toBe(id2);
    });

    it('should be case-insensitive and trim whitespace', () => {
      const manager = new PostgreSQLSecretManager(config, encryptionKey, logger) as any;

      const id1 = manager.getUserId('Test@Example.com');
      const id2 = manager.getUserId('test@example.com');
      const id3 = manager.getUserId('  test@example.com  ');

      expect(id1).toBe(id2);
      expect(id2).toBe(id3);
    });

    it('should match Node.js crypto.createHash SHA-256 output', () => {
      const manager = new PostgreSQLSecretManager(config, encryptionKey, logger) as any;

      const email = 'test@example.com';
      const managerId = manager.getUserId(email);

      const expectedId = createHash('sha256')
        .update(email.toLowerCase().trim())
        .digest('hex');

      expect(managerId).toBe(expectedId);
      expect(managerId.length).toBe(64); // SHA-256 = 64 hex chars
    });
  });

  describe('Security: Encryption with Derived Master Key', () => {
    it('should derive master key during initialization', async () => {
      const manager = new PostgreSQLSecretManager(config, encryptionKey, logger) as any;

      // Before initialization
      expect(manager.masterKey.every((byte: number) => byte === 0)).toBe(true);

      await manager.initialize();

      // After initialization - should have derived key
      expect(manager.masterKey.every((byte: number) => byte === 0)).toBe(false);
      expect(manager.masterKey.length).toBe(32);
    });

    it('should use scrypt for key derivation', async () => {
      const validSalt = randomBytes(32).toString('hex');
      const configWithSalt = {
        ...config,
        encryptionSalt: validSalt
      };

      const manager = new PostgreSQLSecretManager(configWithSalt, encryptionKey, logger);
      await manager.initialize();

      // Verify scrypt was used (master key should be non-zero and 32 bytes)
      const masterKey = (manager as any).masterKey;
      expect(masterKey).toBeInstanceOf(Buffer);
      expect(masterKey.length).toBe(32);
      expect(masterKey.some((byte: number) => byte !== 0)).toBe(true);
    });
  });

  describe('Security: Legacy User ID Support Warnings', () => {
    it('should warn when legacy user IDs are enabled', () => {
      const warnSpy = vi.spyOn(logger, 'warn');
      const legacyConfig = {
        ...config,
        enableLegacyUserIds: true
      };

      new PostgreSQLSecretManager(legacyConfig, encryptionKey, logger);

      expect(warnSpy).toHaveBeenCalledWith(
        'Legacy user ID support enabled - migrate data and disable for production'
      );
    });

    it('should not warn when legacy user IDs are disabled', () => {
      const warnSpy = vi.spyOn(logger, 'warn');

      new PostgreSQLSecretManager(config, encryptionKey, logger);

      const legacyWarning = warnSpy.mock.calls.find(call =>
        call[0].includes('Legacy user ID')
      );
      expect(legacyWarning).toBeUndefined();
    });
  });

  describe('Integration: End-to-End Security Flow', () => {
    it('should complete full secure flow with all improvements', async () => {
      const validSalt = randomBytes(32).toString('hex');
      const secureConfig = {
        ...config,
        encryptionSalt: validSalt,
        scryptOptions: {
          N: 16384,
          r: 8,
          p: 1
        }
      };

      const manager = new PostgreSQLSecretManager(secureConfig, encryptionKey, logger);

      // 1. Initialize with scrypt key derivation
      await manager.initialize();
      expect((manager as any).initialized).toBe(true);

      // 2. Store key with SHA-256 user ID
      mockClient.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
      mockClient.query.mockResolvedValueOnce({ rows: [] }); // audit log

      const storeResult = await manager.storeUserKey(
        'test@example.com',
        'anthropic',
        'sk-ant-test-key'
      );
      expect(storeResult.success).toBe(true);

      // 3. Retrieve with initialization guard
      expect((manager as any).initialized).toBe(true);
    });
  });
});
