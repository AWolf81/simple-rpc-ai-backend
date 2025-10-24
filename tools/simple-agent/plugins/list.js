/**
 * List Plugin - List files in a directory using file-handling skill
 */

export default {
  command: 'list',
  description: 'List files in a directory',

  async handler(args, context) {
    const { client } = context;
    const directory = args[0] || '.';

    try {
      // Use the file-handling skill to search for files
      const result = await client.request('agents.skills.executeScript', {
        skillId: 'file-handling',
        scriptName: 'scripts/search-files.ts',
        args: ['*', directory] // List all files (*) in the given directory
      });

      if (result.exitCode === 0) {
        return `📁 Files in ${directory}:\n\n${result.stdout}`;
      } else {
        return `❌ Error listing files:\n${result.stderr}`;
      }
    } catch (error) {
      return `❌ Error: ${error.message}`;
    }
  }
};
