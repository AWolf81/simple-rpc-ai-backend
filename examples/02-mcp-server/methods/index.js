/**
 * MCP Methods & Tools Configuration
 *
 * This module sets up custom MCP tools and methods using helper functions
 */

import { router, publicProcedure, createMCPTool, defaultRootManager } from 'simple-rpc-ai-backend';
import { z } from 'zod';

/**
 * Custom Math Tools Router - All procedures become MCP tools automatically
 */
export const customMathRouter = router({
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
      const result = input.a + input.b;
      console.log(`🧮 Math: ${input.a} + ${input.b} = ${result}`);
      return {
        operation: 'addition',
        operands: [input.a, input.b],
        result,
        timestamp: new Date().toISOString()
      };
    }),

  multiply: publicProcedure
    .meta({
      ...createMCPTool({
        title: 'Multiply Numbers',
        description: 'Multiply two numbers together',
        category: 'math'
      })
    })
    .input(z.object({
      a: z.number().describe('First number'),
      b: z.number().describe('Second number')
    }))
    .mutation(async ({ input }) => {
      const result = input.a * input.b;
      console.log(`🧮 Math: ${input.a} × ${input.b} = ${result}`);
      return {
        operation: 'multiplication',
        operands: [input.a, input.b],
        result,
        timestamp: new Date().toISOString()
      };
    }),

  calculate: publicProcedure
    .meta({
      ...createMCPTool({
        title: 'Calculate Expression',
        description: 'Evaluate a mathematical expression safely',
        category: 'math'
      })
    })
    .input(z.object({
      expression: z.string().describe('Mathematical expression to evaluate (e.g., "2 + 3 * 4")')
    }))
    .mutation(async ({ input }) => {
      try {
        // Simple safe evaluation for basic math expressions
        // WARNING: In production, use a proper expression parser
        const sanitized = input.expression.replace(/[^0-9+\-*/(). ]/g, '');
        const result = eval(sanitized);

        console.log(`🧮 Calculator: ${sanitized} = ${result}`);
        return {
          operation: 'calculate',
          expression: sanitized,
          result,
          timestamp: new Date().toISOString()
        };
      } catch (error) {
        throw new Error(`Invalid expression: ${error.message}`);
      }
    })
});

/**
 * Custom Utility Tools Router
 */
export const customUtilityRouter = router({
  greeting: publicProcedure
    .meta({
      ...createMCPTool({
        title: 'Generate Greeting',
        description: 'Generate a personalized greeting message',
        category: 'utility'
      })
    })
    .input(z.object({
      name: z.string().describe('Name of the person to greet'),
      language: z.enum(['en', 'es', 'fr', 'de']).default('en').describe('Language for the greeting'),
      formal: z.boolean().default(false).describe('Whether to use formal greeting')
    }))
    .mutation(async ({ input }) => {
      const greetings = {
        en: { casual: 'Hello', formal: 'Good day' },
        es: { casual: 'Hola', formal: 'Buenos días' },
        fr: { casual: 'Salut', formal: 'Bonjour' },
        de: { casual: 'Hallo', formal: 'Guten Tag' }
      };

      const greeting = greetings[input.language][input.formal ? 'formal' : 'casual'];
      const message = `${greeting}, ${input.name}!`;

      console.log(`👋 Greeting: ${message}`);
      return {
        message,
        language: input.language,
        formal: input.formal,
        timestamp: new Date().toISOString()
      };
    }),

  serverStatus: publicProcedure
    .meta({
      ...createMCPTool({
        title: 'Server Status',
        description: 'Get current server status and information',
        category: 'utility'
      })
    })
    .input(z.object({
      mode: z.enum(['basic', 'detailed']).default('basic').describe('Status detail level')
    }))
    .query(async ({ input }) => {
      const basic = {
        status: 'online',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        nodeVersion: process.version
      };

      if (input.mode === 'detailed') {
        return {
          ...basic,
          memoryUsage: process.memoryUsage(),
          platform: process.platform,
          arch: process.arch,
          pid: process.pid
        };
      }

      return basic;
    }),

  // Time utility tool (moved from core)
  currentSystemTime: publicProcedure
    .meta({
      ...createMCPTool({
        title: 'Current System Time',
        description: 'Get the current system time in a specified timezone',
        category: 'utility'
      })
    })
    .input(z.object({
      timezone: z.string().default('UTC').describe('Timezone identifier (e.g., "UTC", "America/New_York", "Europe/Berlin")'),
    }))
    .query(async ({ input }) => {
      const timezone = input.timezone || 'UTC';
      const now = new Date();

      try {
        const time = now.toLocaleString('en-US', { timeZone: timezone });
        console.log(`🕐 Time query: ${time} (${timezone})`);
        return {
          time,
          timezone,
          timestamp: now.getTime(),
          iso: now.toISOString()
        };
      } catch (error) {
        // Fallback to UTC if timezone is invalid
        const time = now.toISOString();
        console.log(`🕐 Time query (fallback): ${time} (UTC)`);
        return {
          time,
          timezone: 'UTC',
          timestamp: now.getTime(),
          iso: time
        };
      }
    }),

  // Enhanced calculator tool (moved from core)
  calculator: publicProcedure
    .meta({
      ...createMCPTool({
        title: 'Safe Calculator',
        description: 'Perform basic mathematical calculations safely with input validation',
        category: 'utility'
      })
    })
    .input(z.object({
      expression: z.string().min(1).max(100).describe('Mathematical expression to evaluate (e.g., "2 + 2", "10 * 5")'),
    }))
    .mutation(async ({ input }) => {
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

        console.log(`🧮 Safe Calculator: ${safeExpression} = ${result}`);
        return {
          result,
          expression: input.expression,
          sanitized: safeExpression,
          timestamp: new Date().toISOString()
        };
      } catch (error) {
        throw new Error(`Calculation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    })
});

/**
 * File Operations Router - Custom file operations that complement the built-in system tools
 *
 * Note: Basic file operations (readFile, listFiles, writeFile, pathExists) are provided
 * by the system router with dynamic root folder discovery. This router adds enhanced
 * file operations with custom formatting and additional features.
 */
export const fileOperationsRouter = router({
  getFileInfo: publicProcedure
    .meta({
      ...createMCPTool({
        title: 'Get File Info',
        description: 'Get detailed file metadata and information with timestamps',
        category: 'file'
      })
    })
    .input(z.object({
      rootId: z.string().describe('Root directory identifier (use system.getRootFolders to see available roots)'),
      path: z.string().describe('File path relative to root directory')
    }))
    .query(async ({ input }) => {
      try {
        const { rootId, path } = input;

        // Get file stats using the secure defaultRootManager
        const stats = await defaultRootManager.getFileStats(rootId, path);

        console.log(`ℹ️ File info: ${rootId}/${path}`);

        return {
          path,
          rootId,
          size: stats.size,
          isFile: stats.isFile(),
          isDirectory: stats.isDirectory(),
          created: stats.birthtime?.toISOString(),
          modified: stats.mtime?.toISOString(),
          accessed: stats.atime?.toISOString(),
          permissions: {
            readable: true, // Default - RootManager handles access control
            writable: !stats.isDirectory() // Directories typically need different handling
          },
          timestamp: new Date().toISOString()
        };

      } catch (error) {
        throw new Error(`Failed to get file info: ${error.message}`);
      }
    })
});

/**
 * Get all custom routers
 */
export function getCustomRouters() {
  return {
    math: customMathRouter,
    utility: customUtilityRouter,
    file: fileOperationsRouter
  };
}