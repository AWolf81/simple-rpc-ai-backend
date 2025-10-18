/**
 * Help Plugin - Display available commands and usage
 */

export default {
  command: 'help',
  description: 'Show available commands and usage information',

  async handler(args, context) {
    return `
📚 Simple Agent CLI - Help

**Built-in Commands:**
  /help          - Show this help message
  /exit, /quit   - Exit the CLI
  /clear         - Clear chat history
  /model <name>  - Switch AI model

**Agent Skills:**
  The agent has the following skills:
  • Code Review Expert - Analyzes code for best practices and security
  • File System Expert - Manages files with permission safeguards
  • API Design Expert - Designs RESTful APIs

**Usage Examples:**
  "Review the code in app.js"
  "List all JavaScript files in src/"
  "Design a REST API for a blog"
  "Create a new file called config.json"

**File Operations:**
  Read operations (no permission): list, read, search
  Write operations (requires permission): create, update, delete, rename

**Tips:**
  • The agent will ask permission before modifying files
  • Use natural language - the agent understands context
  • Press Ctrl+C or type /exit to quit
    `.trim();
  }
};
