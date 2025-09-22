/**
 * Auth Router - BYOK API key management
 */

import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '@src-trpc/index';
import { PostgreSQLRPCMethods } from '@auth/PostgreSQLRPCMethods';

export function createAuthRouter(postgresRPCMethods?: PostgreSQLRPCMethods) {
  return router({
    /**
     * Store user API key (BYOK)
     */
    storeUserKey: protectedProcedure
      .input(z.object({
        email: z.string().email(),
        provider: z.enum(['anthropic', 'openai', 'google']),
        apiKey: z.string().min(1),
      }))
      .mutation(async ({ input }) => {
        if (!postgresRPCMethods) {
          throw new TRPCError({
            code: 'NOT_IMPLEMENTED',
            message: 'Secret manager is not configured on this server.',
          });
        }

        const result = await postgresRPCMethods.storeUserKey({
          email: input.email,
          provider: input.provider,
          apiKey: input.apiKey
        });

        if (!result.success) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: result.error || 'Failed to store API key',
          });
        }

        return {
          success: true,
          keyId: result.secretId,
          message: result.message || `${input.provider} API key stored successfully`
        };
      }),

    /**
     * Get user API key status (without exposing the key)
     */
    getUserKey: protectedProcedure
      .input(z.object({
        email: z.string().email(),
        provider: z.enum(['anthropic', 'openai', 'google']),
      }))
      .query(async ({ input }) => {
        if (!postgresRPCMethods) {
          throw new TRPCError({
            code: 'NOT_IMPLEMENTED',
            message: 'Secret manager is not configured on this server.',
          });
        }

        const result = await postgresRPCMethods.getUserKey({
          email: input.email,
          provider: input.provider
        });

        if (!result.success) {
          return {
            hasKey: false,
            keyPreview: null,
            message: result.error || `No ${input.provider} API key found for user`
          };
        }

        // Return key status without exposing the full key
        const apiKey = result.message; // getUserKey returns the key in message field
        return {
          hasKey: true,
          keyPreview: apiKey ? `${apiKey.substring(0, 8)}...` : null,
          message: `${input.provider} API key found`
        };
      }),

    /**
     * Get all configured providers for a user
     */
    getUserProviders: protectedProcedure
      .input(z.object({
        email: z.string().email(),
      }))
      .query(async ({ input }) => {
        if (!postgresRPCMethods) {
          throw new TRPCError({
            code: 'NOT_IMPLEMENTED',
            message: 'Secret manager is not configured on this server.',
          });
        }

        const result = await postgresRPCMethods.getUserProviders({
          email: input.email
        });

        if (!result.success) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: result.error || 'Failed to get user providers',
          });
        }

        return {
          success: true,
          providers: (result.providers || []).map((provider: string) => ({
            name: provider,
            hasKey: true,
            displayName: provider === 'anthropic' ? 'Anthropic (Claude)' :
              provider === 'openai' ? 'OpenAI (GPT)' :
                provider === 'google' ? 'Google (Gemini)' : provider
          }))
        };
      }),

    /**
     * Validate user API key
     */
    validateUserKey: protectedProcedure
      .input(z.object({
        email: z.string().email(),
        provider: z.enum(['anthropic', 'openai', 'google']),
      }))
      .mutation(async ({ input }) => {
        if (!postgresRPCMethods) {
          throw new TRPCError({
            code: 'NOT_IMPLEMENTED',
            message: 'Secret manager is not configured on this server.',
          });
        }

        const result = await postgresRPCMethods.validateUserKey({
          email: input.email,
          provider: input.provider
        });

        if (!result.success) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: result.error || 'Validation failed',
          });
        }

        return {
          isValid: result.valid || false,
          message: `${input.provider} API key is ${result.valid ? 'valid' : 'invalid'}`
        };
      }),

    /**
     * Rotate (update) user API key
     */
    rotateUserKey: protectedProcedure
      .input(z.object({
        email: z.string().email(),
        provider: z.enum(['anthropic', 'openai', 'google']),
        newApiKey: z.string().min(1),
      }))
      .mutation(async ({ input }) => {
        if (!postgresRPCMethods) {
          throw new TRPCError({
            code: 'NOT_IMPLEMENTED',
            message: 'Secret manager is not configured on this server.',
          });
        }

        const result = await postgresRPCMethods.rotateUserKey({
          email: input.email,
          provider: input.provider,
          newApiKey: input.newApiKey
        });

        if (!result.success) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: result.error || 'Failed to rotate API key',
          });
        }

        return {
          success: true,
          keyId: result.secretId,
          message: result.message || `${input.provider} API key updated successfully`
        };
      }),

    /**
     * Delete user API key
     */
    deleteUserKey: protectedProcedure
      .input(z.object({
        email: z.string().email(),
        provider: z.enum(['anthropic', 'openai', 'google']),
      }))
      .mutation(async ({ input }) => {
        if (!postgresRPCMethods) {
          throw new TRPCError({
            code: 'NOT_IMPLEMENTED',
            message: 'Secret manager is not configured on this server.',
          });
        }

        const result = await postgresRPCMethods.deleteUserKey({
          email: input.email,
          provider: input.provider
        });

        if (!result.success) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: result.error || 'Failed to delete API key',
          });
        }

        return {
          success: true,
          deleted: true,
          message: result.message || `${input.provider} API key deleted successfully`
        };
      }),
  });
}

export const authRouter = createAuthRouter();