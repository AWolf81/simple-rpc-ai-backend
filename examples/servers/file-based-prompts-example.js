import { createAIServerAsync } from '../../dist/index.js';
import { resolve } from 'path';

/**
 * File-Based Prompts Example
 * 
 * Demonstrates loading system prompts from markdown files and various sources.
 * Shows the flexible API design that supports:
 * 1. Inline strings (backward compatible)
 * 2. Markdown files with metadata
 * 3. Future database loading (API ready)
 */

async function main() {
  console.log('🚀 Starting File-Based Prompts Example...');

  try {
    // Create server with prompts from multiple sources
    const server = await createAIServerAsync({
      port: 8002,
      mode: 'simple',
      serviceProviders: {
        anthropic: {
          apiKey: process.env.ANTHROPIC_API_KEY || 'demo-key',
          priority: 1
        }
      },
      systemPrompts: {
        // 1. Simple inline string (backward compatible)
        'quick-review': 'You are a code reviewer. Provide a quick assessment of the code quality and any immediate issues.',

        // 2. File-based loading with metadata
        'explain-code': {
          file: 'examples/prompts/explain-code.md',
          name: 'Code Explanation Expert',
          description: 'Explains code in beginner-friendly terms',
          variables: ['level'],
          category: 'education',
          version: '2.0'
        },

        'fix-bugs': {
          file: 'examples/prompts/fix-bugs.md',
          name: 'Bug Detection and Fixing',
          description: 'Identifies and fixes bugs in code',
          category: 'debugging',
          version: '1.5'
        },

        'commit-message': {
          file: 'examples/prompts/commit-message.md',
          name: 'Git Commit Message Generator',
          description: 'Generates conventional commit messages',
          variables: ['format'],
          category: 'git',
          version: '1.2'
        },

        // 3. Direct content with full metadata
        'optimize-performance': {
          content: `You are a performance optimization expert specializing in {language} applications.

Analyze the provided code and suggest specific optimizations for:
1. **Algorithm Efficiency**: Time and space complexity improvements
2. **Memory Usage**: Reduce allocations and improve garbage collection
3. **I/O Operations**: Optimize database queries, file operations, network calls
4. **Concurrency**: Identify parallelization opportunities
5. **Caching**: Suggest strategic caching points

For each suggestion, provide:
- The specific optimization
- Expected performance impact
- Implementation complexity (Low/Medium/High)
- Any trade-offs or considerations

Focus on {platform} platform optimizations when relevant.`,
          name: 'Performance Optimization Expert',
          description: 'Provides detailed performance optimization suggestions',
          variables: ['language', 'platform'],
          category: 'performance',
          version: '1.0'
        }

        // 4. Future database loading (API ready, but not implemented yet)
        // 'db-prompt': {
        //   db: {
        //     table: 'system_prompts',
        //     id: 'advanced-security-review'
        //   },
        //   name: 'Advanced Security Review',
        //   description: 'Comprehensive security analysis from database',
        //   category: 'security'
        // }
      }
    });

    const { functionRegistry, promptManager } = server;

    // Register functions that use the file-based prompts
    functionRegistry.registerFunction({
      name: 'explainCode',
      description: 'Explain code concepts in learner-friendly terms',
      promptId: 'explain-code',
      parameters: [
        { name: 'content', type: 'string', description: 'Code to explain', required: true },
        { name: 'level', type: 'string', description: 'Learner level (beginner/intermediate/advanced)', required: false, default: 'beginner' }
      ],
      category: 'education'
    });

    functionRegistry.registerFunction({
      name: 'fixBugs',
      description: 'Identify and fix bugs in code',
      promptId: 'fix-bugs',
      parameters: [
        { name: 'content', type: 'string', description: 'Code to debug', required: true }
      ],
      category: 'debugging'
    });

    functionRegistry.registerFunction({
      name: 'generateCommitMessage',
      description: 'Generate conventional commit messages',
      promptId: 'commit-message',
      parameters: [
        { name: 'content', type: 'string', description: 'Git diff or changes', required: true },
        { name: 'format', type: 'string', description: 'Message format (conventional/simple/detailed)', required: false, default: 'conventional' }
      ],
      category: 'git'
    });

    functionRegistry.registerFunction({
      name: 'optimizePerformance',
      description: 'Suggest performance optimizations',
      promptId: 'optimize-performance',
      parameters: [
        { name: 'content', type: 'string', description: 'Code to optimize', required: true },
        { name: 'language', type: 'string', description: 'Programming language', required: false, default: 'javascript' },
        { name: 'platform', type: 'string', description: 'Target platform', required: false, default: 'node.js' }
      ],
      category: 'performance'
    });

    functionRegistry.registerFunction({
      name: 'quickReview',
      description: 'Quick code quality assessment',
      promptId: 'quick-review',
      parameters: [
        { name: 'content', type: 'string', description: 'Code to review', required: true }
      ],
      category: 'review'
    });

    // Start server
    const httpServer = server.start();

    console.log('\n🎯 File-Based Prompts Example Server');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // Show loaded prompts
    const prompts = promptManager.listPrompts();
    console.log('\n📄 Loaded System Prompts:');
    prompts.forEach(prompt => {
      const source = prompt.category === 'custom' && prompt.version ? 'file-based' : 'inline';
      console.log(`   • ${prompt.id}: ${prompt.description} (${source})`);
    });

    // Show available functions
    const functions = functionRegistry.listFunctions();
    console.log('\n🔧 Available Functions:');
    functions.forEach(func => {
      const source = func.name.startsWith('quick') ? 'inline' : 
                    func.name.startsWith('optimize') ? 'content' : 'file';
      console.log(`   • ${func.name}: ${func.description} (${source} prompt)`);
    });

    console.log('\n🧪 Example Usage:');
    console.log(`
    # Explain code using file-based prompt
    curl -X POST http://localhost:8002/rpc \\
      -H "Content-Type: application/json" \\
      -d '{
        "jsonrpc": "2.0",
        "method": "explainCode",
        "params": {
          "content": "const factorial = n => n <= 1 ? 1 : n * factorial(n - 1);",
          "level": "beginner"
        },
        "id": 1
      }'

    # Fix bugs using markdown prompt
    curl -X POST http://localhost:8002/rpc \\
      -H "Content-Type: application/json" \\
      -d '{
        "jsonrpc": "2.0",
        "method": "fixBugs",
        "params": {
          "content": "function divide(a, b) { return a / b; }"
        },
        "id": 2
      }'
    `);

    console.log('\n💡 Prompt Loading Sources:');
    console.log('   ✅ Inline strings: Immediate, simple setup');
    console.log('   ✅ Markdown files: Version controlled, collaborative editing');
    console.log('   ✅ Content objects: Full metadata support');
    console.log('   🔄 Database loading: API ready for future implementation');

    console.log('\n🔧 Environment:');
    console.log('   Set ANTHROPIC_API_KEY=your_key for real AI responses');
    console.log('   Prompt files: examples/prompts/*.md');
    console.log('   Server: http://localhost:8002');

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

  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    if (error.message.includes('ENOENT')) {
      console.log('\n💡 Make sure you run this from the project root directory');
      console.log('   The prompt files should be at examples/prompts/*.md');
    }
    process.exit(1);
  }
}

main().catch(console.error);