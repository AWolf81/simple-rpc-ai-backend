/**
 * Test Claude.ai compatible SSE transport
 */

import { createRpcAiServer } from '../dist/index.js';

console.log('🔗 Testing Claude.ai compatible SSE transport...');

const server = createRpcAiServer({
  port: 8008,
  mcp: {
    enableMCP: true,
    transports: {
      http: true,     // For testing
      sse: true,      // Claude.ai compatible SSE
      stdio: true     // Enable for MCP Jam
    },
    auth: {
      requireAuthForToolsList: false,  // tools/list is public (default)
      requireAuthForToolsCall: false,  // DISABLE auth for Claude.ai testing
      publicTools: ['hello', 'echo']   // Make our test tools public
    }
  }
});

server.start().then(() => {
  console.log('✅ Server started on port 8008');
  console.log('\n🔗 Claude.ai compatible endpoints:');
  console.log('  • SSE Connection: GET /mcp');
  console.log('  • Messages: POST /messages');
  console.log('  • OAuth Discovery: GET /.well-known/oauth-authorization-server');
  console.log('  • Resource Discovery: GET /.well-known/oauth-protected-resource/mcp');
  console.log('  • Registration: POST /register');
  
  console.log('\n🧪 Test with curl:');
  console.log('  # Test initialize');
  console.log('  curl -X POST http://localhost:8008/messages -H "Content-Type: application/json" -d \'{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{}}}\'');
  console.log('\n  # Test tools/list');
  console.log('  curl -X POST http://localhost:8008/messages -H "Content-Type: application/json" -d \'{"jsonrpc":"2.0","id":2,"method":"tools/list"}\'');
  console.log('\n  # Test tools/call');
  console.log('  curl -X POST http://localhost:8008/messages -H "Content-Type: application/json" -d \'{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"hello","arguments":{"name":"Claude"}}}\'');
  
  console.log('\n📡 Your ngrok URL should work with Claude.ai now!');
  console.log('   Make sure to expose this with: ngrok http 8008');
}).catch(console.error);