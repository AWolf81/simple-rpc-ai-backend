/**
 * Seamless OpenSaaS Billing Example
 * 
 * Just 2 config lines and billing works automatically!
 * No API keys, no complex setup, just webhook URL + secret
 * Platform fees handled entirely in OpenSaaS
 */

import { createProgressiveAIServer, SeamlessOpenSaaSIntegration } from '../dist/index.js';

// 🎯 SUPER SIMPLE: Just webhook URL + secret!
const openSaasIntegration = new SeamlessOpenSaaSIntegration({
  webhookUrl: 'https://your-server.com/webhooks/opensaas',
  webhookSecret: process.env.OPENSAAS_WEBHOOK_SECRET, // Only secret you need!
  
  // Optional customization
  defaultCredits: 5.00,    // $5 free credits for new users
  maxCredits: 500.00,      // $500 max balance
  lowBalanceThreshold: 2.00 // Warn when under $2
  
  // That's it! Everything else works automatically:
  // ✅ User accounts auto-created when they sign up
  // ✅ Credits auto-added when they pay (after platform fees deducted in OpenSaaS)
  // ✅ Subscriptions auto-managed
  // ✅ Billing preferences auto-synced
  // ✅ Usage auto-reported
  // ✅ Balance checking auto-cached
  // ✅ Webhook signatures auto-verified
});

// Create server with seamless billing
const server = createProgressiveAIServer({
  port: 8000,
  
  database: {
    type: 'sqlite',
    path: './seamless-billing.db'
  },
  
  masterEncryptionKey: process.env.MASTER_ENCRYPTION_KEY,
  
  // Magic happens here - just pass the integration!
  openSaasIntegration,
  
  prompts: {
    'security_review': `You are a security expert reviewing code for vulnerabilities.

Analyze the code and provide:
1. Critical security vulnerabilities (if any)
2. Potential security risks
3. Best practice recommendations
4. Specific code line references
5. Severity levels (Critical/High/Medium/Low)

Be thorough but practical in your assessment.`,

    'code_quality': `You are a senior developer reviewing code quality.

Evaluate:
1. Code structure and organization
2. Readability and maintainability
3. Performance considerations
4. Best practices adherence
5. Design patterns usage

Provide actionable feedback with specific improvements.`,

    'performance_review': `You are a performance expert analyzing code efficiency.

Focus on:
1. Time complexity analysis
2. Memory usage optimization
3. Database query efficiency
4. Caching opportunities
5. Algorithmic improvements

Provide specific recommendations with performance impact estimates.`
  },
  
  // Server AI keys (for credit-based requests)
  serverAI: {
    anthropic: process.env.ANTHROPIC_API_KEY,
    openai: process.env.OPENAI_API_KEY,
    google: process.env.GOOGLE_API_KEY
  },
  
  // Billing mode (hybrid supports both BYOK and credits)
  billingMode: 'hybrid' // 'byok_only' | 'credits_only' | 'hybrid'
});

// 🪄 Auto-magic setup (all automatic!)
openSaasIntegration.registerWebhookHandler(server.app, server.billingManager);
openSaasIntegration.setupBillingRoutes(server.app, server.billingManager);

server.start();

console.log(`
🪄 Seamless OpenSaaS Billing Integration

Configuration:
✅ Webhook URL: ${openSaasIntegration.getConfig().webhookUrl}
✅ Default credits: $${openSaasIntegration.getConfig().defaultCredits}
✅ Max balance: $${openSaasIntegration.getConfig().maxCredits}
✅ Billing mode: hybrid (BYOK + Credits)

What happens automatically:

💳 Payment Flow (Platform Fees Handled in OpenSaaS):
1. User buys $25 credits
2. OpenSaaS: $25 - $5 platform fee (20%) = $20 net credits
3. Webhook → AI Backend: "User has $20 credits"
4. User makes AI request → Deduct $0.15 → "$19.85 remaining"

📅 Subscription Flow:
1. User subscribes $10/month  
2. OpenSaaS: $10 - $2 platform fee = $8 monthly credits
3. Webhook → AI Backend: "User gets $8/month"
4. Auto-renewal handled in OpenSaaS

🔄 Hybrid Billing:
1. User has $0.50 credits left
2. AI request costs $1.00
3. Auto-fallback to user's BYOK keys
4. No interruption in service

👤 User Lifecycle:
1. Sign up → Auto-created with $5 free credits
2. Free credits run out → Prompted to add BYOK keys
3. Buy credits → OpenSaaS handles payment + fees
4. Subscribe → Monthly credits auto-renewed

Environment Variables:
- OPENSAAS_WEBHOOK_SECRET: Webhook verification (only OpenSaaS config needed!)
- MASTER_ENCRYPTION_KEY: For BYOK key encryption  
- ANTHROPIC_API_KEY: Server's Anthropic key (for credit requests)
- OPENAI_API_KEY: Server's OpenAI key (for credit requests)
- GOOGLE_API_KEY: Server's Google key (for credit requests)

Billing Routes Auto-Registered:
📊 GET  /api/billing/status     - User credit balance & preferences
⚙️  POST /api/billing/preferences - Update user billing settings
🔗 POST /webhooks/opensaas      - OpenSaaS webhook handler

No OpenSaaS API keys needed - everything works via webhooks! 🎉
Platform fees (10-20%) handled entirely in OpenSaaS backend.
`);

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down seamless billing server...');
  server.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down seamless billing server...');
  server.stop();
  process.exit(0);
});