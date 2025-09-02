#!/usr/bin/env node
/**
 * Test script to verify the complete OAuth flow and token storage
 */

import { request } from 'http';
import { URL } from 'url';

const SERVER_BASE = 'http://localhost:8082';

async function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const req = request({
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: options.headers || {},
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data,
          location: res.headers.location
        });
      });
    });

    if (options.body) {
      req.write(options.body);
    }

    req.on('error', reject);
    req.end();
  });
}

async function testOAuthFlow() {
  console.log('🧪 Testing OAuth Flow...');
  
  // Step 1: Check debug endpoint before OAuth
  console.log('\n1. Checking token storage before OAuth...');
  try {
    const debugBefore = await makeRequest(`${SERVER_BASE}/debug/latest-token`);
    console.log('Debug response:', debugBefore.body);
  } catch (err) {
    console.log('Debug request failed:', err.message);
  }

  // Step 2: Initiate OAuth authorization (should redirect to Google)
  console.log('\n2. Initiating OAuth authorization...');
  const authParams = new URLSearchParams({
    client_id: 'mcp-client',
    resource: SERVER_BASE,
    redirect_uri: 'http://localhost:4000/oauth/callback/debug',
    response_type: 'code',
    code_challenge: 'test-challenge-1234567890123456789012345678901234567890',
    code_challenge_method: 'S256',
    state: 'test-state-123'
  });

  try {
    const authResponse = await makeRequest(`${SERVER_BASE}/oauth/authorize?${authParams}`);
    console.log(`Auth response: ${authResponse.statusCode}`);
    console.log(`Redirect to: ${authResponse.location}`);
    
    if (authResponse.location && authResponse.location.includes('accounts.google.com')) {
      console.log('✅ Successfully redirected to Google OAuth');
    } else {
      console.log('❌ Unexpected redirect location');
    }
  } catch (err) {
    console.log('❌ Auth request failed:', err.message);
  }

  // Note: We can't complete the full flow without a real Google OAuth callback,
  // but we can check if the session was properly stored
  
  console.log('\n3. Final token storage check...');
  try {
    const debugAfter = await makeRequest(`${SERVER_BASE}/debug/latest-token`);
    console.log('Debug response:', debugAfter.body);
  } catch (err) {
    console.log('Debug request failed:', err.message);
  }

  console.log('\n🔍 To complete the OAuth flow:');
  console.log('1. Open MCP Jam: http://localhost:4000');
  console.log('2. Connect to: http://localhost:8082/mcp');
  console.log('3. Complete Google OAuth in browser');
  console.log('4. Check /debug/latest-token again');
}

testOAuthFlow().catch(console.error);