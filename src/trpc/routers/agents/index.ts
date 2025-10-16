/**
 * Agents Router - Agent functionality via tRPC
 *
 * Provides access to Claude Code SDK and OpenAI Agents SDK through tRPC
 */

import { z } from 'zod';
import { router, publicProcedure } from '@src-trpc/index';
import { AgentService } from '@services/agents/agent-service';
import {
  AgentExecuteRequestSchema,
  AgentSkillSchema,
  AgentToolSchema,
  AgentConfig
} from '@services/agents/types';
import { createMCPTool } from '@src-trpc/routers/mcp/index';

export interface AgentRouterConfig {
  agentService?: AgentService;
  agentConfig?: AgentConfig;
}

export function createAgentRouter(config: AgentRouterConfig = {}): ReturnType<typeof router> {
  const { agentService } = config;

  if (!agentService) {
    throw new Error('AgentService is required for agent router');
  }

  return router({
    /**
     * Execute an agent request
     */
    execute: publicProcedure
      .meta({
        openrpc: {
          method: 'agents.execute',
          summary: 'Execute an agent request',
          description: 'Run an agent with specified SDK (claude-code or openai) and get AI-powered response with skills/tools support',
          tags: ['agents']
        },
        mcp: createMCPTool({
          title: 'Execute Agent',
          description: 'Execute an AI agent request with SDK selection and skills support',
          category: 'agents'
        })
      })
      .input(AgentExecuteRequestSchema)
      .mutation(async ({ input }) => {
        return await agentService.execute(input);
      }),

    /**
     * List available SDKs
     */
    listSDKs: publicProcedure
      .meta({
        openrpc: {
          method: 'agents.listSDKs',
          summary: 'List available agent SDKs',
          description: 'Get list of available agent SDKs (claude-code, openai)',
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
      .input(AgentToolSchema.extend({
        execute: z.function().optional() // Can't serialize functions, so we make it optional in schema
      }))
      .mutation(async ({ input }) => {
        // Note: For actual tool execution, you'd need to provide the execute function
        // This is a limitation of tRPC - functions can't be serialized
        // In practice, tools should be registered server-side
        agentService.addTool(input as any);
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
        sdk: z.enum(['claude-code', 'openai']).optional()
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
     * Add a skill (Claude Code only)
     */
    addSkill: publicProcedure
      .meta({
        openrpc: {
          method: 'agents.addSkill',
          summary: 'Add a skill to Claude Code agent',
          description: 'Register a new skill following Claude\'s agent skills architecture (progressive disclosure model)',
          tags: ['agents', 'skills']
        }
      })
      .input(AgentSkillSchema)
      .mutation(async ({ input }) => {
        try {
          agentService.addSkill(input);
          return { success: true, message: `Skill '${input.name}' added` };
        } catch (error) {
          return {
            success: false,
            message: error instanceof Error ? error.message : 'Failed to add skill'
          };
        }
      }),

    /**
     * Remove a skill (Claude Code only)
     */
    removeSkill: publicProcedure
      .meta({
        openrpc: {
          method: 'agents.removeSkill',
          summary: 'Remove a skill from Claude Code agent',
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
     * List available skills (Claude Code only)
     */
    listSkills: publicProcedure
      .meta({
        openrpc: {
          method: 'agents.listSkills',
          summary: 'List available skills',
          description: 'Get list of all registered skills for Claude Code agent',
          tags: ['agents', 'skills']
        },
        mcp: createMCPTool({
          title: 'List Agent Skills',
          description: 'Get all available Claude Code agent skills with progressive disclosure metadata',
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
     * Get skill details (Claude Code only)
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
        sdk: z.enum(['claude-code', 'openai'])
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
