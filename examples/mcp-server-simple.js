#!/usr/bin/env node

/**
 * Simple MCP Server Example using Official SDK
 * 
 * This demonstrates the new MCP implementation with echo and greeting tools.
 */

import { NewMCPServer } from '../dist/trpc/routers/mcp.js';

async function main() {
  console.log('🤖 Starting Simple MCP Server...');
  
  try {
    // Create new MCP server instance
    const mcpServer = new NewMCPServer();
    
    // Setup the server with stdio transport (for CLI usage)
    await mcpServer.setupStdio();
    
    console.log('✅ MCP Server is ready!');
    console.log('📋 Available tools:');
    console.log('   - greeting: Generate friendly greetings');
    console.log('   - echo: Echo messages with transformations');
    
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

// Only run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}