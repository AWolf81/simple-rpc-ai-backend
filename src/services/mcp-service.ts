/**
 * MCP Service - Integrates MCP tools with AI requests
 * 
 * This service provides the integration layer between MCP servers and AI requests,
 * allowing AI systems to use MCP tools for enhanced functionality like documentation
 * search, file system access, and other external tool integrations.
 */

import { MCPRegistryService, MCPToolRequest, MCPToolResponse, MCPTool, MCPServerConfig, PREDEFINED_MCP_SERVERS } from './mcp-registry';
import { EventEmitter } from 'events';

export interface MCPServiceConfig {
  enabledServers?: string[];
  customServers?: MCPServerConfig[];
  autoRegisterPredefined?: boolean;
  toolExecutionTimeout?: number;
  enableRefTools?: boolean;
  enableWebSearch?: boolean;
  enableFilesystemTools?: boolean;
}

export interface AIToolRequest {
  name: string;
  arguments?: Record<string, any>;
  context?: {
    userId?: string;
    requestId?: string;
    systemPrompt?: string;
  };
}

export interface AIToolResponse {
  success: boolean;
  result?: any;
  error?: string;
  toolName: string;
  duration: number;
  serverId: string;
  metadata?: {
    tokensUsed?: number;
    cacheHit?: boolean;
  };
}

export interface MCPToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
  serverId?: string;
}

/**
 * MCP Service - Main service for managing MCP integration
 * 
 * This service manages the lifecycle of MCP servers and provides
 * a clean interface for AI systems to discover and use tools.
 */
export class MCPService extends EventEmitter {
  private registry: MCPRegistryService;
  private config: Required<MCPServiceConfig>;
  private initialized = false;

  constructor(config: MCPServiceConfig = {}) {
    super();
    
    this.config = {
      enabledServers: [],
      customServers: [],
      autoRegisterPredefined: true,
      toolExecutionTimeout: 30000,
      enableRefTools: true,
      enableWebSearch: true,
      enableFilesystemTools: false,
      ...config
    };

    this.registry = new MCPRegistryService({
      defaultTimeout: this.config.toolExecutionTimeout,
      maxRetries: 3
    });

    this.setupRegistryListeners();
  }

  /**
   * Initialize the MCP service
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // Register predefined servers if enabled
      if (this.config.autoRegisterPredefined) {
        await this.registerPredefinedServers();
      }

      // Register custom servers
      for (const serverConfig of this.config.customServers) {
        await this.registry.registerServer(serverConfig);
      }

      this.initialized = true;
      this.emit('initialized');
    } catch (error) {
      this.emit('error', { phase: 'initialization', error });
      throw error;
    }
  }

  /**
   * Register predefined MCP servers based on configuration
   */
  private async registerPredefinedServers(): Promise<void> {
    const serversToRegister = PREDEFINED_MCP_SERVERS.filter(server => {
      // Check specific feature flags
      if (server.id === 'ref-tools' && !this.config.enableRefTools) {
        return false;
      }
      if (server.id === 'web-search' && !this.config.enableWebSearch) {
        return false;
      }
      if (server.id === 'filesystem-tools' && !this.config.enableFilesystemTools) {
        return false;
      }
      
      // Check enabled servers list
      if (this.config.enabledServers.length > 0 && !this.config.enabledServers.includes(server.id)) {
        return false;
      }
      
      return true;
    });

    for (const serverConfig of serversToRegister) {
      try {
        await this.registry.registerServer(serverConfig);
      } catch (error) {
        console.warn(`Failed to register predefined server ${serverConfig.id}:`, error);
        // Continue with other servers even if one fails
      }
    }
  }

  /**
   * Setup event listeners for the registry
   */
  private setupRegistryListeners(): void {
    this.registry.on('serverConnected', (event) => {
      this.emit('serverConnected', event);
    });

    this.registry.on('serverDisconnected', (event) => {
      this.emit('serverDisconnected', event);
    });

    this.registry.on('serverError', (event) => {
      this.emit('serverError', event);
    });

    this.registry.on('toolsDiscovered', (event) => {
      this.emit('toolsDiscovered', event);
    });
  }

  /**
   * Get all available tools in OpenAI function calling format
   */
  getAvailableToolsForAI(): MCPToolDefinition[] {
    const mcpTools = this.registry.getAvailableTools();
    
    return mcpTools.map(tool => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.inputSchema || {
        type: 'object',
        properties: {},
        required: []
      },
      serverId: tool.serverId
    }));
  }

  /**
   * Execute a tool request from an AI system
   */
  async executeToolForAI(request: AIToolRequest): Promise<AIToolResponse> {
    if (!this.initialized) {
      throw new Error('MCP Service not initialized. Call initialize() first.');
    }

    const startTime = Date.now();
    
    try {
      const mcpRequest: MCPToolRequest = {
        name: request.name,
        arguments: request.arguments
      };

      const mcpResponse = await this.registry.executeTool(mcpRequest);
      
      return {
        success: mcpResponse.success,
        result: mcpResponse.result,
        error: mcpResponse.error,
        toolName: request.name,
        duration: Date.now() - startTime,
        serverId: mcpResponse.serverId,
        metadata: {
          cacheHit: false // Could be enhanced with caching
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        toolName: request.name,
        duration: Date.now() - startTime,
        serverId: 'unknown'
      };
    }
  }

  /**
   * Register a custom MCP server
   */
  async addServer(config: MCPServerConfig): Promise<void> {
    await this.registry.registerServer(config);
  }

  /**
   * Remove an MCP server
   */
  async removeServer(serverId: string): Promise<void> {
    await this.registry.unregisterServer(serverId);
  }

  /**
   * Get server status information
   */
  getServerStatus(serverId?: string) {
    return this.registry.getServerStatus(serverId);
  }

  /**
   * Get server configurations
   */
  getServerConfigs() {
    return this.registry.getServerConfigs();
  }

  /**
   * Get specific tools by name or pattern
   */
  findTools(pattern: string | RegExp): MCPTool[] {
    const allTools = this.registry.getAvailableTools();
    
    if (typeof pattern === 'string') {
      return allTools.filter(tool => 
        tool.name.includes(pattern) || 
        tool.description.toLowerCase().includes(pattern.toLowerCase())
      );
    } else {
      return allTools.filter(tool => 
        pattern.test(tool.name) || 
        pattern.test(tool.description)
      );
    }
  }

  /**
   * Get health status of the MCP service
   */
  getHealthStatus() {
    const servers = this.registry.getServerStatus() as any[];
    const tools = this.registry.getAvailableTools();
    
    return {
      initialized: this.initialized,
      serversCount: servers.length,
      connectedServers: servers.filter(s => s.status === 'connected').length,
      availableTools: tools.length,
      servers: servers.map(s => ({
        id: s.id,
        status: s.status,
        toolsCount: s.tools?.length || 0,
        lastSeen: s.lastSeen,
        error: s.error
      }))
    };
  }

  /**
   * Shutdown the MCP service
   */
  async shutdown(): Promise<void> {
    await this.registry.shutdown();
    this.initialized = false;
    this.removeAllListeners();
  }
}

/**
 * Default MCP service instance for simple usage
 */
let _defaultMCPService: MCPService | null = null;

export function getDefaultMCPServiceInstance(): MCPService | null {
  return _defaultMCPService;
}

export function setDefaultMCPServiceInstance(service: MCPService | null): void {
  _defaultMCPService = service;
}

/**
 * Create or get the default MCP service instance
 */
export function getDefaultMCPService(config?: MCPServiceConfig): MCPService {
  if (!_defaultMCPService) {
    _defaultMCPService = new MCPService(config);
  }
  return _defaultMCPService;
}

/**
 * Initialize the default MCP service
 */
export async function initializeDefaultMCPService(config?: MCPServiceConfig): Promise<MCPService> {
  const service = getDefaultMCPService(config);
  await service.initialize();
  return service;
}

/**
 * Utility functions for common MCP operations
 */
export class MCPUtils {
  /**
   * Create a Ref MCP server configuration for documentation search
   */
  static createRefMCPConfig(options: {
    id?: string;
    documentationPaths?: string[];
    remoteDocUrls?: string[];
  } = {}): MCPServerConfig {
    return {
      id: options.id || 'ref-tools-custom',
      name: 'Ref Tools (Custom)',
      description: 'Custom Ref MCP for documentation search',
      type: 'stdio',
      command: 'npx',
      args: ['ref-tools-mcp@latest'],
      env: {
        // Pass documentation paths via environment if needed
        REF_DOCS_PATHS: options.documentationPaths?.join(':') || '',
        REF_REMOTE_URLS: options.remoteDocUrls?.join(',') || ''
      },
      autoRestart: true,
      enabled: true
    };
  }

  /**
   * Create a filesystem MCP server configuration
   */
  static createFilesystemMCPConfig(options: {
    id?: string;
    allowedPaths?: string[];
    readOnly?: boolean;
  } = {}): MCPServerConfig {
    return {
      id: options.id || 'filesystem-custom',
      name: 'Filesystem Access (Custom)',
      description: 'File system access with path restrictions',
      type: 'stdio',
      command: 'npx',
      args: ['@mcp/filesystem'],
      env: {
        ALLOWED_PATHS: options.allowedPaths?.join(':') || process.cwd(),
        READ_ONLY: options.readOnly ? 'true' : 'false'
      },
      autoRestart: true,
      enabled: true
    };
  }

  /**
   * Create an HTTP MCP server configuration
   */
  static createHttpMCPConfig(options: {
    id: string;
    name: string;
    url: string;
    headers?: Record<string, string>;
    description?: string;
  }): MCPServerConfig {
    return {
      id: options.id,
      name: options.name,
      description: options.description || `HTTP MCP server at ${options.url}`,
      type: 'http',
      url: options.url,
      headers: options.headers,
      autoRestart: true,
      enabled: true
    };
  }
}