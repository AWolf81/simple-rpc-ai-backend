/**
 * Agents Router - Agent functionality via tRPC
 *
 * Provides access to AI Agent SDK and OpenAI Agents SDK through tRPC
 */

import { z } from 'zod';
import { router, publicProcedure } from '@src-trpc/index';
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
      .input(AgentExecuteRequestSchema)
      .mutation(async ({ input }) => {
        // Convert skills to executable tools
        let skillTools: any[] = [];

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

        // Pass skill tools to agent execution via aiService.execute
        return await agentService.execute(agentRequest, skillTools);
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
