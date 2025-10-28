/**
 * Skills tRPC Router
 *
 * Provides endpoints for skill management, validation, and metrics.
 */

import { z } from 'zod';
import { router, publicProcedure } from '../../index';
import type { SkillManager } from '../../../services/agents/skills/manager';
import { logger } from '../../../utils/logger';

// Zod schemas for skill operations
const skillSourceSchema = z.union([
  z.object({
    type: z.literal('builtin'),
    name: z.string()
  }),
  z.object({
    type: z.literal('github'),
    url: z.string().url(),
    path: z.string().optional(),
    ref: z.string().optional()
  }),
  z.object({
    type: z.literal('npm'),
    package: z.string(),
    version: z.string().optional(),
    path: z.string().optional()
  }),
  z.object({
    type: z.literal('local'),
    path: z.string()
  }),
  z.object({
    type: z.literal('url'),
    url: z.string().url()
  }),
  z.object({
    type: z.literal('zip'),
    path: z.string(),
    autoExtract: z.boolean().optional()
  })
]);

const skillMatchCriteriaSchema = z.object({
  capabilities: z.array(z.string()).optional(),
  keywords: z.array(z.string()).optional(),
  exclude: z.array(z.string()).optional()
});

const scriptInvocationSchema = z.union([
  z.object({
    mode: z.literal('path'),
    scriptPath: z.string(),
    runtime: z.enum(['javascript', 'typescript', 'python']).optional(),
    args: z.array(z.string()).optional()
  }),
  z.object({
    mode: z.literal('inline'),
    runtime: z.enum(['javascript', 'typescript', 'python']),
    source: z.string(),
    args: z.array(z.string()).optional()
  })
]);

const SCRIPT_CALLER_RUNNER = 'scripts/run-script.ts';

/**
 * Create skills router with SkillManager instance
 */
export function createSkillsRouter(skillManager?: SkillManager) {
  return router({
    /**
     * List all loaded skills
     * Note: input accepts any because superjson client sends metadata even for empty queries
     */
    list: publicProcedure
      .input(z.any().optional())
      .query(async () => {
        if (!skillManager) {
          return { skills: [], message: 'Skills system not initialized' };
        }

        await skillManager.initialize();

        const skills = skillManager.getAll();

        return {
          skills: skills.map(skill => {
            const skillData: any = {
              id: skill.id,
              name: skill.metadata.name,
              description: skill.metadata.description,
              version: skill.metadata.version,
              author: skill.metadata.author,
              capabilities: skill.metadata.capabilities,
              instructions: skill.instructions, // Include SKILL.md body for agent context
              level: (skill.resources ? 3 : (skill.instructions ? 2 : 1)) as 1 | 2 | 3,
              level1Tokens: skill.level1Tokens,
              level2Tokens: skill.level2Tokens,
              hasResources: !!skill.resources,
              sourceType: skill.source.type,
              loadedAt: skill.loadedAt?.toISOString() || new Date().toISOString()
            };

            // Only include license if it has a value (avoid null/undefined issues with superjson)
            if (skill.metadata.license) {
              skillData.license = skill.metadata.license;
            }

            return skillData;
          })
        };
      }),

    /**
     * Get skill by ID
     */
    get: publicProcedure
      .input(z.object({
        skillId: z.string()
      }))
      .query(async ({ input }) => {
        if (!skillManager) {
          throw new Error('Skills system not initialized');
        }

        await skillManager.initialize();

        const skill = skillManager.get(input.skillId);

        if (!skill) {
          throw new Error(`Skill not found: ${input.skillId}`);
        }

        return {
          id: skill.id,
          metadata: skill.metadata,
          instructions: skill.instructions,
          level1Tokens: skill.level1Tokens,
          level2Tokens: skill.level2Tokens,
          hasResources: !!skill.resources,
          source: skill.source,
          basePath: skill.basePath,
          loadedAt: skill.loadedAt,
          lastAccessed: skill.lastAccessed
        };
      }),

    /**
     * Match skills by criteria
     */
    match: publicProcedure
      .input(skillMatchCriteriaSchema)
      .query(async ({ input }) => {
        if (!skillManager) {
          return { skills: [] };
        }

        await skillManager.initialize();

        const matches = skillManager.match(input);

        return {
          skills: matches.map(skill => ({
            id: skill.id,
            name: skill.metadata.name,
            description: skill.metadata.description,
            capabilities: skill.metadata.capabilities,
            level1Tokens: skill.level1Tokens
          }))
        };
      }),

    /**
     * Load Level 3 resources for a skill
     */
    loadResources: publicProcedure
      .input(z.object({
        skillId: z.string()
      }))
      .mutation(async ({ input }) => {
        if (!skillManager) {
          throw new Error('Skills system not initialized');
        }

        await skillManager.initialize();

        await skillManager.loadResources(input.skillId);

        const skill = skillManager.get(input.skillId);

        return {
          success: true,
          resourceCounts: {
            references: skill?.resources?.references.size || 0,
            scripts: skill?.resources?.scripts.size || 0,
            commands: skill?.resources?.commands.size || 0,
            templates: skill?.resources?.templates.size || 0,
            examples: skill?.resources?.examples.size || 0,
            other: skill?.resources?.other.size || 0
          }
        };
      }),

    /**
     * Execute a script from a skill
     */
    executeScript: publicProcedure
      .input(z.object({
        skillId: z.string(),
        scriptName: z.string().optional(),
        args: z.array(z.string()).optional(),
        stdin: z.string().optional(),
        cwd: z.string().optional(),
        scriptInvocation: scriptInvocationSchema.optional()
      }))
      .mutation(async ({ input }) => {
        if (!skillManager) {
          throw new Error('Skills system not initialized');
        }

        await skillManager.initialize();

        let scriptName = input.scriptName;
        let args = input.args;
        let stdin = input.stdin;

        if (input.skillId === 'script-caller') {
          if (!input.scriptInvocation) {
            throw new Error('scriptInvocation is required when using the script-caller skill');
          }

          scriptName = SCRIPT_CALLER_RUNNER;
          args = [];
          stdin = JSON.stringify(input.scriptInvocation);
        }

        if (!scriptName) {
          throw new Error('scriptName is required for script execution');
        }

        const result = await skillManager.executeScript(input.skillId, {
          scriptName,
          args,
          stdin,
          cwd: input.cwd
        });

        return {
          exitCode: result.exitCode,
          stdout: result.stdout,
          stderr: result.stderr,
          duration: result.duration,
          timedOut: result.timedOut,
          error: result.error
        };
      }),

    /**
     * Validate a skill
     */
    validate: publicProcedure
      .input(z.object({
        skillId: z.string()
      }))
      .query(async ({ input }) => {
        if (!skillManager) {
          throw new Error('Skills system not initialized');
        }

        await skillManager.initialize();

        const validation = await skillManager.validate(input.skillId);

        return validation;
      }),

    /**
     * Get token metrics for a skill
     */
    metrics: publicProcedure
      .input(z.object({
        skillId: z.string()
      }))
      .query(async ({ input }) => {
        if (!skillManager) {
          throw new Error('Skills system not initialized');
        }

        await skillManager.initialize();

        const metrics = await skillManager.getMetrics(input.skillId);

        return metrics;
      }),

    /**
     * Reload a specific skill
     */
    reload: publicProcedure
      .input(z.object({
        skillId: z.string()
      }))
      .mutation(async ({ input }) => {
        if (!skillManager) {
          throw new Error('Skills system not initialized');
        }

        await skillManager.initialize();

        await skillManager.reload(input.skillId);

        return { success: true, message: `Skill ${input.skillId} reloaded` };
      }),

    /**
     * Reload all skills
     */
    reloadAll: publicProcedure
      .mutation(async () => {
        if (!skillManager) {
          throw new Error('Skills system not initialized');
        }

        await skillManager.initialize();

        await skillManager.reloadAll();

        return { success: true, message: 'All skills reloaded' };
      }),

    /**
     * Add a new skill source and load it
     */
    addSource: publicProcedure
      .input(z.object({
        source: skillSourceSchema
      }))
      .mutation(async ({ input }) => {
        if (!skillManager) {
          throw new Error('Skills system not initialized');
        }

        await skillManager.initialize();

        const skill = await skillManager.addSource(input.source as any);

        return {
          success: true,
          skill: {
            id: skill.id,
            name: skill.metadata.name,
            description: skill.metadata.description
          }
        };
      }),

    /**
     * Remove a skill
     */
    remove: publicProcedure
      .input(z.object({
        skillId: z.string()
      }))
      .mutation(async ({ input }) => {
        if (!skillManager) {
          throw new Error('Skills system not initialized');
        }

        await skillManager.initialize();

        const removed = skillManager.remove(input.skillId);

        return {
          success: removed,
          message: removed ? `Skill ${input.skillId} removed` : `Skill ${input.skillId} not found`
        };
      }),

    /**
     * Get skill system statistics
     */
    stats: publicProcedure
      .query(async () => {
        if (!skillManager) {
          return {
            totalSkills: 0,
            bySource: {},
            totalLevel1Tokens: 0,
            totalLevel2Tokens: 0
          };
        }

        await skillManager.initialize();

        return skillManager.getStats();
      })
  });
}

export type SkillsRouter = ReturnType<typeof createSkillsRouter>;
