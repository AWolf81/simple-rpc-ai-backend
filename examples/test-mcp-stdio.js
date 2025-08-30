#!/usr/bin/env node

/**
 * Test MCP Server with Stdio Transport
 * This tests the MCP server using stdio transport (the standard MCP way)
 */

import { NewMCPServer } from '../dist/trpc/routers/mcp.js';

async function main() {
  console.log('🤖 Starting MCP Server with stdio transport...');
  
  try {
    // Create new MCP server instance
    const mcpServer = new NewMCPServer();
    
    // Setup stdio transport
    await mcpServer.setupStdio();
    
    console.log('✅ MCP Server is ready with stdio transport!');
    console.log('📋 Available tools:');
    console.log('   - greeting: Generate friendly greetings');
    console.log('   - echo: Echo messages with transformations');
    console.log('');
    console.log('🔧 This server communicates via stdin/stdout (standard MCP protocol)');
    
    // Keep the server running
    process.on('SIGINT', async () => {
      console.log('\n🛑 Shutting down MCP server...');
      await mcpServer.close();
      process.exit(0);
    });
    
  } catch (error) {
    console.error('❌ Failed to start MCP server:', error);
    process.exit(1);
  }
}

main().catch(console.error);