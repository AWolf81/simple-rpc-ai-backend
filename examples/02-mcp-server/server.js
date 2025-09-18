#!/usr/bin/env node

/**
 * Production MCP Server Example
 * 
 * Full-featured server with OAuth2, tRPC, token tracking, and MCP support.
 * Ready for production deployment with authentication and monitoring.
 */

import { createRpcAiServer } from 'simple-rpc-ai-backend';
import { PostgreSQLAdapter } from 'simple-rpc-ai-backend';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Initialize PostgreSQL adapter for token tracking
const dbAdapter = new PostgreSQLAdapter({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/ai_backend',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Initialize the server with full configuration
const server = createRpcAiServer({
  // OAuth2 Configuration
  auth: {
    enabled: true,
    providers: {
      github: {
        clientId: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET,
        redirectUri: process.env.GITHUB_REDIRECT_URI || 'http://localhost:8000/auth/callback/github'
      },
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        redirectUri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:8000/auth/callback/google'
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

  // MCP Configuration
  mcp: {
    enabled: true,
    name: 'Production AI Server',
    version: '1.0.0',
    description: 'Full-featured AI server with authentication and token tracking',
    
    // MCP-specific settings
    auth: {
      requireAuthForToolsList: false,  // Allow tool discovery without auth
      requireAuthForToolsCall: true,   // Require auth for tool execution
      publicTools: ['health', 'status'] // Tools available without auth
    }
  },

  // tRPC Configuration
  trpc: {
    enabled: true,
    playground: process.env.NODE_ENV !== 'production',
    batching: {
      enabled: true,
      maxBatchSize: 10
    }
  },

  // Server Configuration
  server: {
    port: process.env.PORT || 8000,
    cors: {
      origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
      credentials: true
    },
    trustProxy: process.env.NODE_ENV === 'production'
  },

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

// Initialize database and start server
async function startServer() {
  try {
    // Run database migrations
    console.log('📊 Running database migrations...');
    await dbAdapter.runMigrations();
    
    // Start the server
    await server.start();
    
    console.log(`
🚀 Production MCP Server Started!
=====================================

📍 Endpoints:
   - tRPC:      http://localhost:${server.port}/trpc
   - MCP:       http://localhost:${server.port}/mcp
   - JSON-RPC:  http://localhost:${server.port}/rpc
   - Health:    http://localhost:${server.port}/health
   - Metrics:   http://localhost:${server.port}/metrics
   
🔐 Authentication:
   - GitHub:    ${process.env.GITHUB_CLIENT_ID ? '✅ Configured' : '❌ Not configured'}
   - Google:    ${process.env.GOOGLE_CLIENT_ID ? '✅ Configured' : '❌ Not configured'}
   - Login:     http://localhost:${server.port}/auth/login
   
🤖 AI Providers:
   - Anthropic: ${process.env.ANTHROPIC_API_KEY ? '✅ Ready' : '❌ Missing API key'}
   - OpenAI:    ${process.env.OPENAI_API_KEY ? '✅ Ready' : '❌ Missing API key'}
   - Google:    ${process.env.GOOGLE_API_KEY ? '✅ Ready' : '❌ Missing API key'}
   
📊 Token Tracking: ✅ Enabled (PostgreSQL)
🔧 MCP Protocol:  ✅ Enabled
⚡ tRPC:          ✅ Enabled

🎛️  Dev Panel:    http://localhost:8080 (run: npm run dev:panel)

Environment: ${process.env.NODE_ENV || 'development'}
    `);
    
    // Graceful shutdown
    process.on('SIGTERM', async () => {
      console.log('📭 Shutting down gracefully...');
      await server.stop();
      await dbAdapter.close();
      process.exit(0);
    });
    
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer();