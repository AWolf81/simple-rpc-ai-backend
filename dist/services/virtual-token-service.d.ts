/**
 * Virtual Token Service
 *
 * Handles virtual token balance tracking with 80/20 split:
 * - 80% of purchased tokens are usable by users
 * - 20% kept as platform fee
 * - Tracks actual AI provider token usage
 * - Source of truth for user token balances
 */
import { PostgreSQLAdapter } from '../database/postgres-adapter.js';
export interface TokenBalance {
    userId: string;
    email?: string;
    virtualTokenBalance: number;
    totalTokensPurchased: number;
    totalTokensUsed: number;
    platformFeeCollected: number;
    createdAt: Date;
    updatedAt: Date;
}
export interface TokenUsage {
    id: string;
    userId: string;
    requestId?: string;
    provider: string;
    model?: string;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    virtualTokensDeducted: number;
    platformFeeTokens: number;
    costPer1kTokens?: number;
    method?: string;
    timestamp: Date;
}
export interface TokenTopup {
    id: string;
    userId: string;
    paymentId: string;
    variantId?: string;
    tokensPurchased: number;
    usableTokens: number;
    platformFeeTokens: number;
    amountPaidCents?: number;
    currency: string;
    processedAt: Date;
}
export interface TokenDeductionResult {
    success: boolean;
    newBalance: number;
    tokensDeducted: number;
    platformFee: number;
    usageLogId: string;
}
export declare class VirtualTokenService {
    private db;
    constructor(db: PostgreSQLAdapter);
    /**
     * Ensure user token account exists (create if needed)
     */
    ensureUserAccount(userId: string, email?: string): Promise<void>;
    /**
     * Get user's current token balance
     */
    getTokenBalance(userId: string): Promise<TokenBalance | null>;
    /**
     * Check if user has sufficient tokens for estimated usage
     */
    checkTokenBalance(userId: string, estimatedTokens: number): Promise<boolean>;
    /**
     * Deduct tokens after AI request with 80/20 split
     */
    deductTokens(userId: string, actualTokens: number, provider: string, model?: string, requestId?: string, method?: string): Promise<TokenDeductionResult>;
    /**
     * Add tokens from payment webhook (80% usable, 20% platform fee)
     */
    addTokensFromPayment(userId: string, tokensPurchased: number, paymentId: string, variantId?: string, amountPaidCents?: number, currency?: string, webhookData?: any): Promise<TokenTopup>;
    /**
     * Get user's recent token usage history
     */
    getUsageHistory(userId: string, limit?: number): Promise<TokenUsage[]>;
    /**
     * Get user's token purchase history
     */
    getTopupHistory(userId: string, limit?: number): Promise<TokenTopup[]>;
    /**
     * Check if payment has already been processed
     */
    isPaymentProcessed(paymentId: string): Promise<boolean>;
}
//# sourceMappingURL=virtual-token-service.d.ts.map