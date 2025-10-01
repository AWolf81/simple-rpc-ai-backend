/**
 * MCP Prompt Access Tools - Reference Implementation
 *
 * This module provides programmatic access to MCP prompts via tRPC tools.
 * These tools allow clients to discover and use MCP prompts through the
 * standard tools/list and tools/call MCP methods instead of prompts/list
 * and prompts/get.
 *
 * Note: This is a reference implementation showing how to add prompt access
 * tools to your custom server. The core library intentionally does not include
 * these to remain less opinionated.
 */

import { router, publicProcedure, createMCPTool } from 'simple-rpc-ai-backend';
import { z } from 'zod';

const normalizePromptVariables = (config = {}) => {
  const variables = {};

  if (config.variables) {
    for (const [key, value] of Object.entries(config.variables)) {
      variables[key] = { ...value };
    }
  }

  if (Array.isArray(config.arguments)) {
    for (const arg of config.arguments) {
      const current = variables[arg.name] || {};
      variables[arg.name] = {
        type: current.type || arg.type || 'string',
        description: current.description || arg.description,
        required: current.required ?? arg.required ?? false,
        options: current.options || arg.options,
        default: current.default ?? arg.default,
        example: current.example ?? arg.example,
      };
    }
  }

  return variables;
};

const buildExampleArguments = variables => {
  const example = {};

  for (const [name, definition] of Object.entries(variables)) {
    if (!definition.required) {
      continue;
    }

    if (definition.example !== undefined) {
      example[name] = definition.example;
      continue;
    }

    if (Array.isArray(definition.options) && definition.options.length > 0) {
      example[name] = definition.options[0];
      continue;
    }

    if (definition.default !== undefined && definition.default !== null) {
      example[name] = definition.default;
      continue;
    }

    if (definition.type === 'boolean') {
      example[name] = true;
      continue;
    }

    example[name] = 'example-value';
  }

  return example;
};

/**
 * Prompt Access Router - Tools for discovering and using MCP prompts
 */
export const promptAccessRouter = router({
  /**
   * Example: Specific tool for explain-concept prompt
   * This approach works better with MCP UIs because all parameters are explicit
   */
  explainConcept: publicProcedure
    .meta({
      ...createMCPTool({
        title: 'Explain Technical Concept',
        description: 'Get a prompt to explain a technical concept at different skill levels with examples',
        category: 'prompts'
      })
    })
    .input(z.object({
      concept: z.string().describe('The technical concept to explain (e.g., "recursion", "closures", "async/await")'),
      level: z.enum(['beginner', 'intermediate', 'advanced']).describe('Target audience skill level'),
      includeExamples: z.enum(['yes', 'no']).default('yes').describe('Whether to include code examples')
    }))
    .query(async ({ input, ctx }) => {
      // Get the app router to find the prompt
      const appRouter = ctx?.appRouter;
      if (!appRouter) {
        throw new Error('App router not available');
      }

      // Find the explain-concept prompt
      const allProcedures = appRouter._def?.procedures || {};
      let explainConceptPrompt = null;

      for (const [fullName, procedure] of Object.entries(allProcedures)) {
        const procedureAny = procedure;
        const meta = procedureAny?._def?.meta;
        if (meta?.mcpPrompt?.name === 'explain-concept') {
          explainConceptPrompt = procedure;
          break;
        }
      }

      if (!explainConceptPrompt) {
        throw new Error('explain-concept prompt not found');
      }

      // Execute the prompt
      const resolver = explainConceptPrompt._def?.resolver;
      const promptText = await resolver({
        input,
        ctx: ctx || {},
        type: 'query'
      });

      return {
        promptText: typeof promptText === 'string' ? promptText : JSON.stringify(promptText),
        concept: input.concept,
        level: input.level,
        includeExamples: input.includeExamples,
        timestamp: new Date().toISOString()
      };
    }),


  /**
   * Get Prompts - List all available MCP prompts
   *
   * This tool scans the tRPC router for procedures with mcpPrompt metadata
   * and returns them in a format suitable for tool discovery.
   */
  getPrompts: publicProcedure
    .meta({
      ...createMCPTool({
        title: 'Get MCP Prompts',
        description: 'List all available MCP prompts with their descriptions and arguments',
        category: 'prompts'
      })
    })
    .input(z.object({
      category: z.string().optional().describe('Filter prompts by category (coding, documentation, review, analysis, general)')
    }))
    .query(async ({ input, ctx }) => {
      try {
        // Get the app router from context
        const appRouter = ctx?.appRouter;

        if (!appRouter) {
          throw new Error('App router not available. Ensure the server is properly configured.');
        }

        // Extract all procedures with mcpPrompt metadata
        const prompts = [];
        const allProcedures = appRouter._def?.procedures || {};

        for (const [fullName, procedure] of Object.entries(allProcedures)) {
          const procedureAny = procedure;
          const meta = procedureAny?._def?.meta;

          if (meta?.mcpPrompt) {
            const config = meta.mcpPrompt;

            // Apply category filter if specified
            if (input.category && config.category !== input.category) {
              continue;
            }

            const variableDefinitions = normalizePromptVariables(config);
            const exampleArgs = buildExampleArguments(variableDefinitions);

            const definitionCall = {
              method: 'tools/call',
              params: {
                name: 'getPromptTemplate',
                arguments: {
                  name: config.name
                }
              }
            };

            const renderCall = Object.keys(exampleArgs).length > 0
              ? {
                  method: 'tools/call',
                  params: {
                    name: 'getPromptTemplate',
                    arguments: {
                      name: config.name,
                      argumentsJson: JSON.stringify(exampleArgs)
                    }
                  }
                }
              : null;

            prompts.push({
              name: config.name,
              description: config.description || `Prompt: ${config.name}`,
              category: config.category || 'general',
              arguments: config.arguments || [],
              public: config.public !== false,
              procedureName: fullName,
              template: config.template || null,
              variables: variableDefinitions,
              examples: {
                definition: definitionCall,
                ...(renderCall ? { render: renderCall } : {})
              }
            });
          }
        }

        console.log(`📝 Prompt Discovery: Found ${prompts.length} prompts${input.category ? ` (category: ${input.category})` : ''}`);

        return {
          prompts,
          total: prompts.length,
          categories: [...new Set(prompts.map(p => p.category))],
          timestamp: new Date().toISOString(),
          usage: {
            note: 'Call getPromptTemplate without argumentsJson to inspect a prompt\'s template and variables. Provide argumentsJson as a JSON string to render the populated prompt text.',
            examples: {
              definition: {
                tool: 'getPromptTemplate',
                call: {
                  name: 'code-review',
                  arguments: { name: 'code-review' }
                }
              },
              render: {
                tool: 'getPromptTemplate',
                call: {
                  name: 'explain-concept',
                  arguments: {
                    name: 'explain-concept',
                    argumentsJson: '{"concept":"recursion","level":"beginner","includeExamples":"yes"}'
                  }
                }
              }
            },
            tip: 'For native MCP prompt execution, tools should prefer prompts/list and prompts/get when the client supports them.'
          }
        };

      } catch (error) {
        throw new Error(`Failed to get prompts: ${error.message}`);
      }
    }),

  /**
   * Get Prompt Template - Execute a prompt and return the populated text
   *
   * This tool finds the prompt procedure by name, validates the arguments,
   * executes it, and returns the generated prompt text.
   */
  getPromptTemplate: publicProcedure
    .meta({
      ...createMCPTool({
        title: 'Get Prompt Template',
        description: 'Retrieve a prompt template definition and optionally render it. Call without argumentsJson to view template metadata; supply argumentsJson (JSON string) to render the prompt.',
        category: 'prompts'
      })
    })
    .input(z.object({
      name: z.string().describe('Name of the prompt to execute (e.g., "explain-concept", "code-review")'),
      argumentsJson: z.string().optional().describe('Optional JSON string containing prompt arguments. Example: \'{"concept":"recursion","level":"beginner","includeExamples":"yes"}\'. Omit to receive only the template definition.')
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        // Get the app router from context
        const appRouter = ctx?.appRouter;

        if (!appRouter) {
          throw new Error('App router not available. Ensure the server is properly configured.');
        }

        // Find the prompt procedure
        const allProcedures = appRouter._def?.procedures || {};
        let targetProcedure = null;
        let targetMeta = null;

        for (const [fullName, procedure] of Object.entries(allProcedures)) {
          const procedureAny = procedure;
          const meta = procedureAny?._def?.meta;

          if (meta?.mcpPrompt?.name === input.name) {
            targetProcedure = procedureAny;
            targetMeta = meta.mcpPrompt;
            break;
          }
        }

        if (!targetProcedure || !targetMeta) {
          throw new Error(`Prompt '${input.name}' not found`);
        }

        const variables = normalizePromptVariables(targetMeta);
        const requiredArgs = (targetMeta.arguments || []).filter(arg => arg.required);
        const requiredArgNames = requiredArgs.map(arg => arg.name);

        const hasArgumentPayload = typeof input.argumentsJson === 'string' && input.argumentsJson.trim().length > 0;

        let rawArgs = {};
        if (hasArgumentPayload) {
          try {
            rawArgs = JSON.parse(input.argumentsJson);
          } catch (error) {
            throw new Error(`Invalid JSON in argumentsJson: ${error.message}`);
          }
        }

        const missingArguments = requiredArgNames.filter(name => rawArgs[name] === undefined);

        if (hasArgumentPayload && missingArguments.length > 0) {
          throw new Error(`Missing required arguments for '${input.name}': ${missingArguments.join(', ')}. Call getPromptTemplate without argumentsJson to inspect the template definition.`);
        }

        let validatedArgs = rawArgs;
        let promptText = null;

        if (hasArgumentPayload) {
          const inputParser = targetProcedure._def?.inputs?.[0];
          if (inputParser) {
            try {
              validatedArgs = inputParser.parse(rawArgs);
            } catch (validationError) {
              throw new Error(`Invalid prompt arguments: ${validationError.message || validationError}`);
            }
          }

          const resolver = targetProcedure._def?.resolver;
          if (!resolver) {
            throw new Error(`Prompt '${input.name}' has no resolver`);
          }

          const result = await resolver({
            input: validatedArgs,
            ctx: ctx || {},
            type: targetProcedure._def?.type || 'query'
          });

          promptText = typeof result === 'string' ? result : JSON.stringify(result);
          console.log(`📝 Prompt Execution: ${input.name} rendered with ${Object.keys(validatedArgs).length} argument(s)`);
        } else {
          console.log(`🧩 Prompt Definition Lookup: ${input.name}`);
        }

        const exampleArguments = buildExampleArguments(variables);

        const response = {
          name: input.name,
          description: targetMeta.description || `Prompt: ${input.name}`,
          category: targetMeta.category || 'general',
          template: targetMeta.template || null,
          variables,
          requiredArguments: requiredArgNames,
          missingArguments,
          exampleArguments,
          usage: {
            definition: {
              method: 'tools/call',
              params: {
                name: 'getPromptTemplate',
                arguments: { name: input.name }
              }
            },
            tip: 'Provide argumentsJson as a JSON string matching the variable definitions to render the prompt.'
          },
          rendered: hasArgumentPayload,
          timestamp: new Date().toISOString()
        };

        if (Object.keys(exampleArguments).length > 0) {
          response.usage.render = {
            method: 'tools/call',
            params: {
              name: 'getPromptTemplate',
              arguments: {
                name: input.name,
                argumentsJson: JSON.stringify(exampleArguments)
              }
            }
          };
        }

        if (hasArgumentPayload) {
          response.arguments = validatedArgs;
          response.promptText = promptText;
        } else {
          response.promptText = null;
        }

        return response;

      } catch (error) {
        throw new Error(`Failed to get prompt template: ${error.message}`);
      }
    })
});
