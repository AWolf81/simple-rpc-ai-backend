#!/usr/bin/env node

/**
 * Test CLI for 03-agents-basic example
 *
 * This CLI tool starts the agent backend and provides a prompt interface
 * where users can enter prompts to test the AI agent with a loading spinner.
 */

import { createRpcAiServer } from 'simple-rpc-ai-backend';
import ora from 'ora';
import readline from 'readline';

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
        defaultSkills: [codeReviewSkill, apiDesignSkill]
      }
    },

    // Enable MCP with default settings to avoid configuration errors
    mcp: {
      enabled: false  // Explicitly disable MCP to avoid undefined config issues
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
 * Send a prompt to the agent and stream the response
 */
async function sendPrompt(prompt) {
  const spinner = ora({
    text: '🤖 Agent is thinking...',
    spinner: 'clock'
  }).start();

  try {
    // First, make a request to see if streaming is available
    const response = await fetch('http://localhost:8001/rpc', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'agents.execute',
        params: {
          prompt: prompt,
          sdk: 'claude-code',
        },
        id: Date.now(),
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error.message || 'Agent request failed');
    }

    spinner.succeed('✅ Agent response received');

    // Display the agent's response
    console.log('\n' + '='.repeat(60));
    console.log('🤖 Agent Response:');
    console.log(data.result.content);
    console.log('='.repeat(60));
    console.log(`\n📊 Token Usage: ${data.result.usage.totalTokens} total (${data.result.usage.promptTokens} prompt, ${data.result.usage.completionTokens} completion)`);
    console.log(`🧠 Used Model: ${data.result.model}\n`);

    // In a future implementation, we could use streaming via subscriptions
    // but for now, let's simulate the "progress" during the response
    if (data.result.content.length > 500) {
      // For longer responses, we'll simulate streaming by breaking it into chunks
      console.log('\n🔄 Simulating streaming of longer response...\n');
      const chunks = data.result.content.match(/.{1,100}/g) || [];
      let accumulatedResponse = '';
      
      for (let i = 0; i < chunks.length; i++) {
        accumulatedResponse += chunks[i];
        // Update the display with the current accumulated response
        process.stdout.write('\r\x1b[K'); // Clear current line
        process.stdout.write(accumulatedResponse.slice(-50) + '...'); // Show last 50 chars + ...
        
        // Add a small delay to simulate processing
        await new Promise(resolve => setTimeout(resolve, 50));
        
        if (i === chunks.length - 1) {
          process.stdout.write('\n'); // New line when done
        }
      }
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