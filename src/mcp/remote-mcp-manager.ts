/**
 * Remote MCP Server Manager
 *
 * Manages connections to multiple remote MCP servers and proxies requests.
 */

import { EventEmitter } from 'events';
import { RemoteMCPClient, RemoteMCPServerConfig, createRemoteMCPClient } from './remote-mcp-client.js';

export interface RemoteMCPManagerConfig {
  servers: RemoteMCPServerConfig[];
  autoConnect?: boolean;
  retryOnFailure?: boolean;
  retryDelay?: number;
  maxRetries?: number;
}

export interface RemoteServerStatus {
  name: string;
  transport: string;
  connected: boolean;
  lastError?: string;
  tools?: any[];
  lastCheck?: Date;
}

export class RemoteMCPManager extends EventEmitter {
  private clients = new Map<string, RemoteMCPClient>();
  private config: Required<RemoteMCPManagerConfig>;
  private serverStatus = new Map<string, RemoteServerStatus>();

  constructor(config: RemoteMCPManagerConfig) {
    super();
    this.config = {
      servers: config.servers || [],
      autoConnect: config.autoConnect ?? true,
      retryOnFailure: config.retryOnFailure ?? true,
      retryDelay: config.retryDelay ?? 5000,
      maxRetries: config.maxRetries ?? 3
    };
  }

  /**
   * Initialize and connect to all configured servers
   */
  async initialize(): Promise<void> {
    for (const serverConfig of this.config.servers) {
      try {
        await this.addServer(serverConfig);
      } catch (error) {
        this.emit('serverError', {
          server: serverConfig.name,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  }

  /**
   * Add a remote MCP server
   */
  async addServer(config: RemoteMCPServerConfig): Promise<void> {
    if (this.clients.has(config.name)) {
      throw new Error(`Server ${config.name} already exists`);
    }

    const client = createRemoteMCPClient(config);

    // Setup event handlers
    client.on('connected', () => {
      this.updateServerStatus(config.name, { connected: true, lastError: undefined });
      this.emit('serverConnected', config.name);
    });

    client.on('disconnected', (code) => {
      this.updateServerStatus(config.name, {
        connected: false,
        lastError: code ? `Exited with code ${code}` : undefined
      });
      this.emit('serverDisconnected', { name: config.name, code });

      // Auto-reconnect if enabled
      if (this.config.retryOnFailure && config.autoStart !== false) {
        setTimeout(() => {
          this.reconnectServer(config.name).catch(() => {
            // Ignore reconnection failures
          });
        }, this.config.retryDelay);
      }
    });

    client.on('error', (error) => {
      this.updateServerStatus(config.name, {
        lastError: error instanceof Error ? error.message : 'Unknown error'
      });
      this.emit('serverError', { server: config.name, error });
    });

    this.clients.set(config.name, client);

    // Initialize status
    this.serverStatus.set(config.name, {
      name: config.name,
      transport: config.transport,
      connected: false,
      lastCheck: new Date()
    });

    // Connect if auto-connect is enabled
    // For HTTP/HTTPS/SSE, autoStart=false just means "don't spawn a process" - still connect
    // For stdio-based (npx, docker), autoStart=false means "don't connect yet"
    const isHttpTransport = config.transport === 'http' || config.transport === 'https' || config.transport === 'sse';
    const shouldConnect = this.config.autoConnect && (isHttpTransport || config.autoStart !== false);

    if (shouldConnect) {
      try {
        await client.connect();

        // Fetch available tools
        const tools = await client.listTools();
        this.updateServerStatus(config.name, { tools: tools.tools || [] });
      } catch (error) {
        // Disconnect the client on failure
        await client.disconnect().catch(() => {});
        this.updateServerStatus(config.name, {
          connected: false,
          lastError: error instanceof Error ? error.message : 'Failed to connect'
        });
        throw error;
      }
    }
  }

  /**
   * Remove a remote MCP server
   */
  async removeServer(name: string): Promise<void> {
    const client = this.clients.get(name);
    if (!client) {
      throw new Error(`Server ${name} not found`);
    }

    await client.disconnect();
    this.clients.delete(name);
    this.serverStatus.delete(name);

    this.emit('serverRemoved', name);
  }

  /**
   * Reconnect to a server
   */
  private async reconnectServer(name: string, attempt = 1): Promise<void> {
    const client = this.clients.get(name);
    if (!client) {
      return;
    }

    try {
      await client.connect();
      const tools = await client.listTools();
      this.updateServerStatus(name, { tools: tools.tools || [] });
    } catch (error) {
      if (attempt < this.config.maxRetries) {
        setTimeout(() => {
          this.reconnectServer(name, attempt + 1).catch(() => {
            // Final retry failed
          });
        }, this.config.retryDelay * attempt);
      }
    }
  }

  /**
   * Update server status
   */
  private updateServerStatus(name: string, updates: Partial<RemoteServerStatus>): void {
    const current = this.serverStatus.get(name);
    if (current) {
      this.serverStatus.set(name, {
        ...current,
        ...updates,
        lastCheck: new Date()
      });
    }
  }

  /**
   * Get status of all servers
   */
  getServerStatus(): RemoteServerStatus[] {
    return Array.from(this.serverStatus.values());
  }

  /**
   * Get a specific server client
   */
  getServer(name: string): RemoteMCPClient | undefined {
    return this.clients.get(name);
  }

  /**
   * Call a tool on a specific server
   */
  async callTool(serverName: string, toolName: string, args: any): Promise<any> {
    const client = this.clients.get(serverName);
    if (!client) {
      throw new Error(`Server ${serverName} not found`);
    }

    if (!client.isConnected()) {
      throw new Error(`Server ${serverName} is not connected`);
    }

    return client.callTool(toolName, args);
  }

  /**
   * List all available tools across all servers
   */
  async listAllTools(): Promise<Map<string, any[]>> {
    const toolsByServer = new Map<string, any[]>();

    for (const [name, client] of this.clients) {
      if (client.isConnected()) {
        try {
          const result = await client.listTools();
          toolsByServer.set(name, result.tools || []);
        } catch (error) {
          this.emit('serverError', {
            server: name,
            error: error instanceof Error ? error.message : 'Failed to list tools'
          });
        }
      }
    }

    return toolsByServer;
  }

  /**
   * Disconnect from all servers
   */
  async shutdown(): Promise<void> {
    const disconnectPromises = Array.from(this.clients.values()).map(client =>
      client.disconnect().catch(() => {
        // Ignore disconnect errors during shutdown
      })
    );

    await Promise.all(disconnectPromises);
    this.clients.clear();
    this.serverStatus.clear();

    this.emit('shutdown');
  }

  /**
   * Get all connected servers
   */
  getConnectedServers(): string[] {
    return Array.from(this.clients.entries())
      .filter(([_, client]) => client.isConnected())
      .map(([name]) => name);
  }

  /**
   * Check if a server is connected
   */
  isServerConnected(name: string): boolean {
    const client = this.clients.get(name);
    return client?.isConnected() ?? false;
  }
}

/**
 * Create a remote MCP manager
 */
export function createRemoteMCPManager(config: RemoteMCPManagerConfig): RemoteMCPManager {
  return new RemoteMCPManager(config);
}
