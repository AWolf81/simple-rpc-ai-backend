/**
 * MCP Transport Examples
 * 
 * Shows how to configure different MCP transports:
 * - HTTP (for MCP Jam, testing)
 * - SSE (for web clients) 
 * - STDIO (for Claude Desktop)
 */

import { createRpcAiServer } from '../dist/index.js';

// Example 1: HTTP only (default - for MCP Jam)
console.log('🌐 Example 1: HTTP Transport (MCP Jam, testing)');
const httpServer = createRpcAiServer({
  port: 8001,
  mcp: {
    enableMCP: true,
    transports: {
      http: true,    // Default
      stdio: false,  // Disabled
      sse: false     // Disabled
    }
  }
});

// Example 2: SSE + HTTP (for web clients + testing)
console.log('📡 Example 2: HTTP + SSE Transport (web clients)');
const sseServer = createRpcAiServer({
  port: 8002, 
  mcp: {
    enableMCP: true,
    transports: {
      http: true,         // For testing
      sse: true,          // For web clients
      sseEndpoint: '/sse' // SSE endpoint
    }
  }
});

// Example 3: All transports (development setup)
console.log('🚀 Example 3: All Transports (development)');
const allTransportsServer = createRpcAiServer({
  port: 8003,
  mcp: {
    enableMCP: true,
    transports: {
      http: true,         // HTTP for MCP Jam
      sse: true,          // SSE for web clients  
      stdio: true,        // STDIO for Claude Desktop (standalone)
      sseEndpoint: '/sse'
    }
  }
});

// Start servers
async function startServers() {
  console.log('\n🚀 Starting MCP transport examples...\n');
  
  // HTTP only server
  await httpServer.start();
  console.log('✅ HTTP-only server started on port 8001');
  console.log('   Test with: curl -X POST http://localhost:8001/mcp -d \'{"jsonrpc":"2.0","id":1,"method":"tools/list"}\'\n');
  
  // SSE server
  await sseServer.start();
  console.log('✅ HTTP+SSE server started on port 8002');
  console.log('   HTTP: http://localhost:8002/mcp');
  console.log('   SSE:  http://localhost:8002/sse\n');
  
  // All transports server
  await allTransportsServer.start();
  console.log('✅ All-transports server started on port 8003');
  console.log('   HTTP: http://localhost:8003/mcp');
  console.log('   SSE:  http://localhost:8003/sse');
  console.log('   STDIO: node dist/mcp-stdio-server.js');
  console.log('\n📋 Available MCP tools: hello, echo, status, calculate, longRunningTask, cancelTask, listRunningTasks, getTaskProgress');
  
  console.log('\n🎯 Usage:');
  console.log('• MCP Jam: Use HTTP endpoints');
  console.log('• Web clients: Use SSE endpoints'); 
  console.log('• Claude Desktop: Use STDIO server (separate process)');
}

startServers().catch(console.error);