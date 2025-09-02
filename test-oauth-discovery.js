/**
 * Test script to verify OAuth discovery endpoints
 * Run this to check if MCP Jam can discover the OAuth endpoints
 */

const BASE_URL = 'http://localhost:8082';

const endpoints = [
  '/.well-known/oauth-authorization-server',
  '/.well-known/oauth-protected-resource', 
  '/.well-known/oauth-protected-resource/mcp',
  '/.well-known/openid-configuration',
  '/.well-known/jwks.json',
  '/debug/config',
  '/debug/mcp-test'
];

async function testEndpoint(path) {
  try {
    console.log(`\n🔍 Testing: ${BASE_URL}${path}`);
    const response = await fetch(`${BASE_URL}${path}`);
    
    if (response.ok) {
      const data = await response.json();
      console.log(`✅ Status: ${response.status}`);
      console.log(`📄 Response:`, JSON.stringify(data, null, 2));
    } else {
      console.log(`❌ Status: ${response.status}`);
      console.log(`📄 Error:`, await response.text());
    }
  } catch (error) {
    console.log(`💥 Error: ${error.message}`);
  }
}

async function testMCPEndpoint() {
  try {
    console.log(`\n🔍 Testing MCP endpoint (should trigger auth): ${BASE_URL}/`);
    const response = await fetch(`${BASE_URL}/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list'
      })
    });
    
    console.log(`📊 Status: ${response.status}`);
    console.log(`🔐 WWW-Authenticate: ${response.headers.get('WWW-Authenticate')}`);
    
    const data = await response.json();
    console.log(`📄 Response:`, JSON.stringify(data, null, 2));
    
    // Parse WWW-Authenticate header to see if resource parameter is there
    const wwwAuth = response.headers.get('WWW-Authenticate');
    if (wwwAuth) {
      const resourceMatch = wwwAuth.match(/resource="([^"]+)"/);
      if (resourceMatch) {
        console.log(`🎯 Resource parameter found: ${resourceMatch[1]}`);
      } else {
        console.log(`⚠️ No resource parameter in WWW-Authenticate header`);
      }
    }
  } catch (error) {
    console.log(`💥 Error: ${error.message}`);
  }
}

async function testClientRegistration() {
  console.log(`\n🔍 Testing client registration scenarios...`);
  
  // Test 1: With proper redirect_uris
  try {
    console.log(`\n   Test 1: With redirect_uris array`);
    const response1 = await fetch(`${BASE_URL}/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'http://localhost:4000'
      },
      body: JSON.stringify({
        redirect_uris: ['http://localhost:4000/oauth/callback/debug'],
        grant_types: ['authorization_code'],
        response_types: ['code'],
        client_name: 'Test MCP Client'
      })
    });
    
    console.log(`   📊 Status: ${response1.status}`);
    
    if (response1.ok) {
      const data1 = await response1.json();
      console.log(`   ✅ Registration successful`);
      console.log(`   📄 Response has redirect_uris:`, !!data1.redirect_uris && Array.isArray(data1.redirect_uris));
      console.log(`   📄 Redirect URIs:`, data1.redirect_uris);
    } else {
      console.log(`   ❌ Registration failed`);
      console.log(`   📄 Error:`, await response1.text());
    }
  } catch (error) {
    console.log(`   💥 Error: ${error.message}`);
  }
  
  // Test 2: Without redirect_uris (should use defaults)
  try {
    console.log(`\n   Test 2: Without redirect_uris (should use defaults)`);
    const response2 = await fetch(`${BASE_URL}/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'http://localhost:4000'
      },
      body: JSON.stringify({
        grant_types: ['authorization_code'],
        response_types: ['code'],
        client_name: 'Test MCP Client No Redirects'
      })
    });
    
    console.log(`   📊 Status: ${response2.status}`);
    
    if (response2.ok) {
      const data2 = await response2.json();
      console.log(`   ✅ Registration successful with defaults`);
      console.log(`   📄 Default redirect URIs:`, data2.redirect_uris);
    } else {
      console.log(`   ❌ Registration failed`);
      console.log(`   📄 Error:`, await response2.text());
    }
  } catch (error) {
    console.log(`   💥 Error: ${error.message}`);
  }
  
  // Test 3: Empty body (worst case)
  try {
    console.log(`\n   Test 3: Empty body`);
    const response3 = await fetch(`${BASE_URL}/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'http://localhost:4000'
      },
      body: JSON.stringify({})
    });
    
    console.log(`   📊 Status: ${response3.status}`);
    
    if (response3.ok) {
      const data3 = await response3.json();
      console.log(`   ✅ Registration successful with minimal data`);
      console.log(`   📄 Generated redirect URIs:`, data3.redirect_uris);
    } else {
      console.log(`   ❌ Registration failed`);
      console.log(`   📄 Error:`, await response3.text());
    }
  } catch (error) {
    console.log(`   💥 Error: ${error.message}`);
  }
}

async function checkServerRunning() {
  try {
    const response = await fetch(`${BASE_URL}/health`);
    if (response.ok) {
      console.log('✅ OAuth server is running');
      return true;
    }
  } catch (error) {
    // Server not running
  }
  
  console.log('❌ OAuth server is not running!');
  console.log('');
  console.log('🚀 Please start the server first:');
  console.log('   pnpm demo:oauth');
  console.log('');
  console.log('   Then run this test again:');
  console.log('   pnpm test:oauth');
  console.log('');
  return false;
}

async function main() {
  console.log('🚀 Testing OAuth Discovery Endpoints');
  console.log('====================================');
  
  // Check if server is running first
  const serverRunning = await checkServerRunning();
  if (!serverRunning) {
    return;
  }
  
  // Test all discovery endpoints
  for (const endpoint of endpoints) {
    await testEndpoint(endpoint);
  }
  
  // Test MCP endpoint (should return 401 with WWW-Authenticate)
  await testMCPEndpoint();
  
  // Test client registration
  await testClientRegistration();
  
  console.log('\n✅ Discovery test complete!');
  console.log('\n🎯 Next steps:');
  console.log('1. Server is running ✅');
  console.log('2. Open MCP Jam: http://localhost:4000');
  console.log('3. Connect to: http://localhost:8082/');
  console.log('4. OAuth flow should work now!');
}

main().catch(console.error);