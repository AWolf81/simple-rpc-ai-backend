#!/usr/bin/env tsx

import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';

const execFileAsync = promisify(execFile);
const PROJECT_ROOT = process.cwd(); // Script runs with cwd set to project root
const ALLOWED_ROOTS = [PROJECT_ROOT, '/tmp'];

async function main() {
  const rawCwd = process.argv[2] || PROJECT_ROOT;
  const resolvedCwd = path.resolve(rawCwd);

  if (!ALLOWED_ROOTS.some(root => resolvedCwd === root || resolvedCwd.startsWith(path.resolve(root) + path.sep))) {
    console.error(`Error: Path '${resolvedCwd}' is outside allowed roots (${ALLOWED_ROOTS.join(', ')})`);
    process.exit(1);
  }

  try {
    await fs.access(resolvedCwd);
  } catch (error) {
    console.error(`Error: Repository path does not exist: ${resolvedCwd}`);
    process.exit(1);
  }

  try {
    const { stdout } = await execFileAsync('git', ['status', '--short', '--branch'], {
      cwd: resolvedCwd,
      encoding: 'utf8'
    });

    if (!stdout.trim()) {
      console.log('Clean working tree.');
    } else {
      console.log(stdout.trim());
    }
  } catch (error: any) {
    const message = error?.stderr || error?.stdout || error?.message || 'Unknown git error';
    console.error(`Error retrieving git status: ${message.toString().trim()}`);
    process.exit(typeof error?.code === 'number' ? error.code : 1);
  }
}

main();
