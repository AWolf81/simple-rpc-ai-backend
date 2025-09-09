import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ClientManagedStorageAdapter } from '../../src/storage/ClientManagedStorageAdapter.js';
describe('ClientManagedStorageAdapter', () => {
    let adapter;
    beforeEach(() => {
        adapter = new ClientManagedStorageAdapter();
        vi.clearAllMocks();
    });
    afterEach(() => {
        vi.resetAllMocks();
    });
    describe('initialization', () => {
        it('should initialize without errors', async () => {
            await expect(adapter.initialize()).resolves.not.toThrow();
        });
        it('should return correct storage type', () => {
            expect(adapter.getType()).toBe('client_managed');
        });
    });
    describe('API key operations', () => {
        it('should throw error when trying to store API key', async () => {
            await expect(adapter.storeApiKey('anthropic', 'sk-ant-test-key', 'user@test.com')).rejects.toThrow('Client-managed storage does not support server-side key storage');
        });
        it('should return null when trying to get API key', async () => {
            const result = await adapter.getApiKey('anthropic', 'user@test.com');
            expect(result).toBeNull();
        });
        it('should throw error when trying to delete API key', async () => {
            await expect(adapter.deleteApiKey('anthropic', 'user@test.com')).rejects.toThrow('Client-managed storage does not support server-side key deletion');
        });
        it('should return providers list with hasKey false', async () => {
            const providers = await adapter.listProviders('user@test.com');
            expect(providers).toEqual([
                { provider: 'anthropic', hasKey: false },
                { provider: 'openai', hasKey: false },
                { provider: 'google', hasKey: false },
                { provider: 'deepseek', hasKey: false },
                { provider: 'openrouter', hasKey: false }
            ]);
        });
        it('should throw error when trying to rotate API key', async () => {
            await expect(adapter.rotateApiKey('anthropic', 'new-api-key', 'user@test.com')).rejects.toThrow('Client-managed storage does not support server-side key rotation');
        });
        it('should return false for validate API key', async () => {
            const isValid = await adapter.validateApiKey('anthropic', 'user@test.com');
            expect(isValid).toBe(false);
        });
    });
    describe('health check', () => {
        it('should always report healthy', async () => {
            const health = await adapter.healthCheck();
            expect(health.status).toBe('healthy');
            expect(health.details).toEqual({
                type: 'client_managed',
                message: 'No server-side storage - keys passed in requests',
                supportedProviders: ['anthropic', 'openai', 'google', 'deepseek', 'openrouter']
            });
        });
    });
});
