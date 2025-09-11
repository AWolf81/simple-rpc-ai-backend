/**
 * Usage Analytics Service
 * 
 * Tracks usage information for both subscription and BYOK users.
 * For subscription users: Used for billing and limiting
 * For BYOK users: Used for analytics and display only (no limiting)
 */

import { PostgreSQLAdapter } from '../database/postgres-adapter';
import { v4 as uuidv4 } from 'uuid';

export interface UsageRecord {
  id: string;
  userId: string;
  userType: 'subscription' | 'byok';
  provider: string;
  model?: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCostUsd?: number;
  requestId?: string;
  method?: string;
  timestamp: Date;
  metadata?: any;
}

export interface UserStatus {
  userId: string;
  email?: string;
  userType: 'subscription' | 'byok' | 'unknown';
  hasSubscription: boolean;
  hasPurchases: boolean;
  totalPurchases?: number;
  totalAmountSpentCents?: number;
  subscriptionTier?: string;
  createdAt: Date;
}

export interface PurchaseRecord {
  id: string;
  userId: string;
  paymentId: string;
  purchaseType: 'subscription' | 'one_time';
  variantId?: string;
  quantity?: number;
  amountPaidCents: number;
  currency: string;
  processedAt: Date;
  lemonSqueezyData?: any;
}

export class UsageAnalyticsService {
  constructor(private db: PostgreSQLAdapter) {}

  /**
   * Record usage for any user (subscription or BYOK)
   */
  async recordUsage(record: Omit<UsageRecord, 'id' | 'timestamp'>): Promise<string> {
    const id = uuidv4();
    
    await this.db.query(
      `INSERT INTO usage_analytics 
       (id, user_id, user_type, provider, model, input_tokens, output_tokens, 
        total_tokens, estimated_cost_usd, request_id, method, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        id, record.userId, record.userType, record.provider, record.model,
        record.inputTokens, record.outputTokens, record.totalTokens,
        record.estimatedCostUsd, record.requestId, record.method,
        JSON.stringify(record.metadata)
      ]
    );

    return id;
  }

  /**
   * Get user's usage history (for analytics display)
   */
  async getUserUsageHistory(userId: string, limit = 50): Promise<UsageRecord[]> {
    const result = await this.db.query(
      `SELECT id, user_id, user_type, provider, model, input_tokens, output_tokens,
              total_tokens, estimated_cost_usd, request_id, method, timestamp, metadata
       FROM usage_analytics 
       WHERE user_id = $1 
       ORDER BY timestamp DESC 
       LIMIT $2`,
      [userId, limit]
    );

    return result.map(row => ({
      id: row.id,
      userId: row.user_id,
      userType: row.user_type,
      provider: row.provider,
      model: row.model,
      inputTokens: parseInt(row.input_tokens),
      outputTokens: parseInt(row.output_tokens),
      totalTokens: parseInt(row.total_tokens),
      estimatedCostUsd: row.estimated_cost_usd ? parseFloat(row.estimated_cost_usd) : undefined,
      requestId: row.request_id,
      method: row.method,
      timestamp: row.timestamp,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined
    }));
  }

  /**
   * Get user's usage summary
   */
  async getUserUsageSummary(userId: string, days = 30): Promise<{
    totalRequests: number;
    totalTokens: number;
    estimatedTotalCostUsd: number;
    averageTokensPerRequest: number;
    providerBreakdown: Array<{
      provider: string;
      requests: number;
      tokens: number;
      estimatedCostUsd: number;
    }>;
  }> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const summary = await this.db.query(
      `SELECT 
         COUNT(*) as total_requests,
         SUM(total_tokens) as total_tokens,
         SUM(estimated_cost_usd) as estimated_total_cost_usd,
         AVG(total_tokens) as average_tokens_per_request
       FROM usage_analytics 
       WHERE user_id = $1 AND timestamp >= $2`,
      [userId, cutoffDate]
    );

    const providerBreakdown = await this.db.query(
      `SELECT 
         provider,
         COUNT(*) as requests,
         SUM(total_tokens) as tokens,
         SUM(estimated_cost_usd) as estimated_cost_usd
       FROM usage_analytics 
       WHERE user_id = $1 AND timestamp >= $2
       GROUP BY provider
       ORDER BY tokens DESC`,
      [userId, cutoffDate]
    );

    const summaryRow = summary[0];
    return {
      totalRequests: parseInt(summaryRow.total_requests) || 0,
      totalTokens: parseInt(summaryRow.total_tokens) || 0,
      estimatedTotalCostUsd: parseFloat(summaryRow.estimated_total_cost_usd) || 0,
      averageTokensPerRequest: parseFloat(summaryRow.average_tokens_per_request) || 0,
      providerBreakdown: providerBreakdown.map(row => ({
        provider: row.provider,
        requests: parseInt(row.requests),
        tokens: parseInt(row.tokens),
        estimatedCostUsd: parseFloat(row.estimated_cost_usd) || 0
      }))
    };
  }

  /**
   * Get user status (subscription vs BYOK, purchase history)
   */
  async getUserStatus(userId: string): Promise<UserStatus> {
    // Check if user has token account (subscription user)
    const tokenAccount = await this.db.query(
      'SELECT email, created_at FROM user_token_accounts WHERE user_id = $1',
      [userId]
    );

    // Check purchase history
    const purchases = await this.db.query(
      `SELECT COUNT(*) as purchase_count, 
              SUM(amount_paid_cents) as total_amount_cents,
              SUM(CASE WHEN purchase_type = 'one_time' THEN quantity ELSE 0 END) as total_quantity
       FROM user_purchases 
       WHERE user_id = $1`,
      [userId]
    );

    const purchaseRow = purchases[0];
    const hasPurchases = parseInt(purchaseRow.purchase_count) > 0;
    const hasSubscription = tokenAccount.length > 0;

    let userType: 'subscription' | 'byok' | 'unknown' = 'unknown';
    if (hasSubscription) {
      userType = 'subscription';
    } else if (hasPurchases) {
      // User has purchases but no token account - likely BYOK with payment history
      userType = 'byok';
    }

    return {
      userId,
      email: tokenAccount[0]?.email,
      userType,
      hasSubscription,
      hasPurchases,
      totalPurchases: parseInt(purchaseRow.purchase_count) || 0,
      totalAmountSpentCents: parseInt(purchaseRow.total_amount_cents) || 0,
      createdAt: tokenAccount[0]?.created_at || new Date()
    };
  }

  /**
   * Record a purchase (subscription or one-time)
   */
  async recordPurchase(purchase: Omit<PurchaseRecord, 'id' | 'processedAt'>): Promise<string> {
    const id = uuidv4();
    
    await this.db.query(
      `INSERT INTO user_purchases 
       (id, user_id, payment_id, purchase_type, variant_id, quantity, 
        amount_paid_cents, currency, lemonsqueezy_data)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        id, purchase.userId, purchase.paymentId, purchase.purchaseType,
        purchase.variantId, purchase.quantity, purchase.amountPaidCents,
        purchase.currency, JSON.stringify(purchase.lemonSqueezyData)
      ]
    );

    return id;
  }

  /**
   * Get user's purchase history
   */
  async getUserPurchaseHistory(userId: string, limit = 20): Promise<PurchaseRecord[]> {
    const result = await this.db.query(
      `SELECT id, user_id, payment_id, purchase_type, variant_id, quantity,
              amount_paid_cents, currency, processed_at, lemonsqueezy_data
       FROM user_purchases 
       WHERE user_id = $1 
       ORDER BY processed_at DESC 
       LIMIT $2`,
      [userId, limit]
    );

    return result.map(row => ({
      id: row.id,
      userId: row.user_id,
      paymentId: row.payment_id,
      purchaseType: row.purchase_type,
      variantId: row.variant_id,
      quantity: row.quantity ? parseInt(row.quantity) : undefined,
      amountPaidCents: parseInt(row.amount_paid_cents),
      currency: row.currency,
      processedAt: row.processed_at,
      lemonSqueezyData: row.lemonsqueezy_data ? JSON.parse(row.lemonsqueezy_data) : undefined
    }));
  }

  /**
   * Check if payment has already been processed
   */
  async isPaymentProcessed(paymentId: string): Promise<boolean> {
    const result = await this.db.query(
      'SELECT COUNT(*) as count FROM user_purchases WHERE payment_id = $1',
      [paymentId]
    );
    return parseInt(result[0].count) > 0;
  }

  /**
   * Estimate cost based on provider and tokens
   */
  static estimateCost(provider: string, model: string, inputTokens: number, outputTokens: number): number {
    // Rough cost estimates per 1K tokens (in USD)
    const costPer1K: Record<string, Record<string, { input: number; output: number }>> = {
      anthropic: {
        'claude-3-5-sonnet-20241022': { input: 0.003, output: 0.015 },
        'claude-3-haiku-20240307': { input: 0.00025, output: 0.00125 }
      },
      openai: {
        'gpt-4o': { input: 0.0025, output: 0.01 },
        'gpt-4o-mini': { input: 0.00015, output: 0.0006 }
      },
      google: {
        'gemini-1.5-pro': { input: 0.00125, output: 0.005 },
        'gemini-1.5-flash': { input: 0.000075, output: 0.0003 }
      }
    };

    const rates = costPer1K[provider]?.[model] || { input: 0.001, output: 0.002 }; // fallback
    return (inputTokens * rates.input + outputTokens * rates.output) / 1000;
  }
}