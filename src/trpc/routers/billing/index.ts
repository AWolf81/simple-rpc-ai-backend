/**
 * Billing Router - Token management and purchase tracking
 */

import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '@src-trpc/index';
import { VirtualTokenService } from '@services/virtual-token-service';
import { UsageAnalyticsService } from '@services/usage-analytics-service';

interface HybridUserService {
  getUserTokenBalances(userId: string): Promise<any[]>;
  planConsumption(userId: string, estimatedTokens: number, apiKey?: string): Promise<any>;
  getConsumptionHistory(userId: string, limit: number): Promise<any>;
}

export function createBillingRouter(
  virtualTokenService: VirtualTokenService | null,
  usageAnalyticsService: UsageAnalyticsService | null,
  hybridUserService: HybridUserService | null
): ReturnType<typeof router> {
  return router({
    /**
     * Get user's token balances (all types)
     */
    getUserTokenBalances: protectedProcedure
      .input(z.void())
      .query(async ({ ctx }) => {
        if (!hybridUserService) {
          throw new TRPCError({
            code: 'NOT_IMPLEMENTED',
            message: 'Hybrid user service is not enabled on this server.',
          });
        }

        const balances = await hybridUserService.getUserTokenBalances(ctx.user!.userId);
        return {
          balances: balances.map((b: any) => ({
            id: b.id,
            balanceType: b.balanceType,
            virtualTokenBalance: b.virtualTokenBalance,
            purchaseSource: b.purchaseSource,
            purchaseDate: b.purchaseDate,
            expiryDate: b.expiryDate,
            consumptionPriority: b.consumptionPriority
          })),
          summary: {
            totalSubscriptionTokens: balances.filter((b: any) => b.balanceType === 'subscription').reduce((sum: number, b: any) => sum + b.virtualTokenBalance, 0),
            totalOneTimeTokens: balances.filter((b: any) => b.balanceType === 'one_time').reduce((sum: number, b: any) => sum + b.virtualTokenBalance, 0),
            totalTokens: balances.reduce((sum: number, b: any) => sum + b.virtualTokenBalance, 0)
          }
        };
      }),

    /**
     * Plan token consumption for a request (preview before execution)
     */
    planConsumption: protectedProcedure
      .input(z.object({
        estimatedTokens: z.number().min(1).max(1000000),
        hasApiKey: z.boolean().default(false)
      }))
      .query(async ({ input, ctx }) => {
        if (!hybridUserService) {
          throw new TRPCError({
            code: 'NOT_IMPLEMENTED',
            message: 'Hybrid user service is not enabled on this server.',
          });
        }

        const plan = await hybridUserService.planConsumption(
          ctx.user!.userId,
          input.estimatedTokens,
          input.hasApiKey ? 'dummy-key' : undefined
        );

        return {
          totalTokensNeeded: plan.totalTokensNeeded,
          plan: plan.plan.map((step: any) => ({
            type: step.type,
            tokensToConsume: step.tokensToConsume,
            reason: step.reason
          })),
          notifications: plan.notifications,
          viable: plan.plan.reduce((sum: number, step: any) => sum + step.tokensToConsume, 0) >= input.estimatedTokens
        };
      }),

    /**
     * Get consumption history for user
     */
    getConsumptionHistory: protectedProcedure
      .input(z.object({
        limit: z.number().min(1).max(100).default(20)
      }))
      .query(async ({ input, ctx }) => {
        if (!hybridUserService) {
          throw new TRPCError({
            code: 'NOT_IMPLEMENTED',
            message: 'Hybrid user service is not enabled on this server.',
          });
        }

        const history = await hybridUserService.getConsumptionHistory(ctx.user!.userId, input.limit);
        return history;
      }),

    /**
     * Get user's token balance (requires authentication)
     */
    getTokenBalance: protectedProcedure
      .input(z.void())
      .query(async ({ ctx }) => {
        if (!virtualTokenService) {
          throw new TRPCError({
            code: 'NOT_IMPLEMENTED',
            message: 'Token tracking is not enabled on this server.',
          });
        }

        const balance = await virtualTokenService.getTokenBalance(ctx.user!.userId);
        if (!balance) {
          // Create account if it doesn't exist
          await virtualTokenService.ensureUserAccount(ctx.user!.userId, ctx.user!.email);
          return {
            virtualTokenBalance: 0,
            totalTokensPurchased: 0,
            totalTokensUsed: 0,
            platformFeeCollected: 0,
          };
        }

        return {
          virtualTokenBalance: balance.virtualTokenBalance,
          totalTokensPurchased: balance.totalTokensPurchased,
          totalTokensUsed: balance.totalTokensUsed,
          platformFeeCollected: balance.platformFeeCollected,
        };
      }),

    /**
     * Get user's token usage history (requires authentication)
     */
    getUsageHistory: protectedProcedure
      .input(z.object({
        limit: z.number().min(1).max(100).default(20),
      }))
      .query(async ({ input, ctx }) => {
        if (!virtualTokenService) {
          throw new TRPCError({
            code: 'NOT_IMPLEMENTED',
            message: 'Token tracking is not enabled on this server.',
          });
        }

        const history = await virtualTokenService.getUsageHistory(ctx.user!.userId, input.limit);
        return history;
      }),

    /**
     * Get user's token purchase history (requires authentication)
     */
    getTopupHistory: protectedProcedure
      .input(z.object({
        limit: z.number().min(1).max(50).default(10),
      }))
      .query(async ({ input, ctx }) => {
        if (!virtualTokenService) {
          throw new TRPCError({
            code: 'NOT_IMPLEMENTED',
            message: 'Token tracking is not enabled on this server.',
          });
        }

        const history = await virtualTokenService.getTopupHistory(ctx.user!.userId, input.limit);
        return history;
      }),

    /**
     * Get user's complete usage analytics (for both subscription and BYOK users)
     */
    getUsageAnalytics: protectedProcedure
      .input(z.object({
        days: z.number().min(1).max(365).default(30),
        includeHistory: z.boolean().default(false),
        historyLimit: z.number().min(1).max(100).default(20),
      }))
      .query(async ({ input, ctx }) => {
        if (!usageAnalyticsService) {
          throw new TRPCError({
            code: 'NOT_IMPLEMENTED',
            message: 'Usage analytics is not enabled on this server.',
          });
        }

        const summary = await usageAnalyticsService.getUserUsageSummary(ctx.user!.userId, input.days);
        const history = input.includeHistory
          ? await usageAnalyticsService.getUserUsageHistory(ctx.user!.userId, input.historyLimit)
          : [];

        return {
          summary,
          history: input.includeHistory ? history : undefined,
          period: {
            days: input.days,
            startDate: new Date(Date.now() - input.days * 24 * 60 * 60 * 1000).toISOString(),
            endDate: new Date().toISOString()
          }
        };
      }),

    /**
     * Get user's purchase history (both subscription and one-time)
     */
    getPurchaseHistory: protectedProcedure
      .input(z.object({
        limit: z.number().min(1).max(50).default(10),
        type: z.enum(['all', 'subscription', 'one_time']).default('all'),
      }))
      .query(async ({ input, ctx }) => {
        if (!usageAnalyticsService) {
          throw new TRPCError({
            code: 'NOT_IMPLEMENTED',
            message: 'Usage analytics is not enabled on this server.',
          });
        }

        const purchases = await usageAnalyticsService.getUserPurchaseHistory(ctx.user!.userId, input.limit);

        // Filter by type if specified
        const filteredPurchases = input.type === 'all'
          ? purchases
          : purchases.filter((p: any) => p.purchaseType === input.type);

        return {
          purchases: filteredPurchases.map((p: any) => ({
            id: p.id,
            paymentId: p.paymentId,
            purchaseType: p.purchaseType,
            variantId: p.variantId,
            quantity: p.quantity,
            amountPaidUsd: p.amountPaidCents / 100,
            currency: p.currency,
            processedAt: p.processedAt
          })),
          summary: {
            totalPurchases: filteredPurchases.length,
            totalAmountUsd: filteredPurchases.reduce((sum: number, p: any) => sum + p.amountPaidCents, 0) / 100,
            subscriptionPurchases: filteredPurchases.filter((p: any) => p.purchaseType === 'subscription').length,
            oneTimePurchases: filteredPurchases.filter((p: any) => p.purchaseType === 'one_time').length
          }
        };
      }),
  });
}

export const billingRouter: ReturnType<typeof createBillingRouter> = createBillingRouter(null, null, null);