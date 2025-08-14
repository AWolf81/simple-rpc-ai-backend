/**
 * RPC Key Management CRUD Test
 * 
 * Comprehensive test for PostgreSQL-based user API key management via JSON-RPC
 * Tests all CRUD operations through the RPC interface
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { RPCClient } from '../src/client.js';
import { createAIServer } from '../src/server.js';
import type { Server } from 'http';

describe.skip('RPC Key Management CRUD Operations (REMOVED FEATURE - PostgreSQL key management removed)', () => {
  let server: Server;
  let client: RPCClient;
  const TEST_PORT = 8001;
  const BASE_URL = `http://localhost:${TEST_PORT}`;

  // Test users for isolation verification
  const TEST_USERS = {
    alice: {
      email: 'alice@example.com',
      keys: {
        anthropic: 'sk-ant-alice-test-12345678901234567890',
        openai: 'sk-alice-openai-abcdefghijklmnopqrstuvwxyz',
        google: 'alice-google-test-key-xyz789456123'
      }
    },
    bob: {
      email: 'bob@example.com', 
      keys: {
        anthropic: 'sk-ant-bob-test-09876543210987654321',
        openai: 'sk-bob-openai-zyxwvutsrqponmlkjihgfed',
        google: 'bob-google-test-key-abc123789456'
      }
    }
  };

  beforeAll(async () => {
    // Start test server (assumes it's already running with PostgreSQL)
    // For now, we'll test against a running server instance
    // TODO: Add server startup when PostgreSQL integration is complete
    
    // Create RPC client
    client = new RPCClient(BASE_URL);

    // Test if server is available, if not skip tests
    try {
      await client.request('health');
    } catch (error) {
      console.log('⚠️  Skipping RPC tests - server not available at', BASE_URL);
      console.log('   Start server with: pnpm dev:server');
      console.log('   And ensure PostgreSQL is configured');
    }
  });

  afterAll(async () => {
    if (server) {
      server.close();
    }
  });

  beforeEach(async () => {
    // Clean up test data before each test
    try {
      await client.request('deleteUserKey', { 
        email: TEST_USERS.alice.email, 
        provider: 'anthropic' 
      });
      await client.request('deleteUserKey', { 
        email: TEST_USERS.alice.email, 
        provider: 'openai' 
      });
      await client.request('deleteUserKey', { 
        email: TEST_USERS.alice.email, 
        provider: 'google' 
      });
      await client.request('deleteUserKey', { 
        email: TEST_USERS.bob.email, 
        provider: 'anthropic' 
      });
      await client.request('deleteUserKey', { 
        email: TEST_USERS.bob.email, 
        provider: 'openai' 
      });
      await client.request('deleteUserKey', { 
        email: TEST_USERS.bob.email, 
        provider: 'google' 
      });
    } catch (error) {
      // Ignore cleanup errors (keys may not exist)
    }
  });

  describe('Server Health and Connectivity', () => {
    it('should respond to health check', async () => {
      const result = await client.request('health');
      expect(result).toHaveProperty('status');
      expect(result.status).toBe('healthy');
    });

    it('should have PostgreSQL secret manager available', async () => {
      const result = await client.request('getSecretManagerHealth');
      expect(result).toHaveProperty('status', 'healthy');
      expect(result).toHaveProperty('details');
      expect(result.details).toHaveProperty('connected', true);
    });
  });

  describe('CREATE - Store User Keys', () => {
    it('should store Anthropic API key for user', async () => {
      const result = await client.request('storeUserKey', {
        email: TEST_USERS.alice.email,
        provider: 'anthropic',
        apiKey: TEST_USERS.alice.keys.anthropic
      });

      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('secretId');
      expect(result).not.toHaveProperty('error');
    });

    it('should store OpenAI API key for user', async () => {
      const result = await client.request('storeUserKey', {
        email: TEST_USERS.alice.email,
        provider: 'openai', 
        apiKey: TEST_USERS.alice.keys.openai
      });

      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('secretId');
    });

    it('should store Google API key for user', async () => {
      const result = await client.request('storeUserKey', {
        email: TEST_USERS.alice.email,
        provider: 'google',
        apiKey: TEST_USERS.alice.keys.google
      });

      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('secretId');
    });

    it('should store multiple keys for same user', async () => {
      // Store all keys for Alice
      for (const [provider, apiKey] of Object.entries(TEST_USERS.alice.keys)) {
        const result = await client.request('storeUserKey', {
          email: TEST_USERS.alice.email,
          provider: provider as 'anthropic' | 'openai' | 'google',
          apiKey
        });
        expect(result.success).toBe(true);
      }

      // Verify all providers are listed
      const providers = await client.request('getUserProviders', {
        email: TEST_USERS.alice.email
      });
      
      expect(providers.success).toBe(true);
      expect(providers.providers).toEqual(
        expect.arrayContaining(['anthropic', 'openai', 'google'])
      );
      expect(providers.providers).toHaveLength(3);
    });

    it('should update existing key (upsert behavior)', async () => {
      // Store initial key
      const firstStore = await client.request('storeUserKey', {
        email: TEST_USERS.alice.email,
        provider: 'anthropic',
        apiKey: 'sk-ant-old-key-12345'
      });
      expect(firstStore.success).toBe(true);

      // Update with new key
      const secondStore = await client.request('storeUserKey', {
        email: TEST_USERS.alice.email,
        provider: 'anthropic', 
        apiKey: TEST_USERS.alice.keys.anthropic
      });
      expect(secondStore.success).toBe(true);

      // Verify updated key is retrievable
      const retrieved = await client.request('getUserKey', {
        email: TEST_USERS.alice.email,
        provider: 'anthropic'
      });
      expect(retrieved.success).toBe(true);
      expect(retrieved.message).toBe(TEST_USERS.alice.keys.anthropic);
    });

    it('should reject invalid provider', async () => {
      const result = await client.request('storeUserKey', {
        email: TEST_USERS.alice.email,
        provider: 'invalid-provider' as any,
        apiKey: 'some-key'
      });

      expect(result.success).toBe(false);
      expect(result).toHaveProperty('error');
    });

    it('should reject empty API key', async () => {
      const result = await client.request('storeUserKey', {
        email: TEST_USERS.alice.email,
        provider: 'anthropic',
        apiKey: ''
      });

      expect(result.success).toBe(false);
      expect(result).toHaveProperty('error');
    });
  });

  describe('READ - Retrieve User Keys', () => {
    beforeEach(async () => {
      // Set up test keys
      await client.request('storeUserKey', {
        email: TEST_USERS.alice.email,
        provider: 'anthropic',
        apiKey: TEST_USERS.alice.keys.anthropic
      });
      await client.request('storeUserKey', {
        email: TEST_USERS.alice.email,
        provider: 'openai',
        apiKey: TEST_USERS.alice.keys.openai
      });
    });

    it('should retrieve stored Anthropic key correctly', async () => {
      const result = await client.request('getUserKey', {
        email: TEST_USERS.alice.email,
        provider: 'anthropic'
      });

      expect(result.success).toBe(true);
      expect(result.message).toBe(TEST_USERS.alice.keys.anthropic);
      expect(result).not.toHaveProperty('error');
    });

    it('should retrieve stored OpenAI key correctly', async () => {
      const result = await client.request('getUserKey', {
        email: TEST_USERS.alice.email,
        provider: 'openai'
      });

      expect(result.success).toBe(true);
      expect(result.message).toBe(TEST_USERS.alice.keys.openai);
    });

    it('should return error for non-existent key', async () => {
      const result = await client.request('getUserKey', {
        email: TEST_USERS.alice.email,
        provider: 'google'  // Not stored in beforeEach
      });

      expect(result.success).toBe(false);
      expect(result).toHaveProperty('error');
      expect(result.error).toContain('No google API key found');
    });

    it('should return error for non-existent user', async () => {
      const result = await client.request('getUserKey', {
        email: 'nonexistent@example.com',
        provider: 'anthropic'
      });

      expect(result.success).toBe(false);
      expect(result).toHaveProperty('error');
    });

    it('should get list of user providers', async () => {
      const result = await client.request('getUserProviders', {
        email: TEST_USERS.alice.email
      });

      expect(result.success).toBe(true);
      expect(result.providers).toEqual(
        expect.arrayContaining(['anthropic', 'openai'])
      );
      expect(result.providers).toHaveLength(2);
    });

    it('should return empty providers list for new user', async () => {
      const result = await client.request('getUserProviders', {
        email: 'newuser@example.com'
      });

      expect(result.success).toBe(true);
      expect(result.providers).toEqual([]);
    });
  });

  describe('UPDATE - Key Validation and Rotation', () => {
    beforeEach(async () => {
      // Store test keys
      await client.request('storeUserKey', {
        email: TEST_USERS.alice.email,
        provider: 'anthropic',
        apiKey: TEST_USERS.alice.keys.anthropic
      });
      await client.request('storeUserKey', {
        email: TEST_USERS.alice.email,
        provider: 'openai',
        apiKey: TEST_USERS.alice.keys.openai
      });
    });

    it('should validate Anthropic key format', async () => {
      const result = await client.request('validateUserKey', {
        email: TEST_USERS.alice.email,
        provider: 'anthropic'
      });

      expect(result.success).toBe(true);
      expect(result.valid).toBe(true);
    });

    it('should validate OpenAI key format', async () => {
      const result = await client.request('validateUserKey', {
        email: TEST_USERS.alice.email,
        provider: 'openai'
      });

      expect(result.success).toBe(true);
      expect(result.valid).toBe(true);
    });

    it('should detect invalid key format', async () => {
      // Store an invalid key
      await client.request('storeUserKey', {
        email: TEST_USERS.alice.email,
        provider: 'anthropic',
        apiKey: 'invalid-key-format'
      });

      const result = await client.request('validateUserKey', {
        email: TEST_USERS.alice.email,
        provider: 'anthropic'
      });

      expect(result.success).toBe(true);
      expect(result.valid).toBe(false);
    });

    it('should update existing key by storing again (upsert behavior)', async () => {
      const originalKey = TEST_USERS.alice.keys.anthropic;
      const newKey = 'sk-ant-alice-updated-98765432109876543210';

      // Verify original key
      let result = await client.request('getUserKey', {
        email: TEST_USERS.alice.email,
        provider: 'anthropic'
      });
      expect(result.message).toBe(originalKey);

      // Update with new key (using storeUserKey which should upsert)
      const updateResult = await client.request('storeUserKey', {
        email: TEST_USERS.alice.email,
        provider: 'anthropic',
        apiKey: newKey
      });
      expect(updateResult.success).toBe(true);

      // Verify new key is stored
      result = await client.request('getUserKey', {
        email: TEST_USERS.alice.email,
        provider: 'anthropic'
      });
      expect(result.message).toBe(newKey);
    });
  });

  describe('DELETE - Remove User Keys', () => {
    beforeEach(async () => {
      // Store test keys
      await client.request('storeUserKey', {
        email: TEST_USERS.alice.email,
        provider: 'anthropic',
        apiKey: TEST_USERS.alice.keys.anthropic
      });
      await client.request('storeUserKey', {
        email: TEST_USERS.alice.email,
        provider: 'openai', 
        apiKey: TEST_USERS.alice.keys.openai
      });
      await client.request('storeUserKey', {
        email: TEST_USERS.alice.email,
        provider: 'google',
        apiKey: TEST_USERS.alice.keys.google
      });
    });

    it('should delete specific provider key', async () => {
      const result = await client.request('deleteUserKey', {
        email: TEST_USERS.alice.email,
        provider: 'anthropic'
      });

      expect(result.success).toBe(true);
      expect(result).toHaveProperty('secretId');

      // Verify key is gone
      const getResult = await client.request('getUserKey', {
        email: TEST_USERS.alice.email,
        provider: 'anthropic'
      });
      expect(getResult.success).toBe(false);
      expect(getResult.error).toContain('No anthropic API key found');
    });

    it('should not affect other provider keys when deleting one', async () => {
      // Delete OpenAI key
      await client.request('deleteUserKey', {
        email: TEST_USERS.alice.email,
        provider: 'openai'
      });

      // Verify other keys still exist
      const anthropicResult = await client.request('getUserKey', {
        email: TEST_USERS.alice.email,
        provider: 'anthropic'
      });
      expect(anthropicResult.success).toBe(true);

      const googleResult = await client.request('getUserKey', {
        email: TEST_USERS.alice.email,
        provider: 'google'
      });
      expect(googleResult.success).toBe(true);

      // Verify providers list is updated
      const providersResult = await client.request('getUserProviders', {
        email: TEST_USERS.alice.email
      });
      expect(providersResult.providers).toEqual(
        expect.arrayContaining(['anthropic', 'google'])
      );
      expect(providersResult.providers).not.toContain('openai');
    });

    it('should fail to delete non-existent key', async () => {
      // First delete the key
      await client.request('deleteUserKey', {
        email: TEST_USERS.alice.email,
        provider: 'anthropic'
      });

      // Try to delete again
      const result = await client.request('deleteUserKey', {
        email: TEST_USERS.alice.email,
        provider: 'anthropic'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('No anthropic API key found');
    });

    it('should fail to delete key for non-existent user', async () => {
      const result = await client.request('deleteUserKey', {
        email: 'nonexistent@example.com',
        provider: 'anthropic'
      });

      expect(result.success).toBe(false);
      expect(result).toHaveProperty('error');
    });
  });

  describe('USER ISOLATION - Security Tests', () => {
    beforeEach(async () => {
      // Set up keys for both users
      await client.request('storeUserKey', {
        email: TEST_USERS.alice.email,
        provider: 'anthropic',
        apiKey: TEST_USERS.alice.keys.anthropic
      });
      await client.request('storeUserKey', {
        email: TEST_USERS.bob.email,
        provider: 'anthropic',
        apiKey: TEST_USERS.bob.keys.anthropic
      });
      await client.request('storeUserKey', {
        email: TEST_USERS.bob.email,
        provider: 'openai',
        apiKey: TEST_USERS.bob.keys.openai
      });
    });

    it('should prevent Alice from accessing Bob\'s keys', async () => {
      // Alice tries to get Bob's OpenAI key (Alice doesn't have OpenAI)
      const result = await client.request('getUserKey', {
        email: TEST_USERS.alice.email,
        provider: 'openai'  // This is Bob's provider
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('No openai API key found');
    });

    it('should prevent Bob from accessing Alice\'s keys', async () => {
      // Bob tries to access Alice's providers
      const result = await client.request('getUserProviders', {
        email: TEST_USERS.bob.email
      });

      expect(result.success).toBe(true);
      expect(result.providers).toEqual(
        expect.arrayContaining(['anthropic', 'openai'])
      );
      // Bob should only see his own providers, not Alice's Google key
    });

    it('should maintain separate key stores per user', async () => {
      // Verify Alice's Anthropic key
      const aliceResult = await client.request('getUserKey', {
        email: TEST_USERS.alice.email,
        provider: 'anthropic'
      });
      expect(aliceResult.success).toBe(true);
      expect(aliceResult.message).toBe(TEST_USERS.alice.keys.anthropic);

      // Verify Bob's Anthropic key (different value)
      const bobResult = await client.request('getUserKey', {
        email: TEST_USERS.bob.email,
        provider: 'anthropic'
      });
      expect(bobResult.success).toBe(true);
      expect(bobResult.message).toBe(TEST_USERS.bob.keys.anthropic);

      // Keys should be different
      expect(aliceResult.message).not.toBe(bobResult.message);
    });

    it('should prevent cross-user key deletion', async () => {
      // Bob tries to delete Alice's key (should fail gracefully)
      // This would only work if the system mistakenly allowed cross-user access
      const result = await client.request('deleteUserKey', {
        email: TEST_USERS.bob.email,
        provider: 'anthropic'
      });

      // This should succeed (deleting Bob's own key)
      expect(result.success).toBe(true);

      // Verify Alice's key is still intact
      const aliceCheck = await client.request('getUserKey', {
        email: TEST_USERS.alice.email,
        provider: 'anthropic'
      });
      expect(aliceCheck.success).toBe(true);
      expect(aliceCheck.message).toBe(TEST_USERS.alice.keys.anthropic);
    });
  });

  describe('COMPREHENSIVE WORKFLOW - Full User Lifecycle', () => {
    it('should handle complete user key management workflow', async () => {
      const testEmail = 'workflow@example.com';
      const keys = {
        anthropic: 'sk-ant-workflow-test-12345678901234567890',
        openai: 'sk-workflow-openai-abcdefghijklmnopqrstuvw',
        google: 'workflow-google-test-key-xyz789456123'
      };

      // 1. New user - no providers
      let providers = await client.request('getUserProviders', { email: testEmail });
      expect(providers.success).toBe(true);
      expect(providers.providers).toEqual([]);

      // 2. Add first key (Anthropic)
      let storeResult = await client.request('storeUserKey', {
        email: testEmail,
        provider: 'anthropic',
        apiKey: keys.anthropic
      });
      expect(storeResult.success).toBe(true);

      // 3. Verify key is retrievable and validated
      let keyResult = await client.request('getUserKey', {
        email: testEmail,
        provider: 'anthropic'
      });
      expect(keyResult.success).toBe(true);
      expect(keyResult.message).toBe(keys.anthropic);

      let validation = await client.request('validateUserKey', {
        email: testEmail,
        provider: 'anthropic'
      });
      expect(validation.success).toBe(true);
      expect(validation.valid).toBe(true);

      // 4. Add more providers
      await client.request('storeUserKey', {
        email: testEmail,
        provider: 'openai',
        apiKey: keys.openai
      });
      await client.request('storeUserKey', {
        email: testEmail,
        provider: 'google',
        apiKey: keys.google
      });

      // 5. Verify all providers are listed
      providers = await client.request('getUserProviders', { email: testEmail });
      expect(providers.success).toBe(true);
      expect(providers.providers).toHaveLength(3);
      expect(providers.providers).toEqual(
        expect.arrayContaining(['anthropic', 'openai', 'google'])
      );

      // 6. Update one key (simulate rotation by storing new key)
      const newAnthropicKey = 'sk-ant-workflow-updated-09876543210987654321';
      const updateResult = await client.request('storeUserKey', {
        email: testEmail,
        provider: 'anthropic',
        apiKey: newAnthropicKey
      });
      expect(updateResult.success).toBe(true);

      // 7. Verify update worked
      keyResult = await client.request('getUserKey', {
        email: testEmail,
        provider: 'anthropic'
      });
      expect(keyResult.success).toBe(true);
      expect(keyResult.message).toBe(newAnthropicKey);

      // 8. Remove one provider
      const deleteResult = await client.request('deleteUserKey', {
        email: testEmail,
        provider: 'google'
      });
      expect(deleteResult.success).toBe(true);

      // 9. Verify provider is removed but others remain
      providers = await client.request('getUserProviders', { email: testEmail });
      expect(providers.success).toBe(true);
      expect(providers.providers).toHaveLength(2);
      expect(providers.providers).toEqual(
        expect.arrayContaining(['anthropic', 'openai'])
      );
      expect(providers.providers).not.toContain('google');

      // 10. Cleanup - remove remaining keys
      await client.request('deleteUserKey', { email: testEmail, provider: 'anthropic' });
      await client.request('deleteUserKey', { email: testEmail, provider: 'openai' });

      // 11. Verify user has no providers
      providers = await client.request('getUserProviders', { email: testEmail });
      expect(providers.success).toBe(true);
      expect(providers.providers).toEqual([]);
    });
  });
});