/**
 * Skills Plugin - List and interact with available skills
 */

export default {
  command: 'skills',
  description: 'List available skills and their capabilities',

  async handler(args, context) {
    const { client } = context;

    try {
      // List all available skills via tRPC client
      const result = await client.agents.skills.list.query();

      if (!result || !result.skills || result.skills.length === 0) {
        return '📦 No skills currently loaded.\n\nSkills can be loaded from:\n- Built-in skills (file-handling, etc.)\n- Local custom skills\n- GitHub repositories\n- npm packages';
      }

      let output = '📚 Available Skills:\n\n';

      for (const skill of result.skills) {
        output += `### ${skill.name}\n`;
        output += `**Description:** ${skill.description}\n`;
        output += `**Version:** ${skill.version}\n`;
        output += `**Capabilities:** ${skill.capabilities.join(', ')}\n`;
        output += `**Source:** ${skill.sourceType}\n`;
        output += `**Tokens:** L1: ${skill.level1Tokens}, L2: ${skill.level2Tokens}\n`;
        output += '\n';
      }

      output += `\n💡 Use /help to see other available commands`;

      return output;
    } catch (error) {
      return `❌ Error listing skills: ${error.message}`;
    }
  }
};
