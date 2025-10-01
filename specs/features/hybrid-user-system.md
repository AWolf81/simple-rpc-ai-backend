# Hybrid User System Documentation

## Overview

The Hybrid User System allows users to have multiple payment methods simultaneously and configure their preferred consumption order. This provides maximum flexibility and ensures users always have access to AI services.

## 🔄 User Types & Combinations

### Previously: Single Type Users
- **Subscription Only**: Token balance limits
- **BYOK Only**: Unlimited with own API keys

### Now: Hybrid Users (Any Combination)
- **Subscription + BYOK**: Tokens first, then fallback to API key
- **One-time + BYOK**: Purchased tokens first, then API key
- **Subscription + One-time + BYOK**: Full flexibility with smart consumption
- **Subscription + One-time**: Multiple token sources, no BYOK
- **Any other combination**: System handles all scenarios

## 💳 Payment Method Types

### 1. Subscription Tokens
- **Source**: Monthly/yearly recurring billing
- **Characteristics**: 
  - Predictable costs
  - Auto-renewal
  - Higher priority in consumption
  - Platform fee: 20% (80% usable)

### 2. One-time Purchases
- **Source**: Token packs, credits, top-ups
- **Characteristics**:
  - Flexible amounts
  - Optional expiration dates
  - Configurable consumption priority
  - Platform fee: 20% (80% usable)

### 3. BYOK (Bring Your Own Key)
- **Source**: User's own AI provider API keys
- **Characteristics**:
  - Unlimited usage
  - No platform fees
  - User pays provider directly
  - Analytics tracking only

## ⚙️ Smart Consumption Logic

### Default Consumption Order
1. **Subscription tokens** (highest priority)
2. **One-time purchases** (by priority/date)
3. **BYOK** (fallback, unlimited)

### User-Configurable Preferences
```typescript
await rpc.ai.updateUserPreferences({
  consumptionOrder: ['subscription', 'one_time', 'byok'],
  notifyTokenLowThreshold: 1000,
  notifyFallbackToByok: true,
  notifyOneTimeConsumed: true
});
```

### Example Consumption Scenario
**User has:**
- 500 subscription tokens
- 300 one-time tokens (pack A, priority 10)
- 200 one-time tokens (pack B, priority 20)
- Anthropic API key (BYOK)

**Request needs 1200 tokens:**
1. ❌ Managed tokens insufficient (1000 < 1200)
2. ✅ Fallback to BYOK for FULL 1200 tokens
3. 💡 All managed tokens (1000) preserved
4. 🔔 Notify: "Insufficient managed tokens, using API key for full request"

## 🗄️ Database Schema

### user_profiles
```sql
CREATE TABLE user_profiles (
    user_id VARCHAR(255) PRIMARY KEY,
    email VARCHAR(255),
    
    -- Capabilities
    has_subscription BOOLEAN DEFAULT FALSE,
    has_one_time_purchases BOOLEAN DEFAULT FALSE,
    has_byok_configured BOOLEAN DEFAULT FALSE,
    
    -- Preferences
    consumption_order JSONB DEFAULT '["subscription", "one_time", "byok"]',
    byok_enabled BOOLEAN DEFAULT FALSE,
    byok_providers JSONB DEFAULT '{}',
    
    -- Notifications
    notify_token_low_threshold INTEGER DEFAULT 1000,
    notify_fallback_to_byok BOOLEAN DEFAULT TRUE,
    notify_one_time_consumed BOOLEAN DEFAULT TRUE
);
```

### user_token_balances
```sql
CREATE TABLE user_token_balances (
    id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) REFERENCES user_profiles(user_id),
    balance_type VARCHAR(50) CHECK (balance_type IN ('subscription', 'one_time')),
    
    virtual_token_balance BIGINT DEFAULT 0,
    total_tokens_purchased BIGINT DEFAULT 0,
    total_tokens_used BIGINT DEFAULT 0,
    platform_fee_collected BIGINT DEFAULT 0,
    
    purchase_source VARCHAR(100), -- 'monthly_subscription', 'token_pack_100k'
    consumption_priority INTEGER DEFAULT 100,
    expiry_date TIMESTAMP
);
```

### token_consumption_log
```sql
CREATE TABLE token_consumption_log (
    id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255),
    request_id VARCHAR(255),
    
    total_tokens_needed INTEGER,
    consumption_plan JSONB, -- Planned consumption
    actual_consumption JSONB, -- What actually happened
    notifications_sent JSONB -- User notifications
);
```

## 🔧 API Methods

### User Profile Management
```typescript
// Get user profile and capabilities
const profile = await rpc.ai.getUserProfile();
// Returns: { userId, hasSubscription, hasOneTimePurchases, hasByokConfigured, ... }

// Update consumption preferences
await rpc.ai.updateUserPreferences({
  consumptionOrder: ['one_time', 'subscription', 'byok'], // Custom order
  notifyTokenLowThreshold: 500,
  notifyFallbackToByok: false
});
```

### BYOK Configuration
```typescript
// Configure API keys for different providers
await rpc.ai.configureBYOK({
  providers: {
    anthropic: { enabled: true, apiKey: 'sk-ant-...' },
    openai: { enabled: true, apiKey: 'sk-...' },
    google: { enabled: false }
  },
  enabled: true
});
```

### Token Management
```typescript
// View all token balances
const balances = await rpc.ai.getUserTokenBalances();
// Returns: { 
//   balances: [{ balanceType, virtualTokenBalance, purchaseSource, ... }],
//   summary: { totalSubscriptionTokens, totalOneTimeTokens, totalTokens }
// }

// Plan consumption before making request
const plan = await rpc.ai.planConsumption({ 
  estimatedTokens: 1500,
  hasApiKey: true 
});
// Returns: { plan: [{ type, tokensToConsume, reason }], notifications, viable }
```

### AI Request Execution
```typescript
// Execute AI request with smart consumption
const result = await rpc.ai.generateText({
  content: "Write a function",
  systemPrompt: "You are a helpful programmer",
  apiKey: "sk-ant-..." // For BYOK fallback
});

// Returns consumption details
console.log(result.consumption);
// {
//   tokensUsed: 1500,
//   plan: [
//     { type: 'subscription', balanceId: '...', tokensConsumed: 800, newBalance: 200 },
//     { type: 'byok', tokensConsumed: 700 }
//   ],
//   fallbackUsed: true,
//   notifications: ["Subscription balance low", "Fell back to BYOK"]
// }
```

### Analytics & History
```typescript
// Get detailed consumption history
const history = await rpc.ai.getConsumptionHistory({ limit: 50 });
// Returns: [{ requestId, totalTokensNeeded, consumptionPlan, actualConsumption, ... }]
```

## 🔄 Consumption Flow

### 1. Request Planning
```typescript
const plan = await hybridUserService.planConsumption(userId, tokensNeeded, apiKey);
```
- Analyzes user's available resources
- Creates consumption plan based on preferences
- Identifies potential issues (insufficient tokens, missing API key)
- Generates user notifications

### 2. Viability Check
```typescript
const totalPlannedTokens = plan.plan.reduce((sum, item) => sum + item.tokensToConsume, 0);
if (totalPlannedTokens < tokensNeeded) {
  throw new TRPCError({ code: 'PAYMENT_REQUIRED', message: '...' });
}
```

### 3. AI Request Execution
```typescript
// Use BYOK if it's in the plan
const shouldUseBYOK = plan.plan.some(p => p.type === 'byok');
const result = await aiService.execute({
  ...requestData,
  ...(shouldUseBYOK && apiKey ? { apiKey } : {})
});
```

### 4. Consumption Execution
```typescript
const consumptionResult = await hybridUserService.executeConsumption(
  userId, actualTokens, provider, model, requestId, apiKey
);
```
- Atomic database transactions
- Updates multiple token balances
- Records detailed consumption logs
- Handles fallback scenarios

## 🔔 User Notifications

### Notification Types
1. **Token Low**: Balance below threshold after consumption
2. **Fallback to BYOK**: Had to use API key due to insufficient tokens
3. **One-time Consumed**: Used tokens from one-time purchase
4. **Balance Exhausted**: No tokens available and no BYOK

### Notification Configuration
```typescript
await rpc.ai.updateUserPreferences({
  notifyTokenLowThreshold: 1000,    // Notify when balance < 1000
  notifyFallbackToByok: true,       // Notify when using BYOK
  notifyOneTimeConsumed: true       // Notify when using one-time tokens
});
```

## 🏢 Enterprise Use Cases

### Department with Mixed Billing
```typescript
// Team lead configuration
{
  consumptionOrder: ['subscription', 'one_time', 'byok'],
  hasSubscription: true,           // Monthly team allowance
  hasOneTimePurchases: true,       // Emergency token packs  
  hasByokConfigured: true          // Company API key for overflow
}
```

### Freelancer with Flexible Costs
```typescript
// Freelancer configuration
{
  consumptionOrder: ['one_time', 'byok'],
  hasSubscription: false,          // No recurring costs
  hasOneTimePurchases: true,       // Project-based token purchases
  hasByokConfigured: true          // Personal API key for experiments
}
```

### Startup with Cost Control
```typescript
// Startup configuration
{
  consumptionOrder: ['subscription', 'one_time', 'byok'],
  hasSubscription: true,           // Predictable base costs
  hasOneTimePurchases: true,       // Handle usage spikes
  hasByokConfigured: true          // Cost control fallback
}
```

## 📊 Platform Benefits

### For Users
- **Flexibility**: Multiple payment options
- **Reliability**: Always have access (BYOK fallback)
- **Transparency**: Clear consumption breakdown
- **Control**: Configurable preferences
- **Cost Optimization**: Choose best payment method

### For Platform
- **Revenue Optimization**: Multiple monetization streams
- **User Retention**: Flexible options reduce churn
- **Enterprise Adoption**: Meets complex billing needs
- **Analytics**: Rich usage data
- **Scalability**: Handles any user scenario

## 🔐 Security & Compliance

### Security Features
- **JWT Authentication**: Prevents user ID injection
- **Encrypted API Keys**: AES-256-GCM storage
- **Atomic Transactions**: Prevents double-spending
- **Audit Logs**: Complete consumption history
- **Webhook Verification**: Secure payment processing

### Compliance
- **Data Privacy**: Minimal PII storage
- **Financial Tracking**: Detailed transaction logs
- **Access Control**: User-scoped data access
- **Encryption**: All sensitive data encrypted
- **GDPR Ready**: User data export/deletion support

## 🚀 Migration Path

### From Legacy System
1. **Automatic Migration**: Existing users get profiles
2. **Backwards Compatibility**: Old endpoints still work
3. **Gradual Adoption**: Users can enable hybrid features
4. **Zero Downtime**: Seamless transition

### Implementation Steps
1. Deploy new database schema (migration 005)
2. Enable hybrid user service in server config
3. Update client applications to use new methods
4. Configure user preferences and BYOK
5. Monitor consumption patterns and optimize

This hybrid user system provides the ultimate flexibility for users while maintaining platform revenue and ensuring reliable service availability.