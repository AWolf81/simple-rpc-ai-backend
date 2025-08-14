/**
 * tRPC AI Server Example
 * 
 * Complete example showing how to use real tRPC with our AI backend.
 * Demonstrates both tRPC and JSON-RPC compatibility.
 */

import { createTRPCServer } from '../src/server-trpc.js';
import type { AppRouter } from '../src/server-trpc.js';

// Type-safe client example (would be in a separate client app)
import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';
import superjson from 'superjson';

/**
 * Create and start the tRPC server
 */
async function startTRPCServer() {
  const server = createTRPCServer({
    port: 8001,
    cors: { origin: '*' },
    trpcPath: '/trpc'
  });

  await server.start();
  
  console.log('✨ tRPC AI Server Features:');
  console.log('   • Full TypeScript type safety');
  console.log('   • tRPC procedures with Zod validation');
  console.log('   • JSON-RPC backward compatibility');
  console.log('   • OpenRPC schema generation');
  console.log('   • Express.js integration');
  console.log('');
  
  return server;
}

/**
 * Example: Type-safe tRPC client
 */
function createTypeSafeClient() {
  const trpc = createTRPCProxyClient<AppRouter>({
    transformer: superjson,
    links: [
      httpBatchLink({
        url: 'http://localhost:8001/trpc',
      }),
    ],
  });

  return trpc;
}

/**
 * Example usage of tRPC client
 */
async function demoTRPCClient() {
  console.log('🔄 Testing tRPC client...');
  
  const client = createTypeSafeClient();

  try {
    // Type-safe health check
    const health = await client.ai.health.query();
    console.log('✅ Health check:', health);

    // Type-safe AI request
    const aiResult = await client.ai.executeAIRequest.mutate({
      content: 'function add(a, b) { return a + b; }',
      systemPrompt: 'Analyze this JavaScript function for security issues',
      options: {
        temperature: 0.1,
        maxTokens: 500
      }
    });
    console.log('✅ AI analysis:', aiResult.success ? 'Success' : 'Failed');

    // List providers
    const providers = await client.ai.listProviders.query();
    console.log('✅ Available providers:', providers.providers.length);

  } catch (error) {
    console.error('❌ tRPC client error:', error);
  }
}

/**
 * Example: JSON-RPC compatibility (legacy clients)
 */
async function demoJSONRPCClient() {
  console.log('🔄 Testing JSON-RPC compatibility...');
  
  try {
    // Traditional JSON-RPC call
    const response = await fetch('http://localhost:8001/rpc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'health',
        params: {},
        id: 1
      })
    });

    const result = await response.json();
    console.log('✅ JSON-RPC health check:', result.result?.status);

    // AI request via JSON-RPC
    const aiResponse = await fetch('http://localhost:8001/rpc', {
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'executeAIRequest',
        params: {
          content: 'console.log("Hello World");',
          systemPrompt: 'Review this code for best practices'
        },
        id: 2
      })
    });

    const aiResult = await aiResponse.json();
    console.log('✅ JSON-RPC AI request:', aiResult.result ? 'Success' : 'Failed');

  } catch (error) {
    console.error('❌ JSON-RPC client error:', error);
  }
}

/**
 * Example: OpenRPC schema validation
 */
async function demoOpenRPCIntegration() {
  console.log('🔄 Testing OpenRPC integration...');
  
  try {
    const schemaResponse = await fetch('http://localhost:8001/openrpc.json');
    const schema = await schemaResponse.json();
    
    console.log('✅ OpenRPC schema loaded:', schema.info.title);
    console.log('   Methods available:', schema.methods.length);
    console.log('   🔗 Try in playground: https://playground.open-rpc.org/');
    console.log('   📋 Schema URL: http://localhost:8001/openrpc.json');

  } catch (error) {
    console.error('❌ OpenRPC schema error:', error);
  }
}

/**
 * Main demo function
 */
async function main() {
  console.log('🚀 Starting tRPC AI Server Demo...\n');

  // Start the server
  const server = await startTRPCServer();

  // Wait a bit for server to be ready
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Demo different client approaches
  await demoTRPCClient();
  console.log('');
  
  await demoJSONRPCClient();
  console.log('');
  
  await demoOpenRPCIntegration();
  console.log('');

  console.log('🎯 Next Steps:');
  console.log('   1. Try the tRPC endpoints at http://localhost:8001/trpc');
  console.log('   2. Test JSON-RPC at http://localhost:8001/rpc');  
  console.log('   3. View API docs at http://localhost:8001/api-docs');
  console.log('   4. Load schema in OpenRPC Playground');
  console.log('');
  console.log('Press Ctrl+C to stop the server');

  // Keep server running
  process.on('SIGINT', async () => {
    console.log('\n🛑 Stopping server...');
    await server.stop();
    process.exit(0);
  });
}

// Run the demo if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { startTRPCServer, createTypeSafeClient };