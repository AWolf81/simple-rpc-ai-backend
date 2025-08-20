/**
 * VS Code Extension MCP Integration Example
 * 
 * This example shows how to integrate MCP (Model Context Protocol) 
 * functionality into a VS Code extension for documentation search
 * and enhanced AI assistance.
 */

import {
  MCPService,
  RefMCPIntegration,
  VSCodeRefIntegration,
  createTypedAIClient
} from 'simple-rpc-ai-backend';
import { httpBatchLink } from '@trpc/client';

/**
 * VS Code Extension Context (simplified mock)
 */
class VSCodeExtensionMock {
  constructor() {
    this.workspaceFolder = '/path/to/workspace';
    this.extensionPath = '/path/to/extension';
  }

  showInformationMessage(message) {
    console.log(`💬 VS Code Info: ${message}`);
  }

  showErrorMessage(message) {
    console.log(`❌ VS Code Error: ${message}`);
  }

  showQuickPick(items, options) {
    console.log(`📋 VS Code Quick Pick: ${items.length} items`);
    return Promise.resolve(items[0]); // Mock selection
  }
}

/**
 * MCP-Enhanced VS Code Extension
 */
class MCPVSCodeExtension {
  constructor(context) {
    this.context = context;
    this.mcpClient = null;
    this.refIntegration = null;
    this.aiClient = null;
  }

  /**
   * Activate the extension with MCP support
   */
  async activate() {
    try {
      console.log('🔌 Activating VS Code extension with MCP support...');

      // Initialize MCP integration for workspace
      this.refIntegration = VSCodeRefIntegration.createForWorkspace(
        this.context.workspaceFolder,
        {
          documentationPaths: [
            `${this.context.workspaceFolder}/docs`,
            `${this.context.workspaceFolder}/README.md`,
            `${this.context.workspaceFolder}/.vscode`
          ],
          remoteDocUrls: [
            'https://code.visualstudio.com/api',
            'https://nodejs.org/api/'
          ],
          githubRepos: [
            {
              owner: 'microsoft',
              repo: 'vscode-extension-samples',
              branch: 'main'
            }
          ]
        }
      );

      await this.refIntegration.initialize();
      console.log('✅ Ref MCP integration initialized');

      // Connect to AI backend with MCP support
      this.aiClient = createTypedAIClient({
        links: [
          httpBatchLink({
            url: 'http://localhost:8000/trpc',
            headers: {
              'x-vscode-extension': 'true',
              'x-workspace-path': this.context.workspaceFolder
            }
          })
        ]
      });

      // Test connection
      const health = await this.aiClient.mcp.health.query();
      if (health.enabled) {
        console.log('✅ Connected to MCP-enabled AI backend');
      }

      this.context.showInformationMessage('MCP Extension activated successfully!');
      
    } catch (error) {
      console.error('❌ Extension activation failed:', error);
      this.context.showErrorMessage(`MCP Extension activation failed: ${error.message}`);
    }
  }

  /**
   * Command: Search Documentation
   */
  async searchDocumentation(query) {
    try {
      if (!this.refIntegration) {
        throw new Error('MCP integration not initialized');
      }

      console.log(`🔍 Searching documentation for: ${query}`);

      const result = await this.refIntegration.searchDocumentation({
        query,
        scope: 'all',
        maxResults: 10
      });

      if (result.success && result.results) {
        console.log(`📚 Found ${result.totalResults} documentation results:`);
        
        result.results.forEach((doc, index) => {
          console.log(`  ${index + 1}. ${doc.title} (${doc.type})`);
          console.log(`     Source: ${doc.source}`);
          console.log(`     ${doc.excerpt.substring(0, 100)}...`);
        });

        // Show results in VS Code quick pick
        const items = result.results.map(doc => ({
          label: doc.title,
          description: doc.excerpt.substring(0, 100) + '...',
          detail: `${doc.type} - ${doc.source}`,
          data: doc
        }));

        const selected = await this.context.showQuickPick(items, {
          placeHolder: 'Select documentation to view'
        });

        if (selected && selected.data.url) {
          console.log(`📖 Opening: ${selected.data.url}`);
          // In real VS Code extension, you would open the URL or file
        }

        return result;
      } else {
        throw new Error(result.error || 'No results found');
      }

    } catch (error) {
      console.error('❌ Documentation search failed:', error);
      this.context.showErrorMessage(`Documentation search failed: ${error.message}`);
    }
  }

  /**
   * Command: Get API Documentation
   */
  async getAPIDocumentation(apiName, method = null) {
    try {
      if (!this.refIntegration) {
        throw new Error('MCP integration not initialized');
      }

      console.log(`📖 Getting API documentation for: ${apiName}${method ? `.${method}` : ''}`);

      const result = await this.refIntegration.searchAPIDocumentation(apiName, method);

      if (result.success && result.results) {
        console.log(`📋 Found ${result.totalResults} API documentation entries`);
        
        // Show first result details
        if (result.results.length > 0) {
          const firstResult = result.results[0];
          console.log(`📄 ${firstResult.title}`);
          console.log(`   ${firstResult.excerpt}`);
          
          if (firstResult.url) {
            // Read full documentation
            const urlResult = await this.refIntegration.readURL({
              url: firstResult.url,
              format: 'markdown'
            });
            
            if (urlResult.success) {
              console.log(`📝 Full documentation preview:`);
              console.log(urlResult.content?.substring(0, 500) + '...');
            }
          }
        }

        return result;
      } else {
        throw new Error(result.error || 'No API documentation found');
      }

    } catch (error) {
      console.error('❌ API documentation failed:', error);
      this.context.showErrorMessage(`API documentation failed: ${error.message}`);
    }
  }

  /**
   * Command: Find Code Examples
   */
  async findCodeExamples(language, topic) {
    try {
      if (!this.refIntegration) {
        throw new Error('MCP integration not initialized');
      }

      console.log(`💻 Finding ${language} code examples for: ${topic}`);

      const result = await this.refIntegration.searchCodeExamples(language, topic);

      if (result.success && result.results) {
        console.log(`🔍 Found ${result.totalResults} code examples`);
        
        result.results.forEach((example, index) => {
          console.log(`  ${index + 1}. ${example.title}`);
          console.log(`     ${example.excerpt.substring(0, 150)}...`);
        });

        return result;
      } else {
        throw new Error(result.error || 'No code examples found');
      }

    } catch (error) {
      console.error('❌ Code example search failed:', error);
      this.context.showErrorMessage(`Code example search failed: ${error.message}`);
    }
  }

  /**
   * Command: AI Assistant with MCP Tools
   */
  async aiAssistantWithMCP(userQuery) {
    try {
      if (!this.aiClient) {
        throw new Error('AI client not initialized');
      }

      console.log(`🤖 AI Assistant query: ${userQuery}`);

      // Execute AI request with MCP tools enabled
      const result = await this.aiClient.ai.executeAIRequest.mutate({
        content: userQuery,
        systemPrompt: `You are a helpful VS Code extension development assistant. 
        You have access to documentation search tools to provide accurate, up-to-date information.
        Use the available tools to search for relevant documentation, API references, and code examples.
        
        When answering questions about VS Code development:
        1. Search for official VS Code API documentation
        2. Look for relevant code examples
        3. Provide specific, actionable guidance
        4. Include links to official documentation when possible`,
        options: {
          maxTokens: 2000
        }
      });

      if (result.success && result.data) {
        console.log('🎯 AI Response:');
        console.log(result.data.content.substring(0, 500) + '...');
        
        if (result.toolCalls && result.toolCalls.length > 0) {
          console.log(`🔧 Used ${result.totalToolCalls} MCP tool calls:`);
          result.toolCalls.forEach((call, index) => {
            console.log(`  ${index + 1}. ${call.name} (${call.success ? '✅' : '❌'})`);
          });
        }

        // Show response in VS Code
        this.context.showInformationMessage('AI response generated with MCP tools!');
        
        return result.data;
      } else {
        throw new Error(result.error || 'AI request failed');
      }

    } catch (error) {
      console.error('❌ AI assistant failed:', error);
      this.context.showErrorMessage(`AI assistant failed: ${error.message}`);
    }
  }

  /**
   * Command: Workspace Documentation Analysis
   */
  async analyzeWorkspaceDocumentation() {
    try {
      if (!this.refIntegration) {
        throw new Error('MCP integration not initialized');
      }

      console.log('📊 Analyzing workspace documentation...');

      // Search for common documentation topics in the workspace
      const topics = [
        'installation',
        'configuration',
        'API reference',
        'getting started',
        'examples'
      ];

      const results = {};
      
      for (const topic of topics) {
        const result = await this.refIntegration.searchLocalDocs(
          topic,
          this.context.workspaceFolder
        );
        
        results[topic] = result.totalResults;
        console.log(`  ${topic}: ${result.totalResults} documents`);
      }

      // Generate summary
      const totalDocs = Object.values(results).reduce((sum, count) => sum + count, 0);
      console.log(`📋 Analysis complete: ${totalDocs} total documentation pieces found`);

      this.context.showInformationMessage(`Workspace analysis complete: ${totalDocs} docs found`);
      
      return results;

    } catch (error) {
      console.error('❌ Workspace analysis failed:', error);
      this.context.showErrorMessage(`Workspace analysis failed: ${error.message}`);
    }
  }

  /**
   * Get MCP status for debugging
   */
  async getMCPStatus() {
    try {
      const status = {
        refIntegration: this.refIntegration?.getStatus(),
        aiBackend: null
      };

      if (this.aiClient) {
        status.aiBackend = await this.aiClient.mcp.health.query();
      }

      console.log('📊 MCP Status:', JSON.stringify(status, null, 2));
      return status;

    } catch (error) {
      console.error('❌ Status check failed:', error);
      return { error: error.message };
    }
  }

  /**
   * Deactivate extension
   */
  async deactivate() {
    console.log('🔌 Deactivating MCP extension...');

    if (this.refIntegration) {
      await this.refIntegration.shutdown();
      console.log('✅ Ref integration shut down');
    }

    console.log('✅ Extension deactivated');
  }
}

/**
 * Example usage and testing
 */
async function demonstrateVSCodeMCPExtension() {
  console.log('🆚 VS Code MCP Extension Demonstration\n');

  // Mock VS Code context
  const vscodeContext = new VSCodeExtensionMock();
  
  // Create extension instance
  const extension = new MCPVSCodeExtension(vscodeContext);

  try {
    // Activate extension
    await extension.activate();

    // Demonstrate various commands
    console.log('\n1️⃣ Searching Documentation...');
    await extension.searchDocumentation('vscode extension commands');

    console.log('\n2️⃣ Getting API Documentation...');
    await extension.getAPIDocumentation('vscode.window', 'showInformationMessage');

    console.log('\n3️⃣ Finding Code Examples...');
    await extension.findCodeExamples('typescript', 'vscode extension activation');

    console.log('\n4️⃣ AI Assistant with MCP...');
    await extension.aiAssistantWithMCP(
      'How do I create a VS Code extension that provides auto-completion for a custom language?'
    );

    console.log('\n5️⃣ Analyzing Workspace Documentation...');
    await extension.analyzeWorkspaceDocumentation();

    console.log('\n6️⃣ Getting MCP Status...');
    await extension.getMCPStatus();

  } catch (error) {
    console.error('❌ Demonstration failed:', error);
  } finally {
    // Deactivate extension
    await extension.deactivate();
  }

  console.log('\n✅ VS Code MCP Extension demonstration complete!');
}

// Export for use in actual VS Code extensions
export { MCPVSCodeExtension };

// Run demonstration if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  demonstrateVSCodeMCPExtension().catch(console.error);
}