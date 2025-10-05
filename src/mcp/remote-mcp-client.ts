/**
 * Remote MCP Client - Connect to external MCP servers
 *
 * Supports multiple connection types:
 * - uvx: Python packages via UV
 * - npx: Node.js packages via npm
 * - docker: Containerized servers
 * - http/https: Remote web servers
 */

import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';

export type RemoteMCPTransport = 'uvx' | 'npx' | 'docker' | 'http' | 'https';

export interface RemoteMCPServerConfig {
  name: string;
  transport: RemoteMCPTransport;

  // For uvx/npx
  command?: string;
  args?: string[];
  env?: Record<string, string>;

  // For docker
  image?: string;
  containerArgs?: string[];

  // For http/https
  url?: string;
  headers?: Record<string, string>;

  // Authentication
  auth?: {
    type: 'bearer' | 'basic' | 'none';
    token?: string;
    username?: string;
    password?: string;
  };

  // Optional settings
  autoStart?: boolean;
  timeout?: number;
  retries?: number;
}

export interface MCPMessage {
  jsonrpc: '2.0';
  id?: string | number;
  method?: string;
  params?: any;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

export class RemoteMCPClient extends EventEmitter {
  private config: RemoteMCPServerConfig;
  private process: ChildProcess | null = null;
  private connected = false;
  private messageId = 0;
  private pendingRequests = new Map<string | number, {
    resolve: (value: any) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }>();

  constructor(config: RemoteMCPServerConfig) {
    super();
    this.config = config;
  }

  /**
   * Connect to the remote MCP server
   */
  async connect(): Promise<void> {
    if (this.connected) {
      return;
    }

    switch (this.config.transport) {
      case 'uvx':
        await this.connectViaUvx();
        break;
      case 'npx':
        await this.connectViaNpx();
        break;
      case 'docker':
        await this.connectViaDocker();
        break;
      case 'http':
      case 'https':
        await this.connectViaHttp();
        break;
      default:
        throw new Error(`Unsupported transport: ${this.config.transport}`);
    }

    this.connected = true;
    this.emit('connected');
  }

  /**
   * Connect via uvx (Python/UV)
   */
  private async connectViaUvx(): Promise<void> {
    if (!this.config.command) {
      throw new Error('uvx transport requires command');
    }

    const args = ['uvx', this.config.command, ...(this.config.args || [])];

    this.process = spawn(args[0], args.slice(1), {
      env: { ...process.env, ...this.config.env },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    this.setupProcessHandlers();
    await this.waitForReady();
  }

  /**
   * Connect via npx (Node.js)
   */
  private async connectViaNpx(): Promise<void> {
    if (!this.config.command) {
      throw new Error('npx transport requires command');
    }

    const args = ['npx', this.config.command, ...(this.config.args || [])];

    this.process = spawn(args[0], args.slice(1), {
      env: { ...process.env, ...this.config.env },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    this.setupProcessHandlers();
    await this.waitForReady();
  }

  /**
   * Connect via Docker
   */
  private async connectViaDocker(): Promise<void> {
    if (!this.config.image) {
      throw new Error('docker transport requires image');
    }

    const args = [
      'docker', 'run',
      '-i', '--rm',
      ...(this.config.containerArgs || []),
      this.config.image
    ];

    this.process = spawn(args[0], args.slice(1), {
      env: { ...process.env, ...this.config.env },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    this.setupProcessHandlers();
    await this.waitForReady();
  }

  /**
   * Connect via HTTP/HTTPS
   */
  private async connectViaHttp(): Promise<void> {
    if (!this.config.url) {
      throw new Error('http/https transport requires url');
    }

    // HTTP transport doesn't need a process
    // Validate the URL is accessible
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(this.config.headers || {})
      };

      if (this.config.auth) {
        if (this.config.auth.type === 'bearer' && this.config.auth.token) {
          headers['Authorization'] = `Bearer ${this.config.auth.token}`;
        } else if (this.config.auth.type === 'basic' && this.config.auth.username && this.config.auth.password) {
          const credentials = Buffer.from(`${this.config.auth.username}:${this.config.auth.password}`).toString('base64');
          headers['Authorization'] = `Basic ${credentials}`;
        }
      }

      const response = await fetch(this.config.url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: {}
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP connection failed: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      throw new Error(`Failed to connect to ${this.config.url}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Setup process event handlers for stdio-based transports
   */
  private setupProcessHandlers(): void {
    if (!this.process) return;

    let buffer = '';

    this.process.stdout?.on('data', (data: Buffer) => {
      buffer += data.toString();

      // Process complete JSON-RPC messages (line-delimited)
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete line in buffer

      for (const line of lines) {
        if (line.trim()) {
          try {
            const message: MCPMessage = JSON.parse(line);
            this.handleMessage(message);
          } catch (error) {
            this.emit('error', new Error(`Failed to parse message: ${line}`));
          }
        }
      }
    });

    this.process.stderr?.on('data', (data: Buffer) => {
      this.emit('stderr', data.toString());
    });

    this.process.on('exit', (code) => {
      this.connected = false;
      this.emit('disconnected', code);

      // Reject all pending requests
      for (const [id, pending] of this.pendingRequests) {
        clearTimeout(pending.timeout);
        pending.reject(new Error(`Process exited with code ${code}`));
      }
      this.pendingRequests.clear();
    });

    this.process.on('error', (error) => {
      this.emit('error', error);
    });
  }

  /**
   * Handle incoming MCP message
   */
  private handleMessage(message: MCPMessage): void {
    if (message.id !== undefined) {
      // Response to a request
      const pending = this.pendingRequests.get(message.id);
      if (pending) {
        clearTimeout(pending.timeout);
        this.pendingRequests.delete(message.id);

        if (message.error) {
          pending.reject(new Error(message.error.message));
        } else {
          pending.resolve(message.result);
        }
      }
    } else if (message.method) {
      // Notification or request from server
      this.emit('notification', message);
    }
  }

  /**
   * Wait for the server to be ready
   */
  private async waitForReady(timeout: number = 10000): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, timeout);

      // For process-based transports, wait for first output
      if (this.process) {
        const onData = () => {
          clearTimeout(timer);
          this.process?.stdout?.removeListener('data', onData);
          resolve();
        };
        this.process.stdout?.once('data', onData);
      } else {
        // For HTTP, already validated in connectViaHttp
        clearTimeout(timer);
        resolve();
      }
    });
  }

  /**
   * Send a request to the MCP server
   */
  async request(method: string, params?: any): Promise<any> {
    if (!this.connected) {
      throw new Error('Not connected');
    }

    const id = ++this.messageId;
    const message: MCPMessage = {
      jsonrpc: '2.0',
      id,
      method,
      params
    };

    if (this.config.transport === 'http' || this.config.transport === 'https') {
      return this.sendHttpRequest(message);
    } else {
      return this.sendStdioRequest(message);
    }
  }

  /**
   * Send request via HTTP
   */
  private async sendHttpRequest(message: MCPMessage): Promise<any> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(this.config.headers || {})
    };

    if (this.config.auth) {
      if (this.config.auth.type === 'bearer' && this.config.auth.token) {
        headers['Authorization'] = `Bearer ${this.config.auth.token}`;
      } else if (this.config.auth.type === 'basic' && this.config.auth.username && this.config.auth.password) {
        const credentials = Buffer.from(`${this.config.auth.username}:${this.config.auth.password}`).toString('base64');
        headers['Authorization'] = `Basic ${credentials}`;
      }
    }

    const response = await fetch(this.config.url!, {
      method: 'POST',
      headers,
      body: JSON.stringify(message)
    });

    if (!response.ok) {
      throw new Error(`HTTP request failed: ${response.status} ${response.statusText}`);
    }

    const result: MCPMessage = await response.json();

    if (result.error) {
      throw new Error(result.error.message);
    }

    return result.result;
  }

  /**
   * Send request via stdio
   */
  private async sendStdioRequest(message: MCPMessage): Promise<any> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(message.id!);
        reject(new Error('Request timeout'));
      }, this.config.timeout || 30000);

      this.pendingRequests.set(message.id!, { resolve, reject, timeout });

      // Send message as line-delimited JSON
      this.process?.stdin?.write(JSON.stringify(message) + '\n');
    });
  }

  /**
   * Call an MCP tool
   */
  async callTool(name: string, args: any): Promise<any> {
    return this.request('tools/call', { name, arguments: args });
  }

  /**
   * List available tools
   */
  async listTools(): Promise<any> {
    return this.request('tools/list');
  }

  /**
   * Disconnect from the server
   */
  async disconnect(): Promise<void> {
    if (!this.connected) {
      return;
    }

    if (this.process) {
      this.process.kill();
      this.process = null;
    }

    this.connected = false;
    this.emit('disconnected');
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connected;
  }
}

/**
 * Create a remote MCP client from config
 */
export function createRemoteMCPClient(config: RemoteMCPServerConfig): RemoteMCPClient {
  return new RemoteMCPClient(config);
}
