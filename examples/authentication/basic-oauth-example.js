/**
 * MCP Google OAuth2 Authentication Example (Perfect DX)
 *
 * This example demonstrates the perfect DX for OAuth2 integration with MCP servers.
 * Just add the oauth config to createRpcAiServer - everything else is automatic!
 */

import { createRpcAiServer } from '../../dist/index.js';
import { config } from 'dotenv';

// Load environment variables from .env.oauth if it exists
config({ path: '.env.oauth' });

// --- Configuration ---
const SERVER_PORT = 8082;

const {
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  TOKEN_ENCRYPTION_KEY,
} = process.env;

if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
  console.error('❌ Missing required environment variables:');
  console.error('   GOOGLE_CLIENT_ID=your_client_id');
  console.error('   GOOGLE_CLIENT_SECRET=your_client_secret');
  console.error('');
  console.error('   Get these from: https://console.developers.google.com');
  console.error('   Redirect URI: http://localhost:8082/oauth/callback');
  console.error('');
  process.exit(1);
}

// --- Perfect DX: One-line OAuth integration! ---
const server = createRpcAiServer({
  port: SERVER_PORT,
  
  // AI configuration
  serverProviders: ['anthropic', 'openai', 'google'],
  byokProviders: ['anthropic', 'openai', 'google'],
  
  // Enable protocols
  protocols: {
    tRPC: true      // Enable tRPC for type safety
  },
  
  // Enable MCP with OAuth2
  mcp: {
    enableMCP: true,
    transports: {
      http: true,   // Standard HTTP transport - MCP Jam uses POST /mcp
      sse: false,   // Disable SSE transport - conflicts with GET /mcp requests
      stdio: false  // Keep STDIO disabled
    },
    auth: {
      requireAuthForToolsList: false,
      requireAuthForToolsCall: true
    }
  },
  
  // 🚀 Perfect DX: OAuth configuration with HTTPS URLs for MCP compliance!
  oauth: {
    provider: 'google',
    clientId: GOOGLE_CLIENT_ID,
    clientSecret: GOOGLE_CLIENT_SECRET,
    
    // Optional configuration
    encryptionKey: TOKEN_ENCRYPTION_KEY,
    scopes: ['openid', 'email', 'profile'],
    baseUrl: `http://localhost:${SERVER_PORT}`, // Use HTTP for development (avoid certificate issues)
    
    // Automatic features:
    // ✅ Redirect URI: http://localhost:8082/oauth/callback (auto-configured)
    // ✅ Discovery endpoints: /.well-known/oauth-authorization-server (auto-configured)  
    // ✅ Session middleware: Required for OAuth flow (auto-configured)
    // ✅ Encrypted token storage: Secure AES-256-GCM (auto-configured)
    // ✅ MCP authentication: OAuth tokens work with MCP (auto-configured)
  },
  
  // Disable HTTPS for MCP Jam compatibility (Node.js apps struggle with self-signed certs)
  https: {
    enabled: false,  // Use HTTP for development to avoid certificate issues
    keyPath: './certs/key.pem',
    certPath: './certs/cert.pem'
  }
});

// --- Start Server ---
async function main() {
  await server.start();
  
  console.log('');
  console.log('🚀 MCP Server with Perfect DX OAuth2 Authentication Ready!');
  console.log('');
  console.log('📋 Automatically configured endpoints:');
  console.log(`   • MCP with OAuth: http://localhost:${SERVER_PORT}/mcp`);
  console.log(`   • OAuth Discovery: http://localhost:${SERVER_PORT}/.well-known/oauth-authorization-server`);
  console.log(`   • Protected Resource: http://localhost:${SERVER_PORT}/.well-known/oauth-protected-resource`);
  console.log(`   • tRPC Playground: http://localhost:${SERVER_PORT}/trpc-playground`);
  console.log('');
  console.log('🎯 Perfect DX Features:');
  console.log('   ✅ HTTP URLs for development compatibility');
  console.log('   ✅ Session middleware for OAuth flow');
  console.log('   ✅ Encrypted token storage');
  console.log('   ✅ Automatic OAuth discovery');
  console.log('   ✅ MCP authentication');
  console.log('   ✅ Google OAuth2 integration');
  console.log('   ✅ Token persistence across restarts');
  console.log('');
  console.log('🧪 Test with MCP clients:');
  console.log('   1. Open MCP Jam at http://localhost:4000');
  console.log(`   2. Connect to: http://localhost:${SERVER_PORT}/mcp`);
  console.log('   3. OAuth flow starts automatically!');
  console.log('');
  console.log('💡 Perfect DX achieved with just oauth config in createRpcAiServer!');
  console.log('');
}

main().catch(error => {
  console.error('❌ Server startup failed:', error);
  process.exit(1);
});