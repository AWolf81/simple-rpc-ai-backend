/**
 * Skill Loader
 *
 * Loads skills from multiple sources (GitHub, npm, local, URLs, ZIP files).
 * Implements caching and progressive loading.
 */
import { Skill, SkillSource, SkillLoaderConfig, SkillResources } from './types';
/**
 * Skill Loader - Loads skills from multiple sources
 */
export declare class SkillLoader {
    private config;
    private cache;
    private cacheDir;
    constructor(config: SkillLoaderConfig);
    /**
     * Load all skills from configured sources
     */
    loadAll(): Promise<Skill[]>;
    /**
     * Load a single skill from a source
     */
    load(source: SkillSource): Promise<Skill>;
    /**
     * Resolve skill path based on source type
     */
    private resolveSkillPath;
    /**
     * Resolve built-in skill path
     */
    private resolveBuiltinPath;
    /**
     * Download skill from GitHub repository
     */
    private downloadGitHubSkill;
    /**
     * Resolve npm package skill path
     */
    private resolveNpmSkill;
    /**
     * Resolve local skill path
     */
    private resolveLocalPath;
    /**
     * Download skill from URL
     */
    private downloadUrlSkill;
    /**
     * Extract ZIP skill
     */
    private extractZipSkill;
    /**
     * Extract ZIP file to directory
     */
    private extractZipFile;
    /**
     * Load skill from filesystem path
     */
    private loadFromPath;
    /**
     * Load Level 3 resources for a skill
     */
    loadResources(skill: Skill): Promise<SkillResources>;
    /**
     * Load resource files into map
     */
    private loadResourceFiles;
    /**
     * Generate cache key for a source
     */
    private getCacheKey;
    /**
     * Cache a loaded skill
     */
    private cacheSkill;
    /**
     * Check if cache entry is still valid
     */
    private isCacheValid;
    /**
     * Estimate skill size in bytes
     */
    private estimateSkillSize;
    /**
     * Check if buffer is a ZIP file
     */
    private isZipBuffer;
    /**
     * Find SKILL.md in directory tree
     */
    private findSkillMd;
    /**
     * Copy directory recursively
     */
    private copyDirectory;
    /**
     * Remove directory recursively
     */
    private removeDirectory;
    /**
     * Clear cache
     */
    clearCache(): void;
    /**
     * Get cache statistics
     */
    getCacheStats(): {
        entries: number;
        totalSize: number;
    };
}
