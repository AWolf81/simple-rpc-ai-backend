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
import path from 'path';

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
          publicTools: ['add', 'multiply', 'calculate', 'greeting', 'status', 'readFile', 'listFiles', 'getFileInfo', 'getPrompts', 'getPromptTemplate', 'explainConcept']
        },
        extensions: {
          // Legacy prompt system removed - use tRPC-based MCP prompts instead
          // See: src/trpc/routers/mcp/methods/prompt.ts (mcpPromptProcedures)
          prompts: {},
          resources: {
            customResources: [
              {
                uri: "file://project-guidelines",
                name: "project-guidelines",
                description: "Development guidelines and coding standards for this project",
                mimeType: "text/markdown"
              },
              {
                uri: "file://security-guidelines",
                name: "security-guidelines",
                description: "Security best practices and guidelines",
                mimeType: "text/markdown"
              },
              {
                uri: "file://api-schemas",
                name: "api-schemas",
                description: "API schema definitions and examples",
                mimeType: "application/json"
              }
            ],
            customHandlers: {
              "project-guidelines": async (context) => {
                return {
                  content: `# Project Development Guidelines

## Code Style
- Use TypeScript for all new code
- Follow ESLint configuration
- Use meaningful variable names
- Add JSDoc comments for public APIs

## Architecture
- Use tRPC for type-safe APIs
- Implement proper error handling
- Follow the existing folder structure
- Use dependency injection where appropriate

## Testing
- Write unit tests for business logic
- Use integration tests for API endpoints
- Maintain >80% code coverage
- Test error conditions

## Security
- Validate all inputs
- Use parameterized queries
- Implement proper authentication
- Follow principle of least privilege

Generated at: ${new Date().toISOString()}`,
                  mimeType: "text/markdown"
                };
              },
              "security-guidelines": async (context) => {
                return {
                  content: `# Security Guidelines

## Input Validation
- Validate all user inputs
- Use Zod schemas for validation
- Sanitize HTML content
- Prevent SQL injection

## Authentication & Authorization
- Use JWT tokens
- Implement proper session management
- Follow OAuth 2.0 best practices
- Use role-based access control

## Data Protection
- Encrypt sensitive data at rest
- Use HTTPS for all communications
- Implement proper key management
- Follow GDPR requirements

## API Security
- Rate limiting
- CORS configuration
- Input sanitization
- Error message security

Generated at: ${new Date().toISOString()}`,
                  mimeType: "text/markdown"
                };
              },
              "api-schemas": async (context) => {
                return {
                  content: JSON.stringify({
                    "user": {
                      "type": "object",
                      "properties": {
                        "id": { "type": "string", "format": "uuid" },
                        "email": { "type": "string", "format": "email" },
                        "name": { "type": "string", "minLength": 1 },
                        "created": { "type": "string", "format": "date-time" }
                      },
                      "required": ["id", "email", "name"]
                    },
                    "project": {
                      "type": "object",
                      "properties": {
                        "id": { "type": "string", "format": "uuid" },
                        "name": { "type": "string", "minLength": 1 },
                        "description": { "type": "string" },
                        "owner": { "$ref": "#/definitions/user" },
                        "status": {
                          "type": "string",
                          "enum": ["active", "inactive", "archived"]
                        }
                      },
                      "required": ["id", "name", "owner", "status"]
                    },
                    "generated_at": new Date().toISOString()
                  }, null, 2),
                  mimeType: "application/json"
                };
              }
            },
            customTemplates: [
              {
                name: "company-handbook",
                description: "Company handbook with department-specific sections",
                uriTemplate: "mcp://internal/company-handbook{?department,version,format}",
                arguments: [
                  {
                    name: "department",
                    description: "Department-specific handbook section",
                    required: false
                  },
                  {
                    name: "version",
                    description: "Handbook version to retrieve",
                    required: false
                  },
                  {
                    name: "format",
                    description: "Output format for the handbook content",
                    required: false
                  }
                ],
                mimeType: "text/markdown"
              }
            ],
            templateHandlers: {
              "company-handbook": async (args) => {
                const department = args.department || 'general';
                const version = args.version || 'latest';
                const format = args.format || 'md';

                const content = `# Company Handbook - ${department.charAt(0).toUpperCase() + department.slice(1)} Department

## Welcome to ${department}!

### Our Mission
Building excellent software with security and performance in mind.

### Department Guidelines
- Follow the project development guidelines
- Participate in code reviews
- Maintain high test coverage
- Document your work

### Resources
- Project Guidelines: Use the project-guidelines resource
- Security Guidelines: Use the security-guidelines resource
- API Schemas: Use the api-schemas resource

### Contact
- Department Lead: ${department}@company.com
- Support: support@company.com

---
Version: ${version}
Generated: ${new Date().toISOString()}
Format: ${format}`;

                return {
                  content: format === 'xml'
                    ? `<?xml version="1.0"?><handbook><content>${content}</content></handbook>`
                    : content,
                  mimeType: format === 'xml' ? 'application/xml' : 'text/markdown'
                };
              }
            }
          }
        }
      },

      // Server Workspace Configuration (for server-managed file access)
      // Note: This is separate from MCP client roots (which are client-managed)
      serverWorkspaces: {
        projectRoot: {
          path: path.resolve(import.meta.dirname, '../..'),  // Resolve relative to this file's directory
          name: 'Project Root',
          description: 'Main project directory with package.json and core files',
          readOnly: true,
          allowedExtensions: ['json', 'md', 'txt', 'js', 'ts']  // Extensions without dots
        },
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
        origin: process.env.CORS_ORIGIN || [
          'http://localhost:3000',           // Local development
          'http://localhost:8080',           // Dev panel
          'http://localhost:4000',           // MCP Jam Inspector
          'https://playground.open-rpc.org', // OpenRPC Playground
          'https://inspector.open-rpc.org'   // OpenRPC Inspector
        ],
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
   • Main Server:  http://localhost:${port}${devPanelUrl}
   • tRPC API:     http://localhost:${port}/trpc
   • MCP Protocol: http://localhost:${port}/mcp
   • JSON-RPC:     http://localhost:${port}/rpc
   • Health Check: http://localhost:${port}/health

🛠️ Available MCP Tools:
   Math:    add, multiply, calculate
   Utility: greeting, status
   File:    file-reader, root-folders, directory-listing

📁 Configured Resources:
   - Secure file access with rootManager
   - Package information resource
   - Built-in resource templates

📝 Prompt Templates: ${promptConfig.count} in ${promptConfig.categories.length} categories

🔍 Development Tools:
   ${process.env.NODE_ENV !== 'production' ? '• Dev Panel: http://localhost:8080\n   ' : ''}• MCP Inspector: npx @modelcontextprotocol/inspector (connect to http://localhost:${port}/mcp)

Environment: ${process.env.NODE_ENV || 'development'}
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
