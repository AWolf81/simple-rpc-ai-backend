/**
 * Custom Methods for Consumer App
 *
 * Only custom namespaces - base library routers excluded
 */

import { router, publicProcedure, createMCPTool } from 'simple-rpc-ai-backend';
import { z } from 'zod';

/**
 * Math router - custom namespace
 */
export const mathRouter = router({
  add: publicProcedure
    .meta({
      ...createMCPTool({
        title: 'Add Numbers',
        description: 'Add two numbers together',
        category: 'math'
      })
    })
    .input(z.object({
      a: z.number().describe('First number'),
      b: z.number().describe('Second number')
    }))
    .mutation(async ({ input }) => {
      return {
        operation: 'add',
        result: input.a + input.b,
        timestamp: new Date().toISOString()
      };
    }),

  multiply: publicProcedure
    .meta({
      ...createMCPTool({
        title: 'Multiply Numbers',
        description: 'Multiply two numbers',
        category: 'math'
      })
    })
    .input(z.object({
      a: z.number().describe('First number'),
      b: z.number().describe('Second number')
    }))
    .mutation(async ({ input }) => {
      return {
        operation: 'multiply',
        result: input.a * input.b,
        timestamp: new Date().toISOString()
      };
    })
});

/**
 * Demo router - custom namespace
 */
export const demoRouter = router({
  echo: publicProcedure
    .meta({
      ...createMCPTool({
        title: 'Echo Message',
        description: 'Echo a message back',
        category: 'demo'
      })
    })
    .input(z.object({
      message: z.string().describe('Message to echo'),
      uppercase: z.boolean().default(false).describe('Convert to uppercase')
    }))
    .query(async ({ input }) => {
      const result = input.uppercase
        ? input.message.toUpperCase()
        : input.message;

      return {
        original: input.message,
        echo: result,
        uppercase: input.uppercase,
        timestamp: new Date().toISOString()
      };
    }),

  status: publicProcedure
    .meta({
      ...createMCPTool({
        title: 'Server Status',
        description: 'Get server status',
        category: 'demo'
      })
    })
    .input(z.object({}))
    .query(async () => {
      return {
        status: 'online',
        uptime: process.uptime(),
        version: '1.0.0',
        timestamp: new Date().toISOString()
      };
    })
});

/**
 * Export custom routers for the server
 */
export function getCustomRouters() {
  return {
    math: mathRouter,
    demo: demoRouter
  };
}
