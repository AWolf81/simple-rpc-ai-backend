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
import { logger } from '../../../../utils/logger';
export class FlyMachinesSandboxProvider {
    name = 'fly';
    sessionType = 'ephemeral';
    config;
    apiBase = 'https://api.machines.dev/v1';
    initialized = false;
    constructor(config) {
        if (!config) {
            throw new Error('Fly.io config required: appName and apiToken');
        }
        this.config = {
            region: config.region || 'ord', // Chicago by default
            machineSize: config.machineSize || 'shared-cpu-1x',
            autoDestroy: config.autoDestroy ?? true,
            ...config
        };
    }
    async initialize(sandboxConfig) {
        // Verify API token and app exist
        try {
            await this.listMachines();
            this.initialized = true;
            logger.debug(`✈️  Fly Machines sandbox initialized (app: ${this.config.appName}, region: ${this.config.region})`);
        }
        catch (error) {
            throw new Error(`Failed to initialize Fly sandbox: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async execute(request) {
        if (!this.initialized) {
            throw new Error('Fly sandbox not initialized');
        }
        const startTime = Date.now();
        try {
            // Create ephemeral machine
            const machine = await this.createMachine(request);
            // Wait for execution to complete
            const result = await this.waitForMachineCompletion(machine.id, request.sandbox?.timeout || 30000);
            // Auto-destroy if configured
            if (this.config.autoDestroy) {
                await this.destroyMachine(machine.id);
            }
            return {
                ...result,
                duration: Date.now() - startTime
            };
        }
        catch (error) {
            logger.error('❌ Fly machine execution failed:', error);
            return {
                exitCode: 1,
                stdout: '',
                stderr: error instanceof Error ? error.message : 'Unknown error',
                duration: Date.now() - startTime,
                timedOut: false
            };
        }
    }
    async healthCheck() {
        try {
            await this.listMachines();
            return true;
        }
        catch {
            return false;
        }
    }
    async createSession(sessionId) {
        // Create a long-running machine for persistent sessions
        const machine = await this.createMachine({
            scriptPath: '/app/init.sh', // Placeholder init script
            runtime: 'shell',
            args: [],
            sandbox: {}
        }, sessionId);
        logger.debug(`✈️  Created Fly machine session: ${sessionId} (machine: ${machine.id})`);
    }
    async destroySession(sessionId) {
        // Find and destroy machine by session ID
        const machines = await this.listMachines();
        const machine = machines.find(m => m.instance_id === sessionId);
        if (machine) {
            await this.destroyMachine(machine.id);
            logger.debug(`✈️  Destroyed Fly machine session: ${sessionId}`);
        }
    }
    async shutdown() {
        this.initialized = false;
        logger.debug('✈️  Fly Machines sandbox shut down');
    }
    /**
     * Create a Fly machine for script execution
     */
    async createMachine(request, sessionId) {
        const config = {
            name: sessionId || `sandbox-${Date.now()}`,
            region: this.config.region,
            config: {
                image: this.getImage(request.runtime),
                size: this.config.machineSize,
                env: {
                    SCRIPT_PATH: request.scriptPath,
                    SCRIPT_ARGS: JSON.stringify(request.args || []),
                    SCRIPT_STDIN: request.stdin || ''
                },
                auto_destroy: this.config.autoDestroy,
                restart: {
                    policy: 'no' // Don't restart on failure for ephemeral execution
                },
                guest: {
                    cpu_kind: 'shared',
                    cpus: 1,
                    memory_mb: 1024
                }
            }
        };
        const response = await fetch(`${this.apiBase}/apps/${this.config.appName}/machines`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.config.apiToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(config)
        });
        if (!response.ok) {
            throw new Error(`Failed to create Fly machine: ${response.statusText}`);
        }
        return await response.json();
    }
    /**
     * Get Docker image for runtime
     */
    getImage(runtime) {
        switch (runtime) {
            case 'python':
                return 'python:3.11-slim';
            case 'typescript':
            case 'javascript':
                return 'node:20-slim';
            case 'shell':
                return 'bash:latest';
            default:
                return 'ubuntu:22.04';
        }
    }
    /**
     * Wait for machine to complete execution
     */
    async waitForMachineCompletion(machineId, timeout) {
        const startTime = Date.now();
        const pollInterval = 1000; // 1 second
        while (Date.now() - startTime < timeout) {
            const machine = await this.getMachine(machineId);
            if (machine.state === 'stopped' || machine.state === 'destroyed') {
                // Fetch logs to get stdout/stderr
                const logs = await this.getMachineLogs(machineId);
                return {
                    exitCode: 0, // TODO: Get actual exit code from machine metadata
                    stdout: logs.stdout,
                    stderr: logs.stderr,
                    timedOut: false
                };
            }
            await new Promise(resolve => setTimeout(resolve, pollInterval));
        }
        // Timeout
        await this.stopMachine(machineId);
        return {
            exitCode: 124,
            stdout: '',
            stderr: 'Machine execution timed out',
            timedOut: true
        };
    }
    /**
     * Get machine details
     */
    async getMachine(machineId) {
        const response = await fetch(`${this.apiBase}/apps/${this.config.appName}/machines/${machineId}`, {
            headers: {
                'Authorization': `Bearer ${this.config.apiToken}`
            }
        });
        if (!response.ok) {
            throw new Error(`Failed to get machine: ${response.statusText}`);
        }
        return await response.json();
    }
    /**
     * Get machine logs
     */
    async getMachineLogs(machineId) {
        // Fly API endpoint for logs
        const response = await fetch(`${this.apiBase}/apps/${this.config.appName}/machines/${machineId}/logs`, {
            headers: {
                'Authorization': `Bearer ${this.config.apiToken}`
            }
        });
        if (!response.ok) {
            return { stdout: '', stderr: 'Failed to fetch logs' };
        }
        const logs = await response.text();
        return {
            stdout: logs,
            stderr: ''
        };
    }
    /**
     * Stop a running machine
     */
    async stopMachine(machineId) {
        await fetch(`${this.apiBase}/apps/${this.config.appName}/machines/${machineId}/stop`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.config.apiToken}`
            }
        });
    }
    /**
     * Destroy a machine
     */
    async destroyMachine(machineId) {
        await fetch(`${this.apiBase}/apps/${this.config.appName}/machines/${machineId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${this.config.apiToken}`
            }
        });
    }
    /**
     * List all machines in the app
     */
    async listMachines() {
        const response = await fetch(`${this.apiBase}/apps/${this.config.appName}/machines`, {
            headers: {
                'Authorization': `Bearer ${this.config.apiToken}`
            }
        });
        if (!response.ok) {
            throw new Error(`Failed to list machines: ${response.statusText}`);
        }
        return await response.json();
    }
}
