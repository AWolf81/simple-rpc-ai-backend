#!/usr/bin/env node

/**
 * Example OpenSaaS Monetized AI Server
 * 
 * This example demonstrates how to create a fully monetized AI backend server
 * with configurable subscription tiers, usage tracking, and billing integration.
 */

import { createMonetizedAIServer, createOpenSaaSConfig, EXAMPLE_CUSTOM_TIERS } from '../dist/monetization/opensaas-server.js';

// Example configuration with custom subscription tiers
const customTiers = {
  // Free tier for trial users
  free: {
    name: 'Free Trial',
    monthlyTokenQuota: 1000,
    rpmLimit: 5,
    tpmLimit: 100,
    concurrentRequests: 1,
    features: ['basic_ai']
  },

  // Hobby tier for individual developers
  hobby: {
    name: 'Hobby',
    monthlyTokenQuota: 25000,
    rpmLimit: 30,
    tpmLimit: 3000,
    concurrentRequests: 3,
    features: ['basic_ai', 'email_support']
  },

  // Professional tier for small teams
  professional: {
    name: 'Professional',
    monthlyTokenQuota: 150000,
    rpmLimit: 150,
    tpmLimit: 15000,
    concurrentRequests: 10,
    features: ['basic_ai', 'advanced_ai', 'priority_support', 'analytics']
  },

  // Team tier for growing businesses
  team: {
    name: 'Team',
    monthlyTokenQuota: 500000,
    rpmLimit: 500,
    tpmLimit: 50000,
    concurrentRequests: 25,
    features: ['basic_ai', 'advanced_ai', 'priority_support', 'analytics', 'team_management']
  },

  // Enterprise tier for large organizations
  enterprise: {
    name: 'Enterprise',
    monthlyTokenQuota: 2000000,
    rpmLimit: 2000,
    tpmLimit: 200000,
    concurrentRequests: 100,
    features: ['basic_ai', 'advanced_ai', 'priority_support', 'analytics', 'team_management', 'custom_models', 'sla', 'dedicated_support']
  }
};

// Create OpenSaaS configuration
const opensaasConfig = createOpenSaaSConfig({
  opensaasPublicKey: process.env.OPENSAAS_PUBLIC_KEY || 'your-opensaas-public-key-here',
  audience: 'ai-backend.yourcompany.com',
  issuer: 'https://auth.yourcompany.com',
  customTiers: customTiers,
  platformFeePercentage: 15, // 15% platform fee
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  billingProvider: 'opensaas'
});

// Server configuration
const serverConfig = {
  port: process.env.PORT || 8000,
  
  // Database configuration
  database: {
    path: process.env.DATABASE_PATH || './data/monetized-ai.db'
  },

  // AI service providers (your existing configuration)
  serviceProviders: {
    anthropic: {
      apiKey: process.env.ANTHROPIC_API_KEY,
      models: ['claude-3-sonnet', 'claude-3-haiku']
    },
    openai: {
      apiKey: process.env.OPENAI_API_KEY,
      models: ['gpt-4', 'gpt-3.5-turbo']
    }
  },

  // CORS configuration
  cors: {
    origin: [
      'https://yourapp.com',
      'https://staging.yourapp.com',
      'http://localhost:3000',
      'vscode-webview://*'
    ],
    credentials: true
  },

  // System prompts
  systemPrompts: {
    'code-review': {
      content: `You are an expert code reviewer. Analyze the provided code for:
1. Best practices and code quality
2. Potential bugs and security issues
3. Performance optimizations
4. Maintainability improvements

Provide constructive feedback with specific suggestions.`,
      name: 'Code Review Assistant',
      description: 'Reviews code for quality, security, and best practices',
      category: 'development',
      features: ['advanced_ai'] // Requires advanced AI feature
    },

    'documentation': {
      content: `You are a technical documentation specialist. Help create clear, comprehensive documentation for the provided code or feature.

Focus on:
- Clear explanations for different skill levels
- Practical examples and use cases
- API documentation if applicable
- Installation and setup instructions`,
      name: 'Documentation Assistant',
      description: 'Creates technical documentation',
      category: 'development',
      features: ['basic_ai']
    },

    'business-analysis': {
      content: `You are a business analyst. Analyze the provided business scenario, data, or question.

Provide insights on:
- Market trends and opportunities
- Risk assessment
- Strategic recommendations
- Data-driven conclusions

Use professional business language and cite relevant frameworks when applicable.`,
      name: 'Business Analysis Assistant',
      description: 'Provides business insights and analysis',
      category: 'business',
      features: ['analytics'] // Requires analytics feature
    }
  },

  // OpenSaaS monetization configuration
  opensaasMonetization: opensaasConfig
};

// Start the server
async function startServer() {
  try {
    console.log('🚀 Starting OpenSaaS Monetized AI Server...');
    console.log(`📋 Custom subscription tiers: ${Object.keys(customTiers).join(', ')}`);
    
    const server = await createMonetizedAIServer(serverConfig);
    
    // Start the server
    const httpServer = server.start();
    
    console.log('✅ Server started successfully!');
    console.log('🔗 Available endpoints:');
    console.log('   • POST /rpc - Main JSON-RPC endpoint');
    console.log('   • GET /health - Health check');
    console.log('   • GET /config - Server configuration');
    console.log('   • POST /webhooks/opensaas - OpenSaaS webhooks');
    console.log('   • GET /admin/analytics - Admin analytics (requires auth)');
    
    console.log('\n💡 Example usage:');
    console.log(`
curl -X POST http://localhost:${serverConfig.port}/rpc \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer your-opensaas-jwt-token" \\
  -d '{
    "jsonrpc": "2.0",
    "method": "executeAIRequest",
    "params": {
      "content": "Review this JavaScript function for security issues",
      "promptId": "code-review"
    },
    "id": 1
  }'
    `);

    // Graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\n🛑 Gracefully shutting down...');
      await server.stop();
      httpServer.close(() => {
        console.log('✅ Server stopped successfully');
        process.exit(0);
      });
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    process.exit(1);
  }
}

// Validate environment variables
function validateEnvironment() {
  const required = [
    'OPENSAAS_PUBLIC_KEY',
    'ANTHROPIC_API_KEY'
  ];

  const missing = required.filter(env => !process.env[env]);
  
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:');
    missing.forEach(env => console.error(`   • ${env}`));
    console.error('\nPlease set these environment variables and try again.');
    process.exit(1);
  }
}

// Example of how to extend with custom tier validation
function customTierValidation(req, res, next) {
  if (req.authContext?.subscriptionTier === 'free') {
    // Free tier users get limited access
    const restrictedMethods = ['admin.getAnalytics', 'enterprise.customModel'];
    if (restrictedMethods.includes(req.body.method)) {
      return res.status(403).json({
        error: {
          code: -32003,
          message: 'Upgrade required for this feature',
          data: {
            currentTier: 'free',
            requiredTier: 'hobby',
            upgradeUrl: 'https://yourapp.com/billing/upgrade'
          }
        }
      });
    }
  }
  next();
}

// Start the server
if (import.meta.url === `file://${process.argv[1]}`) {
  validateEnvironment();
  startServer();
}

export { serverConfig, customTiers };