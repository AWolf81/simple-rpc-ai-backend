#!/usr/bin/env tsx

/**
 * Safe Read Script
 *
 * Safely reads file contents with validation and size limits.
 * Usage: tsx safe-read.ts <file-path>
 */

import fs from 'fs/promises';
import path from 'path';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_PATHS = ['/workspace', '/tmp'];

async function main() {
  const filePath = process.argv[2];

  if (!filePath) {
    console.error('Error: File path required');
    console.error('Usage: tsx safe-read.ts <file-path>');
    process.exit(1);
  }

  try {
    // Validate path
    const absolutePath = path.resolve(filePath);
    const isAllowed = ALLOWED_PATHS.some(allowed =>
      absolutePath.startsWith(path.resolve(allowed))
    );

    if (!isAllowed) {
      console.error(`Error: Path not in allowed directories: ${ALLOWED_PATHS.join(', ')}`);
      process.exit(1);
    }

    // Check if file exists
    try {
      await fs.access(absolutePath);
    } catch {
      console.error(`Error: File not found: ${absolutePath}`);
      process.exit(1);
    }

    // Check file size
    const stats = await fs.stat(absolutePath);

    if (stats.size > MAX_FILE_SIZE) {
      console.error(`Error: File too large: ${stats.size} bytes (max: ${MAX_FILE_SIZE})`);
      console.error('Use streaming for large files');
      process.exit(1);
    }

    // Read file
    const content = await fs.readFile(absolutePath, 'utf-8');

    // Output to stdout
    console.log(content);

    process.exit(0);
  } catch (error) {
    console.error(`Error reading file: ${error}`);
    process.exit(2);
  }
}

main();
