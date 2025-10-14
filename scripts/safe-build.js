#!/usr/bin/env node
/**
 * Safe build script for GitHub installations
 * Handles optional dependency failures and ensures build succeeds
 */

import { spawn, spawnSync } from 'child_process';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

console.log('🔧 Running safe build process...');

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    console.log(`Running: ${command} ${args.join(' ')}`);

    const child = spawn(command, args, {
      stdio: 'inherit',
      cwd: projectRoot,
      shell: true,
      ...options
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command failed with exit code ${code}`));
      }
    });

    child.on('error', (error) => {
      reject(error);
    });
  });
}

let cachedRunner = null;

function resolveNodePackageRunner(preferred) {
  if (cachedRunner && !preferred) {
    return cachedRunner;
  }

  const check = (cmd, args = ['--version']) => {
    const result = spawnSync(cmd, args, {
      stdio: 'ignore',
      shell: true
    });
    return !result.error && result.status === 0;
  };

  const hasNpx = check('npx');
  const hasNpm = check('npm');

  if (preferred === 'npx' && hasNpx) {
    cachedRunner = { command: 'npx', args: [] };
    return cachedRunner;
  }

  if (preferred === 'npm-exec' && hasNpm) {
    return { command: 'npm', args: ['exec'] };
  }

  if (hasNpx) {
    cachedRunner = { command: 'npx', args: [] };
    return cachedRunner;
  }

  if (hasNpm) {
    cachedRunner = { command: 'npm', args: ['exec'] };
    return cachedRunner;
  }

  throw new Error('Neither npx nor npm exec is available on PATH.');
}

async function copyAssets() {
  console.log('📁 Copying assets...');
  try {
    await runCommand('npm', ['run', 'copy-assets']);
    console.log('✅ Assets copied successfully');
  } catch (error) {
    console.log('⚠️  Asset copying failed, continuing...');
    // Don't fail the build for missing optional files
  }
}

async function runTypeScript() {
  console.log('🔨 Running TypeScript compilation...');
  try {
    const runner = resolveNodePackageRunner();
    await runCommand(runner.command, [...runner.args, 'tsc']);
    console.log('✅ TypeScript compilation successful');
  } catch (error) {
    console.error('❌ TypeScript compilation failed:', error.message);
    throw error; // This is critical, so fail here
  }
}

async function runTscAlias() {
  console.log('🔗 Running tsc-alias...');
  try {
    const runner = resolveNodePackageRunner();
    await runCommand(runner.command, [...runner.args, 'tsc-alias']);
    console.log('✅ tsc-alias successful');
  } catch (error) {
    console.log('⚠️  tsc-alias failed, continuing without aliases...');
    // Non-critical, continue
  }
}

async function buildTrpcMethods() {
  console.log('📋 Building tRPC methods...');
  try {
    await runCommand('node', ['tools/generate-trpc-methods.js']);
    console.log('✅ tRPC methods built successfully');
  } catch (error) {
    console.log('⚠️  tRPC methods generation failed, continuing...');
    // Non-critical for basic functionality
  }
}

async function checkDataFiles() {
  console.log('📂 Checking data files...');

  const dataFiles = [
    'src/data/production-models.json',
    'src/data/openai-models.json',
    'src/data/huggingface-models.json'
  ];

  const missingFiles = dataFiles.filter(file => !existsSync(join(projectRoot, file)));

  if (missingFiles.length > 0) {
    console.log('⚠️  Missing data files:', missingFiles);
    console.log('   These files are needed for TypeScript compilation');
    return false;
  }

  console.log('✅ All data files present');
  return true;
}

async function main() {
  try {
    // Check if we're in the right directory
    if (!existsSync(join(projectRoot, 'package.json'))) {
      console.error('❌ Not in project root directory');
      process.exit(1);
    }

    console.log('📍 Working directory:', projectRoot);

    // Step 1: Check and copy assets (including data files)
    await copyAssets();

    // Step 2: Verify data files are available
    const hasDataFiles = await checkDataFiles();
    if (!hasDataFiles) {
      console.log('⚠️  Missing data files, build may fail');
    }

    // Step 3: Run TypeScript compilation
    await runTypeScript();

    // Step 4: Run tsc-alias (optional)
    await runTscAlias();

    // Step 5: Build tRPC methods (optional)
    await buildTrpcMethods();

    console.log('✅ Safe build completed successfully!');

  } catch (error) {
    console.error('❌ Safe build failed:', error.message);

    // Provide helpful error information
    console.log('\n💡 Build failed. This might be due to:');
    console.log('   1. Missing data files (check src/data/ directory)');
    console.log('   2. TypeScript compilation errors');
    console.log('   3. Missing dependencies');
    console.log('\n   Try running "npm run build" manually for more details');

    process.exit(1);
  }
}

// Only run if called directly (not imported)
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
}
