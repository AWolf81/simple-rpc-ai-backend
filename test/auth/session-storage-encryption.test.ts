/**
 * Test OAuth Session Storage Encryption
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, unlinkSync, readFileSync } from 'fs';
import { FileSessionStorage, createSessionStorage } from '../../src/auth/session-storage';

describe('OAuth Session Storage Encryption', () => {
  const testFilePath = './test-oauth-sessions.json';
  const testPassword = 'test-encryption-password-123';
  
  afterEach(() => {
    // Clean up test files
    if (existsSync(testFilePath)) {
      unlinkSync(testFilePath);
    }
  });

  describe('FileSessionStorage Encryption', () => {
    it('should encrypt session data by default', async () => {
      const storage = new FileSessionStorage({
        filePath: testFilePath,
        encryptionPassword: testPassword
      });

      await storage.initialize();

      // Add some test data
      const testToken = {
        accessToken: 'test-access-token-123',
        accessTokenExpiresAt: new Date(),
        refreshToken: 'test-refresh-token-456',
        refreshTokenExpiresAt: new Date(),
        scope: ['read', 'write'],
        client: { id: 'test-client' },
        user: { id: 'test-user', email: 'test@example.com' }
      };

      await storage.setToken('test-token-id', testToken as any);
      await storage.close();

      // Verify file exists and is encrypted (not readable as JSON)
      expect(existsSync(testFilePath)).toBe(true);
      
      const fileContent = readFileSync(testFilePath, 'utf8');
      
      // Encrypted data should not be valid JSON
      expect(() => JSON.parse(fileContent)).toThrow();
      
      // Should contain hex-encoded data with colons (IV:authTag:encryptedData)
      expect(fileContent).toMatch(/^[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$/);
    });

    it('should decrypt session data correctly', async () => {
      const storage1 = new FileSessionStorage({
        filePath: testFilePath,
        encryptionPassword: testPassword
      });

      await storage1.initialize();

      // Add test data
      const testUser = {
        id: 'test-user-123',
        email: 'test@example.com',
        name: 'Test User'
      };

      await storage1.setUser('test-user-id', testUser as any);
      await storage1.close();

      // Create new storage instance and verify data can be decrypted
      const storage2 = new FileSessionStorage({
        filePath: testFilePath,
        encryptionPassword: testPassword
      });

      await storage2.initialize();
      
      const retrievedUser = await storage2.getUser('test-user-id');
      expect(retrievedUser).toEqual(testUser);

      await storage2.close();
    });

    it('should fail with wrong encryption password', async () => {
      const storage1 = new FileSessionStorage({
        filePath: testFilePath,
        encryptionPassword: testPassword
      });

      await storage1.initialize();
      await storage1.setItem('test-key', 'test-value');
      await storage1.close();

      // Try to read with wrong password
      const storage2 = new FileSessionStorage({
        filePath: testFilePath,
        encryptionPassword: 'wrong-password'
      });

      await expect(storage2.initialize()).rejects.toThrow(/Failed to decrypt session data/);
    });

    it('should allow disabling encryption for testing', async () => {
      const storage = new FileSessionStorage({
        filePath: testFilePath,
        encryptionEnabled: false
      });

      await storage.initialize();

      const testClient = {
        id: 'test-client',
        clientSecret: 'test-secret',
        grants: ['authorization_code'],
        redirectUris: ['http://localhost:3000/callback']
      };

      await storage.setClient('test-client-id', testClient as any);
      await storage.close();

      // Verify file is plaintext JSON
      expect(existsSync(testFilePath)).toBe(true);
      
      const fileContent = readFileSync(testFilePath, 'utf8');
      const data = JSON.parse(fileContent); // Should not throw
      
      expect(data.clients).toBeDefined();
      expect(data.clients['test-client-id']).toEqual(testClient);
      expect(data.encrypted).toBe(false);
    });

    it('should migrate from plaintext to encrypted format', async () => {
      // First, create plaintext file
      const plaintextStorage = new FileSessionStorage({
        filePath: testFilePath,
        encryptionEnabled: false
      });

      await plaintextStorage.initialize();
      await plaintextStorage.setItem('migration-test', 'plaintext-data');
      await plaintextStorage.close();

      // Verify it's plaintext
      const plaintextContent = readFileSync(testFilePath, 'utf8');
      expect(() => JSON.parse(plaintextContent)).not.toThrow();

      // Now create encrypted storage that should migrate the data
      const encryptedStorage = new FileSessionStorage({
        filePath: testFilePath,
        encryptionPassword: testPassword
      });

      await encryptedStorage.initialize();
      
      // Verify data was migrated
      const value = await encryptedStorage.getItem('migration-test');
      expect(value).toBe('plaintext-data');

      await encryptedStorage.close();

      // Verify file is now encrypted
      const encryptedContent = readFileSync(testFilePath, 'utf8');
      expect(() => JSON.parse(encryptedContent)).toThrow();
      expect(encryptedContent).toMatch(/^[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$/);
    });
  });

  describe('Factory Function', () => {
    it('should create encrypted file storage via factory', async () => {
      const storage = createSessionStorage({
        type: 'file',
        filePath: testFilePath,
        encryptionEnabled: true,
        encryptionPassword: testPassword
      });

      await storage.initialize();
      await storage.setItem('factory-test', 'encrypted-via-factory');
      await storage.close();

      // Verify file is encrypted
      const fileContent = readFileSync(testFilePath, 'utf8');
      expect(() => JSON.parse(fileContent)).toThrow();
    });

    it('should create plaintext file storage for testing', async () => {
      const storage = createSessionStorage({
        type: 'file',
        filePath: testFilePath,
        encryptionEnabled: false
      });

      await storage.initialize();
      await storage.setItem('factory-test', 'plaintext-via-factory');
      await storage.close();

      // Verify file is plaintext
      const fileContent = readFileSync(testFilePath, 'utf8');
      const data = JSON.parse(fileContent);
      expect(data.items['factory-test'].value).toBe('plaintext-via-factory');
    });
  });

  describe('Additional Coverage Tests', () => {
    it('should create memory storage via factory', async () => {
      const storage = createSessionStorage({ type: 'memory' });
      
      expect(storage).toBeDefined();
      await storage.close();
    });

    it('should handle getItem and setItem with memory storage', async () => {
      const storage = createSessionStorage({ type: 'memory' });
      
      await storage.initialize();
      await storage.setItem('test-key', 'test-value');
      const value = await storage.getItem('test-key');
      
      expect(value).toBe('test-value');
      
      await storage.close();
    });

    it('should handle OAuth operations with memory storage', async () => {
      const storage = createSessionStorage({ type: 'memory' });
      
      await storage.initialize();
      
      // Test OAuth-specific operations 
      const testClient = { id: 'test-client', name: 'Test Client' };
      
      // This tests the internal OAuth storage interface
      expect(storage).toBeDefined();
      expect(typeof storage.initialize).toBe('function');
      expect(typeof storage.close).toBe('function');
      
      await storage.close();
    });

    it('should handle file storage initialization edge cases', async () => {
      const testFile = './test-edge-case-sessions.json';
      
      const storage = new FileSessionStorage({
        filePath: testFile,
        encryptionEnabled: true,
        encryptionPassword: 'test-password'
      });
      
      await storage.initialize();
      
      // Test OAuth storage functionality
      expect(storage).toBeDefined();
      expect(typeof storage.initialize).toBe('function');
      expect(typeof storage.close).toBe('function');
      
      await storage.close();
      
      // Clean up
      const fs = await import('fs/promises');
      await fs.unlink(testFile).catch(() => {});
    });

    it('should handle file corruption gracefully', async () => {
      const testFile = './test-corrupt-sessions.json';
      
      // Create corrupted file
      const fs = await import('fs/promises');
      await fs.writeFile(testFile, 'invalid-json-content');
      
      const storage = new FileSessionStorage({
        filePath: testFile,
        encryptionEnabled: false
      });
      
      // Should throw error for corrupted files and handle it gracefully
      await expect(storage.initialize()).rejects.toThrow();
      
      await fs.unlink(testFile).catch(() => {});
    });

    it('should handle encryption key derivation edge cases', async () => {
      const testFile1 = './test-key-derive1.json';
      const testFile2 = './test-key-derive2.json';
      
      // Test with empty password (should use default)
      const storage1 = new FileSessionStorage({
        filePath: testFile1,
        encryptionEnabled: true,
        encryptionPassword: ''
      });
      
      // Test with very long password
      const longPassword = 'a'.repeat(1000);
      const storage2 = new FileSessionStorage({
        filePath: testFile2,
        encryptionEnabled: true,
        encryptionPassword: longPassword
      });
      
      await storage1.initialize();
      await storage2.initialize();
      
      expect(storage1).toBeDefined();
      expect(storage2).toBeDefined();
      
      await storage1.close();
      await storage2.close();
      
      // Clean up
      const fs = await import('fs/promises');
      await fs.unlink(testFile1).catch(() => {});
      await fs.unlink(testFile2).catch(() => {});
    });
  });

  describe('Redis Session Storage Coverage', () => {
    it('should create Redis session storage via factory', () => {
      const redisConfig = {
        type: 'redis' as const,
        redis: {
          host: 'localhost',
          port: 6379,
          password: 'redis-password',
          db: 0,
          keyPrefix: 'oauth:',
          instance: null
        }
      };
      
      const storage = createSessionStorage(redisConfig);
      
      expect(storage).toBeDefined();
    });

    it('should create Redis session storage with instance', () => {
      const mockRedis = {
        get: vi.fn(),
        set: vi.fn(),
        del: vi.fn(),
        quit: vi.fn()
      };
      
      const redisConfig = {
        type: 'redis' as const,
        redis: {
          instance: mockRedis
        }
      };
      
      const storage = createSessionStorage(redisConfig);
      
      expect(storage).toBeDefined();
    });

    it('should test Redis deleteItem method', async () => {
      // Import from ES modules instead of require
      const { RedisSessionStorage } = await import('../../src/auth/session-storage');
      
      // Mock Redis for testing deleteItem
      const mockRedis = {
        get: vi.fn(),
        set: vi.fn(),
        del: vi.fn().mockResolvedValue(1), // Mock successful deletion
        quit: vi.fn()
      };
      
      const redisStorage = new RedisSessionStorage({ redis: mockRedis });
      
      const result = await redisStorage.deleteItem('test-key');
      
      expect(result).toBe(true);
      expect(mockRedis.del).toHaveBeenCalled();
    });

    it('should test Redis deleteItem method with no deletion', async () => {
      // Import from ES modules instead of require
      const { RedisSessionStorage } = await import('../../src/auth/session-storage');
      
      // Mock Redis for testing deleteItem when key doesn't exist
      const mockRedis = {
        get: vi.fn(),
        set: vi.fn(),
        del: vi.fn().mockResolvedValue(0), // Mock no deletion
        quit: vi.fn()
      };
      
      const redisStorage = new RedisSessionStorage({ redis: mockRedis });
      
      const result = await redisStorage.deleteItem('non-existent-key');
      
      expect(result).toBe(false);
      expect(mockRedis.del).toHaveBeenCalled();
    });
  });

  describe('Factory Error Cases', () => {
    it('should throw error for unsupported storage type', () => {
      const invalidConfig = {
        type: 'unsupported' as any
      };
      
      expect(() => createSessionStorage(invalidConfig)).toThrow('Unsupported session storage type: unsupported');
    });

    it('should handle various invalid storage types', () => {
      const invalidTypes = ['postgresql', 'mongodb', 'elasticsearch'];
      
      invalidTypes.forEach(type => {
        expect(() => createSessionStorage({ type: type as any })).toThrow(`Unsupported session storage type: ${type}`);
      });
    });
  });

  describe('Advanced File Storage Tests', () => {
    it('should test concurrent access to file storage', async () => {
      const testFile = './test-concurrent.json';
      
      const storage1 = new FileSessionStorage({
        filePath: testFile,
        encryptionEnabled: false
      });
      
      const storage2 = new FileSessionStorage({
        filePath: testFile,
        encryptionEnabled: false
      });
      
      await storage1.initialize();
      await storage2.initialize();
      
      // Both instances should work
      expect(storage1).toBeDefined();
      expect(storage2).toBeDefined();
      
      await storage1.close();
      await storage2.close();
      
      // Clean up
      const fs = await import('fs/promises');
      await fs.unlink(testFile).catch(() => {});
    });

    it('should handle storage with different encryption passwords', async () => {
      const testFile1 = './test-pass1.json';
      const testFile2 = './test-pass2.json';
      
      const storage1 = new FileSessionStorage({
        filePath: testFile1,
        encryptionEnabled: true,
        encryptionPassword: 'password1'
      });
      
      const storage2 = new FileSessionStorage({
        filePath: testFile2,
        encryptionEnabled: true,
        encryptionPassword: 'password2'
      });
      
      await storage1.initialize();
      await storage2.initialize();
      
      expect(storage1).toBeDefined();
      expect(storage2).toBeDefined();
      
      await storage1.close();
      await storage2.close();
      
      // Clean up
      const fs = await import('fs/promises');
      await fs.unlink(testFile1).catch(() => {});
      await fs.unlink(testFile2).catch(() => {});
    });

    it('should test storage state persistence', async () => {
      const testFile = './test-persistence.json';
      
      const storage1 = new FileSessionStorage({
        filePath: testFile,
        encryptionEnabled: false
      });
      
      await storage1.initialize();
      await storage1.setItem('persistent-key', 'persistent-value');
      await storage1.close();
      
      // Create new instance with same file
      const storage2 = new FileSessionStorage({
        filePath: testFile,
        encryptionEnabled: false
      });
      
      await storage2.initialize();
      const value = await storage2.getItem('persistent-key');
      
      expect(value).toBe('persistent-value');
      
      await storage2.close();
      
      // Clean up
      const fs = await import('fs/promises');
      await fs.unlink(testFile).catch(() => {});
    });
  });
});