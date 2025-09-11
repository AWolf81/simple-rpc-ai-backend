/**
 * Hybrid Billing Manager
 *
 * Manages both BYOK and server-provided credits with OpenSaaS integration
 * Automatically chooses payment method based on user preferences and balance
 */
const pricing = {
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
export class HybridBillingManager {
    config;
    keyManager;
    openSaasClient;
    constructor(config, keyManager, openSaasClient) {
        this.config = config;
        this.keyManager = keyManager;
        this.openSaasClient = openSaasClient;
    }
    /**
     * Determine payment method for a request
     */
    async getPaymentMethod(userId, provider, model, estimatedTokens) {
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
                }
                else {
                    return await this.getBYOKMethod(userId, provider, estimatedCost, `Fallback to BYOK: ${canUseCredits.reason}`);
                }
            default:
                return await this.getBYOKMethod(userId, provider, estimatedCost, 'Default to BYOK');
        }
    }
    /**
     * Get BYOK payment method
     */
    async getBYOKMethod(userId, provider, estimatedCost, reason) {
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
    async getCreditsMethod(userId, provider, estimatedCost, reason) {
        const canUse = await this.canUseCredits(userId, estimatedCost);
        if (!canUse.canUse) {
            throw new Error(`Cannot use credits: ${canUse.reason}`);
        }
        const serverApiKey = this.config.serverAI[provider];
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
    async canUseCredits(userId, estimatedCost) {
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
        }
        catch (error) {
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
    async recordUsage(usage) {
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
    async deductCredits(userId, amount) {
        const userBilling = await this.getUserBillingPreference(userId);
        const updates = {
            creditBalance: Math.max(0, userBilling.creditBalance - amount),
            monthlyUsage: userBilling.monthlyUsage + amount
        };
        await this.openSaasClient.updateUserBilling(userId, updates);
    }
    /**
     * Get user billing preferences
     */
    async getUserBillingPreference(userId) {
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
    async updateUserBillingPreference(userId, updates) {
        await this.openSaasClient.updateUserBilling(userId, updates);
    }
    /**
     * Estimate cost for AI request
     */
    estimateCost(provider, model, tokens) {
        // Simplified cost estimation - in production, use real pricing
        const costPerToken = this.getCostPerToken(provider, model);
        return tokens * costPerToken;
    }
    /**
     * Get cost per token for provider/model
     */
    getCostPerToken(provider, model) {
        return pricing[provider]?.[model] ?? 0.00001;
    }
    /**
     * Check if monthly usage should be reset
     */
    shouldResetMonthlyUsage(lastResetDate) {
        const now = new Date();
        const lastReset = new Date(lastResetDate);
        return now.getMonth() !== lastReset.getMonth() ||
            now.getFullYear() !== lastReset.getFullYear();
    }
    /**
     * Get user billing status
     */
    async getBillingStatus(userId) {
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
    async addCredits(userId, amount, reason) {
        const userBilling = await this.getUserBillingPreference(userId);
        const newBalance = Math.min(userBilling.creditBalance + amount, this.config.maxCreditBalance);
        await this.openSaasClient.updateUserBilling(userId, {
            creditBalance: newBalance
        });
        console.log(`💳 Credits added: ${userId} +$${amount} (${reason})`);
    }
}
