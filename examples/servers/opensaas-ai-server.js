/**
 * OpenSaaS AI Server Example
 * 
 * Complete AI server with OpenSaaS authentication for VS Code extensions
 * This server properly validates JWT tokens from OpenSaaS and provides
 * both JSON-RPC and tRPC endpoints with authentication.
 */

import { createRpcAiServer } from '../../dist/index.js';

console.log(`
🔐 OpenSaaS AI Server Example

This example shows how to configure OpenSaaS authentication:
✅ JWT token validation
✅ User authentication for all AI requests  
✅ Development mode with mock authentication
✅ Both tRPC and JSON-RPC support
`);

// Development OpenSaaS configuration
// In production, these values would come from your OpenSaaS setup
const opensaasConfig = {
  // OpenSaaS JWT configuration
  opensaas: {
    publicKey: process.env.OPENSAAS_PUBLIC_KEY || 'dev-public-key-not-for-production',
    audience: process.env.OPENSAAS_AUDIENCE || 'ai-backend-dev',
    issuer: process.env.OPENSAAS_ISSUER || 'opensaas-dev',
    clockTolerance: 60 // Allow 60 seconds clock skew for development
  },
  
  // Billing configuration (disabled for development)
  billing: {
    platformFee: {
      percentage: 0 // No fees in development
    },
    billingProvider: 'opensaas',
    enableUsageBasedBilling: false // Disabled for development
  },
  
  // Authentication settings
  authentication: {
    requireAuthForAllMethods: false, // Allow some unauthenticated access in dev
    skipAuthForMethods: ['health', 'rpc.discover', 'ai.health', 'ai.listProviders'] // Skip auth for these methods
  }
};

// Create server with OpenSaaS authentication
const server = createRpcAiServer({
  port: 8000,
  
  // Enable both protocols for maximum compatibility
  protocols: { 
    jsonRpc: true,  // For simple clients
    tRpc: true      // For TypeScript clients
  },
  
  // JWT authentication configuration
  jwt: opensaasConfig.opensaas,
  
  // CORS configuration for VS Code extensions
  cors: {
    origin: [
      'http://localhost:*', 
      'https://localhost:*',
      'vscode-webview://*',
      'vscode://*'
    ],
    credentials: true
  },
  
  // Development-friendly rate limiting
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000 // Higher limit for development
  },
  
  // AI providers configuration
  serverProviders: ['anthropic'],
  byokProviders: ['anthropic', 'openai', 'google']
});

// Start the server
console.log('Starting OpenSaaS AI server...');
server.start().then(() => {
  console.log(`
✅ OpenSaaS AI Server running!

📍 Endpoints:
   • Health: GET http://localhost:8000/health
   • JSON-RPC: POST http://localhost:8000/rpc
   • tRPC: POST http://localhost:8000/trpc/*

🔐 Authentication:
   • JWT tokens from OpenSaaS accepted
   • Development mode: relaxed validation
   • Some endpoints available without auth

🎯 VS Code Extension Usage:
   1. Extension sends OpenSaaS JWT token in Authorization header
   2. Server validates token and extracts user info
   3. AI requests work with proper authentication
   
💡 Environment Variables (for production):
   • OPENSAAS_PUBLIC_KEY: Your OpenSaaS public key
   • OPENSAAS_AUDIENCE: Your service identifier  
   • OPENSAAS_ISSUER: OpenSaaS issuer URL
   • ANTHROPIC_API_KEY: Your Anthropic API key
  `);
}).catch(console.error);

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Shutting down OpenSaaS server...');
  server.stop().then(() => process.exit(0));
});

process.on('SIGINT', () => {
  console.log('Shutting down OpenSaaS server...');
  server.stop().then(() => process.exit(0));
});