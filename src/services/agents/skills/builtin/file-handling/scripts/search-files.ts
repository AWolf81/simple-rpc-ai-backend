#!/usr/bin/env tsx

/**
 * Search Files Script
 *
 * Search for files matching glob patterns.
 * Also supports direct file paths if the pattern is a specific file.
 * Usage: tsx search-files.ts <pattern> [directory]
 */

import fs from 'fs/promises';
import path from 'path';

// Use project root from environment or fall back to current working directory
const PROJECT_ROOT = process.env.PROJECT_ROOT || process.cwd();
const ALLOWED_PATHS = [PROJECT_ROOT, '/tmp'];

async function main() {
  let pattern = process.argv[2];
  let directory = process.argv[3];

  if (!pattern) {
    console.error('Error: Pattern required');
    console.error('Usage: tsx search-files.ts <pattern> [directory]');
    process.exit(1);
  }

  try {
    // Check if the provided pattern is a direct file path (no glob chars) and exists
    if (!/[?*]/.test(pattern)) {  // If no glob characters
      let absolutePath;
      
      // If the path is relative, resolve it relative to the project root instead of the script location
      if (path.isAbsolute(pattern)) {
        absolutePath = pattern;
      } else {
        absolutePath = path.join(PROJECT_ROOT, pattern);
      }
      
      const isAllowed = ALLOWED_PATHS.some(allowed =>
        absolutePath.startsWith(path.resolve(allowed))
      );

      if (!isAllowed) {
        console.error(`Error: Path not in allowed paths: ${ALLOWED_PATHS.join(', ')}`);
        process.exit(1);
      }

      try {
        const stats = await fs.stat(absolutePath);
        if (stats.isFile()) {
          // This is a direct file path that exists, just return it
          console.log(absolutePath);
          process.exit(0);
        } else if (stats.isDirectory()) {
          // This is a directory, set it as the directory to search
          directory = absolutePath;
          pattern = '*';  // List all files in directory
        }
      } catch {
        // File/directory doesn't exist, treat as glob pattern
      }
    }

    // If no directory was provided, either use the derived directory from an absolute pattern
    // or default to the project root instead of process.cwd()
    if (!directory) {
      const derived = deriveBaseDirFromAbsolutePattern(pattern);
      if (derived) {
        directory = derived.baseDir;
        pattern = derived.pattern;
      } else {
        // Default to project root if no specific directory provided
        directory = PROJECT_ROOT;
      }
    }

    // Validate directory
    let absoluteDir;
    if (path.isAbsolute(directory)) {
      absoluteDir = directory;
    } else {
      absoluteDir = path.join(PROJECT_ROOT, directory);
    }
    
    const isAllowed = ALLOWED_PATHS.some(allowed =>
      absoluteDir.startsWith(path.resolve(allowed))
    );

    if (!isAllowed) {
      console.error(`Error: Directory not in allowed paths: ${ALLOWED_PATHS.join(', ')}`);
      process.exit(1);
    }

    // Convert glob pattern to regex
    const regex = globToRegex(pattern);

    // Search recursively
    const matches = await searchDirectory(absoluteDir, regex);

    // Output results (one per line)
    matches.forEach(match => console.log(match));

    process.exit(0);
  } catch (error) {
    console.error(`Error searching files: ${error}`);
    process.exit(2);
  }
}

/**
 * Convert glob pattern to regex
 */
function globToRegex(pattern: string): RegExp {
  // Simple glob conversion (not full glob support)
  // Use placeholder for ** to prevent * replacement from affecting it
  const GLOB_STAR_PLACEHOLDER = '__GLOB_STAR__';
  
  let regexStr = pattern
    .replace(/\./g, '\\.')                           // Escape dots
    .replace(/\*\*/g, GLOB_STAR_PLACEHOLDER)         // Protect ** from * replacement
    .replace(/\*/g, '[^/]*')                         // Replace * with "any chars except /"
    .replace(/\?/g, '.')                             // Replace ? with "any char"
    .replace(new RegExp(GLOB_STAR_PLACEHOLDER, 'g'), '.*'); // Replace ** with "any chars including /"

  return new RegExp(`^${regexStr}$`);
}

/**
 * Search directory recursively
 */
async function searchDirectory(dir: string, pattern: RegExp, baseDir?: string): Promise<string[]> {
  const matches: string[] = [];
  const searchBase = baseDir || dir;

  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        // Recurse into subdirectories, preserving the base directory
        const subMatches = await searchDirectory(fullPath, pattern, searchBase);
        matches.push(...subMatches);
      } else if (entry.isFile()) {
        // Test pattern against relative path from base directory
        const relativePath = path.relative(searchBase, fullPath);
        if (pattern.test(relativePath)) {
          matches.push(fullPath);
        }
      }
    }
  } catch (error) {
    // Ignore permission errors
  }

  return matches;
}

main();

function deriveBaseDirFromAbsolutePattern(pattern: string): { baseDir: string; pattern: string } | null {
  if (!isAbsolutePattern(pattern)) {
    return null;
  }

  const globIndex = pattern.search(/[*?]/);

  if (globIndex === -1) {
    const dir = path.dirname(pattern);
    const baseDir = dir && dir !== '.' ? dir : process.env.PROJECT_ROOT || process.cwd();
    const remainingPattern = path.basename(pattern) || '**/*';
    return { baseDir, pattern: remainingPattern };
  }

  const lastForwardSlash = pattern.lastIndexOf('/', globIndex);
  const lastBackSlash = pattern.lastIndexOf('\\', globIndex);
  const splitIndex = Math.max(lastForwardSlash, lastBackSlash);

  if (splitIndex <= 0) {
    return null;
  }

  const baseDir = pattern.slice(0, splitIndex);
  const remainingPattern = pattern.slice(splitIndex + 1) || '**/*';
  return { baseDir, pattern: remainingPattern };
}

function isAbsolutePattern(pattern: string): boolean {
  if (!pattern) return false;
  if (pattern.startsWith('/')) return true;

  // Windows style absolute path (e.g., C:\ or C:/)
  return /^[a-zA-Z]:[\\/]/.test(pattern);
}
