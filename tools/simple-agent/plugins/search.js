/**
 * Search Plugin - Quick file search command
 */

import { execSync } from 'child_process';

export default {
  command: 'search',
  description: 'Search for files or content',

  async handler(args, context) {
    if (args.length === 0) {
      throw new Error('Usage: /search <pattern> [--in-files]');
    }

    const inFiles = args.includes('--in-files');
    const pattern = args.filter(a => !a.startsWith('--')).join(' ');

    try {
      let command;

      if (inFiles) {
        // Search in file contents using grep
        command = `grep -r "${pattern}" . --exclude-dir=node_modules --exclude-dir=.git`;
      } else {
        // Search for files using find
        command = `find . -name "*${pattern}*" -not -path "*/node_modules/*" -not -path "*/.git/*"`;
      }

      const output = execSync(command, {
        encoding: 'utf-8',
        maxBuffer: 1024 * 1024 * 10 // 10MB
      });

      if (!output.trim()) {
        return `No results found for: ${pattern}`;
      }

      const lines = output.trim().split('\n');
      const limited = lines.slice(0, 50); // Limit to 50 results

      let result = `Found ${lines.length} result(s) for "${pattern}":\n\n`;
      result += limited.join('\n');

      if (lines.length > 50) {
        result += `\n\n... and ${lines.length - 50} more`;
      }

      return result;
    } catch (error) {
      // grep returns exit code 1 when no matches found
      if (error.status === 1) {
        return `No results found for: ${pattern}`;
      }
      throw new Error(`Search failed: ${error.message}`);
    }
  }
};
