/**
 * Local Sandbox Provider
 *
 * Executes scripts as local processes with security restrictions.
 * Best for development and testing. NOT recommended for production.
 *
 * Security features:
 * - Path validation (only allowed directories)
 * - Timeout limits
 * - Memory limits
 * - Process isolation
 */
import type { ISandboxProvider, SandboxSessionType } from '../sandbox-provider';
import type { SandboxConfig, ScriptExecutionRequest, ScriptExecutionResult } from '../types';
export declare class LocalSandboxProvider implements ISandboxProvider {
    readonly name = "local";
    readonly sessionType: SandboxSessionType;
    private config;
    private initialized;
    private pythonGuardPath?;
    constructor(config?: Partial<SandboxConfig>);
    initialize(config: SandboxConfig): Promise<void>;
    execute(request: ScriptExecutionRequest): Promise<ScriptExecutionResult>;
    healthCheck(): Promise<boolean>;
    shutdown(): Promise<void>;
    private resolveSandboxConfig;
    /**
     * Validate script path is within allowed directories
     */
    private validateScriptPath;
    /**
     * Validate any path is within allowed directories
     */
    private validatePath;
    private applyRuntimeSecurity;
    private buildNodePermissionFlags;
    private ensurePythonGuard;
    private startViolationMonitor;
    /**
     * Get runtime command for script execution
     */
    private getRuntimeCommand;
    /**
     * Prepare environment variables
     */
    private prepareEnvironment;
    /**
     * Execute process with timeout and memory limits
     */
    private executeProcess;
}
