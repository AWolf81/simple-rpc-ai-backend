/**
 * Example: Basic Agent Usage with Claude Code SDK
 *
 * Demonstrates:
 * - Agent configuration with skills
 * - Executing agent requests
 * - Using skills for specialized tasks
 */

import { createRpcAiServer } from 'simple-rpc-ai-backend';
// import { AgentSkill } from '../../src/services/agents/types';

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

async function main() {
  console.log('🤖 Starting Agent Example Server...\n');

  // Create server with agent configuration
  const server = createRpcAiServer({
    port: 8000,
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
  console.log('\nAvailable skills:');
  console.log('  - Code Review Expert (code-reviewer)');
  console.log('  - API Design Expert (api-designer)');

  console.log('\n📝 Example tRPC usage (TypeScript):');
  console.log(`
import { createTypedAIClient } from 'simple-rpc-ai-backend';

const client = createTypedAIClient({
  links: [httpBatchLink({ url: 'http://localhost:8000/trpc' })]
});

// Execute code review
const result = await client.agents.execute.mutate({
  prompt: \`
    Review this authentication code:

    app.post('/login', (req, res) => {
      const query = "SELECT * FROM users WHERE email = '" + req.body.email + "'";
      db.query(query, (err, results) => {
        if (results.length > 0) {
          res.json({ success: true });
        }
      });
    });
  \`,
  systemPrompt: 'You are a security expert. Use the Code Review Expert skill.',
  sdk: 'claude-code'
});

console.log(result.content);
  `);

  console.log('\n📝 Example JSON-RPC usage (cURL):');
  console.log(`
curl -X POST http://localhost:8000/rpc \\
  -H "Content-Type: application/json" \\
  -d '{
    "jsonrpc": "2.0",
    "method": "agents.execute",
    "params": {
      "prompt": "Design a RESTful API for a blog platform with posts and comments",
      "systemPrompt": "You are an API architect. Use the API Design Expert skill.",
      "sdk": "claude-code"
    },
    "id": 1
  }'
  `);

  console.log('\n📋 List available skills:');
  console.log(`
curl -X POST http://localhost:8000/rpc \\
  -H "Content-Type: application/json" \\
  -d '{
    "jsonrpc": "2.0",
    "method": "agents.listSkills",
    "params": {},
    "id": 1
  }'
  `);

  console.log('\n🔍 API Endpoints:');
  console.log('  - JSON-RPC: http://localhost:8000/rpc');
  console.log('  - tRPC: http://localhost:8000/trpc');
  console.log('  - Health: http://localhost:8000/health');

  console.log('\n💡 Press Ctrl+C to stop the server\n');
}

// Handle errors
main().catch(error => {
  console.error('❌ Failed to start server:', error);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down...');
  process.exit(0);
});
