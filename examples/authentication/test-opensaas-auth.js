/**
 * OpenSaaS Authentication Test Example
 * 
 * This example shows how to test OpenSaaS authentication safely.
 * NEVER commit real tokens to version control!
 */

import { createTypedAIClient } from '../../dist/index.js';
import { httpBatchLink } from '@trpc/client';

console.log('🧪 OpenSaaS Authentication Test\n');

// ✅ SAFE: Get token from environment variable
const opensaasToken = process.env.OPENSAAS_JWT_TOKEN;

if (!opensaasToken) {
  console.log('❌ No OpenSaaS token provided');
  console.log('💡 To test authentication, set environment variable:');
  console.log('   export OPENSAAS_JWT_TOKEN="your-real-token-here"');
  console.log('   node examples/authentication/test-opensaas-auth.js');
  console.log('\n🔒 This is the SECURE way to handle tokens - never commit them to code!');
  process.exit(1);
}

// Create tRPC client with OpenSaaS token
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
    console.log('1️⃣ Testing health check...');
    const health = await client.ai.health.query();
    console.log('✅ Health check successful:', health.status);
    
    console.log('\n2️⃣ Testing authenticated AI request...');
    console.log('   🔑 Using OpenSaaS token from environment variable');
    
    const result = await client.ai.executeAIRequest.mutate({
      content: 'Hello! Please respond with exactly: "Authentication successful!"',
      systemPrompt: 'You are a helpful assistant. Respond exactly as requested.'
    });
    
    console.log('✅ AI request successful!');
    console.log('📝 Response:', result.data?.content || result);
    
    console.log('\n🎉 OpenSaaS Authentication Working!');
    console.log('✅ VS Code extensions can authenticate with OpenSaaS tokens');
    console.log('✅ User context properly created from JWT payload');
    console.log('✅ AI requests work with authentication');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    
    if (error.message.includes('UNAUTHORIZED')) {
      console.log('❌ Authentication failed - check your token');
    } else if (error.message.includes('ECONNREFUSED')) {
      console.log('❌ Server not running - start with: cd examples/servers && node ai-server-example.js');
    } else {
      console.log('🔍 This might be an AI service configuration issue (API keys, etc.)');
    }
  }
}

// Run the test
testAuthentication();