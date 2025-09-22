#!/usr/bin/env node

/**
 * Basic AI Server Example
 * 
 * Minimal server demonstrating core AI execution with system prompt protection.
 * Perfect for getting started quickly with AI integration.
 */

import { createRpcAiServer } from 'simple-rpc-ai-backend';

// Configuration
const port = process.env.PORT || 8000;

console.log("config", port)

// Start the server with minimal configuration
const server = createRpcAiServer({
  port: port,
  serverProviders: [ 'anthropic', 'openai', 'google', 'openrouter' ],
  protocols: {
    jsonRpc: true,  // Keep JSON-RPC for compatibility
    tRpc: true      // Enable tRPC for development panel
  },
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
  systemPrompts: {
    default: 'You are a helpful AI assistant.',
  },
  modelRestrictions: {
    // Restrict OpenRouter to only allow Anthropic and OpenAI models
    openrouter: {
      allowedPatterns: [
        'anthropic/*',  // Allow all Anthropic models via OpenRouter
        'openai/*'      // Allow all OpenAI models via OpenRouter
      ],
      blockedModels: [
        'meta-llama/llama-3.1-70b',  // Example: Block specific models
        'mistralai/mistral-large'    // Example: Block specific models
      ]
    }
  }
});

// Start the server
server.start().then(() => {
  console.log(`
🚀 Basic AI Server Started!
===========================

📍 Endpoints:
   - JSON-RPC: http://localhost:${port}/rpc
   - Health:   http://localhost:${port}/health
   
🤖 Available Providers:
   - Anthropic:  ${process.env.ANTHROPIC_API_KEY ? '✅ Configured' : '❌ Missing API key'}
   - OpenAI:     ${process.env.OPENAI_API_KEY ? '✅ Configured' : '❌ Missing API key'}
   - Google:     ${process.env.GOOGLE_API_KEY ? '✅ Configured' : '❌ Missing API key'}
   - OpenRouter: ${process.env.OPENROUTER_API_KEY ? '✅ Configured' : '❌ Missing API key'}

📝 Example Requests:
   curl -X POST http://localhost:${port}/rpc \
     -H "Content-Type: application/json" \
     -d '{
       "jsonrpc": "2.0",
       "method": "ai.generateText",
       "params": {
         "content": "Hello, AI!",
         "systemPrompt": "default",
         "provider": "anthropic"
       },
       "id": 1
     }'
   
   # List allowed models (filtered by provider)
   curl -X POST http://localhost:${port}/rpc \\
     -H "Content-Type: application/json" \\
     -d '{
       "jsonrpc": "2.0",
       "method": "ai.listAllowedModels",
       "params": {
         "provider": "openrouter"
       },
       "id": 2
     }'

⚠️  Note: This server has no authentication. Use for development only!
  `);
}).catch(error => {
  console.error('❌ Failed to start server:', error);
  process.exit(1);
});