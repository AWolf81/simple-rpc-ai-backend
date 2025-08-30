#!/usr/bin/env node

/**
 * Test HTTP MCP Server
 * Tests the new MCP implementation via HTTP requests
 */

import express from 'express';
import { NewMCPServer } from '../dist/trpc/routers/mcp.js';

async function startServer() {
  const app = express();
  const PORT = 8001;
  
  // Add JSON body parser
  app.use(express.json());
  
  console.log('🤖 Starting HTTP MCP Server test...');
  
  try {
    // Create new MCP server instance
    const mcpServer = new NewMCPServer();
    
    // Setup HTTP transport on the Express app
    await mcpServer.setupHTTP(app, '/mcp');
    
    // Start the server
    app.listen(PORT, () => {
      console.log(`✅ HTTP MCP Server running at http://localhost:${PORT}/mcp`);
      console.log('📋 Available tools:');
      console.log('   - greeting: Generate friendly greetings');
      console.log('   - echo: Echo messages with transformations');
      console.log('');
      console.log('🧪 Test with curl:');
      console.log(`curl -X POST http://localhost:${PORT}/mcp \\`);
      console.log(`  -H "Content-Type: application/json" \\`);
      console.log(`  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'`);
    });
    
  } catch (error) {
    console.error('❌ Failed to start HTTP MCP server:', error);
    process.exit(1);
  }
}

startServer().catch(console.error);