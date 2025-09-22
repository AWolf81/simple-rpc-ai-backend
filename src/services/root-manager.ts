/**
 * Root Manager - Server and Client Root Folder Configuration
 *
 * Manages root folder configuration for both server-side operations and client applications.
 * Provides secure file access, path validation, and cross-platform compatibility.
 * Supports VS Code extensions, web applications, and CLI tools.
 */

import fs from 'fs';
import path from 'path';
import { EventEmitter } from 'events';

export interface RootFolderConfig {
  /** Primary root folder path - base for all operations */
  path: string;

  /** Display name for the root folder */
  name?: string;

  /** Description of the root folder purpose */
  description?: string;

  /** Whether this root folder is read-only */
  readOnly?: boolean;

  /** Additional allowed folder patterns (relative to root) */
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

  /** Custom metadata for the root folder */
  metadata?: Record<string, any>;

  /** Whether to watch for file changes */
  enableWatching?: boolean;

  /** Watch ignore patterns (glob patterns) */
  watchIgnore?: string[];
}

export interface ClientRootFolderInfo {
  /** Root folder ID for client reference */
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

  /** Relative path from root folder */
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

export interface RootManagerConfig {
  /** Default root folder configuration */
  defaultRoot?: RootFolderConfig;

  /** Multiple root folder configurations */
  roots?: Record<string, RootFolderConfig>;

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

export class RootManager extends EventEmitter {
  private config: RootManagerConfig;
  private roots: Map<string, RootFolderConfig> = new Map();
  private watchers: Map<string, any> = new Map();

  constructor(config: RootManagerConfig = {}) {
    super();
    this.config = config;
    this.initializeRoots();
  }

  private initializeRoots() {
    // Set up default root if provided
    if (this.config.defaultRoot) {
      this.addRoot('default', this.config.defaultRoot);
    }

    // Set up additional roots
    if (this.config.roots) {
      for (const [id, rootConfig] of Object.entries(this.config.roots)) {
        this.addRoot(id, rootConfig);
      }
    }

    // If no roots configured, use current working directory as default
    if (this.roots.size === 0) {
      this.addRoot('default', {
        path: process.cwd(),
        name: 'Current Directory',
        description: 'Default working directory',
        readOnly: false
      });
    }
  }

  /**
   * Add a new root folder configuration
   */
  addRoot(id: string, config: RootFolderConfig): void {
    // Validate root path exists and is accessible
    try {
      const resolvedPath = path.resolve(config.path);
      const stats = fs.statSync(resolvedPath);

      if (!stats.isDirectory()) {
        throw new Error(`Root path is not a directory: ${resolvedPath}`);
      }

      // Normalize the configuration
      const normalizedConfig: RootFolderConfig = {
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

      this.roots.set(id, normalizedConfig);

      // Set up file watching if enabled
      if (normalizedConfig.enableWatching) {
        this.setupWatcher(id, normalizedConfig);
      }

      this.emit('rootAdded', { id, config: normalizedConfig });

    } catch (error) {
      throw new Error(`Failed to add root folder '${id}': ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Remove a root folder configuration
   */
  removeRoot(id: string): boolean {
    if (!this.roots.has(id)) {
      return false;
    }

    // Clean up watcher if exists
    if (this.watchers.has(id)) {
      this.watchers.get(id)?.close();
      this.watchers.delete(id);
    }

    const removed = this.roots.delete(id);

    if (removed) {
      this.emit('rootRemoved', { id });
    }

    return removed;
  }

  /**
   * Get all configured root folders for client consumption
   */
  getClientRootFolders(): Record<string, ClientRootFolderInfo> {
    const clientRoots: Record<string, ClientRootFolderInfo> = {};

    for (const [id, config] of this.roots.entries()) {
      try {
        const stats = this.getRootStats(config.path);

        clientRoots[id] = {
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
        clientRoots[id] = {
          id,
          name: config.name || path.basename(config.path),
          description: config.description,
          accessible: false
        };
      }
    }

    return clientRoots;
  }

  /**
   * Validate and resolve a file path within a root folder
   */
  validatePath(rootId: string, relativePath: string): string {
    const rootConfig = this.roots.get(rootId);
    if (!rootConfig) {
      throw new Error(`Root folder '${rootId}' not found`);
    }

    // Resolve the path
    const fullPath = path.resolve(rootConfig.path, relativePath);

    // Security check: ensure path is within root directory
    if (!fullPath.startsWith(rootConfig.path)) {
      throw new Error(`Path '${relativePath}' is outside root directory`);
    }

    // Check against blocked paths
    const relativeFromRoot = path.relative(rootConfig.path, fullPath);
    for (const blockedPattern of rootConfig.blockedPaths || []) {
      if (this.matchesPattern(relativeFromRoot, blockedPattern)) {
        throw new Error(`Path '${relativePath}' is blocked by security policy`);
      }
    }

    // Check file extension if restricted
    const ext = path.extname(fullPath).slice(1).toLowerCase();
    if (rootConfig.blockedExtensions?.includes(ext)) {
      throw new Error(`File extension '.${ext}' is not allowed`);
    }

    if (rootConfig.allowedExtensions && !rootConfig.allowedExtensions.includes(ext)) {
      throw new Error(`File extension '.${ext}' is not in allowed list`);
    }

    return fullPath;
  }

  /**
   * List files in a root folder
   */
  async listFiles(
    rootId: string,
    relativePath: string = '',
    options: { recursive?: boolean; includeDirectories?: boolean } = {}
  ): Promise<FileInfo[]> {
    const rootConfig = this.roots.get(rootId);
    if (!rootConfig) {
      throw new Error(`Root folder '${rootId}' not found`);
    }

    const fullPath = this.validatePath(rootId, relativePath);

    try {
      const files: FileInfo[] = [];
      const entries = await fs.promises.readdir(fullPath, { withFileTypes: true });

      for (const entry of entries) {
        const entryPath = path.join(fullPath, entry.name);
        const relativeEntryPath = path.relative(rootConfig.path, entryPath);

        // Skip blocked paths
        if (this.isPathBlocked(rootConfig, relativeEntryPath)) {
          continue;
        }

        if (entry.isDirectory()) {
          if (options.includeDirectories) {
            files.push(await this.getFileInfo(rootConfig, entryPath));
          }

          if (options.recursive) {
            try {
              const subFiles = await this.listFiles(rootId, relativeEntryPath, options);
              files.push(...subFiles);
            } catch (error) {
              // Skip inaccessible directories
            }
          }
        } else {
          files.push(await this.getFileInfo(rootConfig, entryPath));
        }
      }

      return files;
    } catch (error) {
      throw new Error(`Failed to list files in '${relativePath}': ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Read file content from a root folder
   */
  async readFile(rootId: string, relativePath: string, options: { encoding?: BufferEncoding } = {}): Promise<string | Buffer> {
    const rootConfig = this.roots.get(rootId);
    if (!rootConfig) {
      throw new Error(`Root folder '${rootId}' not found`);
    }

    const fullPath = this.validatePath(rootId, relativePath);

    try {
      const stats = await fs.promises.stat(fullPath);

      if (!stats.isFile()) {
        throw new Error(`Path '${relativePath}' is not a file`);
      }

      // Check file size limits
      if (stats.size > (rootConfig.maxFileSize || 10 * 1024 * 1024)) {
        throw new Error(`File '${relativePath}' exceeds maximum size limit`);
      }

      const content = await fs.promises.readFile(fullPath, options.encoding || 'utf8');
      this.emit('fileRead', { rootId, path: relativePath, size: stats.size });

      return content;
    } catch (error) {
      throw new Error(`Failed to read file '${relativePath}': ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Write file content to a root folder (if not read-only)
   */
  async writeFile(rootId: string, relativePath: string, content: string | Buffer): Promise<void> {
    const rootConfig = this.roots.get(rootId);
    if (!rootConfig) {
      throw new Error(`Root folder '${rootId}' not found`);
    }

    if (rootConfig.readOnly) {
      throw new Error(`Root folder '${rootId}' is read-only`);
    }

    const fullPath = this.validatePath(rootId, relativePath);

    try {
      // Ensure directory exists
      const dir = path.dirname(fullPath);
      await fs.promises.mkdir(dir, { recursive: true });

      await fs.promises.writeFile(fullPath, content);
      this.emit('fileWritten', { rootId, path: relativePath, size: content.length });

    } catch (error) {
      throw new Error(`Failed to write file '${relativePath}': ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get root folder configuration
   */
  getRootConfig(rootId: string): RootFolderConfig | undefined {
    return this.roots.get(rootId);
  }

  /**
   * Get all root folder IDs
   */
  getRootIds(): string[] {
    return Array.from(this.roots.keys());
  }

  /**
   * Check if a file/path exists in a root folder
   */
  async pathExists(rootId: string, relativePath: string): Promise<boolean> {
    try {
      const fullPath = this.validatePath(rootId, relativePath);
      await fs.promises.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }

  private setupWatcher(id: string, config: RootFolderConfig): void {
    try {
      const chokidar = require('chokidar');

      const watcher = chokidar.watch(config.path, {
        ignored: config.watchIgnore || ['node_modules/**', '.git/**'],
        ignoreInitial: true,
        followSymlinks: config.followSymlinks
      });

      watcher.on('add', (filePath: string) => {
        const relativePath = path.relative(config.path, filePath);
        this.emit('fileAdded', { rootId: id, path: relativePath });
      });

      watcher.on('change', (filePath: string) => {
        const relativePath = path.relative(config.path, filePath);
        this.emit('fileChanged', { rootId: id, path: relativePath });
      });

      watcher.on('unlink', (filePath: string) => {
        const relativePath = path.relative(config.path, filePath);
        this.emit('fileRemoved', { rootId: id, path: relativePath });
      });

      this.watchers.set(id, watcher);

    } catch (error) {
      // Chokidar is optional - fail silently if not available
      console.warn(`File watching not available for root '${id}': ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private getRootStats(rootPath: string) {
    try {
      const stats = fs.statSync(rootPath);
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

  private async getFileInfo(rootConfig: RootFolderConfig, fullPath: string): Promise<FileInfo> {
    const stats = await fs.promises.stat(fullPath);
    const relativePath = path.relative(rootConfig.path, fullPath);
    const extension = path.extname(fullPath).slice(1).toLowerCase();

    // Determine MIME type
    const mimeType = this.getMimeType(extension);

    // Check read/write permissions
    let readable = true;
    let writable = !rootConfig.readOnly;

    try {
      await fs.promises.access(fullPath, fs.constants.R_OK);
    } catch {
      readable = false;
    }

    if (!rootConfig.readOnly) {
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

  private isPathBlocked(config: RootFolderConfig, relativePath: string): boolean {
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
    this.roots.clear();
    this.removeAllListeners();
  }
}

// Export a default instance for simple use cases
export const defaultRootManager = new RootManager();

// Export factory function for custom configurations
export function createRootManager(config?: RootManagerConfig): RootManager {
  return new RootManager(config);
}