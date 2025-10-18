/**
 * Skills tRPC Router
 *
 * Provides endpoints for skill management, validation, and metrics.
 */

import { z } from 'zod';
import { router, publicProcedure } from '../../index.js';
import type { SkillManager } from '../../../services/agents/skills/manager.js';
import { logger } from '../../../utils/logger.js';

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

/**
 * Create skills router with SkillManager instance
 */
export function createSkillsRouter(skillManager?: SkillManager) {
  return router({
    /**
     * List all loaded skills
     */
    list: publicProcedure
      .query(async () => {
        if (!skillManager) {
          return { skills: [], message: 'Skills system not initialized' };
        }

        const skills = skillManager.getAll();

        return {
          skills: skills.map(skill => ({
            id: skill.id,
            name: skill.metadata.name,
            description: skill.metadata.description,
            version: skill.metadata.version,
            author: skill.metadata.author,
            license: skill.metadata.license,
            capabilities: skill.metadata.capabilities,
            level1Tokens: skill.level1Tokens,
            level2Tokens: skill.level2Tokens,
            hasResources: !!skill.resources,
            sourceType: skill.source.type,
            loadedAt: skill.loadedAt
          }))
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
        scriptName: z.string(),
        args: z.array(z.string()).optional(),
        stdin: z.string().optional(),
        cwd: z.string().optional()
      }))
      .mutation(async ({ input }) => {
        if (!skillManager) {
          throw new Error('Skills system not initialized');
        }

        const result = await skillManager.executeScript(input.skillId, {
          scriptName: input.scriptName,
          args: input.args,
          stdin: input.stdin,
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

        return skillManager.getStats();
      })
  });
}

export type SkillsRouter = ReturnType<typeof createSkillsRouter>;
