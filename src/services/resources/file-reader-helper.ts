/**
 * Simple File Reader Helper
 *
 * Provides an easy-to-use API for creating file-reading MCP resources
 * that integrate with the root manager for secure file access.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { createTemplate } from './template-engine.js';
import type { RootManager } from './root-manager.js';

export interface FileReaderConfig {
  /** Resource ID */
  id: string;
  /** Display name */
  name: string;
  /** Description */
  description: string;
  /** Root manager instance */
  rootManager: RootManager;
  /** Allowed file extensions (optional) */
  allowedExtensions?: string[];
  /** Maximum file size in bytes (default: 10MB) */
  maxFileSize?: number;
  /** Whether to include file metadata */
  includeMetadata?: boolean;
}

export interface FileMetadata {
  path: string;
  size: number;
  mtime: string;
  extension: string;
  encoding?: string;
}

export interface FileContent {
  content: string;
  metadata?: FileMetadata;
  format: string;
}

/**
 * Create a simple file reader template
 */
export function createFileReader(config: FileReaderConfig) {
  const {
    id,
    name,
    description,
    rootManager,
    allowedExtensions,
    maxFileSize = 10 * 1024 * 1024, // 10MB
    includeMetadata = true
  } = config;

  return createTemplate(id)
    .name(name)
    .description(description)
    .parameter('rootId', { type: 'string', description: 'Root folder ID', required: true })
    .parameter('path', { type: 'string', description: 'File path relative to root folder', required: true })
    .enumParameter('format', ['raw', 'base64', 'json', 'metadata'], 'Output format')
    .stringParameter('encoding', 'Text encoding for raw format')
    .generator(async (params) => {
      const { rootId, path: filePath, format, encoding } = params;

      try {
        // Get root folder configuration
        const rootConfig = rootManager.getRootConfig(rootId);
        if (!rootConfig) {
          throw new Error(`Root folder not found: ${rootId}`);
        }

        // Construct absolute file path
        const absolutePath = path.join(rootConfig.path, filePath);

        // Security check: ensure path is within root
        const resolvedPath = path.resolve(absolutePath);
        const resolvedRoot = path.resolve(rootConfig.path);
        if (!resolvedPath.startsWith(resolvedRoot)) {
          throw new Error('Path outside root folder not allowed');
        }

        // Check if file exists
        const stats = await fs.stat(resolvedPath);
        if (!stats.isFile()) {
          throw new Error('Path is not a file');
        }

        // Check file size
        if (stats.size > maxFileSize) {
          throw new Error(`File too large: ${stats.size} bytes (max: ${maxFileSize})`);
        }

        // Check file extension
        const ext = path.extname(filePath).toLowerCase();
        if (allowedExtensions && !allowedExtensions.includes(ext)) {
          throw new Error(`File extension not allowed: ${ext}`);
        }

        // Prepare metadata
        const metadata: FileMetadata = {
          path: filePath,
          size: stats.size,
          mtime: stats.mtime.toISOString(),
          extension: ext,
          encoding: format === 'raw' ? encoding : undefined
        };

        // Handle metadata-only request
        if (format === 'metadata') {
          return {
            content: JSON.stringify(metadata, null, 2),
            mimeType: 'application/json'
          };
        }

        // Read file content
        let content: string;
        let mimeType: string;

        if (format === 'base64') {
          const buffer = await fs.readFile(resolvedPath);
          content = buffer.toString('base64');
          mimeType = 'text/plain';
        } else if (format === 'json') {
          const rawContent = await fs.readFile(resolvedPath, encoding as BufferEncoding);
          const result: FileContent = {
            content: rawContent,
            metadata: includeMetadata ? metadata : undefined,
            format
          };
          content = JSON.stringify(result, null, 2);
          mimeType = 'application/json';
        } else {
          // Raw format
          content = await fs.readFile(resolvedPath, encoding as BufferEncoding);

          // Determine MIME type based on extension
          const mimeTypes: Record<string, string> = {
            '.txt': 'text/plain',
            '.md': 'text/markdown',
            '.js': 'application/javascript',
            '.ts': 'application/typescript',
            '.json': 'application/json',
            '.xml': 'application/xml',
            '.html': 'text/html',
            '.css': 'text/css',
            '.py': 'text/x-python',
            '.java': 'text/x-java-source',
            '.cpp': 'text/x-c++src',
            '.c': 'text/x-csrc',
            '.rs': 'text/x-rust',
            '.go': 'text/x-go',
            '.php': 'application/x-php',
            '.rb': 'text/x-ruby',
            '.sh': 'application/x-sh',
            '.yml': 'application/x-yaml',
            '.yaml': 'application/x-yaml'
          };

          mimeType = mimeTypes[ext] || 'text/plain';
        }

        return { content, mimeType };

      } catch (error) {
        throw new Error(`Failed to read file: ${error instanceof Error ? error.message : String(error)}`);
      }
    });
}

/**
 * Create a directory listing template
 */
export function createDirectoryLister(config: Omit<FileReaderConfig, 'allowedExtensions' | 'maxFileSize'>) {
  const { id, name, description, rootManager, includeMetadata = true } = config;

  return createTemplate(id)
    .name(name)
    .description(description)
    .parameter('rootId', { type: 'string', description: 'Root folder ID', required: true })
    .parameter('path', { type: 'string', description: 'Directory path relative to root folder', default: '' })
    .enumParameter('format', ['json', 'list', 'tree'], 'Output format')
    .enumParameter('filter', ['all', 'files', 'directories'], 'Filter type')
    .stringParameter('extension', 'Filter by file extension (e.g., .js)')
    .generator(async (params) => {
      const { rootId, path: dirPath = '', format, filter, extension } = params;

      try {
        // Get root folder configuration
        const rootConfig = rootManager.getRootConfig(rootId);
        if (!rootConfig) {
          throw new Error(`Root folder not found: ${rootId}`);
        }

        // Construct absolute directory path
        const absolutePath = path.join(rootConfig.path, dirPath);

        // Security check: ensure path is within root
        const resolvedPath = path.resolve(absolutePath);
        const resolvedRoot = path.resolve(rootConfig.path);
        if (!resolvedPath.startsWith(resolvedRoot)) {
          throw new Error('Path outside root folder not allowed');
        }

        // Read directory
        const entries = await fs.readdir(resolvedPath, { withFileTypes: true });

        // Filter entries
        let filteredEntries = entries;
        if (filter === 'files') {
          filteredEntries = entries.filter(entry => entry.isFile());
        } else if (filter === 'directories') {
          filteredEntries = entries.filter(entry => entry.isDirectory());
        }

        // Filter by extension
        if (extension && extension.startsWith('.')) {
          filteredEntries = filteredEntries.filter(entry =>
            entry.isFile() && entry.name.toLowerCase().endsWith(extension.toLowerCase())
          );
        }

        // Prepare results
        const results = await Promise.all(
          filteredEntries.map(async (entry) => {
            const entryPath = path.join(resolvedPath, entry.name);
            const relativePath = path.join(dirPath, entry.name);

            let metadata: any = {
              name: entry.name,
              path: relativePath,
              type: entry.isFile() ? 'file' : 'directory'
            };

            if (includeMetadata) {
              try {
                const stats = await fs.stat(entryPath);
                metadata = {
                  ...metadata,
                  size: stats.size,
                  mtime: stats.mtime.toISOString(),
                  extension: entry.isFile() ? path.extname(entry.name) : null
                };
              } catch (error) {
                // Skip if can't read stats
              }
            }

            return metadata;
          })
        );

        // Format output
        if (format === 'list') {
          const content = results.map(r => `${r.type === 'directory' ? 'd' : 'f'} ${r.path}`).join('\n');
          return { content, mimeType: 'text/plain' };
        }

        if (format === 'tree') {
          const content = results.map(r =>
            `${r.type === 'directory' ? '📁' : '📄'} ${r.name}${r.size ? ` (${r.size} bytes)` : ''}`
          ).join('\n');
          return { content, mimeType: 'text/plain' };
        }

        // JSON format (default)
        const result = {
          rootId,
          path: dirPath,
          totalEntries: results.length,
          entries: results
        };

        return {
          content: JSON.stringify(result, null, 2),
          mimeType: 'application/json'
        };

      } catch (error) {
        throw new Error(`Failed to list directory: ${error instanceof Error ? error.message : String(error)}`);
      }
    });
}

/**
 * Quick helper for common file reader setups
 */
export class FileReaderHelpers {
  /**
   * Create a basic text file reader
   */
  static textFileReader(rootManager: RootManager, id: string = 'text-file-reader') {
    return createFileReader({
      id,
      name: 'Text File Reader',
      description: 'Read text files from configured root directories',
      rootManager,
      allowedExtensions: ['.txt', '.md', '.js', '.ts', '.json', '.xml', '.html', '.css', '.py', '.java', '.cpp', '.c', '.rs', '.go', '.php', '.rb', '.sh', '.yml', '.yaml'],
      maxFileSize: 5 * 1024 * 1024 // 5MB for text files
    });
  }

  /**
   * Create a code file reader
   */
  static codeFileReader(rootManager: RootManager, id: string = 'code-file-reader') {
    return createFileReader({
      id,
      name: 'Code File Reader',
      description: 'Read source code files with syntax highlighting support',
      rootManager,
      allowedExtensions: ['.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.cpp', '.c', '.rs', '.go', '.php', '.rb', '.cs', '.swift', '.kt'],
      maxFileSize: 2 * 1024 * 1024 // 2MB for code files
    });
  }

  /**
   * Create a configuration file reader
   */
  static configFileReader(rootManager: RootManager, id: string = 'config-file-reader') {
    return createFileReader({
      id,
      name: 'Configuration File Reader',
      description: 'Read configuration files (JSON, YAML, XML, etc.)',
      rootManager,
      allowedExtensions: ['.json', '.yml', '.yaml', '.xml', '.toml', '.ini', '.conf', '.env'],
      maxFileSize: 1 * 1024 * 1024 // 1MB for config files
    });
  }

  /**
   * Create a directory browser
   */
  static directoryBrowser(rootManager: RootManager, id: string = 'directory-browser') {
    return createDirectoryLister({
      id,
      name: 'Directory Browser',
      description: 'Browse directories and list files within configured root folders',
      rootManager
    });
  }
}