/**
 * Agents Router - Agent functionality via tRPC
 *
 * Provides access to AI Agent SDK and OpenAI Agents SDK through tRPC
 */

import { z } from 'zod';
import { router, publicProcedure } from '@src-trpc/index';
import { TRPCError } from '@trpc/server';
import { AgentService } from '@services/agents/agent-service';
import {
  AgentExecuteRequestSchema,
  AgentSkillSchema,
  AgentToolSchema,
  AgentConfig,
  type AgentTool,
  type AgentSkill,
  type AgentExecuteRequest
} from '@services/agents/types';
import { createMCPTool } from '@src-trpc/routers/mcp/index';
import { createSkillsRouter } from './skills';
import { logger } from '../../../utils/logger';
import type { SkillManager } from '@services/agents/skills/manager';
import { SkillsToolConverter } from '@services/agents/skills/tools-converter';
import { getConversationStateManager } from '@services/agents/conversation-state-manager';

export interface AgentRouterConfig {
  agentService?: AgentService;
  agentConfig?: AgentConfig;
  skillManager?: SkillManager;
}

export function createAgentRouter(config: AgentRouterConfig = {}): ReturnType<typeof router> {
  const { agentService, skillManager } = config;

  if (!agentService) {
    throw new Error('AgentService is required for agent router');
  }

  // Get conversation state manager
  const conversationManager = getConversationStateManager();

  return router({
    // Skills sub-router (new skill system)
    skills: createSkillsRouter(skillManager),

    /**
     * Execute an agent request
     */
    execute: publicProcedure
      .meta({
        ...createMCPTool({
          name: 'execute-agent',
          description: 'Execute an AI agent request with SDK selection and skills support',
          category: 'agents'
        }),
        openrpc: {
          method: 'agents.execute',
          summary: 'Execute an agent request',
          description: 'Run an agent with specified SDK (ai-agent or openai) and get AI-powered response with skills/tools support',
          tags: ['agents']
        }
      })
      .input(AgentExecuteRequestSchema.extend({
        conversationId: z.string().optional()
      }))
      .mutation(async ({ input }) => {
        // Convert skills to executable tools
        let skillTools: AgentTool[] = [];

        logger.info(`🎯 Agent execution request`);
        logger.info(`   SDK: ${input.sdk || 'ai-agent'}, Model: ${input.model || 'default'}`);
        logger.info(`   Input skills: ${input.context?.skills?.length || 0}`);
        logger.info(`   SkillManager available: ${!!skillManager}`);

        if (skillManager) {
          // Ensure skills are initialized before accessing them
          await skillManager.initialize();

          const converter = new SkillsToolConverter(skillManager);

          // Auto-load all skills if none specified in context
          if (!input.context?.skills || input.context.skills.length === 0) {
            // Get all available skills from SkillManager
            const allSkills = skillManager.getAll();
            logger.info(`   🔄 Auto-loading all available skills (${allSkills.length} total)`);

            if (allSkills.length > 0) {
              // Convert all skills to tools
              skillTools = converter.convertSkillsToTools();
              logger.info(`   ✅ Auto-loaded ${skillTools.length} skill tools: ${skillTools.map(t => t.name).join(', ')}`);
            } else {
              logger.warn(`   ⚠️  No skills available in SkillManager`);
            }
          } else {
            // Use explicitly specified skills
            const skillIds = input.context.skills.map((s: any) => s.id);
            logger.info(`   🎯 Converting specified skills to tools: ${skillIds.join(', ')}`);
            skillTools = converter.convertSkillsToTools(skillIds);
            logger.info(`   ✅ Converted ${skillTools.length} skill tools: ${skillTools.map(t => t.name).join(', ')}`);
          }
        } else {
          logger.warn(`   ⚠️  SkillManager not available - no skills loaded`);
        }

        // Create a properly typed version of the input for the agent service
        const agentRequest: AgentExecuteRequest = {
          ...input,
          context: input.context ? {
            ...input.context,
            tools: input.context.tools?.map(tool => ({
              ...tool,
              execute: async (args: any) => {
                throw new Error(`Tool ${tool.name} execution function not implemented via API. Register server-side with implementation.`);
              }
            })) as AgentTool[], // Trust that we're providing execute function
            skills: input.context.skills?.map(skill => ({
              ...skill,
              // Level is required in AgentSkill type, so ensure it exists
              level: skill.level as 1 | 2 | 3
            })) as AgentSkill[] // Trust that we're providing required fields
          } : undefined
        };

        // Get or create conversation state
        let convId = input.conversationId;
        let state = convId ? conversationManager.get(convId) : null;

        if (!state) {
          state = conversationManager.create({
            messages: input.messages || [],
            model: input.model || 'claude-3-5-sonnet-20241022',
            provider: input.provider,
            systemPrompt: input.systemPrompt
          });
          convId = state.id;
          logger.info(`📝 Created new conversation: ${convId}`);
        } else {
          logger.info(`📝 Resuming conversation: ${convId}`);
        }

        // Add current user prompt to conversation state
        conversationManager.addMessage(convId, {
          role: 'user',
          content: input.prompt
        });

        // Pass skill tools to agent execution via aiService.execute
        const result = await agentService.execute(agentRequest, skillTools);

        // Check for interaction requirement
        if ((result as any).type === 'interaction_required') {
          logger.info(`🔔 Interaction required - pausing conversation ${convId}`);
          logger.info(`   DEBUG: result.toolName = ${(result as any).toolName}`);
          logger.info(`   DEBUG: result.toolArguments = ${JSON.stringify((result as any).toolArguments)}`);
          logger.info(`   DEBUG: result.originalToolName = ${(result as any).originalToolName}`);

          // Save pending interaction in conversation state with actual tool arguments
          // Note: toolName is the wrapper (e.g. "approval-dialog"), originalToolName is tracked separately
          conversationManager.pause(
            convId,
            (result as any).interaction,
            {
              name: (result as any).toolName,
              arguments: (result as any).toolArguments || {}  // Use actual tool arguments
            },
            (result as any).originalToolName,  // Pass the original tool that triggered this (e.g. file_handling_delete)
            {
              skillId: (result as any).skillId,
              scriptName: (result as any).scriptName,
              scriptArgs: (result as any).scriptArgs,
              stdin: (result as any).stdin,
              cwd: (result as any).cwd,
              toolArguments: (result as any).toolArguments || {}
            }
          );

          return {
            conversationId: convId,
            type: 'interaction_required',
            interaction: (result as any).interaction,
            toolName: (result as any).toolName,
            partialContent: (result as any).partialContent || '',
            usage: (result as any).usage
          };
        }

        // Normal completion - add assistant response to conversation
        if (result.content) {
          conversationManager.addMessage(convId, {
            role: 'assistant',
            content: result.content
          });
        }

        return {
          conversationId: convId,
          type: 'completed',
          ...result
        };
      }),

    /**
     * Execute an agent request with streaming
     * Returns text chunks as they are generated
     */
    executeStream: publicProcedure
      .meta({
        ...createMCPTool({
          name: 'execute-agent-stream',
          description: 'Execute an AI agent request with streaming response',
          category: 'agents'
        }),
        openrpc: {
          method: 'agents.executeStream',
          summary: 'Execute an agent request with streaming',
          description: 'Run an agent and receive the response as a stream of text chunks',
          tags: ['agents']
        }
      })
      .input(AgentExecuteRequestSchema)
      .subscription(async function* ({ input }) {
        // Prepare agent request
        const agentRequest: AgentExecuteRequest = {
          ...input,
          context: input.context ? {
            ...input.context,
            tools: input.context.tools?.map(tool => ({
              ...tool,
              execute: async (args: any) => {
                throw new Error(`Tool ${tool.name} execution not implemented via API.`);
              }
            })) as AgentTool[],
            skills: input.context.skills?.map(skill => ({
              ...skill,
              level: skill.level as 1 | 2 | 3
            })) as AgentSkill[]
          } : undefined
        };

        try {
          // For now, execute normally and simulate streaming
          // TODO: Implement true streaming through agent adapters
          const result = await agentService.execute(agentRequest);

          // Chunk the response for streaming effect
          const chunkSize = 50;
          for (let i = 0; i < result.content.length; i += chunkSize) {
            yield {
              chunk: result.content.slice(i, i + chunkSize),
              done: false
            };
          }

          // Final chunk with metadata
          yield {
            chunk: '',
            done: true,
            usage: result.usage,
            model: result.model
          };

        } catch (error) {
          throw new Error(`Agent streaming failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }),

    /**
     * List available SDKs
     */
    listSDKs: publicProcedure
      .meta({
        openrpc: {
          method: 'agents.listSDKs',
          summary: 'List available agent SDKs',
          description: 'Get list of available agent SDKs (ai-agent, openai)',
          tags: ['agents']
        }
      })
      .input(z.object({}).optional())
      .query(async () => {
        return {
          sdks: agentService.getAvailableSDKs(),
          default: agentService.getConfig().defaultSDK
        };
      }),

    /**
     * Get agent configuration
     */
    getConfig: publicProcedure
      .meta({
        openrpc: {
          method: 'agents.getConfig',
          summary: 'Get agent configuration',
          description: 'Retrieve current agent service configuration',
          tags: ['agents']
        }
      })
      .input(z.object({}).optional())
      .query(async () => {
        return agentService.getConfig();
      }),

    /**
     * Add a tool
     */
    addTool: publicProcedure
      .meta({
        openrpc: {
          method: 'agents.addTool',
          summary: 'Add a tool to agents',
          description: 'Register a new tool that agents can use during execution',
          tags: ['agents']
        }
      })
      .input(z.object({
        name: z.string(),
        description: z.string(),
        inputSchema: z.object({
          type: z.literal('object'),
          properties: z.record(z.string(), z.unknown()),
          required: z.array(z.string()).optional()
        })
      }))
      .mutation(async ({ input }) => {
        // Note: For actual tool execution, you'd need to provide the execute function
        // This is a limitation of tRPC - functions can't be serialized
        // In practice, tools should be registered server-side
        const tool: AgentTool = {
          ...input,
          execute: async () => {
            throw new Error('Tool execution function not implemented via API. Register server-side with implementation.');
          }
        };
        agentService.addTool(tool);
        return { success: true, message: `Tool '${input.name}' added` };
      }),

    /**
     * Remove a tool
     */
    removeTool: publicProcedure
      .meta({
        openrpc: {
          method: 'agents.removeTool',
          summary: 'Remove a tool from agents',
          description: 'Unregister a tool by name',
          tags: ['agents']
        }
      })
      .input(z.object({
        name: z.string()
      }))
      .mutation(async ({ input }) => {
        agentService.removeTool(input.name);
        return { success: true, message: `Tool '${input.name}' removed` };
      }),

    /**
     * List available tools
     */
    listTools: publicProcedure
      .meta({
        openrpc: {
          method: 'agents.listTools',
          summary: 'List available tools',
          description: 'Get list of all registered tools for agents',
          tags: ['agents']
        }
      })
      .input(z.object({
        sdk: z.enum(['ai-agent', 'openai']).optional()
      }).optional())
      .query(async ({ input }) => {
        const tools = agentService.getTools(input?.sdk);
        return {
          tools: tools.map(t => ({
            name: t.name,
            description: t.description,
            inputSchema: t.inputSchema
          })),
          count: tools.length
        };
      }),

    /**
     * Add a skill (AI Agent only)
     */
    addSkill: publicProcedure
      .meta({
        openrpc: {
          method: 'agents.addSkill',
          summary: 'Add a skill to AI Agent agent',
          description: 'Register a new skill following Claude\'s agent skills architecture (progressive disclosure model)',
          tags: ['agents', 'skills']
        }
      })
      .input(AgentSkillSchema)
      .mutation(async ({ input }) => {
        try {
          // Input is validated by Zod, so we can safely cast it to AgentSkill
          agentService.addSkill(input as AgentSkill);
          return { success: true, message: `Skill '${input.name}' added` };
        } catch (error) {
          return {
            success: false,
            message: error instanceof Error ? error.message : 'Failed to add skill'
          };
        }
      }),

    /**
     * Remove a skill (AI Agent only)
     */
    removeSkill: publicProcedure
      .meta({
        openrpc: {
          method: 'agents.removeSkill',
          summary: 'Remove a skill from AI Agent agent',
          description: 'Unregister a skill by ID',
          tags: ['agents', 'skills']
        }
      })
      .input(z.object({
        skillId: z.string()
      }))
      .mutation(async ({ input }) => {
        try {
          agentService.removeSkill(input.skillId);
          return { success: true, message: `Skill '${input.skillId}' removed` };
        } catch (error) {
          return {
            success: false,
            message: error instanceof Error ? error.message : 'Failed to remove skill'
          };
        }
      }),

    /**
     * List available skills (AI Agent only)
     */
    listSkills: publicProcedure
      .meta({
        openrpc: {
          method: 'agents.listSkills',
          summary: 'List available skills',
          description: 'Get list of all registered skills for AI Agent agent',
          tags: ['agents', 'skills']
        },
        ...createMCPTool({
          name: 'list-agent-skills',
          description: 'Get all available AI Agent agent skills with progressive disclosure metadata',
          category: 'agents'
        })
      })
      .input(z.object({}).optional())
      .query(async () => {
        const skills = agentService.getSkills();
        return {
          skills: skills.map(s => ({
            id: s.id,
            name: s.name,
            description: s.description,
            level: s.level,
            metadata: s.metadata
          })),
          count: skills.length
        };
      }),

    /**
     * Get skill details (AI Agent only)
     */
    getSkill: publicProcedure
      .meta({
        openrpc: {
          method: 'agents.getSkill',
          summary: 'Get skill details',
          description: 'Retrieve full details of a specific skill including instructions and resources',
          tags: ['agents', 'skills']
        }
      })
      .input(z.object({
        skillId: z.string()
      }))
      .query(async ({ input }) => {
        const skills = agentService.getSkills();
        const skill = skills.find(s => s.id === input.skillId);

        if (!skill) {
          throw new Error(`Skill '${input.skillId}' not found`);
        }

        return skill;
      }),

    /**
     * Check if SDK is available
     */
    isSDKAvailable: publicProcedure
      .meta({
        openrpc: {
          method: 'agents.isSDKAvailable',
          summary: 'Check SDK availability',
          description: 'Check if a specific agent SDK is available and initialized',
          tags: ['agents']
        }
      })
      .input(z.object({
        sdk: z.enum(['ai-agent', 'openai'])
      }))
      .query(async ({ input }) => {
        return {
          sdk: input.sdk,
          available: agentService.isSDKAvailable(input.sdk)
        };
      }),

    /**
     * Resume agent execution after user interaction
     */
    resume: publicProcedure
      .meta({
        openrpc: {
          method: 'agents.resume',
          summary: 'Resume agent execution after user interaction',
          description: 'Continue agent execution with user response from interaction dialog',
          tags: ['agents']
        }
      })
      .input(z.object({
        conversationId: z.string(),
        response: z.union([z.string(), z.array(z.string())])
      }))
      .mutation(async ({ input }) => {
        logger.info(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        logger.info(`🔄 RESUME: Starting conversation resume`);
        logger.info(`   Conversation ID: ${input.conversationId}`);
        logger.info(`   User response: "${input.response}"`);
        logger.info(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

        const state = conversationManager.get(input.conversationId);

        if (!state) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: `Conversation ${input.conversationId} not found or expired`
          });
        }

        if (!state.pendingInteraction) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `No pending interaction for conversation ${input.conversationId}`
          });
        }

        // Add user response to conversation with clear instruction
        const rawResponse = Array.isArray(input.response)
          ? input.response.join(', ')
          : input.response;

        const approvalKeywords = ['allow', 'yes', 'approved', 'approve', 'confirm', 'confirmed'];
        const alwaysKeywords = ["don't ask again", "don't ask", 'always', 'every time'];

        let parsedChoice: string | undefined;
        let parsedCustomResponse: string | undefined;

        const collectFromPayload = (payload: unknown): void => {
          if (!payload || typeof payload !== 'object') {
            return;
          }

          const value = payload as Record<string, unknown>;

          if (typeof value.choice === 'string') {
            parsedChoice = value.choice;
          } else if (typeof value.selection === 'string' && !parsedChoice) {
            parsedChoice = value.selection;
          }

          if (typeof value.customResponse === 'string') {
            parsedCustomResponse = value.customResponse;
          } else if (typeof value.custom_response === 'string') {
            parsedCustomResponse = value.custom_response;
          }

          if (value.json && typeof value.json === 'object') {
            collectFromPayload(value.json);
          }
        };

        if (typeof rawResponse === 'string') {
          const trimmed = rawResponse.trim();
          if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
            try {
              const parsed = JSON.parse(trimmed);
              collectFromPayload(parsed);
            } catch (error) {
              logger.debug('🔍 Failed to parse interaction response as JSON', { error });
            }
          }
        }

        const normalizedChoice = parsedChoice ? parsedChoice.toLowerCase() : '';
        const responseSources = [
          parsedChoice,
          parsedCustomResponse,
          typeof rawResponse === 'string' ? rawResponse : undefined
        ].filter((value): value is string => typeof value === 'string');

        let userApproved = approvalKeywords.some(keyword =>
          responseSources.some(source => source.toLowerCase().includes(keyword))
        );

        let rememberPermanently = alwaysKeywords.some(keyword =>
          normalizedChoice.includes(keyword) ||
          (!parsedChoice && responseSources.some(source => source.toLowerCase().includes(keyword)))
        );

        const isCustomResponse = normalizedChoice.includes('custom response');
        if (isCustomResponse) {
          // Custom responses should be handled by the AI rather than auto-executed
          userApproved = false;
          rememberPermanently = false;
        }

        const responseSummaryParts: string[] = [];
        if (parsedChoice) {
          responseSummaryParts.push(parsedChoice);
        }
        if (parsedCustomResponse) {
          responseSummaryParts.push(parsedCustomResponse);
        }

        const responseText = responseSummaryParts.length > 0
          ? responseSummaryParts.join(' — ')
          : typeof rawResponse === 'string'
            ? rawResponse
            : JSON.stringify(rawResponse);

        logger.info('📝 RESUME: Parsed approval response', {
          rawResponse,
          parsedChoice,
          parsedCustomResponse,
          userApproved,
          rememberPermanently
        });

        const pending = state.pendingInteraction;

        let operationTarget: string | undefined;
        let toolExecuted = false;
        let toolExecutionError: string | null = null;
        let toolExecutionOutput: string | null = null;

        // Resume execution with updated messages
        // Build skill tools but EXCLUDE user-interaction tools to prevent re-confirmation
        let skillTools: AgentTool[] = [];
        if (skillManager) {
          await skillManager.initialize();
          const converter = new SkillsToolConverter(skillManager);
          const allTools = converter.convertSkillsToTools();

          // Filter out user-interaction approval/confirmation tools since user has already approved
          skillTools = allTools.filter(tool =>
            !tool.name.startsWith('user_interaction_confirm') &&
            !tool.name.startsWith('user_interaction_approval_dialog')
          );

          logger.info(`🔄 Resuming with ${skillTools.length} tools (excluded user-interaction confirmation tools)`);

          if (pending && (userApproved || rememberPermanently)) {
            const toolArgsData: Record<string, any> = pending.toolArguments || pending.toolCall?.arguments || {};
            const scriptArgs = Array.isArray(pending.scriptArgs) && pending.scriptArgs.length > 0
              ? pending.scriptArgs
              : Array.isArray(toolArgsData?.args)
                ? toolArgsData.args.map((value: any) => String(value))
                : (() => {
                    const direct = toolArgsData['file-path'] ?? toolArgsData['filePath'] ?? toolArgsData['path'];
                    return typeof direct === 'string' ? [direct] : [];
                  })();

            const directTarget = toolArgsData['file-path'] ?? toolArgsData['filePath'] ?? toolArgsData['path'];
            if (typeof directTarget === 'string') {
              operationTarget = directTarget;
            }

            if (pending.skillId && pending.scriptName) {
              const rememberOptions = {
                skillId: pending.skillId,
                persist: rememberPermanently,
                applyToAllArgs: rememberPermanently
              };

              skillManager.bypassApprovalFor(
                pending.scriptName,
                scriptArgs,
                rememberOptions,
                userApproved
              );

              if (userApproved) {
                const originalToolName = pending.originalToolName || pending.toolName;
                if (originalToolName) {
                  const beforeCount = skillTools.length;
                  skillTools = skillTools.filter(tool => tool.name !== originalToolName);
                  const afterCount = skillTools.length;
                  logger.info(
                    `🚫 Removed tool '${originalToolName}' from resume context to prevent duplicate execution (${beforeCount}→${afterCount})`
                  );
                }

                logger.info(`🔁 Re-executing approved tool ${pending.scriptName} from skill ${pending.skillId}`);

                try {
                  const execResult = await skillManager.executeScript(pending.skillId, {
                    scriptName: pending.scriptName,
                    args: scriptArgs,
                    stdin: pending.stdin,
                    cwd: pending.cwd
                  });

                  toolExecuted = true;

                  if (execResult && typeof execResult === 'object' && (execResult as any).__interaction_required__) {
                    throw new Error('Tool execution still requires interaction after approval');
                  }

                  if (execResult.exitCode !== 0) {
                    toolExecutionError = (execResult.stderr || '').trim() || `Exit code ${execResult.exitCode}`;
                  } else {
                    const trimmedOutput = (execResult.stdout || '').trim();
                    if (trimmedOutput) {
                      toolExecutionOutput = trimmedOutput.length > 500
                        ? `${trimmedOutput.slice(0, 500)} …`
                        : trimmedOutput;
                    }
                  }
                } catch (error) {
                  toolExecutionError = error instanceof Error ? error.message : String(error);
                  logger.error(`❌ Failed to execute approved tool ${pending.scriptName}`, { error: toolExecutionError });
                }
              }
            } else {
              logger.warn('⚠️ Missing skillId or scriptName on pending interaction; cannot auto-execute tool.');
            }
          }
        }

        let resumePrompt: string;
        if (userApproved) {
          if (toolExecutionError) {
            const toolLabel = pending?.originalToolName || pending?.toolName || 'the requested tool';
            resumePrompt =
              `[SYSTEM] User approved the operation, but executing "${toolLabel}" failed with error: ${toolExecutionError}. ` +
              `Explain the failure to the user and suggest next steps.`;
          } else if (toolExecuted) {
            const toolLabel = pending?.originalToolName || pending?.toolName || 'the requested tool';
            const targetDetails = operationTarget ? ` for "${operationTarget}"` : '';
            const outputDetails = toolExecutionOutput ? `\nTool output:\n${toolExecutionOutput}` : '';
            resumePrompt =
              `[SYSTEM] User approved the operation. "${toolLabel}" executed successfully${targetDetails}.${outputDetails}\n` +
              `The operation is complete—do not invoke any additional tools. Provide a confirmation message to the user summarizing the success.`;
          } else {
            resumePrompt =
              `[SYSTEM] User approved the operation. Confirm to the user that you will proceed and describe the next steps.`;
          }
        } else {
            resumePrompt =
              `[SYSTEM] User responded with: "${responseText}". The pending operation was not executed. ` +
              `Acknowledge the response and offer alternatives if helpful.`;
        }

        // Pass the resume prompt as a NEW prompt (this will add it as a user message)
        // This ensures the AI sees it as the latest instruction
        const agentRequest: AgentExecuteRequest = {
          prompt: resumePrompt,
          messages: state.messages, // Previous conversation history
          model: state.model,
          provider: state.provider,
          systemPrompt: state.systemPrompt,
          sdk: 'ai-agent'
        };

        const result = await agentService.execute(agentRequest, skillTools);

        // Clear pending interaction
        conversationManager.resume(input.conversationId, input.response);

        // Check if another interaction is required
        if ((result as any).type === 'interaction_required') {
          logger.info(`🔔 Another interaction required in conversation ${input.conversationId}`);

          conversationManager.pause(
            input.conversationId,
            (result as any).interaction,
            { name: (result as any).toolName, arguments: (result as any).toolArguments || {} },
            (result as any).originalToolName,
            {
              skillId: (result as any).skillId,
              scriptName: (result as any).scriptName,
              scriptArgs: (result as any).scriptArgs,
              stdin: (result as any).stdin,
              cwd: (result as any).cwd,
              toolArguments: (result as any).toolArguments || {}
            }
          );

          return {
            conversationId: input.conversationId,
            type: 'interaction_required',
            interaction: (result as any).interaction,
            toolName: (result as any).toolName,
            partialContent: (result as any).partialContent || '',
            usage: (result as any).usage
          };
        }

        // Normal completion
        if (result.content) {
          conversationManager.addMessage(input.conversationId, {
            role: 'assistant',
            content: result.content
          });
        }

        return {
          conversationId: input.conversationId,
          type: 'completed',
          ...result
        };
      })
  });
}

// Default agent router (will be configured in server initialization)
export let agentRouter: ReturnType<typeof createAgentRouter> | null = null;

// Function to set the agent router after service is initialized
export function setAgentRouter(service: AgentService, config?: AgentConfig) {
  agentRouter = createAgentRouter({ agentService: service, agentConfig: config });
}

export type AgentRouterType = ReturnType<typeof createAgentRouter>;
