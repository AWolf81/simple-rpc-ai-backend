#!/usr/bin/env tsx

/**
 * JSON Validator - Validate JSON file syntax
 * Usage: tsx validate-json.ts <file-path>
 */

import fs from 'fs';
import path from 'path';

function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('Error: File path required');
    console.error('Usage: tsx validate-json.ts <file-path>');
    process.exit(1);
  }

  const filePath = args[0];

  // Validate path is in workspace
  const absolutePath = path.resolve(filePath);
  if (!absolutePath.startsWith('/workspace') && !absolutePath.startsWith('/tmp')) {
    console.error('Error: File must be in /workspace or /tmp directory');
    process.exit(1);
  }

  // Check if file exists
  if (!fs.existsSync(absolutePath)) {
    console.error(`Error: File not found: ${absolutePath}`);
    process.exit(1);
  }

  // Read and parse JSON
  try {
    const content = fs.readFileSync(absolutePath, 'utf-8');
    const parsed = JSON.parse(content);

    console.log('✅ Valid JSON');
    console.log(`Type: ${Array.isArray(parsed) ? 'Array' : typeof parsed}`);
    console.log(`Keys: ${typeof parsed === 'object' && !Array.isArray(parsed) ? Object.keys(parsed).length : 'N/A'}`);

    process.exit(0);
  } catch (error: any) {
    console.error('❌ Invalid JSON');
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

main();
