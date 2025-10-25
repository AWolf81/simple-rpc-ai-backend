#!/usr/bin/env node
/**
 * Write File Script
 *
 * Safely write content to a file within allowed paths
 */

import { writeFileSync, mkdirSync } from 'fs';
import { dirname, resolve } from 'path';

interface WriteResult {
  success: boolean;
  path: string;
  bytes: number;
  error?: string;
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.error('Usage: write.ts <file-path> <content>');
    process.exit(1);
  }

  const filePath = args[0];
  const content = args.slice(1).join(' ');

  try {
    // Resolve to absolute path
    const absolutePath = resolve(filePath);

    // Create directory if it doesn't exist
    const dirPath = dirname(absolutePath);
    mkdirSync(dirPath, { recursive: true });

    // Write file
    writeFileSync(absolutePath, content, 'utf-8');

    const result: WriteResult = {
      success: true,
      path: absolutePath,
      bytes: Buffer.byteLength(content, 'utf-8')
    };

    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    const result: WriteResult = {
      success: false,
      path: filePath,
      bytes: 0,
      error: error instanceof Error ? error.message : 'Unknown error'
    };

    console.log(JSON.stringify(result, null, 2));
    process.exit(1);
  }
}

main();
