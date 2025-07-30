import { createAIServer } from '../../dist/index.js';

/**
 * Simple Configuration Example
 * 
 * Demonstrates the cleaner API for system prompts and custom functions.
 * Shows three ways to use AI functionality:
 * 1. Direct systemPrompt in executeAIRequest
 * 2. Config-based systemPrompts with custom functions
 * 3. Built-in default functions
 */

async function main() {
  // Create server with simple configuration
  const server = createAIServer({
    port: 8001,
    mode: 'simple',
    serviceProviders: {
      anthropic: {
        apiKey: process.env.ANTHROPIC_API_KEY || 'demo-key',
        priority: 1
      }
    },
    // Easy way to add custom system prompts
    systemPrompts: {
      'explain-code': 'You are a friendly coding instructor. Explain the provided code in {level} terms. Be encouraging and focus on learning.',
      'fix-bugs': 'You are a debugging expert. Analyze the code and provide specific fixes for any bugs you find. Include the corrected code.',
      'optimize-code': 'You are a performance expert. Suggest optimizations for the provided code while maintaining readability.',
      'add-comments': 'You are a documentation expert. Add clear, helpful comments to the provided code without changing its functionality.'
    }
  });

  // Get server components
  const { functionRegistry/*, promptManager*/ } = server;

  // Register functions that use the config-based prompts
  functionRegistry.registerFunction({
    name: 'explainCode',
    description: 'Explain code in simple terms',
    promptId: 'explain-code',
    parameters: [
      { name: 'content', type: 'string', description: 'Code to explain', required: true },
      { name: 'level', type: 'string', description: 'Explanation level', required: false, default: 'beginner' }
    ]
  });

  functionRegistry.registerFunction({
    name: 'fixBugs',
    description: 'Find and fix bugs in code',
    promptId: 'fix-bugs',
    parameters: [
      { name: 'content', type: 'string', description: 'Code to debug', required: true }
    ]
  });

  functionRegistry.registerFunction({
    name: 'addComments',
    description: 'Add helpful comments to code',
    promptId: 'add-comments',
    parameters: [
      { name: 'content', type: 'string', description: 'Code to comment', required: true }
    ]
  });

  // Start server
  const httpServer = server.start();

  console.log('\n🎯 Simple Configuration Example');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const functions = functionRegistry.listFunctions();
  console.log('\n📋 Available Functions:');
  functions.forEach(func => {
    const type = func.name.startsWith('analyze') || func.name.startsWith('generate') || func.name.startsWith('security') ? '(built-in)' : '(custom)';
    console.log(`   • ${func.name}: ${func.description} ${type}`);
  });

  console.log('\n🧪 Example Usage Patterns:');
  console.log(`
  # 1. Direct systemPrompt (no config needed)
  curl -X POST http://localhost:8001/rpc \\
    -H "Content-Type: application/json" \\
    -d '{
      "jsonrpc": "2.0",
      "method": "executeAIRequest",
      "params": {
        "content": "const x = 5; console.log(x);",
        "systemPrompt": "You are a code reviewer. Analyze this code and suggest improvements."
      },
      "id": 1
    }'

  # 2. Config-based custom function
  curl -X POST http://localhost:8001/rpc \\
    -H "Content-Type: application/json" \\
    -d '{
      "jsonrpc": "2.0",
      "method": "explainCode",
      "params": {
        "content": "const users = data.filter(u => u.active).map(u => u.name);",
        "level": "beginner"
      },
      "id": 2
    }'

  # 3. Built-in function (no setup required)
  curl -X POST http://localhost:8001/rpc \\
    -H "Content-Type: application/json" \\
    -d '{
      "jsonrpc": "2.0",
      "method": "analyzeCode",
      "params": {
        "content": "function factorial(n) { return n === 0 ? 1 : n * factorial(n - 1); }",
        "language": "javascript"
      },
      "id": 3
    }'

  # 4. Config-based debugging function
  curl -X POST http://localhost:8001/rpc \\
    -H "Content-Type: application/json" \\
    -d '{
      "jsonrpc": "2.0",
      "method": "fixBugs",
      "params": {
        "content": "function divide(a, b) { return a / b; }"
      },
      "id": 4
    }'

  # 5. Add comments to code
  curl -X POST http://localhost:8001/rpc \\
    -H "Content-Type: application/json" \\
    -d '{
      "jsonrpc": "2.0",
      "method": "addComments",
      "params": {
        "content": "function quickSort(arr) { if (arr.length <= 1) return arr; const pivot = arr[0]; const left = arr.slice(1).filter(x => x < pivot); const right = arr.slice(1).filter(x => x >= pivot); return [...quickSort(left), pivot, ...quickSort(right)]; }"
      },
      "id": 5
    }'
  `);

  console.log('\n💡 Key Benefits:');
  console.log('   • Direct systemPrompt: No setup, immediate use');
  console.log('   • Config systemPrompts: Centralized, reusable, secure');
  console.log('   • Built-in functions: Advanced features out of the box');
  console.log('   • All system prompts stay server-side (corporate-friendly)');

  console.log('\n🔧 Environment:');
  console.log('   Set ANTHROPIC_API_KEY=your_key for real AI responses');
  console.log('   Server running on port 8001 (different from main example)');

  console.log('\n🛑 Press Ctrl+C to stop');

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down...');
    server.stop();
    httpServer.close(() => {
      console.log('✅ Server stopped');
      process.exit(0);
    });
  });
}

main().catch(console.error);