// Script to remove private key authentication files
import { unlinkSync, existsSync } from 'fs';

const filesToRemove = [
  'C:\\Users\\alexander\\code\\simple-rpc-ai-backend\\examples\\servers\\extension-auth-example.js',
  'C:\\Users\\alexander\\code\\simple-rpc-ai-backend\\examples\\extensions\\extension-auth-client.ts',
  'C:\\Users\\alexander\\code\\simple-rpc-ai-backend\\examples\\extensions\\secure-vscode-auth.ts',
  'C:\\Users\\alexander\\code\\simple-rpc-ai-backend\\examples\\security-enhanced-config.ts',
  'C:\\Users\\alexander\\code\\simple-rpc-ai-backend\\test\\extension-auth.test.ts'
];

for (const file of filesToRemove) {
  try {
    if (existsSync(file)) {
      unlinkSync(file);
      console.log(`Removed: ${file}`);
    } else {
      console.log(`Not found: ${file}`);
    }
  } catch (error) {
    console.error(`Error removing ${file}:`, error.message);
  }
}

console.log('Cleanup complete!');