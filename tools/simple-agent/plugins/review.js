/**
 * Review Plugin - Quick code review command
 */

import { promises as fs } from 'fs';
import path from 'path';

export default {
  command: 'review',
  description: 'Review code in a file',

  async handler(args, context) {
    if (args.length === 0) {
      throw new Error('Usage: /review <file-path>');
    }

    const filePath = args.join(' ');

    try {
      // Read file
      const content = await fs.readFile(filePath, 'utf-8');

      // Send to agent for review
      const result = await context.client.request('agents.execute', {
        prompt: `Review this code from ${filePath}:\n\n\`\`\`\n${content}\n\`\`\``,
        model: context.model,
        sdk: 'claude-code'
      });

      return result.content;
    } catch (error) {
      throw new Error(`Failed to review file: ${error.message}`);
    }
  }
};
