/**
 * Example: Type-safe RPC Server using tRPC
 * 
 * Shows how to use the actual tRPC server with the simplified router.
 * This example demonstrates the new streamlined approach.
 */

import { createTRPCServer } from '../src/server-trpc.js';
import { createTRPCRouter, publicProcedure, v, generateOpenRPCSchema } from '../src/rpc/router.js';
import { AIService } from '../src/services/ai-service.js';

// Example usage - now using actual tRPC server
async function startTypedServer() {
  const server = createTRPCServer({
    port: 8001,
    cors: { origin: '*' }
  });

  await server.start();
  
  console.log('🎯 tRPC AI Server Features:');
  console.log('   • Full TypeScript type safety with tRPC');
  console.log('   • Built-in input validation with Zod');
  console.log('   • Modern HTTP-based RPC (not JSON-RPC)');
  console.log('   • Automatic type inference');
  console.log('');
  console.log('📍 Endpoints:');
  console.log('   • tRPC: POST http://localhost:8001/trpc/*');
  console.log('   • Health: GET http://localhost:8001/health');
  console.log('');
  console.log('🔗 Example calls:');
  console.log('   • Health: POST http://localhost:8001/trpc/ai.health');
  console.log('   • AI Request: POST http://localhost:8001/trpc/ai.executeAIRequest');
  console.log('   • List Providers: POST http://localhost:8001/trpc/ai.listProviders');
}

// Simple client example
function createTRPCClientExample() {
  // In a real app, you'd use @trpc/client:
  /*
  import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';
  import type { AppRouter } from '../src/trpc/root.js';
  
  const client = createTRPCProxyClient<AppRouter>({
    links: [
      httpBatchLink({
        url: 'http://localhost:8001/trpc',
      }),
    ],
  });
  
  // Type-safe calls:
  const health = await client.ai.health.query();
  const result = await client.ai.executeAIRequest.mutate({
    content: 'Hello world',
    systemPrompt: 'You are a helpful assistant'
  });
  */
  
  console.log('📝 To use with tRPC client, install @trpc/client');
  console.log('   npm install @trpc/client');
  console.log('   See: https://trpc.io/docs/client');
}

// Start server if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  startTypedServer().catch(console.error);
}

export { startTypedServer, createTRPCClientExample };