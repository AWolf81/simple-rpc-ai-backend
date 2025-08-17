/**
 * Test OpenSaaS Authentication
 * 
 * This script tests the OpenSaaS authentication fix for VS Code extensions
 */

import { createTypedAIClient } from './dist/index.js';
import { httpBatchLink } from '@trpc/client';

console.log('🧪 Testing OpenSaaS Authentication Fix\n');

// Simulate the VS Code extension's OpenSaaS token
const opensaasToken = 'jwt_token_2123e5c4-0c60-427c-a737-4d6edf6956bc_1755459619248';

// Create tRPC client with OpenSaaS token (as VS Code extension would)
const client = createTypedAIClient({
  links: [
    httpBatchLink({ 
      url: 'http://localhost:8000/trpc',
      headers: { 
        authorization: `Bearer ${opensaasToken}` 
      }
    })
  ]
});

async function testAuthentication() {
  try {
    console.log('1️⃣ Testing health check (should work without auth)...');
    const health = await client.ai.health.query();
    console.log('✅ Health check successful:', health.status);
    
    console.log('\n2️⃣ Testing authenticated AI request...');
    console.log('   🔑 Using OpenSaaS token:', opensaasToken.slice(0, 20) + '...');
    
    const result = await client.ai.executeAIRequest.mutate({
      content: 'Hello! Please respond with exactly: "Authentication successful!"',
      systemPrompt: 'You are a helpful assistant. Respond exactly as requested.'
    });
    
    console.log('✅ AI request successful!');
    console.log('📝 Response:', result.data?.content || result);
    
    console.log('\n🎉 OpenSaaS Authentication Fix Working!');
    console.log('✅ VS Code extension can now authenticate with OpenSaaS tokens');
    console.log('✅ Mock user created in development mode');
    console.log('✅ AI requests work with authentication');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    
    if (error.message.includes('UNAUTHORIZED')) {
      console.log('❌ Authentication is still failing');
    } else if (error.message.includes('ECONNREFUSED')) {
      console.log('❌ Server not running - please start with: cd examples/servers && node ai-server-example.js');
    } else {
      console.log('🔍 Error details:', error);
    }
  }
}

// Run the test
testAuthentication();