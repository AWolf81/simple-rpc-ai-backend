#!/usr/bin/env tsx

/**
 * File Read Script
 *
 * Reads file contents with validation, line-based offset/limit, and size limits.
 * Usage: tsx read.ts <file-path> [--offset <line>] [--limit <lines>] [--max-size <bytes>]
 *
 * Arguments:
 *   file-path        Path to file (relative to project root or absolute)
 *   --offset <n>     Start reading from line number (1-indexed, default: 1)
 *   --limit <n>      Max number of lines to read (default: unlimited)
 *   --max-size <n>   Max file size in bytes (default: 10MB)
 *
 * Examples:
 *   tsx read.ts ./file.txt                      # Read entire file
 *   tsx read.ts ./file.txt --limit 20           # First 20 lines
 *   tsx read.ts ./file.txt --offset 10 --limit 10  # Lines 10-19
 */

import fs from 'fs/promises';
import path from 'path';
import readline from 'readline';
import { createReadStream } from 'fs';

const DEFAULT_MAX_SIZE = 10 * 1024 * 1024; // 10MB
const PROJECT_ROOT = process.env.PROJECT_ROOT || process.cwd();
const ALLOWED_PATHS = [PROJECT_ROOT, '/tmp'];

function parseArgs() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('Error: File path required');
    console.error('Usage: tsx read.ts <file-path> [--offset <line>] [--limit <lines>] [--max-size <bytes>]');
    process.exit(1);
  }

  const filePath = args[0];
  let offset = 1;  // 1-indexed, start from line 1
  let limit: number | undefined;
  let maxSize = DEFAULT_MAX_SIZE;

  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--offset' && args[i + 1]) {
      offset = parseInt(args[i + 1], 10);
      if (isNaN(offset) || offset < 1) {
        console.error('Error: Invalid offset value (must be >= 1)');
        process.exit(1);
      }
      i++;
    } else if (args[i] === '--limit' && args[i + 1]) {
      limit = parseInt(args[i + 1], 10);
      if (isNaN(limit) || limit <= 0) {
        console.error('Error: Invalid limit value (must be > 0)');
        process.exit(1);
      }
      i++;
    } else if (args[i] === '--max-size' && args[i + 1]) {
      maxSize = parseInt(args[i + 1], 10);
      if (isNaN(maxSize) || maxSize <= 0) {
        console.error('Error: Invalid max-size value (must be > 0)');
        process.exit(1);
      }
      i++;
    }
  }

  return { filePath, offset, limit, maxSize };
}

async function main() {
  const { filePath, offset, limit, maxSize } = parseArgs();

  try {
    let absolutePath;

    // If the path is relative, resolve it relative to the project root
    if (path.isAbsolute(filePath)) {
      absolutePath = filePath;
    } else {
      absolutePath = path.join(PROJECT_ROOT, filePath);
    }

    // Validate path
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

    if (stats.size > maxSize) {
      console.error(`Error: File too large: ${stats.size} bytes (max: ${maxSize})`);
      console.error('Use --max-size to increase limit or use --offset/--limit to read specific lines');
      process.exit(1);
    }

    // Read file line by line
    const fileStream = createReadStream(absolutePath);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });

    let currentLine = 0;
    let linesRead = 0;
    const outputLines: string[] = [];

    for await (const line of rl) {
      currentLine++;

      // Skip lines before offset
      if (currentLine < offset) {
        continue;
      }

      // Add line to output
      outputLines.push(line);
      linesRead++;

      // Stop if we've reached the limit
      if (limit !== undefined && linesRead >= limit) {
        break;
      }
    }

    // Output to stdout
    console.log(outputLines.join('\n'));

    process.exit(0);
  } catch (error) {
    console.error(`Error reading file: ${error}`);
    process.exit(2);
  }
}

main();
