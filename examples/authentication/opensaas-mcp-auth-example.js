#!/usr/bin/env node

/**
 * OpenSaaS JWT Authentication for MCP Example
 * 
 * This example demonstrates how to enable OpenSaaS JWT token authentication
 * for Model Context Protocol (MCP) endpoints. This allows MCP clients to 
 * authenticate using JWT tokens issued by OpenSaaS.
 */

import { createRpcAiServer } from '../../dist/index.js';

console.log(`🔐 OpenSaaS JWT Authentication for MCP Example\n`);
console.log(`This example demonstrates MCP endpoints with OpenSaaS JWT authentication:`);
console.log(`✅ JWT token validation for MCP tools/call`);
console.log(`✅ Public access to tools/list (configurable)`);
console.log(`✅ User context available in tool execution`);
console.log(`✅ Subscription tier-based access control`);

// Example OpenSaaS public key (in production, load from environment)
const EXAMPLE_OPENSAAS_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA1234567890abcdefghijk
lmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890abcdefghijk
... (This is a placeholder - use your actual OpenSaaS public key)
-----END PUBLIC KEY-----`;

const server = createRpcAiServer({
  port: 8084,
  
  // Enable tRPC for MCP tool definitions
  protocols: {
    tRpc: true,
    jsonRpc: true
  },
  
  // AI providers for tool functionality
  serverProviders: ['anthropic'],
  
  // MCP configuration with OpenSaaS JWT authentication
  mcp: {
    enableMCP: true,
    
    // Transport configuration
    transports: {
      http: true,        // HTTP transport for MCP clients
      stdio: false,      // STDIO for Claude Desktop (if needed)
      sse: false         // Server-Sent Events for web clients
    },
    
    // Authentication configuration
    auth: {
      // Standard MCP auth settings
      requireAuthForToolsList: false,  // tools/list is public by default
      requireAuthForToolsCall: true,   // tools/call requires authentication
      publicTools: ['hello', 'calculate'], // These tools don't require auth
      
      // OpenSaaS JWT configuration
      opensaas: {
        enabled: true,                 // Enable OpenSaaS JWT authentication
        publicKey: process.env.OPENSAAS_PUBLIC_KEY || EXAMPLE_OPENSAAS_PUBLIC_KEY,
        audience: 'simple-rpc-ai-backend',      // Expected JWT audience
        issuer: 'opensaas',                     // Expected JWT issuer
        clockTolerance: 30,                     // JWT clock tolerance (seconds)
        requireAuthForAllMethods: false,        // Allow some methods without auth
        skipAuthForMethods: ['tools/list', 'initialize', 'ping'] // Skip auth for these
      }
    },
    
    // Admin users (by email from JWT token)
    adminUsers: ['admin@example.com', 'owner@company.com'],
    
    // Default tool configuration
    defaultConfig: {
      enableWebSearchTool: false,
      enableRefTools: false,
      enableFilesystemTools: false
    }
  }
});

// Start the server
server.start().then(() => {
  console.log(`\n✅ OpenSaaS MCP Server running with JWT authentication!\n`);
  
  console.log(`📍 MCP Endpoints:`);
  console.log(`   • MCP HTTP: POST http://localhost:8084/mcp`);
  console.log(`   • tRPC: POST http://localhost:8084/trpc/*`);
  console.log(`   • JSON-RPC: POST http://localhost:8084/rpc`);
  
  console.log(`\n🔐 Authentication:`);
  console.log(`   • Public methods: tools/list, initialize, ping`);
  console.log(`   • Public tools: hello, calculate`);
  console.log(`   • Protected methods: tools/call (except public tools)`);
  console.log(`   • JWT Header: Authorization: Bearer <opensaas-jwt-token>`);
  
  console.log(`\n🧪 Testing with curl:`);
  
  console.log(`\n   # 1. List available tools (public access)`);
  console.log(`   curl -X POST http://localhost:8084/mcp \\`);
  console.log(`     -H "Content-Type: application/json" \\`);
  console.log(`     -d '{"jsonrpc": "2.0", "id": 1, "method": "tools/list"}'`);
  
  console.log(`\n   # 2. Call public tool (no auth needed)`);
  console.log(`   curl -X POST http://localhost:8084/mcp \\`);
  console.log(`     -H "Content-Type: application/json" \\`);
  console.log(`     -d '{"jsonrpc": "2.0", "id": 2, "method": "tools/call", "params": {"name": "hello", "arguments": {"name": "World"}}}'`);
  
  console.log(`\n   # 3. Call protected tool (requires JWT token)`);
  console.log(`   curl -X POST http://localhost:8084/mcp \\`);
  console.log(`     -H "Content-Type: application/json" \\`);
  console.log(`     -H "Authorization: Bearer YOUR_OPENSAAS_JWT_TOKEN" \\`);
  console.log(`     -d '{"jsonrpc": "2.0", "id": 3, "method": "tools/call", "params": {"name": "echo", "arguments": {"message": "Hello JWT!"}}}'`);
  
  console.log(`\n💡 JWT Token Requirements:`);
  console.log(`   • Must be signed by OpenSaaS private key`);
  console.log(`   • Must contain: userId, email, subscriptionTier`);
  console.log(`   • Must contain: monthlyTokenQuota, rpmLimit, tpmLimit`);
  console.log(`   • Audience must match: simple-rpc-ai-backend`);
  console.log(`   • Issuer must match: opensaas`);
  
  console.log(`\n📋 User Context Available in Tools:`);
  console.log(`   • req.user.email - User's email address`);
  console.log(`   • req.user.subscriptionTier - User's subscription tier`);
  console.log(`   • req.user.monthlyTokenQuota - User's token quota`);
  console.log(`   • req.authContext.features - Available features`);
}).catch(console.error);

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down OpenSaaS MCP server...');
  await server.stop();
  process.exit(0);
});

export { server };