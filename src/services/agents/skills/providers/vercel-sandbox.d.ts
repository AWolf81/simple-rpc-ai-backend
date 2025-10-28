/**
 * Vercel Sandbox Provider
 *
 * Executes scripts in Vercel Sandbox - ephemeral compute for untrusted code.
 * See: https://vercel.com/docs/vercel-sandbox
 *
 * Features:
 * - Serverless execution
 * - Multiple runtime support (node22, python3.13)
 * - Public URLs for interactive apps
 * - Amazon Linux 2023 base
 * - sudo access available
 *
 * Cost: Pay-per-use serverless pricing
 * Timeout: Max 5 hours (Pro/Enterprise), 45 min (Hobby)
 *
 * Installation:
 *   pnpm add @vercel/sandbox
 *
 * Authentication:
 *   vercel link && vercel env pull
 */
import type { ISandboxProvider, SandboxSessionType } from '../sandbox-provider';
import type { SandboxConfig, ScriptExecutionRequest, ScriptExecutionResult } from '../types';
interface VercelSandboxProviderConfig {
    teamId?: string;
    projectId?: string;
    token?: string;
    runtime?: 'node22' | 'python3.13';
    vcpus?: number;
    defaultTimeout?: number;
}
export declare class VercelSandboxProvider implements ISandboxProvider {
    readonly name = "vercel";
    readonly sessionType: SandboxSessionType;
    private config;
    private SandboxClass?;
    private initialized;
    private activeSandbox?;
    constructor(config?: VercelSandboxProviderConfig);
    initialize(sandboxConfig: SandboxConfig): Promise<void>;
    execute(request: ScriptExecutionRequest): Promise<ScriptExecutionResult>;
    healthCheck(): Promise<boolean>;
    shutdown(): Promise<void>;
    /**
     * Create a Vercel sandbox
     */
    private createSandbox;
    /**
     * Upload script to sandbox
     */
    private uploadScript;
    /**
     * Run script in sandbox
     */
    private runScript;
    /**
     * Get execution command for runtime
     */
    private getExecutionCommand;
    /**
     * Map skill runtime to Vercel runtime
     */
    private getRuntimeForScript;
}
export {};
