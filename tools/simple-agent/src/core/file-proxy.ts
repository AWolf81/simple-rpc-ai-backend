/**
 * File Proxy - Enables local file access for remote servers
 *
 * When simple-agent connects to a remote server, this proxy:
 * 1. Registers the local workspace with the server
 * 2. Intercepts file operation requests from the server
 * 3. Performs operations on the local filesystem
 * 4. Returns results to the server
 *
 * This enables remote servers to work with local files without direct filesystem access.
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, resolve, relative } from 'path';
import type { RPCClient } from 'simple-rpc-ai-backend/client';

export interface FileProxyOptions {
  /** The RPC client connected to the server */
  client: RPCClient;

  /** Local workspace directory to expose */
  workspaceDir: string;

  /** Workspace identifier (defaults to basename) */
  workspaceId?: string;

  /** Workspace display name */
  workspaceName?: string;

  /** Enable verbose logging */
  verbose?: boolean;
}

export class FileProxy {
  private client: RPCClient;
  private workspaceDir: string;
  private workspaceId: string;
  private workspaceName: string;
  private verbose: boolean;
  private registered: boolean = false;

  constructor(options: FileProxyOptions) {
    this.client = options.client;
    this.workspaceDir = resolve(options.workspaceDir);
    this.workspaceId = options.workspaceId || `workspace-${Date.now()}`;
    this.workspaceName = options.workspaceName || this.workspaceDir.split('/').pop() || 'workspace';
    this.verbose = options.verbose || false;
  }

  /**
   * Initialize the file proxy and register workspace with server
   */
  async initialize(): Promise<void> {
    if (this.registered) {
      return;
    }

    try {
      if (this.verbose) {
        console.log(`📁 Registering local workspace: ${this.workspaceDir}`);
      }

      // Register workspace with remote server
      const result = await this.client.request('system.registerClientWorkspace', {
        id: this.workspaceId,
        uri: `file://${this.workspaceDir}`,
        name: this.workspaceName,
        description: `Local workspace proxied by simple-agent`
      });

      if (result.success) {
        this.registered = true;
        if (this.verbose) {
          console.log(`✅ Workspace registered: ${result.message}`);
        }
      } else {
        console.warn(`⚠️  Failed to register workspace: ${result.message}`);
      }
    } catch (error) {
      console.error('❌ Failed to register workspace:', error instanceof Error ? error.message : error);
      // Don't throw - proxy can still work even if registration fails
    }
  }

  /**
   * Cleanup - unregister workspace from server
   */
  async cleanup(): Promise<void> {
    if (!this.registered) {
      return;
    }

    try {
      await this.client.request('system.unregisterClientWorkspace', {
        id: this.workspaceId
      });

      if (this.verbose) {
        console.log(`✅ Workspace unregistered: ${this.workspaceId}`);
      }
    } catch (error) {
      console.error('❌ Failed to unregister workspace:', error instanceof Error ? error.message : error);
    }
  }

  /**
   * List files in a directory (relative to workspace)
   */
  listFiles(relativePath: string = '.'): string[] {
    const fullPath = this.resolvePath(relativePath);
    this.validatePath(fullPath);

    try {
      const entries = readdirSync(fullPath);
      return entries.map(entry => {
        const entryPath = join(fullPath, entry);
        const stat = statSync(entryPath);
        return stat.isDirectory() ? `${entry}/` : entry;
      });
    } catch (error) {
      throw new Error(`Failed to list files: ${error instanceof Error ? error.message : error}`);
    }
  }

  /**
   * Read file contents (relative to workspace)
   */
  readFile(relativePath: string): string {
    const fullPath = this.resolvePath(relativePath);
    this.validatePath(fullPath);

    try {
      return readFileSync(fullPath, 'utf-8');
    } catch (error) {
      throw new Error(`Failed to read file: ${error instanceof Error ? error.message : error}`);
    }
  }

  /**
   * Write file contents (relative to workspace)
   */
  writeFile(relativePath: string, content: string): void {
    const fullPath = this.resolvePath(relativePath);
    this.validatePath(fullPath);

    try {
      writeFileSync(fullPath, content, 'utf-8');
      if (this.verbose) {
        console.log(`✅ Wrote file: ${relativePath}`);
      }
    } catch (error) {
      throw new Error(`Failed to write file: ${error instanceof Error ? error.message : error}`);
    }
  }

  /**
   * Check if path exists (relative to workspace)
   */
  pathExists(relativePath: string): boolean {
    const fullPath = this.resolvePath(relativePath);

    // Don't validate path - we want to check if it exists even outside workspace
    return existsSync(fullPath);
  }

  /**
   * Resolve relative path to absolute path within workspace
   */
  private resolvePath(relativePath: string): string {
    // Remove leading slash if present
    const cleanPath = relativePath.startsWith('/') ? relativePath.slice(1) : relativePath;
    return resolve(this.workspaceDir, cleanPath);
  }

  /**
   * Validate that path is within workspace (security check)
   */
  private validatePath(fullPath: string): void {
    const rel = relative(this.workspaceDir, fullPath);

    // Check for path traversal attempts
    if (rel.startsWith('..') || resolve(fullPath).indexOf(this.workspaceDir) !== 0) {
      throw new Error(`Access denied: Path outside workspace: ${fullPath}`);
    }
  }

  /**
   * Get workspace info
   */
  getWorkspaceInfo() {
    return {
      id: this.workspaceId,
      path: this.workspaceDir,
      name: this.workspaceName,
      registered: this.registered
    };
  }
}
