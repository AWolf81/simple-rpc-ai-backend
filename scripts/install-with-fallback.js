#!/usr/bin/env node
/**
 * Installation script that handles optional native dependency failures gracefully
 * This is particularly important for Python 3.12+ distutils issues
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

console.log('🔧 Installing dependencies with fallback handling...');

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    console.log(`Running: ${command} ${args.join(' ')}`);

    const child = spawn(command, args, {
      stdio: 'inherit',
      cwd: projectRoot,
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

async function main() {
  try {
    // First try normal installation
    console.log('📦 Attempting normal pnpm install...');
    await runCommand('pnpm', ['install']);
    console.log('✅ Installation successful!');

  } catch (error) {
    console.log('⚠️  Normal install failed, trying with build error ignoring...');

    try {
      // Try with ignore build errors
      await runCommand('pnpm', ['install', '--ignore-build-errors']);
      console.log('✅ Installation successful with ignored build errors!');

    } catch (error2) {
      console.log('⚠️  Still failing, trying with scripts disabled...');

      try {
        // Last resort: ignore scripts entirely
        await runCommand('pnpm', ['install', '--ignore-scripts']);
        console.log('✅ Installation successful with ignored scripts!');
        console.log('⚠️  Note: Some optional native modules may not work correctly');

      } catch (error3) {
        console.error('❌ All installation methods failed:');
        console.error('1. Normal install:', error.message);
        console.error('2. Ignore build errors:', error2.message);
        console.error('3. Ignore scripts:', error3.message);

        console.log('\n🔧 Manual solution for Python 3.12+ distutils issues:');
        console.log('   sudo apt-get install python3-distutils  # Ubuntu/Debian');
        console.log('   # or');
        console.log('   python3 -m pip install setuptools  # Install setuptools');

        process.exit(1);
      }
    }
  }

  // After successful installation, try to build
  console.log('\n🏗️  Running build process...');
  try {
    await runCommand('npm', ['run', 'build']);
    console.log('✅ Build successful!');
  } catch (buildError) {
    console.error('❌ Build failed:', buildError.message);
    console.log('💡 You may need to run "pnpm build" manually');
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});