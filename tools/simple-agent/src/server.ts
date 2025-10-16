/**
 * Server Manager for simple-agent
 *
 * Manages the simple-rpc-ai-backend server instance
 */

const { configManager } = require('./config');

// We'll import from the parent package
type RpcAiServer = any;

export class ServerManager {
  private server: RpcAiServer | null = null;
  private serverModule: any = null;

  async initialize(): Promise<void> {
    try {
      // Dynamically import the parent package
      this.serverModule = await import('../../../src/rpc-ai-server.js');
    } catch (error) {
      console.error('Failed to load simple-rpc-ai-backend:', error);
      throw new Error('Could not load simple-rpc-ai-backend. Make sure it is installed.');
    }
  }

  /**
   * Start the server with configured settings
   */
  async start(): Promise<void> {
    if (this.server) {
      console.log('Server is already running');
      return;
    }

    if (!this.serverModule) {
      await this.initialize();
    }

    const serverConfig = configManager.get('server');
    const provider = configManager.getBestProvider();
    const agentConfig = configManager.get('agent');
    const mcpConfig = configManager.get('mcp');

    console.log(`🤖 Starting simple-agent server...`);
    console.log(`   Provider: ${provider.provider}`);
    console.log(`   Model: ${provider.model}`);

    // Build server configuration
    const config: any = {
      port: serverConfig?.port || 8000,
      serverProviders: [provider.provider],

      // Agent configuration
      agents: {
        enabled: true,
        defaultSDK: agentConfig?.defaultSDK || 'claude-code',
        enableClaudeCode: true,
        enableOpenAI: provider.provider === 'openai',
        claudeCode: {
          enableSkills: agentConfig?.enableSkills !== false,
          skillsDirectory: agentConfig?.skillsDirectory
        }
      },

      // MCP configuration
      mcp: {
        enabled: mcpConfig?.enabled || false,
        transports: {
          http: true,
          stdio: false
        }
      },

      // Protocols
      protocols: {
        jsonRpc: true,
        tRpc: true
      }
    };

    // Set API key in environment
    if (provider.apiKey) {
      if (provider.provider === 'openrouter') {
        process.env.OPENROUTER_API_KEY = provider.apiKey;
      } else if (provider.provider === 'anthropic') {
        process.env.ANTHROPIC_API_KEY = provider.apiKey;
      } else if (provider.provider === 'openai') {
        process.env.OPENAI_API_KEY = provider.apiKey;
      } else if (provider.provider === 'google') {
        process.env.GOOGLE_API_KEY = provider.apiKey;
        process.env.GOOGLE_GENERATIVE_AI_API_KEY = provider.apiKey;
      }
    }

    try {
      this.server = this.serverModule.createRpcAiServer(config);
      await this.server.start();

      console.log(`✅ Server started successfully`);
      console.log(`   JSON-RPC: http://localhost:${config.port}/rpc`);
      console.log(`   tRPC: http://localhost:${config.port}/trpc`);
      console.log(`   Health: http://localhost:${config.port}/health`);
    } catch (error) {
      console.error('Failed to start server:', error);
      throw error;
    }
  }

  /**
   * Stop the server
   */
  async stop(): Promise<void> {
    if (!this.server) {
      return;
    }

    try {
      await this.server.stop();
      this.server = null;
      console.log('✅ Server stopped');
    } catch (error) {
      console.error('Failed to stop server:', error);
      throw error;
    }
  }

  /**
   * Check if server is running
   */
  isRunning(): boolean {
    return this.server !== null;
  }

  /**
   * Get server instance
   */
  getServer(): RpcAiServer | null {
    return this.server;
  }
}

const serverManager = new ServerManager();

module.exports = { ServerManager, serverManager };
