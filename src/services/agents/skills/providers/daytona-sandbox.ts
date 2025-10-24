/**
 * Daytona Sandbox Provider
 *
 * Executes scripts in Daytona Sandbox - secure development environments.
 * See: https://www.daytona.io/docs/
 *
 * Features:
 * - Secure isolated development environments
 * - Git repository integration
 * - File system operations
 * - Multiple language support (Python, Node.js, TypeScript)
 * - Session management
 * - Language server protocol support
 *
 * Cost: Daytona pricing based on usage
 * Timeout: Configurable
 *
 * Installation:
 *   pnpm add @daytonaio/sdk
 *
 * Authentication:
 *   Set DAYTONA_API_KEY environment variable
 *   Or configure apiKey in provider config
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

// Type definitions for @daytonaio/sdk (peer dependency)
interface DaytonaSandboxConfig {
  apiKey?: string;
  language?: 'python' | 'typescript' | 'javascript' | 'node';
}

interface DaytonaSandbox {
  process: {
    codeRun(code: string, options?: {
      timeout?: number;
      env?: Record<string, string>;
    }): Promise<{ result: string; error?: string }>;

    createSession(options?: {
      cwd?: string;
      env?: Record<string, string>;
    }): Promise<{ sessionId: string }>;

    executeSessionCommand(sessionId: string, command: string): Promise<{
      stdout: string;
      stderr: string;
      exitCode: number;
    }>;
  };

  fs: {
    uploadFile(path: string, content: string | Buffer): Promise<void>;
    readFile(path: string): Promise<{ content: string }>;
    deleteFile(path: string): Promise<void>;
    listFiles(path: string): Promise<string[]>;
  };

  delete(): Promise<void>;
}

interface DaytonaStatic {
  new(config?: DaytonaSandboxConfig): DaytonaClient;
}

interface DaytonaClient {
  create(options: {
    language?: 'python' | 'typescript' | 'javascript' | 'node';
  }): Promise<DaytonaSandbox>;
}

interface DaytonaSandboxProviderConfig {
  apiKey?: string;
  defaultLanguage?: 'python' | 'typescript' | 'javascript' | 'node';
  defaultTimeout?: number;
  reuseSession?: boolean;
}

export class DaytonaSandboxProvider implements ISandboxProvider {
  readonly name = 'daytona';
  readonly sessionType: SandboxSessionType = 'ephemeral'; // Changed to match type definition

  private config: DaytonaSandboxProviderConfig;
  private DaytonaClass?: DaytonaStatic;
  private client?: DaytonaClient;
  private initialized = false;
  private activeSandbox?: DaytonaSandbox;
  private sessionId?: string;

  constructor(config?: DaytonaSandboxProviderConfig) {
    this.config = {
      apiKey: config?.apiKey || process.env.DAYTONA_API_KEY,
      defaultLanguage: config?.defaultLanguage || 'node',
      defaultTimeout: config?.defaultTimeout || 30000, // 30 seconds
      reuseSession: config?.reuseSession ?? true,
      ...config
    };
  }

  async initialize(sandboxConfig: SandboxConfig): Promise<void> {
    try {
      // Dynamic import of peer dependency
      // @ts-ignore - Optional peer dependency
      const daytona = await import('@daytonaio/sdk');
      this.DaytonaClass = daytona.Daytona as unknown as DaytonaStatic;

      // Create client
      this.client = new this.DaytonaClass({
        apiKey: this.config.apiKey
      });

      this.initialized = true;
      logger.debug('🏔️ Daytona Sandbox provider initialized');
    } catch (error) {
      throw new Error(
        '@daytonaio/sdk is not installed or API key not configured.\n' +
        'Install: pnpm add @daytonaio/sdk\n' +
        'Auth: Set DAYTONA_API_KEY environment variable\n' +
        `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async execute(request: ScriptExecutionRequest): Promise<ScriptExecutionResult> {
    if (!this.initialized || !this.client) {
      throw new Error('Daytona sandbox not initialized');
    }

    const startTime = Date.now();

    try {
      // Get or create sandbox
      const sandbox = await this.getOrCreateSandbox(request.runtime);

      // Upload script if local path
      if (!request.scriptPath.startsWith('http')) {
        await this.uploadScript(sandbox, request);
      }

      // Execute script
      const result = await this.runScript(sandbox, request);

      // Cleanup if not reusing sessions
      if (!this.config.reuseSession) {
        await sandbox.delete();
        this.activeSandbox = undefined;
        this.sessionId = undefined;
      }

      return {
        ...result,
        duration: Date.now() - startTime
      };
    } catch (error) {
      logger.error('❌ Daytona sandbox execution failed:', error);

      // Cleanup on error
      if (this.activeSandbox && !this.config.reuseSession) {
        try {
          await this.activeSandbox.delete();
        } catch {}
        this.activeSandbox = undefined;
        this.sessionId = undefined;
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
    if (!this.initialized || !this.client) {
      return false;
    }

    try {
      // Test sandbox creation
      const sandbox = await this.client.create({ language: 'node' });
      const result = await sandbox.process.codeRun('console.log("ok")', { timeout: 5000 });
      await sandbox.delete();
      return result.result === 'ok\n';
    } catch {
      return false;
    }
  }

  async shutdown(): Promise<void> {
    if (this.activeSandbox) {
      try {
        await this.activeSandbox.delete();
      } catch {}
      this.activeSandbox = undefined;
      this.sessionId = undefined;
    }
    this.client = undefined;
    this.initialized = false;
    logger.debug('🏔️ Daytona Sandbox provider shut down');
  }

  /**
   * Get or create sandbox instance
   */
  private async getOrCreateSandbox(runtime: string): Promise<DaytonaSandbox> {
    if (this.config.reuseSession && this.activeSandbox) {
      return this.activeSandbox;
    }

    if (!this.client) {
      throw new Error('Daytona client not initialized');
    }

    const language = this.mapRuntimeToLanguage(runtime);
    const sandbox = await this.client.create({ language });
    this.activeSandbox = sandbox;

    logger.debug(`🏔️ Created Daytona sandbox with ${language} runtime`);
    return sandbox;
  }

  /**
   * Upload script to sandbox
   */
  private async uploadScript(sandbox: DaytonaSandbox, request: ScriptExecutionRequest): Promise<void> {
    // Read local script file
    const fs = await import('fs/promises');
    const scriptContent = await fs.readFile(request.scriptPath, 'utf-8');

    // Upload to sandbox
    const scriptName = request.scriptPath.split('/').pop() || 'script';
    const remotePath = `/workspace/${scriptName}`;

    await sandbox.fs.uploadFile(remotePath, scriptContent);
    logger.debug(`🏔️ Uploaded script to ${remotePath}`);
  }

  /**
   * Run script in sandbox
   */
  private async runScript(
    sandbox: DaytonaSandbox,
    request: ScriptExecutionRequest
  ): Promise<Omit<ScriptExecutionResult, 'duration'>> {
    // Get or create session
    if (!this.sessionId || !this.config.reuseSession) {
      const session = await sandbox.process.createSession({
        cwd: request.cwd || '/workspace',
        env: request.sandbox?.environmentVars
      });
      this.sessionId = session.sessionId;
    }

    // Build command
    const command = this.buildCommand(request);

    // Execute in session
    logger.debug(`🏔️ Executing: ${command}`);
    const result = await sandbox.process.executeSessionCommand(this.sessionId, command);

    return {
      exitCode: result.exitCode,
      stdout: result.stdout,
      stderr: result.stderr,
      timedOut: false
    };
  }

  /**
   * Build execution command
   */
  private buildCommand(request: ScriptExecutionRequest): string {
    const scriptName = request.scriptPath.split('/').pop() || 'script';
    const remotePath = `/workspace/${scriptName}`;
    const argString = request.args?.map(arg => `"${arg}"`).join(' ') || '';

    switch (request.runtime) {
      case 'python':
        return `python3 ${remotePath} ${argString}`.trim();

      case 'typescript':
        return `npx tsx ${remotePath} ${argString}`.trim();

      case 'javascript':
        return `node ${remotePath} ${argString}`.trim();

      case 'shell':
        return `bash ${remotePath} ${argString}`.trim();

      default:
        throw new Error(`Unsupported runtime: ${request.runtime}`);
    }
  }

  /**
   * Map skill runtime to Daytona language
   */
  private mapRuntimeToLanguage(runtime: string): 'python' | 'typescript' | 'javascript' | 'node' {
    switch (runtime) {
      case 'python':
        return 'python';
      case 'typescript':
        return 'typescript';
      case 'javascript':
        return 'javascript';
      case 'shell':
        return 'node'; // Use node runtime for shell scripts
      default:
        return this.config.defaultLanguage || 'node';
    }
  }
}
