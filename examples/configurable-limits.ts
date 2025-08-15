/**
 * Example: Configurable AI Limits Demo
 * 
 * Shows how to use the new configurable limits system for content and tokens.
 * Demonstrates different server configurations for various use cases.
 */

import { createTRPCServer } from '../src/server-trpc.js';
import type { AIRouterConfig } from '../src/trpc/routers/ai.js';

// Example 1: Development server with generous limits
async function createDevelopmentServer() {
  const devLimits: AIRouterConfig = {
    content: {
      maxLength: 1_000_000, // 1MB for large files
      minLength: 1,
    },
    tokens: {
      defaultMaxTokens: 4096,
      maxTokenLimit: 200_000, // Support for long context models
      minTokens: 1,
    },
    systemPrompt: {
      maxLength: 50_000,
      minLength: 1,
    },
  };

  const server = createTRPCServer({
    port: 8001,
    aiLimits: devLimits,
    cors: { origin: '*' }
  });

  await server.start();
  console.log('🛠️  Development Server Features:');
  console.log('   • Content limit: 1MB (1,000,000 chars)');
  console.log('   • Token limit: 200k max, 4k default');
  console.log('   • System prompt: 50k chars max');
  console.log('   • Port: 8001');
  console.log('');
  return server;
}

// Example 2: Production server with conservative limits
async function createProductionServer() {
  const prodLimits: AIRouterConfig = {
    content: {
      maxLength: 100_000, // 100k for performance
      minLength: 1,
    },
    tokens: {
      defaultMaxTokens: 2048, // Conservative default
      maxTokenLimit: 32_000,  // Reasonable max
      minTokens: 1,
    },
    systemPrompt: {
      maxLength: 10_000, // Focused prompts
      minLength: 5,
    },
  };

  const server = createTRPCServer({
    port: 8002,
    aiLimits: prodLimits,
    cors: { 
      origin: ['https://yourapp.com', 'https://admin.yourapp.com'],
      credentials: true 
    },
    rateLimit: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100 // limit each IP to 100 requests per windowMs
    }
  });

  await server.start();
  console.log('🏭 Production Server Features:');
  console.log('   • Content limit: 100k chars (performance optimized)');
  console.log('   • Token limit: 32k max, 2k default');
  console.log('   • System prompt: 10k chars max');
  console.log('   • Rate limiting: 100 req/15min per IP');
  console.log('   • Port: 8002');
  console.log('');
  return server;
}

// Example 3: Enterprise server with flexible, high limits
async function createEnterpriseServer() {
  const enterpriseLimits: AIRouterConfig = {
    content: {
      maxLength: 5_000_000, // 5MB for enterprise documents
      minLength: 1,
    },
    tokens: {
      defaultMaxTokens: 8192,   // Higher default
      maxTokenLimit: 1_000_000, // Support for massive contexts
      minTokens: 1,
    },
    systemPrompt: {
      maxLength: 100_000, // Complex enterprise prompts
      minLength: 1,
    },
  };

  const server = createTRPCServer({
    port: 8003,
    aiLimits: enterpriseLimits,
    cors: { 
      origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
      credentials: true 
    }
  });

  await server.start();
  console.log('🏢 Enterprise Server Features:');
  console.log('   • Content limit: 5MB (enterprise documents)');
  console.log('   • Token limit: 1M max, 8k default');
  console.log('   • System prompt: 100k chars max');
  console.log('   • Environment-based CORS');
  console.log('   • Port: 8003');
  console.log('');
  return server;
}

// Example 4: No limits server (use with caution!)
async function createUnlimitedServer() {
  const unlimitedLimits: AIRouterConfig = {
    content: {
      maxLength: Number.MAX_SAFE_INTEGER, // Effectively unlimited
      minLength: 1,
    },
    tokens: {
      defaultMaxTokens: 4096,
      maxTokenLimit: Number.MAX_SAFE_INTEGER, // Effectively unlimited
      minTokens: 1,
    },
    systemPrompt: {
      maxLength: Number.MAX_SAFE_INTEGER, // Effectively unlimited
      minLength: 1,
    },
  };

  const server = createTRPCServer({
    port: 8004,
    aiLimits: unlimitedLimits,
    cors: { origin: 'http://localhost:*' }
  });

  await server.start();
  console.log('🚀 Unlimited Server Features (Use with caution!):');
  console.log('   • Content limit: Unlimited');
  console.log('   • Token limit: Unlimited');
  console.log('   • System prompt: Unlimited');
  console.log('   • Local development only');
  console.log('   • Port: 8004');
  console.log('');
  return server;
}

// Demo function that shows all configurations
async function demonstrateAllConfigurations() {
  console.log('🎯 tRPC AI Server - Configurable Limits Demo');
  console.log('='.repeat(50));
  console.log('');

  try {
    // Start all servers
    const devServer = await createDevelopmentServer();
    const prodServer = await createProductionServer();
    const enterpriseServer = await createEnterpriseServer();
    const unlimitedServer = await createUnlimitedServer();

    console.log('✅ All servers started successfully!');
    console.log('');
    console.log('🔗 Test endpoints:');
    console.log('   • Development: http://localhost:8001/trpc/ai.health');
    console.log('   • Production:  http://localhost:8002/trpc/ai.health');
    console.log('   • Enterprise:  http://localhost:8003/trpc/ai.health');
    console.log('   • Unlimited:   http://localhost:8004/trpc/ai.health');
    console.log('');
    console.log('📝 Example tRPC client usage:');
    console.log('   const client = createTRPCProxyClient<AppRouter>({');
    console.log('     links: [httpBatchLink({ url: "http://localhost:8001/trpc" })]');
    console.log('   });');
    console.log('   const health = await client.ai.health.query();');
    console.log('');
    console.log('Press Ctrl+C to stop all servers');

    // Keep servers running
    await new Promise(() => {}); // Run forever

  } catch (error) {
    console.error('❌ Error starting servers:', error);
    process.exit(1);
  }
}

// Run demonstration if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  demonstrateAllConfigurations().catch(console.error);
}

export {
  createDevelopmentServer,
  createProductionServer,
  createEnterpriseServer,
  createUnlimitedServer,
  demonstrateAllConfigurations
};