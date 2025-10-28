/**
 * Project Path Resolution Utility
 *
 * Resolves relative paths (like ./file.txt) relative to the project root.
 * Project root is determined from CWD_FILE environment variable.
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, isAbsolute } from 'path';

/**
 * Resolve path relative to project root
 *
 * - If path is absolute: returns as-is
 * - If path is relative: resolves relative to project root from CWD_FILE
 * - Falls back to process.cwd() if CWD_FILE not available
 *
 * @param path - Path to resolve (absolute or relative)
 * @returns Absolute path
 */
export function resolveProjectPath(path: string): string {
  if (isAbsolute(path)) {
    return path;
  }

  // Get project root from CWD_FILE env var
  const projectRoot = getProjectRoot();

  return resolve(projectRoot, path);
}

/**
 * Get project root from CWD_FILE environment variable
 * Falls back to process.cwd() if not available
 */
export function getProjectRoot(): string {
  const cwdFile = process.env.CWD_FILE;

  if (cwdFile && existsSync(cwdFile)) {
    try {
      return readFileSync(cwdFile, 'utf-8').trim();
    } catch (error) {
      // Fall back to process.cwd()
    }
  }

  return process.cwd();
}

/**
 * Check if a path is within the project root
 * Useful for security checks
 */
export function isWithinProjectRoot(path: string): boolean {
  const absolutePath = resolve(path);
  const projectRoot = getProjectRoot();

  return absolutePath.startsWith(projectRoot);
}
