/**
 * Example: Virtual Token Tracking with JWT Authentication
 * 
 * This example demonstrates the complete virtual token tracking flow:
 * 1. Server initialization with token tracking enabled
 * 2. JWT authentication setup
 * 3. Token balance checking and usage tracking
 * 4. LemonSqueezy webhook integration
 */

import { createRpcAiServer } from '../../dist/index.js';

async function runTokenTrackingExample() {
  console.log('🚀 Starting RPC AI Server with Virtual Token Tracking...\n');

  // Configure server with virtual token tracking and JWT authentication
  const server = createRpcAiServer({
    port: 8001,
    
    // Enable both protocols for demonstration
    protocols: {
      jsonRpc: true,
      tRpc: true
    },
    
    // Enable virtual token tracking with 80/20 split
    tokenTracking: {
      enabled: true,
      platformFeePercent: 25, // 20% of total charge (25% of actual usage)
      databaseUrl: process.env.DATABASE_URL || 'postgresql://user:password@localhost:5432/rpc_ai_tokens',
      webhookSecret: process.env.LEMONSQUEEZY_WEBHOOK_SECRET || 'your-webhook-secret',
      webhookPath: '/webhooks/lemonsqueezy'
    },
    
    // JWT authentication for user identification
    jwt: {
      secret: process.env.OPENSAAS_JWT_SECRET || 'your-jwt-secret',
      issuer: 'opensaas',
      audience: 'rpc-ai-backend'
    },
    
    // AI limits configuration
    aiLimits: {
      content: { maxLength: 100_000 },
      tokens: { maxTokenLimit: 10_000, defaultMaxTokens: 2048 },
      systemPrompt: { maxLength: 10_000 }
    }
  });

  try {
    await server.start();
    
    console.log('\n📊 Virtual Token Tracking Features:');
    console.log('   • 80/20 Split: 80% usable tokens, 20% platform fee');
    console.log('   • JWT Authentication: Secure user identification');
    console.log('   • Token Balance Tracking: PostgreSQL-based persistence');
    console.log('   • LemonSqueezy Integration: Automated token top-ups');
    console.log('   • Usage Analytics: Detailed tracking per user/request');
    
    console.log('\n🔗 Available Endpoints:');
    console.log('   • tRPC AI Router: POST http://localhost:8001/trpc/ai.executeAIRequest');
    console.log('   • tRPC Token Balance: POST http://localhost:8001/trpc/ai.getTokenBalance');
    console.log('   • tRPC Usage History: POST http://localhost:8001/trpc/ai.getUsageHistory');
    console.log('   • LemonSqueezy Webhook: POST http://localhost:8001/webhooks/lemonsqueezy');
    
    console.log('\n🔐 Authentication Flow:');
    console.log('   1. Obtain JWT token from OpenSaaS');
    console.log('   2. Include in Authorization header: Bearer <jwt-token>');
    console.log('   3. User ID extracted from JWT for token tracking');
    console.log('   4. Balance checked before AI requests');
    console.log('   5. Actual usage deducted with platform fee');
    
    console.log('\n💰 Token Economics:');
    console.log('   • User purchases tokens via LemonSqueezy');
    console.log('   • 80% credited to user balance (usable)');
    console.log('   • 20% retained as platform fee');
    console.log('   • AI usage charged at actual + 25% fee');
    console.log('   • Example: 1000 token AI request = 1250 tokens charged');
    
    console.log('\n✨ Example tRPC Request (with authentication):');
    console.log(`
    curl -X POST http://localhost:8001/trpc/ai.executeAIRequest \\
      -H "Content-Type: application/json" \\
      -H "Authorization: Bearer <your-jwt-token>" \\
      -d '{
        "content": "console.log(\\"Hello World\\");",
        "systemPrompt": "You are a helpful code reviewer. Analyze this code briefly.",
        "options": {
          "maxTokens": 500,
          "model": "claude-3-5-sonnet-20241022"
        }
      }'
    `);
    
    console.log('\n✨ Example Token Balance Check:');
    console.log(`
    curl -X POST http://localhost:8001/trpc/ai.getTokenBalance \\
      -H "Content-Type: application/json" \\
      -H "Authorization: Bearer <your-jwt-token>"
    `);
    
    console.log('\n🪝 LemonSqueezy Webhook Example:');
    console.log('   When user purchases tokens, LemonSqueezy sends webhook to:');
    console.log('   POST http://localhost:8001/webhooks/lemonsqueezy');
    console.log('   • Server verifies webhook signature');
    console.log('   • Processes payment and credits tokens');
    console.log('   • Applies 80/20 split automatically');
    
    console.log('\n⚖️ Platform Fee Structure:');
    console.log('   • Purchase: 1000 tokens → 800 usable + 200 platform fee');
    console.log('   • Usage: 100 actual tokens → 125 tokens charged');
    console.log('   • Breakdown: 100 to AI provider + 25 platform fee');
    
    console.log('\n🎯 Use Cases:');
    console.log('   • SaaS platforms with AI features');
    console.log('   • Corporate environments with proxy bypass');
    console.log('   • Multi-tenant applications');
    console.log('   • Usage-based billing systems');
    
    console.log('\n▶️  Server is running! Press Ctrl+C to stop.\n');
    
    // Keep server running
    process.on('SIGINT', async () => {
      console.log('\n🛑 Shutting down server...');
      await server.stop();
      process.exit(0);
    });
    
  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    process.exit(1);
  }
}

// Run the example
runTokenTrackingExample().catch(console.error);