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

import type {
  ISandboxProvider,
  SandboxSessionType
} from '../sandbox-provider';
import type {
  SandboxConfig,
  ScriptExecutionRequest,
  ScriptExecutionResult
} from '../types';
import { logger } from '../../../../utils/logger';

// Type definitions for @vercel/sandbox (peer dependency)
interface VercelSandboxConfig {
  teamId?: string;
  projectId?: string;
  token?: string;
  source?: {
    url?: string;
    type: 'git' | 'local';
    path?: string;
  };
  resources?: {
    vcpus?: number;
  };
  timeout?: number; // milliseconds
  ports?: number[];
  runtime?: 'node22' | 'python3.13';
}

interface VercelSandbox {
  domain(port: number): string;
  runCommand(options: {
    cmd: string;
    args?: string[];
    stdin?: NodeJS.ReadableStream | string;
    stdout?: NodeJS.WritableStream;
    stderr?: NodeJS.WritableStream;
    detached?: boolean;
    sudo?: boolean;
  }): Promise<{ exitCode: number }>;
  stop(): Promise<void>;
}

interface VercelSandboxStatic {
  create(config: VercelSandboxConfig): Promise<VercelSandbox>;
}

interface VercelSandboxProviderConfig {
  teamId?: string;
  projectId?: string;
  token?: string;
  runtime?: 'node22' | 'python3.13';
  vcpus?: number;
  defaultTimeout?: number;
}

export class VercelSandboxProvider implements ISandboxProvider {
  readonly name = 'vercel';
  readonly sessionType: SandboxSessionType = 'ephemeral';

  private config: VercelSandboxProviderConfig;
  private SandboxClass?: VercelSandboxStatic;
  private initialized = false;
  private activeSandbox?: VercelSandbox;

  constructor(config?: VercelSandboxProviderConfig) {
    this.config = {
      runtime: config?.runtime || 'node22',
      vcpus: config?.vcpus || 4,
      defaultTimeout: config?.defaultTimeout || 300000, // 5 minutes
      ...config
    };
  }

  async initialize(sandboxConfig: SandboxConfig): Promise<void> {
    try {
      // Dynamic import of peer dependency
      // @ts-ignore - Optional peer dependency
      const vercelSandbox = await import('@vercel/sandbox');
      this.SandboxClass = vercelSandbox.Sandbox as VercelSandboxStatic;
      this.initialized = true;
      logger.debug('▲ Vercel Sandbox provider initialized');
    } catch (error) {
      throw new Error(
        '@vercel/sandbox is not installed. Install it with: pnpm add @vercel/sandbox\n' +
        'Then authenticate with: vercel link && vercel env pull\n' +
        `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async execute(request: ScriptExecutionRequest): Promise<ScriptExecutionResult> {
    if (!this.initialized || !this.SandboxClass) {
      throw new Error('Vercel sandbox not initialized');
    }

    const startTime = Date.now();

    try {
      // Create ephemeral sandbox
      const sandbox = await this.createSandbox(request);
      this.activeSandbox = sandbox;

      // Upload script if local
      if (!request.scriptPath.startsWith('http')) {
        await this.uploadScript(sandbox, request);
      }

      // Execute script
      const result = await this.runScript(sandbox, request);

      // Cleanup
      await sandbox.stop();
      this.activeSandbox = undefined;

      return {
        ...result,
        duration: Date.now() - startTime
      };
    } catch (error) {
      logger.error('❌ Vercel sandbox execution failed:', error);

      // Cleanup on error
      if (this.activeSandbox) {
        try {
          await this.activeSandbox.stop();
        } catch {}
        this.activeSandbox = undefined;
      }

      return {
        exitCode: 1,
        stdout: '',
        stderr: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime,
        timedOut: false
      };
    }
  }

  async healthCheck(): Promise<boolean> {
    return this.initialized && this.SandboxClass !== undefined;
  }

  async shutdown(): Promise<void> {
    if (this.activeSandbox) {
      await this.activeSandbox.stop();
      this.activeSandbox = undefined;
    }
    this.initialized = false;
    logger.debug('▲ Vercel Sandbox provider shut down');
  }

  /**
   * Create a Vercel sandbox
   */
  private async createSandbox(request: ScriptExecutionRequest): Promise<VercelSandbox> {
    if (!this.SandboxClass) {
      throw new Error('Vercel sandbox not initialized');
    }

    const config: VercelSandboxConfig = {
      runtime: this.getRuntimeForScript(request.runtime),
      resources: { vcpus: this.config.vcpus },
      timeout: request.sandbox?.timeout || this.config.defaultTimeout,
      ...(this.config.teamId && { teamId: this.config.teamId }),
      ...(this.config.projectId && { projectId: this.config.projectId }),
      ...(this.config.token && { token: this.config.token })
    };

    logger.debug(`▲ Creating Vercel sandbox with ${config.runtime} runtime...`);
    const sandbox = await this.SandboxClass.create(config);
    logger.debug('▲ Vercel sandbox created');

    return sandbox;
  }

  /**
   * Upload script to sandbox
   */
  private async uploadScript(sandbox: VercelSandbox, request: ScriptExecutionRequest): Promise<void> {
    // Read local script file
    const fs = await import('fs/promises');
    const scriptContent = await fs.readFile(request.scriptPath, 'utf-8');

    // Write to sandbox
    const scriptName = request.scriptPath.split('/').pop() || 'script';
    const remotePath = `/vercel/sandbox/${scriptName}`;

    await sandbox.runCommand({
      cmd: 'cat',
      args: ['>', remotePath],
      stdin: scriptContent,
      sudo: false
    });

    // Make executable if shell script
    if (request.runtime === 'shell') {
      await sandbox.runCommand({
        cmd: 'chmod',
        args: ['+x', remotePath],
        sudo: false
      });
    }
  }

  /**
   * Run script in sandbox
   */
  private async runScript(
    sandbox: VercelSandbox,
    request: ScriptExecutionRequest
  ): Promise<Omit<ScriptExecutionResult, 'duration'>> {
    const { command, args } = this.getExecutionCommand(request);

    // Capture output
    let stdout = '';
    let stderr = '';

    const stdoutStream = new (await import('stream')).Writable({
      write(chunk, encoding, callback) {
        stdout += chunk.toString();
        callback();
      }
    });

    const stderrStream = new (await import('stream')).Writable({
      write(chunk, encoding, callback) {
        stderr += chunk.toString();
        callback();
      }
    });

    logger.debug(`▲ Executing: ${command} ${args.join(' ')}`);

    const result = await sandbox.runCommand({
      cmd: command,
      args: args,
      stdin: request.stdin,
      stdout: stdoutStream,
      stderr: stderrStream,
      sudo: false
    });

    return {
      exitCode: result.exitCode,
      stdout,
      stderr,
      timedOut: false
    };
  }

  /**
   * Get execution command for runtime
   */
  private getExecutionCommand(request: ScriptExecutionRequest): {
    command: string;
    args: string[];
  } {
    const scriptName = request.scriptPath.split('/').pop() || 'script';
    const remotePath = `/vercel/sandbox/${scriptName}`;

    switch (request.runtime) {
      case 'python':
        return {
          command: 'python3',
          args: [remotePath, ...(request.args || [])]
        };

      case 'typescript':
      case 'javascript':
        return {
          command: 'node',
          args: [remotePath, ...(request.args || [])]
        };

      case 'shell':
        return {
          command: 'bash',
          args: [remotePath, ...(request.args || [])]
        };

      default:
        throw new Error(`Unsupported runtime: ${request.runtime}`);
    }
  }

  /**
   * Map skill runtime to Vercel runtime
   */
  private getRuntimeForScript(runtime: string): 'node22' | 'python3.13' {
    switch (runtime) {
      case 'python':
        return 'python3.13';
      case 'typescript':
      case 'javascript':
      case 'shell':
        return 'node22'; // Node includes bash
      default:
        return 'node22';
    }
  }
}
