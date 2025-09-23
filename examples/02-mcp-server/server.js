#!/usr/bin/env node

/**
 * Comprehensive MCP Server Example
 *
 * Full-featured server demonstrating:
 * - Modular architecture with organized subfolders
 * - Custom tRPC routers with MCP tool integration
 * - Resource registry with secure file access
 * - AI-powered sampling and elicitation
 * - Development panel integration
 * - OAuth2, token tracking, and production features
 */

import { createRpcAiServer, PostgreSQLAdapter } from 'simple-rpc-ai-backend';
import dotenv from 'dotenv';

// Import modular components
import { getCustomRouters } from './methods/index.js';
import { setupAllResources } from './resources/index.js';
import { setupPrompts } from './prompts/index.js';

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
    console.log('🚀 Starting Comprehensive MCP Server...');

    // Setup modular components
    console.log('📦 Setting up modular components...');

    // Setup resources (file reader, custom resources)
    setupAllResources();

    // Setup prompt templates
    const promptConfig = setupPrompts();
    console.log(`📝 Configured ${promptConfig.count} prompt templates`);

    // Get custom routers
    const customRouters = getCustomRouters();
    console.log(`🛠️ Loaded ${Object.keys(customRouters).length} custom router modules`);

    // ========================================================================
    // Database Setup (Optional)
    // ========================================================================

    let postgresAdapter;
    if (process.env.POSTGRES_SECRET_PASS) {
      try {
        console.log('🔗 Setting up PostgreSQL connection...');
        postgresAdapter = new PostgreSQLAdapter({
          host: process.env.SECRET_MANAGER_DB_HOST || 'localhost',
          port: parseInt(process.env.SECRET_MANAGER_DB_PORT) || 5432,
          database: process.env.SECRET_MANAGER_DB_NAME || 'secrets',
          user: process.env.SECRET_MANAGER_DB_USER || 'secret_manager',
          password: process.env.POSTGRES_SECRET_PASS,
          ssl: process.env.NODE_ENV === 'production'
        });
        await postgresAdapter.connect();
        console.log('✅ PostgreSQL connected successfully');
      } catch (error) {
        console.warn('⚠️ PostgreSQL connection failed:', error.message);
        postgresAdapter = null;
      }
    }

    // ========================================================================
    // Server Configuration
    // ========================================================================

    const serverConfig = {
      // Authentication Configuration
      auth: {
        enabled: false, // Set to true for production
        oauth: {
          sessionStorePath: './logs/oauth-sessions.json'
        }
      },

      // AI Provider Configuration
      ai: {
        systemPrompt: 'You are a helpful AI assistant with access to mathematical calculations, utility functions, and secure file operations.',
        providers: {
          anthropic: {
            enabled: !!process.env.ANTHROPIC_API_KEY,
            apiKey: process.env.ANTHROPIC_API_KEY,
            models: ['claude-3-5-sonnet-20241022']
          },
          openai: {
            enabled: !!process.env.OPENAI_API_KEY,
            apiKey: process.env.OPENAI_API_KEY,
            models: ['gpt-4o']
          },
          google: {
            enabled: !!process.env.GOOGLE_API_KEY,
            apiKey: process.env.GOOGLE_API_KEY,
            models: ['gemini-2.0-flash-exp']
          }
        }
      },

      // MCP Configuration with all capabilities
      mcp: {
        enableMCP: true,
        auth: {
          requireAuthForToolsList: false,
          requireAuthForToolsCall: false,
          publicTools: ['add', 'multiply', 'calculate', 'greeting', 'status', 'readFile', 'listFiles', 'getFileInfo']
        },
        extensions: {
          prompts: {
            includeDefaults: true
          },
          resources: {
            includeDefaults: true
          }
        }
      },

      // Server Workspace Configuration (for server-managed file access)
      // Note: This is separate from MCP client roots (which are client-managed)
      serverWorkspaces: {
        exampleDocs: {
          path: './docs',
          name: 'Example Documentation',
          description: 'Server-managed documentation folder',
          readOnly: true,
          allowedExtensions: ['.md', '.txt', '.json']
        },
        tempWork: {
          path: './temp',
          name: 'Temporary Workspace',
          description: 'Server workspace for temporary files',
          readOnly: false
        }
      },

      // Custom Routers - Use our modular components
      customRouters,

      // Database Configuration
      ...(postgresAdapter && {
        database: {
          adapter: postgresAdapter
        }
      }),

      // Protocol Configuration
      protocols: {
        tRpc: true,
        jsonRpc: true
      },

      // Server Configuration
      port: process.env.PORT || 8001,
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
🎉 Comprehensive MCP Server Started Successfully!
================================================================

📍 Server Endpoints:
   - Main Server:  http://localhost:${port}${devPanelUrl}
   - tRPC API:     http://localhost:${port}/trpc
   - MCP Protocol: http://localhost:${port}/mcp
   - JSON-RPC:     http://localhost:${port}/rpc
   - Health Check: http://localhost:${port}/health

🛠️ Available MCP Tools:
   Math Tools:     add, multiply, calculate
   Utility Tools:  greeting, status
   File Tools:     file-reader, root-folders, directory-listing

📁 Configured Resources:
   - Secure file access with rootManager
   - Package information resource
   - Built-in resource templates

📝 Prompt Templates: ${promptConfig.count} templates in ${promptConfig.categories.length} categories

🧪 Test Commands:

   1. List MCP tools:
      curl -X POST http://localhost:${port}/mcp \\
        -H "Content-Type: application/json" \\
        -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'

   2. Test math addition:
      curl -X POST http://localhost:${port}/mcp \\
        -H "Content-Type: application/json" \\
        -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"add","arguments":{"a":5,"b":3}}}'

   3. Get server status:
      curl -X POST http://localhost:${port}/mcp \\
        -H "Content-Type: application/json" \\
        -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"status","arguments":{"mode":"detailed"}}}'

   4. List available resources:
      curl -X POST http://localhost:${port}/mcp \\
        -H "Content-Type: application/json" \\
        -d '{"jsonrpc":"2.0","id":4,"method":"resources/list"}'

   5. Check root folders (if configured):
      curl -X POST http://localhost:${port}/mcp \\
        -H "Content-Type: application/json" \\
        -d '{"jsonrpc":"2.0","id":5,"method":"roots/list"}'

🔍 Development Tools:
   ${process.env.NODE_ENV !== 'production' ? '• Dev Panel: http://localhost:8080' : ''}
   • MCP Inspector: npx @modelcontextprotocol/inspector
     Connect to: http://localhost:${port}/mcp

Environment: ${process.env.NODE_ENV || 'development'}
Modular Architecture: ✅ Resources, Methods, Prompts organized in subfolders
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