import { publicProcedure } from '../../../index';
import { z } from 'zod';
import { createMCPTool } from '../../../../auth/scopes';

/**
 * Basic utility procedures for MCP
 *
 * Note: Opinionated utility tools (greeting, time, calculate) have been moved
 * to example servers to keep core clean and focused on essential functionality.
 *
 * The greeting tool is kept here only for test compatibility.
 */
export const utilityProcedures: Record<string, any> = {
  // Minimal greeting tool for test compatibility
  greeting: publicProcedure
    .meta(createMCPTool({
      name: 'greeting',
      description: 'Generate a friendly greeting in the specified language',
      category: 'utility'
    }))
    .input(z.object({
      name: z.string().describe('Name to greet'),
      language: z.enum(['en', 'es', 'fr', 'de']).default('en').describe('Language for the greeting')
    }))
    .query(({ input }) => {
      const greetings: Record<string, string> = {
        en: `Hello, ${input.name}!`,
        es: `¡Hola, ${input.name}!`,
        fr: `Bonjour, ${input.name}!`,
        de: `Hallo, ${input.name}!`
      };
      return { greeting: greetings[input.language] || greetings.en };
    }),

  // Echo tool for test compatibility
  echo: publicProcedure
    .meta(createMCPTool({
      name: 'echo',
      description: 'Echo back a message',
      category: 'utility'
    }))
    .input(z.object({
      message: z.string().describe('Message to echo back')
    }))
    .query(({ input }) => {
      return { message: input.message };
    }),

  // Current system time (useful for testing and debugging)
  currentSystemTime: publicProcedure
    .meta(createMCPTool({
      name: 'currentSystemTime',
      description: 'Get the current system time',
      category: 'utility'
    }))
    .input(z.object({
      format: z.enum(['iso', 'timestamp', 'locale']).default('iso').describe('Time format')
    }))
    .query(({ input }) => {
      const now = new Date();
      let time: string | number;

      switch (input.format) {
        case 'timestamp':
          time = now.getTime();
          break;
        case 'locale':
          time = now.toLocaleString();
          break;
        case 'iso':
        default:
          time = now.toISOString();
      }

      return { time };
    })
};