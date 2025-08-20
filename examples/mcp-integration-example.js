/**
 * MCP Integration Example
 * 
 * This example demonstrates how to use the Model Context Protocol (MCP) 
 * integration with the Simple RPC AI Backend to add documentation search
 * and URL reading capabilities to your AI applications.
 */

import { 
  createRpcAiServer,
  MCPService,
  RefMCPIntegration,
  VSCodeRefIntegration,
  MCPAIService,
  createTypedAIClient
} from 'simple-rpc-ai-backend';
import { httpBatchLink } from '@trpc/client';

/**
 * Example 1: Basic MCP Service Usage
 */
async function basicMCPExample() {
  console.log('🔧 Basic MCP Service Example');
  
  // Create and initialize MCP service
  const mcpService = new MCPService({
    enableRefTools: true,
    enableFilesystemTools: false, // Disabled for security
    autoRegisterPredefined: true
  });

  try {
    await mcpService.initialize();
    console.log('✅ MCP Service initialized');

    // Get available tools
    const tools = mcpService.getAvailableToolsForAI();
    console.log(`📝 Available tools: ${tools.map(t => t.name).join(', ')}`);

    // Test a documentation search tool
    if (tools.some(tool => tool.name === 'ref_search_documentation')) {
      const result = await mcpService.executeToolForAI({
        name: 'ref_search_documentation',
        arguments: {
          query: 'javascript async functions',
          max_results: 5
        }
      });

      if (result.success) {
        console.log('🔍 Search results:', result.result);
      } else {
        console.log('❌ Search failed:', result.error);
      }
    }

    // Get service health
    const health = mcpService.getHealthStatus();
    console.log('💚 MCP Health:', health);

  } catch (error) {
    console.error('❌ MCP Service error:', error);
  } finally {
    await mcpService.shutdown();
  }
}

/**
 * Example 2: Ref MCP Integration for Documentation
 */
async function refMCPExample() {
  console.log('\n📚 Ref MCP Integration Example');

  // Configure Ref MCP for documentation search
  const refIntegration = new RefMCPIntegration({
    enabled: true,
    documentationPaths: [
      './docs',
      './README.md',
      './CHANGELOG.md'
    ],
    remoteDocUrls: [
      'https://nodejs.org/api/',
      'https://developer.mozilla.org/en-US/docs/Web/JavaScript'
    ],
    githubRepos: [
      {
        owner: 'microsoft',
        repo: 'vscode-extension-samples',
        branch: 'main',
        paths: ['README.md', 'docs/']
      }
    ]
  });

  try {
    await refIntegration.initialize();
    console.log('✅ Ref MCP Integration initialized');

    // Search for documentation
    const searchResult = await refIntegration.searchDocumentation({
      query: 'VS Code extension API TreeDataProvider',
      scope: 'all',
      maxResults: 5
    });

    if (searchResult.success) {
      console.log(`🔍 Found ${searchResult.totalResults} documentation results:`);
      searchResult.results?.forEach((result, index) => {
        console.log(`  ${index + 1}. ${result.title} (${result.type})`);
        console.log(`     ${result.excerpt.substring(0, 100)}...`);
      });
    }

    // Read a URL
    const urlResult = await refIntegration.readURL({
      url: 'https://code.visualstudio.com/api/extension-guides/tree-view',
      format: 'markdown'
    });

    if (urlResult.success) {
      console.log('📄 URL content preview:');
      console.log(urlResult.content?.substring(0, 200) + '...');
      console.log(`📊 Stats: ${urlResult.metadata?.wordCount} words`);
    }

    // Search for code examples
    const codeResult = await refIntegration.searchCodeExamples('typescript', 'extension commands');
    console.log(`💻 Found ${codeResult.totalResults} code examples`);

    // Search API documentation
    const apiResult = await refIntegration.searchAPIDocumentation('vscode.window', 'showInformationMessage');
    console.log(`📖 Found ${apiResult.totalResults} API documentation entries`);

  } catch (error) {
    console.error('❌ Ref MCP error:', error);
  } finally {
    await refIntegration.shutdown();
  }
}

/**
 * Example 3: VS Code Workspace Integration
 */
async function vscodeIntegrationExample() {
  console.log('\n🆚 VS Code Integration Example');

  // Create workspace-specific Ref integration
  const workspacePath = process.cwd();
  const vscodeIntegration = VSCodeRefIntegration.createForWorkspace(workspacePath, {
    remoteDocUrls: [
      'https://code.visualstudio.com/api',
      'https://code.visualstudio.com/docs'
    ]
  });

  try {
    await vscodeIntegration.initialize();
    console.log('✅ VS Code integration initialized');

    // Search VS Code API
    const apiSearch = await VSCodeRefIntegration.searchVSCodeAPI(vscodeIntegration, 'TreeDataProvider');
    console.log(`🔍 VS Code API search: ${apiSearch.totalResults} results`);

    // Get extension documentation
    const extensionDocs = await VSCodeRefIntegration.getExtensionDocs(vscodeIntegration, 'ms-python.python');
    if (extensionDocs.success) {
      console.log(`📦 Extension docs: ${extensionDocs.title}`);
    }

    // Get status
    const status = vscodeIntegration.getStatus();
    console.log('📊 Integration status:', {
      initialized: status.initialized,
      servers: status.mcpStatus.serversCount,
      tools: status.mcpStatus.availableTools
    });

  } catch (error) {
    console.error('❌ VS Code integration error:', error);
  } finally {
    await vscodeIntegration.shutdown();
  }
}

/**
 * Example 4: MCP-Enhanced AI Service
 */
async function mcpAIServiceExample() {
  console.log('\n🤖 MCP-Enhanced AI Service Example');

  // Create AI service with MCP tools
  const aiService = new MCPAIService({
    provider: 'anthropic',
    serviceProviders: [{
      name: 'anthropic',
      apiKey: process.env.ANTHROPIC_API_KEY || 'your-api-key',
      priority: 1
    }],
    enableMCPTools: true,
    mcp: {
      enableRefTools: true,
      autoRegisterPredefined: true
    }
  });

  try {
    await aiService.initialize();
    console.log('✅ MCP-Enhanced AI Service initialized');

    // Get available MCP tools
    const tools = aiService.getAvailableMCPTools();
    console.log(`🛠️ Available MCP tools: ${tools.map(t => t.name).join(', ')}`);

    // Execute AI request with tools enabled
    const result = await aiService.execute({
      content: 'Help me understand how to create a VS Code extension with a tree view. Search for relevant documentation and code examples.',
      systemPrompt: 'You are a helpful VS Code extension development assistant. Use the available tools to search for documentation and examples to provide comprehensive help.',
      tools: {
        enabled: true,
        whitelist: ['ref_search_documentation', 'ref_read_url'] // Only allow specific tools
      }
    });

    if (result.content) {
      console.log('🎯 AI Response with MCP tools:');
      console.log(result.content.substring(0, 300) + '...');
      
      if (result.toolCalls && result.toolCalls.length > 0) {
        console.log(`🔧 Used ${result.totalToolCalls} tool calls:`);
        result.toolCalls.forEach((call, index) => {
          console.log(`  ${index + 1}. ${call.name} (${call.success ? '✅' : '❌'}) - ${call.duration}ms`);
        });
      }
    }

    // Test a specific tool
    const toolTest = await aiService.testMCPTool('ref_search_documentation', {
      query: 'vscode extension activation',
      max_results: 3
    });
    console.log('🧪 Tool test result:', toolTest.success ? 'Success' : 'Failed');

  } catch (error) {
    console.error('❌ MCP AI Service error:', error);
  } finally {
    await aiService.shutdown();
  }
}

/**
 * Example 5: Server with MCP Router
 */
async function serverWithMCPExample() {
  console.log('\n🌐 Server with MCP Router Example');

  // Create server with MCP router enabled
  const server = createRpcAiServer({
    ai: {
      serviceProviders: ['anthropic'],
      byokProviders: ['anthropic', 'openai', 'google']
    },
    mcp: {
      enableMCP: true,
      defaultConfig: {
        enableRefTools: true,
        enableFilesystemTools: false
      }
    },
    server: {
      port: 8000,
      cors: { origin: true }
    }
  });

  try {
    await server.start();
    console.log('✅ Server with MCP support started on port 8000');

    // Create a client to test MCP endpoints
    const client = createTypedAIClient({
      links: [
        httpBatchLink({
          url: 'http://localhost:8000/trpc'
        })
      ]
    });

    // Test MCP health
    const health = await client.mcp.health.query();
    console.log('💚 MCP Health:', health);

    // List available MCP tools
    const tools = await client.mcp.listTools.query({});
    console.log(`🛠️ Available tools: ${tools.tools.length}`);

    // Test documentation search (if available)
    if (tools.tools.some(tool => tool.name.includes('search'))) {
      const searchResult = await client.mcp.searchDocumentation.mutate({
        query: 'nodejs streams',
        maxResults: 3
      });
      console.log(`🔍 Documentation search: ${searchResult.totalResults} results`);
    }

    // Get server status
    const servers = await client.mcp.listServers.query();
    console.log(`🖥️ MCP servers: ${servers.servers.length} registered`);

    console.log('\n📖 MCP endpoints available:');
    console.log('  - GET  /trpc/mcp.health - Check MCP health');
    console.log('  - POST /trpc/mcp.listTools - List available tools');
    console.log('  - POST /trpc/mcp.searchDocumentation - Search docs');
    console.log('  - POST /trpc/mcp.readURL - Read URL content');
    console.log('  - POST /trpc/mcp.searchCodeExamples - Find code examples');
    console.log('  - And more...');

  } catch (error) {
    console.error('❌ Server error:', error);
  } finally {
    console.log('\n🛑 Stopping server...');
    process.exit(0);
  }
}

/**
 * Example 6: Custom MCP Server Configuration
 */
async function customMCPServerExample() {
  console.log('\n⚙️ Custom MCP Server Example');

  const mcpService = new MCPService({
    autoRegisterPredefined: false, // Don't auto-register predefined servers
    customServers: [
      {
        id: 'custom-docs',
        name: 'Custom Documentation Server',
        type: 'stdio',
        command: 'npx',
        args: ['ref-tools-mcp@latest'],
        env: {
          REF_DOCS_PATHS: './docs:./examples',
          REF_INCLUDE_MARKDOWN: 'true'
        },
        enabled: true
      },
      {
        id: 'api-server',
        name: 'API Documentation Server',
        type: 'http',
        url: 'http://localhost:3001/mcp',
        headers: {
          'Authorization': 'Bearer your-token'
        },
        enabled: false // Disabled by default
      }
    ]
  });

  try {
    await mcpService.initialize();
    console.log('✅ Custom MCP configuration initialized');

    // Get server status
    const status = mcpService.getServerStatus();
    console.log('📊 Server status:', status);

    // Add a server dynamically
    await mcpService.addServer({
      id: 'dynamic-server',
      name: 'Dynamic Server',
      type: 'stdio',
      command: 'echo',
      args: ['{"jsonrpc":"2.0","result":{"tools":[]}}'],
      enabled: true
    });

    console.log('✅ Dynamic server added');

  } catch (error) {
    console.error('❌ Custom MCP error:', error);
  } finally {
    await mcpService.shutdown();
  }
}

/**
 * Run all examples
 */
async function runExamples() {
  console.log('🚀 MCP Integration Examples\n');
  
  try {
    await basicMCPExample();
    await refMCPExample();
    await vscodeIntegrationExample();
    await mcpAIServiceExample();
    await customMCPServerExample();
    
    // Note: Server example is commented out as it would block
    // Uncomment the next line to test the server
    // await serverWithMCPExample();
    
  } catch (error) {
    console.error('❌ Example error:', error);
  }
  
  console.log('\n✅ All examples completed!');
  console.log('\n📚 Next steps:');
  console.log('  1. Install ref-tools-mcp: npm install -g ref-tools-mcp@latest');
  console.log('  2. Set up your API keys in environment variables');
  console.log('  3. Configure documentation paths for your project');
  console.log('  4. Integrate MCP tools into your AI workflows');
}

// Run examples if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runExamples().catch(console.error);
}

export {
  basicMCPExample,
  refMCPExample,
  vscodeIntegrationExample,
  mcpAIServiceExample,
  serverWithMCPExample,
  customMCPServerExample
};