# Feature: Hybrid Billing Model (BYOK + Server Credits)
**Status**: 📝 Draft
**Priority**: High
**Security Risk Level**: Medium
**Cryptographic Operations**: Basic
**MCP Integration**: None
**Estimated Effort**: 4-5 days
**Created**: 2025-01-26
**Last Updated**: 2025-01-26

## Problem Statement
Users need flexible payment options for AI services:
- **Free tier**: BYOK (users provide their own AI keys)
- **Paid tier**: Server credits (service provider pays for AI, charges users)
- **Hybrid**: Automatic fallback from server credits to BYOK when balance is low
- **Enterprise**: Configurable per organization (force BYOK for compliance)

Integration with OpenSaaS for payment processing and credit management.

## Requirements
- The system SHALL support both BYOK and server-provided AI credits
- The system SHALL check user account balance before using server credits
- The system SHALL fallback to BYOK when server credits are insufficient
- The system SHALL integrate with OpenSaaS for billing and credit management
- The system SHALL allow per-user configuration of payment preferences
- The system SHALL allow server-wide configuration of billing models
- The system SHALL track usage for billing purposes
- The system SHALL prevent unauthorized usage of server credits

## Target Users
- **Free users**: Use their own AI keys (BYOK)
- **Paid users**: Use server credits until balance runs out
- **Enterprise users**: Organization-controlled payment method
- **Hybrid users**: Prefer server credits but have BYOK as backup

## Architecture Impact
**Components Affected**:
- New: HybridBillingManager class
- New: OpenSaaSIntegration service
- New: CreditUsageTracker
- Modified: ProgressiveAuthManager to support billing preferences
- Modified: AIService to route requests based on billing method
- New: Usage reporting and billing events

**New Dependencies**:
- OpenSaaS API client
- Usage tracking database tables
- Credit balance checking service

## Implementation Plan
1. **Billing Configuration System**: Server and user-level billing preferences
2. **OpenSaaS Integration**: Credit checking and usage reporting
3. **Hybrid AI Service**: Route requests based on billing method and balance
4. **Usage Tracking**: Record all AI requests for billing
5. **Credit Management**: Balance checking and automatic fallbacks
6. **Admin Controls**: Server operators can configure billing models

## Billing Models Supported
```typescript
interface BillingConfig {
  // Server-wide settings
  serverMode: 'byok_only' | 'credits_only' | 'hybrid' | 'user_choice';
  
  // Default user settings
  defaultUserMode: 'byok' | 'credits' | 'auto_fallback';
  
  // Credit limits
  freeCreditsPerMonth: number;
  maxCreditBalance: number;
  
  // OpenSaaS integration
  openSaasApiKey: string;
  webhookSecret: string;
}

interface UserBillingPreference {
  userId: string;
  preferredMode: 'byok' | 'credits' | 'auto_fallback';
  maxMonthlySpend: number;
  byokProviders: string[]; // Fallback providers when credits exhausted
  creditBalance: number;
  monthlyUsage: number;
}
```

## API Design
```typescript
class HybridBillingManager {
  async getPaymentMethod(userId: string, estimatedCost: number): Promise<{
    method: 'byok' | 'credits';
    provider?: string;
    apiKey?: string;
    reason: string;
  }>
  
  async recordUsage(userId: string, usage: {
    provider: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
    cost: number;
    paymentMethod: 'byok' | 'credits';
  }): Promise<void>
  
  async checkCreditBalance(userId: string): Promise<{
    balance: number;
    monthlyUsage: number;
    limit: number;
    canUseCredits: boolean;
  }>
}
```

## OpenSaaS Integration Points
- **Credit Balance**: Real-time balance checking
- **Usage Reporting**: Post usage for billing
- **Webhooks**: Handle payment completions and credit top-ups
- **User Management**: Sync user accounts and billing preferences