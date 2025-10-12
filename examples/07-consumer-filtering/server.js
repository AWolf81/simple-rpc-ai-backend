#!/usr/bin/env node
/**
 * Example 07: Consumer App with Filtering
 *
 * Demonstrates:
 * - Filtering out base routers (AI, System, User, etc.)
 * - Keeping only MCP + custom namespace
 * - Using simple-rpc-gen-methods binary
 */

import { createRpcAiServer } from 'simple-rpc-ai-backend';
import { getCustomRouters } from './methods/index.js';

// Server configuration - disable all base routers except MCP
const server = createRpcAiServer({
  port: 8002,

  // No AI providers configured for this example
  providers: [],

  // Enable MCP with minimal configuration
  mcp: {
    enabled: true
  },

  // Custom routers from consumer
  customRouters: getCustomRouters(),

  // Log level
  logLevel: 'info'
});

// Start server
server.start().then(() => {
  console.log('');
  console.log('🎯 Consumer Server with Filtering');
  console.log('📋 Configuration:');
  console.log('   - Base routers: DISABLED (AI, System, User, Billing, Auth, Admin)');
  console.log('   - MCP router: ENABLED (core protocol only)');
  console.log('   - Custom routers: math, demo');
  console.log('');
  console.log('💡 To generate filtered tRPC methods:');
  console.log('   TRPC_GEN_AI_ENABLED=false \\');
  console.log('   TRPC_GEN_SYSTEM_ENABLED=false \\');
  console.log('   TRPC_GEN_USER_ENABLED=false \\');
  console.log('   TRPC_GEN_BILLING_ENABLED=false \\');
  console.log('   TRPC_GEN_AUTH_ENABLED=false \\');
  console.log('   TRPC_GEN_ADMIN_ENABLED=false \\');
  console.log('   TRPC_GEN_CUSTOM_ROUTERS=examples/07-consumer-filtering/methods/index.js \\');
  console.log('   npx simple-rpc-gen-methods');
  console.log('');
  console.log('🚀 Dev Panel:');
  console.log('   npx simple-rpc-dev-panel --server-port 8002');
  console.log('');
}).catch(error => {
  console.error('❌ Server failed to start:', error);
  process.exit(1);
});
