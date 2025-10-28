/**
 * Skill Manager
 *
 * High-level interface for managing skills: loading, matching, execution, and validation.
 */
import { Skill, SkillSource, SkillLoaderConfig, SkillMatchCriteria, SkillValidationResult, ScriptExecutionRequest, ScriptExecutionResult, TokenMetrics } from './types';
/**
 * Skill Manager - Central interface for skills system
 */
export declare class SkillManager {
    private loader;
    private sandbox;
    private sandboxProvider?;
    private skills;
    private config;
    private initializationPromise?;
    private initialized;
    private approvalManager?;
    constructor(config: SkillLoaderConfig);
    /**
     * Initialize and load all skills
     */
    initialize(): Promise<void>;
    /**
     * Internal initialization logic
     */
    private _doInitialize;
    /**
     * Get all loaded skills
     *
     * Note: If called before initialization completes, returns empty array.
     * Always call initialize() and await it before using getAll().
     */
    getAll(): Skill[];
    /**
     * Get skill by ID
     */
    get(skillId: string): Skill | undefined;
    /**
     * Match skills based on criteria
     */
    match(criteria: SkillMatchCriteria): Skill[];
    /**
     * Load Level 3 resources for a skill
     */
    loadResources(skillId: string): Promise<void>;
    /**
     * Execute a script from a skill
     */
    executeScript(skillId: string, request: Omit<ScriptExecutionRequest, 'scriptPath' | 'runtime'> & {
        scriptName: string;
    }): Promise<ScriptExecutionResult>;
    /**
     * Validate a skill
     */
    validate(skillId: string): Promise<SkillValidationResult>;
    /**
     * Get token metrics for a skill
     */
    getMetrics(skillId: string): Promise<TokenMetrics>;
    /**
     * Reload a specific skill
     */
    reload(skillId: string): Promise<void>;
    /**
     * Reload all skills
     */
    reloadAll(): Promise<void>;
    /**
     * Add a new skill source and load it
     */
    addSource(source: SkillSource): Promise<Skill>;
    /**
     * Remove a skill
     */
    remove(skillId: string): boolean;
    /**
     * Get skill statistics
     */
    getStats(): {
        totalSkills: number;
        bySource: Record<string, number>;
        totalLevel1Tokens: number;
        totalLevel2Tokens: number;
    };
    /**
     * Validate scripts in a skill
     */
    private validateScripts;
    /**
     * Resolve script path from skill
     */
    private resolveScriptPath;
    private isPathWithinAllowedPaths;
    private mergePathLists;
    private buildSandboxOverrides;
}
