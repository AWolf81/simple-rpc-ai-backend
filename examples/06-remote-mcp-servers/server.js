#!/usr/bin/env node
/**
 * Example: Remote MCP Servers
 *
 * Demonstrates how to connect to and use remote MCP servers
 * - uvx (Python packages)
 * - npx (Node.js packages)
 * - docker (Containerized servers)
 * - HTTP/HTTPS (Remote web servers)
 */

import { createRpcAiServer } from '../../dist/index.js';
import { createRemoteMCPManager } from '../../dist/mcp/remote-mcp-manager.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load remote MCP server configuration
const configPath = path.join(__dirname, 'remote-mcp-config.json');
let remoteMCPConfig = {
  remoteMCPServers: {
    // Example: Python MCP server via uvx
    'time-server': {
      name: 'time-server',
      transport: 'uvx',
      command: 'mcp-server-time',
      args: [],
      autoStart: true
    }
  }
};

// Try to load config file if it exists
if (fs.existsSync(configPath)) {
  try {
    remoteMCPConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    console.log('📋 Loaded remote MCP configuration from', configPath);
  } catch (error) {
    console.warn('⚠️  Failed to load remote MCP config, using defaults');
  }
} else {
  console.log('💡 No remote-mcp-config.json found, using example configuration');
  console.log('   Copy remote-mcp-config.example.json to remote-mcp-config.json to customize');
}

// Create remote MCP manager
const remoteMCPManager = createRemoteMCPManager({
  servers: Object.values(remoteMCPConfig.remoteMCPServers),
  autoConnect: true,
  retryOnFailure: true,
  retryDelay: 5000,
  maxRetries: 3
});

// Setup event handlers
remoteMCPManager.on('serverConnected', (name) => {
  console.log(`✅ Remote MCP server connected: ${name}`);
});

remoteMCPManager.on('serverDisconnected', ({ name, code }) => {
  console.log(`❌ Remote MCP server disconnected: ${name} (code: ${code})`);
});

remoteMCPManager.on('serverError', ({ server, error }) => {
  console.error(`⚠️  Remote MCP server error [${server}]:`, error);
});

// Initialize remote servers
console.log('🔄 Connecting to remote MCP servers...');
await remoteMCPManager.initialize();

// Get status after initialization
const serverStatus = remoteMCPManager.getServerStatus();
console.log('\n📊 Remote MCP Server Status:');
for (const status of serverStatus) {
  const emoji = status.connected ? '✅' : '❌';
  console.log(`   ${emoji} ${status.name} (${status.transport})`);
  if (status.lastError) {
    console.log(`      Error: ${status.lastError}`);
  }
  if (status.tools) {
    console.log(`      Tools: ${status.tools.length} available`);
  }
}

// Create the main AI server
const server = createRpcAiServer({
  port: 8001,

  providers: ['anthropic'],

  mcp: {
    enabled: true,
    ai: {
      enabled: true,
      useServerConfig: true
    }
  },

  // Add remote MCP manager to server context
  context: {
    remoteMCPManager
  }
});

// Start the server
await server.start();

console.log('\n🚀 Server with Remote MCP integration started');
console.log('📡 Local MCP endpoint: http://localhost:8001/mcp');
console.log('');
console.log('💡 Available remote MCP servers:');
const connectedServers = remoteMCPManager.getConnectedServers();
if (connectedServers.length > 0) {
  connectedServers.forEach(name => {
    console.log(`   - ${name}`);
  });
} else {
  console.log('   (none connected)');
}

console.log('');
console.log('🔧 To test remote MCP tools:');
console.log('   1. List all tools: GET http://localhost:8001/mcp (method: tools/list)');
console.log('   2. Call a tool: POST http://localhost:8001/mcp (method: tools/call)');
console.log('');
console.log('📊 Start dev panel: pnpm dev:panel --server-port 8001');

// Example: Periodically refresh tools from remote servers
setInterval(async () => {
  try {
    const toolsByServer = await remoteMCPManager.listAllTools();
    let totalTools = 0;
    for (const tools of toolsByServer.values()) {
      totalTools += tools.length;
    }
    if (totalTools > 0) {
      console.log(`🔄 Remote MCP tools refreshed: ${totalTools} tools from ${toolsByServer.size} servers`);
    }
  } catch (error) {
    // Silently ignore refresh errors
  }
}, 60000); // Every minute

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down...');
  await remoteMCPManager.shutdown();
  await server.stop();
  process.exit(0);
});
