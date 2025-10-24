#!/usr/bin/env node

/**
 * Simple Agent CLI Launcher
 *
 * Uses tsx to run TypeScript directly without pre-compilation.
 * This allows the CLI to work immediately after npm install/link.
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Path to the TypeScript CLI source
const cliPath = join(__dirname, '..', 'src', 'cli.ts');

// Use npx to find tsx from node_modules
const child = spawn('npx', ['tsx', cliPath, ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: process.env
});

child.on('exit', (code) => {
  process.exit(code || 0);
});

child.on('error', (err) => {
  console.error('Failed to start simple-agent:', err.message);
  console.error('\nMake sure tsx is installed:');
  console.error('  pnpm install -D tsx');
  process.exit(1);
});
