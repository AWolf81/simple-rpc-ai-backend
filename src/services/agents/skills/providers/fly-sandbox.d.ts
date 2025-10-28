/**
 * Fly Machines Sandbox Provider
 *
 * Executes scripts in ephemeral Fly.io machines for production isolation.
 * See: https://fly.io/docs/machines/
 *
 * Features:
 * - True container isolation
 * - Auto-scaling and auto-destroy
 * - Multiple regions worldwide
 * - Resource limits enforced by Fly platform
 *
 * Cost: ~$0.05/hour per machine (1 CPU, 1GB RAM)
 */
import type { ISandboxProvider, SandboxSessionType } from '../sandbox-provider';
import type { SandboxConfig, ScriptExecutionRequest, ScriptExecutionResult } from '../types';
interface FlyMachineConfig {
    appName: string;
    apiToken: string;
    region?: string;
    machineSize?: 'shared-cpu-1x' | 'shared-cpu-2x' | 'shared-cpu-4x';
    autoDestroy?: boolean;
}
export declare class FlyMachinesSandboxProvider implements ISandboxProvider {
    readonly name = "fly";
    readonly sessionType: SandboxSessionType;
    private config;
    private apiBase;
    private initialized;
    constructor(config?: FlyMachineConfig);
    initialize(sandboxConfig: SandboxConfig): Promise<void>;
    execute(request: ScriptExecutionRequest): Promise<ScriptExecutionResult>;
    healthCheck(): Promise<boolean>;
    createSession(sessionId: string): Promise<void>;
    destroySession(sessionId: string): Promise<void>;
    shutdown(): Promise<void>;
    /**
     * Create a Fly machine for script execution
     */
    private createMachine;
    /**
     * Get Docker image for runtime
     */
    private getImage;
    /**
     * Wait for machine to complete execution
     */
    private waitForMachineCompletion;
    /**
     * Get machine details
     */
    private getMachine;
    /**
     * Get machine logs
     */
    private getMachineLogs;
    /**
     * Stop a running machine
     */
    private stopMachine;
    /**
     * Destroy a machine
     */
    private destroyMachine;
    /**
     * List all machines in the app
     */
    private listMachines;
}
export {};
