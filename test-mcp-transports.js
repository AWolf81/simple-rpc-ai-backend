/**
 * Test MCP Transport Compatibility
 * 
 * Test different MCP transports to see what MCP Jam expects
 */

import { createRpcAiServer } from './dist/index.js';
import fetch from 'node-fetch';

const server = createRpcAiServer({
  port: 8082,
  
  serverProviders: ['anthropic'],
  byokProviders: ['anthropic'],
  
  protocols: {
    tRPC: true
  },
  
  mcp: {
    enableMCP: true,
    transports: {
      http: true,   // Standard HTTP transport
      sse: true,    // Enable SSE transport for MCP Jam compatibility  
      stdio: false  // Keep STDIO disabled
    },
    auth: {
      requireAuthForToolsList: false,  // Make tools/list public for testing
      requireAuthForToolsCall: false   // Make tools/call public for testing
    }
  },
  
  oauth: {
    provider: 'google',
    clientId: 'test-client-id',
    clientSecret: 'test-client-secret',
    encryptionKey: 'a'.repeat(64),
    baseUrl: 'https://localhost:8082'
  }
});

async function testMCPTransports() {
  try {
    await server.start();
    
    console.log('🧪 Testing MCP Transport Compatibility...\n');
    
    // Test 1: HTTP transport (POST /mcp)
    console.log('📋 Test 1: HTTP Transport (POST /mcp)');
    try {
      const httpResponse = await fetch('http://localhost:8082/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/list'
        })
      });
      
      console.log(`   • Status: ${httpResponse.status}`);
      if (httpResponse.status === 200) {
        const data = await httpResponse.json();
        console.log(`   • Tools found: ${data.result?.tools?.length || 0}`);
        console.log('   ✅ HTTP transport: WORKING');
      } else {
        const error = await httpResponse.text();
        console.log(`   • Error: ${error}`);
        console.log('   ❌ HTTP transport: FAILED');
      }
    } catch (error) {
      console.log(`   ❌ HTTP transport error: ${error.message}`);
    }
    
    // Test 2: SSE transport (GET /mcp)
    console.log('\n📋 Test 2: SSE Transport (GET /mcp)');
    try {
      const sseResponse = await fetch('http://localhost:8082/mcp', {
        method: 'GET',
        headers: { 
          'Accept': 'text/event-stream',
          'Cache-Control': 'no-cache'
        }
      });
      
      console.log(`   • Status: ${sseResponse.status}`);
      console.log(`   • Content-Type: ${sseResponse.headers.get('content-type')}`);
      
      if (sseResponse.status === 200) {
        console.log('   ✅ SSE endpoint: WORKING');
      } else {
        console.log('   ❌ SSE endpoint: FAILED');
      }
    } catch (error) {
      console.log(`   ❌ SSE transport error: ${error.message}`);
    }
    
    // Test 3: Messages endpoint (POST /messages)
    console.log('\n📋 Test 3: Messages Endpoint (POST /messages)');
    try {
      const messagesResponse = await fetch('http://localhost:8082/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/list'
        })
      });
      
      console.log(`   • Status: ${messagesResponse.status}`);
      if (messagesResponse.status === 200) {
        const data = await messagesResponse.json();
        console.log(`   • Tools found: ${data.result?.tools?.length || 0}`);
        console.log('   ✅ Messages endpoint: WORKING');
      } else {
        console.log('   ❌ Messages endpoint: FAILED');
      }
    } catch (error) {
      console.log(`   ❌ Messages endpoint error: ${error.message}`);
    }
    
    await server.stop();
    
    console.log('\n🎯 Analysis:');
    console.log('MCP Jam likely expects one of these transport combinations:');
    console.log('1. GET /mcp (SSE) + POST /messages (requests)');
    console.log('2. POST /mcp (HTTP only)');
    console.log('3. Some other transport configuration');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    await server.stop();
    process.exit(1);
  }
}

testMCPTransports();