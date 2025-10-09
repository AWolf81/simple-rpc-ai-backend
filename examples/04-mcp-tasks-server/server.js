#!/usr/bin/env node

/**
 * Task Management MCP Server Example
 *
 * Specialized server demonstrating:
 * - Task lifecycle management (create, cancel, progress tracking)
 * - Long-running task simulation with progress updates
 * - Task status monitoring and history
 * - Administrative tools and status monitoring
 * - Production-ready error handling and graceful shutdown
 */

import { createRpcAiServer } from 'simple-rpc-ai-backend';
import dotenv from 'dotenv';
import { getTaskRouters } from './methods/index.js';

// Load environment variables
dotenv.config();

// ============================================================================
// Server Configuration and Startup
// ============================================================================

// Graceful shutdown handling
async function gracefulShutdown(signal) {
  console.log(`📭 Received ${signal}, shutting down gracefully...`);
  try {
    if (global.serverInstance) {
      await global.serverInstance.stop();
      global.serverInstance = null;
    }
    process.exit(0);
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
}

async function startServer() {
  try {
    console.log('🚀 Starting Task Management MCP Server...');

    // Get task management routers
    const taskRouters = getTaskRouters();
    console.log(`🛠️ Loaded ${Object.keys(taskRouters).length} task router modules`);

    // ========================================================================
    // Server Configuration
    // ========================================================================

    const serverConfig = {
      // Authentication Configuration (disabled for demo)
      auth: {
        enabled: false
      },

      // AI Provider Configuration (minimal for task management)
      serverProviders: ['anthropic'],
      systemPrompts: {
        default: 'You are a task management assistant helping with task scheduling, monitoring, and lifecycle management.'
      },

      // MCP Configuration - Focus on task management tools
      mcp: {
        enabled: true,
        auth: {
          requireAuthForToolsList: false,
          requireAuthForToolsCall: false,
          publicTools: [
            'longRunningTask', 'cancellableTask', 'cancelTask',
            'listRunningTasks', 'getTaskProgress', 'status',
            'advancedExample', 'getUserInfo'
          ]
        }
      },

      // Custom Routers - Task management focused
      customRouters: taskRouters,

      // Protocol Configuration
      protocols: {
        tRpc: true,
        jsonRpc: true
      },

      // Server Configuration
      port: process.env.PORT || 8002,
      cors: {
        origin: ['http://localhost:3000', 'http://localhost:8080', 'http://localhost:4000'],
        credentials: true
      },

      // Monitoring
      monitoring: {
        logging: {
          level: process.env.LOG_LEVEL || 'info',
          format: 'pretty'
        }
      }
    };

    // ========================================================================
    // Server Creation and Startup
    // ========================================================================

    console.log('🏗️ Creating server instance...');

    // Create and start server
    console.log('⚡ Creating and starting server...');
    const server = createRpcAiServer(serverConfig);
    await server.start();
    global.serverInstance = server;

    // ========================================================================
    // Success Message and Usage Information
    // ========================================================================

    const port = serverConfig.port;
    const devPanelUrl = process.env.NODE_ENV !== 'production' ? ' (Dev Panel: http://localhost:8080)' : '';

    console.log(`
🎉 Task Management MCP Server Started Successfully!
================================================================

📍 Server Endpoints:
   - Main Server:  http://localhost:${port}${devPanelUrl}
   - tRPC API:     http://localhost:${port}/trpc
   - MCP Protocol: http://localhost:${port}/mcp
   - JSON-RPC:     http://localhost:${port}/rpc
   - Health Check: http://localhost:${port}/health

🛠️ Available Task Management Tools:
   Task Tools:     longRunningTask, cancellableTask, cancelTask
   Monitoring:     listRunningTasks, getTaskProgress
   Admin Tools:    status, advancedExample, getUserInfo

🧪 Test Commands:

   1. List MCP tools:
      curl -X POST http://localhost:${port}/mcp \\
        -H "Content-Type: application/json" \\
        -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'

   2. Start a long-running task:
      curl -X POST http://localhost:${port}/mcp \\
        -H "Content-Type: application/json" \\
        -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"longRunningTask","arguments":{"name":"Test Task","duration":15000}}}'

   3. Check task progress:
      curl -X POST http://localhost:${port}/mcp \\
        -H "Content-Type: application/json" \\
        -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"getTaskProgress","arguments":{"taskId":"TASK_ID_FROM_STEP_2"}}}'

   4. List all running tasks:
      curl -X POST http://localhost:${port}/mcp \\
        -H "Content-Type: application/json" \\
        -d '{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"listRunningTasks","arguments":{"includeCompleted":true}}}'

   5. Cancel a task:
      curl -X POST http://localhost:${port}/mcp \\
        -H "Content-Type: application/json" \\
        -d '{"jsonrpc":"2.0","id":5,"method":"tools/call","params":{"name":"cancelTask","arguments":{"taskId":"TASK_ID_TO_CANCEL"}}}'

🔍 Development Tools:
   ${process.env.NODE_ENV !== 'production' ? '• Dev Panel: http://localhost:8080' : ''}
   • MCP Inspector: npx @modelcontextprotocol/inspector
     Connect to: http://localhost:${port}/mcp

Environment: ${process.env.NODE_ENV || 'development'}
Focus: Task Management & Administrative Tools
`);

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    if (error.stack) {
      console.error('Stack trace:', error.stack);
    }
    process.exit(1);
  }
}

// ============================================================================
// Process Handlers and Startup
// ============================================================================

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGUSR2', () => gracefulShutdown('SIGUSR2'));

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('UNHANDLED_REJECTION');
});

// Start the server
startServer();