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
  TokenMetrics,
  SandboxConfig,
  ScriptSafetyConfig
} from './types';
import { SkillLoader } from './loader';
import { ScriptSandbox, DEFAULT_SANDBOX_CONFIG } from './sandbox';
import { SandboxProviderFactory, type ISandboxProvider, type SandboxProviderConfig } from './sandbox-provider';
import { validateSkillStructure, estimateTokens } from './parser';
import { SafetyValidator } from './utils/safety-validator';
import { ApprovalManager } from './utils/approval-manager';
import { PermissionAllowlist } from './utils/permission-allowlist';
import { _setGlobalSkillManager } from './utils/interactive-approval-callback';
import { logger } from '../../../utils/logger';
import path from 'path';

/**
 * Skill Manager - Central interface for skills system
 */
export class SkillManager {
  private loader: SkillLoader;
  private sandbox: ScriptSandbox; // Legacy support
  private sandboxProvider?: ISandboxProvider; // New pluggable sandbox
  private skills = new Map<string, Skill>();
  private config: SkillLoaderConfig;
  private initializationPromise?: Promise<void>; // Track initialization promise
  private initialized = false; // Track if initialization is complete
  private approvalManager?: ApprovalManager; // Approval and permission system
  private recentExecutions = new Map<string, { timestamp: number; result: ScriptExecutionResult }>();
  private static readonly DUPLICATE_EXECUTION_WINDOW_MS = 2000;

  constructor(config: SkillLoaderConfig) {
    this.config = config;
    this.loader = new SkillLoader(config);
    this.sandbox = new ScriptSandbox(config.sandbox); // Legacy fallback

    // Initialize approval system if configured
    if (config.permissions || config.approvalCallback) {
      this.approvalManager = new ApprovalManager(
        config.permissions,
        config.approvalCallback
      );
    }
  }

  /**
   * Initialize and load all skills
   */
  async initialize(): Promise<void> {
    // If already initializing, return existing promise
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    // If already initialized, return immediately
    if (this.initialized) {
      return Promise.resolve();
    }

    // Create and store initialization promise
    this.initializationPromise = this._doInitialize();

    try {
      await this.initializationPromise;
      this.initialized = true;

      // Set global skill manager reference for interactive approval callbacks
      _setGlobalSkillManager(this);
    } finally {
      // Don't clear the promise so multiple calls return the same promise
    }
  }

  /**
   * Internal initialization logic
   */
  private async _doInitialize(): Promise<void> {
    logger.info('🚀 Initializing skill system...');

    try {
      // Initialize sandbox provider if configured
      // TODO: Add sandboxProvider to SkillLoaderConfig type
      // @ts-ignore - sandboxProvider not yet in type definition
      if (this.config.sandboxProvider) {
        try {
          // @ts-ignore
          this.sandboxProvider = await SandboxProviderFactory.create(this.config.sandboxProvider);
          await this.sandboxProvider.initialize(this.config.sandbox || DEFAULT_SANDBOX_CONFIG);
          logger.info(`🔧 Using ${this.sandboxProvider.name} sandbox provider`);
        } catch (error) {
          logger.warn(`⚠️  Failed to initialize sandbox provider, falling back to legacy sandbox:`, error);
        }
      }

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
   *
   * Note: If called before initialization completes, returns empty array.
   * Always call initialize() and await it before using getAll().
   */
  getAll(): Skill[] {
    if (!this.initialized && this.initializationPromise) {
      logger.warn('⚠️  getAll() called before skills initialization completed. Returning empty array. Make sure to await initialize() before calling getAll().');
      return [];
    }
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

    // Validate script exists in metadata
    const scriptMeta = skill.metadata.scripts?.find(s => s.path.endsWith(request.scriptName));

    if (!scriptMeta) {
      throw new Error(`Script not found in skill metadata: ${request.scriptName}`);
    }

    // SAFETY VALIDATION
    const safetyConfig: ScriptSafetyConfig | undefined = scriptMeta.safety ||
      (scriptMeta.requiresApproval ? { level: 'medium', requiresApproval: true } : undefined);

    const safetyValidation = SafetyValidator.validate(
      request.scriptName,
      request.args || [],
      safetyConfig,
      skill.metadata.safetyChecks
    );

    // Check if blocked by safety validator
    if (safetyValidation.blocked) {
      logger.error(`🚫 Script execution blocked: ${request.scriptName}`, {
        reason: safetyValidation.reason
      });
      throw new Error(safetyValidation.reason || 'Script execution blocked by safety validator');
    }

    const executionSignature = this.buildExecutionSignature(
      skillId,
      request.scriptName,
      request.args,
      request.stdin,
      request.cwd
    );
    const cachedExecution = this.recentExecutions.get(executionSignature);
    const now = Date.now();
    if (
      cachedExecution &&
      now - cachedExecution.timestamp < SkillManager.DUPLICATE_EXECUTION_WINDOW_MS
    ) {
      logger.info(`♻️  Reusing cached result for ${request.scriptName}`, {
        skillId,
        args: request.args
      });
      return { ...cachedExecution.result };
    }

    // Request approval if needed
    if (safetyValidation.requiresApproval || skill.metadata.requiresApproval) {
      console.error(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.error(`[SKILL MANAGER] Approval required for: ${request.scriptName}`);
      console.error(`[SKILL MANAGER] Has approvalManager: ${!!this.approvalManager}`);

      if (this.approvalManager) {
        console.error(`[SKILL MANAGER] Calling approvalManager.requestSkillExecutionApproval...`);

        try {
          console.error(`[SKILL MANAGER] About to call requestSkillExecutionApproval`);
          const approved = await this.approvalManager.requestSkillExecutionApproval(
            request.scriptName,
            request.args || [],
            safetyValidation,
            request.cwd,
            request.conversationId,  // Pass conversation ID for approval tracking
            skill.id
          );
          console.error(`[SKILL MANAGER] requestSkillExecutionApproval returned:`, approved);

          if (!approved) {
            logger.warn(`❌ Script execution denied by user: ${request.scriptName}`);
            throw new Error(`Script execution denied: ${request.scriptName}`);
          }

          logger.info(`✅ Script execution approved: ${request.scriptName}`);
        } catch (error: any) {
          console.error(`[SKILL MANAGER] ❗ Caught error from approval!`);
          console.error(`[SKILL MANAGER] Error:`, error);
          console.error(`[SKILL MANAGER] Error type: ${typeof error}`);
          console.error(`[SKILL MANAGER] Has __interaction_required__:`, error?.__interaction_required__);
          console.error(`[SKILL MANAGER] Error keys:`, error ? Object.keys(error) : 'null');

          // Check if this is an interaction marker being thrown up
          if (error && typeof error === 'object' && error.__interaction_required__) {
            console.error(`[SKILL MANAGER] ✅ Interaction marker caught from approval - returning as result`);
            // Return the interaction marker as the script result
            // Add the original tool name so conversation state can track what was approved
            // This will be detected by AIService and trigger the interaction flow
            return {
              ...error,
              originalToolName: `${skillId}_${request.scriptName.replace('scripts/', '').replace('.ts', '')}`
            };
          }
          console.error(`[SKILL MANAGER] ❌ NOT an interaction marker - re-throwing`);
          // Otherwise re-throw the error
          throw error;
        }
      } else {
        // No approval manager configured but approval required
        console.error(`[SKILL MANAGER] ERROR: No approval manager but approval required!`);
        throw new Error(
          `Approval required for "${request.scriptName}" but no approval system configured.\n` +
          SafetyValidator.formatApprovalPrompt(
            request.scriptName,
            request.args || [],
            safetyValidation,
            request.cwd
          )
        );
      }
    }

    const allowedPaths = this.mergePathLists(
      this.config.sandbox?.allowedPaths || DEFAULT_SANDBOX_CONFIG.allowedPaths,
      skill.metadata.allowedPaths,
      scriptMeta.allowedPaths,
      request.sandbox?.allowedPaths
    );

    const scriptPath = this.resolveScriptPath(skill, request.scriptName, allowedPaths);
    const sandboxOverrides = this.buildSandboxOverrides(allowedPaths, request.sandbox);

    // Execute script
    const executionId = `${request.scriptName}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    logger.info(`[SKILL EXEC] Starting ${request.scriptName}`, {
      executionId,
      skillId,
      args: request.args
    });

    const result = await this.sandbox.execute({
      scriptPath,
      runtime: scriptMeta.runtime,
      args: request.args,
      stdin: request.stdin,
      cwd: request.cwd,
      sandbox: sandboxOverrides
    });

    logger.info(`[SKILL EXEC] Finished ${request.scriptName}`, {
      executionId,
      skillId,
      exitCode: result.exitCode
    });

    logger.debug(`📜 Executed script ${request.scriptName} from skill ${skillId}: exit ${result.exitCode}`);

    const completedAt = Date.now();
    this.recentExecutions.set(executionSignature, {
      timestamp: completedAt,
      result
    });
    this.pruneRecentExecutions(completedAt);

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
   * Temporarily bypass approval for a specific operation
   * Used when resuming after user approval to prevent re-asking
   */
  bypassApprovalFor(
    scriptName: string,
    args: string[],
    options?: {
      skillId?: string;
      persist?: boolean;
      expiresInMs?: number;
      applyToAllArgs?: boolean;
    },
    approved: boolean = true
  ): void {
    if (!this.approvalManager) {
      logger.warn('⚠️  Cannot bypass approval - no approval manager configured');
      return;
    }

    // Remember user decision so subsequent executions respect it
    this.approvalManager.rememberChoice(scriptName, args, approved, options);
    logger.info(
      `${approved ? '✅' : '🚫'} Temporarily bypassed approval for: ${scriptName} ${args.join(' ')}`,
      { approved }
    );
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
        const allowedPaths = this.mergePathLists(
          this.config.sandbox?.allowedPaths || DEFAULT_SANDBOX_CONFIG.allowedPaths,
          skill.metadata.allowedPaths,
          script.allowedPaths
        );
        const scriptPath = this.resolveScriptPath(skill, script.path, allowedPaths);

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
  private resolveScriptPath(skill: Skill, scriptName: string, allowedPaths: string[]): string {
    // Check for path traversal attempts in the scriptName
    if (scriptName.includes('../') || scriptName.includes('..\\')) {
      throw new Error('Path traversal detected: script path cannot contain "../" or "..\\"');
    }

    // Normalize the combined path to resolve any relative path components
    const resolvedPath = path.isAbsolute(scriptName)
      ? path.resolve(scriptName)
      : path.resolve(skill.basePath, scriptName);
    const normalizedBasePath = path.resolve(skill.basePath);

    // Verify that the resolved path is within the allowed base path
    if (!resolvedPath.startsWith(normalizedBasePath + path.sep) && resolvedPath !== normalizedBasePath) {
      if (this.isPathWithinAllowedPaths(resolvedPath, allowedPaths)) {
        return resolvedPath;
      }
      throw new Error(
        `Path traversal detected: script path "${resolvedPath}" is outside allowed base path "${normalizedBasePath}" and not permitted by allowed paths: ${allowedPaths.join(', ')}`
      );
    }

    return resolvedPath;
  }

  private isPathWithinAllowedPaths(targetPath: string, allowedPaths: string[]): boolean {
    const normalizedTarget = path.resolve(targetPath);
    return allowedPaths.some(allowedPath => {
      if (!allowedPath) {
        return false;
      }
      const normalizedAllowed = path.resolve(allowedPath);
      return normalizedTarget === normalizedAllowed || normalizedTarget.startsWith(normalizedAllowed + path.sep);
    });
  }

  private mergePathLists(...lists: Array<string[] | undefined>): string[] {
    const ordered: string[] = [];
    const seen = new Set<string>();

    for (const list of lists) {
      if (!list) {
        continue;
      }
      for (const entry of list) {
        if (!entry) {
          continue;
        }
        const resolved = path.resolve(entry);
        if (seen.has(resolved)) {
          continue;
        }
        seen.add(resolved);
        ordered.push(entry);
      }
    }

    return ordered.length > 0 ? ordered : [...DEFAULT_SANDBOX_CONFIG.allowedPaths];
  }

  private buildExecutionSignature(
    skillId: string,
    scriptName: string,
    args?: unknown[],
    stdin?: string,
    cwd?: string
  ): string {
    const argsSegment = Array.isArray(args) ? JSON.stringify(args) : '';
    const stdinSegment = stdin ? `stdin:${stdin}` : '';
    const cwdSegment = cwd ? `cwd:${cwd}` : '';
    return `${skillId}::${scriptName}::${argsSegment}::${stdinSegment}::${cwdSegment}`;
  }

  private pruneRecentExecutions(referenceTime: number): void {
    for (const [signature, entry] of this.recentExecutions.entries()) {
      if (referenceTime - entry.timestamp >= SkillManager.DUPLICATE_EXECUTION_WINDOW_MS) {
        this.recentExecutions.delete(signature);
      }
    }
  }

  private buildSandboxOverrides(
    allowedPaths: string[],
    sandboxOverride?: Partial<SandboxConfig>
  ): Partial<SandboxConfig> | undefined {
    const overrides: Partial<SandboxConfig> = {
      ...(sandboxOverride ?? {})
    };

    overrides.allowedPaths = this.mergePathLists(allowedPaths);
    overrides.allowedReadPaths = this.mergePathLists(overrides.allowedReadPaths, allowedPaths);
    overrides.allowedWritePaths = this.mergePathLists(overrides.allowedWritePaths, allowedPaths);

    // Pass through cwdFilePath from base config if not overridden
    if (!overrides.cwdFilePath && this.config.sandbox?.cwdFilePath) {
      overrides.cwdFilePath = this.config.sandbox.cwdFilePath;
    }

    return overrides;
  }
}
