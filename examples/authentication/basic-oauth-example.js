/**
 * MCP Google OAuth2 Authentication Example (Perfect DX)
 *
 * This example demonstrates the perfect DX for OAuth2 integration with MCP servers.
 * Just add the oauth config to createRpcAiServer - everything else is automatic!
 */

import { createRpcAiServer } from '../../dist/index.js';
import { config } from 'dotenv';
import crypto from 'crypto';

// Load environment variables from .env.oauth if it exists
config({ path: '.env.oauth' });

// --- Configuration ---
const SERVER_PORT = 8082;

const {
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
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
    },
    // Admin user configuration - specific users who can access admin-restricted tools
    adminUsers: [
      'awolf2904@gmail.com'  // Add more admin emails as needed
    ]
  },
  
  // CORS configuration for MCP Jam and ngrok compatibility
  cors: {
    origin: [
      'http://localhost:4000',     // MCP Jam
      'http://localhost:*',        // Any localhost port
      'https://localhost:*',       // HTTPS localhost
      'https://*.ngrok.io',        // ngrok tunnels
      'https://*.ngrok-free.app',  // ngrok free tier
      'vscode-webview://*',        // VS Code extensions
      'https://inspector.open-rpc.org'  // OpenRPC tools
    ],
    credentials: true,             // Allow cookies/auth headers
    methods: ['GET', 'POST', 'OPTIONS', 'HEAD'],
    allowedHeaders: [
      'Content-Type',
      'Authorization', 
      'X-Requested-With',
      'mcp-protocol-version',      // MCP specific header
      'Accept',
      'Accept-Language',
      'Content-Language',
      'Origin',
      'Cache-Control',
      'Pragma',
      'ngrok-skip-browser-warning'  // Skip ngrok browser warning
    ],
    trustProxy: true // enabled for ngrok
  },
  
  // 🚀 OAuth 2.0 Server Configuration with Session Storage
  oauth: {
    enabled: true,
    googleClientId: GOOGLE_CLIENT_ID,
    googleClientSecret: GOOGLE_CLIENT_SECRET,
    encryptionKey: crypto.randomBytes(32).toString('hex'),
    sessionStorage: {
      type: 'file',  // Options: 'memory', 'file', 'redis'
      filePath: './data/oauth-sessions.json'  // File storage path
      // Redis configuration (when type: 'redis'):
      // redis: {
      //   host: 'localhost',
      //   port: 6379,
      //   password: 'your-redis-password',
      //   db: 0,
      //   keyPrefix: 'oauth:'
      // }
    }
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
  // Add ngrok header middleware to all responses
  const app = server.getApp();
  
  await server.start();
  
  console.log('');
  console.log('🚀 MCP Server with Perfect DX OIDC Authentication Ready!');
  console.log('');
  console.log('📋 Automatically configured endpoints:');
  console.log(`   • MCP with OAuth: http://localhost:${SERVER_PORT}/mcp`);
  console.log(`   • OIDC Discovery: http://localhost:${SERVER_PORT}/.well-known/openid-configuration`);
  console.log(`   • Protected Resource: http://localhost:${SERVER_PORT}/.well-known/oauth-protected-resource`);
  console.log(`   • tRPC Playground: http://localhost:${SERVER_PORT}/trpc-playground`);
  console.log('');
  console.log('🎯 Perfect DX Features:');
  console.log('   ✅ HTTP URLs for development compatibility');
  console.log('   ✅ Session middleware for OAuth flow');
  console.log('   ✅ Encrypted token storage');
  console.log('   ✅ OIDC authentication');
  console.log('   ✅ Google OIDC integration');
  console.log('   ✅ Token persistence across restarts');
  console.log('   ✅ Customizable scope-based access control');
  console.log('');
  console.log('🔐 Available OAuth Scopes:');
  console.log('   • MCP Access: mcp, mcp:list, mcp:call, mcp:tools, mcp:admin');
  console.log('   • System Access: system:read, system:admin, system:health');
  console.log('   • AI Services: ai:execute, ai:configure, ai:read');
  console.log('   • User Data: profile:read, profile:write, billing:read, billing:write');
  console.log('   • General: read, write, admin, user');
  console.log('');
  console.log('🧪 Test with MCP clients:');
  console.log('   1. Open MCP Jam at http://localhost:4000');
  console.log(`   2. Connect to: http://localhost:${SERVER_PORT}/mcp`);
  console.log('   3. OIDC flow starts automatically!');
  console.log('');
  
  console.log('💡 To test with HTTPS (recommended for MCP Jam):');
  console.log('   1. Run: ngrok http 8082');
  console.log('   2. Copy the https://xxx.ngrok.io URL');
  console.log('   3. Set OAUTH_BASE_URL=https://xxx.ngrok.io in .env.oauth');
  console.log('   4. Restart server and use https://xxx.ngrok.io/.well-known/oauth-authorization-server in MCP Jam');
  console.log('');
  console.log('⚠️  Important: OAUTH_BASE_URL ensures Google redirects to the correct URL');
  console.log('');
  
  console.log('💡 Perfect DX achieved with just oauth config in createRpcAiServer!');
  console.log('');
}

main().catch(error => {
  console.error('❌ Server startup failed:', error);
  process.exit(1);
});