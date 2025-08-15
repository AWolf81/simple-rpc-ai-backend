/**
 * Simple RPC AI Server Example
 * 
 * Shows how easy it is to set up an AI server that supports both JSON-RPC and tRPC.
 * One server for all your needs!
 */

import { createRpcAiServer, AI_LIMIT_PRESETS } from '../src/index.js';

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

// Run examples
const examples = {
  basic: basicServer,
  production: productionServer,
  jsonrpc: jsonRpcOnlyServer,
  custom: customPathsServer
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
}