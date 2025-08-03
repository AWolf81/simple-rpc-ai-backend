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
  requireAuth: true, // Require authentication for all AI requests
  
  // Simplified OAuth authentication (recommended approach)
  oauthAuth: {
    allowedProviders: ['github', 'microsoft'], // Support both providers
    
    // Access control mode - choose one:
    accessMode: 'open',              // 'open' | 'allowlist' | 'development'
    
    // For development mode: Only these users can access
    allowedUsers: [
      // 'developer1@company.com',
      // 'developer2@company.com'
    ],
    
    allowedOrgs: [
      // Add GitHub organization names to restrict access
      // 'your-company',
      // 'your-team'
    ],
    
    requireVerifiedEmail: true,
    sessionExpirationMs: 24 * 60 * 60 * 1000, // 24 hours
    
    // Admin security controls (runtime manageable)
    blacklistedUsers: [
      // Initial blocked users (can add more via RPC)
      // 'spam@example.com'
    ],
    
    rateLimiting: {
      maxRequestsPerHour: 100,        // Max auth attempts per user per hour
      maxSessionsPerUser: 5,          // Max concurrent sessions per user
      autoBlacklistThreshold: 3       // Auto-blacklist after 3 violations
    },
    
    persistUserManagement: true,      // Store user management in database
    
    // User limits for public beta launches
    userLimits: {
      maxUsers: 1000,              // Maximum 1000 total users (set to 0 to disable)
      maxActiveUsers: 100,         // Maximum 100 concurrent active users (optional)
      waitlistEnabled: true,       // Enable waiting list when limit reached
      adminBypassLimits: true      // Allow admins to bypass user limits (default: true)
    },
    
    // Role-based access control
    superAdmins: [
      // 'founder@company.com'         // Initial super admin (can create other admins)
    ],
    initialAdmins: [
      // 'admin1@company.com',         // Initial admins (can manage users, not create admins)
      // 'admin2@company.com'
    ]
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

  // CORS for local development - temporarily allow all origins for debugging
  cors: {
    origin: true, // Allow all origins temporarily
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

console.log('\n👥 User Limits (Public Beta):');
console.log('   • maxUsers: Maximum total users allowed to register');
console.log('   • waitlistEnabled: Add users to waitlist when limit reached');
console.log('   • adminBypassLimits: Allow admins to bypass user limits');

// Show configuration details
const oauthConfig = serverConfig.oauthAuth;
console.log('\n⚙️ Current OAuth Configuration:');
console.log(`   📱 Providers: ${oauthConfig.allowedProviders.join(', ')}`);
console.log(`   👥 User restrictions: ${oauthConfig.allowedUsers?.length ? oauthConfig.allowedUsers.length + ' users configured' : 'Any authenticated user'}`);
console.log(`   🏢 Org restrictions: ${oauthConfig.allowedOrgs?.length ? oauthConfig.allowedOrgs.join(', ') : 'None'}`);
console.log(`   📧 Require verified email: ${oauthConfig.requireVerifiedEmail ? 'Yes' : 'No'}`);
console.log(`   ⏱️  Session duration: ${oauthConfig.sessionExpirationMs / (1000 * 60 * 60)} hours`);

// Show user limits configuration
const userLimits = oauthConfig.userLimits;
if (userLimits?.maxUsers && userLimits.maxUsers > 0) {
  console.log(`   👥 User limits: ${userLimits.maxUsers} max users`);
  console.log(`   📝 Waitlist: ${userLimits.waitlistEnabled ? 'Enabled' : 'Disabled'}`);
  console.log(`   👑 Admin bypass: ${userLimits.adminBypassLimits !== false ? 'Enabled' : 'Disabled'}`);
} else {
  console.log(`   👥 User limits: Disabled (unlimited users)`);
}

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

console.log('\n🔧 User Limits Admin Examples:');
console.log(`
# Get user statistics (admin required)
curl -X POST http://localhost:8000/rpc \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ADMIN_SESSION_TOKEN" \\
  -d '{
    "jsonrpc": "2.0",
    "method": "admin.getUserStats",
    "id": 1
  }'

# Set user limit to 100 users (admin required)
curl -X POST http://localhost:8000/rpc \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ADMIN_SESSION_TOKEN" \\
  -d '{
    "jsonrpc": "2.0",
    "method": "admin.setUserLimit",
    "params": {"limit": 100},
    "id": 2
  }'

# Add 50 more user slots (admin required)
curl -X POST http://localhost:8000/rpc \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ADMIN_SESSION_TOKEN" \\
  -d '{
    "jsonrpc": "2.0",
    "method": "admin.addUserSlots",
    "params": {"slots": 50},
    "id": 3
  }'

# View waitlist (admin required)
curl -X POST http://localhost:8000/rpc \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ADMIN_SESSION_TOKEN" \\
  -d '{
    "jsonrpc": "2.0",
    "method": "admin.getWaitlist",
    "id": 4
  }'

# Grant special access to coworker (above limit)
curl -X POST http://localhost:8000/rpc \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ADMIN_SESSION_TOKEN" \\
  -d '{
    "jsonrpc": "2.0",
    "method": "admin.grantSpecialAccess",
    "params": {"email": "coworker@company.com", "reason": "Team member"},
    "id": 5
  }'

# Promote specific user from waitlist
curl -X POST http://localhost:8000/rpc \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ADMIN_SESSION_TOKEN" \\
  -d '{
    "jsonrpc": "2.0",
    "method": "admin.promoteFromWaitlist",
    "params": {"email": "friend@example.com"},
    "id": 6
  }'

# Bulk grant access to multiple friends
curl -X POST http://localhost:8000/rpc \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ADMIN_SESSION_TOKEN" \\
  -d '{
    "jsonrpc": "2.0",
    "method": "admin.bulkGrantSpecialAccess",
    "params": {
      "emails": ["friend1@example.com", "friend2@example.com", "family@example.com"],
      "reason": "Friends and family beta access"
    },
    "id": 7
  }'

# View users with special access
curl -X POST http://localhost:8000/rpc \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ADMIN_SESSION_TOKEN" \\
  -d '{
    "jsonrpc": "2.0",
    "method": "admin.getSpecialAccessUsers",
    "id": 8
  }'
`);

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down server...');
  stop();
  process.exit(0);
});

export { serverConfig };