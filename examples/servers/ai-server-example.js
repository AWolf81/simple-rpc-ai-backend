/**
 * AI Backend Server Example
 * 
 * Shows how to set up a unified RPC server with tRPC enabled for TypeScript projects
 */

import { createRpcAiServer, AI_LIMIT_PRESETS } from '../../dist/index.js';

console.log(`
🚀 tRPC AI Server Example

This example shows how to configure the unified server for TypeScript projects:
✅ tRPC enabled (auto-disables JSON-RPC)
✅ Generous AI limits for development
✅ CORS configured for local development
✅ Type safety across client and server
✅ MCP enabled
`);

// Unified server configuration with tRPC enabled
const server = createRpcAiServer({
  port: 8000,
  
  // Enable tRPC for TypeScript projects (auto-disables JSON-RPC)
  protocols: { tRpc: true, jsonRpc: true },
  
  // Use generous limits for development
  aiLimits: AI_LIMIT_PRESETS.generous,
  
  // CORS configuration for development
  cors: {
    origin: [
      'http://localhost:*', 
      'vscode-webview://*',
      'https://inspector.open-rpc.org',
      'https://playground.open-rpc.org'
    ],
    credentials: true
  },
  
  // Rate limiting for development
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5000 // Higher limit for development
  },

  mcp: {
    enableMCP: true,
    defaultConfig: {
      enableWebSearchTool: true,
      enableRefTools: true,      // Documentation search
      enableFilesystemTools: false // Disabled for security    
    }
  }
});

// Start the server
console.log('Starting tRPC AI server...');
server.start((app) => {
  // Example custom endpoint
  app.get('/hello', (req, res) => 
    res.send('Hello from AI Server!')
  );
}).then(() => {
  console.log(`
✅ tRPC AI Server running!

📍 Endpoints:
   • Health: GET http://localhost:8000/health
   • tRPC: POST http://localhost:8000/trpc/*   

📊 Configuration:
   • Protocol: tRPC only (TypeScript clients)
   • AI Limits: Generous (2MB content, 100k tokens)
   • CORS: Local development
   • Rate Limit: 5000 req/15min

🎯 Use this server with TypeScript clients for:
   • VS Code extensions (in monorepo)
   • React/Vue/Svelte web applications
   • Node.js applications with shared types

💡 For JSON-RPC examples, see basic-server.js
  `);
}).catch(console.error);

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Shutting down server...');
  server.stop().then(() => process.exit(0));
});

process.on('SIGINT', () => {
  console.log('Shutting down server...');
  server.stop().then(() => process.exit(0));
});