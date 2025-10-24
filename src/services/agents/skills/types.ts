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
  path?: string;  // optional subdirectory
  ref?: string;   // branch, tag, or commit
}

/**
 * npm package skill source
 */
export interface NpmSkillSource extends BaseSkillSource {
  type: 'npm';
  package: string;
  version?: string;  // default: 'latest'
  path?: string;     // optional path within package
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
  autoExtract?: boolean;  // default: true
}

/**
 * Union type for all skill sources
 */
export type SkillSource =
  | BuiltinSkillSource
  | GitHubSkillSource
  | NpmSkillSource
  | LocalSkillSource
  | UrlSkillSource
  | ZipSkillSource;

/**
 * SKILL.md frontmatter metadata
 */
export interface SkillMetadata {
  name: string;                   // Required, max 64 chars
  description: string;            // Required, max 1024 chars
  version?: string;               // Semantic version
  author?: string;
  license?: string;               // MIT, Apache-2.0, etc.
  capabilities?: string[];        // Tags for skill matching
  scripts?: SkillScript[];        // Executable scripts
  allowedPaths?: string[];        // Paths scripts can access
  [key: string]: any;             // Additional custom metadata
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
  path: string;                   // Relative path from skill root
  runtime: 'python' | 'typescript' | 'javascript' | 'shell';
  description?: string;
  allowedPaths?: string[];        // Override skill-level paths
  timeout?: number;               // Override default timeout
  args?: SkillScriptArgument[];   // Structured argument metadata
}

/**
 * Progressive disclosure level
 */
export type SkillLevel = 1 | 2 | 3;

/**
 * Loaded skill with progressive disclosure levels
 */
export interface Skill {
  // Identification
  id: string;                     // Unique identifier
  source: SkillSource;            // Where skill was loaded from

  // Level 1: Metadata (~100 tokens, always loaded)
  metadata: SkillMetadata;

  // Level 2: Instructions (<5k tokens, loaded on match)
  instructions?: string;          // SKILL.md body content

  // Level 3: Resources (unlimited, loaded on-demand)
  resources?: SkillResources;

  // Computed properties
  level1Tokens: number;           // Actual token count for metadata
  level2Tokens?: number;          // Actual token count for instructions
  basePath: string;               // Filesystem path to skill directory

  // Loading metadata
  loadedAt: Date;
  lastAccessed?: Date;
}

/**
 * Skill resources (Level 3)
 */
export interface SkillResources {
  references: Map<string, string>;   // path -> content
  scripts: Map<string, string>;      // path -> content
  commands: Map<string, string>;     // path -> content
  templates: Map<string, string>;    // path -> content
  examples: Map<string, string>;     // path -> content
  other: Map<string, string>;        // path -> content (any other files)
}

/**
 * Sandbox configuration
 */
export interface SandboxConfig {
  allowedPaths: string[];         // Paths scripts can access
  allowedReadPaths?: string[];    // Explicit read allowlist (defaults to allowedPaths)
  allowedWritePaths?: string[];   // Explicit write allowlist (defaults to allowedPaths)
  timeout: number;                // Milliseconds (default: 30000)
  maxMemory: number;              // Bytes (default: 512MB)
  networkAccess: boolean;          // Enable network access when explicitly permitted
  allowedNetworkHosts?: string[]; // Optional allowlist when network is enabled
  blockedNetworkHosts?: string[]; // Optional deny list
  allowedUnixSockets?: string[];  // Whitelisted unix domain sockets
  allowChildProcesses?: boolean;  // Allow child process spawning (default: false)
  allowedEnvVars?: string[];      // Environment variables scripts may read
  monitorViolations?: boolean;    // Enable OS level violation logging when supported
  environmentVars?: Record<string, string>;  // Whitelisted env vars injected into sandbox
  enforceNodePermissions?: boolean;          // Use Node experimental permission flags when available
  projectRoot?: string;           // Project/workspace root directory for resolving relative paths
}

// Re-export SandboxProviderConfig for convenience
export type { SandboxProviderConfig } from './sandbox-provider';

/**
 * Script execution request
 */
export interface ScriptExecutionRequest {
  scriptPath: string;             // Path to script (relative to skill)
  runtime: SkillScript['runtime'];
  args?: string[];                // Command line arguments
  stdin?: string;                 // Input data
  cwd?: string;                   // Working directory (must be in allowedPaths)
  sandbox?: Partial<SandboxConfig>; // Override sandbox settings
}

/**
 * Script execution result
 */
export interface ScriptExecutionResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  duration: number;               // Milliseconds
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
    level1: number;               // Default: 100
    level2: number;               // Default: 5000
  };
  requireLicense?: boolean;       // Require license field
  allowedLicenses?: string[];     // Whitelist of licenses
  requireVersion?: boolean;       // Require version field
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
  cacheDir?: string;              // Directory for downloaded/extracted skills
  maxConcurrentLoads?: number;    // Parallel loading limit
}

/**
 * Skill matching criteria
 */
export interface SkillMatchCriteria {
  capabilities?: string[];        // Required capabilities
  keywords?: string[];            // Keywords in name/description
  exclude?: string[];             // Skill IDs to exclude
}

/**
 * Skill execution context
 */
export interface SkillExecutionContext {
  workspace?: string;             // Workspace directory
  files?: string[];               // Files to process
  variables?: Record<string, any>; // Context variables
}

/**
 * Token metrics for a skill
 */
export interface TokenMetrics {
  skill: string;
  level1: number;                 // Frontmatter tokens
  level2: number;                 // Instructions tokens
  level3: number;                 // Resources tokens (when loaded)
  total: number;                  // Actual usage in conversation
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
  progress: number;               // 0-100
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
  size: number;                   // Bytes
  checksum?: string;              // SHA256 of SKILL.md
}
