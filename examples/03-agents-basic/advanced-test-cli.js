#!/usr/bin/env node

/**
 * Advanced Test CLI for 03-agents-basic example
 *
 * This CLI tool starts the agent backend and provides a prompt interface
 * where users can enter prompts to test the AI agent with a loading spinner
 * and simulates streaming progress.
 */

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
2. **Read File** - Read file contents
3. **Search in Files** - Search for text/patterns within files
4. **Search Files** - Find files by name or pattern
5. **List Folders** - List subdirectories
6. **File Info** - Get file metadata

**WRITE Operations (⚠️ REQUIRE USER PERMISSION):**
1. **Create File** - Create a new file
2. **Update File** - Modify existing file
3. **Delete File** - Remove a file
4. **Rename File** - Rename file or move location
5. **Create Folder** - Create a new directory
6. **Delete Folder** - Remove directory and contents
7. **Rename Folder** - Rename or move directory
8. **Copy File/Folder** - Duplicate files or directories

### Permission Request Protocol

**CRITICAL: Before any WRITE operation, you MUST:**

1. **Clearly state the operation** you want to perform
2. **Show the exact path(s)** that will be affected
3. **Provide a preview** of changes
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

Remember: User trust is paramount. Always be transparent and request permission for any file system changes.
  `
};

// Global server instance
let server = null;

/**
 * Start the agent server
 */
async function startAgentServer() {
  console.log('🤖 Starting Agent Example Server...\n');

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

  console.log('\n✅ Agent server running!');
  console.log('📝 You can now enter prompts to test the agent...\n');
}

/**
 * Send a prompt to the agent and stream the response with progress
 */
async function sendPrompt(prompt) {
  const spinner = ora({
    text: '🤖 Agent is thinking...',
    spinner: 'clock'
  }).start();

  try {
    // Create RPC client
    const client = new RPCClient('http://localhost:8001');
    
    // Start timing
    const startTime = Date.now();
    
    // Execute the agent request
    const result = await client.request('agents.execute', {
      prompt: prompt,
      sdk: 'claude-code',
    });

    // Calculate duration
    const duration = Date.now() - startTime;
    
    spinner.succeed(`✅ Agent response received (${duration / 1000}s)`);

    // Display the agent's response
    console.log('\n' + '='.repeat(60));
    console.log('🤖 Agent Response:');
    console.log(result.content);
    console.log('='.repeat(60));
    console.log(`\n📊 Token Usage: ${result.usage.totalTokens} total (${result.usage.promptTokens} prompt, ${result.usage.completionTokens} completion)`);
    console.log(`🧠 Used Model: ${result.model}\n`);

    // Simulate streaming by showing the response in chunks
    if (result.content.length > 500) {
      console.log('\n🔄 Simulating streaming response...\n');
      const chunks = result.content.match(/.{1,100}/g) || [];
      let accumulatedResponse = '';
      
      for (let i = 0; i < chunks.length; i++) {
        accumulatedResponse += chunks[i];
        
        // Clear and update the line with the current progress
        process.stdout.write('\r\x1b[K'); // Clear current line
        const progress = Math.round(((i + 1) / chunks.length) * 100);
        process.stdout.write(`Streaming... [${'█'.repeat(Math.floor(progress / 5))}${'░'.repeat(20 - Math.floor(progress / 5))}] ${progress}%`);
        
        // Add a small delay to simulate processing
        await new Promise(resolve => setTimeout(resolve, 20));
      }
      
      // Final update with complete response
      process.stdout.write('\n✅ Response streaming complete\n\n');
    }

  } catch (error) {
    spinner.fail('❌ Error getting agent response');
    console.error('Error:', error.message);
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
    rl.question('Enter your prompt: ', async (input) => {
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
        await sendPrompt(prompt);
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