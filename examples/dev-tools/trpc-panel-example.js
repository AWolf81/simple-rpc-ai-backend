#!/usr/bin/env node

/**
 * tRPC Panel Example - Separate Development Server
 * 
 * This example demonstrates how to run the tRPC panel as a separate
 * development server, keeping concerns separated from the main RPC server.
 * 
 * Architecture:
 * - Main RPC server runs on port 8000
 * - Panel development server runs on port 8080  
 * - Clean separation of concerns
 * - Panel excluded from production builds
 */

import { createRpcAiServer, createLocalPanelServer } from '../../dist/index.js';

async function runSeparatePanelExample() {
  console.log('🚀 Starting RPC AI Server + Separate tRPC Panel...\n');

  // 1. Create and start the main RPC AI server on port 8000
  const server = createRpcAiServer({
    port: 8000,
    
    // Enable tRPC for panel integration
    protocols: {
      jsonRpc: false,    // Disable JSON-RPC to focus on tRPC
      tRPC: true         // Enable tRPC endpoint
    },
    
    // Configure providers for testing
    serverProviders: ['anthropic'],
    byokProviders: ['anthropic', 'openai'],
    
    // Use generous limits for development
    aiLimits: {
      content: { maxLength: 500_000 },
      tokens: { maxTokenLimit: 50_000, defaultMaxTokens: 4096 },
      systemPrompt: { maxLength: 20_000 }
    },
    
    // CORS for development
    cors: {
      origin: ['http://localhost:*', 'vscode-webview://*'],
      credentials: true
    }
  });

  try {
    // Start the main server first
    await server.start();
    
    // 2. Create and start the separate panel server on port 8080
    // Access the router from the server for schema introspection
    const panelServer = createLocalPanelServer(server.getRouter(), 8080);
    await panelServer.start();
    
    console.log('\n🎛️ Separate Panel Benefits:');
    console.log('   • Clean Separation: Panel runs independently from main server');
    console.log('   • Different Ports: Main server (8000) + Panel (8080)');
    console.log('   • Development Only: Panel can be started/stopped separately');
    console.log('   • No Production Impact: Zero overhead in production builds');
    console.log('   • Resource Isolation: Panel doesn\'t affect main server performance');
    
    console.log('\n🔗 Available Endpoints:');
    console.log('   📡 Main RPC Server (Port 8000):');
    console.log('      • tRPC API: POST http://localhost:8000/trpc/ai.executeAIRequest');
    console.log('      • Health: GET http://localhost:8000/health');
    console.log('');
    console.log('   🎛️ Development Panel (Port 8080):');
    console.log('      • Panel UI: GET http://localhost:8080/');
    console.log('      • Panel Health: GET http://localhost:8080/health');
    
    console.log('\n✨ Using the Separate Panel:');
    console.log('   1. Open http://localhost:8080/ in your browser');
    console.log('   2. Panel automatically connects to http://localhost:8000/trpc');
    console.log('   3. Browse available procedures in the left sidebar');
    console.log('   4. Test ai.executeAIRequest with these examples:');
    console.log('      • content: "function fibonacci(n) { return n < 2 ? n : fibonacci(n-1) + fibonacci(n-2); }"');
    console.log('      • systemPrompt: "You are a code reviewer. Analyze this function."');
    console.log('      • options: { "maxTokens": 1000, "model": "claude-3-5-sonnet-20241022" }');
    
    console.log('\n🔧 Development Workflow:');
    console.log('   • Start main server: For your application');
    console.log('   • Start panel separately: For API testing');
    console.log('   • Stop panel: When not needed (saves resources)');
    console.log('   • Panel auto-reconnects: When main server restarts');
    
    console.log('\n🏭 Production Deployment:');
    console.log('   • Main server only: Deploy just the RPC server');
    console.log('   • No panel code: Panel server excluded from production');
    console.log('   • Clean architecture: Development tools separate from core logic');
    console.log('   • Security: Panel server never exposed in production');
    
    console.log('\n💡 Pro Tips:');
    console.log('   • Use different terminals for server vs panel');
    console.log('   • Panel updates automatically when router schema changes');
    console.log('   • Set ANTHROPIC_API_KEY to test AI requests');
    console.log('   • Panel supports authentication headers for testing');
    
    console.log('\n▶️  Both servers running! Press Ctrl+C to stop both.\n');
    
    // Graceful shutdown for both servers
    process.on('SIGINT', async () => {
      console.log('\n🛑 Shutting down both servers...');
      await Promise.all([
        server.stop(),
        panelServer.stop()
      ]);
      console.log('✅ Both servers stopped cleanly');
      process.exit(0);
    });
    
  } catch (error) {
    console.error('❌ Failed to start servers:', error.message);
    process.exit(1);
  }
}

// Run the example
runSeparatePanelExample().catch(console.error);