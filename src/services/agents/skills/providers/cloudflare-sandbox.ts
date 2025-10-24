/**
 * Cloudflare Sandbox Provider
 *
 * Executes scripts in Cloudflare Sandbox - edge-native isolated containers.
 * See: https://developers.cloudflare.com/sandbox/
 *
 * Features:
 * - Edge-native execution on Cloudflare's global network
 * - Secure container isolation
 * - File system access
 * - Git integration
 * - Preview URLs for exposed services
 * - Python and JavaScript runtime support
 *
 * Cost: Cloudflare Workers pricing + container costs
 * Timeout: Configurable (default: 30s)
 *
 * Installation:
 *   pnpm add @cloudflare/sandbox
 *
 * Prerequisites:
 *   - Docker running locally (for development)
 *   - Cloudflare account (for production)
 *   - Deploy worker: npx wrangler deploy
 *
 * Note: This provider requires Cloudflare Workers environment.
 * For standalone Node.js usage, use LocalSandboxProvider instead.
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

// Type definitions for @cloudflare/sandbox (peer dependency)
interface CloudflareSandboxExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  success: boolean;
}

interface CloudflareSandboxFile {
  content: string;
}

interface CloudflareSandbox {
  exec(command: string, options?: {
    stdin?: string;
    env?: Record<string, string>;
    timeout?: number;
  }): Promise<CloudflareSandboxExecResult>;

  writeFile(path: string, content: string | ArrayBuffer): Promise<void>;
  readFile(path: string): Promise<CloudflareSandboxFile>;
  deleteFile(path: string): Promise<void>;
  listFiles(path: string): Promise<string[]>;

  // Git operations
  gitClone(url: string, options?: { branch?: string; path?: string }): Promise<void>;
}

interface CloudflareSandboxStatic {
  getSandbox(namespace: any, id: string): CloudflareSandbox;
}

interface CloudflareSandboxProviderConfig {
  sandboxNamespace?: any; // DurableObjectNamespace<Sandbox> in Workers
  sandboxId?: string;
  defaultTimeout?: number;
  workspacePath?: string;
}

export class CloudflareSandboxProvider implements ISandboxProvider {
  readonly name = 'cloudflare';
  readonly sessionType: SandboxSessionType = 'ephemeral';

  private config: CloudflareSandboxProviderConfig;
  private getSandboxFunc?: (namespace: any, id: string) => CloudflareSandbox;
  private initialized = false;
  private sandbox?: CloudflareSandbox;

  constructor(config?: CloudflareSandboxProviderConfig) {
    this.config = {
      sandboxId: config?.sandboxId || 'skill-sandbox',
      defaultTimeout: config?.defaultTimeout || 30000, // 30 seconds
      workspacePath: config?.workspacePath || '/workspace',
      ...config
    };
  }

  async initialize(sandboxConfig: SandboxConfig): Promise<void> {
    try {
      // Dynamic import of peer dependency
      // @ts-ignore - Optional peer dependency
      const cloudflare = await import('@cloudflare/sandbox');
      this.getSandboxFunc = cloudflare.getSandbox;

      // Create/get sandbox instance
      if (this.config.sandboxNamespace && this.getSandboxFunc) {
        this.sandbox = this.getSandboxFunc(
          this.config.sandboxNamespace,
          this.config.sandboxId!
        );
      }

      this.initialized = true;
      logger.debug('☁️ Cloudflare Sandbox provider initialized');
    } catch (error) {
      throw new Error(
        '@cloudflare/sandbox is not installed or not in Workers environment.\n' +
        'Install: pnpm add @cloudflare/sandbox\n' +
        'Deploy: npx wrangler deploy\n' +
        'Note: This provider requires Cloudflare Workers runtime.\n' +
        `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async execute(request: ScriptExecutionRequest): Promise<ScriptExecutionResult> {
    if (!this.initialized || !this.sandbox) {
      throw new Error('Cloudflare sandbox not initialized');
    }

    const startTime = Date.now();

    try {
      // Upload script to sandbox if local path
      let scriptPath = request.scriptPath;
      if (!request.scriptPath.startsWith('http')) {
        scriptPath = await this.uploadScript(request);
      }

      // Build execution command
      const command = this.buildCommand(request.runtime, scriptPath, request.args);

      // Execute with timeout and environment
      const result = await this.sandbox.exec(command, {
        stdin: request.stdin,
        env: request.sandbox?.environmentVars,
        timeout: request.sandbox?.timeout || this.config.defaultTimeout
      });

      return {
        exitCode: result.exitCode,
        stdout: result.stdout,
        stderr: result.stderr,
        duration: Date.now() - startTime,
        timedOut: false
      };
    } catch (error) {
      logger.error('❌ Cloudflare sandbox execution failed:', error);

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
    if (!this.initialized || !this.sandbox) {
      return false;
    }

    try {
      // Test with simple echo command
      const result = await this.sandbox.exec('echo "health check"', { timeout: 5000 });
      return result.success;
    } catch {
      return false;
    }
  }

  async shutdown(): Promise<void> {
    // Cloudflare sandboxes are managed by Durable Objects
    // No explicit cleanup needed
    this.sandbox = undefined;
    this.initialized = false;
    logger.debug('☁️ Cloudflare Sandbox provider shut down');
  }

  /**
   * Upload local script to sandbox workspace
   */
  private async uploadScript(request: ScriptExecutionRequest): Promise<string> {
    if (!this.sandbox) {
      throw new Error('Sandbox not initialized');
    }

    // Read local script file
    const fs = await import('fs/promises');
    const scriptContent = await fs.readFile(request.scriptPath, 'utf-8');

    // Determine remote path
    const scriptName = request.scriptPath.split('/').pop() || 'script';
    const remotePath = `${this.config.workspacePath}/${scriptName}`;

    // Upload to sandbox
    await this.sandbox.writeFile(remotePath, scriptContent);

    logger.debug(`☁️ Uploaded script to ${remotePath}`);
    return remotePath;
  }

  /**
   * Build execution command for runtime
   */
  private buildCommand(runtime: string, scriptPath: string, args?: string[]): string {
    const argString = args?.map(arg => `"${arg}"`).join(' ') || '';

    switch (runtime) {
      case 'python':
        return `python3 ${scriptPath} ${argString}`.trim();

      case 'typescript':
      case 'javascript':
        return `node ${scriptPath} ${argString}`.trim();

      case 'shell':
        return `bash ${scriptPath} ${argString}`.trim();

      default:
        throw new Error(`Unsupported runtime: ${runtime}`);
    }
  }
}
