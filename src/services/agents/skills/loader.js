/**
 * Skill Loader
 *
 * Loads skills from multiple sources (GitHub, npm, local, URLs, ZIP files).
 * Implements caching and progressive loading.
 */
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { loadSkillDirectory, estimateTokens, extractSkillId } from './parser';
import { logger } from '../../../utils/logger';
// ESM equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
/**
 * Skill Loader - Loads skills from multiple sources
 */
export class SkillLoader {
    config;
    cache = new Map();
    cacheDir;
    constructor(config) {
        this.config = config;
        this.cacheDir = config.cacheDir || path.join(os.tmpdir(), 'simple-rpc-skills');
    }
    /**
     * Load all skills from configured sources
     */
    async loadAll() {
        const skills = [];
        const maxConcurrent = this.config.maxConcurrentLoads || 5;
        // Load skills in batches to respect concurrency limit
        for (let i = 0; i < this.config.sources.length; i += maxConcurrent) {
            const batch = this.config.sources.slice(i, i + maxConcurrent);
            const batchSkills = await Promise.all(batch.map(source => this.load(source).catch(error => {
                logger.error(`Failed to load skill from ${source.type}:`, error);
                return null;
            })));
            skills.push(...batchSkills.filter((s) => s !== null));
        }
        logger.info(`✅ Loaded ${skills.length} skills from ${this.config.sources.length} sources`);
        return skills;
    }
    /**
     * Load a single skill from a source
     */
    async load(source) {
        // Check cache first
        const cacheKey = this.getCacheKey(source);
        const cached = this.cache.get(cacheKey);
        if (cached && this.isCacheValid(cached)) {
            logger.debug(`📦 Using cached skill: ${cached.skill.id}`);
            return cached.skill;
        }
        logger.debug(`⬇️  Loading skill from ${source.type}...`);
        // Download/locate skill
        const skillPath = await this.resolveSkillPath(source);
        // Load and parse skill
        const skill = await this.loadFromPath(skillPath, source);
        // Cache the skill
        this.cacheSkill(cacheKey, skill);
        logger.debug(`✅ Loaded skill: ${skill.id}`);
        return skill;
    }
    /**
     * Resolve skill path based on source type
     */
    async resolveSkillPath(source) {
        switch (source.type) {
            case 'builtin':
                return this.resolveBuiltinPath(source);
            case 'github':
                return this.downloadGitHubSkill(source);
            case 'npm':
                return this.resolveNpmSkill(source);
            case 'local':
                return this.resolveLocalPath(source);
            case 'url':
                return this.downloadUrlSkill(source);
            case 'zip':
                return this.extractZipSkill(source);
            default:
                throw new Error(`Unknown skill source type: ${source.type}`);
        }
    }
    /**
     * Resolve built-in skill path
     */
    resolveBuiltinPath(source) {
        // Built-in skills are in src/services/agents/skills/builtin/
        const builtinDir = path.join(__dirname, 'builtin', source.name);
        return builtinDir;
    }
    /**
     * Download skill from GitHub repository
     */
    async downloadGitHubSkill(source) {
        // Parse GitHub URL
        const match = source.url.match(/github\.com\/([^/]+)\/([^/]+)/);
        if (!match) {
            throw new Error(`Invalid GitHub URL: ${source.url}`);
        }
        const [, owner, repo] = match;
        const ref = source.ref || 'main';
        const skillPath = source.path || '';
        // Create cache directory for this skill
        const skillId = `${owner}-${repo}-${ref}${skillPath ? `-${skillPath.replace(/\//g, '-')}` : ''}`;
        const targetDir = path.join(this.cacheDir, 'github', skillId);
        // Check if already downloaded
        try {
            await fs.access(path.join(targetDir, 'SKILL.md'));
            logger.debug(`📦 Using cached GitHub skill: ${skillId}`);
            return targetDir;
        }
        catch {
            // Need to download
        }
        // Download using git clone or GitHub API
        logger.debug(`⬇️  Downloading from GitHub: ${owner}/${repo}@${ref}/${skillPath}`);
        try {
            // Try git clone first (requires git installed)
            const { exec } = await import('child_process');
            const { promisify } = await import('util');
            const execAsync = promisify(exec);
            await fs.mkdir(targetDir, { recursive: true });
            // Clone specific ref with depth 1 for speed
            await execAsync(`git clone --depth 1 --branch ${ref} https://github.com/${owner}/${repo}.git temp`, { cwd: targetDir });
            // Move skill directory to target
            const tempDir = path.join(targetDir, 'temp');
            const sourceDir = skillPath ? path.join(tempDir, skillPath) : tempDir;
            if (skillPath) {
                // Copy specific subdirectory
                await this.copyDirectory(sourceDir, targetDir);
                await this.removeDirectory(tempDir);
            }
            else {
                // Move entire repo
                const files = await fs.readdir(sourceDir);
                await Promise.all(files.map(file => fs.rename(path.join(sourceDir, file), path.join(targetDir, file))));
                await this.removeDirectory(tempDir);
            }
            return targetDir;
        }
        catch (gitError) {
            // Fallback to GitHub API (ZIP download)
            logger.warn('Git clone failed, falling back to GitHub API:', gitError);
            const zipUrl = `https://github.com/${owner}/${repo}/archive/refs/heads/${ref}.zip`;
            const urlSource = { type: 'url', url: zipUrl };
            const extractedPath = await this.downloadUrlSkill(urlSource);
            // Move to proper cache location
            const repoDir = path.join(extractedPath, `${repo}-${ref}`);
            const sourceDir = skillPath ? path.join(repoDir, skillPath) : repoDir;
            await this.copyDirectory(sourceDir, targetDir);
            await this.removeDirectory(extractedPath);
            return targetDir;
        }
    }
    /**
     * Resolve npm package skill path
     */
    async resolveNpmSkill(source) {
        const packageName = source.package;
        const version = source.version || 'latest';
        const subPath = source.path || '';
        // Create cache directory
        const skillId = `${packageName.replace(/[@/]/g, '-')}-${version}`;
        const targetDir = path.join(this.cacheDir, 'npm', skillId);
        // Check if already installed
        try {
            const skillPath = subPath
                ? path.join(targetDir, 'node_modules', packageName, subPath)
                : path.join(targetDir, 'node_modules', packageName);
            await fs.access(path.join(skillPath, 'SKILL.md'));
            logger.debug(`📦 Using cached npm skill: ${packageName}@${version}`);
            return skillPath;
        }
        catch {
            // Need to install
        }
        logger.debug(`⬇️  Installing npm package: ${packageName}@${version}`);
        await fs.mkdir(targetDir, { recursive: true });
        // Create minimal package.json
        await fs.writeFile(path.join(targetDir, 'package.json'), JSON.stringify({ dependencies: { [packageName]: version } }, null, 2));
        // Install package
        const { exec } = await import('child_process');
        const { promisify } = await import('util');
        const execAsync = promisify(exec);
        await execAsync('npm install --production --no-save', { cwd: targetDir });
        const skillPath = subPath
            ? path.join(targetDir, 'node_modules', packageName, subPath)
            : path.join(targetDir, 'node_modules', packageName);
        return skillPath;
    }
    /**
     * Resolve local skill path
     */
    resolveLocalPath(source) {
        // Resolve to absolute path
        const absolutePath = path.isAbsolute(source.path)
            ? source.path
            : path.resolve(process.cwd(), source.path);
        return absolutePath;
    }
    /**
     * Download skill from URL
     */
    async downloadUrlSkill(source) {
        const url = source.url;
        const urlHash = crypto.createHash('sha256').update(url).digest('hex').slice(0, 16);
        const targetDir = path.join(this.cacheDir, 'url', urlHash);
        // Check if already downloaded
        try {
            await fs.access(path.join(targetDir, 'SKILL.md'));
            logger.debug(`📦 Using cached URL skill: ${url}`);
            return targetDir;
        }
        catch {
            // Need to download
        }
        logger.debug(`⬇️  Downloading from URL: ${url}`);
        await fs.mkdir(targetDir, { recursive: true });
        // Download file
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to download skill: ${response.statusText}`);
        }
        const buffer = Buffer.from(await response.arrayBuffer());
        // Check if it's a ZIP file
        if (url.endsWith('.zip') || this.isZipBuffer(buffer)) {
            // Extract ZIP
            const zipPath = path.join(targetDir, 'download.zip');
            await fs.writeFile(zipPath, buffer);
            const extractedPath = await this.extractZipFile(zipPath, targetDir);
            await fs.unlink(zipPath);
            return extractedPath;
        }
        else {
            // Assume it's a SKILL.md file
            await fs.writeFile(path.join(targetDir, 'SKILL.md'), buffer);
            return targetDir;
        }
    }
    /**
     * Extract ZIP skill
     */
    async extractZipSkill(source) {
        const zipPath = path.isAbsolute(source.path)
            ? source.path
            : path.resolve(process.cwd(), source.path);
        const zipHash = crypto.createHash('sha256').update(zipPath).digest('hex').slice(0, 16);
        const targetDir = path.join(this.cacheDir, 'zip', zipHash);
        // Check if already extracted
        try {
            await fs.access(path.join(targetDir, 'SKILL.md'));
            logger.debug(`📦 Using cached ZIP skill: ${source.path}`);
            return targetDir;
        }
        catch {
            // Need to extract
        }
        logger.debug(`📦 Extracting ZIP: ${source.path}`);
        return await this.extractZipFile(zipPath, targetDir);
    }
    /**
     * Extract ZIP file to directory
     */
    async extractZipFile(zipPath, targetDir) {
        await fs.mkdir(targetDir, { recursive: true });
        // Use unzip or node-based ZIP extraction
        try {
            const { exec } = await import('child_process');
            const { promisify } = await import('util');
            const execAsync = promisify(exec);
            await execAsync(`unzip -q "${zipPath}" -d "${targetDir}"`);
            // Find SKILL.md in extracted files
            const skillPath = await this.findSkillMd(targetDir);
            return skillPath ? path.dirname(skillPath) : targetDir;
        }
        catch (error) {
            throw new Error(`Failed to extract ZIP file: ${error}`);
        }
    }
    /**
     * Load skill from filesystem path
     */
    async loadFromPath(skillPath, source) {
        // Load skill directory
        const { parsed, resourcePaths } = await loadSkillDirectory(skillPath);
        // Extract skill ID
        const id = extractSkillId(skillPath, parsed.metadata);
        // Count tokens
        const level1Tokens = estimateTokens(parsed.rawFrontmatter);
        const level2Tokens = estimateTokens(parsed.instructions);
        // Create skill object (Level 1 + Level 2 loaded, Level 3 lazy)
        const skill = {
            id,
            source,
            metadata: parsed.metadata,
            instructions: parsed.instructions,
            resources: undefined, // Level 3 - loaded on demand
            level1Tokens,
            level2Tokens,
            basePath: skillPath,
            loadedAt: new Date()
        };
        return skill;
    }
    /**
     * Load Level 3 resources for a skill
     */
    async loadResources(skill) {
        if (skill.resources) {
            return skill.resources;
        }
        logger.debug(`📚 Loading Level 3 resources for skill: ${skill.id}`);
        const { resourcePaths } = await loadSkillDirectory(skill.basePath);
        const resources = {
            references: new Map(),
            scripts: new Map(),
            commands: new Map(),
            templates: new Map(),
            examples: new Map(),
            other: new Map()
        };
        // Load each resource type
        await this.loadResourceFiles(resourcePaths.references, resources.references);
        await this.loadResourceFiles(resourcePaths.scripts, resources.scripts);
        await this.loadResourceFiles(resourcePaths.commands, resources.commands);
        await this.loadResourceFiles(resourcePaths.templates, resources.templates);
        await this.loadResourceFiles(resourcePaths.examples, resources.examples);
        await this.loadResourceFiles(resourcePaths.other, resources.other);
        skill.resources = resources;
        skill.lastAccessed = new Date();
        return resources;
    }
    /**
     * Load resource files into map
     */
    async loadResourceFiles(filePaths, targetMap) {
        await Promise.all(filePaths.map(async (filePath) => {
            try {
                const content = await fs.readFile(filePath, 'utf-8');
                const relativePath = path.basename(filePath);
                targetMap.set(relativePath, content);
            }
            catch (error) {
                logger.warn(`Failed to load resource file: ${filePath}`, error);
            }
        }));
    }
    /**
     * Generate cache key for a source
     */
    getCacheKey(source) {
        return crypto.createHash('sha256').update(JSON.stringify(source)).digest('hex');
    }
    /**
     * Cache a loaded skill
     */
    cacheSkill(cacheKey, skill) {
        const entry = {
            skill,
            cachedAt: new Date(),
            size: this.estimateSkillSize(skill),
            checksum: crypto
                .createHash('sha256')
                .update(JSON.stringify(skill.metadata))
                .digest('hex')
        };
        this.cache.set(cacheKey, entry);
    }
    /**
     * Check if cache entry is still valid
     */
    isCacheValid(entry) {
        if (entry.expiresAt && entry.expiresAt < new Date()) {
            return false;
        }
        // Cache is valid for 1 hour
        const maxAge = 60 * 60 * 1000;
        return Date.now() - entry.cachedAt.getTime() < maxAge;
    }
    /**
     * Estimate skill size in bytes
     */
    estimateSkillSize(skill) {
        return JSON.stringify(skill.metadata).length + (skill.instructions?.length || 0);
    }
    /**
     * Check if buffer is a ZIP file
     */
    isZipBuffer(buffer) {
        // ZIP files start with PK signature
        return buffer.length >= 4 &&
            buffer[0] === 0x50 &&
            buffer[1] === 0x4b &&
            (buffer[2] === 0x03 || buffer[2] === 0x05) &&
            (buffer[3] === 0x04 || buffer[3] === 0x06);
    }
    /**
     * Find SKILL.md in directory tree
     */
    async findSkillMd(dir) {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isFile() && entry.name === 'SKILL.md') {
                return fullPath;
            }
            if (entry.isDirectory()) {
                const found = await this.findSkillMd(fullPath);
                if (found)
                    return found;
            }
        }
        return null;
    }
    /**
     * Copy directory recursively
     */
    async copyDirectory(src, dest) {
        await fs.mkdir(dest, { recursive: true });
        const entries = await fs.readdir(src, { withFileTypes: true });
        for (const entry of entries) {
            const srcPath = path.join(src, entry.name);
            const destPath = path.join(dest, entry.name);
            if (entry.isDirectory()) {
                await this.copyDirectory(srcPath, destPath);
            }
            else {
                await fs.copyFile(srcPath, destPath);
            }
        }
    }
    /**
     * Remove directory recursively
     */
    async removeDirectory(dir) {
        await fs.rm(dir, { recursive: true, force: true });
    }
    /**
     * Clear cache
     */
    clearCache() {
        this.cache.clear();
        logger.debug('🗑️  Skill cache cleared');
    }
    /**
     * Get cache statistics
     */
    getCacheStats() {
        let totalSize = 0;
        for (const entry of this.cache.values()) {
            totalSize += entry.size;
        }
        return {
            entries: this.cache.size,
            totalSize
        };
    }
}
