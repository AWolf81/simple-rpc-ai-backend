/**
 * Virtual Token Service
 *
 * Handles virtual token balance tracking with 80/20 split:
 * - 80% of purchased tokens are usable by users
 * - 20% kept as platform fee
 * - Tracks actual AI provider token usage
 * - Source of truth for user token balances
 */
import { v4 as uuidv4 } from 'uuid';
export class VirtualTokenService {
    db;
    constructor(db) {
        this.db = db;
    }
    /**
     * Ensure user token account exists (create if needed)
     */
    async ensureUserAccount(userId, email) {
        const existing = await this.db.query('SELECT user_id FROM user_token_accounts WHERE user_id = $1', [userId]);
        if (existing.length === 0) {
            await this.db.query(`INSERT INTO user_token_accounts (user_id, email, virtual_token_balance, total_tokens_purchased, total_tokens_used, platform_fee_collected)
         VALUES ($1, $2, $3, $4, $5, $6)`, [userId, email, 0, 0, 0, 0]);
        }
    }
    /**
     * Get user's current token balance
     */
    async getTokenBalance(userId) {
        const result = await this.db.query(`SELECT user_id, email, virtual_token_balance, total_tokens_purchased, 
              total_tokens_used, platform_fee_collected, created_at, updated_at
       FROM user_token_accounts 
       WHERE user_id = $1`, [userId]);
        if (result.length === 0) {
            return null;
        }
        const row = result[0];
        return {
            userId: row.user_id,
            email: row.email,
            virtualTokenBalance: parseInt(row.virtual_token_balance),
            totalTokensPurchased: parseInt(row.total_tokens_purchased),
            totalTokensUsed: parseInt(row.total_tokens_used),
            platformFeeCollected: parseInt(row.platform_fee_collected),
            createdAt: row.created_at,
            updatedAt: row.updated_at
        };
    }
    /**
     * Check if user has sufficient tokens for estimated usage
     */
    async checkTokenBalance(userId, estimatedTokens) {
        const balance = await this.getTokenBalance(userId);
        if (!balance) {
            return false;
        }
        // Calculate what we'd charge (actual usage + 20% platform fee)
        const chargeAmount = Math.ceil(estimatedTokens * 1.25); // 125% of estimated usage
        return balance.virtualTokenBalance >= chargeAmount;
    }
    /**
     * Deduct tokens after AI request with 80/20 split
     */
    async deductTokens(userId, actualTokens, provider, model, requestId, method) {
        const platformFeeTokens = Math.ceil(actualTokens * 0.25); // 20% of total charge (25% of actual usage)
        const totalCharge = actualTokens + platformFeeTokens; // User pays actual + 25% fee
        const client = await this.db.getConnection();
        try {
            await client.query('BEGIN');
            // Check current balance
            const balanceResult = await client.query('SELECT virtual_token_balance FROM user_token_accounts WHERE user_id = $1 FOR UPDATE', [userId]);
            if (balanceResult.rowCount === 0) {
                throw new Error('User account not found');
            }
            const currentBalance = parseInt(balanceResult.rows[0].virtual_token_balance);
            if (currentBalance < totalCharge) {
                await client.query('ROLLBACK');
                return {
                    success: false,
                    newBalance: currentBalance,
                    tokensDeducted: 0,
                    platformFee: 0,
                    usageLogId: ''
                };
            }
            // Deduct from user balance and update usage counters
            const newBalance = currentBalance - totalCharge;
            await client.query(`UPDATE user_token_accounts 
         SET virtual_token_balance = $1,
             total_tokens_used = total_tokens_used + $2,
             platform_fee_collected = platform_fee_collected + $3,
             updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $4`, [newBalance, actualTokens, platformFeeTokens, userId]);
            // Log the usage
            const usageLogId = uuidv4();
            await client.query(`INSERT INTO token_usage_log 
         (id, user_id, request_id, provider, model, input_tokens, output_tokens, 
          total_tokens, virtual_tokens_deducted, platform_fee_tokens, method)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`, [usageLogId, userId, requestId, provider, model, 0, 0, actualTokens, totalCharge, platformFeeTokens, method]);
            await client.query('COMMIT');
            return {
                success: true,
                newBalance,
                tokensDeducted: totalCharge,
                platformFee: platformFeeTokens,
                usageLogId
            };
        }
        catch (error) {
            await client.query('ROLLBACK');
            throw error;
        }
        finally {
            client.release();
        }
    }
    /**
     * Add tokens from payment webhook (80% usable, 20% platform fee)
     */
    async addTokensFromPayment(userId, tokensPurchased, paymentId, variantId, amountPaidCents, currency = 'USD', webhookData) {
        // 80% of purchased tokens are usable, 20% is platform fee
        const usableTokens = Math.floor(tokensPurchased * 0.8);
        const platformFeeTokens = tokensPurchased - usableTokens;
        const client = await this.db.getConnection();
        try {
            await client.query('BEGIN');
            // Ensure user account exists
            await this.ensureUserAccount(userId);
            // Add tokens to user balance
            await client.query(`UPDATE user_token_accounts 
         SET virtual_token_balance = virtual_token_balance + $1,
             total_tokens_purchased = total_tokens_purchased + $2,
             updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $3`, [usableTokens, tokensPurchased, userId]);
            // Log the top-up
            const topupId = uuidv4();
            await client.query(`INSERT INTO token_topups 
         (id, user_id, payment_id, variant_id, tokens_purchased, usable_tokens, 
          platform_fee_tokens, amount_paid_cents, currency, lemonsqueezy_data)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`, [topupId, userId, paymentId, variantId, tokensPurchased, usableTokens,
                platformFeeTokens, amountPaidCents, currency, JSON.stringify(webhookData)]);
            await client.query('COMMIT');
            return {
                id: topupId,
                userId,
                paymentId,
                variantId,
                tokensPurchased,
                usableTokens,
                platformFeeTokens,
                amountPaidCents,
                currency,
                processedAt: new Date()
            };
        }
        catch (error) {
            await client.query('ROLLBACK');
            throw error;
        }
        finally {
            client.release();
        }
    }
    /**
     * Get user's recent token usage history
     */
    async getUsageHistory(userId, limit = 50) {
        const result = await this.db.query(`SELECT id, user_id, request_id, provider, model, input_tokens, output_tokens,
              total_tokens, virtual_tokens_deducted, platform_fee_tokens, 
              cost_per_1k_tokens, method, timestamp
       FROM token_usage_log 
       WHERE user_id = $1 
       ORDER BY timestamp DESC 
       LIMIT $2`, [userId, limit]);
        return result.map(row => ({
            id: row.id,
            userId: row.user_id,
            requestId: row.request_id,
            provider: row.provider,
            model: row.model,
            inputTokens: parseInt(row.input_tokens),
            outputTokens: parseInt(row.output_tokens),
            totalTokens: parseInt(row.total_tokens),
            virtualTokensDeducted: parseInt(row.virtual_tokens_deducted),
            platformFeeTokens: parseInt(row.platform_fee_tokens),
            costPer1kTokens: row.cost_per_1k_tokens ? parseFloat(row.cost_per_1k_tokens) : undefined,
            method: row.method,
            timestamp: row.timestamp
        }));
    }
    /**
     * Get user's token purchase history
     */
    async getTopupHistory(userId, limit = 20) {
        const result = await this.db.query(`SELECT id, user_id, payment_id, variant_id, tokens_purchased, usable_tokens,
              platform_fee_tokens, amount_paid_cents, currency, processed_at
       FROM token_topups 
       WHERE user_id = $1 
       ORDER BY processed_at DESC 
       LIMIT $2`, [userId, limit]);
        return result.map(row => ({
            id: row.id,
            userId: row.user_id,
            paymentId: row.payment_id,
            variantId: row.variant_id,
            tokensPurchased: parseInt(row.tokens_purchased),
            usableTokens: parseInt(row.usable_tokens),
            platformFeeTokens: parseInt(row.platform_fee_tokens),
            amountPaidCents: row.amount_paid_cents ? parseInt(row.amount_paid_cents) : undefined,
            currency: row.currency,
            processedAt: row.processed_at
        }));
    }
    /**
     * Check if payment has already been processed
     */
    async isPaymentProcessed(paymentId) {
        const result = await this.db.query('SELECT COUNT(*) as count FROM token_topups WHERE payment_id = $1', [paymentId]);
        return parseInt(result[0].count) > 0;
    }
}
//# sourceMappingURL=virtual-token-service.js.map