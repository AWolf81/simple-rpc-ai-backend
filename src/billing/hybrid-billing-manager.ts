/**
 * Hybrid Billing Manager
 * 
 * Manages both BYOK and server-provided credits with OpenSaaS integration
 * Automatically chooses payment method based on user preferences and balance
 */

import { SimpleKeyManager } from '../auth/key-manager.js';

export interface BillingConfig {
  // Server-wide billing mode
  serverMode: 'byok_only' | 'credits_only' | 'hybrid' | 'user_choice';
  
  // Default settings for new users
  defaultUserMode: 'byok' | 'credits' | 'auto_fallback';
  
  // Credit limits
  freeCreditsPerMonth: number;
  maxCreditBalance: number;
  lowBalanceThreshold: number; // When to warn users
  
  // OpenSaaS integration
  openSaasApiKey: string;
  openSaasApiUrl: string;
  webhookSecret: string;
  
  // Server AI configuration (when using credits)
  serverAI: {
    anthropic?: string;
    openai?: string;
    google?: string;
  };
}

export interface UserBillingPreference {
  userId: string;
  preferredMode: 'byok' | 'credits' | 'auto_fallback';
  maxMonthlySpend: number;
  creditBalance: number;
  monthlyUsage: number;
  lastResetDate: Date;
  isActive: boolean;
  byokProviders: string[]; // Fallback providers when credits exhausted
}

export interface UsageRecord {
  userId: string;
  requestId: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCost: number;
  actualCost?: number;
  paymentMethod: 'byok' | 'credits';
  timestamp: Date;
  analysisType: string;
}

export interface PaymentMethodResult {
  method: 'byok' | 'credits';
  provider?: string;
  apiKey?: string;
  reason: string;
  estimatedCost: number;
  remainingCredits?: number;
}

type Provider = 'anthropic' | 'openai' | 'google';

type Model =
  | 'claude-3-5-sonnet'
  | 'claude-3-haiku'
  | 'gpt-4o'
  | 'gpt-4o-mini'
  | 'gpt-3.5-turbo'
  | 'gemini-1.5-pro'
  | 'gemini-1.5-flash';

const pricing: Record<Provider, Partial<Record<Model, number>>> = {
  anthropic: {
    'claude-3-5-sonnet': 0.000015,
    'claude-3-haiku': 0.000008
  },
  openai: {
    'gpt-4o': 0.00002,
    'gpt-4o-mini': 0.000001,
    'gpt-3.5-turbo': 0.000002
  },
  google: {
    'gemini-1.5-pro': 0.000013,
    'gemini-1.5-flash': 0.000005
  }
};

export interface OpenSaaSClient {
  checkBalance(userId: string): Promise<{ balance: number; isActive: boolean }>;
  recordUsage(userId: string, usage: UsageRecord): Promise<void>;
  getUserBilling(userId: string): Promise<UserBillingPreference | null>;
  updateUserBilling(userId: string, updates: Partial<UserBillingPreference>): Promise<void>;
}

export class HybridBillingManager {
  constructor(
    private config: BillingConfig,
    private keyManager: SimpleKeyManager,
    private openSaasClient: OpenSaaSClient
  ) {}

  /**
   * Determine payment method for a request
   */
  async getPaymentMethod(
    userId: string, 
    provider: Provider, 
    model: Model, 
    estimatedTokens: number
  ): Promise<PaymentMethodResult> {
    
    // Get user billing preferences
    const userBilling = await this.getUserBillingPreference(userId);
    const estimatedCost = this.estimateCost(provider, model, estimatedTokens);

    // Check server-wide configuration first
    if (this.config.serverMode === 'byok_only') {
      return await this.getBYOKMethod(userId, provider, estimatedCost, 'Server configured for BYOK only');
    }

    if (this.config.serverMode === 'credits_only') {
      return await this.getCreditsMethod(userId, provider, estimatedCost, 'Server configured for credits only');
    }

    // User choice or hybrid mode
    switch (userBilling.preferredMode) {
      case 'byok':
        return await this.getBYOKMethod(userId, provider, estimatedCost, 'User prefers BYOK');

      case 'credits':
        return await this.getCreditsMethod(userId, provider, estimatedCost, 'User prefers credits');

      case 'auto_fallback':
        // Try credits first, fallback to BYOK
        const canUseCredits = await this.canUseCredits(userId, estimatedCost);
        if (canUseCredits.canUse) {
          return await this.getCreditsMethod(userId, provider, estimatedCost, 'Using credits (auto-fallback)');
        } else {
          return await this.getBYOKMethod(userId, provider, estimatedCost, `Fallback to BYOK: ${canUseCredits.reason}`);
        }

      default:
        return await this.getBYOKMethod(userId, provider, estimatedCost, 'Default to BYOK');
    }
  }

  /**
   * Get BYOK payment method
   */
  private async getBYOKMethod(
    userId: string, 
    provider: string, 
    estimatedCost: number, 
    reason: string
  ): Promise<PaymentMethodResult> {
    const apiKey = await this.keyManager.getUserKey(userId, provider);
    
    if (!apiKey) {
      throw new Error(`No ${provider} API key configured. Please add your API key in settings.`);
    }

    return {
      method: 'byok',
      provider,
      apiKey,
      reason,
      estimatedCost
    };
  }

  /**
   * Get server credits payment method
   */
  private async getCreditsMethod(
    userId: string, 
    provider: string, 
    estimatedCost: number, 
    reason: string
  ): Promise<PaymentMethodResult> {
    const canUse = await this.canUseCredits(userId, estimatedCost);
    
    if (!canUse.canUse) {
      throw new Error(`Cannot use credits: ${canUse.reason}`);
    }

    const serverApiKey = this.config.serverAI[provider as keyof typeof this.config.serverAI];
    if (!serverApiKey) {
      throw new Error(`Server does not support ${provider} provider`);
    }

    return {
      method: 'credits',
      provider,
      apiKey: serverApiKey,
      reason,
      estimatedCost,
      remainingCredits: canUse.balance - estimatedCost
    };
  }

  /**
   * Check if user can use credits
   */
  async canUseCredits(userId: string, estimatedCost: number): Promise<{
    canUse: boolean;
    balance: number;
    reason: string;
  }> {
    try {
      const userBilling = await this.getUserBillingPreference(userId);
      
      // Check if user account is active
      if (!userBilling.isActive) {
        return {
          canUse: false,
          balance: 0,
          reason: 'User account is inactive'
        };
      }

      // Check credit balance
      if (userBilling.creditBalance < estimatedCost) {
        return {
          canUse: false,
          balance: userBilling.creditBalance,
          reason: `Insufficient credits. Balance: $${userBilling.creditBalance.toFixed(2)}, Required: $${estimatedCost.toFixed(2)}`
        };
      }

      // Check monthly spending limit
      if (userBilling.monthlyUsage + estimatedCost > userBilling.maxMonthlySpend) {
        return {
          canUse: false,
          balance: userBilling.creditBalance,
          reason: `Monthly spending limit exceeded. Used: $${userBilling.monthlyUsage.toFixed(2)}, Limit: $${userBilling.maxMonthlySpend.toFixed(2)}`
        };
      }

      return {
        canUse: true,
        balance: userBilling.creditBalance,
        reason: 'Credits available'
      };

    } catch (error: any) {
      return {
        canUse: false,
        balance: 0,
        reason: `Error checking credits: ${error.message}`
      };
    }
  }

  /**
   * Record usage for billing
   */
  async recordUsage(usage: UsageRecord): Promise<void> {
    // Update local user billing
    if (usage.paymentMethod === 'credits') {
      await this.deductCredits(usage.userId, usage.estimatedCost);
    }

    // Report to OpenSaaS for billing
    await this.openSaasClient.recordUsage(usage.userId, usage);

    console.log(`💰 Usage recorded: ${usage.paymentMethod} - $${usage.estimatedCost.toFixed(4)} (${usage.provider}/${usage.model})`);
  }

  /**
   * Deduct credits from user balance
   */
  private async deductCredits(userId: string, amount: number): Promise<void> {
    const userBilling = await this.getUserBillingPreference(userId);
    
    const updates: Partial<UserBillingPreference> = {
      creditBalance: Math.max(0, userBilling.creditBalance - amount),
      monthlyUsage: userBilling.monthlyUsage + amount
    };

    await this.openSaasClient.updateUserBilling(userId, updates);
  }

  /**
   * Get user billing preferences
   */
  async getUserBillingPreference(userId: string): Promise<UserBillingPreference> {
    let userBilling = await this.openSaasClient.getUserBilling(userId);
    
    if (!userBilling) {
      // Create default billing preference for new user
      userBilling = {
        userId,
        preferredMode: this.config.defaultUserMode,
        maxMonthlySpend: 10.00, // $10 default monthly limit
        creditBalance: this.config.freeCreditsPerMonth,
        monthlyUsage: 0,
        lastResetDate: new Date(),
        isActive: true,
        byokProviders: ['anthropic', 'openai', 'google']
      };
      
      await this.openSaasClient.updateUserBilling(userId, userBilling);
    }

    // Reset monthly usage if new month
    if (this.shouldResetMonthlyUsage(userBilling.lastResetDate)) {
      userBilling.monthlyUsage = 0;
      userBilling.lastResetDate = new Date();
      await this.openSaasClient.updateUserBilling(userId, {
        monthlyUsage: 0,
        lastResetDate: new Date()
      });
    }

    return userBilling;
  }

  /**
   * Update user billing preferences
   */
  async updateUserBillingPreference(
    userId: string, 
    updates: Partial<UserBillingPreference>
  ): Promise<void> {
    await this.openSaasClient.updateUserBilling(userId, updates);
  }

  /**
   * Estimate cost for AI request
   */
  private estimateCost(provider: Provider, model: Model, tokens: number): number {
    // Simplified cost estimation - in production, use real pricing
    const costPerToken = this.getCostPerToken(provider, model);
    return tokens * costPerToken;
  }

  /**
   * Get cost per token for provider/model
   */
  private getCostPerToken(provider: Provider, model: Model): number {
    return pricing[provider]?.[model] ?? 0.00001;
  }

  /**
   * Check if monthly usage should be reset
   */
  private shouldResetMonthlyUsage(lastResetDate: Date): boolean {
    const now = new Date();
    const lastReset = new Date(lastResetDate);
    
    return now.getMonth() !== lastReset.getMonth() || 
           now.getFullYear() !== lastReset.getFullYear();
  }

  /**
   * Get user billing status
   */
  async getBillingStatus(userId: string): Promise<{
    preferredMode: string;
    creditBalance: number;
    monthlyUsage: number;
    monthlyLimit: number;
    isActive: boolean;
    lowBalanceWarning: boolean;
    byokProviders: string[];
  }> {
    const userBilling = await this.getUserBillingPreference(userId);
    
    return {
      preferredMode: userBilling.preferredMode,
      creditBalance: userBilling.creditBalance,
      monthlyUsage: userBilling.monthlyUsage,
      monthlyLimit: userBilling.maxMonthlySpend,
      isActive: userBilling.isActive,
      lowBalanceWarning: userBilling.creditBalance < this.config.lowBalanceThreshold,
      byokProviders: userBilling.byokProviders
    };
  }

  /**
   * Add credits to user account (called by OpenSaaS webhooks)
   */
  async addCredits(userId: string, amount: number, reason: string): Promise<void> {
    const userBilling = await this.getUserBillingPreference(userId);
    
    const newBalance = Math.min(
      userBilling.creditBalance + amount,
      this.config.maxCreditBalance
    );

    await this.openSaasClient.updateUserBilling(userId, {
      creditBalance: newBalance
    });

    console.log(`💳 Credits added: ${userId} +$${amount} (${reason})`);
  }
}