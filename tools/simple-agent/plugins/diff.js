/**
 * Diff Plugin - Show git diff for files
 */

import { execSync } from 'child_process';

export default {
  command: 'diff',
  description: 'Show git diff of changes',

  async handler(args, context) {
    const filePath = args.join(' ');

    try {
      let command = 'git diff';
      if (filePath) {
        command += ` ${filePath}`;
      }

      const output = execSync(command, {
        encoding: 'utf-8',
        maxBuffer: 1024 * 1024 * 10 // 10MB
      });

      if (!output.trim()) {
        return 'No changes detected';
      }

      // Send diff to agent for analysis
      const result = await context.client.request('agents.execute', {
        prompt: `Analyze this git diff and explain the changes:\n\n\`\`\`diff\n${output}\n\`\`\``,
        model: context.model,
        sdk: 'claude-code'
      });

      return result.content;
    } catch (error) {
      throw new Error(`Failed to get diff: ${error.message}`);
    }
  }
};
