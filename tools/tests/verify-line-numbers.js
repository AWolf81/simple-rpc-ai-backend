#!/usr/bin/env node

/**
 * Verify that the generated line numbers in dist/trpc-methods.json
 * correspond to the actual procedure definitions in source files.
 */

import { readFileSync, existsSync } from 'fs';
import path from 'path';

function loadProcedures() {
  const jsonPath = path.resolve('dist/trpc-methods.json');
  if (!existsSync(jsonPath)) {
    throw new Error('dist/trpc-methods.json not found. Run `pnpm trpc:build` first.');
  }
  const data = JSON.parse(readFileSync(jsonPath, 'utf8'));
  return data.procedures || {};
}

function computeDocStart(lines, startIndex) {
  for (let i = startIndex; i >= 0; i--) {
    const trimmed = lines[i].trim();
    if (trimmed === '') {
      continue;
    }
    if (trimmed.startsWith('/**')) {
      return i + 1;
    }
    if (trimmed.startsWith('*') || trimmed === '*/') {
      continue;
    }
    break;
  }
  return null;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function findProcedureLine(lines, procName) {
  const pattern = new RegExp(`(^|\\s)${escapeRegExp(procName)}\\s*:`, 'm');
  for (let i = 0; i < lines.length; i++) {
    if (pattern.test(lines[i])) {
      return i;
    }
  }
  return null;
}

function verifyLineNumbers() {
  const procedures = loadProcedures();
  const errors = [];

  for (const [procedure, info] of Object.entries(procedures)) {
    const { sourceFile, lineNumber } = info;
    if (!sourceFile || !lineNumber) {
      continue;
    }

    const filePath = path.resolve(sourceFile);
    if (!existsSync(filePath)) {
      errors.push({
        procedure,
        message: `Source file not found: ${sourceFile}`
      });
      continue;
    }

    const lines = readFileSync(filePath, 'utf8').split('\n');
    const procName = procedure.split('.').pop();
    if (!procName) {
      continue;
    }

    const definitionIndex = findProcedureLine(lines, procName);
    if (definitionIndex === null) {
      errors.push({
        procedure,
        message: 'Procedure definition not found in source file'
      });
      continue;
    }

    const expectedLine = definitionIndex + 1;

    if (lineNumber !== expectedLine) {
      errors.push({
        procedure,
        expected: expectedLine,
        recorded: lineNumber,
        sourceFile
      });
    }
  }

  if (errors.length > 0) {
    console.error('❌ Line number mismatches detected:');
    for (const error of errors) {
      if (error.message) {
        console.error(`- ${error.procedure}: ${error.message}`);
      } else {
        console.error(`- ${error.procedure}: expected ${error.expected}, recorded ${error.recorded} (${error.sourceFile})`);
      }
    }
    process.exitCode = 1;
  } else {
    console.log('✅ All recorded line numbers match their source definitions.');
  }
}

try {
  verifyLineNumbers();
} catch (error) {
  console.error('❌ Verification failed:', error.message);
  process.exitCode = 1;
}
