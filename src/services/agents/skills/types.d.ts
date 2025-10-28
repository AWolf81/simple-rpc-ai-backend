/**
 * Agent Skills System - Type Definitions
 *
 * Defines types for the skill system including sources, metadata,
 * progressive disclosure levels, and validation.
 */
/**
 * Skill source types
 */
export type SkillSourceType = 'builtin' | 'github' | 'npm' | 'local' | 'url' | 'zip';
/**
 * Base skill source configuration
 */
export interface BaseSkillSource {
    type: SkillSourceType;
}
/**
 * Built-in skill source (shipped with library)
 */
export interface BuiltinSkillSource extends BaseSkillSource {
    type: 'builtin';
    name: string;
}
/**
 * GitHub repository skill source
 */
export interface GitHubSkillSource extends BaseSkillSource {
    type: 'github';
    url: string;
    path?: string;
    ref?: string;
}
/**
 * npm package skill source
 */
export interface NpmSkillSource extends BaseSkillSource {
    type: 'npm';
    package: string;
    version?: string;
    path?: string;
}
/**
 * Local folder skill source
 */
export interface LocalSkillSource extends BaseSkillSource {
    type: 'local';
    path: string;
}
/**
 * URL skill source (typically ZIP files)
 */
export interface UrlSkillSource extends BaseSkillSource {
    type: 'url';
    url: string;
}
/**
 * ZIP file skill source
 */
export interface ZipSkillSource extends BaseSkillSource {
    type: 'zip';
    path: string;
    autoExtract?: boolean;
}
/**
 * Union type for all skill sources
 */
export type SkillSource = BuiltinSkillSource | GitHubSkillSource | NpmSkillSource | LocalSkillSource | UrlSkillSource | ZipSkillSource;
/**
 * Safety level for scripts
 */
export type SafetyLevel = 'low' | 'medium' | 'high' | 'critical';
/**
 * Safety configuration for scripts
 */
export interface ScriptSafetyConfig {
    level: SafetyLevel;
    requiresApproval: boolean;
    blockPatterns?: string[];
    warnPatterns?: string[];
    dangerousArgs?: string[];
    maxTargets?: number;
}
/**
 * SKILL.md frontmatter metadata
 */
export interface SkillMetadata {
    name: string;
    description: string;
    version?: string;
    author?: string;
    license?: string;
    capabilities?: string[];
    scripts?: SkillScript[];
    allowedPaths?: string[];
    requiresApproval?: boolean;
    safetyChecks?: {
        blockPatterns?: string[];
        warnPatterns?: string[];
    };
    [key: string]: any;
}
/**
 * Script definition in SKILL.md frontmatter
 */
export interface SkillScriptArgument {
    name: string;
    description?: string;
    type?: 'string' | 'number' | 'boolean';
    required?: boolean;
    enum?: Array<string | number>;
    default?: string | number | boolean | Array<string | number>;
    flag?: string;
    multiple?: boolean;
}
export interface SkillScript {
    path: string;
    runtime: 'python' | 'typescript' | 'javascript' | 'shell';
    description?: string;
    allowedPaths?: string[];
    timeout?: number;
    args?: SkillScriptArgument[];
    safety?: ScriptSafetyConfig;
    requiresApproval?: boolean;
}
/**
 * Progressive disclosure level
 */
export type SkillLevel = 1 | 2 | 3;
/**
 * Loaded skill with progressive disclosure levels
 */
export interface Skill {
    id: string;
    source: SkillSource;
    metadata: SkillMetadata;
    instructions?: string;
    resources?: SkillResources;
    level1Tokens: number;
    level2Tokens?: number;
    basePath: string;
    loadedAt: Date;
    lastAccessed?: Date;
}
/**
 * Skill resources (Level 3)
 */
export interface SkillResources {
    references: Map<string, string>;
    scripts: Map<string, string>;
    commands: Map<string, string>;
    templates: Map<string, string>;
    examples: Map<string, string>;
    other: Map<string, string>;
}
/**
 * Sandbox configuration
 */
export interface SandboxConfig {
    allowedPaths: string[];
    allowedReadPaths?: string[];
    allowedWritePaths?: string[];
    cwdFilePath?: string;
    timeout: number;
    maxMemory: number;
    networkAccess: boolean;
    allowedNetworkHosts?: string[];
    blockedNetworkHosts?: string[];
    allowedUnixSockets?: string[];
    allowChildProcesses?: boolean;
    allowedEnvVars?: string[];
    monitorViolations?: boolean;
    environmentVars?: Record<string, string>;
    enforceNodePermissions?: boolean;
    projectRoot?: string;
}
export type { SandboxProviderConfig } from './sandbox-provider';
/**
 * Script execution request
 */
export interface ScriptExecutionRequest {
    scriptPath: string;
    runtime: SkillScript['runtime'];
    args?: string[];
    stdin?: string;
    cwd?: string;
    sandbox?: Partial<SandboxConfig>;
}
/**
 * Script execution result
 */
export interface ScriptExecutionResult {
    exitCode: number;
    stdout: string;
    stderr: string;
    duration: number;
    timedOut: boolean;
    error?: string;
    violationLogs?: string[];
    securityWarnings?: string[];
}
/**
 * Skill validation configuration
 */
export interface ValidationConfig {
    enabled: boolean;
    maxTokens: {
        level1: number;
        level2: number;
    };
    requireLicense?: boolean;
    allowedLicenses?: string[];
    requireVersion?: boolean;
}
/**
 * Skill validation result
 */
export interface SkillValidationResult {
    valid: boolean;
    errors: string[];
    warnings: string[];
    metrics: {
        level1Tokens: number;
        level2Tokens: number;
        level3Files: number;
        scripts: ScriptValidation[];
    };
    recommendations: string[];
}
/**
 * Script validation result
 */
export interface ScriptValidation {
    path: string;
    runtime: string;
    safe: boolean;
    issues?: string[];
    allowedPaths?: string[];
    timeout?: number;
}
/**
 * Skill loader configuration
 */
export interface SkillLoaderConfig {
    sources: SkillSource[];
    sandbox: SandboxConfig;
    validation: ValidationConfig;
    cacheDir?: string;
    maxConcurrentLoads?: number;
    permissions?: {
        allow: string[];
        deny: string[];
        ask: string[];
    };
    approvalCallback?: (request: any) => Promise<{
        requestId: string;
        approved: boolean;
        rememberChoice?: boolean;
        timestamp: Date;
    }>;
}
/**
 * Skill matching criteria
 */
export interface SkillMatchCriteria {
    capabilities?: string[];
    keywords?: string[];
    exclude?: string[];
}
/**
 * Skill execution context
 */
export interface SkillExecutionContext {
    workspace?: string;
    files?: string[];
    variables?: Record<string, any>;
}
/**
 * Token metrics for a skill
 */
export interface TokenMetrics {
    skill: string;
    level1: number;
    level2: number;
    level3: number;
    total: number;
    breakdown?: {
        metadata: number;
        instructions: number;
        references: number;
        scripts: number;
        other: number;
    };
}
/**
 * Skill loading progress
 */
export interface SkillLoadingProgress {
    source: SkillSource;
    phase: 'download' | 'extract' | 'validate' | 'parse' | 'cache' | 'complete';
    progress: number;
    message?: string;
    error?: string;
}
/**
 * Skill cache entry
 */
export interface SkillCacheEntry {
    skill: Skill;
    cachedAt: Date;
    expiresAt?: Date;
    size: number;
    checksum?: string;
}
