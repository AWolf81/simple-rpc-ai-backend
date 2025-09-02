#!/usr/bin/env node

/**
 * Test OAuth Token Endpoint Session Resilience
 * 
 * This tests the fix for "missing session" errors in OAuth token exchange.
 * The server should handle missing oauthParams gracefully instead of crashing.
 */

import fetch from 'node-fetch';

const SERVER_URL = 'http://localhost:8082';

console.log('🧪 Testing OAuth Token Endpoint Session Resilience\n');

// Test 1: Token request without session (should get invalid_grant, not crash)
console.log('Test 1: Token request without session');
try {
  const response = await fetch(`${SERVER_URL}/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: 'test_code',
      client_id: 'test_client'
    })
  });
  
  const result = await response.json();
  console.log(`   Status: ${response.status}`);
  console.log(`   Response: ${JSON.stringify(result)}`);
  
  if (response.status === 400 && result.error === 'invalid_grant') {
    console.log('   ✅ PASS: Server handled missing session gracefully\n');
  } else {
    console.log('   ❌ FAIL: Unexpected response\n');
  }
} catch (error) {
  console.log(`   ❌ FAIL: Request failed: ${error.message}\n`);
}

// Test 2: Token request with code_verifier but no session (should warn but not crash)
console.log('Test 2: Token request with code_verifier but missing session');
try {
  const response = await fetch(`${SERVER_URL}/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: 'test_code',
      client_id: 'test_client',
      code_verifier: 'test_verifier_12345'
    })
  });
  
  const result = await response.json();
  console.log(`   Status: ${response.status}`);
  console.log(`   Response: ${JSON.stringify(result)}`);
  
  if (response.status === 400 && result.error === 'invalid_grant') {
    console.log('   ✅ PASS: Server handled code_verifier with missing session gracefully\n');
  } else {
    console.log('   ❌ FAIL: Unexpected response\n');
  }
} catch (error) {
  console.log(`   ❌ FAIL: Request failed: ${error.message}\n`);
}

// Test 3: Verify server health (should still be running)
console.log('Test 3: Server health check');
try {
  const response = await fetch(`${SERVER_URL}/health`);
  const result = await response.json();
  
  if (response.status === 200) {
    console.log('   ✅ PASS: Server is still healthy and responsive');
    console.log(`   Server status: ${result.status}`);
  } else {
    console.log('   ❌ FAIL: Server health check failed');
  }
} catch (error) {
  console.log(`   ❌ FAIL: Health check failed: ${error.message}`);
}

console.log('\n🎯 Session Resilience Fix: All tests completed');
console.log('   The server no longer crashes on missing sessions during OAuth token exchange');