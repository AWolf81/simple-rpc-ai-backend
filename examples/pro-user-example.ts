/**
 * Pro User Server-Side API Key Example
 * 
 * Demonstrates how Pro users use server-provided API keys
 * while Free users use BYOK (Bring Your Own Key)
 */

import { SecureVaultManager } from '../src/auth/SecureVaultManager.js';

// Server setup with Pro user API keys
async function setupServerWithProKeys() {
  console.log('🏢 Setting up server with Pro user API keys\n');

  const vaultManager = new SecureVaultManager({
    bitwardenConfig: {
      serverUrl: 'http://localhost:8081',
      serviceEmail: 'service@company.com', 
      servicePassword: 'secure-password'
    },
    databaseMasterKey: process.env.DATABASE_MASTER_KEY!, // 64-char hex
    userBridge: {}, // UserIdentityBridge instance
    
    // 🔑 Pro user server-side API keys
    proUserConfig: {
      anthropicApiKey: process.env.SERVER_ANTHROPIC_KEY, // Company's Anthropic key
      openaiApiKey: process.env.SERVER_OPENAI_KEY,       // Company's OpenAI key  
      googleApiKey: process.env.SERVER_GOOGLE_KEY        // Company's Google key
    }
  });

  return vaultManager;
}

// Example: Free user flow (BYOK)
async function demonstrateFreeUserFlow(vaultManager: SecureVaultManager) {
  console.log('🆓 Free User Flow (BYOK)\n');

  // Free user JWT (no subscription tier or tier: 'free')
  const freeUserJWT = createMockJWT({
    userId: 'user-free-123',
    email: 'freelancer@gmail.com',
    subscriptionTier: 'free' // or undefined
  });

  try {
    // Step 1: Free user must store their own API key
    console.log('1️⃣ Free user stores their own API key...');
    await vaultManager.storeApiKey(
      freeUserJWT,
      'sk-ant-user-own-key-12345', // User's personal API key
      'anthropic'
    );
    console.log('✅ API key stored in encrypted vault');

    // Step 2: Free user can now make AI requests
    console.log('2️⃣ Free user makes AI request...');
    const result = await vaultManager.executeAIRequestWithAutoKey(
      freeUserJWT,
      'function validateInput(input) { return input; }',
      'security_review',
      'anthropic'
    );
    console.log('✅ AI request executed using user\'s own key');

  } catch (error) {
    console.error('❌ Free user flow failed:', error.message);
  }
}

// Example: Pro user flow (Server keys)
async function demonstrateProUserFlow(vaultManager: SecureVaultManager) {
  console.log('\n💎 Pro User Flow (Server Keys)\n');

  // Pro user JWT
  const proUserJWT = createMockJWT({
    userId: 'user-pro-456',
    email: 'executive@company.com', 
    subscriptionTier: 'pro'
  });

  try {
    // Pro user can make AI requests immediately - no key storage needed!
    console.log('🚀 Pro user makes AI request immediately...');
    const result = await vaultManager.executeAIRequestWithAutoKey(
      proUserJWT,
      'const api = express(); api.use(cors());',
      'security_review',
      'anthropic'
    );
    console.log('✅ AI request executed using server-provided key');
    console.log('💡 Pro user never needed to store an API key!');

  } catch (error) {
    console.error('❌ Pro user flow failed:', error.message);
  }
}

// Example: OAuth2 as primary auth
async function demonstrateOAuth2Primary(vaultManager: SecureVaultManager) {
  console.log('\n🔗 OAuth2 as Primary Authentication\n');

  // User signs up directly with Google OAuth2 (no email/password account)
  const googleOAuthJWT = createMockJWT({
    // No userId - Google OAuth2 is primary
    googleId: 'google-oauth-primary-789',
    email: 'developer@gmail.com',
    subscriptionTier: 'free'
  });

  try {
    console.log('1️⃣ User with Google OAuth2 as primary auth stores API key...');
    await vaultManager.storeApiKey(
      googleOAuthJWT,
      'sk-ant-google-user-key-789',
      'anthropic'
    );
    console.log('✅ User onboarded with primaryUserId: google:google-oauth-primary-789');

    console.log('2️⃣ Same user makes AI request...');
    const result = await vaultManager.executeAIRequestWithAutoKey(
      googleOAuthJWT,
      'import React from "react";',
      'code_quality',
      'anthropic'
    );
    console.log('✅ AI request successful with OAuth2 primary identity');

  } catch (error) {
    console.error('❌ OAuth2 primary flow failed:', error.message);
  }
}

// Example: Enterprise user with multiple auth methods
async function demonstrateEnterpriseUser(vaultManager: SecureVaultManager) {
  console.log('\n🏢 Enterprise User (Multiple Auth Methods)\n');

  // Enterprise user starts with SSO
  const ssoJWT = createMockJWT({
    employee_id: 'EMP123456',
    email: 'john.doe@enterprise.com',
    subscriptionTier: 'enterprise',
    department: 'engineering'
  });

  try {
    console.log('1️⃣ Enterprise user (SSO) makes AI request...');
    const result1 = await vaultManager.executeAIRequestWithAutoKey(
      ssoJWT,
      'SELECT * FROM sensitive_data;',
      'security_review', 
      'anthropic'
    );
    console.log('✅ Enterprise user uses server key (no setup required)');

    // Later, same user authenticates via GitHub OAuth
    const githubJWT = createMockJWT({
      employee_id: 'EMP123456', // Same employee
      githubId: 'github-enterprise-john',
      email: 'john.doe@enterprise.com',
      subscriptionTier: 'enterprise'
    });

    console.log('2️⃣ Same user now authenticates via GitHub OAuth...');
    const result2 = await vaultManager.executeAIRequestWithAutoKey(
      githubJWT,
      'terraform apply -auto-approve',
      'security_review',
      'anthropic'
    );
    console.log('✅ Same user, same server key, different auth method!');

  } catch (error) {
    console.error('❌ Enterprise user flow failed:', error.message);
  }
}

// Helper function to create mock JWTs
function createMockJWT(payload: any): string {
  // In real implementation, this would be a proper signed JWT
  return Buffer.from(JSON.stringify({
    iss: 'https://auth.company.com',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
    ...payload
  })).toString('base64');
}

// Example: Error scenarios
async function demonstrateErrorScenarios(vaultManager: SecureVaultManager) {
  console.log('\n🚨 Error Scenarios\n');

  const freeUserJWT = createMockJWT({
    userId: 'user-no-key-999',
    email: 'newuser@gmail.com',
    subscriptionTier: 'free'
  });

  try {
    console.log('❌ Free user tries AI request without storing API key...');
    await vaultManager.executeAIRequestWithAutoKey(
      freeUserJWT,
      'console.log("hello");',
      'code_review',
      'anthropic'
    );
  } catch (error) {
    console.log('✅ Correct error:', error.message);
    console.log('💡 Free users must store API key first!');
  }
}

// Run all examples
if (require.main === module) {
  console.log('🚀 Pro User vs Free User Examples\n');
  
  setupServerWithProKeys()
    .then(vaultManager => {
      return Promise.all([
        demonstrateFreeUserFlow(vaultManager),
        demonstrateProUserFlow(vaultManager), 
        demonstrateOAuth2Primary(vaultManager),
        demonstrateEnterpriseUser(vaultManager),
        demonstrateErrorScenarios(vaultManager)
      ]);
    })
    .then(() => console.log('\n✨ All examples completed!'))
    .catch(error => console.error('💥 Error:', error));
}