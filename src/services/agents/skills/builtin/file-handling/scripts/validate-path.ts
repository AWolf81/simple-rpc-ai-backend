#!/usr/bin/env tsx

/**
 * Validate Path Script
 *
 * Validates that a path is safe and within allowed directories.
 * Usage: tsx validate-path.ts <path>
 */

import path from 'path';

const ALLOWED_PATHS = ['/workspace', '/tmp'];

function main() {
  const targetPath = process.argv[2];

  if (!targetPath) {
    console.error('Error: Path required');
    console.error('Usage: tsx validate-path.ts <path>');
    process.exit(1);
  }

  try {
    // Normalize and resolve path
    const absolutePath = path.resolve(targetPath);
    const normalized = path.normalize(absolutePath);

    // Check for path traversal attempts
    if (normalized.includes('..')) {
      console.log('unsafe: Path contains traversal (..)');
      process.exit(1);
    }

    // Check if within allowed paths
    const isAllowed = ALLOWED_PATHS.some(allowed => {
      const normalizedAllowed = path.normalize(path.resolve(allowed));
      return normalized.startsWith(normalizedAllowed);
    });

    if (!isAllowed) {
      console.log(`unsafe: Path not in allowed directories (${ALLOWED_PATHS.join(', ')})`);
      process.exit(1);
    }

    // Path is safe
    console.log(`safe: ${normalized}`);
    process.exit(0);
  } catch (error) {
    console.error(`Error validating path: ${error}`);
    process.exit(2);
  }
}

main();
