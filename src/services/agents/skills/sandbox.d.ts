/**
 * Sandboxed Script Execution
 *
 * Executes skill scripts in isolated sandboxes with path, timeout, and memory restrictions.
 * Supports Python, TypeScript, JavaScript, and Shell runtimes.
 */
import { SandboxConfig, ScriptExecutionRequest, ScriptExecutionResult, SkillScript } from './types';
export declare const DEFAULT_SANDBOX_CONFIG: SandboxConfig;
/**
 * Script Sandbox Manager
 */
export declare class ScriptSandbox {
    private config;
    constructor(config?: SandboxConfig);
    /**
     * Execute a script in sandboxed environment
     */
    execute(request: ScriptExecutionRequest): Promise<ScriptExecutionResult>;
    /**
     * Get runtime command for script execution
     */
    private getRuntimeCommand;
    /**
     * Prepare sandboxed environment variables
     */
    private prepareEnvironment;
    /**
     * Execute process with timeout and memory limits
     */
    private executeProcess;
    /**
     * Check process memory usage
     */
    private checkMemoryUsage;
    /**
     * Validate script path is within allowed directories
     */
    private validateScriptPath;
    /**
     * Validate path is within allowed paths
     */
    private validatePath;
    /**
     * Validate script file contents for security issues
     */
    validateScriptSecurity(scriptPath: string, runtime: SkillScript['runtime']): Promise<{
        safe: boolean;
        issues: string[];
    }>;
    /**
     * Get available runtimes on system
     */
    getAvailableRuntimes(): Promise<{
        python: boolean;
        typescript: boolean;
        javascript: boolean;
        shell: boolean;
    }>;
}
/**
 * Create a sandbox with custom configuration
 */
export declare function createSandbox(config?: Partial<SandboxConfig>): ScriptSandbox;
