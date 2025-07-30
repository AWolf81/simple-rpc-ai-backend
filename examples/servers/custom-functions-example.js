import { createAIServer } from '../../dist/index.js';

/**
 * Custom Functions Example Server
 * 
 * Demonstrates how to use the built-in custom AI functions
 * and register your own custom functions with centralized prompts.
 */

function main() {
  // Create server with custom function support and system prompts
  const server = createAIServer({
    port: 8000,
    mode: 'simple', // No authentication needed for demo
    serviceProviders: {
      anthropic: {
        apiKey: process.env.ANTHROPIC_API_KEY || 'demo-key',
        priority: 1
      }
    },
    // Register custom system prompts directly in config
    systemPrompts: {
      'explain-code': `You are a friendly coding instructor. Explain the provided code in {level} terms.

Your explanation should:
1. **What it does**: Describe the purpose and functionality
2. **How it works**: Break down the logic step by step
3. **Key concepts**: Explain any important programming concepts used
4. **Why it matters**: Explain why this code is written this way

Adjust your language and depth based on the {level} level:
- **Beginner**: Use simple language, explain basic concepts, avoid jargon
- **Intermediate**: Include some technical terms, explain patterns and best practices
- **Advanced**: Discuss performance, architecture, and advanced concepts

Be encouraging and focus on helping the reader understand and learn.`,

      'commit-message': `You are a git expert. Generate a {format} commit message for the provided code changes.

Guidelines:
1. **Conventional Format** (if format=conventional):
   - Use format: type(scope): description
   - Types: feat, fix, docs, style, refactor, test, chore
   - Keep first line under 50 characters
   - Include body for complex changes

2. **Simple Format** (if format=simple):
   - Clear, concise description of what changed
   - Focus on the "what" and "why"

3. **Detailed Format** (if format=detailed):
   - Include detailed description
   - List all changes made
   - Explain reasoning for changes

Analyze the diff and generate an appropriate commit message. Be specific and accurate.`
    }
  });

  // Get access to the function registry and prompt manager
  const { functionRegistry, promptManager } = server;

  // Register a custom function for code documentation
  functionRegistry.registerFunction({
    name: 'explainCode',
    description: 'Explain code in simple terms for beginners',
    promptId: 'explain-code',
    parameters: [
      {
        name: 'content',
        type: 'string',
        description: 'The code to explain',
        required: true
      },
      {
        name: 'level',
        type: 'string',
        description: 'Explanation level (beginner, intermediate, advanced)',
        required: false,
        default: 'beginner'
      }
    ],
    category: 'education',
    version: '1.0'
  });

  // Register another custom function for commit message generation
  functionRegistry.registerFunction({
    name: 'generateCommitMessage',
    description: 'Generate conventional commit messages from code changes',
    promptId: 'commit-message',
    parameters: [
      {
        name: 'content',
        type: 'string',
        description: 'The git diff or code changes',
        required: true
      },
      {
        name: 'format',
        type: 'string',
        description: 'Commit format (conventional, simple, detailed)',
        required: false,
        default: 'conventional'
      }
    ],
    category: 'git',
    version: '1.0'
  });

  // Start the server
  const httpServer = server.start();
  
  console.log('\n🎯 Custom Functions Example Server');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  // List all available functions
  const functions = functionRegistry.listFunctions();
  console.log('\n📋 Available Custom Functions:');
  functions.forEach(func => {
    console.log(`   • ${func.name}: ${func.description}`);
  });

  console.log('\n🧪 Try these example requests:');
  console.log(`
  # Analyze JavaScript code (built-in function)
  curl -X POST http://localhost:8000/rpc \\
    -H "Content-Type: application/json" \\
    -d '{
      "jsonrpc": "2.0",
      "method": "analyzeCode",
      "params": {
        "content": "function fibonacci(n) { if (n <= 1) return n; return fibonacci(n-1) + fibonacci(n-2); }",
        "language": "javascript"
      },
      "id": 1
    }'

  # Generate tests for a function (built-in function)
  curl -X POST http://localhost:8000/rpc \\
    -H "Content-Type: application/json" \\
    -d '{
      "jsonrpc": "2.0",
      "method": "generateTests",
      "params": {
        "content": "export function add(a, b) { return a + b; }",
        "framework": "vitest"
      },
      "id": 2
    }'

  # Explain code for beginners (custom function from config)
  curl -X POST http://localhost:8000/rpc \\
    -H "Content-Type: application/json" \\
    -d '{
      "jsonrpc": "2.0",
      "method": "explainCode",
      "params": {
        "content": "const users = await fetch('/api/users').then(r => r.json());",
        "level": "beginner"
      },
      "id": 3
    }'

  # Generate commit message (custom function from config)
  curl -X POST http://localhost:8000/rpc \\
    -H "Content-Type: application/json" \\
    -d '{
      "jsonrpc": "2.0",
      "method": "generateCommitMessage",
      "params": {
        "content": "+ function add(a, b) { return a + b; }\\n+ export { add };",
        "format": "conventional"
      },
      "id": 4
    }'

  # Security review (built-in function)
  curl -X POST http://localhost:8000/rpc \\
    -H "Content-Type: application/json" \\
    -d '{
      "jsonrpc": "2.0",
      "method": "securityReview",
      "params": {
        "content": "app.get('/user/:id', (req, res) => { const query = 'SELECT * FROM users WHERE id = ' + req.params.id; db.query(query, (err, result) => res.json(result)); });"
      },
      "id": 5
    }'

  # List available functions
  curl -X POST http://localhost:8000/rpc \\
    -H "Content-Type: application/json" \\
    -d '{
      "jsonrpc": "2.0",
      "method": "listCustomFunctions",
      "params": {},
      "id": 6
    }'
  `);

  console.log('\n🔧 Environment Setup:');
  console.log('   Set ANTHROPIC_API_KEY=your_key for real AI responses');
  console.log('   Or use any other supported AI provider');
  
  console.log('\n🛑 Press Ctrl+C to stop the server');

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down server...');
    server.stop();
    httpServer.close(() => {
      console.log('✅ Server stopped');
      process.exit(0);
    });
  });
}

main().catch(console.error);