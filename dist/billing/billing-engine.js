import axios from 'axios';
import winston from 'winston';
export class BillingEngine {
    db;
    usageTracker;
    config;
    logger;
    constructor(db, usageTracker, config) {
        this.db = db;
        this.usageTracker = usageTracker;
        this.config = config;
        // Setup logging
        this.logger = winston.createLogger({
            level: 'info',
            format: winston.format.combine(winston.format.timestamp(), winston.format.errors({ stack: true }), winston.format.json()),
            defaultMeta: { service: 'billing-engine' },
            transports: [
                new winston.transports.Console({
                    format: winston.format.combine(winston.format.colorize(), winston.format.simple())
                })
            ]
        });
    }
    /**
     * Initialize billing database tables
     */
    async initialize() {
        await this.db.execute(`
      CREATE TABLE IF NOT EXISTS billing_events (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        user_id TEXT NOT NULL,
        organization_id TEXT,
        amount REAL NOT NULL,
        currency TEXT NOT NULL,
        metadata TEXT,
        timestamp TEXT NOT NULL,
        processed BOOLEAN DEFAULT FALSE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
        await this.db.execute(`
      CREATE TABLE IF NOT EXISTS subscription_info (
        user_id TEXT PRIMARY KEY,
        organization_id TEXT,
        tier TEXT NOT NULL,
        status TEXT NOT NULL,
        monthly_token_quota INTEGER NOT NULL,
        billing_period_start DATE NOT NULL,
        billing_period_end DATE NOT NULL,
        next_billing_date DATE NOT NULL,
        amount REAL NOT NULL,
        currency TEXT NOT NULL,
        stripe_subscription_id TEXT,
        lemonsqueezy_subscription_id TEXT,
        opensaas_subscription_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
        await this.db.execute(`
      CREATE TABLE IF NOT EXISTS quota_alerts (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        threshold_percentage INTEGER NOT NULL,
        alert_sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        billing_period TEXT NOT NULL
      )
    `);
        await this.db.execute(`
      CREATE INDEX IF NOT EXISTS idx_billing_events_user_timestamp 
      ON billing_events(user_id, timestamp)
    `);
        this.logger.info('Billing engine database initialized');
    }
    /**
     * Calculate platform fee for a given cost
     */
    calculatePlatformFee(cost) {
        const { percentage, minimumFee, maximumFee } = this.config.platformFee;
        let fee = cost * (percentage / 100);
        if (minimumFee && fee < minimumFee) {
            fee = minimumFee;
        }
        if (maximumFee && fee > maximumFee) {
            fee = maximumFee;
        }
        return Number(fee.toFixed(6));
    }
    /**
     * Create a billing event
     */
    async createBillingEvent(event) {
        const id = `be_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const timestamp = new Date();
        try {
            await this.db.execute(`INSERT INTO billing_events (
          id, type, user_id, organization_id, amount, currency, metadata, timestamp
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [
                id,
                event.type,
                event.userId,
                event.organizationId || null,
                event.amount,
                event.currency,
                JSON.stringify(event.metadata),
                timestamp.toISOString()
            ]);
            this.logger.info(`Created billing event: ${event.type} for user ${event.userId}`, {
                eventId: id,
                type: event.type,
                userId: event.userId,
                amount: event.amount,
                currency: event.currency
            });
            // Process the billing event
            await this.processBillingEvent(id);
            return id;
        }
        catch (error) {
            this.logger.error('Failed to create billing event', {
                error: error.message,
                event: { ...event, metadata: '[hidden]' }
            });
            throw error;
        }
    }
    /**
     * Process usage event and create billing events if needed
     */
    async processUsageEvent(usageEvent) {
        // Create usage billing event
        if (this.config.enableUsageBasedBilling && usageEvent.totalCost > 0) {
            await this.createBillingEvent({
                type: 'usage',
                userId: usageEvent.userId,
                organizationId: usageEvent.organizationId,
                amount: usageEvent.totalCost,
                currency: 'usd',
                metadata: {
                    requestId: usageEvent.requestId,
                    provider: usageEvent.provider,
                    model: usageEvent.model,
                    tokens: usageEvent.totalTokens,
                    cost: usageEvent.cost,
                    platformFee: usageEvent.platformFee
                }
            });
        }
        // Check quota and send alerts if needed
        await this.checkQuotaAndAlert(usageEvent.userId);
    }
    /**
     * Check user quota and send alerts
     */
    async checkQuotaAndAlert(userId) {
        const quotaStatus = await this.usageTracker.getQuotaStatus(userId);
        const currentPeriod = quotaStatus.resetDate.toISOString().split('T')[0];
        // Check each warning threshold
        for (const threshold of this.config.quotaWarningThresholds) {
            if (quotaStatus.quotaPercentage >= threshold) {
                // Check if we've already sent this alert for this period
                const existingAlert = await this.db.get(`SELECT id FROM quota_alerts 
           WHERE user_id = ? AND threshold_percentage = ? AND billing_period = ?`, [userId, threshold, currentPeriod]);
                if (!existingAlert) {
                    // Send quota warning
                    await this.sendQuotaAlert(userId, threshold, quotaStatus);
                    // Record that we sent the alert
                    await this.db.execute(`INSERT INTO quota_alerts (id, user_id, threshold_percentage, billing_period)
             VALUES (?, ?, ?, ?)`, [
                        `qa_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                        userId,
                        threshold,
                        currentPeriod
                    ]);
                }
            }
        }
        // Check if quota is exceeded and create billing event
        if (quotaStatus.isExceeded) {
            await this.createBillingEvent({
                type: 'quota_exceeded',
                userId,
                amount: 0,
                currency: 'usd',
                metadata: {
                    quotaUsed: quotaStatus.quotaUsed,
                    quotaLimit: quotaStatus.quotaLimit,
                    overage: quotaStatus.quotaUsed - quotaStatus.quotaLimit
                }
            });
        }
    }
    /**
     * Send quota alert to user
     */
    async sendQuotaAlert(userId, threshold, quotaStatus) {
        try {
            if (this.config.opensaasWebhookUrl) {
                await axios.post(this.config.opensaasWebhookUrl, {
                    type: 'quota_warning',
                    userId,
                    threshold,
                    quotaStatus,
                    timestamp: new Date().toISOString()
                }, {
                    headers: {
                        'Authorization': `Bearer ${this.config.opensaasApiKey}`,
                        'Content-Type': 'application/json'
                    }
                });
            }
            this.logger.info(`Sent quota alert to user ${userId}: ${threshold}% threshold reached`, {
                userId,
                threshold,
                quotaUsed: quotaStatus.quotaUsed,
                quotaLimit: quotaStatus.quotaLimit
            });
        }
        catch (error) {
            this.logger.error('Failed to send quota alert', {
                error: error.message,
                userId,
                threshold
            });
        }
    }
    /**
     * Process a billing event (send to payment provider)
     */
    async processBillingEvent(eventId) {
        try {
            const event = await this.db.get('SELECT * FROM billing_events WHERE id = ? AND processed = FALSE', [eventId]);
            if (!event) {
                return; // Event already processed or doesn't exist
            }
            const metadata = JSON.parse(event.metadata || '{}');
            // Send to appropriate payment provider
            switch (this.config.billingProvider) {
                case 'opensaas':
                    await this.sendToOpenSaaS(event, metadata);
                    break;
                case 'stripe':
                    await this.sendToStripe(event, metadata);
                    break;
                case 'lemonsqueezy':
                    await this.sendToLemonSqueezy(event, metadata);
                    break;
            }
            // Mark as processed
            await this.db.execute('UPDATE billing_events SET processed = TRUE WHERE id = ?', [eventId]);
            this.logger.info(`Processed billing event ${eventId}`, {
                eventId,
                type: event.type,
                provider: this.config.billingProvider
            });
        }
        catch (error) {
            this.logger.error('Failed to process billing event', {
                error: error.message,
                eventId
            });
            throw error;
        }
    }
    /**
     * Send billing event to OpenSaaS
     */
    async sendToOpenSaaS(event, metadata) {
        if (!this.config.opensaasWebhookUrl) {
            throw new Error('OpenSaaS webhook URL not configured');
        }
        await axios.post(this.config.opensaasWebhookUrl, {
            type: 'billing_event',
            event: {
                id: event.id,
                type: event.type,
                userId: event.user_id,
                organizationId: event.organization_id,
                amount: event.amount,
                currency: event.currency,
                metadata,
                timestamp: event.timestamp
            }
        }, {
            headers: {
                'Authorization': `Bearer ${this.config.opensaasApiKey}`,
                'Content-Type': 'application/json'
            }
        });
    }
    /**
     * Send billing event to Stripe
     */
    async sendToStripe(event, metadata) {
        // Stripe integration would go here
        // This is a placeholder for actual Stripe API calls
        this.logger.info('Stripe billing integration not implemented yet', {
            eventId: event.id,
            type: event.type
        });
    }
    /**
     * Send billing event to LemonSqueezy
     */
    async sendToLemonSqueezy(event, metadata) {
        // LemonSqueezy integration would go here
        // This is a placeholder for actual LemonSqueezy API calls
        this.logger.info('LemonSqueezy billing integration not implemented yet', {
            eventId: event.id,
            type: event.type
        });
    }
    /**
     * Handle quota exceeded scenario
     */
    async handleQuotaExceeded(userId) {
        const subscription = await this.getSubscriptionInfo(userId);
        if (!subscription) {
            return {
                action: 'block',
                message: 'No active subscription found. Please upgrade to continue using AI services.'
            };
        }
        // Check subscription tier and overage policy
        switch (subscription.tier) {
            case 'starter':
                return {
                    action: 'upgrade_prompt',
                    message: 'Monthly quota exceeded. Upgrade to Pro for higher limits and continued access.'
                };
            case 'pro':
                // Allow some overage for Pro users
                const quotaStatus = await this.usageTracker.getQuotaStatus(userId);
                const overagePercentage = ((quotaStatus.quotaUsed - quotaStatus.quotaLimit) / quotaStatus.quotaLimit) * 100;
                if (overagePercentage < 20) {
                    // Create billing event for overage
                    await this.createBillingEvent({
                        type: 'usage',
                        userId,
                        amount: 0, // Will be calculated based on overage
                        currency: 'usd',
                        metadata: {
                            type: 'overage',
                            overageTokens: quotaStatus.quotaUsed - quotaStatus.quotaLimit
                        }
                    });
                    return {
                        action: 'allow_overage',
                        message: 'Monthly quota exceeded. Overage charges will apply.'
                    };
                }
                else {
                    return {
                        action: 'upgrade_prompt',
                        message: 'Significant overage detected. Consider upgrading to Enterprise for unlimited usage.'
                    };
                }
            case 'enterprise':
                // Enterprise users typically have higher or unlimited quotas
                return {
                    action: 'allow_overage',
                    message: 'Usage continues under Enterprise agreement.'
                };
            default:
                return {
                    action: 'block',
                    message: 'Unknown subscription tier. Please contact support.'
                };
        }
    }
    /**
     * Get subscription information for a user
     */
    async getSubscriptionInfo(userId) {
        const subscription = await this.db.get('SELECT * FROM subscription_info WHERE user_id = ?', [userId]);
        if (!subscription) {
            return null;
        }
        const quotaStatus = await this.usageTracker.getQuotaStatus(userId);
        return {
            userId: subscription.user_id,
            tier: subscription.tier,
            status: subscription.status,
            monthlyTokenQuota: subscription.monthly_token_quota,
            currentUsage: quotaStatus.quotaUsed,
            billingPeriodStart: new Date(subscription.billing_period_start),
            billingPeriodEnd: new Date(subscription.billing_period_end),
            nextBillingDate: new Date(subscription.next_billing_date),
            amount: subscription.amount,
            currency: subscription.currency
        };
    }
    /**
     * Update subscription information (called from webhooks)
     */
    async updateSubscriptionInfo(userId, info) {
        const updates = [];
        const values = [];
        if (info.tier) {
            updates.push('tier = ?');
            values.push(info.tier);
        }
        if (info.status) {
            updates.push('status = ?');
            values.push(info.status);
        }
        if (info.monthlyTokenQuota) {
            updates.push('monthly_token_quota = ?');
            values.push(info.monthlyTokenQuota);
        }
        if (info.amount) {
            updates.push('amount = ?');
            values.push(info.amount);
        }
        updates.push('updated_at = CURRENT_TIMESTAMP');
        values.push(userId);
        await this.db.execute(`UPDATE subscription_info SET ${updates.join(', ')} WHERE user_id = ?`, values);
        // Update usage tracker quota as well
        if (info.tier && info.monthlyTokenQuota) {
            await this.usageTracker.updateUserSubscription(userId, info.tier, info.monthlyTokenQuota);
        }
        this.logger.info(`Updated subscription info for user ${userId}`, {
            userId,
            updates: Object.keys(info)
        });
    }
    /**
     * Get billing analytics
     */
    async getBillingAnalytics(startDate, endDate) {
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
        // Get total revenue and events
        const totals = await this.db.get(`
      SELECT 
        SUM(amount) as total_revenue,
        COUNT(*) as total_events
      FROM billing_events 
      ${whereClause}
    `, params);
        // Get events by type
        const eventsByType = await this.db.all(`
      SELECT 
        type,
        COUNT(*) as count
      FROM billing_events 
      ${whereClause}
      GROUP BY type
    `, params);
        // Get revenue by tier (joining with subscription info)
        const revenueByTier = await this.db.all(`
      SELECT 
        s.tier,
        SUM(b.amount) as revenue
      FROM billing_events b
      JOIN subscription_info s ON b.user_id = s.user_id
      ${whereClause}
      GROUP BY s.tier
    `, params);
        // Get top users by revenue
        const topUsers = await this.db.all(`
      SELECT 
        user_id,
        SUM(amount) as revenue,
        COUNT(*) as events
      FROM billing_events 
      ${whereClause}
      GROUP BY user_id
      ORDER BY revenue DESC
      LIMIT 10
    `, params);
        // Calculate total platform fees (assuming 20% fee)
        const totalPlatformFees = (totals?.total_revenue || 0) * (this.config.platformFee.percentage / 100);
        return {
            totalRevenue: totals?.total_revenue || 0,
            totalPlatformFees,
            totalEvents: totals?.total_events || 0,
            eventsByType: eventsByType.reduce((acc, row) => {
                acc[row.type] = row.count;
                return acc;
            }, {}),
            revenueByTier: revenueByTier.reduce((acc, row) => {
                acc[row.tier] = row.revenue;
                return acc;
            }, {}),
            topUsers: topUsers.map((row) => ({
                userId: row.user_id,
                revenue: row.revenue,
                events: row.events
            }))
        };
    }
    /**
     * Process webhook from payment provider
     */
    async processWebhook(provider, payload, signature) {
        try {
            // Verify webhook signature
            if (!this.verifyWebhookSignature(provider, payload, signature)) {
                throw new Error('Invalid webhook signature');
            }
            // Process based on provider and event type
            switch (provider) {
                case 'opensaas':
                    await this.processOpenSaaSWebhook(payload);
                    break;
                case 'stripe':
                    await this.processStripeWebhook(payload);
                    break;
                case 'lemonsqueezy':
                    await this.processLemonSqueezyWebhook(payload);
                    break;
                default:
                    throw new Error(`Unknown webhook provider: ${provider}`);
            }
        }
        catch (error) {
            this.logger.error('Failed to process webhook', {
                error: error.message,
                provider,
                payload: '[hidden]'
            });
            throw error;
        }
    }
    /**
     * Verify webhook signature
     */
    verifyWebhookSignature(provider, payload, signature) {
        // Implement signature verification based on provider
        // This is a placeholder - actual implementation depends on provider
        return true;
    }
    /**
     * Process OpenSaaS webhook
     */
    async processOpenSaaSWebhook(payload) {
        const { type, data } = payload;
        switch (type) {
            case 'subscription.created':
            case 'subscription.updated':
                await this.handleSubscriptionUpdate(data);
                break;
            case 'subscription.cancelled':
                await this.handleSubscriptionCancellation(data);
                break;
            case 'payment.succeeded':
                await this.handlePaymentSuccess(data);
                break;
            case 'payment.failed':
                await this.handlePaymentFailure(data);
                break;
        }
    }
    /**
     * Process Stripe webhook
     */
    async processStripeWebhook(payload) {
        // Stripe webhook processing would go here
        this.logger.info('Stripe webhook processing not implemented yet', { type: payload.type });
    }
    /**
     * Process LemonSqueezy webhook
     */
    async processLemonSqueezyWebhook(payload) {
        // LemonSqueezy webhook processing would go here
        this.logger.info('LemonSqueezy webhook processing not implemented yet', { type: payload.type });
    }
    /**
     * Handle subscription update
     */
    async handleSubscriptionUpdate(data) {
        await this.updateSubscriptionInfo(data.userId, {
            tier: data.tier,
            status: data.status,
            monthlyTokenQuota: data.monthlyTokenQuota,
            amount: data.amount
        });
    }
    /**
     * Handle subscription cancellation
     */
    async handleSubscriptionCancellation(data) {
        await this.updateSubscriptionInfo(data.userId, {
            status: 'cancelled'
        });
        await this.createBillingEvent({
            type: 'subscription_cancelled',
            userId: data.userId,
            amount: 0,
            currency: 'usd',
            metadata: { reason: data.reason || 'user_cancelled' }
        });
    }
    /**
     * Handle payment success
     */
    async handlePaymentSuccess(data) {
        this.logger.info(`Payment succeeded for user ${data.userId}`, {
            userId: data.userId,
            amount: data.amount,
            currency: data.currency
        });
    }
    /**
     * Handle payment failure
     */
    async handlePaymentFailure(data) {
        await this.createBillingEvent({
            type: 'payment_failed',
            userId: data.userId,
            amount: data.amount,
            currency: data.currency,
            metadata: { reason: data.reason, attemptCount: data.attemptCount }
        });
    }
}
