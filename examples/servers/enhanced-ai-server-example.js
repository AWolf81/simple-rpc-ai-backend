/**
 * Enhanced AI Server Example
 * 
 * Demonstrates fast XML/JSON parsing, context management, and 
 * agent-like orchestration capabilities.
 */

import { createAIServerAsync } from '../../src/server.js';
import { ContextManager } from '../../src/services/context-manager.js';
import { ResponseParser } from '../../src/services/response-parser.js';
import { OrchestrationEngine } from '../../src/services/orchestration-engine.js';

// Enhanced server configuration with XML/JSON parsing
const config = {
  port: 8001,
  mode: 'hybrid',
  serviceProviders: {
    anthropic: {
      apiKey: process.env.ANTHROPIC_API_KEY || '',
      priority: 1,
      model: 'claude-3-5-sonnet-20241022'
    },
    openai: {
      apiKey: process.env.OPENAI_API_KEY || '',
      priority: 2,
      model: 'gpt-4o'
    }
  },
  
  // Enhanced system prompts with XML format specification
  systemPrompts: {
    'analyze-code-xml': {
      content: `You are a code analysis expert. Analyze the provided code and respond in XML format.

Your response MUST be valid XML with this structure:
<analysis>
  <summary>Brief overview of the code</summary>
  <quality_score>1-10</quality_score>
  <issues>
    <issue severity="high|medium|low">Description</issue>
  </issues>
  <recommendations>
    <recommendation>Specific improvement suggestion</recommendation>
  </recommendations>
  <complexity>
    <cyclomatic>Number</cyclomatic>
    <cognitive>Number</cognitive>
  </complexity>
</analysis>

Focus on code quality, potential bugs, performance issues, and maintainability.`,
      variables: ['language'],
      category: 'code-analysis',
      version: '2.0'
    },
    
    'security-review-xml': {
      content: `You are a security expert. Analyze the code for security vulnerabilities and respond in XML format.

Your response MUST be valid XML with this structure:
<security_review>
  <risk_level>low|medium|high|critical</risk_level>
  <vulnerabilities>
    <vulnerability>
      <type>SQL Injection|XSS|CSRF|etc</type>
      <severity>low|medium|high|critical</severity>
      <location>Line numbers or function names</location>
      <description>Detailed description</description>
      <fix>How to fix this issue</fix>
    </vulnerability>
  </vulnerabilities>
  <compliance>
    <owasp_top10>List any OWASP Top 10 issues found</owasp_top10>
    <best_practices>Security best practices violations</best_practices>
  </compliance>
  <recommendations>
    <recommendation>Specific security improvements</recommendation>
  </recommendations>
</security_review>`,
      category: 'security',
      version: '2.0'
    },

    'generate-tests-xml': {
      content: `Generate comprehensive tests for the provided code. Respond in XML format.

Your response MUST be valid XML with this structure:
<test_generation>
  <framework>{framework}</framework>
  <test_type>{test_type}</test_type>
  <coverage_areas>
    <area>Function/feature being tested</area>
  </coverage_areas>
  <test_code><![CDATA[
// Complete test code here
]]></test_code>
  <test_cases>
    <case>
      <name>Test case name</name>
      <description>What this test validates</description>
      <type>unit|integration|e2e</type>
    </case>
  </test_cases>
</test_generation>

Generate {test_type} tests using {framework} framework.`,
      variables: ['test_type', 'framework'],
      category: 'testing',
      version: '2.0'
    }
  }
};

async function startEnhancedServer() {
  console.log('🚀 Starting Enhanced AI Server with XML/JSON parsing...');
  
  // Create the server with async prompt loading
  const server = await createAIServerAsync(config);
  
  // Initialize enhanced services
  const contextManager = new ContextManager();
  const responseParser = new ResponseParser();
  const orchestrationEngine = new OrchestrationEngine(
    server.functionRegistry,
    contextManager,
    server.app.locals.aiService // Access AI service from server
  );

  // Add custom RPC methods for enhanced features
  server.app.post('/rpc', async (req, res, next) => {
    const { method, params, id } = req.body;
    
    try {
      let result;

      switch (method) {
        case 'parseResponse':
          // Parse XML/JSON response
          result = await responseParser.parse(params.content, {
            format: params.format,
            streaming: params.streaming
          });
          break;

        case 'createContext':
          // Create platform-specific context
          switch (params.platform) {
            case 'vscode':
              result = ContextManager.fromVSCodeSelection(params.editor, params.selection);
              break;
            case 'web':
              result = ContextManager.fromWebInput(params.content, params.metadata);
              break;
            case 'cli':
              result = ContextManager.fromFile(params.filePath, params.content, params.metadata);
              break;
            case 'url':
              result = ContextManager.fromURL(params.url, params.content, params.metadata);
              break;
            default:
              throw new Error(`Unsupported platform: ${params.platform}`);
          }
          break;

        case 'executeWorkflow':
          // Execute agent-like workflow
          const context = ContextManager.fromWebInput(params.content, params.metadata);
          result = await orchestrationEngine.executeWorkflow(
            params.workflowId,
            context,
            params.parameters
          );
          break;

        case 'listWorkflows':
          // List available workflows
          result = orchestrationEngine.listWorkflows();
          break;

        case 'getExecution':
          // Get workflow execution status
          result = orchestrationEngine.getExecution(params.executionId);
          break;

        case 'addToConversation':
          // Add message to conversation history
          contextManager.addToConversation(
            params.conversationId,
            params.role,
            params.content,
            params.context,
            params.tokenCount
          );
          result = { success: true };
          break;

        case 'getConversationHistory':
          // Get conversation history
          result = contextManager.getConversationHistory(params.conversationId);
          break;

        case 'enhancedAIRequest':
          // Enhanced AI request with XML/JSON parsing and context
          const requestContext = params.context || ContextManager.fromWebInput(params.content);
          
          // Execute AI request with format specification
          const aiResponse = await server.app.locals.aiService.execute({
            content: params.content,
            systemPrompt: params.systemPrompt + '\n\n' + 
              ResponseParser.generateFormatPrompt(requestContext.metadata?.responseFormat || 'xml'),
            metadata: {
              ...params.metadata,
              enhanced: true,
              format: requestContext.metadata?.responseFormat || 'xml'
            }
          });

          // Parse the response
          const parsed = await responseParser.parse(aiResponse.content, {
            format: requestContext.metadata?.responseFormat || 'xml'
          });

          result = {
            ...aiResponse,
            parsed: parsed.data,
            format: parsed.format,
            context: requestContext
          };
          break;

        default:
          // Fall back to original handler
          return next();
      }

      res.json({ id, result });
    } catch (error) {
      res.status(500).json({
        id,
        error: {
          code: -32603,
          message: 'Internal error',
          data: error.message
        }
      });
    }
  });

  // Start the server
  const httpServer = server.start();

  // Example usage demonstrations
  setTimeout(async () => {
    console.log('\n📝 Enhanced AI Server Features:');
    console.log('1. Fast XML/JSON parsing with streaming support');
    console.log('2. Platform-agnostic context management');
    console.log('3. Agent-like workflow orchestration');
    console.log('4. Conversation history management');
    console.log('5. Enhanced AI requests with structured responses');
    
    console.log('\n🔧 Available RPC Methods:');
    console.log('- parseResponse: Parse XML/JSON with streaming');
    console.log('- createContext: Create platform-specific context');
    console.log('- executeWorkflow: Run agent-like workflows');
    console.log('- enhancedAIRequest: AI request with structured parsing');
    console.log('- addToConversation: Manage conversation history');
    
    console.log('\n🤖 Built-in Workflows:');
    console.log('- complete-code-review: Comprehensive code analysis');
    console.log('- dev-pipeline: Full development pipeline');
    
    console.log('\n📡 Example JSON-RPC calls:');
    
    // Example: Enhanced AI Request with XML parsing
    console.log('\n1. Enhanced AI Request:');
    console.log(JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'enhancedAIRequest',
      params: {
        content: 'function add(a, b) { return a + b; }',
        systemPrompt: 'Analyze this JavaScript function',
        context: {
          type: 'file',
          metadata: {
            fileName: 'math.js',
            language: 'javascript',
            responseFormat: 'xml'
          }
        }
      }
    }, null, 2));

    // Example: Workflow execution
    console.log('\n2. Execute Workflow:');
    console.log(JSON.stringify({
      jsonrpc: '2.0',
      id: 2,
      method: 'executeWorkflow',
      params: {
        workflowId: 'complete-code-review',
        content: 'class User { constructor(name) { this.name = name; } }',
        metadata: {
          fileName: 'user.js',
          language: 'javascript'
        }
      }
    }, null, 2));

    // Example: Response parsing
    console.log('\n3. Parse Response:');
    console.log(JSON.stringify({
      jsonrpc: '2.0',
      id: 3,
      method: 'parseResponse',
      params: {
        content: '<analysis><summary>Good code</summary><quality_score>8</quality_score></analysis>',
        format: 'xml',
        streaming: false
      }
    }, null, 2));

  }, 1000);

  return httpServer;
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down Enhanced AI Server...');
  process.exit(0);
});

// Start the server
startEnhancedServer().catch(console.error);