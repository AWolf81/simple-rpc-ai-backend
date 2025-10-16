import * as esbuild from 'esbuild';
import { writeFileSync, readFileSync } from 'fs';

// Build with esbuild - fully bundle
await esbuild.build({
  entryPoints: ['src/cli.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: 'dist/cli.js',
  // Only external - system modules that can't be bundled
  packages: 'external'
});

// Add shebang (remove existing one first)
let content = readFileSync('dist/cli.js', 'utf-8');
content = content.replace(/^#!.*\n/, ''); // Remove any existing shebang
writeFileSync('dist/cli.js', '#!/usr/bin/env node\n' + content);

console.log('✅ Built dist/cli.js');
