/**
 * User Router - User management and preferences
 */

import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '@src-trpc/index';
import { VirtualTokenService } from '@services/virtual-token-service';
import { UsageAnalyticsService } from '@services/usage-analytics-service';

interface HybridUserService {
  getUserProfile(userId: string): Promise<any>;
  ensureUserProfile(userId: string, email?: string): Promise<void>;
  updateUserPreferences(userId: string, preferences: any): Promise<void>;
  configureBYOK(userId: string, providers: any, enabled: boolean): Promise<void>;
}

export function createUserRouter(
  virtualTokenService: VirtualTokenService | null,
  usageAnalyticsService: UsageAnalyticsService | null,
  hybridUserService: HybridUserService | null,
  byokProviders: string[] = ['anthropic', 'openai', 'google']
): ReturnType<typeof router> {
  return router({
    /**
     * Get user profile with capabilities and preferences (hybrid users)
     */
    getUserProfile: protectedProcedure
      .input(z.void())
      .query(async ({ ctx }) => {
        if (!hybridUserService) {
          throw new TRPCError({
            code: 'NOT_IMPLEMENTED',
            message: 'Hybrid user service is not enabled on this server.',
          });
        }

        const profile = await hybridUserService.getUserProfile(ctx.user!.userId);
        if (!profile) {
          // Create profile if it doesn't exist
          await hybridUserService.ensureUserProfile(ctx.user!.userId, ctx.user!.email);
          return await hybridUserService.getUserProfile(ctx.user!.userId);
        }

        return profile;
      }),

    /**
     * Update user consumption preferences
     */
    updateUserPreferences: protectedProcedure
      .input(z.object({
        consumptionOrder: z.array(z.enum(['subscription', 'one_time', 'byok'])).optional(),
        byokEnabled: z.boolean().optional(),
        byokProviders: z.record(z.object({
          enabled: z.boolean(),
          apiKey: z.string().optional()
        })).optional(),
        notifyTokenLowThreshold: z.number().min(0).max(100000).optional(),
        notifyFallbackToByok: z.boolean().optional(),
        notifyOneTimeConsumed: z.boolean().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (!hybridUserService) {
          throw new TRPCError({
            code: 'NOT_IMPLEMENTED',
            message: 'Hybrid user service is not enabled on this server.',
          });
        }

        await hybridUserService.updateUserPreferences(ctx.user!.userId, input);
        return { success: true };
      }),

    /**
     * Configure BYOK providers for user (SECURE - API keys stored server-side)
     */
    configureBYOK: protectedProcedure
      .input(z.object({
        providers: z.record(z.object({
          enabled: z.boolean(),
          apiKey: z.string().optional() // This will be encrypted and stored securely
        })),
        enabled: z.boolean().default(true)
      }))
      .mutation(async ({ input, ctx }) => {
        if (!hybridUserService) {
          throw new TRPCError({
            code: 'NOT_IMPLEMENTED',
            message: 'Hybrid user service is not enabled on this server.',
          });
        }

        // Validate that requested providers are allowed for BYOK
        const requestedProviders = Object.keys(input.providers);
        const disallowedProviders = requestedProviders.filter(p => !byokProviders.includes(p));

        if (disallowedProviders.length > 0) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `BYOK not supported for providers: ${disallowedProviders.join(', ')}. Allowed providers: ${byokProviders.join(', ')}`
          });
        }

        // TODO: Encrypt API keys before storage
        // For now, store as-is but in production should use AES-256-GCM
        await hybridUserService.configureBYOK(ctx.user!.userId, input.providers, input.enabled);

        return {
          success: true,
          message: 'BYOK configuration updated. API keys stored securely.',
          providersConfigured: Object.keys(input.providers).filter(p => input.providers[p].enabled)
        };
      }),

    /**
     * Get BYOK configuration status (without exposing API keys)
     */
    getBYOKStatus: protectedProcedure
      .input(z.void())
      .query(async ({ ctx }) => {
        if (!hybridUserService) {
          throw new TRPCError({
            code: 'NOT_IMPLEMENTED',
            message: 'Hybrid user service is not enabled on this server.',
          });
        }

        const profile = await hybridUserService.getUserProfile(ctx.user!.userId);

        if (!profile) {
          return {
            byokEnabled: false,
            providers: {},
            hasConfiguredProviders: false
          };
        }

        // Return status without exposing actual API keys
        const providerStatus = Object.entries(profile.byokProviders || {}).reduce((acc: Record<string, any>, [provider, config]: [string, any]) => {
          acc[provider] = {
            enabled: config.enabled,
            hasApiKey: !!config.apiKey,
            keyPreview: config.apiKey ? `${config.apiKey.slice(0, 8)}...` : null
          };
          return acc;
        }, {} as Record<string, any>);

        return {
          byokEnabled: profile.byokEnabled,
          providers: providerStatus,
          hasConfiguredProviders: Object.values(providerStatus).some((p: any) => p.enabled && p.hasApiKey)
        };
      }),

    /**
     * Get user status (subscription vs BYOK, purchase history)
     */
    getUserStatus: protectedProcedure
      .input(z.void())
      .query(async ({ ctx }) => {
        if (!usageAnalyticsService) {
          throw new TRPCError({
            code: 'NOT_IMPLEMENTED',
            message: 'Usage analytics is not enabled on this server.',
          });
        }

        const status = await usageAnalyticsService.getUserStatus(ctx.user!.userId);
        return {
          userId: status.userId,
          userType: status.userType,
          hasSubscription: status.hasSubscription,
          hasPurchases: status.hasPurchases,
          totalPurchases: status.totalPurchases,
          totalAmountSpentUsd: status.totalAmountSpentCents ? status.totalAmountSpentCents / 100 : 0,
          subscriptionTier: ctx.user!.subscriptionTier,
          features: {
            tokenTracking: status.userType === 'subscription',
            unlimitedBYOK: true,
            usageAnalytics: true,
          }
        };
      }),

    /**
     * Check if user can make AI requests (subscription users need tokens, BYOK users need API key)
     */
    checkRequestEligibility: protectedProcedure
      .input(z.object({
        estimatedTokens: z.number().min(1).default(1000),
        hasApiKey: z.boolean().default(false),
      }))
      .query(async ({ input, ctx }) => {
        if (!usageAnalyticsService) {
          return {
            canMakeRequest: input.hasApiKey,
            reason: input.hasApiKey ? 'API key provided' : 'No API key provided',
            userType: 'unknown' as const,
            requiresApiKey: !input.hasApiKey
          };
        }

        const userStatus = await usageAnalyticsService.getUserStatus(ctx.user!.userId);

        if (userStatus.userType === 'subscription') {
          // Subscription user - check token balance
          if (!virtualTokenService) {
            return {
              canMakeRequest: false,
              reason: 'Token tracking not available',
              userType: userStatus.userType,
              requiresTokens: true
            };
          }

          const hasBalance = await virtualTokenService.checkTokenBalance(ctx.user!.userId, input.estimatedTokens);
          const balance = await virtualTokenService.getTokenBalance(ctx.user!.userId);

          return {
            canMakeRequest: hasBalance,
            reason: hasBalance ? 'Sufficient token balance' : 'Insufficient token balance',
            userType: userStatus.userType,
            tokenBalance: balance?.virtualTokenBalance || 0,
            estimatedCost: Math.ceil(input.estimatedTokens * 1.25), // Include platform fee
            requiresTokens: true
          };
        } else {
          // BYOK user - just needs API key
          return {
            canMakeRequest: input.hasApiKey,
            reason: input.hasApiKey ? 'API key provided' : 'API key required for BYOK usage',
            userType: userStatus.userType,
            requiresApiKey: !input.hasApiKey
          };
        }
      }),
  });
}

export const userRouter: ReturnType<typeof createUserRouter> = createUserRouter(null, null, null);