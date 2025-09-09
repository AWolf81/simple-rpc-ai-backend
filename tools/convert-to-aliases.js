#!/usr/bin/env node
/**
 * Convert relative imports to path aliases
 */

import { readFileSync, writeFileSync } from 'fs';
import { glob } from 'glob';

const aliases = {
  '../services/': '@services/',
  '../../services/': '@services/',
  '../../../services/': '@services/',
  '../auth/': '@auth/',
  '../../auth/': '@auth/',
  '../../../auth/': '@auth/',
  '../trpc/': '@trpc/',
  '../../trpc/': '@trpc/',
  '../database/': '@database/',
  '../../database/': '@database/',
  '../billing/': '@billing/',
  '../../billing/': '@billing/',
  '../security/': '@security/',
  '../../security/': '@security/',
  '../storage/': '@storage/',
  '../../storage/': '@storage/',
  '../schemas/': '@schemas/',
  '../../schemas/': '@schemas/',
  '../mcp/': '@mcp/',
  '../../mcp/': '@mcp/',
  '../monetization/': '@monetization/',
  '../../monetization/': '@monetization/',
  '../middleware/': '@middleware/',
  '../../middleware/': '@middleware/',
};

async function convertFile(filePath) {
  let content = readFileSync(filePath, 'utf8');
  let changed = false;

  for (const [relative, alias] of Object.entries(aliases)) {
    const oldPattern = new RegExp(`from ['"]${relative.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'g');
    const newPattern = `from '${alias}`;
    
    if (content.includes(`from '${relative}`) || content.includes(`from "${relative}`)) {
      content = content.replace(oldPattern, newPattern);
      content = content.replace(new RegExp(`from [""]${relative.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'g'), newPattern);
      changed = true;
    }
  }

  if (changed) {
    writeFileSync(filePath, content);
    console.log(`✅ Updated: ${filePath}`);
  }
}

async function main() {
  const files = await glob('src/**/*.ts');
  console.log(`🔄 Converting ${files.length} TypeScript files to use path aliases...`);
  
  for (const file of files) {
    await convertFile(file);
  }
  
  console.log('✨ Done! All imports converted to use path aliases.');
}

main().catch(console.error);