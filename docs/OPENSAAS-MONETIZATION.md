# OpenSaaS Monetization Integration

This document explains how to integrate OpenSaaS monetization into your simple-rpc-ai-backend server with **configurable subscription tiers**.

## 🎯 Key Features

- **✅ Configurable Subscription Tiers** - Define any tier structure (free, basic, pro, enterprise, etc.)
- **✅ JWT Authentication** - Secure OpenSaaS JWT token validation
- **✅ Usage Tracking** - Real-time token counting and cost calculation
- **✅ Rate Limiting** - Tier-based RPM/TPM limits with Redis support
- **✅ Billing Integration** - Automatic platform fee calculation and billing events
- **✅ Quota Management** - Monthly quotas with overage handling
- **✅ Webhook Support** - Payment provider integration (OpenSaaS, Stripe, LemonSqueezy)
- **✅ Admin Analytics** - Usage and billing analytics dashboard

## 🚀 Quick Start

### 1. Basic Setup

```typescript
import { createMonetizedAIServer, createOpenSaaSConfig } from 'simple-rpc-ai-backend';

// Define your custom subscription tiers
const customTiers = {
  free: {
    name: 'Free Trial',
    monthlyTokenQuota: 1000,
    rpmLimit: 5,
    tpmLimit: 100,
    concurrentRequests: 1,
    features: ['basic_ai']
  },
  pro: {
    name: 'Professional',
    monthlyTokenQuota: 100000,
    rpmLimit: 100,
    tpmLimit: 10000,
    concurrentRequests: 10,
    features: ['basic_ai', 'advanced_ai', 'priority_support']
  }
};

// Create OpenSaaS configuration
const opensaasConfig = createOpenSaaSConfig({
  opensaasPublicKey: process.env.OPENSAAS_PUBLIC_KEY,
  audience: 'your-service-name',
  issuer: 'https://auth.yourcompany.com',
  customTiers,
  platformFeePercentage: 20,
  redisUrl: process.env.REDIS_URL
});

// Create monetized server
const server = await createMonetizedAIServer({
  port: 8000,
  opensaasMonetization: opensaasConfig,
  serviceProviders: {
    anthropic: { apiKey: process.env.ANTHROPIC_API_KEY }
  }
});

server.start();
```

### 2. Environment Variables

```bash
# Required
OPENSAAS_PUBLIC_KEY=your-opensaas-public-key
ANTHROPIC_API_KEY=your-anthropic-key

# Optional
REDIS_URL=redis://localhost:6379
DATABASE_PATH=./data/monetized-ai.db
```

## 🏗️ Architecture Overview

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Web App       │    │   RPC Server     │    │   OpenSaaS      │
│                 │    │                  │    │                 │
│ • User Auth     │◄──►│ • JWT Middleware │◄──►│ • User Mgmt     │
│ • Dashboard     │    │ • Usage Tracking │    │ • Subscriptions │
│ • Billing UI    │    │ • Rate Limiting  │    │ • Billing       │
└─────────────────┘    │ • AI Processing  │    │ • Webhooks      │
                       └──────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌──────────────────┐
                       │   AI Providers   │
                       │ • Anthropic      │
                       │ • OpenAI         │
                       │ • Google         │
                       └──────────────────┘
```

## 🎚️ Configurable Subscription Tiers

### Default Tiers

The system includes these default tiers that you can override:

```typescript
const DEFAULT_TIER_CONFIGS = {
  starter: {
    name: 'Starter',
    monthlyTokenQuota: 10000,
    rpmLimit: 10,
    tpmLimit: 1000,
    concurrentRequests: 2,
    features: ['basic_ai']
  },
  pro: {
    name: 'Pro',
    monthlyTokenQuota: 100000,
    rpmLimit: 100,
    tpmLimit: 10000,
    concurrentRequests: 10,
    features: ['basic_ai', 'advanced_ai', 'priority_support']
  },
  enterprise: {
    name: 'Enterprise',
    monthlyTokenQuota: 1000000,
    rpmLimit: 1000,
    tpmLimit: 100000,
    concurrentRequests: 50,
    features: ['basic_ai', 'advanced_ai', 'priority_support', 'custom_models', 'analytics']
  }
};
```

### Custom Tier Examples

#### SaaS Business Model
```typescript
const saasTiers = {
  free: {
    name: 'Free Trial',
    monthlyTokenQuota: 1000,
    rpmLimit: 5,
    tpmLimit: 100,
    concurrentRequests: 1,
    features: ['basic_ai']
  },
  basic: {
    name: 'Basic',
    monthlyTokenQuota: 25000,
    rpmLimit: 30,
    tpmLimit: 3000,
    concurrentRequests: 3,
    features: ['basic_ai', 'email_support']
  },
  premium: {
    name: 'Premium',
    monthlyTokenQuota: 500000,
    rpmLimit: 500,
    tpmLimit: 50000,
    concurrentRequests: 25,
    features: ['basic_ai', 'advanced_ai', 'priority_support', 'analytics']
  }
};
```

#### Education Model
```typescript
const educationTiers = {
  student: {
    name: 'Student (Free)',
    monthlyTokenQuota: 5000,
    rpmLimit: 10,
    tpmLimit: 500,
    concurrentRequests: 2,
    features: ['basic_ai', 'educational_content']
  },
  educator: {
    name: 'Educator',
    monthlyTokenQuota: 50000,
    rpmLimit: 100,
    tpmLimit: 5000,
    concurrentRequests: 10,
    features: ['basic_ai', 'advanced_ai', 'educational_content', 'classroom_management']
  }
};
```

#### API Service Model
```typescript
const apiTiers = {
  developer: {
    name: 'Developer',
    monthlyTokenQuota: 10000,
    rpmLimit: 60, // 1 req/sec
    tpmLimit: 1000,
    concurrentRequests: 5,
    features: ['basic_ai', 'api_access']
  },
  scale: {
    name: 'Scale',
    monthlyTokenQuota: 1000000,
    rpmLimit: 1800, // 30 req/sec
    tpmLimit: 100000,
    concurrentRequests: 50,
    features: ['basic_ai', 'advanced_ai', 'api_access', 'webhook_support', 'analytics']
  }
};
```

## 🔐 JWT Authentication

### JWT Payload Structure

Your OpenSaaS service should include these fields in the JWT:

```typescript
interface OpenSaaSJWTPayload {
  userId: string;
  email: string;
  organizationId?: string;
  subscriptionTier: string; // Any tier name you've configured
  monthlyTokenQuota: number;
  rpmLimit: number;
  tpmLimit: number;
  features: string[];
  iat: number;
  exp: number;
  iss: string; // Your OpenSaaS issuer
  aud: string; // Your service identifier
}
```

### VS Code Extension Integration

**⚠️ Important**: VS Code extensions require a different authentication flow than web apps.

```typescript
// In your VS Code extension
import * as vscode from 'vscode';

class OpenSaaSAuthProvider {
  private context: vscode.ExtensionContext;
  private extensionId: string;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.extensionId = context.extension.id;
  }

  async getAuthToken(): Promise<string> {
    // 1. Check for cached token
    let token = this.context.globalState.get<string>('opensaas_jwt');
    
    if (!token || this.isTokenExpired(token)) {
      // 2. Redirect user to your web app for OpenSaaS authentication
      const authUrl = `https://yourapp.com/auth/vscode?extension=${this.extensionId}&callback=vscode`;
      
      await vscode.env.openExternal(vscode.Uri.parse(authUrl));
      
      // 3. Wait for user to complete authentication and copy token
      token = await vscode.window.showInputBox({
        prompt: 'Paste your authentication token from the browser',
        password: true,
        ignoreFocusOut: true
      });
      
      if (!token) {
        throw new Error('Authentication cancelled');
      }
      
      // 4. Validate and cache the token
      await this.validateToken(token);
      this.context.globalState.update('opensaas_jwt', token);
    }
    
    return token;
  }

  private async validateToken(token: string): Promise<void> {
    const response = await fetch('https://your-rpc-server.com/rpc', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'X-Extension-ID': this.extensionId
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'health',
        id: 1
      })
    });

    if (!response.ok) {
      throw new Error('Invalid authentication token');
    }
  }

  private isTokenExpired(token: string): boolean {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return Date.now() >= payload.exp * 1000;
    } catch {
      return true;
    }
  }

  async makeAIRequest(content: string, promptId: string) {
    const token = await this.getAuthToken();
    
    const response = await fetch('https://your-rpc-server.com/rpc', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'X-Extension-ID': this.extensionId, // Security: Prevent unauthorized access
        'User-Agent': vscode.env.appName // Additional validation
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'executeAIRequest',
        params: { content, promptId },
        id: Date.now()
      })
    });
    
    const result = await response.json();
    
    // Handle billing-specific responses
    if (result.error) {
      switch (result.error.code) {
        case -32001: // Quota exceeded
          this.showUpgradePrompt(result.error.data.upgradeUrl);
          break;
        case -32002: // Rate limited
          vscode.window.showWarningMessage(
            `Rate limit exceeded. Try again in ${result.error.data.retryAfter} seconds.`
          );
          break;
        case -32003: // Payment required
          this.showPaymentPrompt(result.error.data.billingUrl);
          break;
      }
      throw new Error(result.error.message);
    }
    
    // Show usage info to user
    if (result.result.usage) {
      const { totalTokens, totalCost, quotaRemaining } = result.result;
      vscode.window.setStatusBarMessage(
        `Tokens: ${totalTokens} | Cost: $${totalCost.toFixed(4)} | Quota: ${quotaRemaining}`,
        5000
      );
    }
    
    return result.result;
  }

  private async showUpgradePrompt(upgradeUrl: string) {
    const selection = await vscode.window.showInformationMessage(
      'Monthly quota exceeded. Upgrade for continued access.',
      'Upgrade Plan',
      'Cancel'
    );
    
    if (selection === 'Upgrade Plan') {
      await vscode.env.openExternal(vscode.Uri.parse(upgradeUrl));
    }
  }

  private async showPaymentPrompt(billingUrl: string) {
    const selection = await vscode.window.showWarningMessage(
      'Payment required to continue using AI features.',
      'Update Billing',
      'Cancel'
    );
    
    if (selection === 'Update Billing') {
      await vscode.env.openExternal(vscode.Uri.parse(billingUrl));
    }
  }
}

// Usage in your extension
export async function activate(context: vscode.ExtensionContext) {
  const authProvider = new OpenSaaSAuthProvider(context);
  
  const disposable = vscode.commands.registerCommand('myextension.aiRequest', async () => {
    try {
      const editor = vscode.window.activeTextEditor;
      if (!editor) return;
      
      const selectedText = editor.document.getText(editor.selection);
      const result = await authProvider.makeAIRequest(selectedText, 'code-review');
      
      // Show AI response
      vscode.window.showInformationMessage(result.content);
    } catch (error) {
      vscode.window.showErrorMessage(`AI request failed: ${error.message}`);
    }
  });

  context.subscriptions.push(disposable);
}
```

### Web App Integration

```typescript
// Web app sends requests with JWT (simpler flow)
const response = await fetch('/rpc', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${userJwtToken}` // From OpenSaaS login
  },
  body: JSON.stringify({
    jsonrpc: '2.0',
    method: 'executeAIRequest',
    params: {
      content: 'Hello world',
      systemPrompt: 'You are a helpful assistant'
    },
    id: 1
  })
});
```

## 📊 Usage Tracking & Billing

### Real-time Usage Tracking

Every AI request is automatically tracked:

```typescript
interface UsageEvent {
  userId: string;
  organizationId?: string;
  requestId: string;
  method: string;
  provider: string;
  model?: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cost: number;           // AI provider cost
  platformFee: number;    // Your platform fee (e.g., 20%)
  totalCost: number;      // cost + platformFee
  timestamp: Date;
}
```

### Platform Fee Calculation

```typescript
// Configurable platform fee percentage
const billingConfig = {
  platformFee: {
    percentage: 20,        // 20% platform fee
    minimumFee: 0.01,     // Minimum $0.01 fee
    maximumFee: 10.00     // Maximum $10.00 fee (optional)
  }
};
```

### Provider Pricing

Built-in pricing for major AI providers:

```typescript
const PROVIDER_PRICING = {
  anthropic: {
    'claude-3-sonnet': { input: 0.003, output: 0.015 },
    'claude-3-haiku': { input: 0.00025, output: 0.00125 }
  },
  openai: {
    'gpt-4': { input: 0.03, output: 0.06 },
    'gpt-4-turbo': { input: 0.01, output: 0.03 }
  },
  google: {
    'gemini-pro': { input: 0.0005, output: 0.0015 }
  }
};
```

## 🚦 Rate Limiting

### Tier-Based Limits

Rate limiting automatically uses your tier configuration:

```typescript
// Rate limits are automatically applied based on tier
const tierLimits = {
  requestsPerMinute: tierConfig.rpmLimit,
  tokensPerMinute: tierConfig.tpmLimit,
  concurrentRequests: tierConfig.concurrentRequests
};
```

### Redis Support

For production, use Redis for distributed rate limiting:

```typescript
const rateLimitConfig = {
  redisUrl: 'redis://localhost:6379',
  keyPrefix: 'ratelimit:',
  windowSizeMs: 60000 // 1 minute windows
};
```

## 📈 Quota Management

### Monthly Quotas

Users have monthly token quotas that reset automatically:

```typescript
// Check quota status
const quotaStatus = await usageTracker.getQuotaStatus(userId);
console.log({
  quotaUsed: 15000,
  quotaLimit: 50000,
  quotaRemaining: 35000,
  quotaPercentage: 30.0,
  resetDate: '2024-02-01T00:00:00Z',
  isExceeded: false,
  isNearLimit: false,
  estimatedDaysRemaining: 23
});
```

### Quota Exceeded Handling

```typescript
// Different actions based on tier
const quotaAction = await billingEngine.handleQuotaExceeded(userId);

switch (quotaAction.action) {
  case 'block':
    // Block requests for starter tier
    throw new Error('Monthly quota exceeded. Upgrade for continued access.');
    
  case 'allow_overage':
    // Allow overage for pro tier with additional charges
    console.log('Overage charges will apply');
    
  case 'upgrade_prompt':
    // Suggest upgrade to higher tier
    console.log('Consider upgrading for higher limits');
}
```

## 🔗 Webhook Integration

### OpenSaaS Webhooks

Handle subscription changes from OpenSaaS:

```typescript
app.post('/webhooks/opensaas', async (req, res) => {
  const { type, data } = req.body;
  
  switch (type) {
    case 'subscription.updated':
      await billingEngine.updateSubscriptionInfo(data.userId, {
        tier: data.tier,
        monthlyTokenQuota: data.monthlyTokenQuota
      });
      break;
      
    case 'subscription.cancelled':
      await billingEngine.handleSubscriptionCancellation(data);
      break;
  }
  
  res.json({ received: true });
});
```

### Stripe/LemonSqueezy Support

```typescript
// Stripe webhooks
app.post('/webhooks/stripe', async (req, res) => {
  const signature = req.headers['stripe-signature'];
  await billingEngine.processWebhook('stripe', req.body, signature);
  res.json({ received: true });
});

// LemonSqueezy webhooks  
app.post('/webhooks/lemonsqueezy', async (req, res) => {
  const signature = req.headers['x-signature'];
  await billingEngine.processWebhook('lemonsqueezy', req.body, signature);
  res.json({ received: true });
});
```

## 📱 JSON-RPC API

### Enhanced AI Request

```typescript
// Request with monetization
{
  "jsonrpc": "2.0",
  "method": "executeAIRequest",
  "params": {
    "content": "Explain quantum computing",
    "systemPrompt": "You are a physics tutor"
  },
  "id": 1
}

// Response with usage and billing info
{
  "jsonrpc": "2.0",
  "result": {
    "content": "Quantum computing is...",
    "usage": {
      "inputTokens": 45,
      "outputTokens": 256,
      "totalTokens": 301,
      "cost": 0.0123,
      "platformFee": 0.0025,
      "totalCost": 0.0148
    },
    "quotaRemaining": 49699,
    "requestId": "req_abc123"
  },
  "id": 1
}
```

### New Monetization Methods

```typescript
// Get usage statistics
{
  "jsonrpc": "2.0",
  "method": "getUsageStats", 
  "params": { "period": "current_month" },
  "id": 2
}

// Check quota status
{
  "jsonrpc": "2.0",
  "method": "checkQuotaStatus",
  "params": {},
  "id": 3
}
```

## 🛠️ Admin Analytics

Access detailed analytics (requires 'analytics' feature):

```typescript
// GET /admin/analytics?start=2024-01-01&end=2024-01-31
{
  "usage": {
    "totalUsers": 1250,
    "totalTokens": 15500000,
    "totalCost": 1250.50,
    "totalRequests": 45000,
    "providerBreakdown": [
      { "provider": "anthropic", "tokens": 8500000, "percentage": 54.8 },
      { "provider": "openai", "tokens": 7000000, "percentage": 45.2 }
    ],
    "tierBreakdown": [
      { "tier": "pro", "users": 800, "tokens": 12000000, "percentage": 77.4 },
      { "tier": "free", "users": 450, "tokens": 3500000, "percentage": 22.6 }
    ]
  },
  "billing": {
    "totalRevenue": 1875.75,
    "totalPlatformFees": 375.15,
    "eventsByType": {
      "usage": 45000,
      "quota_exceeded": 125,
      "tier_upgrade": 25
    }
  }
}
```

## 🚨 Error Handling

### Quota Exceeded
```typescript
{
  "jsonrpc": "2.0",
  "error": {
    "code": -32001,
    "message": "Monthly quota exceeded",
    "data": {
      "quotaUsed": 50000,
      "quotaLimit": 50000,
      "upgradeUrl": "https://app.example.com/billing/upgrade"
    }
  },
  "id": 1
}
```

### Rate Limited
```typescript
{
  "jsonrpc": "2.0", 
  "error": {
    "code": -32002,
    "message": "Rate limit exceeded",
    "data": {
      "limit": 100,
      "resetTime": "2024-01-15T14:35:00Z",
      "retryAfter": 45
    }
  },
  "id": 1
}
```

### Authentication Required
```typescript
{
  "jsonrpc": "2.0",
  "error": {
    "code": -32001,
    "message": "Authentication required",
    "data": {
      "authUrl": "/auth/opensaas"
    }
  },
  "id": 1
}
```

## 🔧 Configuration Options

### Complete Configuration Example

```typescript
const opensaasConfig: OpenSaaSMonetizationConfig = {
  // Required: OpenSaaS JWT settings
  opensaas: {
    publicKey: process.env.OPENSAAS_PUBLIC_KEY!,
    audience: 'your-service-name',
    issuer: 'https://auth.yourcompany.com',
    clockTolerance: 30
  },

  // Optional: Custom subscription tiers
  subscriptionTiers: customTiers,

  // Required: Billing configuration
  billing: {
    platformFee: {
      percentage: 20,
      minimumFee: 0.01,
      maximumFee: 10.00
    },
    billingProvider: 'opensaas',
    enableUsageBasedBilling: true,
    quotaWarningThresholds: [80, 95]
  },

  // Optional: Rate limiting
  rateLimiting: {
    redisUrl: process.env.REDIS_URL,
    windowSizeMs: 60000,
    enableConcurrencyLimit: true,
    keyPrefix: 'ratelimit:'
  },

  // Optional: Authentication settings
  authentication: {
    requireAuthForAllMethods: false,
    skipAuthForMethods: ['health', 'rpc.discover']
  },

  // Optional: Usage tracking
  usageTracking: {
    enableDetailedLogging: true,
    retentionDays: 90
  },

  // Optional: Quota management
  quotaManagement: {
    warningThresholds: [80, 95],
    enableOverageCharges: true,
    maxOveragePercentage: 20
  },

  // Optional: Webhook URLs
  webhooks: {
    opensaasWebhookUrl: 'https://billing.yourcompany.com/webhooks/usage',
    stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    lemonsqueezyWebhookSecret: process.env.LEMONSQUEEZY_WEBHOOK_SECRET
  }
};
```

## 🎯 Best Practices

### 1. Tier Design
- **Start Simple**: Begin with 2-3 tiers, expand based on user feedback
- **Clear Value Props**: Each tier should have obvious benefits
- **Reasonable Limits**: Set limits that encourage upgrades without frustrating users

### 2. Feature Gating
```typescript
// Use features array to gate functionality
const tierConfig = tiers[userTier];
if (!tierConfig.features.includes('advanced_ai')) {
  throw new Error('Advanced AI requires Pro subscription');
}
```

### 3. Usage Monitoring
- Monitor quota usage patterns to optimize tier limits
- Set up alerts for unusual usage spikes
- Track conversion rates between tiers

### 4. Error Messages
- Provide clear upgrade paths in error messages
- Show users their current usage and limits
- Include direct links to billing/upgrade pages

## 🚀 Deployment

### Production Checklist

- [ ] Set up Redis for distributed rate limiting
- [ ] Configure proper database (PostgreSQL/MySQL for production)
- [ ] Set up webhook endpoints with proper signature validation
- [ ] Configure monitoring and alerting
- [ ] Test quota reset functionality
- [ ] Verify billing integration with your payment provider
- [ ] Set up backup and recovery procedures

### Docker Deployment

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
EXPOSE 8000
CMD ["node", "dist/examples/servers/opensaas-monetized-server.js"]
```

## 📞 Support

For questions about OpenSaaS monetization integration:

1. Check the [feature specification](../specs/features/opensaas-monetization.md)
2. Review the [example configurations](../examples/configurations/)
3. See the [server examples](../examples/servers/)

The configurable tier system allows you to create any subscription model that fits your business needs!