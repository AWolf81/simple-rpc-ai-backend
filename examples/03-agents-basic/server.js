/**
 * Example: Basic Agent Usage with Skills System
 *
 * Demonstrates:
 * - Agent configuration with new skills system
 * - Multi-source skill loading (built-in + local)
 * - Progressive disclosure and sandboxed execution
 */

import { createRpcAiServer } from 'simple-rpc-ai-backend';

async function main() {
  console.log('🤖 Starting Agent Example Server...\n');

  // Create server with agent configuration
  const server = createRpcAiServer({
    port: 8000,
    serverProviders: ['anthropic'], // Using Anthropic for Claude Code

    // Enable agents with new skills system
    agents: {
      enabled: true,

      // Agent behavior configuration (uses main-agent by default)
      agent: {
        // Main agent SKILL.md provides core agentic behavior
        // This is mandatory for proper tool usage and iteration logic
        defaultSkills: ['main-agent']  // Loaded from src/services/agents/builtin/main-agent
      },

      // New skills system configuration
      skills: {
        enabled: true,
        sources: [
          // Built-in core skills (mandatory for file operations)
          { type: 'builtin', name: 'file-handling' },
          { type: 'builtin', name: 'script-caller' },
          { type: 'builtin', name: 'skill-creator' },

          // Local custom skills (examples)
          { type: 'local', path: './examples/03-agents-basic/custom-skills/brand-guidelines' },
          { type: 'local', path: './examples/03-agents-basic/custom-skills/hello-world' }
        ],
        sandbox: {
          allowedPaths: ['/workspace', '/tmp', process.cwd()], // cwd is the agent server directory in examples/03-agents-basic
          timeout: 30000,
          maxMemory: 512 * 1024 * 1024
        },
        validation: {
          enabled: true,
          maxTokens: { level1: 100, level2: 5000 }
        }
      }
    },

    // Enable MCP with default settings
    mcp: {
      enableMCP: false
    },

    // Enable protocols
    protocols: {
      jsonRpc: true,
      tRpc: true
    }
  });

  // Start server
  await server.start();

  console.log('\n✅ Agent server running with skills system!');
  console.log('\n📚 Loaded Skills:');
  console.log('  - file-handling (built-in)');
  console.log('  - brand-guidelines (local custom skill)');
  console.log('  - hello-world (test skill)');
  console.log('\n📖 Testing Guide: SKILL_TESTING_GUIDE.md');

  console.log('\n📝 New Skills System API Examples:');
  console.log(`
// List all loaded skills
await client.agents.skills.list.query();

// Get skill details
await client.agents.skills.get.query({ skillId: 'file-handling' });

// Validate skill structure
await client.agents.skills.validate.query({ skillId: 'brand-guidelines' });

// Get token usage metrics
await client.agents.skills.metrics.query({ skillId: 'file-handling' });

// Execute a skill script
await client.agents.skills.executeScript.mutation({
  skillId: 'brand-guidelines',
  scriptName: 'scripts/validate-colors.ts',
  args: ['/workspace/landing.html']
});

// Match skills by capabilities
await client.agents.skills.match.query({
  capabilities: ['file-read', 'file-write']
});
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
