/**
 * Workspace Manager - Server-Side Workspace Configuration
 *
 * Manages server-side workspace configuration for secure file access operations.
 * Provides secure file access, path validation, and cross-platform compatibility.
 *
 * NOTE: This is separate from MCP roots, which are client-managed workspace locations.
 * Server workspaces are configured and controlled by the server for its own operations.
 */

import fs from 'fs';
import path from 'path';
import { EventEmitter } from 'events';

export interface ServerWorkspaceConfig {
  /** Primary workspace folder path - base for all operations */
  path: string;

  /** Display name for the workspace folder */
  name?: string;

  /** Description of the workspace folder purpose */
  description?: string;

  /** Whether this workspace folder is read-only */
  readOnly?: boolean;

  /** Additional allowed folder patterns (relative to workspace) */
  allowedPaths?: string[];

  /** Explicitly blocked paths (for security) */
  blockedPaths?: string[];

  /** Maximum file size to read (in bytes) */
  maxFileSize?: number;

  /** Allowed file extensions (without dot, e.g., ['ts', 'js', 'md']) */
  allowedExtensions?: string[];

  /** Blocked file extensions (for security) */
  blockedExtensions?: string[];

  /** Whether to follow symbolic links */
  followSymlinks?: boolean;

  /** Custom metadata for the workspace folder */
  metadata?: Record<string, any>;

  /** Whether to watch for file changes */
  enableWatching?: boolean;

  /** Watch ignore patterns (glob patterns) */
  watchIgnore?: string[];
}

export interface ClientWorkspaceInfo {
  /** Workspace folder ID for client reference */
  id: string;

  /** Display name for the client */
  name: string;

  /** Description shown to users */
  description?: string;

  /** Whether the folder is currently accessible */
  accessible: boolean;

  /** Last access time */
  lastAccessed?: Date;

  /** Folder statistics */
  stats?: {
    totalFiles: number;
    totalSize: number;
    lastModified: Date;
  };

  /** Configuration hints for clients */
  clientHints?: {
    /** Suggested file extensions to show */
    preferredExtensions?: string[];

    /** Default search patterns */
    searchPatterns?: string[];

    /** Whether folder supports real-time updates */
    supportsWatching?: boolean;
  };
}

export interface FileInfo {
  /** Absolute file path */
  path: string;

  /** Relative path from workspace folder */
  relativePath: string;

  /** File name */
  name: string;

  /** File extension */
  extension: string;

  /** File size in bytes */
  size: number;

  /** Last modified time */
  lastModified: Date;

  /** Whether it's a directory */
  isDirectory: boolean;

  /** MIME type (if determinable) */
  mimeType?: string;

  /** Whether file is readable */
  readable: boolean;

  /** Whether file is writable */
  writable: boolean;
}

export interface WorkspaceManagerConfig {
  /** Default workspace folder configuration */
  defaultWorkspace?: ServerWorkspaceConfig;

  /** Multiple workspace folder configurations */
  serverWorkspaces?: Record<string, ServerWorkspaceConfig>;

  /** Global security settings */
  security?: {
    /** Maximum total file size for operations */
    maxTotalFileSize?: number;

    /** Maximum files to process in one operation */
    maxFilesPerOperation?: number;

    /** Whether to enable strict path validation */
    strictPathValidation?: boolean;

    /** Allowed protocols for external resources */
    allowedProtocols?: string[];
  };

  /** Default client configuration */
  clientDefaults?: {
    /** Default file size limit for client operations */
    maxFileSize?: number;

    /** Default extensions to show */
    defaultExtensions?: string[];

    /** Default search depth */
    maxSearchDepth?: number;
  };
}

export class WorkspaceManager extends EventEmitter {
  private config: WorkspaceManagerConfig;
  private workspaces: Map<string, ServerWorkspaceConfig> = new Map();
  private watchers: Map<string, any> = new Map();

  constructor(config: WorkspaceManagerConfig = {}) {
    super();
    this.config = config;
    this.initializeWorkspaces();
  }

  private initializeWorkspaces() {
    // Set up default workspace if provided
    if (this.config.defaultWorkspace) {
      this.addWorkspace('default', this.config.defaultWorkspace);
    }

    // Set up additional workspaces
    if (this.config.serverWorkspaces) {
      for (const [id, workspaceConfig] of Object.entries(this.config.serverWorkspaces)) {
        this.addWorkspace(id, workspaceConfig);
      }
    }

    // If no workspaces configured, use current working directory as default
    if (this.workspaces.size === 0) {
      this.addWorkspace('default', {
        path: process.cwd(),
        name: 'Current Directory',
        description: 'Default working directory',
        readOnly: false
      });
    }
  }

  /**
   * Add a new workspace folder configuration
   */
  addWorkspace(id: string, config: ServerWorkspaceConfig): void {
    // Validate workspace path exists and is accessible
    try {
      const resolvedPath = path.resolve(config.path);
      const stats = fs.statSync(resolvedPath);

      if (!stats.isDirectory()) {
        throw new Error(`Workspace path is not a directory: ${resolvedPath}`);
      }

      // Normalize the configuration
      const normalizedConfig: ServerWorkspaceConfig = {
        ...config,
        path: resolvedPath,
        name: config.name || path.basename(resolvedPath),
        readOnly: config.readOnly ?? false,
        allowedPaths: config.allowedPaths || ['**/*'],
        blockedPaths: config.blockedPaths || ['node_modules/**', '.git/**', '*.log'],
        maxFileSize: config.maxFileSize || (10 * 1024 * 1024), // 10MB default
        allowedExtensions: config.allowedExtensions,
        blockedExtensions: config.blockedExtensions || ['exe', 'bin', 'so', 'dll'],
        followSymlinks: config.followSymlinks ?? false,
        enableWatching: config.enableWatching ?? false,
        watchIgnore: config.watchIgnore || ['node_modules/**', '.git/**', '*.log']
      };

      this.workspaces.set(id, normalizedConfig);

      // Set up file watching if enabled
      if (normalizedConfig.enableWatching) {
        this.setupWatcher(id, normalizedConfig);
      }

      this.emit('workspaceAdded', { id, config: normalizedConfig });

    } catch (error) {
      throw new Error(`Failed to add workspace folder '${id}': ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Remove a workspace folder configuration
   */
  removeWorkspace(id: string): boolean {
    if (!this.workspaces.has(id)) {
      return false;
    }

    // Clean up watcher if exists
    if (this.watchers.has(id)) {
      this.watchers.get(id)?.close();
      this.watchers.delete(id);
    }

    const removed = this.workspaces.delete(id);

    if (removed) {
      this.emit('workspaceRemoved', { id });
    }

    return removed;
  }

  /**
   * Get all configured workspace folders for client consumption
   */
  getClientWorkspaceFolders(): Record<string, ClientWorkspaceInfo> {
    const clientWorkspaces: Record<string, ClientWorkspaceInfo> = {};

    for (const [id, config] of this.workspaces.entries()) {
      try {
        const stats = this.getWorkspaceStats(config.path);

        clientWorkspaces[id] = {
          id,
          name: config.name || path.basename(config.path),
          description: config.description,
          accessible: true,
          lastAccessed: new Date(),
          stats,
          clientHints: {
            preferredExtensions: config.allowedExtensions,
            searchPatterns: config.allowedPaths,
            supportsWatching: config.enableWatching
          }
        };
      } catch (error) {
        clientWorkspaces[id] = {
          id,
          name: config.name || path.basename(config.path),
          description: config.description,
          accessible: false
        };
      }
    }

    return clientWorkspaces;
  }

  /**
   * Validate and resolve a file path within a workspace folder
   */
  validatePath(workspaceId: string, relativePath: string): string {
    const workspaceConfig = this.workspaces.get(workspaceId);
    if (!workspaceConfig) {
      throw new Error(`Workspace folder '${workspaceId}' not found`);
    }

    // Resolve the path
    const fullPath = path.resolve(workspaceConfig.path, relativePath);

    // Security check: ensure path is within workspace directory
    if (!fullPath.startsWith(workspaceConfig.path)) {
      throw new Error(`Path '${relativePath}' is outside workspace directory`);
    }

    // Check against blocked paths
    const relativeFromWorkspace = path.relative(workspaceConfig.path, fullPath);
    for (const blockedPattern of workspaceConfig.blockedPaths || []) {
      if (this.matchesPattern(relativeFromWorkspace, blockedPattern)) {
        throw new Error(`Path '${relativePath}' is blocked by security policy`);
      }
    }

    // Check file extension if restricted
    const ext = path.extname(fullPath).slice(1).toLowerCase();
    if (workspaceConfig.blockedExtensions?.includes(ext)) {
      throw new Error(`File extension '.${ext}' is not allowed`);
    }

    if (workspaceConfig.allowedExtensions && !workspaceConfig.allowedExtensions.includes(ext)) {
      throw new Error(`File extension '.${ext}' is not in allowed list`);
    }

    return fullPath;
  }

  /**
   * List files in a workspace folder
   */
  async listFiles(
    workspaceId: string,
    relativePath: string = '',
    options: { recursive?: boolean; includeDirectories?: boolean } = {}
  ): Promise<FileInfo[]> {
    const workspaceConfig = this.workspaces.get(workspaceId);
    if (!workspaceConfig) {
      throw new Error(`Workspace folder '${workspaceId}' not found`);
    }

    const fullPath = this.validatePath(workspaceId, relativePath);

    try {
      const files: FileInfo[] = [];
      const entries = await fs.promises.readdir(fullPath, { withFileTypes: true });

      for (const entry of entries) {
        const entryPath = path.join(fullPath, entry.name);
        const relativeEntryPath = path.relative(workspaceConfig.path, entryPath);

        // Skip blocked paths
        if (this.isPathBlocked(workspaceConfig, relativeEntryPath)) {
          continue;
        }

        if (entry.isDirectory()) {
          if (options.includeDirectories) {
            files.push(await this.getFileInfo(workspaceConfig, entryPath));
          }

          if (options.recursive) {
            try {
              const subFiles = await this.listFiles(workspaceId, relativeEntryPath, options);
              files.push(...subFiles);
            } catch (error) {
              // Skip inaccessible directories
            }
          }
        } else {
          files.push(await this.getFileInfo(workspaceConfig, entryPath));
        }
      }

      return files;
    } catch (error) {
      throw new Error(`Failed to list files in '${relativePath}': ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Read file content from a workspace folder
   */
  async readFile(workspaceId: string, relativePath: string, options: { encoding?: BufferEncoding } = {}): Promise<string | Buffer> {
    const workspaceConfig = this.workspaces.get(workspaceId);
    if (!workspaceConfig) {
      throw new Error(`Workspace folder '${workspaceId}' not found`);
    }

    const fullPath = this.validatePath(workspaceId, relativePath);

    try {
      const stats = await fs.promises.stat(fullPath);

      if (!stats.isFile()) {
        throw new Error(`Path '${relativePath}' is not a file`);
      }

      // Check file size limits
      if (stats.size > (workspaceConfig.maxFileSize || 10 * 1024 * 1024)) {
        throw new Error(`File '${relativePath}' exceeds maximum size limit`);
      }

      const content = await fs.promises.readFile(fullPath, options.encoding || 'utf8');
      this.emit('fileRead', { workspaceId, path: relativePath, size: stats.size });

      return content;
    } catch (error) {
      throw new Error(`Failed to read file '${relativePath}': ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Write file content to a workspace folder (if not read-only)
   */
  async writeFile(workspaceId: string, relativePath: string, content: string | Buffer): Promise<void> {
    const workspaceConfig = this.workspaces.get(workspaceId);
    if (!workspaceConfig) {
      throw new Error(`Workspace folder '${workspaceId}' not found`);
    }

    if (workspaceConfig.readOnly) {
      throw new Error(`Workspace folder '${workspaceId}' is read-only`);
    }

    const fullPath = this.validatePath(workspaceId, relativePath);

    try {
      // Ensure directory exists
      const dir = path.dirname(fullPath);
      await fs.promises.mkdir(dir, { recursive: true });

      await fs.promises.writeFile(fullPath, content);
      this.emit('fileWritten', { workspaceId, path: relativePath, size: content.length });

    } catch (error) {
      throw new Error(`Failed to write file '${relativePath}': ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get workspace folder configuration
   */
  getWorkspaceConfig(workspaceId: string): ServerWorkspaceConfig | undefined {
    return this.workspaces.get(workspaceId);
  }

  /**
   * Get all workspace folder IDs
   */
  getWorkspaceIds(): string[] {
    return Array.from(this.workspaces.keys());
  }

  /**
   * Check if a file/path exists in a workspace folder
   */
  async pathExists(workspaceId: string, relativePath: string): Promise<boolean> {
    try {
      const fullPath = this.validatePath(workspaceId, relativePath);
      await fs.promises.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get file stats from a workspace folder
   */
  async getFileStats(workspaceId: string, relativePath: string): Promise<fs.Stats> {
    const workspaceConfig = this.workspaces.get(workspaceId);
    if (!workspaceConfig) {
      throw new Error(`Workspace folder '${workspaceId}' not found`);
    }

    const fullPath = this.validatePath(workspaceId, relativePath);
    return await fs.promises.stat(fullPath);
  }

  private setupWatcher(id: string, config: ServerWorkspaceConfig): void {
    try {
      const chokidar = require('chokidar');

      const watcher = chokidar.watch(config.path, {
        ignored: config.watchIgnore || ['node_modules/**', '.git/**'],
        ignoreInitial: true,
        followSymlinks: config.followSymlinks
      });

      watcher.on('add', (filePath: string) => {
        const relativePath = path.relative(config.path, filePath);
        this.emit('fileAdded', { workspaceId: id, path: relativePath });
      });

      watcher.on('change', (filePath: string) => {
        const relativePath = path.relative(config.path, filePath);
        this.emit('fileChanged', { workspaceId: id, path: relativePath });
      });

      watcher.on('unlink', (filePath: string) => {
        const relativePath = path.relative(config.path, filePath);
        this.emit('fileRemoved', { workspaceId: id, path: relativePath });
      });

      this.watchers.set(id, watcher);

    } catch (error) {
      // Chokidar is optional - fail silently if not available
      console.warn(`File watching not available for workspace '${id}': ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private getWorkspaceStats(workspacePath: string) {
    try {
      const stats = fs.statSync(workspacePath);
      return {
        totalFiles: 0, // Would need recursive scan for accurate count
        totalSize: 0,  // Would need recursive scan for accurate size
        lastModified: stats.mtime
      };
    } catch {
      return {
        totalFiles: 0,
        totalSize: 0,
        lastModified: new Date()
      };
    }
  }

  private async getFileInfo(workspaceConfig: ServerWorkspaceConfig, fullPath: string): Promise<FileInfo> {
    const stats = await fs.promises.stat(fullPath);
    const relativePath = path.relative(workspaceConfig.path, fullPath);
    const extension = path.extname(fullPath).slice(1).toLowerCase();

    // Determine MIME type
    const mimeType = this.getMimeType(extension);

    // Check read/write permissions
    let readable = true;
    let writable = !workspaceConfig.readOnly;

    try {
      await fs.promises.access(fullPath, fs.constants.R_OK);
    } catch {
      readable = false;
    }

    if (!workspaceConfig.readOnly) {
      try {
        await fs.promises.access(fullPath, fs.constants.W_OK);
      } catch {
        writable = false;
      }
    }

    return {
      path: fullPath,
      relativePath,
      name: path.basename(fullPath),
      extension,
      size: stats.size,
      lastModified: stats.mtime,
      isDirectory: stats.isDirectory(),
      mimeType,
      readable,
      writable
    };
  }

  private isPathBlocked(config: ServerWorkspaceConfig, relativePath: string): boolean {
    for (const blockedPattern of config.blockedPaths || []) {
      if (this.matchesPattern(relativePath, blockedPattern)) {
        return true;
      }
    }
    return false;
  }

  private matchesPattern(filePath: string, pattern: string): boolean {
    // Simple glob pattern matching
    const regexPattern = pattern
      .replace(/\*\*/g, '.*')  // ** matches any path
      .replace(/\*/g, '[^/]*') // * matches any filename
      .replace(/\?/g, '.');    // ? matches single character

    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(filePath);
  }

  private getMimeType(extension: string): string {
    const mimeTypes: Record<string, string> = {
      'js': 'text/javascript',
      'ts': 'text/typescript',
      'json': 'application/json',
      'md': 'text/markdown',
      'txt': 'text/plain',
      'html': 'text/html',
      'css': 'text/css',
      'xml': 'text/xml',
      'yml': 'text/yaml',
      'yaml': 'text/yaml',
      'py': 'text/x-python',
      'java': 'text/x-java',
      'cpp': 'text/x-c++',
      'c': 'text/x-c',
      'h': 'text/x-c',
      'go': 'text/x-go',
      'rs': 'text/x-rust',
      'php': 'text/x-php',
      'rb': 'text/x-ruby',
      'sh': 'text/x-shellscript',
      'sql': 'text/x-sql'
    };

    return mimeTypes[extension] || 'text/plain';
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    // Close all watchers
    for (const watcher of this.watchers.values()) {
      watcher.close();
    }
    this.watchers.clear();
    this.workspaces.clear();
    this.removeAllListeners();
  }
}

// Export a default instance for simple use cases
export const defaultWorkspaceManager = new WorkspaceManager();

// Export factory function for custom configurations
export function createWorkspaceManager(config?: WorkspaceManagerConfig): WorkspaceManager {
  return new WorkspaceManager(config);
}