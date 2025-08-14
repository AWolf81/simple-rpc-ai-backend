import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { RPCClient } from '../src/client.js';
import { PostgreSQLRPCMethods } from '../src/auth/PostgreSQLRPCMethods.js';
import express from 'express';
import type { Server } from 'http';
import { PostgreSQLConfig } from '../src/services/PostgreSQLSecretManager.js';

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

beforeAll(async () => {
  const config: PostgreSQLConfig = {
    host: 'localhost',
    port: 5432,
    database: 'testdb',
    user: 'user',
    password: 'pass'
  };
  const encryptionKey = 'test-encryption-key';

  rpcMethods = new PostgreSQLRPCMethods(config, encryptionKey);
  await rpcMethods.initialize();

  const app = express();
  app.use(express.json());

  // app.post('/rpc', async (req, res) => {
  //   const { method, params } = req.body;
  //   const fn = (rpcMethods as any)[method];
  //   if (typeof fn === 'function') {
  //     const result = await fn.call(rpcMethods, params);
  //     res.json(result);
  //   } else {
  //     res.status(400).json({ error: 'Unknown method' });
  //   }
  // });

  server = app.listen(0);
  const port = (server.address() as any).port;
  rpcClient = new RPCClient(`http://localhost:${port}/rpc`);
});

afterAll(async () => {
  await rpcMethods.cleanup();
  server.close();
});

beforeEach(async () => {
  // Reset DB if possible, then prepopulate test keys
  // if (rpcMethods.secretManager.resetDB) { // <<<<<<<<<<<<<< how to fix secretManager is private and should be private!
  //   await rpcMethods.secretManager.resetDB();
  // }

  for (const user of Object.values(TEST_USERS)) {
    for (const [provider, key] of Object.entries(user.keys)) {
      await rpcMethods.storeUserKey({ email: user.email, provider: provider as any, apiKey: key });
    }
  }
});

describe.skip('PostgreSQLRPCMethods RPC tests', () => {
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
