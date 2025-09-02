/**
 * Simple OAuth2 AI Server Example
 * 
 * Shows how easy it is to add OAuth2 authentication to any AI server
 * with just a few lines of configuration.
 */

import 'dotenv/config';
import { createRpcAiServer } from '../dist/index.js';

// Create AI server with OAuth2 authentication
const server = createRpcAiServer({
  port: 8083,
  
  // AI configuration
  serverProviders: ['anthropic', 'openai', 'google'],
  byokProviders: ['anthropic', 'openai', 'google'],
  
  // Enable protocols
  protocols: {
    tRpc: true      // Enable tRPC for type safety
  },
  
  // Enable MCP with OAuth2
  mcp: {
    enableMCP: true,
    auth: {
      requireAuthForToolsList: false,
      requireAuthForToolsCall: true
    }
  },
  
  // OAuth2 configuration - Perfect DX!
  oauth: {
    provider: 'google',
    clientId: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    
    // Optional configuration
    encryptionKey: process.env.OAUTH_ENCRYPTION_KEY,
    scopes: ['openid', 'email', 'profile'],
    
    // Automatic redirect URI (will use http://localhost:8083/oauth/callback)
    // Automatic discovery endpoints
    // Automatic token storage with encryption
  }
});

// Start server - OAuth endpoints are automatically configured!
async function main() {
  await server.start();
  
  console.log('');
  console.log('🚀 AI Server with OAuth2 Ready!');
  console.log('');
  console.log('📋 Automatically configured endpoints:');
  console.log('   • MCP with OAuth: http://localhost:8083/mcp');
  console.log('   • OAuth Discovery: http://localhost:8083/.well-known/oauth-authorization-server');
  console.log('   • tRPC Playground: http://localhost:8083/trpc-playground');
  console.log('');
  console.log('🎯 Perfect DX Features:');
  console.log('   ✅ Encrypted token storage');
  console.log('   ✅ Automatic OAuth discovery');
  console.log('   ✅ MCP authentication');
  console.log('   ✅ Google OAuth2 integration');
  console.log('   ✅ Token persistence across restarts');
  console.log('');
  console.log('🧪 Test with MCP Jam:');
  console.log('   1. Open MCP Jam at http://localhost:4000');
  console.log('   2. Connect to: http://localhost:8083/mcp');
  console.log('   3. OAuth flow starts automatically!');
  console.log('');
}

main().catch(console.error);