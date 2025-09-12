/**
 * Simple RPC AI Server Example
 * 
 * Shows how easy it is to set up an AI server that supports both JSON-RPC and tRPC.
 * One server for all your needs!
 */

import { createRpcAiServer, AI_LIMIT_PRESETS } from '../dist/index.js';
import { z } from 'zod';
import { publicProcedure, router } from '../dist/trpc/index.js';

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
  console.log('   • Try: curl -X POST -H "Content-Type: application/json" -d \'{"jsonrpc":"2.0","id":1,"method":"newGreet","params":{"name":"world"}}\' http://localhost:8003/rpc');
  console.log('   • Also try: curl -X POST -H "Content-Type: application/json" -d \'{"jsonrpc":"2.0","id":2,"method":"ai.health"}\' http://localhost:8003/rpc');
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

  // When using setRouter, use the 'ai' namespace for JSON-RPC compatibility
  const newRouter = router({
    ai: router({
      sayGoodbye: publicProcedure
        .input(z.object({ name: z.string() }))
        .query(({ input }) => `Goodbye, ${input.name}`),
    })
  });

  server.setRouter(newRouter);

  await server.start();

  console.log('🚀 Replaced router server running!');
  console.log('   • Replaced default router with a new one');
  console.log('   • Try: curl -X POST -H "Content-Type: application/json" -d \'{"jsonrpc":"2.0","id":1,"method":"ai.sayGoodbye","params":{"name":"world"}}\' http://localhost:8004/rpc');
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

if (examples[example]) {
  examples[example]().catch(console.error);
} else {
  console.log('Available examples:');
  console.log('   node examples/simple-rpc-ai-server.js basic');
  console.log('   node examples/simple-rpc-ai-server.js production');
  console.log('   node examples/simple-rpc-ai-server.js jsonrpc');
  console.log('   node examples/simple-rpc-ai-server.js custom');
  console.log('   node examples/simple-rpc-ai-server.js router');
  console.log('   node examples/simple-rpc-ai-server.js replaced');
}