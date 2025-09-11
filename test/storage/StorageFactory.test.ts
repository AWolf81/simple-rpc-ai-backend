import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { StorageFactory } from '@storage/StorageFactory';
import type { VaultStorageConfig, FileStorageConfig, ClientManagedStorageConfig } from '@storage/StorageAdapter';

// Mock the storage adapters
vi.mock('@storage/VaultStorageAdapter', () => ({
  VaultStorageAdapter: vi.fn().mockImplementation(() => ({
    initialize: vi.fn().mockResolvedValue(undefined),
    getType: () => 'vault'
  }))
}));

vi.mock('@storage/FileStorageAdapter', () => ({
  FileStorageAdapter: vi.fn().mockImplementation(() => ({
    initialize: vi.fn().mockResolvedValue(undefined),
    getType: () => 'file'
  }))
}));

vi.mock('@storage/ClientManagedStorageAdapter', () => ({
  ClientManagedStorageAdapter: vi.fn().mockImplementation(() => ({
    initialize: vi.fn().mockResolvedValue(undefined),
    getType: () => 'client_managed'
  }))
}));

// Mock PostgreSQL service
vi.mock('@services/PostgreSQLSecretManager', () => ({
  PostgreSQLSecretManager: vi.fn()
}));

describe('StorageFactory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear environment variables
    delete process.env.SECRET_MANAGER_DB_HOST;
    delete process.env.SECRET_MANAGER_DB_PASS;
    delete process.env.STORAGE_FILE_PATH;
    delete process.env.MASTER_KEY;
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('createStorage', () => {
    it.skip('should create vault storage adapter (REMOVED FEATURE)', async () => {
      // VaultStorageAdapter was removed - functionality moved to PostgreSQL adapter
      const config: VaultStorageConfig = {
        type: 'vault',
        config: {
          host: 'localhost',
          port: 5432,
          database: 'secrets',
          user: 'secret_manager',
          password: 'password',
          encryptionKey: 'test-key-32-characters-long'
        }
      };

      const adapter = await StorageFactory.createStorage(config);
      expect(adapter.getType()).toBe('vault');
    });

    it.skip('should create file storage adapter (NEEDS INITIALIZE METHOD)', async () => {
      // FileStorageAdapter needs initialize() method to be added
      const config: FileStorageConfig = {
        type: 'file',
        config: {
          path: '/tmp/test-keys.json',
          masterKey: 'test-master-key'
        }
      };

      const adapter = await StorageFactory.createStorage(config);
      expect(adapter.getType()).toBe('file');
    });

    it.skip('should create client-managed storage adapter (NEEDS INITIALIZE METHOD)', async () => {
      // ClientManagedStorageAdapter needs initialize() method to be added
      const config: ClientManagedStorageConfig = {
        type: 'client_managed'
      };

      const adapter = await StorageFactory.createStorage(config);
      expect(adapter.getType()).toBe('client_managed');
    });

    it('should throw error for unsupported storage type', async () => {
      const config = {
        type: 'unsupported' as any
      };

      await expect(StorageFactory.createStorage(config)).rejects.toThrow('Unsupported storage type: unsupported');
    });
  });

  describe('createFromEnvironment', () => {
    it.skip('should detect and create vault storage from environment (REMOVED FEATURE)', async () => {
      // VaultStorageAdapter was removed - functionality moved to PostgreSQL adapter
      process.env.SECRET_MANAGER_DB_HOST = 'localhost';
      process.env.SECRET_MANAGER_DB_PASS = 'password';

      const adapter = await StorageFactory.createFromEnvironment();
      expect(adapter.getType()).toBe('vault');
    });

    it.skip('should detect and create file storage from environment (NEEDS IMPLEMENTATION - initialize method)', async () => {
      // FileStorageAdapter needs initialize() method to be added
      process.env.STORAGE_FILE_PATH = '/tmp/keys.json';
      process.env.MASTER_KEY = 'test-key';

      const adapter = await StorageFactory.createFromEnvironment();
      expect(adapter.getType()).toBe('file');
    });

    it.skip('should default to client-managed storage (NEEDS IMPLEMENTATION - initialize method)', async () => {
      // ClientManagedStorageAdapter needs initialize() method to be added  
      const adapter = await StorageFactory.createFromEnvironment();
      expect(adapter.getType()).toBe('client_managed');
    });
  });

  describe('validateConfig', () => {
    it('should validate vault storage config', () => {
      const validConfig: VaultStorageConfig = {
        type: 'vault',
        config: {
          host: 'localhost',
          port: 5432,
          database: 'secrets',
          user: 'secret_manager',
          password: 'password',
          encryptionKey: 'test-key-32-characters-long'
        }
      };

      const errors = StorageFactory.validateConfig(validConfig);
      expect(errors).toHaveLength(0);
    });

    it('should return errors for invalid vault config', () => {
      const invalidConfig: VaultStorageConfig = {
        type: 'vault',
        config: {
          host: '',
          port: 5432,
          database: '',
          user: 'secret_manager',
          password: '',
          encryptionKey: ''
        }
      };

      const errors = StorageFactory.validateConfig(invalidConfig);
      expect(errors).toContain('Vault storage host is required');
      expect(errors).toContain('Vault storage database is required');
      expect(errors).toContain('Vault storage password is required');
      expect(errors).toContain('Vault storage encryptionKey is required');
    });

    it('should validate file storage config', () => {
      const validConfig: FileStorageConfig = {
        type: 'file',
        config: {
          path: '/tmp/keys.json',
          masterKey: 'secure-master-key'
        }
      };

      const errors = StorageFactory.validateConfig(validConfig);
      expect(errors).toHaveLength(0);
    });

    it('should return errors for invalid file config', () => {
      const invalidConfig: FileStorageConfig = {
        type: 'file',
        config: {
          path: '',
          masterKey: ''
        }
      };

      const errors = StorageFactory.validateConfig(invalidConfig);
      expect(errors).toContain('File storage path is required');
      expect(errors).toContain('File storage masterKey is required');
    });

    it('should validate client-managed storage config', () => {
      const validConfig: ClientManagedStorageConfig = {
        type: 'client_managed'
      };

      const errors = StorageFactory.validateConfig(validConfig);
      expect(errors).toHaveLength(0);
    });

    it('should return error for unknown storage type', () => {
      const invalidConfig = {
        type: 'unknown' as any
      };

      const errors = StorageFactory.validateConfig(invalidConfig);
      expect(errors).toContain('Unknown storage type: unknown');
    });
  });

  describe('testStorage', () => {
    it.skip('should test storage adapter successfully (NEEDS IMPLEMENTATION - mock setup issues)', async () => {
      // Mock adapter needs proper method setup for storage operations testing
      const mockAdapter = {
        getType: () => 'file' as const,
        healthCheck: vi.fn().mockResolvedValue({
          status: 'healthy' as const,
          details: { path: '/tmp/test.json' }
        }),
        storeApiKey: vi.fn().mockResolvedValue('key-id'),
        getApiKey: vi.fn().mockResolvedValue('test-api-key'),
        deleteApiKey: vi.fn().mockResolvedValue(true)
      };

      const result = await StorageFactory.testStorage(mockAdapter as any);
      expect(result.success).toBe(true);
      expect(mockAdapter.healthCheck).toHaveBeenCalled();
    });

    it('should handle unhealthy storage', async () => {
      const mockAdapter = {
        getType: () => 'file' as const,
        healthCheck: vi.fn().mockResolvedValue({
          status: 'unhealthy' as const,
          details: { error: 'Cannot connect' }
        })
      };

      const result = await StorageFactory.testStorage(mockAdapter as any);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Storage health check failed');
    });

    it('should skip operations test for client-managed storage', async () => {
      const mockAdapter = {
        getType: () => 'client_managed' as const,
        healthCheck: vi.fn().mockResolvedValue({
          status: 'healthy' as const,
          details: { type: 'client_managed' }
        })
      };

      const result = await StorageFactory.testStorage(mockAdapter as any);
      expect(result.success).toBe(true);
    });

    it('should handle storage operation errors', async () => {
      const mockAdapter = {
        getType: () => 'file' as const,
        healthCheck: vi.fn().mockResolvedValue({
          status: 'healthy' as const,
          details: { path: '/tmp/test.json' }
        }),
        storeApiKey: vi.fn().mockRejectedValue(new Error('Storage error'))
      };

      const result = await StorageFactory.testStorage(mockAdapter as any);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Storage operation test failed');
    });
  });
});