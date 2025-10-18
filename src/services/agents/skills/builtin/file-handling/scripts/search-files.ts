#!/usr/bin/env tsx

/**
 * Search Files Script
 *
 * Search for files matching glob patterns.
 * Usage: tsx search-files.ts <pattern> [directory]
 */

import fs from 'fs/promises';
import path from 'path';

const ALLOWED_PATHS = ['/workspace', '/tmp'];

async function main() {
  const pattern = process.argv[2];
  const directory = process.argv[3] || '/workspace';

  if (!pattern) {
    console.error('Error: Pattern required');
    console.error('Usage: tsx search-files.ts <pattern> [directory]');
    process.exit(1);
  }

  try {
    // Validate directory
    const absoluteDir = path.resolve(directory);
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
  let regexStr = pattern
    .replace(/\./g, '\\.')
    .replace(/\*\*/g, '.*')
    .replace(/\*/g, '[^/]*')
    .replace(/\?/g, '.');

  return new RegExp(`^${regexStr}$`);
}

/**
 * Search directory recursively
 */
async function searchDirectory(dir: string, pattern: RegExp): Promise<string[]> {
  const matches: string[] = [];

  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        // Recurse into subdirectories
        const subMatches = await searchDirectory(fullPath, pattern);
        matches.push(...subMatches);
      } else if (entry.isFile()) {
        // Check if file matches pattern
        if (pattern.test(fullPath)) {
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
