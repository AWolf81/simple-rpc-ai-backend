#!/usr/bin/env tsx

/**
 * Delete File Script
 *
 * Safely delete a file with validation
 * Usage: tsx delete.ts <file-path>
 */

import { unlinkSync, existsSync, statSync, appendFileSync } from 'fs';
import path from 'path';

// Script runs with cwd set to project root
const PROJECT_ROOT = process.cwd();
const ALLOWED_PATHS = [PROJECT_ROOT, '/tmp'];

async function main() {
  // Debug: Log each execution with timestamp
  const timestamp = new Date().toISOString();
  const executionId = Math.random().toString(36).substring(7);
  console.error(`[DELETE-${executionId}] Script started at ${timestamp}`);
  try {
    appendFileSync('/tmp/delete_audit.log', `${timestamp} [${executionId}] START\n`);
  } catch (auditError) {
    console.error(`[DELETE-${executionId}] Failed to write audit log: ${auditError}`);
  }

  const filePath = process.argv[2];

  if (!filePath) {
    console.error('Error: File path required');
    console.error('Usage: tsx delete.ts <file-path>');
    process.exit(1);
  }

  console.error(`[DELETE-${executionId}] Processing file: ${filePath}`);
  try {
    appendFileSync('/tmp/delete_audit.log', `${timestamp} [${executionId}] PATH ${filePath}\n`);
  } catch {
    // ignore audit errors
  }

  try {
    // Resolve to absolute path
    let absolutePath: string;
    if (path.isAbsolute(filePath)) {
      absolutePath = filePath;
    } else {
      absolutePath = path.join(PROJECT_ROOT, filePath);
    }

    // Validate path is in allowed locations
    const isAllowed = ALLOWED_PATHS.some(allowed =>
      absolutePath.startsWith(path.resolve(allowed))
    );

    if (!isAllowed) {
      console.error(`Error: Path not in allowed paths: ${ALLOWED_PATHS.join(', ')}`);
      process.exit(1);
    }

    // Check if file exists
    if (!existsSync(absolutePath)) {
      console.error(`[DELETE-${executionId}] File not found (already deleted): ${absolutePath}`);
      try {
        appendFileSync('/tmp/delete_audit.log', `${new Date().toISOString()} [${executionId}] NOT_FOUND ${absolutePath}\n`);
      } catch {
        // ignore audit errors
      }
      console.log(`File not found: ${absolutePath}`);
      process.exit(0);
    }

    // Check if it's a file (not a directory)
    const stats = statSync(absolutePath);
    if (!stats.isFile()) {
      console.error(`Error: Path is not a file: ${absolutePath}`);
      process.exit(1);
    }

    // Delete the file
    unlinkSync(absolutePath);
    console.error(`[DELETE-${executionId}] Successfully deleted: ${absolutePath}`);
    try {
      appendFileSync('/tmp/delete_audit.log', `${new Date().toISOString()} [${executionId}] DELETED ${absolutePath}\n`);
    } catch {
      // ignore
    }
    console.log(`File deleted: ${absolutePath}`);
    process.exit(0);
  } catch (error) {
    console.error(`Error deleting file: ${error}`);
    process.exit(2);
  }
}

main();
