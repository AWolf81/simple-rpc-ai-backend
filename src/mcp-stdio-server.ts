#!/usr/bin/env node

/**
 * Standalone MCP STDIO Server
 * 
 * This is the entry point for Claude Desktop integration.
 * Connects via STDIO (stdin/stdout) and provides all tRPC tools as MCP tools.
 */

import { startStdioServer } from './mcp-server';

// Handle process termination gracefully
process.on('SIGINT', () => {
  console.log('\n🛑 Received SIGINT, shutting down MCP STDIO server...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Received SIGTERM, shutting down MCP STDIO server...');
  process.exit(0);
});

process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught exception in MCP STDIO server:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled rejection in MCP STDIO server:', reason, 'at', promise);
  process.exit(1);
});

// Start the STDIO server
startStdioServer().catch((error) => {
  console.error('💥 Failed to start MCP STDIO server:', error);
  process.exit(1);
});