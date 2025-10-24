/**
 * Sandbox Provider Interface
 *
 * Pluggable architecture for different sandbox backends:
 * - Local (development, direct process execution)
 * - Fly Machines (production, ephemeral containers)
 * - Vercel Sandbox (serverless)
 * - E2B, Modal, AWS, etc.
 *
 * Inspired by: https://docs.claude.com/en/api/agent-sdk/hosting
 */

import type {
  ScriptExecutionRequest,
  ScriptExecutionResult,
  SandboxConfig
} from './types';

/**
 * Sandbox session lifecycle types
 */
export type SandboxSessionType =
  | 'ephemeral'    // New container per task, destroyed after
  | 'long-running' // Persistent for proactive agents
  | 'hybrid';      // Ephemeral with state hydration

/**
 * Sandbox provider interface - implement this for each backend
 */
export interface ISandboxProvider {
  /**
   * Provider name (e.g., 'local', 'fly', 'vercel')
   */
  readonly name: string;

  /**
   * Session type supported by this provider
   */
  readonly sessionType: SandboxSessionType;

  /**
   * Initialize the sandbox provider
   */
  initialize(config: SandboxConfig): Promise<void>;

  /**
   * Execute a script in the sandbox
   */
  execute(request: ScriptExecutionRequest): Promise<ScriptExecutionResult>;

  /**
   * Create a new sandbox session (for long-running/hybrid)
   */
  createSession?(sessionId: string): Promise<void>;

  /**
   * Destroy a sandbox session
   */
  destroySession?(sessionId: string): Promise<void>;

  /**
   * Check if sandbox is healthy
   */
  healthCheck(): Promise<boolean>;

  /**
   * Get resource usage stats
   */
  getStats?(): Promise<{
    memory: number;
    cpu: number;
    executions: number;
  }>;

  /**
   * Cleanup resources
   */
  shutdown(): Promise<void>;
}

/**
 * Sandbox provider configuration
 */
export interface SandboxProviderConfig {
  type: 'local' | 'fly' | 'vercel' | 'e2b' | 'modal' | 'custom';
  sessionType?: SandboxSessionType;

  // Provider-specific config
  local?: {
    allowedPaths?: string[];
    timeout?: number;
    maxMemory?: number;
  };

  fly?: {
    appName: string;
    apiToken: string;
    region?: string; // e.g., 'ord', 'lax', 'fra'
    machineSize?: 'shared-cpu-1x' | 'shared-cpu-2x' | 'shared-cpu-4x';
    autoDestroy?: boolean; // Destroy after execution
  };

  vercel?: {
    deploymentId?: string;
    token?: string;
  };

  e2b?: {
    apiKey: string;
    template?: string;
  };

  modal?: {
    tokenId: string;
    tokenSecret: string;
    image?: string;
  };

  custom?: {
    endpoint: string;
    auth?: string;
    [key: string]: any;
  };
}

/**
 * Factory for creating sandbox providers
 */
export class SandboxProviderFactory {
  static async create(config: SandboxProviderConfig): Promise<ISandboxProvider> {
    switch (config.type) {
      case 'local': {
        const { LocalSandboxProvider } = await import('./providers/local-sandbox');
        return new LocalSandboxProvider(config.local);
      }

      case 'fly': {
        const { FlyMachinesSandboxProvider } = await import('./providers/fly-sandbox');
        return new FlyMachinesSandboxProvider(config.fly);
      }

      case 'vercel': {
        const { VercelSandboxProvider } = await import('./providers/vercel-sandbox');
        return new VercelSandboxProvider(config.vercel);
      }

      // TODO: Implement additional providers
      // case 'e2b': {
      //   const { E2BSandboxProvider } = await import('./providers/e2b-sandbox');
      //   return new E2BSandboxProvider(config.e2b);
      // }

      // case 'modal': {
      //   const { ModalSandboxProvider } = await import('./providers/modal-sandbox');
      //   return new ModalSandboxProvider(config.modal);
      // }

      // case 'custom': {
      //   const { CustomSandboxProvider } = await import('./providers/custom-sandbox');
      //   return new CustomSandboxProvider(config.custom);
      // }

      default:
        throw new Error(`Unknown sandbox provider type: ${config.type}`);
    }
  }
}
