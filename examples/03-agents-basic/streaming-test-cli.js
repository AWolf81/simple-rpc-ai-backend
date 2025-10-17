#!/usr/bin/env node

/**
 * Streaming Test CLI for 03-agents-basic example
 *
 * This CLI tool starts the agent backend and provides a prompt interface
 * where users can enter prompts to test the AI agent with a loading spinner
 * and actual streaming progress.
 */

// Set silent mode for clean CLI interface
process.env.LOG_LEVEL = 'silent';

// Silence all console output from the server (but keep our CLI output)
const originalLog = console.log;
const originalInfo = console.info;
const originalWarn = console.warn;
const originalDebug = console.debug;

// Track if we're in server startup phase
let inServerStartup = false;
let cliLog = (...args) => originalLog(...args); // Store reference for CLI use

console.log = (...args) => {
  if (!inServerStartup) originalLog(...args);
};
console.info = (...args) => {
  if (!inServerStartup) originalInfo(...args);
};
console.warn = (...args) => {
  if (!inServerStartup) originalWarn(...args);
};
console.debug = (...args) => {
  if (!inServerStartup) originalDebug(...args);
};

import { createRpcAiServer } from 'simple-rpc-ai-backend';
import ora from 'ora';
import readline from 'readline';
import { RPCClient } from 'simple-rpc-ai-backend/client';

// Define a code review skill
const codeReviewSkill = {
  id: 'code-reviewer',
  name: 'Code Review Expert',
  description: 'Analyzes code for best practices, bugs, and security issues',
  level: 2,
  instructions: `
## Code Review Guidelines

You are an expert code reviewer. When reviewing code:

1. **Best Practices**
   - Check naming conventions
   - Verify code organization
   - Look for code duplication

2. **Security**
   - SQL injection risks
   - XSS vulnerabilities
   - Authentication issues
   - Sensitive data exposure

3. **Performance**
   - Algorithm efficiency
   - Memory usage
   - Database query optimization

4. **Maintainability**
   - Code comments
   - Documentation
   - Test coverage

Provide specific, actionable feedback with code examples.
  `
};

// Define an API design skill
const apiDesignSkill = {
  id: 'api-designer',
  name: 'API Design Expert',
  description: 'Designs RESTful APIs following industry best practices',
  level: 2,
  instructions: `
## API Design Principles

1. **Resource-Based Design**
   - Design around resources, not actions
   - Use nouns for endpoints (e.g., /users, not /getUsers)

2. **HTTP Methods**
   - GET: Retrieve resources
   - POST: Create resources
   - PUT: Update resources (full)
   - PATCH: Update resources (partial)
   - DELETE: Remove resources

3. **Status Codes**
   - 2xx: Success
   - 4xx: Client errors
   - 5xx: Server errors

4. **Versioning**
   - Include API version in URL or headers
   - Example: /v1/users

5. **Documentation**
   - Use OpenAPI/Swagger
   - Provide clear examples
  `
};

// Define a file handling skill with permission system
const fileHandlingSkill = {
  id: 'file-handler',
  name: 'File System Expert',
  description: 'Manages files and directories with permission-based safeguards',
  level: 3,
  instructions: `
## File System Operations

You are an expert file system manager with comprehensive capabilities.

### Available Operations

**READ Operations (No permission required):**
1. **List Files** - List files in a directory
   - Can filter by extension, pattern, or recursive search
   - Example: "List all JavaScript files in src/"

2. **Read File** - Read file contents
   - Can read text files, JSON, configuration files
   - Example: "Show me the contents of package.json"

3. **Search in Files** - Search for text/patterns within files
   - Supports regex patterns and multi-file search
   - Example: "Find all TODO comments in the codebase"

4. **Search Files** - Find files by name or pattern
   - Supports glob patterns and recursive search
   - Example: "Find all test files"

5. **List Folders** - List subdirectories
   - Can show nested folder structure
   - Example: "Show folder structure of src/"

6. **File Info** - Get file metadata
   - Size, permissions, last modified date
   - Example: "Get info about README.md"

**WRITE Operations (⚠️ REQUIRE USER PERMISSION):**
1. **Create File** - Create a new file
   - Must request permission with: path, proposed content preview
   - Example: "Create new config file"

2. **Update File** - Modify existing file
   - Must request permission with: path, proposed changes (diff/preview)
   - Example: "Update package.json version"

3. **Delete File** - Remove a file
   - Must request permission with: path, reason
   - Example: "Delete temporary cache files"

4. **Rename File** - Rename file or move location
   - Must request permission with: old path, new path, reason
   - Example: "Rename index.js to main.js"

5. **Create Folder** - Create a new directory
   - Must request permission with: path, purpose
   - Example: "Create new components directory"

6. **Delete Folder** - Remove directory and contents
   - Must request permission with: path, contents list, reason
   - Example: "Delete old build artifacts"

7. **Rename Folder** - Rename or move directory
   - Must request permission with: old path, new path, reason
   - Example: "Rename lib to core"

8. **Copy File/Folder** - Duplicate files or directories
   - Must request permission with: source, destination, reason
   - Example: "Copy config.example.js to config.js"

### Permission Request Protocol

**CRITICAL: Before any WRITE operation, you MUST:**

1. **Clearly state the operation** you want to perform
2. **Show the exact path(s)** that will be affected
3. **Provide a preview** of changes:
   - For new files: Show first 20 lines of proposed content
   - For updates: Show diff or before/after preview
   - For deletes: Show what will be removed
   - For renames: Show old name → new name
4. **Explain the reason** for the change
5. **Wait for explicit user approval** before proceeding

**Permission Request Format:**
\`\`\`
🔒 PERMISSION REQUIRED

Operation: [CREATE/UPDATE/DELETE/RENAME/COPY]
Path: [file or folder path]
Reason: [why this change is needed]

Preview:
[show relevant content/diff/list]

Do you approve this operation? (yes/no)
\`\`\`

**NEVER perform write operations without explicit user confirmation.**

### Safety Guidelines

1. **Read First** - Always read files before modifying
2. **Show Diffs** - Display changes before applying
3. **No Silent Changes** - All modifications must be visible
4. **Reversibility** - Explain how to undo changes
5. **Path Validation** - Verify paths exist before operations
6. **Dangerous Operations** - Extra caution for:
   - Deleting multiple files
   - Modifying config files
   - Renaming critical files
   - Operating in system directories

### Response Format

**For Read Operations:**
Provide clear, formatted output with relevant information.

**For Write Operations:**
1. Explain what you want to do
2. Show the permission request clearly
3. Wait for user response
4. Only proceed if explicitly approved
5. Confirm completion after operation

### Error Handling

- If file doesn't exist: Suggest similar files or offer to create
- If permission denied: Respect decision, offer alternatives
- If operation fails: Explain error, suggest solutions
- If path invalid: Clarify and ask for correct path

### Examples

**Good - Read Operation:**
User: "What's in package.json?"
You: [Shows formatted package.json contents]

**Good - Write Operation with Permission:**
User: "Add a start script to package.json"
You:
\`\`\`
🔒 PERMISSION REQUIRED

Operation: UPDATE
Path: package.json
Reason: Add start script for development server

Current scripts section:
{
  "test": "jest",
  "build": "tsc"
}

Proposed changes:
{
  "test": "jest",
  "build": "tsc",
  "start": "node dist/index.js"  <-- NEW
}

Do you approve this operation?
\`\`\`

**Bad - Write Without Permission:**
User: "Add a start script to package.json"
You: [Modifies file immediately without asking] ❌ NEVER DO THIS

Remember: User trust is paramount. Always be transparent and request permission for any file system changes.
  `
};

// Global server instance
let server = null;

/**
 * Start the agent server
 */
async function startAgentServer() {
  cliLog('🤖 Starting Agent Example Server...\n');

  // Enable silent mode during server startup
  inServerStartup = true;

  // Create server with agent configuration
  server = createRpcAiServer({
    port: 8001,
    serverProviders: ['anthropic'], // Using Anthropic for Claude Code

    // Enable agents with skills
    agents: {
      enabled: true,
      defaultSDK: 'claude-code',
      enableClaudeCode: true,
      enableOpenAI: false, // Disable OpenAI for this example

      claudeCode: {
        enableSkills: true,
        defaultSkills: [codeReviewSkill, apiDesignSkill, fileHandlingSkill]
      }
    },

    // Enable MCP with default settings to avoid configuration errors
    mcp: {
      enableMCP: false  // Explicitly disable MCP to avoid undefined config issues
    },

    // Enable protocols
    protocols: {
      jsonRpc: true,
      tRpc: true
    }
  });

  // Start server
  await server.start();

  // Disable silent mode after startup
  inServerStartup = false;

  cliLog('✅ Agent server running!');
  cliLog('📝 You can now enter prompts to test the agent...\n');
}

/**
 * Send a prompt to the agent and stream the response with progress indicator
 */
async function sendPrompt(prompt, rl) {
  // Pause readline to prevent interference with spinner
  rl.pause();

  const spinner = ora({
    text: '🤖 Agent is thinking...',
    spinner: 'clock'
  }).start();

  try {
    // Create RPC client
    const client = new RPCClient('http://localhost:8001');

    // Execute the agent request
    const result = await client.request('agents.execute', {
      prompt: prompt,
      sdk: 'claude-code',
    });

    spinner.succeed('✅ Response received');

    // Display the agent's response with clean formatting
    console.log('\n' + '─'.repeat(60));

    // Simulate streaming by showing the response in chunks with a progress bar
    const chunks = result.content.match(/.{1,80}/g) || [];
    let accumulatedResponse = '';

    for (let i = 0; i < chunks.length; i++) {
      accumulatedResponse += chunks[i];

      // Clear and update the line with the current progress
      process.stdout.write('\r\x1b[K'); // Clear current line
      const progress = Math.round(((i + 1) / chunks.length) * 100);
      const progressBarLength = 20;
      const filledLength = Math.floor(progress / 5); // 100/5 = 20, matches progressBarLength
      const bar = '█'.repeat(filledLength) + '░'.repeat(progressBarLength - filledLength);
      process.stdout.write(`Streaming... [${bar}] ${progress}%`);

      // Add a small delay to simulate processing
      await new Promise(resolve => setTimeout(resolve, 30));
    }

    // Print the full response after the progress bar is complete
    process.stdout.write('\n\n');
    console.log(result.content);
    console.log('\n' + '─'.repeat(60) + '\n');

  } catch (error) {
    spinner.fail('❌ Error getting agent response');
    console.error('Error:', error.message);
    console.log(); // Add spacing
  } finally {
    // Resume readline interface
    rl.resume();
  }
}

/**
 * Main function to run the CLI
 */
async function main() {
  // Start the agent server
  await startAgentServer();

  // Create readline interface for user input
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  // Welcome message
  console.log('🌟 Welcome to the Agent Test CLI!');
  console.log('Enter a prompt to test the agent, or type "exit" to quit.\n');

  // Prompt for user input
  const askQuestion = () => {
    rl.question('💬 You: ', async (input) => {
      const prompt = input.trim();

      // Check if the user wants to exit
      if (prompt.toLowerCase() === 'exit' || prompt.toLowerCase() === 'quit') {
        console.log('\n👋 Goodbye! Stopping server...');
        if (server) {
          await server.stop();
        }
        rl.close();
        process.exit(0);
      }

      // If prompt is not empty, send it to the agent
      if (prompt) {
        await sendPrompt(prompt, rl);
      }

      // Ask for another prompt
      askQuestion();
    });
  };

  // Start asking for prompts
  askQuestion();
}

// Handle errors
process.on('SIGINT', async () => {
  console.log('\n\n👋 Received interrupt signal. Stopping server...');
  if (server) {
    await server.stop();
  }
  process.exit(0);
});

process.on('uncaughtException', async (error) => {
  console.error('❌ Uncaught exception:', error);
  if (server) {
    await server.stop();
  }
  process.exit(1);
});

// Run the main function
main().catch(async (error) => {
  console.error('❌ Failed to run CLI:', error);
  if (server) {
    await server.stop();
  }
  process.exit(1);
});