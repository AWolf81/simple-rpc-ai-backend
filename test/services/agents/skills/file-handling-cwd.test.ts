import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';

// Test the file handling scripts by running them as subprocesses
describe('File Handling Skills - CWD Integration', () => {
  let tempDir: string;

  beforeEach(async () => {
    // Create a temporary directory for testing
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'file-handling-test-'));
  });

  afterEach(async () => {
    // Clean up the temporary directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (err) {
      // Ignore cleanup errors
    }
  });

  it('should validate paths in the current working directory', async () => {
    // Create a test file in our temp directory
    const testFilePath = path.join(tempDir, 'test-file.txt');
    await fs.writeFile(testFilePath, 'test content');

    // Run the validate-path script as a subprocess from the project root
    const result = await new Promise<{ stdout: string; stderr: string; exitCode: number }>((resolve, reject) => {
      const child = spawn('npx', ['tsx', 'src/services/agents/skills/builtin/file-handling/scripts/validate-path.ts', testFilePath], {
        cwd: process.cwd(), // Run from project root
        env: { ...process.env, TSX_SILENCE_DEPRECATION: '1' } // Suppress deprecation warnings
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        resolve({ stdout: stdout.trim(), stderr: stderr.trim(), exitCode: code ?? -1 });
      });

      child.on('error', (error) => {
        reject(error);
      });
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain(tempDir);
    expect(result.stdout).toContain('safe:');
  });

  it('should allow reading files in the current working directory', async () => {
    // Create a test file in our temp directory
    const testFilePath = path.join(tempDir, 'read-test.txt');
    const testContent = 'This is a test file for reading';
    await fs.writeFile(testFilePath, testContent);

    // Run the safe-read script as a subprocess from the project root
    const result = await new Promise<{ stdout: string; stderr: string; exitCode: number }>((resolve, reject) => {
      const child = spawn('npx', ['tsx', 'src/services/agents/skills/builtin/file-handling/scripts/safe-read.ts', testFilePath], {
        cwd: process.cwd(), // Run from project root
        env: { ...process.env, TSX_SILENCE_DEPRECATION: '1' } // Suppress deprecation warnings
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        resolve({ stdout: stdout.trim(), stderr: stderr.trim(), exitCode: code ?? -1 });
      });

      child.on('error', (error) => {
        reject(error);
      });
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe(testContent);
  });

  it('should block reading files outside allowed paths', async () => {
    // Create a file in a location outside of our allowed paths
    // Use a path that's definitely outside the project directory
    const restrictedPath = '/etc/passwd';  // Common system file that's likely to exist and be restricted
    
    // Run the safe-read script to attempt to read the restricted file from project root
    const result = await new Promise<{ stdout: string; stderr: string; exitCode: number }>((resolve, reject) => {
      const child = spawn('npx', ['tsx', 'src/services/agents/skills/builtin/file-handling/scripts/safe-read.ts', restrictedPath], {
        cwd: process.cwd(), // Run from project root
        env: { ...process.env, TSX_SILENCE_DEPRECATION: '1' } // Suppress deprecation warnings
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        resolve({ stdout: stdout.trim(), stderr: stderr.trim(), exitCode: code ?? -1 });
      });

      child.on('error', (error) => {
        reject(error);
      });
    });

    // It should fail since the path is outside allowed paths
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Path not in allowed directories');
  });

  it('should support direct file paths in search', async () => {
    // Create a test file in our temp directory
    const testFilePath = path.join(tempDir, 'search-test.md');
    await fs.writeFile(testFilePath, '# Test Markdown File');

    // Run the search-files script as a subprocess from project root to find our specific file
    const result = await new Promise<{ stdout: string; stderr: string; exitCode: number }>((resolve, reject) => {
      const child = spawn('npx', ['tsx', 'src/services/agents/skills/builtin/file-handling/scripts/search-files.ts', testFilePath], {
        cwd: process.cwd(), // Run from project root
        env: { ...process.env, TSX_SILENCE_DEPRECATION: '1' } // Suppress deprecation warnings
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        resolve({ stdout: stdout.trim(), stderr: stderr.trim(), exitCode: code ?? -1 });
      });

      child.on('error', (error) => {
        reject(error);
      });
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe(testFilePath);
  });

  it('should support glob patterns in search', async () => {
    // Create multiple test files in our temp directory
    const testFile1Path = path.join(tempDir, 'test1.md');
    const testFile2Path = path.join(tempDir, 'test2.md');
    const otherFile = path.join(tempDir, 'other.txt');
    
    await fs.writeFile(testFile1Path, '# Test 1');
    await fs.writeFile(testFile2Path, '# Test 2');
    await fs.writeFile(otherFile, 'Other file');

    // Verify the files were created
    await fs.access(testFile1Path);
    await fs.access(testFile2Path);
    await fs.access(otherFile);

    // Run the search-files script with a glob pattern from project root, passing temp directory as arg
    const result = await new Promise<{ stdout: string; stderr: string; exitCode: number }>((resolve, reject) => {
      const child = spawn('npx', ['tsx', 'src/services/agents/skills/builtin/file-handling/scripts/search-files.ts', '*.md', tempDir], {
        cwd: process.cwd(), // Run from project root
        env: { ...process.env, TSX_SILENCE_DEPRECATION: '1' } // Suppress deprecation warnings
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        resolve({ stdout: stdout.trim(), stderr: stderr.trim(), exitCode: code ?? -1 });
      });

      child.on('error', (error) => {
        reject(error);
      });
    });

    expect(result.exitCode).toBe(0);
    const resultFiles = result.stdout.split('\n').filter(line => line.trim() !== '');
    expect(resultFiles).toContain(testFile1Path);
    expect(resultFiles).toContain(testFile2Path);
    // Should not contain the .txt file
    expect(result.stdout).not.toContain(otherFile);
  });
});