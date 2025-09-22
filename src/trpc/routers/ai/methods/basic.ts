import { z } from 'zod';
import { publicProcedure } from '../../../index';

/**
 * Basic AI procedures - health and testing
 */
export const basicProcedures = {

  /**
   * Simple test procedure with minimal Zod schema
   */
  test: publicProcedure
    .input(z.object({ message: z.string().optional().default('Hello from test tool!') }))
    .output(z.object({ message: z.string() }))
    .meta({
      mcp: { enabled: true, description: "Just a echo test endpoint" },
      openapi: {
        method: 'POST',
        path: '/ai/test',
        tags: ['AI', 'Testing'],
        summary: 'Test AI endpoint',
        description: 'Echo test endpoint for AI service validation'
      }
    })
    .mutation(async ({ input }) => {
      return { message: `Hello ${input.message}` };
    }),

  /**
   * Health check procedure
   */
  health: publicProcedure
    .input(z.void())
    .query(async () => {
      return {
        status: 'healthy' as const,
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: '0.1.0',
      };
    }),

};