/**
 * Hybrid User Service
 *
 * Manages users with multiple payment methods:
 * - Subscription tokens (recurring)
 * - One-time token purchases
 * - BYOK (Bring Your Own Key)
 *
 * Handles consumption order preferences and fallback logic
 */
import { v4 as uuidv4 } from 'uuid';
export class HybridUserService {
    db;
    usageAnalytics;
    constructor(db, usageAnalytics) {
        this.db = db;
        this.usageAnalytics = usageAnalytics;
    }
    /**
     * Get or create user profile
     */
    async ensureUserProfile(userId, email) {
        let profile = await this.getUserProfile(userId);
        if (!profile) {
            await this.db.query(`INSERT INTO user_profiles (user_id, email) VALUES ($1, $2)`, [userId, email]);
            profile = await this.getUserProfile(userId);
        }
        return profile;
    }
    /**
     * Get user profile with all capabilities and preferences
     */
    async getUserProfile(userId) {
        const result = await this.db.query(`SELECT user_id, email, has_subscription, has_one_time_purchases, has_byok_configured,
              consumption_order, byok_enabled, byok_providers, notify_token_low_threshold,
              notify_fallback_to_byok, notify_one_time_consumed, subscription_tier,
              subscription_status, created_at, updated_at
       FROM user_profiles WHERE user_id = $1`, [userId]);
        if (result.length === 0)
            return null;
        const row = result[0];
        return {
            userId: row.user_id,
            email: row.email,
            hasSubscription: row.has_subscription,
            hasOneTimePurchases: row.has_one_time_purchases,
            hasByokConfigured: row.has_byok_configured,
            consumptionOrder: row.consumption_order || ['subscription', 'one_time', 'byok'],
            byokEnabled: row.byok_enabled,
            byokProviders: row.byok_providers || {},
            notifyTokenLowThreshold: parseInt(row.notify_token_low_threshold),
            notifyFallbackToByok: row.notify_fallback_to_byok,
            notifyOneTimeConsumed: row.notify_one_time_consumed,
            subscriptionTier: row.subscription_tier,
            subscriptionStatus: row.subscription_status,
            createdAt: row.created_at,
            updatedAt: row.updated_at
        };
    }
    /**
     * Update user preferences
     */
    async updateUserPreferences(userId, preferences) {
        const updateFields = [];
        const values = [];
        let paramIndex = 1;
        if (preferences.consumptionOrder) {
            updateFields.push(`consumption_order = $${paramIndex++}`);
            values.push(JSON.stringify(preferences.consumptionOrder));
        }
        if (preferences.byokEnabled !== undefined) {
            updateFields.push(`byok_enabled = $${paramIndex++}`);
            values.push(preferences.byokEnabled);
        }
        if (preferences.byokProviders) {
            updateFields.push(`byok_providers = $${paramIndex++}`);
            values.push(JSON.stringify(preferences.byokProviders));
        }
        if (preferences.notifyTokenLowThreshold) {
            updateFields.push(`notify_token_low_threshold = $${paramIndex++}`);
            values.push(preferences.notifyTokenLowThreshold);
        }
        if (preferences.notifyFallbackToByok !== undefined) {
            updateFields.push(`notify_fallback_to_byok = $${paramIndex++}`);
            values.push(preferences.notifyFallbackToByok);
        }
        if (preferences.notifyOneTimeConsumed !== undefined) {
            updateFields.push(`notify_one_time_consumed = $${paramIndex++}`);
            values.push(preferences.notifyOneTimeConsumed);
        }
        if (updateFields.length > 0) {
            updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
            values.push(userId);
            await this.db.query(`UPDATE user_profiles SET ${updateFields.join(', ')} WHERE user_id = $${paramIndex}`, values);
        }
    }
    /**
     * Get all token balances for user, ordered by consumption priority
     */
    async getUserTokenBalances(userId) {
        const result = await this.db.query(`SELECT id, user_id, balance_type, virtual_token_balance, total_tokens_purchased,
              total_tokens_used, platform_fee_collected, purchase_source, purchase_date,
              expiry_date, consumption_priority, created_at, updated_at
       FROM user_token_balances 
       WHERE user_id = $1 AND virtual_token_balance > 0
       ORDER BY consumption_priority ASC, created_at ASC`, [userId]);
        return result.map(row => ({
            id: row.id,
            userId: row.user_id,
            balanceType: row.balance_type,
            virtualTokenBalance: parseInt(row.virtual_token_balance),
            totalTokensPurchased: parseInt(row.total_tokens_purchased),
            totalTokensUsed: parseInt(row.total_tokens_used),
            platformFeeCollected: parseInt(row.platform_fee_collected),
            purchaseSource: row.purchase_source,
            purchaseDate: row.purchase_date,
            expiryDate: row.expiry_date,
            consumptionPriority: parseInt(row.consumption_priority)
        }));
    }
    /**
     * Plan token consumption based on user preferences
     * IMPORTANT: BYOK is all-or-nothing (can't split tokens across managed/unmanaged balances)
     */
    async planConsumption(userId, tokensNeeded, apiKey) {
        const profile = await this.getUserProfile(userId);
        if (!profile) {
            throw new Error('User profile not found');
        }
        const balances = await this.getUserTokenBalances(userId);
        const plan = [];
        const notifications = [];
        // First, calculate total available managed tokens (subscription + one-time)
        const totalManagedTokens = balances.reduce((sum, balance) => sum + balance.virtualTokenBalance, 0);
        // Strategy 1: Try to use only managed tokens (subscription + one-time)
        if (totalManagedTokens >= tokensNeeded) {
            let remainingTokens = tokensNeeded;
            // Follow user's consumption order for managed tokens only
            for (const method of profile.consumptionOrder) {
                if (remainingTokens <= 0)
                    break;
                if (method === 'byok')
                    continue; // Skip BYOK in managed-only strategy
                if (method === 'subscription') {
                    const subscriptionBalances = balances.filter(b => b.balanceType === 'subscription');
                    for (const balance of subscriptionBalances) {
                        if (remainingTokens <= 0)
                            break;
                        const tokensToUse = Math.min(remainingTokens, balance.virtualTokenBalance);
                        if (tokensToUse > 0) {
                            plan.push({
                                type: 'subscription',
                                balanceId: balance.id,
                                tokensToConsume: tokensToUse,
                                reason: `Using subscription tokens from ${balance.purchaseSource}`
                            });
                            remainingTokens -= tokensToUse;
                            // Check if balance will be low after consumption
                            const remainingInBalance = balance.virtualTokenBalance - tokensToUse;
                            if (remainingInBalance <= profile.notifyTokenLowThreshold && remainingInBalance > 0) {
                                notifications.push({
                                    type: 'token_low',
                                    message: `Subscription token balance will be low (${remainingInBalance} remaining) after this request`,
                                    critical: false
                                });
                            }
                        }
                    }
                }
                if (method === 'one_time') {
                    const oneTimeBalances = balances.filter(b => b.balanceType === 'one_time');
                    for (const balance of oneTimeBalances) {
                        if (remainingTokens <= 0)
                            break;
                        const tokensToUse = Math.min(remainingTokens, balance.virtualTokenBalance);
                        if (tokensToUse > 0) {
                            plan.push({
                                type: 'one_time',
                                balanceId: balance.id,
                                tokensToConsume: tokensToUse,
                                reason: `Using one-time purchase tokens from ${balance.purchaseSource}`
                            });
                            remainingTokens -= tokensToUse;
                            if (profile.notifyOneTimeConsumed) {
                                notifications.push({
                                    type: 'one_time_consumed',
                                    message: `Using ${tokensToUse} tokens from one-time purchase (${balance.purchaseSource})`,
                                    critical: false
                                });
                            }
                        }
                    }
                }
            }
            // Managed tokens can cover the request
            return {
                totalTokensNeeded: tokensNeeded,
                plan,
                notifications
            };
        }
        // Strategy 2: Managed tokens insufficient, try BYOK fallback (all-or-nothing)
        if (profile.byokEnabled && apiKey && profile.consumptionOrder.includes('byok')) {
            plan.length = 0; // Clear managed token plan
            plan.push({
                type: 'byok',
                tokensToConsume: tokensNeeded,
                reason: 'Using your API key (BYOK) - insufficient managed token balance'
            });
            if (profile.notifyFallbackToByok) {
                notifications.push({
                    type: 'fallback_to_byok',
                    message: `Insufficient managed tokens (${totalManagedTokens} available, ${tokensNeeded} needed). Using your API key for full request.`,
                    critical: false
                });
            }
            if (totalManagedTokens > 0) {
                notifications.push({
                    type: 'token_low',
                    message: `You have ${totalManagedTokens} unused managed tokens that will be preserved.`,
                    critical: false
                });
            }
            return {
                totalTokensNeeded: tokensNeeded,
                plan,
                notifications
            };
        }
        // Strategy 3: Cannot fulfill request
        notifications.push({
            type: 'balance_exhausted',
            message: `Cannot fulfill request. Need ${tokensNeeded} tokens but only have ${totalManagedTokens} managed tokens and ${apiKey ? 'API key not configured for fallback' : 'no API key provided'}.`,
            critical: true
        });
        return {
            totalTokensNeeded: tokensNeeded,
            plan: [],
            notifications
        };
    }
    /**
     * Execute token consumption based on plan
     * IMPORTANT: Plan is either all managed tokens OR all BYOK (no mixing)
     */
    async executeConsumption(userId, tokensNeeded, provider, model, requestId, apiKey) {
        const plan = await this.planConsumption(userId, tokensNeeded, apiKey);
        // Check if plan is viable
        const totalPlannedTokens = plan.plan.reduce((sum, item) => sum + item.tokensToConsume, 0);
        if (totalPlannedTokens < tokensNeeded) {
            return {
                success: false,
                tokensConsumed: 0,
                actualConsumption: [],
                fallbackUsed: false,
                notifications: plan.notifications.map(n => n.message),
                usageLogId: ''
            };
        }
        const client = await this.db.getConnection();
        const actualConsumption = [];
        let fallbackUsed = false;
        try {
            await client.query('BEGIN');
            // Determine consumption strategy
            const isUsingBYOK = plan.plan.length === 1 && plan.plan[0].type === 'byok';
            if (isUsingBYOK) {
                // BYOK strategy: Don't touch any managed tokens
                actualConsumption.push({
                    type: 'byok',
                    tokensConsumed: tokensNeeded
                });
                fallbackUsed = true;
            }
            else {
                // Managed tokens strategy: Execute consumption from multiple balances
                for (const step of plan.plan) {
                    if (step.type === 'subscription' || step.type === 'one_time') {
                        // Deduct from token balance
                        const result = await client.query(`UPDATE user_token_balances 
               SET virtual_token_balance = virtual_token_balance - $1,
                   total_tokens_used = total_tokens_used + $2,
                   updated_at = CURRENT_TIMESTAMP
               WHERE id = $3 AND virtual_token_balance >= $1
               RETURNING virtual_token_balance`, [step.tokensToConsume, step.tokensToConsume, step.balanceId]);
                        if (result.rowCount === 0) {
                            throw new Error(`Insufficient balance in ${step.type} account`);
                        }
                        actualConsumption.push({
                            type: step.type,
                            balanceId: step.balanceId,
                            tokensConsumed: step.tokensToConsume,
                            newBalance: parseInt(result.rows[0].virtual_token_balance)
                        });
                    }
                }
            }
            // Log the consumption
            const usageLogId = uuidv4();
            await client.query(`INSERT INTO token_consumption_log 
         (id, user_id, request_id, total_tokens_needed, consumption_plan, actual_consumption, notifications_sent)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`, [
                usageLogId, userId, requestId, tokensNeeded,
                JSON.stringify(plan.plan), JSON.stringify(actualConsumption),
                JSON.stringify(plan.notifications)
            ]);
            // Record in usage analytics
            await this.usageAnalytics.recordUsage({
                userId,
                userType: fallbackUsed ? 'byok' : 'subscription',
                provider,
                model,
                inputTokens: Math.floor(tokensNeeded * 0.4), // Rough estimate
                outputTokens: Math.floor(tokensNeeded * 0.6),
                totalTokens: tokensNeeded,
                requestId,
                method: 'executeAIRequest'
            });
            await client.query('COMMIT');
            return {
                success: true,
                tokensConsumed: tokensNeeded,
                actualConsumption,
                fallbackUsed,
                notifications: plan.notifications.map(n => n.message),
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
     * Add tokens to user's balance (from purchases)
     */
    async addTokens(userId, balanceType, tokens, purchaseSource, purchaseId, priority = 100, expiryDate) {
        const balanceId = uuidv4();
        // Calculate usable tokens (80% of purchased)
        const usableTokens = Math.floor(tokens * 0.8);
        const platformFee = tokens - usableTokens;
        await this.db.query(`INSERT INTO user_token_balances 
       (id, user_id, balance_type, virtual_token_balance, total_tokens_purchased,
        platform_fee_collected, purchase_source, purchase_date, expiry_date, consumption_priority)
       VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, $8, $9)`, [balanceId, userId, balanceType, usableTokens, tokens, platformFee, purchaseSource, expiryDate, priority]);
        // Update user profile capabilities
        const updateField = balanceType === 'subscription' ? 'has_subscription' : 'has_one_time_purchases';
        await this.db.query(`UPDATE user_profiles SET ${updateField} = TRUE, updated_at = CURRENT_TIMESTAMP WHERE user_id = $1`, [userId]);
        return balanceId;
    }
    /**
     * Configure BYOK for user
     */
    async configureBYOK(userId, providers, enabled = true) {
        await this.db.query(`UPDATE user_profiles 
       SET byok_enabled = $1, byok_providers = $2, has_byok_configured = TRUE, updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $3`, [enabled, JSON.stringify(providers), userId]);
    }
    /**
     * Get consumption history for user
     */
    async getConsumptionHistory(userId, limit = 50) {
        const result = await this.db.query(`SELECT id, request_id, total_tokens_needed, consumption_plan, actual_consumption,
              notifications_sent, created_at
       FROM token_consumption_log
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2`, [userId, limit]);
        return result.map(row => ({
            id: row.id,
            requestId: row.request_id,
            totalTokensNeeded: parseInt(row.total_tokens_needed),
            consumptionPlan: row.consumption_plan,
            actualConsumption: row.actual_consumption,
            notificationsSent: row.notifications_sent,
            createdAt: row.created_at
        }));
    }
}
