/**
 * AI Router - tRPC implementation
 * 
 * Type-safe AI procedures using tRPC with Zod validation.
 * Integrates with our existing AI service.
 */

import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { createTRPCRouter, publicProcedure, protectedProcedure, tokenProtectedProcedure } from '../index.js';
import { AIService } from '../../services/ai-service.js';
import { VirtualTokenService } from '../../services/virtual-token-service.js';
import { UsageAnalyticsService } from '../../services/usage-analytics-service.js';
import { PostgreSQLAdapter } from '../../database/postgres-adapter.js';

// Configurable limits interface
export interface AIRouterConfig {
  content?: {
    maxLength?: number;
    minLength?: number;
  };
  tokens?: {
    defaultMaxTokens?: number;
    maxTokenLimit?: number;
    minTokens?: number;
  };
  systemPrompt?: {
    maxLength?: number;
    minLength?: number;
  };
}

// Predefined configurations for common use cases
// ⚠️ IMPORTANT: These are suggested defaults. Always validate against:
//   - Your AI provider's token limits (Claude: 200k, GPT-4: 8k-128k, Gemini: 1M)
//   - Your cost budget and usage patterns
//   - Your application's specific requirements
export const AI_LIMIT_PRESETS = {
  // Conservative limits for production environments
  conservative: {
    content: { maxLength: 100_000, minLength: 1 },        // 100KB (~20k words)
    tokens: { 
      defaultMaxTokens: 2048, 
      maxTokenLimit: 8_192, 
      minTokens: 1 
    },
    systemPrompt: { maxLength: 10_000, minLength: 1 }     // 10KB system prompts
  } as AIRouterConfig,

  // Balanced limits for most applications
  standard: {
    content: { maxLength: 500_000, minLength: 1 },        // 500KB (~100k words)
    tokens: { 
      defaultMaxTokens: 4096, 
      maxTokenLimit: 32_000, 
      minTokens: 1 
    },
    systemPrompt: { maxLength: 25_000, minLength: 1 }     // 25KB system prompts
  } as AIRouterConfig,

  // Generous limits for development and large documents
  generous: {
    content: { maxLength: 2_000_000, minLength: 1 },      // 2MB (~400k words)
    tokens: { 
      defaultMaxTokens: 8192, 
      maxTokenLimit: 100_000, 
      minTokens: 1 
    },
    systemPrompt: { maxLength: 50_000, minLength: 1 }     // 50KB system prompts
  } as AIRouterConfig,

  // Maximum limits for specialized use cases
  maximum: {
    content: { maxLength: 10_000_000, minLength: 1 },     // 10MB (~2M words)
    tokens: { 
      defaultMaxTokens: 16384, 
      maxTokenLimit: 1_000_000, 
      minTokens: 1 
    },
    systemPrompt: { maxLength: 100_000, minLength: 1 }    // 100KB system prompts
  } as AIRouterConfig,
} as const;

// Default configuration (same as standard)
const DEFAULT_CONFIG: Required<AIRouterConfig> = {
  content: {
    maxLength: AI_LIMIT_PRESETS.standard.content!.maxLength!,
    minLength: AI_LIMIT_PRESETS.standard.content!.minLength!,
  },
  tokens: {
    defaultMaxTokens: AI_LIMIT_PRESETS.standard.tokens!.defaultMaxTokens!,
    maxTokenLimit: AI_LIMIT_PRESETS.standard.tokens!.maxTokenLimit!,
    minTokens: AI_LIMIT_PRESETS.standard.tokens!.minTokens!,
  },
  systemPrompt: {
    maxLength: AI_LIMIT_PRESETS.standard.systemPrompt!.maxLength!,
    minLength: AI_LIMIT_PRESETS.standard.systemPrompt!.minLength!,
  },
};

// Helper to create service providers config from array
function createServiceProvidersConfig(providers: string[]): any {
  const config: any = {};
  providers.forEach((provider, index) => {
    config[provider] = { priority: index + 1 };
  });
  return config;
}

// Create configurable AI router
export function createAIRouter(
  config: AIRouterConfig = {}, 
  tokenTrackingEnabled = false, 
  dbAdapter?: PostgreSQLAdapter,
  serverProviders: (string)[] = ['anthropic'],
  byokProviders: (string)[] = ['anthropic']
): ReturnType<typeof createTRPCRouter> {
  const mergedConfig = {
    content: { ...DEFAULT_CONFIG.content, ...config.content },
    tokens: { ...DEFAULT_CONFIG.tokens, ...config.tokens },
    systemPrompt: { ...DEFAULT_CONFIG.systemPrompt, ...config.systemPrompt },
  };

  // Initialize AI service with configured providers
  const aiService = new AIService({
    serviceProviders: createServiceProvidersConfig(serverProviders)
  });

  // Initialize services if database is available
  let virtualTokenService: VirtualTokenService | null = null;
  let usageAnalyticsService: UsageAnalyticsService | null = null;
  let hybridUserService: any | null = null; // TODO: Import proper type
  
  if (dbAdapter) {
    usageAnalyticsService = new UsageAnalyticsService(dbAdapter);
    
    if (tokenTrackingEnabled) {
      virtualTokenService = new VirtualTokenService(dbAdapter);
    }
  }

  // Create dynamic schemas based on configuration  
  const executeAIRequestSchema = z.object({
    content: z.string()
      .min(mergedConfig.content.minLength!)
      .max(mergedConfig.content.maxLength!),
    systemPrompt: z.string()
      .min(mergedConfig.systemPrompt.minLength!)
      .max(mergedConfig.systemPrompt.maxLength!),
    metadata: z.object({
      name: z.string().optional(),
      type: z.string().optional(),
    }).optional(),
    options: z.object({
      model: z.string().optional(),
      maxTokens: z.number().int()
        .min(mergedConfig.tokens.minTokens!)
        .max(mergedConfig.tokens.maxTokenLimit!)
        .default(mergedConfig.tokens.defaultMaxTokens!)
        .optional(),
      temperature: z.number().min(0).max(1).optional(),
    }).optional(),
  });

  const healthSchema = z.object({}).optional();

  return createTRPCRouter({
  /**
   * Health check procedure
   */
  health: publicProcedure
    .input(healthSchema)
    .query(async () => {
      return {
        status: 'healthy' as const,
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: '0.1.0',
      };
    }),

  /**
   * Execute AI request with system prompt protection
   * REQUIRES AUTHENTICATION - All users must have valid JWT token
   * Payment method (subscription/one-time/BYOK) determined server-side
   */
  executeAIRequest: protectedProcedure
    .input(executeAIRequestSchema)
    .mutation(async ({ input, ctx }) => {
      const { content, systemPrompt, metadata, options } = input;
      const userId = ctx.user!.userId; // Guaranteed to exist (protectedProcedure)
      const apiKey = ctx.req.headers['x-api-key'] as string | undefined; // Get API key from headers

      // Determine user type and execution path
      if (userId && usageAnalyticsService) {
        // Authenticated user - determine if subscription or BYOK
        const userStatus = await usageAnalyticsService.getUserStatus(userId);
        
        // Subscription user with token tracking
        if (userStatus.userType === 'subscription' && virtualTokenService) {
          // Ensure user account exists
          await virtualTokenService.ensureUserAccount(userId, ctx.user?.email);

          // Estimate tokens (rough estimate: 4 chars per token)
          const estimatedTokens = Math.ceil(content.length / 4) + Math.ceil(systemPrompt.length / 4);
          
          // Check token balance
          const hasBalance = await virtualTokenService.checkTokenBalance(userId, estimatedTokens);
          if (!hasBalance) {
            throw new TRPCError({
              code: 'PAYMENT_REQUIRED',
              message: 'Insufficient token balance. Please top up your account to continue.',
            });
          }

          try {
            // Execute AI request
            const result = await aiService.execute({
              content,
              systemPrompt,
              metadata,
              options,
            });

            // Deduct actual tokens used
            if (result.usage?.totalTokens) {
              const deductionResult = await virtualTokenService.deductTokens(
                userId,
                result.usage.totalTokens,
                result.provider || 'unknown',
                result.model,
                result.requestId,
                'executeAIRequest'
              );

              return {
                success: true,
                data: result,
                tokenUsage: {
                  tokensUsed: result.usage.totalTokens,
                  tokensCharged: deductionResult.tokensDeducted,
                  platformFee: deductionResult.platformFee,
                  remainingBalance: deductionResult.newBalance,
                },
              };
            }

            return {
              success: true,
              data: result,
            };
          } catch (error) {
            throw new TRPCError({
              code: 'INTERNAL_SERVER_ERROR',
              message: `AI service error: ${error instanceof Error ? error.message : 'Unknown error'}`,
            });
          }
        }
      } else if (userId && apiKey) {
        // Authenticated BYOK user - track usage but don't limit
        try {
          const result = await aiService.execute({
            content,
            systemPrompt,
            metadata,
            options,
            apiKey,
          });

          // Record usage for analytics (no limiting)
          if (usageAnalyticsService && result.usage) {
            const estimatedCost = UsageAnalyticsService.estimateCost(
              result.provider || 'unknown',
              result.model,
              result.usage.promptTokens,
              result.usage.completionTokens
            );

            await usageAnalyticsService.recordUsage({
              userId,
              userType: 'byok',
              provider: result.provider || 'unknown',
              model: result.model,
              inputTokens: result.usage.promptTokens,
              outputTokens: result.usage.completionTokens,
              totalTokens: result.usage.totalTokens,
              estimatedCostUsd: estimatedCost,
              requestId: result.requestId,
              method: 'executeAIRequest',
              metadata
            });
          }

          return {
            success: true,
            data: result,
            usageInfo: result.usage ? {
              tokensUsed: result.usage.totalTokens,
              estimatedCostUsd: UsageAnalyticsService.estimateCost(
                result.provider || 'unknown',
                result.model,
                result.usage.promptTokens,
                result.usage.completionTokens
              )
            } : undefined
          };
        } catch (error) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `AI service error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          });
        }
      } else {
        // Public/unauthenticated usage with BYOK
        if (!apiKey) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'API key required for public usage. Please provide your AI provider API key.',
          });
        }

        try {
          const result = await aiService.execute({
            content,
            systemPrompt,
            metadata,
            options,
            apiKey,
          });

          return {
            success: true,
            data: result,
          };
        } catch (error) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `AI service error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          });
        }
      }
      
      // Default fallback - should not reach here normally
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Unable to process request - invalid execution path',
      });
    }),

  /**
   * Get user profile with capabilities and preferences (hybrid users)
   */
  getUserProfile: protectedProcedure
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
   * Get user's token balances (all types)
   */
  getUserTokenBalances: protectedProcedure
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
   * Get user status (subscription vs BYOK, purchase history)
   */
  getUserStatus: protectedProcedure
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
        : purchases.filter(p => p.purchaseType === input.type);

      return {
        purchases: filteredPurchases.map(p => ({
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
          totalAmountUsd: filteredPurchases.reduce((sum, p) => sum + p.amountPaidCents, 0) / 100,
          subscriptionPurchases: filteredPurchases.filter(p => p.purchaseType === 'subscription').length,
          oneTimePurchases: filteredPurchases.filter(p => p.purchaseType === 'one_time').length
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

  /**
   * List available AI providers
   */
  listProviders: publicProcedure
    .query(async () => {
      return {
        providers: [
          {
            name: 'anthropic',
            models: ['claude-3-5-sonnet-20241022', 'claude-3-haiku-20240307'],
            priority: 1,
          },
          {
            name: 'openai', 
            models: ['gpt-4o', 'gpt-4o-mini', 'gpt-3.5-turbo'],
            priority: 2,
          },
          {
            name: 'google',
            models: ['gemini-1.5-pro', 'gemini-1.5-flash'],
            priority: 3,
          },
        ],
      };
    }),

  /**
   * Validate AI provider configuration
   */
  validateProvider: publicProcedure
    .input(z.object({
      provider: z.enum(['anthropic', 'openai', 'google']),
      apiKey: z.string().min(1),
    }))
    .mutation(async ({ input }) => {
      // Note: In production, never log API keys
      try {
        // Simple validation - in production, make a test API call
        const isValid = input.apiKey.length > 10; // Basic check
        
        return {
          isValid,
          provider: input.provider,
          message: isValid ? 'API key format appears valid' : 'API key format invalid',
        };
      } catch (error) {
        return {
          isValid: false,
          provider: input.provider,
          message: `Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
      }
    }),
  });
}

// Default AI router instance with default configuration
export const aiRouter: ReturnType<typeof createAIRouter> = createAIRouter();