import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { RPCClient } from '../src/client.js';
import { PostgreSQLRPCMethods } from '../src/auth/PostgreSQLRPCMethods.js';
import express from 'express';
import type { Server } from 'http';
import { PostgreSQLConfig } from '../src/services/PostgreSQLSecretManager.js';
import { PostgreSqlContainer } from '@testcontainers/postgresql';

const TEST_USERS = {
  alice: {
    email: 'alice@example.com',
    keys: {
      openai: 'sk-openai-alice',
      anthropic: 'sk-ant-alice-test-12345678901234567890',
      google: 'sk-google-alice'
    }
  },
  bob: {
    email: 'bob@example.com',
    keys: {
      openai: 'sk-openai-bob',
      anthropic: 'sk-ant-bob'
    }
  }
};

let server: Server;
let rpcClient: RPCClient;
let rpcMethods: PostgreSQLRPCMethods;
let container: PostgreSqlContainer;

beforeAll(async () => {
  // Start PostgreSQL test container
  container = await new PostgreSqlContainer()
    .withDatabase('testdb')
    .withUsername('testuser')
    .withPassword('testpass')
    .start();

  const config: PostgreSQLConfig = {
    host: container.getHost(),
    port: container.getPort(),
    database: container.getDatabase(),
    user: container.getUsername(),
    password: container.getPassword()
  };
  const encryptionKey = 'test-encryption-key-32-characters!';

  rpcMethods = new PostgreSQLRPCMethods(config, encryptionKey);
  await rpcMethods.initialize();

  const app = express();
  app.use(express.json());

  app.post('/rpc', async (req, res) => {
    try {
      const { method, params, id } = req.body;
      
      // Handle JSON-RPC methods for key management
      switch (method) {
        case 'storeUserKey':
          const storeResult = await rpcMethods.storeUserKey(params);
          return res.json({
            jsonrpc: '2.0',
            id,
            result: storeResult
          });
          
        case 'getUserKey':
          const getResult = await rpcMethods.getUserKey(params);
          return res.json({
            jsonrpc: '2.0',
            id,
            result: getResult
          });
          
        case 'getUserProviders':
          const providersResult = await rpcMethods.getUserProviders(params);
          return res.json({
            jsonrpc: '2.0',
            id,
            result: providersResult
          });
          
        case 'rotateUserKey':
          const rotateResult = await rpcMethods.rotateUserKey(params);
          return res.json({
            jsonrpc: '2.0',
            id,
            result: rotateResult
          });
          
        case 'deleteUserKey':
          const deleteResult = await rpcMethods.deleteUserKey(params);
          return res.json({
            jsonrpc: '2.0',
            id,
            result: deleteResult
          });
          
        case 'validateUserKey':
          const validateResult = await rpcMethods.validateUserKey(params);
          return res.json({
            jsonrpc: '2.0',
            id,
            result: validateResult
          });
          
        default:
          return res.json({
            jsonrpc: '2.0',
            id,
            error: {
              code: -32601,
              message: `Method not found: ${method}`
            }
          });
      }
    } catch (error) {
      return res.status(500).json({
        jsonrpc: '2.0',
        id: req.body?.id || null,
        error: {
          code: -32603,
          message: `Internal error: ${error instanceof Error ? error.message : 'Unknown error'}`
        }
      });
    }
  });

  server = app.listen(0);
  const port = (server.address() as any).port;
  rpcClient = new RPCClient(`http://localhost:${port}/rpc`);
});

afterAll(async () => {
  await rpcMethods.cleanup();
  server.close();
  await container.stop();
});

beforeEach(async () => {
  // Reset database for clean test state
  await rpcMethods.resetForTesting();

  // Prepopulate test keys
  for (const user of Object.values(TEST_USERS)) {
    for (const [provider, key] of Object.entries(user.keys)) {
      await rpcMethods.storeUserKey({ email: user.email, provider: provider as any, apiKey: key });
    }
  }
});

describe.skip('PostgreSQLRPCMethods RPC tests (requires Docker)', () => {
  it('should retrieve a key', async () => {
    const res = await rpcClient.request('getUserKey', { email: TEST_USERS.alice.email, provider: 'anthropic' });
    expect(res.success).toBe(true);
    expect(res.message).toBe(TEST_USERS.alice.keys.anthropic);
  });

  it('should upsert a key', async () => {
    const newKey = 'sk-ant-alice-upserted';
    await rpcClient.request('storeUserKey', { email: TEST_USERS.alice.email, provider: 'anthropic', apiKey: newKey });
    const res = await rpcClient.request('getUserKey', { email: TEST_USERS.alice.email, provider: 'anthropic' });
    expect(res.message).toBe(newKey);
  });

  it('should list user providers', async () => {
    const res = await rpcClient.request('getUserProviders', { email: TEST_USERS.alice.email });
    expect(res.success).toBe(true);
    expect(res.providers).toContain('openai');
    expect(res.providers).toContain('google');
    expect(res.providers).toContain('anthropic');
  });

  it('should rotate a key', async () => {
    const newKey = 'sk-new-openai-key';
    await rpcClient.request('rotateUserKey', { email: TEST_USERS.alice.email, provider: 'openai', newApiKey: newKey });
    const res = await rpcClient.request('getUserKey', { email: TEST_USERS.alice.email, provider: 'openai' });
    expect(res.message).toBe(newKey);
  });

  it('should isolate users', async () => {
    const aliceKey = (await rpcClient.request('getUserKey', { email: TEST_USERS.alice.email, provider: 'openai' })).message;
    const bobKey = (await rpcClient.request('getUserKey', { email: TEST_USERS.bob.email, provider: 'openai' })).message;
    expect(aliceKey).not.toBe(bobKey);
  });
});
