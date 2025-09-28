import { publicProcedure } from "../../../index";
import z from "zod";
import { createMCPTool } from '../../../../auth/scopes';

/**
 * Basic utility procedures for MCP
 */
export const utilityProcedures: Record<string, any> = {
  // Greeting tool with MCP metadata - Public tool (no auth required)
  greeting: publicProcedure
    .meta({
      ...createMCPTool({
        name: 'greeting',
        description: 'Generate a friendly greeting message for a given name in multiple languages',
        category: 'utility',
        public: true // No authentication required
      }),
      openapi: {
        method: 'GET',
        path: '/mcp/hello',
        tags: ['MCP', 'Greetings'],
        summary: 'Generate greeting',
        description: 'Generate a friendly greeting message for a given name'
      }
    })
    .input(z.object({
      name: z.string().min(1).describe('The name to greet'),
      language: z.enum(['en', 'de', 'es']).describe('Language code for the greeting (en=English, de=German, es=Spanish)'),
    }))
    .output(z.object({ greeting: z.string() }))
    .query(({ input }) => {
      const name = input.name || 'World';
      const lang = input.language || 'en';

      let greeting: string;
      switch (lang) {
        case 'de':
          greeting = `Hallo ${name}! Willkommen beim Simple RPC AI Backend.`;
          break;
        case 'es':
          greeting = `¡Hola ${name}! Bienvenido al Simple RPC AI Backend.`;
          break;
        default:
          greeting = `Hello ${name}! Welcome to Simple RPC AI Backend.`;
      }

      return { greeting };
    }),

  // Current system time tool - public utility
  currentSystemTime: publicProcedure
    .meta({
      ...createMCPTool({
        name: 'currentSystemTime',
        description: 'Get the current system time in a specified timezone',
        category: 'utility',
        public: true
      }),
      openapi: {
        method: 'GET',
        path: '/mcp/time',
        tags: ['MCP', 'Utility'],
        summary: 'Get current time'
      }
    })
    .input(z.object({
      timezone: z.string().describe('Timezone identifier (e.g., "UTC", "America/New_York", "Europe/Berlin")'),
    }))
    .output(z.object({
      time: z.string(),
      timezone: z.string(),
      timestamp: z.number()
    }))
    .query(({ input }) => {
      const timezone = input.timezone || 'UTC';
      const now = new Date();

      try {
        const time = now.toLocaleString('en-US', { timeZone: timezone });
        return {
          time,
          timezone,
          timestamp: now.getTime()
        };
      } catch (error) {
        // Fallback to UTC if timezone is invalid
        const time = now.toISOString();
        return {
          time,
          timezone: 'UTC',
          timestamp: now.getTime()
        };
      }
    }),

  // Calculator tool with input validation
  calculate: publicProcedure
    .meta({
      ...createMCPTool({
        name: 'calculate',
        description: 'Perform basic mathematical calculations safely',
        category: 'utility',
        public: true
      }),
      openapi: {
        method: 'POST',
        path: '/mcp/calculate',
        tags: ['MCP', 'Utility'],
        summary: 'Mathematical calculator'
      }
    })
    .input(z.object({
      expression: z.string().min(1).max(100).describe('Mathematical expression to evaluate (e.g., "2 + 2", "10 * 5")'),
    }))
    .output(z.object({
      result: z.number(),
      expression: z.string()
    }))
    .mutation(({ input }) => {
      // Simple safe calculator - only allow basic operations
      const safeExpression = input.expression.replace(/[^0-9+\-*/.() ]/g, '');

      if (!safeExpression || safeExpression !== input.expression) {
        throw new Error('Invalid expression. Only numbers and basic operators (+, -, *, /, parentheses) are allowed.');
      }

      try {
        // Use Function constructor for safer evaluation than eval()
        const result = Function(`"use strict"; return (${safeExpression})`)();

        if (typeof result !== 'number' || !isFinite(result)) {
          throw new Error('Expression resulted in an invalid number');
        }

        return {
          result,
          expression: input.expression
        };
      } catch (error) {
        throw new Error(`Calculation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }),
};