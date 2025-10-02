#!/usr/bin/env node

/**
 * Basic AI Server Example
 * 
 * Minimal server demonstrating core AI execution with system prompt protection.
 * Perfect for getting started quickly with AI integration.
 */

import { createRpcAiServer, router, publicProcedure } from 'simple-rpc-ai-backend';
import { z } from 'zod';

// Configuration
const port = process.env.PORT || 8000;

// Custom router with simulated AI delay for load testing
const testRouter = router({
  simulateAI: publicProcedure
    .input(z.object({
      delay: z.number().min(100).max(5000).default(1500).optional(),
      message: z.string().default('Test message').optional()
    }))
    .mutation(async ({ input }) => {
      const startTime = performance.now();

      // Simulate AI API delay
      await new Promise(resolve => setTimeout(resolve, input.delay || 1500));

      const endTime = performance.now();

      return {
        success: true,
        message: input.message,
        simulatedDelay: input.delay || 1500,
        actualDelay: Math.round(endTime - startTime),
        timestamp: new Date().toISOString()
      };
    })
});

console.log("config", port)

// Start the server with minimal configuration
const server = createRpcAiServer({
  port: port,
  serverProviders: [ 'anthropic', 'openai', 'google', 'openrouter' ],
  protocols: {
    jsonRpc: true,  // Keep JSON-RPC for compatibility
    tRpc: true      // Enable tRPC for development panel
  },
  debug: {
    enableTiming: process.env.ENABLE_TIMING === 'true'  // Enable via env var
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
  },
  customRouters: {
    test: testRouter  // Add test router for load testing
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
   # AI generation (requires API key)
   curl -X POST http://localhost:${port}/rpc \\
     -H "Content-Type: application/json" \\
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

   # Simulated AI delay (for load testing - no API key needed)
   curl -X POST http://localhost:${port}/rpc \\
     -H "Content-Type: application/json" \\
     -d '{
       "jsonrpc": "2.0",
       "method": "test.simulateAI",
       "params": {
         "delay": 1500,
         "message": "Load test"
       },
       "id": 2
     }'

🧪 Load Testing:
   # Test health endpoint (baseline - ~3000 req/sec)
   ab -n 1000 -c 100 http://localhost:${port}/health

   # Test simulated AI delay (realistic - ~65 req/sec with 1.5s delay)
   ab -n 100 -c 10 -p post.json -T application/json http://localhost:${port}/rpc
   # Create post.json with: {"jsonrpc":"2.0","method":"test.simulateAI","params":{},"id":1}

⚠️  Note: This server has no authentication. Use for development only!
  `);
}).catch(error => {
  console.error('❌ Failed to start server:', error);
  process.exit(1);
});