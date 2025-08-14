/**
 * Flexible Storage Examples
 * 
 * Demonstrates all three storage options:
 * - Vaultwarden (Enterprise)
 * - File-based (Development)
 * - Client-managed (VS Code Integration)
 */

import { StorageFactory } from '../src/storage/StorageFactory.js';
import { createEnhancedRpcMethods } from '../src/rpc/enhancedRpcMethods.js';
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.simple(),
  transports: [new winston.transports.Console()]
});

// Example 1: Enterprise Vaultwarden Storage
export async function createVaultwardenServer() {
  console.log('🏢 Creating Enterprise Vaultwarden Server...');
  
  const storage = await StorageFactory.createStorage({
    type: 'vaultwarden',
    config: {
      serverUrl: process.env.VW_DOMAIN || 'http://localhost:8080',
      serviceEmail: process.env.VW_SERVICE_EMAIL,
      servicePassword: process.env.VW_SERVICE_PASSWORD,
      organizationId: process.env.SIMPLE_RPC_ORG_ID
    }
  }, logger);

  const rpcMethods = createEnhancedRpcMethods({
    storageAdapter: storage,
    logger,
    config: {
      requireAuth: true,
      allowDirectKeyPassing: false  // Keys stored in Vaultwarden
    }
  });

  return { storage, rpcMethods };
}

// Example 2: Simple File Storage
export async function createFileStorageServer() {
  console.log('📁 Creating File Storage Server...');
  
  const storage = await StorageFactory.createStorage({
    type: 'file',
    config: {
      path: './data/api-keys.encrypted.json',
      masterKey: process.env.MASTER_KEY || 'dev-key-change-in-production'
    }
  }, logger);

  const rpcMethods = createEnhancedRpcMethods({
    storageAdapter: storage,
    logger,
    config: {
      requireAuth: false,
      allowDirectKeyPassing: true  // Allow both stored and direct keys
    }
  });

  return { storage, rpcMethods };
}

// Example 3: Client-Managed Storage (VS Code Style)
export async function createClientManagedServer() {
  console.log('🔑 Creating Client-Managed Server...');
  
  const storage = await StorageFactory.createStorage({
    type: 'client_managed'
  }, logger);

  const rpcMethods = createEnhancedRpcMethods({
    storageAdapter: storage,
    logger,
    config: {
      requireAuth: false,
      allowDirectKeyPassing: true  // Keys must be passed in requests
    }
  });

  return { storage, rpcMethods };
}

// Example 4: Auto-Detection from Environment
export async function createAutoDetectedServer() {
  console.log('🔍 Auto-detecting storage from environment...');
  
  const storage = await StorageFactory.createFromEnvironment(logger);

  const rpcMethods = createEnhancedRpcMethods({
    storageAdapter: storage,
    logger,
    config: {
      requireAuth: storage.getType() === 'vaultwarden',
      allowDirectKeyPassing: true
    }
  });

  return { storage, rpcMethods };
}

// Demo Usage
async function demonstrateUsage() {
  console.log('🚀 Demonstrating Flexible Storage Usage\n');

  try {
    // Auto-detect storage type
    const { storage, rpcMethods } = await createAutoDetectedServer();
    
    console.log(`✅ Created server with ${storage.getType()} storage\n`);

    // Test health check
    const health = await rpcMethods.health();
    console.log('Health Check:', JSON.stringify(health, null, 2));

    // Test storage info
    const storageInfo = await rpcMethods.getStorageInfo();
    console.log('\nStorage Info:', JSON.stringify(storageInfo, null, 2));

    // Demonstrate different request patterns based on storage type
    if (storage.getType() === 'client_managed') {
      console.log('\n🔑 Client-Managed Example:');
      
      // Must pass API key in request
      const result = await rpcMethods.executeAIRequest({
        content: 'function add(a, b) { return a + b; }',
        systemPrompt: 'security_review',
        apiKey: 'sk-demo-api-key-for-testing'
      });
      
      console.log('AI Request Result:', JSON.stringify(result, null, 2));
      
    } else {
      console.log(`\n📦 ${storage.getType()} Storage Example:`);
      
      // Store a key first (if supported)
      const storeResult = await rpcMethods.storeApiKey({
        provider: 'anthropic',
        apiKey: 'claude-demo-api-key'
      });
      
      console.log('Store Key Result:', JSON.stringify(storeResult, null, 2));
      
      // Then use it
      if (storeResult.success) {
        const result = await rpcMethods.executeAIRequest({
          content: 'function add(a, b) { return a + b; }',
          systemPrompt: 'security_review'
        });
        
        console.log('AI Request Result:', JSON.stringify(result, null, 2));
      }
    }

    // Test provider listing
    const providers = await rpcMethods.listProviders({});
    console.log('\nProviders:', JSON.stringify(providers, null, 2));

  } catch (error) {
    console.error('Demo failed:', error.message);
  }
}

// Run demo if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  demonstrateUsage();
}

export { demonstrateUsage };