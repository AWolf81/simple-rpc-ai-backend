/**
 * Simple OAuth Server Example
 * 
 * Demonstrates the simplified OAuth authentication approach.
 * Uses VS Code's built-in authentication providers - no private keys needed!
 */

import { createAIServer } from '../../dist/server.js';

console.log('🚀 Starting Simple OAuth Server...');

const serverConfig = {
  port: 8000,
  mode: 'simple', // Simple mode - no user key management needed for OAuth demo
  
  // Simplified OAuth authentication (recommended approach)
  oauthAuth: {
    allowedProviders: ['github'], // VS Code has built-in support
    allowedUsers: [
      // Add your email addresses here to restrict access
      // 'your-email@example.com',
      // 'team-member@company.com'
    ],
    allowedOrgs: [
      // Add GitHub organization names to restrict access
      // 'your-company',
      // 'your-team'
    ],
    requireVerifiedEmail: true,
    sessionExpirationMs: 24 * 60 * 60 * 1000 // 24 hours
  },

  // AI service configuration
  serviceProviders: {
    anthropic: {
      apiKey: process.env.ANTHROPIC_API_KEY || 'demo-key',
      models: ['claude-3-sonnet-20240229'],
      maxTokens: 4000,
      priority: 1
    }
  },

  // No database needed in simple mode with OAuth

  // CORS for local development
  cors: {
    origin: ['vscode-webview://*', 'http://localhost:*'],
    credentials: true
  }
};

const { app, start, stop } = createAIServer(serverConfig);

// Start the server
const server = start();

console.log('\n🎉 Simple OAuth Server Running!');
console.log('📊 Available endpoints:');
console.log('   POST /auth/oauth     - OAuth authentication with GitHub');
console.log('   POST /auth/signout   - Sign out and invalidate session');
console.log('   POST /rpc            - JSON-RPC with OAuth authentication');
console.log('   GET  /health         - Server health check');
console.log('   GET  /config         - Server configuration');

console.log('\n🔐 OAuth Authentication Flow:');
console.log('   1. Extension calls vscode.authentication.getSession()');
console.log('   2. VS Code opens browser for GitHub OAuth (first time only)');
console.log('   3. User authenticates with GitHub');
console.log('   4. Extension gets OAuth token from VS Code');
console.log('   5. Extension sends token to POST /auth/oauth');
console.log('   6. Server validates token with GitHub API');
console.log('   7. Server creates session and returns session token');
console.log('   8. Extension uses session token for RPC calls');

console.log('\n✅ Security Benefits:');
console.log('   🔐 No private keys embedded in extension code');
console.log('   🌐 Uses VS Code\'s built-in OAuth providers');
console.log('   🛡️  Server validates tokens directly with GitHub');
console.log('   ⏰ Sessions expire automatically');
console.log('   🏢 Corporate-friendly (system prompts stay server-side)');

console.log('\n🧪 Test the server:');
console.log('   curl http://localhost:8000/health');
console.log('   curl http://localhost:8000/config');

console.log('\n📋 To restrict access, configure:');
console.log('   • allowedUsers: email addresses that can authenticate');
console.log('   • allowedOrgs: GitHub organizations for team access');
console.log('   • requireVerifiedEmail: ensure users have verified emails');

// Show configuration details
const oauthConfig = serverConfig.oauthAuth;
console.log('\n⚙️ Current OAuth Configuration:');
console.log(`   📱 Providers: ${oauthConfig.allowedProviders.join(', ')}`);
console.log(`   👥 User restrictions: ${oauthConfig.allowedUsers?.length ? oauthConfig.allowedUsers.length + ' users configured' : 'Any authenticated user'}`);
console.log(`   🏢 Org restrictions: ${oauthConfig.allowedOrgs?.length ? oauthConfig.allowedOrgs.join(', ') : 'None'}`);
console.log(`   📧 Require verified email: ${oauthConfig.requireVerifiedEmail ? 'Yes' : 'No'}`);
console.log(`   ⏱️  Session duration: ${oauthConfig.sessionExpirationMs / (1000 * 60 * 60)} hours`);

// Example API test
console.log('\n🔬 Example OAuth authentication test:');
console.log(`
# 1. Get OAuth token from GitHub (normally done by VS Code extension)
# This is just for testing - in real usage, VS Code handles this

# 2. Test OAuth authentication endpoint
curl -X POST http://localhost:8000/auth/oauth \\
  -H "Content-Type: application/json" \\
  -d '{
    "extensionId": "test.extension",
    "provider": "github", 
    "accessToken": "your_github_token_here",
    "deviceId": "test_device_123"
  }'

# 3. Use session token for RPC calls
curl -X POST http://localhost:8000/rpc \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer your_session_token_here" \\
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "executeAIRequest",
    "params": {
      "content": "Hello, how are you?",
      "systemPrompt": "You are a helpful AI assistant."
    }
  }'
`);

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down server...');
  stop();
  process.exit(0);
});

export { serverConfig };