import winston from 'winston';
/**
 * AI Provider pricing per 1K tokens (input/output)
 */
export const PROVIDER_PRICING = {
    anthropic: {
        'claude-3-sonnet': { input: 0.003, output: 0.015 },
        'claude-3-haiku': { input: 0.00025, output: 0.00125 },
        'claude-3-opus': { input: 0.015, output: 0.075 },
        'claude-3.5-sonnet': { input: 0.003, output: 0.015 }
    },
    openai: {
        'gpt-4': { input: 0.03, output: 0.06 },
        'gpt-4-turbo': { input: 0.01, output: 0.03 },
        'gpt-3.5-turbo': { input: 0.0015, output: 0.002 },
        'gpt-4o': { input: 0.005, output: 0.015 }
    },
    google: {
        'gemini-pro': { input: 0.0005, output: 0.0015 },
        'gemini-pro-vision': { input: 0.00025, output: 0.0005 }
    }
};
export class UsageTracker {
    db;
    logger;
    platformFeePercentage;
    constructor(db, platformFeePercentage = 0.20) {
        this.db = db;
        this.platformFeePercentage = platformFeePercentage;
        // Setup logging
        this.logger = winston.createLogger({
            level: 'info',
            format: winston.format.combine(winston.format.timestamp(), winston.format.errors({ stack: true }), winston.format.json()),
            defaultMeta: { service: 'usage-tracker' },
            transports: [
                new winston.transports.Console({
                    format: winston.format.combine(winston.format.colorize(), winston.format.simple())
                })
            ]
        });
    }
    /**
     * Initialize database tables for usage tracking
     */
    async initialize() {
        await this.db.execute(`
      CREATE TABLE IF NOT EXISTS usage_events (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        organization_id TEXT,
        request_id TEXT NOT NULL,
        method TEXT NOT NULL,
        provider TEXT NOT NULL,
        model TEXT,
        input_tokens INTEGER NOT NULL,
        output_tokens INTEGER NOT NULL,
        total_tokens INTEGER NOT NULL,
        cost REAL NOT NULL,
        platform_fee REAL NOT NULL,
        total_cost REAL NOT NULL,
        timestamp TEXT NOT NULL,
        metadata TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
        await this.db.execute(`
      CREATE TABLE IF NOT EXISTS user_quotas (
        user_id TEXT PRIMARY KEY,
        organization_id TEXT,
        subscription_tier TEXT NOT NULL,
        monthly_token_limit INTEGER NOT NULL,
        tokens_used INTEGER DEFAULT 0,
        cost_used REAL DEFAULT 0,
        reset_date DATE NOT NULL,
        last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
        await this.db.execute(`
      CREATE INDEX IF NOT EXISTS idx_usage_events_user_timestamp 
      ON usage_events(user_id, timestamp)
    `);
        await this.db.execute(`
      CREATE INDEX IF NOT EXISTS idx_usage_events_request_id 
      ON usage_events(request_id)
    `);
        this.logger.info('Usage tracking database initialized');
    }
    /**
     * Calculate cost for a provider/model combination
     */
    calculateCost(provider, model, inputTokens, outputTokens) {
        const providerPricing = PROVIDER_PRICING[provider];
        if (!providerPricing) {
            this.logger.warn(`Unknown provider: ${provider}, using default pricing`);
            // Default pricing fallback
            const cost = (inputTokens + outputTokens) * 0.001; // $0.001 per 1K tokens
            const platformFee = cost * this.platformFeePercentage;
            return { cost, platformFee, totalCost: cost + platformFee };
        }
        const modelPricing = providerPricing[model];
        if (!modelPricing) {
            this.logger.warn(`Unknown model ${model} for provider ${provider}, using average pricing`);
            // Use average pricing for the provider
            const models = Object.values(providerPricing);
            const avgInput = models.reduce((sum, m) => sum + m.input, 0) / models.length;
            const avgOutput = models.reduce((sum, m) => sum + m.output, 0) / models.length;
            const cost = (inputTokens / 1000) * avgInput + (outputTokens / 1000) * avgOutput;
            const platformFee = cost * this.platformFeePercentage;
            return { cost, platformFee, totalCost: cost + platformFee };
        }
        // Calculate exact cost
        const cost = (inputTokens / 1000) * modelPricing.input + (outputTokens / 1000) * modelPricing.output;
        const platformFee = cost * this.platformFeePercentage;
        return {
            cost: Number(cost.toFixed(6)),
            platformFee: Number(platformFee.toFixed(6)),
            totalCost: Number((cost + platformFee).toFixed(6))
        };
    }
    /**
     * Record a usage event
     */
    async recordUsage(event) {
        const totalTokens = event.inputTokens + event.outputTokens;
        const { cost, platformFee, totalCost } = this.calculateCost(event.provider, event.model || 'default', event.inputTokens, event.outputTokens);
        const fullEvent = {
            ...event,
            totalTokens,
            cost,
            platformFee,
            totalCost
        };
        try {
            // Insert usage event
            await this.db.execute(`INSERT INTO usage_events (
          id, user_id, organization_id, request_id, method, provider, model,
          input_tokens, output_tokens, total_tokens, cost, platform_fee, total_cost,
          timestamp, metadata
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
                `ue_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                event.userId,
                event.organizationId || null,
                event.requestId,
                event.method,
                event.provider,
                event.model || null,
                event.inputTokens,
                event.outputTokens,
                totalTokens,
                cost,
                platformFee,
                totalCost,
                event.timestamp.toISOString(),
                event.metadata ? JSON.stringify(event.metadata) : null
            ]);
            // Update user quota
            await this.updateUserQuota(event.userId, totalTokens, totalCost);
            this.logger.info(`Recorded usage event for user ${event.userId}: ${totalTokens} tokens, $${totalCost}`, {
                userId: event.userId,
                provider: event.provider,
                model: event.model,
                tokens: totalTokens,
                cost: totalCost
            });
            return fullEvent;
        }
        catch (error) {
            this.logger.error('Failed to record usage event', {
                error: error.message,
                event: { ...event, metadata: '[hidden]' }
            });
            throw error;
        }
    }
    /**
     * Update user quota usage
     */
    async updateUserQuota(userId, tokens, cost) {
        // Get current quota or create if doesn't exist
        const existingQuota = await this.db.get('SELECT * FROM user_quotas WHERE user_id = ?', [userId]);
        if (existingQuota) {
            // Update existing quota
            await this.db.execute(`UPDATE user_quotas 
         SET tokens_used = tokens_used + ?, 
             cost_used = cost_used + ?,
             last_updated = CURRENT_TIMESTAMP
         WHERE user_id = ?`, [tokens, cost, userId]);
        }
        else {
            // Create new quota entry with default limits (will be updated by subscription validation)
            const resetDate = new Date();
            resetDate.setMonth(resetDate.getMonth() + 1);
            resetDate.setDate(1); // First day of next month
            await this.db.execute(`INSERT INTO user_quotas (
          user_id, subscription_tier, monthly_token_limit, tokens_used, cost_used, reset_date
        ) VALUES (?, ?, ?, ?, ?, ?)`, [userId, 'starter', 10000, tokens, cost, resetDate.toISOString().split('T')[0]]);
        }
    }
    /**
     * Get usage summary for a user
     */
    async getUserUsage(userId, period = 'current_month') {
        let whereClause = 'WHERE user_id = ?';
        let params = [userId];
        const now = new Date();
        if (period === 'current_month') {
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            whereClause += ' AND timestamp >= ?';
            params.push(startOfMonth.toISOString());
        }
        else if (period === 'last_30_days') {
            const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            whereClause += ' AND timestamp >= ?';
            params.push(thirtyDaysAgo.toISOString());
        }
        else if (period === 'last_7_days') {
            const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            whereClause += ' AND timestamp >= ?';
            params.push(sevenDaysAgo.toISOString());
        }
        // Get total usage
        const totalUsage = await this.db.get(`
      SELECT 
        COUNT(*) as request_count,
        SUM(total_tokens) as total_tokens,
        SUM(cost) as total_cost,
        SUM(platform_fee) as total_platform_fees
      FROM usage_events 
      ${whereClause}
    `, params);
        // Get provider breakdown
        const providerUsage = await this.db.all(`
      SELECT 
        provider,
        SUM(total_tokens) as tokens,
        COUNT(*) as requests
      FROM usage_events 
      ${whereClause}
      GROUP BY provider
      ORDER BY tokens DESC
    `, params);
        // Get daily breakdown
        const dailyUsage = await this.db.all(`
      SELECT 
        DATE(timestamp) as date,
        SUM(total_tokens) as tokens,
        SUM(total_cost) as cost,
        COUNT(*) as requests
      FROM usage_events 
      ${whereClause}
      GROUP BY DATE(timestamp)
      ORDER BY date DESC
      LIMIT 30
    `, params);
        // Get quota information
        const quota = await this.db.get('SELECT * FROM user_quotas WHERE user_id = ?', [userId]);
        const totalTokens = totalUsage?.total_tokens || 0;
        const quotaLimit = quota?.monthly_token_limit || 10000;
        const quotaUsed = quota?.tokens_used || 0;
        // Calculate provider percentages
        const topProviders = providerUsage.map((p) => ({
            provider: p.provider,
            usage: p.tokens,
            percentage: totalTokens > 0 ? (p.tokens / totalTokens) * 100 : 0
        }));
        return {
            userId,
            organizationId: quota?.organization_id,
            period,
            totalTokens: totalTokens || 0,
            totalCost: totalUsage?.total_cost || 0,
            totalPlatformFees: totalUsage?.total_platform_fees || 0,
            requestCount: totalUsage?.request_count || 0,
            quotaUsed,
            quotaLimit,
            quotaPercentage: quotaLimit > 0 ? (quotaUsed / quotaLimit) * 100 : 0,
            topProviders,
            dailyBreakdown: dailyUsage.map((d) => ({
                date: d.date,
                tokens: d.tokens || 0,
                cost: d.cost || 0,
                requests: d.requests || 0
            }))
        };
    }
    /**
     * Check if user has exceeded quota
     */
    async checkQuotaExceeded(userId) {
        const quota = await this.db.get('SELECT tokens_used, monthly_token_limit FROM user_quotas WHERE user_id = ?', [userId]);
        if (!quota)
            return false;
        return quota.tokens_used >= quota.monthly_token_limit;
    }
    /**
     * Get detailed quota status for a user
     */
    async getQuotaStatus(userId) {
        const quota = await this.db.get('SELECT * FROM user_quotas WHERE user_id = ?', [userId]);
        if (!quota) {
            // Return default quota status for new users
            return {
                userId,
                quotaUsed: 0,
                quotaLimit: 10000,
                quotaRemaining: 10000,
                quotaPercentage: 0,
                resetDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1),
                isExceeded: false,
                warningThreshold: 80,
                isNearLimit: false
            };
        }
        const quotaUsed = quota.tokens_used || 0;
        const quotaLimit = quota.monthly_token_limit || 10000;
        const quotaRemaining = Math.max(0, quotaLimit - quotaUsed);
        const quotaPercentage = quotaLimit > 0 ? (quotaUsed / quotaLimit) * 100 : 0;
        const isExceeded = quotaUsed >= quotaLimit;
        const warningThreshold = 80;
        const isNearLimit = quotaPercentage >= warningThreshold;
        // Estimate days remaining based on current usage pattern
        let estimatedDaysRemaining;
        if (quotaRemaining > 0 && quotaUsed > 0) {
            const resetDate = new Date(quota.reset_date);
            const now = new Date();
            const daysInPeriod = Math.max(1, Math.floor((now.getTime() - new Date(now.getFullYear(), now.getMonth(), 1).getTime()) / (24 * 60 * 60 * 1000)));
            const dailyUsage = quotaUsed / daysInPeriod;
            if (dailyUsage > 0) {
                estimatedDaysRemaining = Math.floor(quotaRemaining / dailyUsage);
            }
        }
        return {
            userId,
            quotaUsed,
            quotaLimit,
            quotaRemaining,
            quotaPercentage: Number(quotaPercentage.toFixed(1)),
            resetDate: new Date(quota.reset_date),
            isExceeded,
            warningThreshold,
            isNearLimit,
            estimatedDaysRemaining
        };
    }
    /**
     * Update user subscription tier and quota
     */
    async updateUserSubscription(userId, subscriptionTier, // Made flexible to support any tier
    monthlyTokenLimit, organizationId) {
        const resetDate = new Date();
        resetDate.setMonth(resetDate.getMonth() + 1);
        resetDate.setDate(1);
        await this.db.execute(`
      INSERT OR REPLACE INTO user_quotas (
        user_id, organization_id, subscription_tier, monthly_token_limit, 
        tokens_used, cost_used, reset_date, last_updated
      ) VALUES (?, ?, ?, ?, 
        COALESCE((SELECT tokens_used FROM user_quotas WHERE user_id = ?), 0),
        COALESCE((SELECT cost_used FROM user_quotas WHERE user_id = ?), 0),
        ?, CURRENT_TIMESTAMP
      )
    `, [
            userId, organizationId || null, subscriptionTier, monthlyTokenLimit,
            userId, userId, resetDate.toISOString().split('T')[0]
        ]);
        this.logger.info(`Updated subscription for user ${userId}: ${subscriptionTier} (${monthlyTokenLimit} tokens)`, {
            userId,
            subscriptionTier,
            monthlyTokenLimit,
            organizationId
        });
    }
    /**
     * Reset monthly quotas (typically run on the first day of each month)
     */
    async resetMonthlyQuotas() {
        const resetDate = new Date();
        resetDate.setMonth(resetDate.getMonth() + 1);
        resetDate.setDate(1);
        const result = await this.db.execute(`
      UPDATE user_quotas 
      SET tokens_used = 0, 
          cost_used = 0, 
          reset_date = ?,
          last_updated = CURRENT_TIMESTAMP
      WHERE DATE(reset_date) <= DATE('now')
    `, [resetDate.toISOString().split('T')[0]]);
        this.logger.info(`Reset monthly quotas for users`, {
            affectedRows: result.changes
        });
    }
    /**
     * Get usage analytics for admin purposes
     */
    async getUsageAnalytics(startDate, endDate) {
        let whereClause = '';
        let params = [];
        if (startDate && endDate) {
            whereClause = 'WHERE timestamp BETWEEN ? AND ?';
            params = [startDate.toISOString(), endDate.toISOString()];
        }
        else if (startDate) {
            whereClause = 'WHERE timestamp >= ?';
            params = [startDate.toISOString()];
        }
        // Get total stats
        const totalStats = await this.db.get(`
      SELECT 
        COUNT(DISTINCT user_id) as total_users,
        SUM(total_tokens) as total_tokens,
        SUM(cost) as total_cost,
        SUM(platform_fee) as total_platform_fees,
        COUNT(*) as total_requests
      FROM usage_events 
      ${whereClause}
    `, params);
        // Get provider breakdown
        const providerStats = await this.db.all(`
      SELECT 
        provider,
        SUM(total_tokens) as tokens,
        SUM(cost) as cost,
        COUNT(*) as requests
      FROM usage_events 
      ${whereClause}
      GROUP BY provider
      ORDER BY tokens DESC
    `, params);
        // Get tier breakdown
        const tierStats = await this.db.all(`
      SELECT 
        q.subscription_tier as tier,
        COUNT(DISTINCT q.user_id) as users,
        COALESCE(SUM(e.total_tokens), 0) as tokens,
        COALESCE(SUM(e.cost), 0) as cost
      FROM user_quotas q
      LEFT JOIN usage_events e ON q.user_id = e.user_id ${whereClause ? 'AND ' + whereClause.replace('WHERE ', '') : ''}
      GROUP BY q.subscription_tier
      ORDER BY users DESC
    `, params);
        const totalTokens = totalStats?.total_tokens || 0;
        return {
            totalUsers: totalStats?.total_users || 0,
            totalTokens,
            totalCost: totalStats?.total_cost || 0,
            totalPlatformFees: totalStats?.total_platform_fees || 0,
            totalRequests: totalStats?.total_requests || 0,
            providerBreakdown: providerStats.map((p) => ({
                provider: p.provider,
                tokens: p.tokens || 0,
                cost: p.cost || 0,
                requests: p.requests || 0,
                percentage: totalTokens > 0 ? (p.tokens / totalTokens) * 100 : 0
            })),
            tierBreakdown: tierStats.map((t) => ({
                tier: t.tier,
                users: t.users || 0,
                tokens: t.tokens || 0,
                cost: t.cost || 0,
                percentage: totalTokens > 0 ? (t.tokens / totalTokens) * 100 : 0
            }))
        };
    }
}
