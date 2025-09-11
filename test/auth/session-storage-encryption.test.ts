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
});