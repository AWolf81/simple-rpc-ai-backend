#!/usr/bin/env node

/**
 * Comprehensive MCP Server Example
 *
 * Full-featured server demonstrating:
 * - Custom tRPC routers with MCP tool integration
 * - AI-powered sampling and elicitation
 * - Development panel integration
 * - OAuth2, token tracking, and production features
 * - Extensive MCP extensions (prompts, resources, custom tools)
 */

import { createRpcAiServer, router, publicProcedure, createServerWithDevPanel } from 'simple-rpc-ai-backend';
import { PostgreSQLAdapter } from 'simple-rpc-ai-backend';
import { z } from 'zod';
import { createMCPTool } from 'simple-rpc-ai-backend/dist/auth/scopes.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// ============================================================================
// Custom tRPC Routers with MCP Tool Integration
// ============================================================================

// Custom Math Tools Router - All procedures become MCP tools automatically
const customMathRouter = router({
  add: publicProcedure
    .meta({
      ...createMCPTool({
        name: 'add',
        description: 'Add two numbers together',
        category: 'math',
        public: true // Make available without authentication
      })
    })
    .input(z.object({
      a: z.number().describe('First number'),
      b: z.number().describe('Second number')
    }))
    .query(({ input }) => ({
      result: input.a + input.b,
      operation: `${input.a} + ${input.b} = ${input.a + input.b}`
    })),

  multiply: publicProcedure
    .meta({
      ...createMCPTool({
        name: 'multiply',
        description: 'Multiply two numbers',
        category: 'math',
        public: true
      })
    })
    .input(z.object({
      a: z.number().describe('First number'),
      b: z.number().describe('Second number')
    }))
    .query(({ input }) => ({
      result: input.a * input.b,
      operation: `${input.a} × ${input.b} = ${input.a * input.b}`
    })),

  fibonacci: publicProcedure
    .meta({
      ...createMCPTool({
        name: 'fibonacci',
        description: 'Calculate Fibonacci sequence up to n terms',
        category: 'math',
        public: true
      })
    })
    .input(z.object({
      n: z.number().int().min(1).max(20).describe('Number of Fibonacci terms to generate')
    }))
    .query(({ input }) => {
      const sequence = [0, 1];
      for (let i = 2; i < input.n; i++) {
        sequence[i] = sequence[i-1] + sequence[i-2];
      }
      return {
        sequence: sequence.slice(0, input.n),
        count: input.n
      };
    })
});

// Custom Development Tools Router
const customDevRouter = router({
  generateUUID: publicProcedure
    .meta({
      ...createMCPTool({
        name: 'generateUUID',
        description: 'Generate UUID v4 identifiers',
        category: 'development',
        public: true
      })
    })
    .input(z.object({
      count: z.number().int().min(1).max(10).default(1).describe('Number of UUIDs to generate')
    }))
    .query(({ input }) => {
      const crypto = require('crypto');
      const uuids = Array.from({ length: input.count }, () => crypto.randomUUID());
      return {
        uuids,
        count: input.count
      };
    }),

  validateJSON: publicProcedure
    .meta({
      ...createMCPTool({
        name: 'validateJSON',
        description: 'Validate and format JSON strings',
        category: 'development',
        public: true
      })
    })
    .input(z.object({
      jsonString: z.string().describe('JSON string to validate and format'),
      indent: z.number().int().min(0).max(8).default(2).describe('Indentation spaces')
    }))
    .mutation(({ input }) => {
      try {
        const parsed = JSON.parse(input.jsonString);
        const formatted = JSON.stringify(parsed, null, input.indent);
        return {
          valid: true,
          formatted,
          size: formatted.length
        };
      } catch (error) {
        return {
          valid: false,
          error: error.message,
          formatted: null
        };
      }
    }),

  encodeBase64: publicProcedure
    .meta({
      ...createMCPTool({
        name: 'encodeBase64',
        description: 'Encode and decode base64 strings',
        category: 'development',
        public: true
      })
    })
    .input(z.object({
      text: z.string().describe('Text to encode/decode'),
      operation: z.enum(['encode', 'decode']).describe('Operation to perform')
    }))
    .mutation(({ input }) => {
      try {
        if (input.operation === 'encode') {
          const encoded = Buffer.from(input.text, 'utf8').toString('base64');
          return {
            result: encoded,
            operation: 'encode',
            originalLength: input.text.length,
            encodedLength: encoded.length
          };
        } else {
          const decoded = Buffer.from(input.text, 'base64').toString('utf8');
          return {
            result: decoded,
            operation: 'decode',
            encodedLength: input.text.length,
            decodedLength: decoded.length
          };
        }
      } catch (error) {
        return {
          error: error.message,
          operation: input.operation
        };
      }
    })
});

// Store instances globally for cleanup during hot reload
let dbAdapter = null;
let server = null;

// Initialize database and start server
async function startServer() {
  try {
    // Clean up any existing server instance (for hot reload)
    if (global.serverInstance) {
      console.log('🔄 Cleaning up existing server instance...');
      try {
        await global.serverInstance.stop();
        global.serverInstance = null;
      } catch (error) {
        console.log('⚠️  Previous server already stopped');
      }
    }
    
    if (global.dbAdapterInstance) {
      try {
        await global.dbAdapterInstance.close();
        global.dbAdapterInstance = null;
      } catch (error) {
        console.log('⚠️  Previous database connection already closed');
      }
    }
    
    // Small delay to ensure port is released
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Initialize PostgreSQL adapter for token tracking
    dbAdapter = new PostgreSQLAdapter({
      connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/ai_backend',
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });

    // Initialize the server configuration
    const serverConfig = {
      // OAuth2 Configuration
      auth: {
        enabled: false, // Set to true to enable authentication testing
        providers: {
          github: {
            clientId: process.env.GITHUB_CLIENT_ID,
            clientSecret: process.env.GITHUB_CLIENT_SECRET,
            redirectUri: process.env.GITHUB_REDIRECT_URI || 'http://localhost:8001/auth/callback/github'
          },
          google: {
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            redirectUri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:8001/auth/callback/google'
          }
        },
        jwt: {
          secret: process.env.JWT_SECRET || 'change-this-in-production',
          expiresIn: '7d'
        }
      },

      // AI Provider Configuration
      ai: {
        systemPrompt: `You are a professional AI assistant with expertise in software development.
        Provide accurate, helpful responses while being mindful of token usage.`,
        
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
        
        // Rate limiting by subscription tier
        rateLimits: {
          free: { rpm: 10, tpm: 1000 },
          pro: { rpm: 100, tpm: 10000 },
          enterprise: { rpm: 1000, tpm: 100000 }
        }
      },

      // Token Tracking Configuration
      tokenTracking: {
        enabled: true,
        database: dbAdapter,
        quotas: {
          free: 10000,      // 10K tokens/month
          pro: 1000000,     // 1M tokens/month
          enterprise: -1    // Unlimited
        }
      },

      // Add custom routers - they'll be merged with built-in namespaces
      customRouters: {
        math: customMathRouter,
        dev: customDevRouter
      },

      // MCP Configuration - presence of this object enables MCP
      mcp: {
        enableMCP: true,
        name: 'Comprehensive AI Server',
        version: '1.0.0',
        description: 'Full-featured AI server with custom tools, sampling, and MCP extensions',

        // 🤖 AI-Powered Sampling & Elicitation (SECURE: Disabled by default)
        ai: {
          enabled: true,                    // Enable AI for MCP sampling tools
          useServerConfig: true,            // Use same providers as ai.generateText
          restrictToSampling: true,         // Only sampling tools use AI (recommended)
          allowByokOverride: false          // Server keys only (secure default)
        },

        // MCP-specific settings for testing hybrid authentication system
        auth: {
          requireAuthForToolsList: false,   // Allow tool discovery without auth
          requireAuthForToolsCall: false,   // Most tools public for demo (normally true)

          // 🎯 Hybrid Authentication System Demo:
          //
          // Option 1: Use defaults but deny specific tools
          // publicTools: 'default',           // Use tool metadata defaults (public: true tools)
          // denyPublicTools: ['calculate'],   // Security override: disable calculate even though it's marked public
          //
          // Option 2: Allow built-in tools + custom tools (demonstrate mixed namespaces)
          publicTools: [
            'greeting', 'currentSystemTime',           // Built-in MCP tools
            'add', 'multiply', 'fibonacci',            // Custom math tools
            'generateUUID', 'validateJSON', 'encodeBase64', // Custom dev tools
            'generateWithApproval', 'requestElicitation'   // AI sampling tools
          ],
          // publicCategories: ['math', 'development'], // Optional: allow entire categories

          // Result: Most tools ✅ public, some built-in tools ❌ (not in allow list)
        },

        // MCP Extensions Configuration - Enable resources and prompts
        extensions: {
          // Enable prompts support
          prompts: {
            includeDefaults: true,
            customPrompts: [
              {
                name: 'code-review',
                description: 'Template for comprehensive code review with security focus',
                arguments: [
                  {
                    name: 'language',
                    description: 'Programming language (e.g., typescript, python, javascript)',
                    required: true
                  },
                  {
                    name: 'focus_area',
                    description: 'Review focus area (security, performance, maintainability, all)',
                    required: false
                  }
                ]
              },
              {
                name: 'api-documentation',
                description: 'Generate comprehensive API documentation for endpoints',
                arguments: [
                  {
                    name: 'endpoint_name',
                    description: 'Name of the API endpoint',
                    required: true
                  },
                  {
                    name: 'http_method',
                    description: 'HTTP method (GET, POST, PUT, DELETE)',
                    required: true
                  }
                ]
              }
            ],
            customTemplates: {
              'code-review': {
                messages: [
                  {
                    role: 'system',
                    content: {
                      type: 'text',
                      text: 'You are an expert code reviewer with deep knowledge of {{language}} and software security best practices. Focus on {{focus_area}} aspects of the code.'
                    }
                  },
                  {
                    role: 'user',
                    content: {
                      type: 'text',
                      text: 'Please review this {{language}} code with focus on {{focus_area}}. Provide specific, actionable feedback including: 1) Security vulnerabilities, 2) Performance optimizations, 3) Code quality improvements, 4) Best practices violations. Format your response with clear sections and prioritized recommendations.'
                    }
                  }
                ]
              },
              'api-documentation': {
                messages: [
                  {
                    role: 'system',
                    content: {
                      type: 'text',
                      text: 'You are a technical documentation specialist. Generate comprehensive, developer-friendly API documentation.'
                    }
                  },
                  {
                    role: 'user',
                    content: {
                      type: 'text',
                      text: 'Create detailed API documentation for the {{http_method}} {{endpoint_name}} endpoint. Include: purpose, parameters, request/response examples, error codes, authentication requirements, and usage notes.'
                    }
                  }
                ]
              }
            }
          },

          // Enable resources support
          resources: {
            includeDefaults: true,
            customResources: [
              {
                uri: 'file://company-handbook.json',
                name: 'Company Engineering Handbook',
                description: 'Complete engineering practices, coding standards, and deployment procedures',
                mimeType: 'application/json'
              },
              {
                uri: 'file://api-schemas.json',
                name: 'API Schema Definitions',
                description: 'OpenAPI schemas for all service endpoints with validation rules',
                mimeType: 'application/json'
              },
              {
                uri: 'file://security-guidelines.md',
                name: 'Security Guidelines',
                description: 'Security best practices, threat models, and compliance requirements',
                mimeType: 'text/markdown'
              }
            ],
            customTemplates: [
              {
                name: 'user-profile',
                description: 'Generate user profile information for a specific user',
                uriTemplate: 'file://users/{userId}/profile.json',
                arguments: [
                  {
                    name: 'userId',
                    description: 'User ID to fetch profile for',
                    required: true
                  },
                  {
                    name: 'includePrivate',
                    description: 'Include private user information',
                    required: false
                  }
                ],
                mimeType: 'application/json'
              },
              {
                name: 'project-docs',
                description: 'Generate project documentation for a specific project and section',
                uriTemplate: 'file://projects/{projectId}/docs/{section}.md',
                arguments: [
                  {
                    name: 'projectId',
                    description: 'Project identifier',
                    required: true
                  },
                  {
                    name: 'section',
                    description: 'Documentation section (readme, api, deployment, security)',
                    required: true
                  },
                  {
                    name: 'version',
                    description: 'Project version (defaults to latest)',
                    required: false
                  }
                ],
                mimeType: 'text/markdown'
              },
              {
                name: 'config-generator',
                description: 'Generate configuration files for different environments',
                uriTemplate: 'file://config/{environment}/{service}.yml',
                arguments: [
                  {
                    name: 'environment',
                    description: 'Target environment (dev, staging, production)',
                    required: true
                  },
                  {
                    name: 'service',
                    description: 'Service name',
                    required: true
                  },
                  {
                    name: 'format',
                    description: 'Config format (yml, json, env)',
                    required: false
                  }
                ],
                mimeType: 'application/x-yaml'
              },
              {
                name: 'file-reader',
                description: 'Read content from local files with security validation',
                uriTemplate: 'file://read/{filePath}',
                arguments: [
                  {
                    name: 'filePath',
                    description: 'Relative path to the file to read (within server directory)',
                    required: true
                  },
                  {
                    name: 'encoding',
                    description: 'File encoding (utf8, base64, etc.)',
                    required: false
                  }
                ],
                mimeType: 'application/json'
              }
            ],
            templateHandlers: {
              'user-profile': (args) => {
                const { userId, includePrivate = false } = args;
                return {
                  userId,
                  name: `User ${userId}`,
                  email: `user${userId}@company.com`,
                  department: 'Engineering',
                  role: 'Developer',
                  lastLogin: new Date().toISOString(),
                  ...(includePrivate && {
                    salary: 75000,
                    socialSecurity: '***-**-1234',
                    address: '123 Main St, City, State'
                  })
                };
              },
              'project-docs': (args) => {
                const { projectId, section, version = 'latest' } = args;
                const docs = {
                  readme: `# Project ${projectId}\n\nVersion: ${version}\n\nThis is the main documentation for project ${projectId}.`,
                  api: `# API Documentation - ${projectId}\n\n## Endpoints\n\n### GET /api/v1/data\nReturns project data.`,
                  deployment: `# Deployment Guide - ${projectId}\n\n## Prerequisites\n- Docker\n- Kubernetes\n\n## Steps\n1. Build image\n2. Deploy to cluster`,
                  security: `# Security Guide - ${projectId}\n\n## Authentication\n- OAuth2\n- JWT tokens\n\n## Encryption\n- TLS 1.3\n- AES-256`
                };
                return docs[section] || `# ${section}\n\nDocumentation not available for section: ${section}`;
              },
              'config-generator': (args) => {
                const { environment, service, format = 'yml' } = args;
                const config = {
                  service: {
                    name: service,
                    environment,
                    replicas: environment === 'production' ? 3 : 1,
                    resources: {
                      cpu: environment === 'production' ? '500m' : '100m',
                      memory: environment === 'production' ? '1Gi' : '256Mi'
                    },
                    database: {
                      host: `${service}-db-${environment}.company.com`,
                      port: 5432,
                      ssl: environment === 'production'
                    }
                  }
                };

                if (format === 'json') {
                  return JSON.stringify(config, null, 2);
                } else if (format === 'env') {
                  return `SERVICE_NAME=${service}\nENVIRONMENT=${environment}\nREPLICAS=${config.service.replicas}`;
                }
                // Default YAML format
                return `service:
  name: ${service}
  environment: ${environment}
  replicas: ${config.service.replicas}
  resources:
    cpu: ${config.service.resources.cpu}
    memory: ${config.service.resources.memory}
  database:
    host: ${config.service.database.host}
    port: ${config.service.database.port}
    ssl: ${config.service.database.ssl}`;
              },
              'file-reader': async (args) => {
                const { filePath, encoding = 'utf8' } = args;
                const { promises: fs } = await import('fs');
                const path = await import('path');

                try {
                  // Get current working directory for this context
                  const currentDir = process.cwd();

                  // Validate file path for security (prevent directory traversal)
                  const safePath = path.resolve(currentDir, filePath);
                  if (!safePath.startsWith(currentDir)) {
                    throw new Error('Access denied: Path outside of allowed directory');
                  }

                  // Check if file exists
                  await fs.access(safePath);

                  // Read file content
                  const content = await fs.readFile(safePath, encoding);
                  const stats = await fs.stat(safePath);

                  return {
                    filePath: safePath,
                    size: content.length,
                    encoding,
                    content,
                    lastModified: stats.mtime.toISOString()
                  };
                } catch (error) {
                  return {
                    error: `Failed to read file: ${error.message}`,
                    filePath: filePath,
                    encoding
                  };
                }
              }
            },
            customHandlers: {
              'company-handbook.json': () => ({
                version: '2.1.0',
                lastUpdated: new Date().toISOString(),
                sections: {
                  'coding-standards': {
                    typescript: {
                      eslintConfig: '@company/eslint-config',
                      strictMode: true,
                      noImplicitAny: true,
                      preferences: ['functional-programming', 'immutable-data', 'type-safety']
                    },
                    testing: {
                      framework: 'vitest',
                      coverage: { minimum: 80, target: 90 },
                      types: ['unit', 'integration', 'e2e']
                    }
                  },
                  'deployment': {
                    environments: ['dev', 'staging', 'production'],
                    cicd: 'github-actions',
                    containers: 'docker',
                    monitoring: ['prometheus', 'grafana', 'alertmanager']
                  },
                  'security': {
                    authentication: 'oauth2',
                    encryption: 'aes-256-gcm',
                    secrets: 'vault',
                    scanners: ['snyk', 'semgrep', 'trivy']
                  }
                }
              }),
              'api-schemas.json': () => ({
                openapi: '3.0.3',
                info: {
                  title: 'Simple RPC AI Backend API',
                  version: '1.0.0',
                  description: 'AI-powered backend with MCP support'
                },
                servers: [
                  { url: 'http://localhost:8000', description: 'Development server' },
                  { url: 'http://localhost:8001', description: 'MCP server' }
                ],
                paths: {
                  '/mcp': {
                    post: {
                      summary: 'MCP Protocol Endpoint',
                      description: 'Model Context Protocol tools and resources',
                      parameters: [],
                      requestBody: {
                        required: true,
                        content: {
                          'application/json': {
                            schema: {
                              type: 'object',
                              properties: {
                                jsonrpc: { type: 'string', enum: ['2.0'] },
                                method: { type: 'string', enum: ['tools/list', 'tools/call', 'prompts/list', 'prompts/get', 'resources/list', 'resources/read'] },
                                params: { type: 'object' },
                                id: { type: ['string', 'number'] }
                              }
                            }
                          }
                        }
                      }
                    }
                  },
                  '/trpc': {
                    post: {
                      summary: 'tRPC Endpoint',
                      description: 'Type-safe RPC procedures',
                      parameters: []
                    }
                  }
                },
                components: {
                  schemas: {
                    MCPRequest: {
                      type: 'object',
                      required: ['jsonrpc', 'method', 'id'],
                      properties: {
                        jsonrpc: { type: 'string', enum: ['2.0'] },
                        method: { type: 'string' },
                        params: { type: 'object' },
                        id: { type: ['string', 'number'] }
                      }
                    }
                  }
                }
              }),
              'security-guidelines.md': () => `# Security Guidelines

## Authentication & Authorization
- Use OAuth2 with JWT tokens for API access
- Implement scope-based permissions (mcp:call, admin, system:read)
- Validate all input parameters to prevent injection attacks
- Rate limit API endpoints to prevent abuse

## Data Protection
- Encrypt sensitive data at rest using AES-256-GCM
- Use HTTPS for all communications
- Implement proper session management with secure cookies
- Log security events for monitoring and compliance

## Code Security
- Run security scanners (Snyk, Semgrep) in CI/CD pipeline
- Follow OWASP Top 10 guidelines
- Validate and sanitize all user inputs
- Use parameterized queries to prevent SQL injection

## Infrastructure Security
- Keep dependencies updated and scan for vulnerabilities
- Use container scanning for Docker images
- Implement network segmentation and firewalls
- Regular security audits and penetration testing

## Incident Response
- Have incident response plan documented
- Monitor for security events and anomalies
- Maintain audit logs for compliance
- Regular backup and disaster recovery testing

Last updated: ${new Date().toISOString()}
`
            }
          }
        }
      },

      // Protocol Configuration
      protocols: {
        tRpc: true,
        jsonRpc: true
      },

      // tRPC Configuration
      trpc: {
        playground: process.env.NODE_ENV !== 'production',
        batching: {
          enabled: true,
          maxBatchSize: 10
        }
      },

      // Server Configuration
      port: process.env.PORT || 8001,
      cors: {
        // CORS_ORIGIN examples:
        // - Single: "*" or "https://app.example.com"  
        // - Multiple: "https://playground.open-rpc.org,https://inspector.open-rpc.org"
        // - Array in code: ["https://app1.com", "https://app2.com"]
        origin: process.env.CORS_ORIGIN || [
          'http://localhost:3000',           // Local development
          'https://playground.open-rpc.org', // OpenRPC Playground
          'https://inspector.open-rpc.org',  // OpenRPC Inspector  
          'http://localhost:4000'            // MCP Jam Inspector
        ],
        credentials: true
      },
      // trustProxy: Enable this when using reverse proxies (nginx, ngrok, etc)
      // - Development: true when using ngrok for local tunneling
      // - Production: true only if behind a reverse proxy (load balancer, nginx)
      // - Direct deployment: false (most production deployments don't need this)
      trustProxy: process.env.TRUST_PROXY === 'true' || false,

      // Monitoring & Logging
      monitoring: {
        enabled: true,
        metrics: {
          collectDefaultMetrics: true,
          endpoint: '/metrics'
        },
        logging: {
          level: process.env.LOG_LEVEL || 'info',
          format: process.env.NODE_ENV === 'production' ? 'json' : 'pretty'
        }
      }
    });
    
    // Initialize database connection
    console.log('📊 Initializing database connection...');
    console.log('🔍 Debug: MCP auth config:', JSON.stringify(server.config?.mcp?.auth, null, 2));
    
    // Start the server
    await server.start();
    
    const port = process.env.PORT || 8001;
    console.log(`
🚀 Production MCP Server Started!
=====================================

📍 Endpoints:
   - tRPC:      http://localhost:${port}/trpc
   - MCP:       http://localhost:${port}/mcp
   - JSON-RPC:  http://localhost:${port}/rpc
   - Health:    http://localhost:${port}/health
   - Metrics:   http://localhost:${port}/metrics
   
🔐 Authentication:
   - GitHub:    ${process.env.GITHUB_CLIENT_ID ? '✅ Configured' : '❌ Not configured'}
   - Google:    ${process.env.GOOGLE_CLIENT_ID ? '✅ Configured' : '❌ Not configured'}
   - Login:     http://localhost:${port}/auth/login
   
🤖 AI Providers:
   - Anthropic: ${process.env.ANTHROPIC_API_KEY ? '✅ Ready' : '❌ Missing API key'}
   - OpenAI:    ${process.env.OPENAI_API_KEY ? '✅ Ready' : '❌ Missing API key'}
   - Google:    ${process.env.GOOGLE_API_KEY ? '✅ Ready' : '❌ Missing API key'}
   
📊 Token Tracking: ✅ Enabled (PostgreSQL)
🔧 MCP Protocol:  ✅ Enabled
⚡ tRPC:          ✅ Enabled

🧪 MCP Hybrid Authentication Demo:
   📋 Public Tools (no auth): greeting, currentSystemTime  
   🔒 Denied Tools: calculate (public in code, but denied by config)
   🔒 Auth Required: echo, status, longRunningTask, etc.
   💡 Demo: 'greeting' ✅ works, 'calculate' ❌ denied, 'echo' ❌ needs auth

🎛️  Dev Panel:    http://localhost:8080 (run: npm run dev:panel)

Environment: ${process.env.NODE_ENV || 'development'}
    `);
    
    // Store server instance for cleanup
    global.serverInstance = server;
    global.dbAdapterInstance = dbAdapter;
    
    // Graceful shutdown handler
    const gracefulShutdown = async (signal) => {
      console.log(`📭 Received ${signal}, shutting down gracefully...`);
      try {
        if (global.serverInstance) {
          await global.serverInstance.stop();
          global.serverInstance = null;
        }
        if (global.dbAdapterInstance) {
          await global.dbAdapterInstance.close();
          global.dbAdapterInstance = null;
        }
        process.exit(0);
      } catch (error) {
        console.error('Error during shutdown:', error);
        process.exit(1);
      }
    };
    
    // Handle all shutdown signals
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGUSR2', () => gracefulShutdown('SIGUSR2')); // tsx watch reload signal
    
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer();