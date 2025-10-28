#!/usr/bin/env tsx

/**
 * Grep Script - Search for patterns in file
 *
 * Searches for regex patterns in a file and returns matching lines with line numbers.
 * Usage: tsx grep.ts <file-path> <pattern> [--context <lines>] [--max-matches <n>]
 *
 * Arguments:
 *   file-path          Path to file (relative to project root or absolute)
 *   pattern            Regex pattern to search for
 *   --context <n>      Number of context lines before/after match (default: 0)
 *   --max-matches <n>  Maximum number of matches to return (default: 100)
 *   --case-sensitive   Enable case-sensitive search (default: case-insensitive)
 *
 * Examples:
 *   tsx grep.ts ./file.txt "error"                    # Find "error" in file
 *   tsx grep.ts ./file.txt "TODO" --context 2        # Show 2 lines before/after
 *   tsx grep.ts ./file.txt "^import" --max-matches 10  # First 10 import lines
 */

import fs from 'fs/promises';
import path from 'path';
import readline from 'readline';
import { createReadStream } from 'fs';

const PROJECT_ROOT = process.cwd(); // Script runs with cwd set to project root
const ALLOWED_PATHS = [PROJECT_ROOT, '/tmp'];
const DEFAULT_MAX_SIZE = 10 * 1024 * 1024; // 10MB

function parseArgs() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.error('Error: File path and pattern required');
    console.error('Usage: tsx grep.ts <file-path> <pattern> [--context <n>] [--max-matches <n>] [--case-sensitive]');
    process.exit(1);
  }

  const filePath = args[0];
  const pattern = args[1];
  let context = 0;
  let maxMatches = 100;
  let caseSensitive = false;

  for (let i = 2; i < args.length; i++) {
    if (args[i] === '--context' && args[i + 1]) {
      context = parseInt(args[i + 1], 10);
      if (isNaN(context) || context < 0) {
        console.error('Error: Invalid context value');
        process.exit(1);
      }
      i++;
    } else if (args[i] === '--max-matches' && args[i + 1]) {
      maxMatches = parseInt(args[i + 1], 10);
      if (isNaN(maxMatches) || maxMatches <= 0) {
        console.error('Error: Invalid max-matches value');
        process.exit(1);
      }
      i++;
    } else if (args[i] === '--case-sensitive') {
      caseSensitive = true;
    }
  }

  return { filePath, pattern, context, maxMatches, caseSensitive };
}

async function main() {
  const { filePath, pattern, context, maxMatches, caseSensitive } = parseArgs();

  try {
    let absolutePath;

    // Resolve path
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
    if (stats.size > DEFAULT_MAX_SIZE) {
      console.error(`Error: File too large: ${stats.size} bytes (max: ${DEFAULT_MAX_SIZE})`);
      process.exit(1);
    }

    // Compile regex
    let regex: RegExp;
    try {
      regex = new RegExp(pattern, caseSensitive ? 'g' : 'gi');
    } catch (error) {
      console.error(`Error: Invalid regex pattern: ${error}`);
      process.exit(1);
    }

    // Read file and search
    const fileStream = createReadStream(absolutePath);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });

    const allLines: string[] = [];
    for await (const line of rl) {
      allLines.push(line);
    }

    // Find matches
    const matches: Array<{ lineNum: number; line: string; contextBefore: string[]; contextAfter: string[] }> = [];

    for (let i = 0; i < allLines.length && matches.length < maxMatches; i++) {
      if (regex.test(allLines[i])) {
        const contextBefore = [];
        const contextAfter = [];

        // Get context lines before
        for (let j = Math.max(0, i - context); j < i; j++) {
          contextBefore.push(allLines[j]);
        }

        // Get context lines after
        for (let j = i + 1; j <= Math.min(allLines.length - 1, i + context); j++) {
          contextAfter.push(allLines[j]);
        }

        matches.push({
          lineNum: i + 1,  // 1-indexed
          line: allLines[i],
          contextBefore,
          contextAfter
        });
      }
    }

    // Output results
    if (matches.length === 0) {
      console.log('No matches found');
    } else {
      for (const match of matches) {
        // Show context before
        if (match.contextBefore.length > 0) {
          match.contextBefore.forEach((line, idx) => {
            const lineNum = match.lineNum - match.contextBefore.length + idx;
            console.log(`${lineNum}:  ${line}`);
          });
        }

        // Show matching line (highlighted with >)
        console.log(`${match.lineNum}:> ${match.line}`);

        // Show context after
        if (match.contextAfter.length > 0) {
          match.contextAfter.forEach((line, idx) => {
            const lineNum = match.lineNum + idx + 1;
            console.log(`${lineNum}:  ${line}`);
          });
        }

        // Separator between matches if context is shown
        if (context > 0 && match !== matches[matches.length - 1]) {
          console.log('---');
        }
      }

      console.log(`\nFound ${matches.length} match(es)${matches.length >= maxMatches ? ' (limit reached)' : ''}`);
    }

    process.exit(0);
  } catch (error) {
    console.error(`Error: ${error}`);
    process.exit(2);
  }
}

main();
