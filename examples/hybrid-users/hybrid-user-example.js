/**
 * Example: Hybrid User with Multiple Payment Methods
 * 
 * This example demonstrates how to handle users with:
 * - Subscription tokens (recurring)
 * - One-time token purchases  
 * - BYOK (Bring Your Own Key)
 * 
 * With smart consumption order and fallback logic
 */

import { createRpcAiServer } from '../../dist/rpc-ai-server.js';

async function runHybridUserExample() {
  console.log('🚀 Starting RPC AI Server with Hybrid User Support...\n');

  const server = createRpcAiServer({
    port: 8002,
    
    protocols: {
      jsonRpc: true,
      tRpc: true
    },
    
    // Enable hybrid user system
    tokenTracking: {
      enabled: true,
      platformFeePercent: 25,
      databaseUrl: process.env.DATABASE_URL || 'postgresql://user:password@localhost:5432/rpc_ai_tokens',
      webhookSecret: process.env.LEMONSQUEEZY_WEBHOOK_SECRET || 'your-webhook-secret'
    },
    
    jwt: {
      secret: process.env.OPENSAAS_JWT_SECRET || 'your-jwt-secret',
      issuer: 'opensaas',
      audience: 'rpc-ai-backend'
    }
  });

  try {
    await server.start();
    
    console.log('\n🔄 Hybrid User System Features:');
    console.log('   • Multiple Payment Methods: Subscription + One-time + BYOK');
    console.log('   • Smart Consumption Order: User-configurable preferences');
    console.log('   • Automatic Fallback: subscription → one-time → BYOK');
    console.log('   • Real-time Notifications: Low balance, fallback alerts');
    console.log('   • Granular Control: Per-provider BYOK configuration');
    
    console.log('\n💳 Payment Method Types:');
    console.log('   1. Subscription Tokens: Recurring monthly/yearly token allowance');
    console.log('   2. One-time Purchases: Token packs, credits, top-ups');
    console.log('   3. BYOK: User provides their own API keys (unlimited)');
    
    console.log('\n⚙️ User Configuration Examples:');
    console.log(`
    // Set consumption preferences
    await rpc.ai.updateUserPreferences({
      consumptionOrder: ['subscription', 'one_time', 'byok'],
      notifyTokenLowThreshold: 1000,
      notifyFallbackToByok: true,
      notifyOneTimeConsumed: true
    });
    
    // Configure BYOK providers
    await rpc.ai.configureBYOK({
      providers: {
        anthropic: { enabled: true, apiKey: 'user-claude-key' },
        openai: { enabled: true, apiKey: 'user-openai-key' },
        google: { enabled: false }
      },
      enabled: true
    });
    `);
    
    console.log('\n🎯 Smart Consumption Logic:');
    console.log(`
    User has:
    - 500 subscription tokens (from monthly plan)
    - 200 one-time tokens (from token pack purchase)
    - Anthropic API key configured (BYOK)
    
    Request needs 1000 tokens:
    1. Use 500 subscription tokens (balance: 0)
    2. Use 200 one-time tokens (balance: 0)
    3. Use BYOK for remaining 300 tokens
    4. Notify user about token consumption and fallback
    `);
    
    console.log('\n📊 Available RPC Methods:');
    console.log('   • getUserProfile() - Get user capabilities and preferences');
    console.log('   • updateUserPreferences() - Set consumption order and notifications');
    console.log('   • configureBYOK() - Setup API keys for fallback');
    console.log('   • getUserTokenBalances() - View all token balances');
    console.log('   • planConsumption() - Preview token usage before request');
    console.log('   • getConsumptionHistory() - Detailed consumption logs');
    
    console.log('\n🔄 Example API Request Flow:');
    console.log(`
    // 1. Check user profile and balances
    const profile = await rpc.ai.getUserProfile();
    const balances = await rpc.ai.getUserTokenBalances();
    
    // 2. Plan consumption for request
    const plan = await rpc.ai.planConsumption({ 
      estimatedTokens: 1500,
      hasApiKey: true 
    });
    
    // 3. Execute AI request (automatic smart consumption)
    const result = await rpc.ai.executeAIRequest({
      content: "Build a React component",
      systemPrompt: "You are a senior frontend developer",
      apiKey: "user-anthropic-key" // For BYOK fallback
    });
    
    // 4. Review consumption details
    console.log(result.consumption);
    // {
    //   tokensUsed: 1500,
    //   plan: [
    //     { type: 'subscription', tokensConsumed: 800 },
    //     { type: 'one_time', tokensConsumed: 300 },
    //     { type: 'byok', tokensConsumed: 400 }
    //   ],
    //   fallbackUsed: true,
    //   notifications: ["Used one-time tokens", "Fell back to BYOK"]
    // }
    `);
    
    console.log('\n💡 User Experience Benefits:');
    console.log('   • Seamless: Users don\\'t think about payment methods');
    console.log('   • Flexible: Multiple ways to access AI (subscription, purchase, BYOK)');
    console.log('   • Transparent: Clear breakdown of token consumption');
    console.log('   • Reliable: Always has fallback option (BYOK)');
    console.log('   • Configurable: Users control consumption preferences');
    
    console.log('\n🏢 Enterprise Scenarios:');
    console.log(`
    Scenario 1: Department with subscription + emergency BYOK
    - Primary: Monthly subscription tokens for team
    - Fallback: Company API key for urgent projects
    
    Scenario 2: Freelancer with mixed usage
    - Primary: One-time token purchases for projects
    - Fallback: Personal API key for experiments
    
    Scenario 3: Startup with flexible billing
    - Primary: Subscription for predictable costs
    - Secondary: One-time purchases for spikes
    - Fallback: BYOK for cost control
    `);
    
    console.log('\n🔐 Security & Billing:');
    console.log('   • JWT-based user identification (no injection attacks)');
    console.log('   • Encrypted API key storage (AES-256-GCM)');
    console.log('   • Atomic token transactions (no double-spending)');
    console.log('   • Detailed audit logs (every consumption tracked)');
    console.log('   • Webhook signature verification (payment security)');
    
    console.log('\n📈 Analytics & Insights:');
    console.log('   • Token consumption patterns per user');
    console.log('   • Payment method effectiveness');
    console.log('   • Fallback usage frequency');
    console.log('   • Cost optimization opportunities');
    console.log('   • User behavior analytics');
    
    console.log('\n🎛️ Admin Controls:');
    console.log('   • Set consumption priorities per purchase');
    console.log('   • Configure token expiration policies');
    console.log('   • Monitor hybrid user adoption');
    console.log('   • Analyze payment method preferences');
    console.log('   • Optimize platform fee structure');
    
    console.log('\n✅ Database Schema:');
    console.log('   • user_profiles: Capabilities and preferences');
    console.log('   • user_token_balances: Separate balances per type');
    console.log('   • token_consumption_log: Detailed consumption tracking');
    console.log('   • user_purchases: Enhanced purchase history');
    console.log('   • usage_analytics: Cross-reference consumption data');
    
    console.log('\n▶️  Hybrid User Server is running! Press Ctrl+C to stop.\n');
    
    // Keep server running
    process.on('SIGINT', async () => {
      console.log('\n🛑 Shutting down hybrid user server...');
      await server.stop();
      process.exit(0);
    });
    
  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    process.exit(1);
  }
}

// Run the example
runHybridUserExample().catch(console.error);