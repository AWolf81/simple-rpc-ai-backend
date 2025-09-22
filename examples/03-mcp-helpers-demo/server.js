/**
 * MCP Server with Helper Functions Demo
 *
 * This example demonstrates the new MCP helper functions for simplified configuration.
 * It shows:
 * 1. Easy resource and prompt registration
 * 2. Global reusable handlers
 * 3. Sampling and elicitation (future MCP protocol features)
 * 4. Clean configuration separation
 */

import { createRpcAiServer } from 'simple-rpc-ai-backend';
import { createMCPConfig, registerGlobalHandler } from '../../dist/mcp/mcp-helpers.js';

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
    // Clean up any previous instances
    if (global.serverInstance) {
      try {
        await global.serverInstance.stop();
        global.serverInstance = null;
      } catch (error) {
        console.log('⚠️  Previous server already stopped');
      }
    }

    await new Promise(resolve => setTimeout(resolve, 100));

    // Register custom global handlers for reuse
    registerGlobalHandler('project-status', async (args) => {
      const { projectId } = args;

      // Simulate fetching project status from an API or database
      const statuses = {
        'web-app': { status: 'active', progress: 85, lastDeploy: '2025-01-20' },
        'mobile-app': { status: 'testing', progress: 60, lastDeploy: '2025-01-15' },
        'api-service': { status: 'maintenance', progress: 95, lastDeploy: '2025-01-19' }
      };

      return statuses[projectId] || {
        status: 'unknown',
        progress: 0,
        lastDeploy: 'never',
        error: `Project ${projectId} not found`
      };
    });

    registerGlobalHandler('log-analyzer', async (args) => {
      const { logLevel = 'error', maxLines = 100 } = args;

      // Simulate log analysis
      const logs = [];
      for (let i = 0; i < Math.min(maxLines, 50); i++) {
        logs.push({
          timestamp: new Date(Date.now() - i * 60000).toISOString(),
          level: logLevel,
          message: `Sample ${logLevel} message ${i + 1}`,
          source: 'application'
        });
      }

      return {
        level: logLevel,
        count: logs.length,
        maxLines,
        logs: logs,
        summary: `Found ${logs.length} ${logLevel} entries in the last ${logs.length} minutes`
      };
    });

    // Create MCP configuration using helper functions
    const mcpConfig = createMCPConfig()
      // Add static resources with handlers
      .addResource(
        'file://deployment-status.json',
        'Deployment Status',
        'Current deployment status across all environments',
        () => ({
          environments: {
            development: { status: 'healthy', version: '1.2.3-dev', uptime: '2 days' },
            staging: { status: 'deploying', version: '1.2.2', uptime: '5 hours' },
            production: { status: 'healthy', version: '1.2.1', uptime: '14 days' }
          },
          lastUpdate: new Date().toISOString()
        })
      )
      // Add resource templates with global handlers
      .addResourceTemplate({
        name: 'project-status',
        description: 'Get real-time status of any project',
        uriTemplate: 'project://status/{projectId}',
        arguments: [
          { name: 'projectId', description: 'Project identifier', required: true }
        ],
        mimeType: 'application/json',
        handler: async (args) => {
          const { projectId } = args;
          const statuses = {
            'web-app': { status: 'active', progress: 85, lastDeploy: '2025-01-20' },
            'mobile-app': { status: 'testing', progress: 60, lastDeploy: '2025-01-15' },
            'api-service': { status: 'maintenance', progress: 95, lastDeploy: '2025-01-19' }
          };
          return statuses[projectId] || {
            status: 'unknown', progress: 0, lastDeploy: 'never',
            error: `Project ${projectId} not found`
          };
        }
      })
      .addResourceTemplate({
        name: 'log-analysis',
        description: 'Analyze application logs with filtering',
        uriTemplate: 'logs://analyze/{logLevel}',
        arguments: [
          { name: 'logLevel', description: 'Log level to analyze (error, warn, info)', required: true },
          { name: 'maxLines', description: 'Maximum lines to analyze', required: false }
        ],
        mimeType: 'application/json',
        handler: async (args) => {
          const { logLevel = 'error', maxLines = 100 } = args;
          const logs = [];
          for (let i = 0; i < Math.min(maxLines, 50); i++) {
            logs.push({
              timestamp: new Date(Date.now() - i * 60000).toISOString(),
              level: logLevel,
              message: `Sample ${logLevel} message ${i + 1}`,
              source: 'application'
            });
          }
          return {
            level: logLevel, count: logs.length, maxLines,
            logs: logs,
            summary: `Found ${logs.length} ${logLevel} entries in the last ${logs.length} minutes`
          };
        }
      })
      // Use the built-in file-reader global handler
      .addResourceTemplate({
        name: 'file-reader',
        description: 'Read local files securely',
        uriTemplate: 'file://read/{filePath}',
        arguments: [
          { name: 'filePath', description: 'Path to file (relative to server directory)', required: true },
          { name: 'encoding', description: 'File encoding (default: utf8)', required: false }
        ],
        mimeType: 'application/json',
        handler: async (args) => {
          const { filePath, encoding = 'utf8' } = args;
          const { promises: fs } = await import('fs');
          const path = await import('path');
          try {
            const currentDir = process.cwd();
            const safePath = path.resolve(currentDir, filePath);
            if (!safePath.startsWith(currentDir)) {
              throw new Error('Access denied: Path outside of allowed directory');
            }
            await fs.access(safePath);
            const content = await fs.readFile(safePath, encoding);
            const stats = await fs.stat(safePath);
            return {
              filePath: safePath, size: content.length, encoding,
              content, lastModified: stats.mtime.toISOString()
            };
          } catch (error) {
            return { error: `Failed to read file: ${error.message}`, filePath, encoding };
          }
        }
      })
      // Add prompts
      .addPrompt(
        'code-review',
        'AI-powered code review with security focus',
        {
          messages: [
            {
              role: 'system',
              content: {
                type: 'text',
                text: 'You are a senior software engineer conducting a thorough code review. Focus on {{focus_area}} and provide specific, actionable feedback.'
              }
            },
            {
              role: 'user',
              content: {
                type: 'text',
                text: 'Please review this {{language}} code: {{code}}. Pay special attention to {{focus_area}}.'
              }
            }
          ]
        },
        [
          { name: 'code', description: 'Code to review', required: true },
          { name: 'language', description: 'Programming language', required: true },
          { name: 'focus_area', description: 'Focus area (security, performance, etc.)', required: false }
        ]
      )
      .addPrompt(
        'incident-response',
        'Guide incident response procedures',
        {
          messages: [
            {
              role: 'system',
              content: {
                type: 'text',
                text: 'You are an incident response coordinator. Help prioritize and coordinate response to {{severity}} incidents.'
              }
            },
            {
              role: 'user',
              content: {
                type: 'text',
                text: 'We have a {{severity}} incident: {{description}}. Current status: {{status}}. What should we do next?'
              }
            }
          ]
        },
        [
          { name: 'description', description: 'Incident description', required: true },
          { name: 'severity', description: 'Incident severity (critical, high, medium, low)', required: true },
          { name: 'status', description: 'Current incident status', required: false }
        ]
      )
      .build();

    // Create and start the server
    const server = createRpcAiServer({
      // Simple auth config
      auth: {
        enabled: false, // Disable for demo purposes
        github: {
          clientId: process.env.GITHUB_CLIENT_ID,
          clientSecret: process.env.GITHUB_CLIENT_SECRET,
          redirectUri: process.env.GITHUB_REDIRECT_URI || 'http://localhost:8002/auth/callback/github'
        },
        google: {
          clientId: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          redirectUri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:8002/auth/callback/google'
        },
        jwt: {
          secret: process.env.JWT_SECRET || 'demo-secret-change-in-production',
          expiresIn: '7d'
        }
      },

      // AI Provider Configuration
      ai: {
        systemPrompt: 'You are a helpful AI assistant for development operations.',
        providers: {
          anthropic: {
            enabled: !!process.env.ANTHROPIC_API_KEY,
            apiKey: process.env.ANTHROPIC_API_KEY,
            models: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022']
          },
          openai: {
            enabled: !!process.env.OPENAI_API_KEY,
            apiKey: process.env.OPENAI_API_KEY,
            models: ['gpt-4o', 'gpt-4o-mini']
          },
          google: {
            enabled: !!process.env.GOOGLE_API_KEY,
            apiKey: process.env.GOOGLE_API_KEY,
            models: ['gemini-2.0-flash-exp', 'gemini-1.5-pro']
          }
        },
        rateLimits: {
          free: { rpm: 10, tpm: 1000 },
          pro: { rpm: 100, tpm: 10000 },
          enterprise: { rpm: 1000, tpm: 100000 }
        }
      },

      // Token Tracking Configuration (disabled for demo)
      tokenTracking: {
        enabled: false
      },

      // MCP Configuration using our helper
      mcp: {
        enableMCP: true,
        auth: {
          requireAuthForToolsList: false,
          requireAuthForToolsCall: false, // Disable for demo
          publicTools: ['greeting', 'currentSystemTime', 'generateWithApproval', 'requestElicitation']
        },
        extensions: mcpConfig
      },

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

      // Monitoring Configuration
      monitoring: {
        metrics: {
          enabled: true,
          endpoint: '/metrics'
        },
        logging: {
          level: process.env.LOG_LEVEL || 'info',
          format: process.env.NODE_ENV === 'production' ? 'json' : 'pretty'
        }
      }
    });

    await server.start();
    global.serverInstance = server;

    console.log(`
🚀 MCP Helper Functions Demo Server Started!
=====================================

📍 Endpoints:
   - tRPC:      http://localhost:8002/trpc
   - MCP:       http://localhost:8002/mcp
   - JSON-RPC:  http://localhost:8002/rpc
   - Health:    http://localhost:8002/health
   - Metrics:   http://localhost:8002/metrics

🎯 Demo Features:
   - ✅ Simplified MCP configuration
   - ✅ Global reusable handlers
   - ✅ Resource templates with pattern matching
   - ✅ Built-in file reading capabilities
   - ✅ Sampling/Elicitation framework (ready for MCP protocol)

🧪 Try These Examples:

   1. Resource Templates:
      • project://status/web-app
      • logs://analyze/error
      • file://read/package.json

   2. Static Resources:
      • file://deployment-status.json

   3. MCP Inspector:
      • Open: http://localhost:4000
      • Connect to: http://localhost:8002/mcp

Environment: ${process.env.NODE_ENV || 'development'}
`);

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Handle all shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGUSR2', () => gracefulShutdown('SIGUSR2')); // tsx watch reload signal

// Start the server
startServer();