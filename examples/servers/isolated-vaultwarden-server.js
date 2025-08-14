/**
 * Isolated Vaultwarden Server Example
 * 
 * Demonstrates auto-provisioning isolated Vaultwarden users
 * Supports OpenSaaS email/password + OAuth2 providers
 */

import { createAIServerAsync } from '../../dist/server.js';
import { VaultwardenAutoProvisioning } from '../../dist/auth/VaultwardenAutoProvisioning.js';
import { UserIdentityBridge } from '../../dist/auth/UserIdentityBridge.js';
import { EnhancedVaultwardenMethods } from '../../dist/rpc/enhancedVaultwardenMethods.js';
import winston from 'winston';
import dotenv from 'dotenv';

// Load Vaultwarden configuration
dotenv.config({ path: '.env.vaultwarden' });

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [new winston.transports.Console()]
});

console.log('🚀 Starting Isolated Vaultwarden AI Server');
console.log('==========================================');

/**
 * Server with automatic user provisioning and vault isolation
 */
async function startIsolatedVaultwardenServer() {
  try {
    // Initialize existing Vaultwarden components
    const bitwardenConfig = {
      serverUrl: process.env.VW_DOMAIN || 'http://localhost:8081',
      clientId: process.env.VW_SERVICE_CLIENT_ID,
      clientSecret: process.env.VW_SERVICE_ACCESS_TOKEN,
      masterPassword: process.env.VW_SERVICE_PASSWORD,
      organizationId: process.env.SIMPLE_RPC_ORG_ID || 'rpc-api-org'
    };

    // Use existing UserIdentityBridge
    const userBridge = new UserIdentityBridge(bitwardenConfig, logger);
    await userBridge.initialize();

    // Use existing VaultwardenAutoProvisioning
    const autoProvisioning = new VaultwardenAutoProvisioning(
      bitwardenConfig,
      userBridge,
      logger
    );
    await autoProvisioning.initialize();

    // Create enhanced methods that extend existing functionality
    const enhancedMethods = new EnhancedVaultwardenMethods(
      autoProvisioning,
      userBridge,
      logger
    );

    // Test system health
    const healthCheck = await userBridge.healthCheck();
    if (healthCheck.status === 'unhealthy') {
      throw new Error(`User bridge unhealthy: ${healthCheck.details.error}`);
    }
    
    console.log('✅ Existing Vaultwarden system ready (no duplicate code!)');
    console.log(`🏢 Organization: ${process.env.SIMPLE_RPC_ORG_ID}`);
    
    // Create AI server with enhanced methods
    const server = await createAIServerAsync({
      port: 8000,
      serviceProviders: ['anthropic', 'openai', 'google'],
      
      // Enhanced methods that reuse existing architecture
      customMethods: {
        // OAuth2-enhanced methods
        'storeApiKeyWithOAuth': enhancedMethods.storeApiKeyWithOAuth.bind(enhancedMethods),
        'getUserKeyWithOAuth': enhancedMethods.getUserKeyWithOAuth.bind(enhancedMethods),
        
        // Existing methods still available
        'vaultwarden.onboardUser': enhancedMethods.onboardUser.bind(enhancedMethods),
        'vaultwarden.completeSetup': enhancedMethods.completeSetup.bind(enhancedMethods),
        'vaultwarden.getShortLivedToken': enhancedMethods.getShortLivedToken.bind(enhancedMethods),
        'vaultwarden.storeEncryptedKey': enhancedMethods.storeEncryptedKey.bind(enhancedMethods),
        'vaultwarden.retrieveEncryptedKey': enhancedMethods.retrieveEncryptedKey.bind(enhancedMethods),
        'vaultwarden.getAccountStatus': enhancedMethods.getAccountStatus.bind(enhancedMethods)
      },

      // CORS for web clients
      cors: {
        origin: [
          'vscode-webview://*',
          'http://localhost:*',
          'https://localhost:*',
          'https://*.vercel.app',
          'https://*.netlify.app'
        ],
        credentials: true
      },

      // Rate limiting
      rateLimit: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 100 // per window
      }
    });

    // Add health check endpoint for existing system
    server.app.get('/health/vaultwarden', async (req, res) => {
      const health = await userBridge.healthCheck();
      res.json({
        status: health.status,
        details: health.details,
        timestamp: new Date().toISOString()
      });
    });

    // Start server
    const httpServer = server.start(8000);
    
    console.log('');
    console.log('🎉 Isolated Vaultwarden AI Server Running!');
    console.log('==========================================');
    console.log('📍 Server: http://localhost:8000');
    console.log('🏥 Health: http://localhost:8000/health/vaultwarden');
    console.log('');
    console.log('📋 Available RPC Methods:');
    console.log('   🆕 Enhanced OAuth2 Methods:');
    console.log('   • storeApiKeyWithOAuth - Store with Google/GitHub/Microsoft/Auth0');
    console.log('   • getUserKeyWithOAuth  - Retrieve with OAuth2 tokens');
    console.log('   📋 Existing Vaultwarden Methods:');
    console.log('   • vaultwarden.onboardUser       - OpenSaaS user onboarding');
    console.log('   • vaultwarden.storeEncryptedKey - Store with JWT auth');
    console.log('   • vaultwarden.retrieveEncryptedKey - Retrieve with short-lived token');
    console.log('   • executeAIRequest - Execute AI request with isolated keys');
    console.log('');
    console.log('🔐 Authentication Methods Supported:');
    console.log('   • OpenSaaS JWT    - opensaasJWT parameter');
    console.log('   • Google OAuth    - oauthToken with Google credentials');
    console.log('   • GitHub OAuth    - oauthToken with GitHub credentials');
    console.log('   • Microsoft OAuth - oauthToken with Microsoft credentials');
    console.log('   • Auth0 OAuth     - oauthToken with Auth0 credentials');
    console.log('');
    console.log('🏗️ Architecture (Reuses Existing Code):');
    console.log('   • UserIdentityBridge - Maps users to Vaultwarden accounts');
    console.log('   • VaultwardenAutoProvisioning - Auto-creates user accounts');
    console.log('   • EnhancedVaultwardenMethods - Adds OAuth2 support');
    console.log('   • Service account for admin operations only');
    console.log('   • No duplicate code - extends existing functionality!');
    console.log('');

    // Graceful shutdown
    process.on('SIGINT', () => {
      console.log('\n🛑 Shutting down server...');
      httpServer.close(() => {
        server.stop();
        console.log('✅ Server stopped gracefully');
        process.exit(0);
      });
    });

    return { server, userBridge, autoProvisioning, enhancedMethods };

  } catch (error) {
    console.error('💥 Server startup failed:', error.message);
    process.exit(1);
  }
}

/**
 * Example usage scenarios
 */
function printExampleUsage() {
  console.log('📝 Example Usage:');
  console.log('');
  
  console.log('1. Store API Key with OpenSaaS JWT:');
  console.log('```javascript');
  console.log('const response = await fetch("http://localhost:8000/rpc", {');
  console.log('  method: "POST",');
  console.log('  headers: { "Content-Type": "application/json" },');
  console.log('  body: JSON.stringify({');
  console.log('    jsonrpc: "2.0",');
  console.log('    method: "storeUserKey",');
  console.log('    params: {');
  console.log('      opensaasJWT: "eyJ...", // JWT with user claims');
  console.log('      provider: "anthropic",');
  console.log('      apiKey: "sk-ant-..."');
  console.log('    },');
  console.log('    id: 1');
  console.log('  })');
  console.log('});');
  console.log('```');
  console.log('');
  
  console.log('2. Store API Key with Google OAuth:');
  console.log('```javascript');
  console.log('await fetch("http://localhost:8000/rpc", {');
  console.log('  method: "POST",');
  console.log('  headers: { "Content-Type": "application/json" },');
  console.log('  body: JSON.stringify({');
  console.log('    jsonrpc: "2.0",');
  console.log('    method: "storeUserKey",');
  console.log('    params: {');
  console.log('      oauthToken: "google-oauth-token", // Google access token');
  console.log('      provider: "openai",');
  console.log('      apiKey: "sk-..."');
  console.log('    },');
  console.log('    id: 2');
  console.log('  })');
  console.log('});');
  console.log('```');
  console.log('');

  console.log('3. Execute AI Request (uses isolated vault):');
  console.log('```javascript');
  console.log('await fetch("http://localhost:8000/rpc", {');
  console.log('  method: "POST",');
  console.log('  headers: { "Content-Type": "application/json" },');
  console.log('  body: JSON.stringify({');
  console.log('    jsonrpc: "2.0",');
  console.log('    method: "executeAIRequest",');
  console.log('    params: {');
  console.log('      opensaasJWT: "eyJ...",');
  console.log('      content: "Explain how isolated vaults work",');
  console.log('      systemPrompt: "code-expert",');
  console.log('      provider: "anthropic" // Uses user\'s isolated API key');
  console.log('    },');
  console.log('    id: 3');
  console.log('  })');
  console.log('});');
  console.log('```');
  console.log('');
}

// Start the server
if (import.meta.url === `file://${process.argv[1]}`) {
  startIsolatedVaultwardenServer()
    .then(() => {
      setTimeout(printExampleUsage, 1000);
    })
    .catch(console.error);
}

export { startIsolatedVaultwardenServer };