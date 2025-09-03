/**
 * Test OAuth Server
 * 
 * For testing OAuth2 flow with Google authentication
 */

import { createRpcAiServer, AI_LIMIT_PRESETS } from './dist/index.js';

console.log(`
🔐 OAuth Test Server

Testing OAuth2 federated authentication with Google
✅ OAuth2 endpoints enabled
✅ Federated login (Google OIDC)
✅ MCP compatible
`);

// Create server with OAuth enabled
const server = createRpcAiServer({
  port: 8082,
  
  // Enable both protocols
  protocols: { tRpc: true, jsonRpc: true },
  
  // OAuth configuration
  oauth: {
    enabled: true,
    sessionStorage: {
      type: 'file',
      filePath: './data/oauth-sessions.json'
    }
  },
  
  // Enable trust proxy for reverse proxies (ngrok, cloudflare, etc.)
  // Uncomment if you're running behind a proxy to fix rate limiting issues
  // trustProxy: true,
  
  // Use conservative limits
  aiLimits: AI_LIMIT_PRESETS.conservative,
  
  // CORS configuration
  cors: {
    origin: [
      'http://localhost:*',
      'https://localhost:*', 
      'vscode-webview://*',
      'https://inspector.open-rpc.org'
    ],
    credentials: true
  },
  
  // MCP enabled
  mcp: {
    enableMCP: true,
    defaultConfig: {
      enableWebSearchTool: false,
      enableRefTools: false,
      enableFilesystemTools: false
    }
  }
});

// Start the server
console.log('Starting OAuth test server...');
server.start().then(() => {
  console.log(`
✅ OAuth Test Server running!

📍 OAuth Endpoints:
   • Authorization: GET http://localhost:8082/oauth/authorize
   • Token: POST http://localhost:8082/oauth/token  
   • Registration: POST http://localhost:8082/oauth/register
   • Discovery: GET http://localhost:8082/.well-known/oauth-authorization-server

🔐 Federated Login:
   • Google: GET http://localhost:8082/login/google
   • Callback: GET http://localhost:8082/callback/google

🚀 Other Endpoints:
   • Health: GET http://localhost:8082/health
   • MCP: POST http://localhost:8082/mcp
   • tRPC: POST http://localhost:8082/trpc/*

🔧 Test with MCP Jam:
   1. Discovery URL: http://localhost:8082/.well-known/oauth-authorization-server
   2. Authorization endpoint: http://localhost:8082/oauth/authorize  
   3. Token endpoint: http://localhost:8082/oauth/token
   4. Registration endpoint: http://localhost:8082/oauth/register
  `);
}).catch(console.error);

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Shutting down OAuth test server...');
  server.stop().then(() => process.exit(0));
});

process.on('SIGINT', () => {
  console.log('Shutting down OAuth test server...');
  server.stop().then(() => process.exit(0));
});