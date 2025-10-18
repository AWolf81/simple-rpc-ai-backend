/**
 * Skill Manager
 *
 * High-level interface for managing skills: loading, matching, execution, and validation.
 */

import {
  Skill,
  SkillSource,
  SkillLoaderConfig,
  SkillMatchCriteria,
  SkillValidationResult,
  ScriptExecutionRequest,
  ScriptExecutionResult,
  TokenMetrics
} from './types.js';
import { SkillLoader } from './loader.js';
import { ScriptSandbox, DEFAULT_SANDBOX_CONFIG } from './sandbox.js';
import { validateSkillStructure, estimateTokens } from './parser.js';
import { logger } from '../../../utils/logger.js';

/**
 * Skill Manager - Central interface for skills system
 */
export class SkillManager {
  private loader: SkillLoader;
  private sandbox: ScriptSandbox;
  private skills = new Map<string, Skill>();

  constructor(config: SkillLoaderConfig) {
    this.loader = new SkillLoader(config);
    this.sandbox = new ScriptSandbox(config.sandbox);
  }

  /**
   * Initialize and load all skills
   */
  async initialize(): Promise<void> {
    logger.info('🚀 Initializing skill system...');

    try {
      const skills = await this.loader.loadAll();

      // Store skills in map
      skills.forEach(skill => {
        this.skills.set(skill.id, skill);
      });

      logger.info(`✅ Skill system initialized with ${skills.length} skills`);
    } catch (error) {
      logger.error('❌ Failed to initialize skill system:', error);
      throw error;
    }
  }

  /**
   * Get all loaded skills
   */
  getAll(): Skill[] {
    return Array.from(this.skills.values());
  }

  /**
   * Get skill by ID
   */
  get(skillId: string): Skill | undefined {
    return this.skills.get(skillId);
  }

  /**
   * Match skills based on criteria
   */
  match(criteria: SkillMatchCriteria): Skill[] {
    let matches = Array.from(this.skills.values());

    // Filter by capabilities
    if (criteria.capabilities && criteria.capabilities.length > 0) {
      matches = matches.filter(skill =>
        criteria.capabilities!.some(cap =>
          skill.metadata.capabilities?.includes(cap)
        )
      );
    }

    // Filter by keywords
    if (criteria.keywords && criteria.keywords.length > 0) {
      matches = matches.filter(skill =>
        criteria.keywords!.some(keyword => {
          const searchText = `${skill.metadata.name} ${skill.metadata.description}`.toLowerCase();
          return searchText.includes(keyword.toLowerCase());
        })
      );
    }

    // Exclude specific skills
    if (criteria.exclude && criteria.exclude.length > 0) {
      matches = matches.filter(skill =>
        !criteria.exclude!.includes(skill.id)
      );
    }

    return matches;
  }

  /**
   * Load Level 3 resources for a skill
   */
  async loadResources(skillId: string): Promise<void> {
    const skill = this.skills.get(skillId);

    if (!skill) {
      throw new Error(`Skill not found: ${skillId}`);
    }

    if (skill.resources) {
      logger.debug(`📚 Resources already loaded for skill: ${skillId}`);
      return;
    }

    await this.loader.loadResources(skill);
    logger.debug(`📚 Loaded Level 3 resources for skill: ${skillId}`);
  }

  /**
   * Execute a script from a skill
   */
  async executeScript(
    skillId: string,
    request: Omit<ScriptExecutionRequest, 'scriptPath' | 'runtime'> & { scriptName: string }
  ): Promise<ScriptExecutionResult> {
    const skill = this.skills.get(skillId);

    if (!skill) {
      throw new Error(`Skill not found: ${skillId}`);
    }

    // Resolve script path
    const scriptPath = this.resolveScriptPath(skill, request.scriptName);

    // Validate script exists in metadata
    const scriptMeta = skill.metadata.scripts?.find(s => s.path.endsWith(request.scriptName));

    if (!scriptMeta) {
      throw new Error(`Script not found in skill metadata: ${request.scriptName}`);
    }

    // Execute script
    const result = await this.sandbox.execute({
      scriptPath,
      runtime: scriptMeta.runtime,
      args: request.args,
      stdin: request.stdin,
      cwd: request.cwd,
      sandbox: request.sandbox
    });

    logger.debug(`📜 Executed script ${request.scriptName} from skill ${skillId}: exit ${result.exitCode}`);

    return result;
  }

  /**
   * Validate a skill
   */
  async validate(skillId: string): Promise<SkillValidationResult> {
    const skill = this.skills.get(skillId);

    if (!skill) {
      throw new Error(`Skill not found: ${skillId}`);
    }

    const errors: string[] = [];
    const warnings: string[] = [];
    const recommendations: string[] = [];

    // Validate structure and token limits
    const structureValidation = validateSkillStructure(
      {
        metadata: skill.metadata,
        instructions: skill.instructions || '',
        rawFrontmatter: JSON.stringify(skill.metadata),
        rawContent: skill.instructions || ''
      },
      {
        maxLevel1Tokens: 100,
        maxLevel2Tokens: 5000
      }
    );

    errors.push(...structureValidation.errors);
    warnings.push(...structureValidation.warnings);

    // Validate scripts
    const scriptValidations = await this.validateScripts(skill);

    // Get metrics
    const level1Tokens = skill.level1Tokens;
    const level2Tokens = skill.level2Tokens || 0;

    // Load resources to count Level 3 files
    let level3Files = 0;
    if (!skill.resources) {
      try {
        await this.loadResources(skillId);
      } catch (error) {
        warnings.push(`Could not load Level 3 resources: ${error}`);
      }
    }

    if (skill.resources) {
      level3Files =
        skill.resources.references.size +
        skill.resources.scripts.size +
        skill.resources.commands.size +
        skill.resources.templates.size +
        skill.resources.examples.size +
        skill.resources.other.size;
    }

    // Generate recommendations
    if (level2Tokens > 4000) {
      recommendations.push('Consider moving detailed content to references/ directory');
    }

    if (level3Files > 20) {
      recommendations.push('Consider organizing Level 3 resources into subdirectories');
    }

    if (!skill.metadata.version) {
      recommendations.push('Add version field to track skill changes');
    }

    if (!skill.metadata.license) {
      recommendations.push('Add license field for legal clarity');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      metrics: {
        level1Tokens,
        level2Tokens,
        level3Files,
        scripts: scriptValidations
      },
      recommendations
    };
  }

  /**
   * Get token metrics for a skill
   */
  async getMetrics(skillId: string): Promise<TokenMetrics> {
    const skill = this.skills.get(skillId);

    if (!skill) {
      throw new Error(`Skill not found: ${skillId}`);
    }

    // Load resources if needed
    if (!skill.resources) {
      await this.loadResources(skillId);
    }

    const breakdown = {
      metadata: skill.level1Tokens,
      instructions: skill.level2Tokens || 0,
      references: 0,
      scripts: 0,
      other: 0
    };

    if (skill.resources) {
      // Calculate resource tokens
      for (const content of skill.resources.references.values()) {
        breakdown.references += estimateTokens(content);
      }

      for (const content of skill.resources.scripts.values()) {
        breakdown.scripts += estimateTokens(content);
      }

      for (const content of skill.resources.other.values()) {
        breakdown.other += estimateTokens(content);
      }
    }

    const level3 = breakdown.references + breakdown.scripts + breakdown.other;
    const total = breakdown.metadata + breakdown.instructions + level3;

    return {
      skill: skillId,
      level1: breakdown.metadata,
      level2: breakdown.instructions,
      level3,
      total,
      breakdown
    };
  }

  /**
   * Reload a specific skill
   */
  async reload(skillId: string): Promise<void> {
    const skill = this.skills.get(skillId);

    if (!skill) {
      throw new Error(`Skill not found: ${skillId}`);
    }

    logger.debug(`♻️  Reloading skill: ${skillId}`);

    // Reload from source
    const reloaded = await this.loader.load(skill.source);

    // Update in map
    this.skills.set(skillId, reloaded);

    logger.debug(`✅ Reloaded skill: ${skillId}`);
  }

  /**
   * Reload all skills
   */
  async reloadAll(): Promise<void> {
    logger.info('♻️  Reloading all skills...');

    // Clear cache
    this.loader.clearCache();
    this.skills.clear();

    // Reload
    await this.initialize();
  }

  /**
   * Add a new skill source and load it
   */
  async addSource(source: SkillSource): Promise<Skill> {
    const skill = await this.loader.load(source);
    this.skills.set(skill.id, skill);

    logger.info(`➕ Added skill: ${skill.id}`);

    return skill;
  }

  /**
   * Remove a skill
   */
  remove(skillId: string): boolean {
    const removed = this.skills.delete(skillId);

    if (removed) {
      logger.info(`➖ Removed skill: ${skillId}`);
    }

    return removed;
  }

  /**
   * Get skill statistics
   */
  getStats(): {
    totalSkills: number;
    bySource: Record<string, number>;
    totalLevel1Tokens: number;
    totalLevel2Tokens: number;
  } {
    const bySource: Record<string, number> = {};
    let totalLevel1Tokens = 0;
    let totalLevel2Tokens = 0;

    for (const skill of this.skills.values()) {
      const sourceType = skill.source.type;
      bySource[sourceType] = (bySource[sourceType] || 0) + 1;

      totalLevel1Tokens += skill.level1Tokens;
      totalLevel2Tokens += skill.level2Tokens || 0;
    }

    return {
      totalSkills: this.skills.size,
      bySource,
      totalLevel1Tokens,
      totalLevel2Tokens
    };
  }

  /**
   * Validate scripts in a skill
   */
  private async validateScripts(skill: Skill): Promise<Array<{
    path: string;
    runtime: string;
    safe: boolean;
    issues?: string[];
    allowedPaths?: string[];
    timeout?: number;
  }>> {
    if (!skill.metadata.scripts) {
      return [];
    }

    const validations = await Promise.all(
      skill.metadata.scripts.map(async script => {
        const scriptPath = this.resolveScriptPath(skill, script.path);

        const validation = await this.sandbox.validateScriptSecurity(
          scriptPath,
          script.runtime
        );

        return {
          path: script.path,
          runtime: script.runtime,
          safe: validation.safe,
          issues: validation.issues,
          allowedPaths: script.allowedPaths || skill.metadata.allowedPaths,
          timeout: script.timeout
        };
      })
    );

    return validations;
  }

  /**
   * Resolve script path from skill
   */
  private resolveScriptPath(skill: Skill, scriptName: string): string {
    const path = require('path');
    return path.join(skill.basePath, scriptName);
  }
}
