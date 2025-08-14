/**
 * Example: Improved Vaultwarden Auth Flow
 * 
 * Demonstrates the complete implementation with:
 * - One Vaultwarden account per OpenSaaS user
 * - Automatic onboarding via RPC
 * - Short-lived tokens
 * - Client-side decryption
 */

const { createAIServer } = require('simple-rpc-ai-backend');
const { RPCClient } = require('simple-rpc-ai-backend');
const crypto = require('crypto');

// Example server configuration with improved Vaultwarden auth flow
const config = {
  port: 8000,
  mode: 'hybrid',
  
  // Enable Vaultwarden auto-provisioning
  vaultwarden: {
    enabled: true,
    serverUrl: 'https://vault.company.com',
    serviceEmail: 'rpc-service@company.com',
    servicePassword: process.env.VAULTWARDEN_SERVICE_PASSWORD,
    clientId: process.env.VAULTWARDEN_CLIENT_ID,
    clientSecret: process.env.VAULTWARDEN_CLIENT_SECRET
  },
  
  serviceProviders: {
    anthropic: {
      apiKey: process.env.ANTHROPIC_API_KEY
    }
  }
};

// Start server
const server = createAIServer(config);
server.start(8000);

console.log('🔐 Improved Vaultwarden Auth Flow Server Started');
console.log('📋 Available RPC Methods:');
console.log('   • vaultwarden.onboardUser - Step 1-3: Automatic account provisioning');
console.log('   • vaultwarden.completeSetup - Step 4: Client-side master key setup');
console.log('   • vaultwarden.getShortLivedToken - Generate access tokens');
console.log('   • vaultwarden.storeEncryptedKey - Store client-encrypted API keys');
console.log('   • vaultwarden.retrieveEncryptedKey - Retrieve encrypted keys for decryption');
console.log('   • vaultwarden.getAccountStatus - Check provisioning status');

// Example client usage demonstrating the complete flow
async function demonstrateImprovedAuthFlow() {
  const client = new RPCClient('http://localhost:8000');
  
  // Simulate OpenSaaS JWT (in production, this comes from your auth system)
  const mockOpenSaaSJWT = createMockJWT({
    userId: 'opensaas_user_12345',
    email: 'developer@company.com',
    subscriptionTier: 'pro',
    organizationId: 'org_abc123'
  });
  
  console.log('\n🚀 Starting Improved Vaultwarden Auth Flow Demo');
  
  try {
    // Step 1-3: Automatic onboarding
    console.log('\n📋 Step 1-3: Onboarding user and generating setup token');
    const onboardingResult = await client.request('vaultwarden.onboardUser', {
      opensaasJWT: mockOpenSaaSJWT
    });
    
    console.log('✅ Onboarding successful:');
    console.log(`   Setup Token: ${onboardingResult.setupToken.substring(0, 20)}...`);
    console.log(`   Vaultwarden User: ${onboardingResult.vaultwardenUserId}`);
    console.log(`   Expires: ${onboardingResult.expiresAt}`);
    
    // Step 4: Client-side master key setup
    console.log('\n🔑 Step 4: Client-side master key derivation and account setup');
    
    // In a real VS Code extension, this would be done securely:
    const masterPassword = 'user-secure-master-password-123!';
    const masterPasswordHash = simulateClientSideMasterPasswordHash(masterPassword);
    
    const setupResult = await client.request('vaultwarden.completeSetup', {
      setupToken: onboardingResult.setupToken,
      masterPasswordHash: masterPasswordHash.hash,
      // Optional: additional encrypted private key
      encryptedPrivateKey: 'encrypted_private_key_data'
    });
    
    console.log('✅ Account setup completed:');
    console.log(`   Success: ${setupResult.success}`);
    console.log(`   Message: ${setupResult.message}`);
    
    // Step 5: Store encrypted API key (client-side encryption)
    console.log('\n💾 Step 5: Storing client-encrypted API key');
    
    const apiKey = 'sk-ant-api03-abc123...'; // Real Anthropic API key
    const encryptedApiKey = simulateClientSideEncryption(apiKey, masterPassword);
    
    const storeResult = await client.request('vaultwarden.storeEncryptedKey', {
      opensaasJWT: mockOpenSaaSJWT,
      encryptedApiKey: encryptedApiKey.ciphertext,
      provider: 'anthropic',
      keyMetadata: {
        algorithm: 'AES-256-GCM',
        keyId: 'anthropic_key_1',
        createdAt: new Date().toISOString()
      }
    });
    
    console.log('✅ API key stored:');
    console.log(`   Key ID: ${storeResult.keyId}`);
    console.log(`   Message: ${storeResult.message}`);
    
    // Normal operation: Get short-lived token
    console.log('\n🎫 Normal Operation: Getting short-lived access token');
    
    const tokenResult = await client.request('vaultwarden.getShortLivedToken', {
      opensaasJWT: mockOpenSaaSJWT
    });
    
    console.log('✅ Short-lived token generated:');
    console.log(`   Token: ${tokenResult.accessToken.substring(0, 20)}...`);
    console.log(`   Expires: ${tokenResult.expiresAt}`);
    
    // Normal operation: Retrieve and decrypt API key
    console.log('\n🔓 Normal Operation: Retrieving and decrypting API key');
    
    const retrieveResult = await client.request('vaultwarden.retrieveEncryptedKey', {
      shortLivedToken: tokenResult.accessToken,
      provider: 'anthropic'
    });
    
    console.log('✅ Encrypted key retrieved from Vaultwarden');
    console.log(`   Algorithm: ${retrieveResult.keyMetadata.algorithm}`);
    console.log(`   Key ID: ${retrieveResult.keyMetadata.keyId}`);
    
    // Client-side decryption (would happen in VS Code extension)
    const decryptedApiKey = simulateClientSideDecryption({
      ciphertext: retrieveResult.encryptedApiKey,
      ...encryptedApiKey // Contains iv, salt, tag from original encryption
    }, masterPassword);
    
    console.log('🔓 Key decrypted client-side (would happen in extension)');
    console.log(`   Decrypted Key: ${decryptedApiKey.substring(0, 15)}...`);
    
    // Use the decrypted key for AI request
    console.log('\n🤖 Using decrypted key for AI request');
    
    const aiResult = await client.request('executeAIRequest', {
      content: 'Hello, how are you?',
      systemPrompt: 'You are a helpful assistant.',
      // In production, the system would use the user's decrypted key
    });
    
    console.log('✅ AI request completed successfully');
    console.log(`   Response: ${aiResult.result.substring(0, 100)}...`);
    
    // Check account status
    console.log('\n📊 Checking account status');
    const statusResult = await client.request('vaultwarden.getAccountStatus', {
      opensaasJWT: mockOpenSaaSJWT
    });
    
    console.log('✅ Account status:');
    console.log(`   Provisioned: ${statusResult.isProvisioned}`);
    console.log(`   Needs Setup: ${statusResult.needsSetup}`);
    console.log(`   Created: ${statusResult.accountCreated}`);
    
  } catch (error) {
    console.error('❌ Demo failed:', error.message);
  }
}

// Helper functions to simulate client-side operations
function createMockJWT(payload) {
  // In production, this would be a real JWT from OpenSaaS
  const header = { typ: 'JWT', alg: 'HS256' };
  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
  const encodedPayload = Buffer.from(JSON.stringify({
    ...payload,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600
  })).toString('base64url');
  
  return `${encodedHeader}.${encodedPayload}.mock_signature`;
}

function simulateClientSideMasterPasswordHash(password) {
  // Simulate Argon2id or PBKDF2 key derivation (client-side)
  const salt = crypto.randomBytes(32);
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha256').toString('hex');
  
  return {
    hash,
    salt: salt.toString('hex')
  };
}

function simulateClientSideEncryption(apiKey, masterPassword) {
  // Simulate AES-256-GCM encryption (client-side)
  const salt = crypto.randomBytes(32);
  const masterKey = crypto.pbkdf2Sync(masterPassword, salt, 100000, 32, 'sha256');
  const encryptionKey = crypto.pbkdf2Sync(masterKey, salt, 1000, 32, 'sha256');
  
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipher('aes-256-gcm', encryptionKey, iv);
  
  let ciphertext = cipher.update(apiKey, 'utf8', 'hex');
  ciphertext += cipher.final('hex');
  const tag = cipher.getAuthTag();
  
  return {
    ciphertext,
    iv: iv.toString('hex'),
    salt: salt.toString('hex'),
    tag: tag.toString('hex'),
    algorithm: 'AES-256-GCM'
  };
}

function simulateClientSideDecryption(encryptedData, masterPassword) {
  // Simulate AES-256-GCM decryption (client-side)
  const salt = Buffer.from(encryptedData.salt, 'hex');
  const masterKey = crypto.pbkdf2Sync(masterPassword, salt, 100000, 32, 'sha256');
  const encryptionKey = crypto.pbkdf2Sync(masterKey, salt, 1000, 32, 'sha256');
  
  const iv = Buffer.from(encryptedData.iv, 'hex');
  const tag = Buffer.from(encryptedData.tag, 'hex');
  
  // Note: This is a simplified version - actual implementation needs proper GCM handling
  const decipher = crypto.createDecipher('aes-256-gcm', encryptionKey, iv);
  decipher.setAuthTag(tag);
  
  let decrypted = decipher.update(encryptedData.ciphertext, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

// Run the demo after a short delay to let server start
setTimeout(demonstrateImprovedAuthFlow, 2000);

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down server...');
  server.stop();
  process.exit(0);
});
