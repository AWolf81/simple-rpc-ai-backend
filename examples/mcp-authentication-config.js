/**
 * MCP Authentication Configuration Examples
 * 
 * This file shows different ways to configure MCP authentication
 * with JWT, OAuth, or both authentication methods.
 */

import { createRpcAiServer } from 'simple-rpc-ai-backend';

// Example 1: JWT-only authentication (great for OpenSaaS integration)
const jwtOnlyServer = createRpcAiServer({
  port: 8001,
  serverProviders: ['anthropic'],
  jwt: {
    secret: process.env.JWT_SECRET,
    issuer: 'your-opensaas-service',
    audience: 'your-ai-backend'
  },
  mcp: {
    enableMCP: true,
    auth: {
      authType: 'jwt', // Use JWT authentication only
      requireAuthForToolsList: true,
      requireAuthForToolsCall: true,
      publicTools: [], // No public tools - everything requires auth
      jwt: {
        enabled: true,
        requireValidSignature: true,
        requiredScopes: ['mcp', 'mcp:call'], // Required scopes
        allowExpiredTokens: false
      },
      oauth: {
        enabled: false // Disable OAuth
      }
    }
  }
});

// Example 2: OAuth-only authentication (backward compatible)
const oauthOnlyServer = createRpcAiServer({
  port: 8002,
  serverProviders: ['anthropic'],
  mcp: {
    enableMCP: true,
    auth: {
      authType: 'oauth', // Use OAuth authentication only
      requireAuthForToolsList: false,
      requireAuthForToolsCall: true,
      publicTools: ['greeting'], // Some tools are public
      oauth: {
        enabled: true,
        sessionStorePath: './data/oauth-sessions.json',
        requireValidSession: true
      },
      jwt: {
        enabled: false // Disable JWT
      }
    }
  }
});

// Example 3: Both JWT and OAuth (JWT first, OAuth fallback)
const hybridAuthServer = createRpcAiServer({
  port: 8003,
  serverProviders: ['anthropic'],
  jwt: {
    secret: process.env.JWT_SECRET,
    issuer: 'your-opensaas-service',
    audience: 'your-ai-backend'
  },
  mcp: {
    enableMCP: true,
    auth: {
      authType: 'both', // Accept both JWT and OAuth tokens
      requireAuthForToolsList: true,
      requireAuthForToolsCall: true,
      publicTools: [],
      jwt: {
        enabled: true,
        requireValidSignature: true,
        requiredScopes: ['mcp'], // JWT tokens need MCP scope
        allowExpiredTokens: false
      },
      oauth: {
        enabled: true,
        sessionStorePath: './data/oauth-sessions.json',
        requireValidSession: true
      }
    }
  }
});

// Example 4: No authentication (for development/testing only)
const noAuthServer = createRpcAiServer({
  port: 8004,
  serverProviders: ['anthropic'],
  mcp: {
    enableMCP: true,
    auth: {
      authType: 'none', // No authentication required
      requireAuthForToolsList: false,
      requireAuthForToolsCall: false,
      publicTools: ['*'] // All tools are public
    }
  }
});

// Usage examples:

async function startExamples() {
  console.log('Starting MCP authentication examples...');
  
  // Start JWT-only server
  await jwtOnlyServer.start();
  console.log('✅ JWT-only server running on port 8001');
  console.log('   Test with: curl -H "Authorization: Bearer <jwt-token>" http://localhost:8001/mcp');
  
  // Start OAuth-only server  
  await oauthOnlyServer.start();
  console.log('✅ OAuth-only server running on port 8002');
  console.log('   Test with: curl -H "Authorization: Bearer <oauth-token>" http://localhost:8002/mcp');
  
  // Start hybrid auth server
  await hybridAuthServer.start();
  console.log('✅ Hybrid auth server running on port 8003');
  console.log('   Test with JWT: curl -H "Authorization: Bearer <jwt-token>" http://localhost:8003/mcp');
  console.log('   Test with OAuth: curl -H "Authorization: Bearer <oauth-token>" http://localhost:8003/mcp');
  
  // Start no-auth server (development only)
  await noAuthServer.start();
  console.log('✅ No-auth server running on port 8004');
  console.log('   Test with: curl http://localhost:8004/mcp');
  
  console.log('\n🔐 Authentication Flow:');
  console.log('   1. JWT tokens are validated using the JWT middleware');
  console.log('   2. OAuth tokens are validated against session storage');
  console.log('   3. "both" mode tries JWT first, then OAuth if JWT fails');
  console.log('   4. Required scopes are enforced for each authentication type');
  
  console.log('\n📝 JWT Token Example:');
  console.log('   {');
  console.log('     "userId": "user-123",');
  console.log('     "email": "user@example.com",');
  console.log('     "subscriptionTier": "pro",');
  console.log('     "scope": "mcp mcp:call mcp:admin"  // Space-separated scopes');
  console.log('   }');
}

if (require.main === module) {
  startExamples().catch(console.error);
}

export {
  jwtOnlyServer,
  oauthOnlyServer,
  hybridAuthServer,
  noAuthServer
};