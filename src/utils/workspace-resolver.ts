/**
 * Workspace Resolver Utility
 *
 * Provides functionality to resolve the project/workspace root directory
 * and resolve paths relative to that root.
 */

import fs from 'fs';
import path from 'path';

/**
 * Find the project root by looking for package.json
 * Traverses up the directory tree from a starting point
 */
export function findProjectRoot(fromDir: string = process.cwd()): string {
  let currentDir = path.resolve(fromDir);

  // Traverse up the directory tree until we find package.json or reach root
  while (currentDir !== path.dirname(currentDir)) {
    try {
      const packageJsonPath = path.join(currentDir, 'package.json');
      fs.accessSync(packageJsonPath);
      return currentDir;
    } catch {
      // package.json not found in this directory, go up one level
      currentDir = path.dirname(currentDir);
    }
  }

  // If no package.json found, fall back to the starting directory
  return fromDir;
}

/**
 * Resolve a path relative to the project root
 * If the path is absolute, returns it as-is
 * If the path is relative, resolves it from the project root
 */
export function resolveFromProjectRoot(relativePath: string, projectRoot: string): string {
  if (path.isAbsolute(relativePath)) {
    return relativePath;
  }
  
  return path.join(projectRoot, relativePath);
}

/**
 * Get the project root for the current application instance
 * This can be cached for performance
 */
export class WorkspaceResolver {
  private static instance: WorkspaceResolver;
  private projectRoot: string;

  private constructor() {
    this.projectRoot = findProjectRoot();
  }

  static getInstance(): WorkspaceResolver {
    if (!WorkspaceResolver.instance) {
      WorkspaceResolver.instance = new WorkspaceResolver();
    }
    return WorkspaceResolver.instance;
  }

  getProjectRoot(): string {
    return this.projectRoot;
  }

  resolvePath(relativePath: string): string {
    return resolveFromProjectRoot(relativePath, this.projectRoot);
  }

  /**
   * Check if a path is within allowed directories
   */
  isPathAllowed(targetPath: string, additionalAllowedPaths: string[] = []): boolean {
    // If target path is relative, resolve it from project root
    const fullPath = this.resolvePath(targetPath);
    
    const allowedPaths = [this.projectRoot, '/tmp', ...additionalAllowedPaths];
    return allowedPaths.some(allowed => 
      fullPath.startsWith(path.resolve(allowed))
    );
  }
}