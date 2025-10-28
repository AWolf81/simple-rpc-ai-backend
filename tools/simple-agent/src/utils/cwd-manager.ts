/**
 * Working Directory Manager
 *
 * Manages a temporary file to communicate the working directory to skill scripts.
 * Uses a random ID to support multiple parallel simple-agent instances.
 *
 * Inspired by Claude Code's approach (see GH issue #8856):
 * - Each instance gets /tmp/simple-agent-cwd-{randomId}
 * - File contains just the absolute working directory path
 * - Cleaned up on exit
 */

import { writeFileSync, readFileSync, unlinkSync, existsSync } from 'fs';

export class CwdManager {
  private filePath: string;
  private cwd: string;
  private cleanedUp = false;

  constructor(cwd: string) {
    // Generate random ID (6 chars, like Claude Code)
    const randomId = Math.random().toString(36).substring(2, 8);
    this.filePath = `/tmp/simple-agent-${randomId}-cwd`;
    this.cwd = cwd;
  }

  /**
   * Write CWD to temp file
   */
  initialize(): void {
    try {
      writeFileSync(this.filePath, this.cwd, 'utf-8');
    } catch (error) {
      console.error(`Failed to create CWD file at ${this.filePath}:`, error);
      throw error;
    }
  }

  /**
   * Get the temp file path (for passing to server/scripts)
   */
  getFilePath(): string {
    return this.filePath;
  }

  /**
   * Get the working directory
   */
  getCwd(): string {
    return this.cwd;
  }

  /**
   * Cleanup temp file
   */
  cleanup(): void {
    if (this.cleanedUp) {
      return; // Already cleaned up
    }

    if (existsSync(this.filePath)) {
      try {
        unlinkSync(this.filePath);
        this.cleanedUp = true;
      } catch (error) {
        console.error(`Failed to cleanup CWD file at ${this.filePath}:`, error);
      }
    }
  }
}

/**
 * Read CWD from temp file (for use in skill scripts)
 */
export function readCwdFromFile(filePath: string): string {
  try {
    return readFileSync(filePath, 'utf-8').trim();
  } catch (error) {
    throw new Error(`Failed to read CWD from file ${filePath}: ${error}`);
  }
}

/**
 * Get CWD from temp file via CWD_FILE environment variable
 * Falls back to process.cwd() if not available
 */
export function getCwdFromEnv(): string {
  const cwdFile = process.env.CWD_FILE;

  if (cwdFile && existsSync(cwdFile)) {
    try {
      return readCwdFromFile(cwdFile);
    } catch (error) {
      console.warn(`Failed to read CWD from ${cwdFile}, falling back to process.cwd():`, error);
    }
  }

  return process.cwd();
}
