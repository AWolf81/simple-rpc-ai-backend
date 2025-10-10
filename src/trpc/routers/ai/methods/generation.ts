import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { publicProcedure } from '../../../index';
import { AIService } from '@services/ai/ai-service';
import { VirtualTokenService } from '@services/billing/virtual-token-service';
import { UsageAnalyticsService } from '@services/billing/usage-analytics-service';
import type { DEFAULT_CONFIG } from '../types';
import { TimingLogger } from '../../../../utils/timing';

/**
 * AI text generation procedures
 */
export function createGenerationProcedures(
  mergedConfig: typeof DEFAULT_CONFIG,
  aiService: AIService,
  virtualTokenService: VirtualTokenService | null,
  usageAnalyticsService: UsageAnalyticsService | null,
  _hybridUserService: any | null
) {
  // Create dynamic schemas based on configuration
  const generateTextSchema = z.object({
    content: z.string()
      .min(mergedConfig.content.minLength)
      .max(mergedConfig.content.maxLength),
    systemPrompt: z.string()
      .min(mergedConfig.systemPrompt.minLength)
      .max(mergedConfig.systemPrompt.maxLength),
    provider: z.enum(['anthropic', 'openai', 'google', 'openrouter', 'huggingface']).optional(),
    apiKey: z.string().optional(),
    metadata: z.object({
      name: z.string().optional(),
      type: z.string().optional(),
    }).optional(),
    options: z.object({
      model: z.string().optional(),
      maxTokens: z.number().int()
        .min(mergedConfig.tokens.minTokens)
        .max(mergedConfig.tokens.maxTokenLimit)
        .default(mergedConfig.tokens.defaultMaxTokens)
        .optional(),
      temperature: z.number().min(0).max(1).optional(),
    }).optional(),
  });

  return {
    /**
     * Generate structured text completions across supported AI providers.
     * @description Executes guarded text generation with system prompt protection, token metering, and BYOK handling for authenticated and public callers.
     * @example
     * ```ts
     * const { data } = await client.ai.generateText.mutate({
     *   content: 'Compose a friendly onboarding email for new engineers.',
     *   systemPrompt: 'You are a helpful onboarding assistant.',
     * });
     * console.log(data.success, data.data?.usage?.totalTokens);
     * ```
     */
    generateText: publicProcedure
      .input(generateTextSchema)
      .output(z.object({
        success: z.boolean(),
        data: z.any(),
        tokenUsage: z.object({
          tokensUsed: z.number(),
          tokensCharged: z.number(),
          platformFee: z.number().nullable(),
          remainingBalance: z.number().nullable(),
        }).optional(),
        usageInfo: z.object({
          tokensUsed: z.number(),
          estimatedCostUsd: z.number()
        }).optional()
      }))
      .mutation(async ({ input, ctx }) => {
        const timing = new TimingLogger('AI');

        const { content, systemPrompt, provider, metadata, options } = input;
        const { user } = ctx;
        const userId = user?.userId;
        const apiKey = input.apiKey || ctx.apiKey;
        let t1 = timing.checkpoint('Input parsed');

        // Validate provider is allowed (if configured)
        if (provider && (ctx as any).isProviderAllowed) {
          const isAllowed = (ctx as any).isProviderAllowed(provider);
          if (!isAllowed) {
            const allowedProviders = (ctx as any).allowedProviders;
            const allowedList = allowedProviders instanceof Set
              ? Array.from(allowedProviders).join(', ')
              : 'none (all providers blocked)';

            throw new TRPCError({
              code: 'FORBIDDEN',
              message: `Provider '${provider}' is not allowed. Allowed providers: ${allowedList}`,
            });
          }
        }

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
                metadata: { ...metadata, provider },
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
                  'generateText'
                );

                return {
                  success: true as const,
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
                success: true as const,
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
                method: 'generateText',
                metadata
              });
            }

            return {
              success: true as const,
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
            let t2 = timing.checkpoint('Calling aiService.execute (public/BYOK)', t1);

            const result = await aiService.execute({
              content,
              systemPrompt,
              metadata: { ...metadata, provider },
              options,
              apiKey,
            });

            timing.checkpoint('AI execution completed', t2);
            timing.end();

            return {
              success: true as const,
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
  };
}
