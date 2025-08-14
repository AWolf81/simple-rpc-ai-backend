/**
 * Example: Type-safe RPC Server using tRPC-style patterns
 * 
 * Shows how to create a type-safe JSON-RPC server with automatic
 * OpenRPC schema generation, following tRPC patterns.
 */

import { createSimpleAIServer } from '../src/server-simple.js';
import { createRPCRouter, publicProcedure, v, generateOpenRPCSchema } from '../src/rpc/router.js';
import { AIService } from '../src/services/ai-service.js';

// Define our AI router with type safety
const aiRouter = createRPCRouter({
  health: publicProcedure
    .meta({
      description: 'Check server health status',
      examples: [{
        name: 'Basic health check',
        result: { status: 'healthy', timestamp: '2024-01-15T10:30:00Z' }
      }]
    })
    .query(async () => {
      return {
        status: 'healthy' as const,
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
      };
    }),

  executeAIRequest: publicProcedure
    .input(v.object({
      content: v.string(),
      systemPrompt: v.string(),
      options: v.optional(v.object({
        model: v.optional(v.string()),
        maxTokens: v.optional(v.number()),
        temperature: v.optional(v.number())
      }))
    }))
    .meta({
      description: 'Execute AI analysis with system prompt protection',
      examples: [{
        name: 'Code analysis',
        params: {
          content: 'function add(a, b) { return a + b; }',
          systemPrompt: 'Analyze this code for security issues'
        },
        result: {
          content: 'The function appears secure with no obvious vulnerabilities.',
          usage: { promptTokens: 15, completionTokens: 20, totalTokens: 35 },
          model: 'claude-3-5-sonnet-20241022'
        }
      }]
    })
    .mutation(async ({ content, systemPrompt, options }, { req, res }) => {
      // Initialize AI service (in real app, this would be injected)
      const aiService = new AIService({
        serviceProviders: {
          anthropic: { priority: 1 },
          openai: { priority: 2 }
        }
      });

      const result = await aiService.execute({
        content,
        systemPrompt,
        options
      });

      return result;
    }),

  // OpenRPC discovery method
  'rpc.discover': publicProcedure
    .meta({
      description: 'OpenRPC service discovery method - returns API schema'
    })
    .query(async () => {
      return generateOpenRPCSchema(aiRouter, {
        title: 'Typed AI RPC Server',
        description: 'Type-safe AI RPC server with OpenRPC support',
        version: '1.0.0'
      });
    })
});

// Type inference - now we have full type safety!
type AIRouter = typeof aiRouter;
type AIRouterInputs = {
  health: undefined;
  executeAIRequest: {
    content: string;
    systemPrompt: string;
    options?: {
      model?: string;
      maxTokens?: number;
      temperature?: number;
    };
  };
  'rpc.discover': undefined;
};

// Example usage
async function startTypedServer() {
  const server = createSimpleAIServer({
    port: 8001,
    cors: { origin: '*' }
  });

  // Add our typed router endpoints to the server
  const app = server.getApp();
  
  // Enhanced OpenRPC endpoint that uses our typed schema
  app.get('/openrpc.json', (req, res) => {
    const schema = generateOpenRPCSchema(aiRouter, {
      title: 'Typed AI RPC Server',
      description: 'Type-safe AI RPC server with automatic OpenRPC generation',
      version: '1.0.0'
    });
    
    // Add server info
    schema.servers = [{
      name: 'Typed RPC Server',
      url: 'http://localhost:8001/rpc',
      description: 'Type-safe JSON-RPC endpoint'
    }];
    
    res.json(schema);
  });

  await server.start();
  
  console.log('🎯 Typed AI RPC Server Features:');
  console.log('   • Full TypeScript type safety');
  console.log('   • Automatic OpenRPC schema generation');
  console.log('   • tRPC-style procedure definitions');
  console.log('   • Compatible with OpenRPC Playground');
  console.log('');
  console.log('🔗 Test with OpenRPC Playground:');
  console.log('   1. Go to https://playground.open-rpc.org/');
  console.log('   2. Enter: http://localhost:8001/openrpc.json');
  console.log('   3. Click "Load" to explore the API');
  console.log('');
  console.log('📍 Endpoints:');
  console.log('   • RPC: POST http://localhost:8001/rpc');
  console.log('   • Schema: GET http://localhost:8001/openrpc.json');
  console.log('   • Health: GET http://localhost:8001/health');
}

// Start server if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  startTypedServer().catch(console.error);
}

export { aiRouter, startTypedServer };
export type { AIRouter, AIRouterInputs };