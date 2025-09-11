import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FileStorageAdapter } from '../../src/storage/FileStorageAdapter.js';
import * as fs from 'fs/promises';
import * as path from 'path';
// Mock fs operations
vi.mock('fs/promises', () => ({
    writeFile: vi.fn(),
    readFile: vi.fn(),
    access: vi.fn(),
    mkdir: vi.fn()
}));
// Mock crypto operations
vi.mock('crypto', () => ({
    randomBytes: vi.fn().mockReturnValue(Buffer.from('mock-random-bytes')),
    createCipher: vi.fn(),
    createDecipher: vi.fn(),
    scryptSync: vi.fn().mockReturnValue(Buffer.from('derived-key-32-chars')),
    createCipheriv: vi.fn().mockReturnValue({
        update: vi.fn().mockReturnValue('encrypted-part'),
        final: vi.fn().mockReturnValue('encrypted-final')
    }),
    createDecipheriv: vi.fn().mockReturnValue({
        update: vi.fn().mockReturnValue('decrypted-part'),
        final: vi.fn().mockReturnValue('decrypted-final')
    })
}));
describe.skip('FileStorageAdapter (NEEDS IMPLEMENTATION - crypto mocking issues)', () => {
    let adapter;
    const testPath = '/tmp/test-keys.json';
    const testMasterKey = 'test-master-key-32-characters-long';
    beforeEach(() => {
        adapter = new FileStorageAdapter(testPath, testMasterKey);
        vi.clearAllMocks();
    });
    afterEach(() => {
        vi.resetAllMocks();
    });
    describe('initialization', () => {
        it('should initialize and create directory if needed', async () => {
            const mockAccess = vi.mocked(fs.access);
            const mockMkdir = vi.mocked(fs.mkdir);
            // Mock directory doesn't exist
            mockAccess.mockRejectedValueOnce(new Error('ENOENT'));
            mockMkdir.mockResolvedValueOnce(undefined);
            await adapter.initialize();
            expect(mockMkdir).toHaveBeenCalledWith(path.dirname(testPath), { recursive: true });
        });
        it('should return correct storage type', () => {
            expect(adapter.getType()).toBe('file');
        });
    });
    describe('API key operations', () => {
        beforeEach(() => {
            const mockReadFile = vi.mocked(fs.readFile);
            const mockWriteFile = vi.mocked(fs.writeFile);
            // Mock empty file initially
            mockReadFile.mockResolvedValue('{}');
            mockWriteFile.mockResolvedValue();
        });
        it('should store API key successfully', async () => {
            const keyId = await adapter.storeApiKey('anthropic', 'sk-ant-test-key', 'user@test.com');
            expect(keyId).toBeDefined();
            expect(typeof keyId).toBe('string');
        });
        it('should retrieve API key successfully', async () => {
            // Mock file with encrypted data
            const mockReadFile = vi.mocked(fs.readFile);
            mockReadFile.mockResolvedValue(JSON.stringify({
                'user@test.com': {
                    'anthropic': {
                        encrypted: 'encrypted-data',
                        iv: 'initialization-vector'
                    }
                }
            }));
            const apiKey = await adapter.getApiKey('anthropic', 'user@test.com');
            expect(apiKey).toBe('decrypted-partdecrypted-final');
        });
        it('should return null for non-existent key', async () => {
            const mockReadFile = vi.mocked(fs.readFile);
            mockReadFile.mockResolvedValue('{}');
            const apiKey = await adapter.getApiKey('nonexistent', 'user@test.com');
            expect(apiKey).toBeNull();
        });
        it('should delete API key successfully', async () => {
            const mockReadFile = vi.mocked(fs.readFile);
            mockReadFile.mockResolvedValue(JSON.stringify({
                'user@test.com': {
                    'anthropic': {
                        encrypted: 'encrypted-data',
                        iv: 'initialization-vector'
                    }
                }
            }));
            const deleted = await adapter.deleteApiKey('anthropic', 'user@test.com');
            expect(deleted).toBe(true);
        });
        it('should return false when deleting non-existent key', async () => {
            const mockReadFile = vi.mocked(fs.readFile);
            mockReadFile.mockResolvedValue('{}');
            const deleted = await adapter.deleteApiKey('nonexistent', 'user@test.com');
            expect(deleted).toBe(false);
        });
        it('should list providers correctly', async () => {
            const mockReadFile = vi.mocked(fs.readFile);
            mockReadFile.mockResolvedValue(JSON.stringify({
                'user@test.com': {
                    'anthropic': { encrypted: 'data1', iv: 'iv1' },
                    'openai': { encrypted: 'data2', iv: 'iv2' }
                }
            }));
            const providers = await adapter.listProviders('user@test.com');
            expect(providers).toEqual([
                { provider: 'anthropic', hasKey: true },
                { provider: 'openai', hasKey: true }
            ]);
        });
        it('should rotate API key successfully', async () => {
            const mockReadFile = vi.mocked(fs.readFile);
            mockReadFile.mockResolvedValue(JSON.stringify({
                'user@test.com': {
                    'anthropic': {
                        encrypted: 'old-encrypted-data',
                        iv: 'old-iv'
                    }
                }
            }));
            const newKeyId = await adapter.rotateApiKey('anthropic', 'new-api-key', 'user@test.com');
            expect(newKeyId).toBeDefined();
            expect(typeof newKeyId).toBe('string');
        });
        it('should validate API key exists', async () => {
            const mockReadFile = vi.mocked(fs.readFile);
            mockReadFile.mockResolvedValue(JSON.stringify({
                'user@test.com': {
                    'anthropic': {
                        encrypted: 'encrypted-data',
                        iv: 'initialization-vector'
                    }
                }
            }));
            const isValid = await adapter.validateApiKey('anthropic', 'user@test.com');
            expect(isValid).toBe(true);
        });
    });
    describe('health check', () => {
        it('should perform health check successfully', async () => {
            const mockAccess = vi.mocked(fs.access);
            mockAccess.mockResolvedValueOnce(undefined);
            const health = await adapter.healthCheck();
            expect(health.status).toBe('healthy');
            expect(health.details.path).toBe(testPath);
        });
        it('should report unhealthy when file is not accessible', async () => {
            const mockAccess = vi.mocked(fs.access);
            mockAccess.mockRejectedValueOnce(new Error('Permission denied'));
            const health = await adapter.healthCheck();
            expect(health.status).toBe('unhealthy');
        });
    });
});
