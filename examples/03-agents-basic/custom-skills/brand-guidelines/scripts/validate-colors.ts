#!/usr/bin/env tsx
import fs from 'fs/promises';

const ALLOWED_COLORS = ['#0066CC', '#FF6600', '#333333', '#FFFFFF'];

const filePath = process.argv[2];
if (!filePath) {
  console.error('Usage: tsx validate-colors.ts <file>');
  process.exit(1);
}

const content = await fs.readFile(filePath, 'utf-8');
const colors = content.match(/#[0-9A-Fa-f]{6}/g) || [];
const invalid = colors.filter(c => !ALLOWED_COLORS.includes(c.toUpperCase()));

if (invalid.length > 0) {
  console.log('❌ Invalid colors:', invalid.join(', '));
  process.exit(1);
}

console.log('✅ All colors valid');
