/**
 * Simple RPC AI Server Example
 * 
 * Shows how easy it is to set up an AI server that supports both JSON-RPC and tRPC.
 * One server for all your needs!
 */

import { createRpcAiServer, AI_LIMIT_PRESETS } from '../src/index.js';
import { z } from 'zod';
import { publicProcedure, router } from '../src/trpc/index.js';

// Example 1: Minimal setup (just works!)
async function basicServer() {
  const server = createRpcAiServer();
  await server.start();
  
  console.log('🎉 Basic server running!');
  console.log('   • JSON-RPC by default (simple, universal)');
  console.log('   • Standard AI limits (balanced)');
  console.log('   • Ready for AI requests');
}

// Example 2: Production configuration
async function productionServer() {
  const server = createRpcAiServer({
    port: 8080,
    
    // Use conservative limits for production
    aiLimits: AI_LIMIT_PRESETS.conservative,
    
    // Security & performance
    cors: { 
      origin: ['https://yourapp.com'],
      credentials: true 
    },
    rateLimit: {
      windowMs: 15 * 60 * 1000,  // 15 minutes
      max: 100                   // 100 requests per window per IP
    }
  });
  
  await server.start();
  
  console.log('🏭 Production server ready!');
}

// Example 3: JSON-RPC only (if you don't need tRPC)
async function jsonRpcOnlyServer() {
  const server = createRpcAiServer({
    port: 8001,
    protocols: {
      jsonRpc: true,
      tRpc: false  // Disable tRPC
    }
  });
  
  await server.start();
  
  console.log('📡 JSON-RPC only server running!');
}

// Example 4: Custom paths
async function customPathsServer() {
  const server = createRpcAiServer({
    port: 8002,
    paths: {
      jsonRpc: '/api/rpc',
      tRpc: '/api/trpc',
      health: '/api/health'
    }
  });
  
  await server.start();
  
  console.log('🛣️  Custom paths server running!');
  console.log('   • JSON-RPC: POST /api/rpc');
  console.log('   • tRPC: POST /api/trpc/*');
  console.log('   • Health: GET /api/health');
}

// Example 5: Custom router
async function customRouterServer() {
  const server = createRpcAiServer({
    port: 8003,
    protocols: {
      jsonRpc: true,
      tRpc: true
    }
  });

  const customRouter = router({
    newGreet: publicProcedure
      .input(z.object({ name: z.string() }))
      .query(({ input }) => `Hello from custom greeter, ${input.name}`),
  });

  server.mergeRouters(customRouter);
  
  await server.start();
  
  console.log('🚀 Custom router server running!');
  console.log('   • Merged custom router with default router');
  console.log('   • Try: curl -X POST -H "Content-Type: application/json" -d 7b226a736f6e727063223a22322e30222c226964223a312c226d6574686f64223a226e65774772656574222c22706172616d73223a7b226e616d65223a22776f726c64227d7d http://localhost:8003/rpc');
}

// Example 6: Replace router
async function replaceRouterServer() {
  const server = createRpcAiServer({
    port: 8004,
    protocols: {
      jsonRpc: true,
      tRpc: true
    }
  });

  const newRouter = router({
    sayGoodbye: publicProcedure
      .input(z.object({ name: z.string() }))
      .query(({ input }) => `Goodbye, ${input.name}`),
  });

  server.setRouter(newRouter);

  await server.start();

  console.log('🚀 Replaced router server running!');
  console.log('   • Replaced default router with a new one');
  console.log('   • Try: curl -X POST -H "Content-Type: application/json" -d 7b226a736f6e727063223a22322e30222c226964223a312c226d6574686f64223a22736179476f6f64627965222c22706172616d73223a7b226e616d65223a22776f726c64227d7d http://localhost:8004/rpc');
  console.log('   • Note: The default `ai` and `mcp` routers are gone.');
}

// Run examples
const examples = {
  basic: basicServer,
  production: productionServer,
  jsonrpc: jsonRpcOnlyServer,
  custom: customPathsServer,
  router: customRouterServer,
  replaced: replaceRouterServer
};

const example = process.argv[2] || 'basic';

if (examples[example as keyof typeof examples]) {
  examples[example as keyof typeof examples]().catch(console.error);
} else {
  console.log('Available examples:');
  console.log('   node examples/simple-rpc-ai-server.js basic');
  console.log('   node examples/simple-rpc-ai-server.js production');
  console.log('   node examples/simple-rpc-ai-server.js jsonrpc');
  console.log('   node examples/simple-rpc-ai-server.js custom');
  console.log('   node examples/simple-rpc-ai-server.js router');
  console.log('   node examples/simple-rpc-ai-server.js replaced');
}