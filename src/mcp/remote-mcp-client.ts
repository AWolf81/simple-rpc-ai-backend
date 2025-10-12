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
import { resolveNodePackageRunner } from '../utils/node-package-runner.js';

export type RemoteMCPTransport = 'uvx' | 'npx' | 'npm-exec' | 'docker' | 'http' | 'https' | 'sse';

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
  prefixToolNames?: boolean;  // Prefix tool names with server name (default: true)
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
  private sseAbortController: AbortController | null = null;  // For SSE connection cancellation
  private sseInitialized = false;  // Track if SSE handshake is complete
  private ssePersistentReader: ReadableStreamDefaultReader<Uint8Array> | null = null;  // Persistent SSE stream reader

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
      case 'npm-exec':
        await this.connectViaNodePackage(this.config.transport);
        break;
      case 'docker':
        await this.connectViaDocker();
        break;
      case 'http':
      case 'https':
        await this.connectViaHttp();
        break;
      case 'sse':
        await this.connectViaSSE();
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
   * Connect via Node-based package runner (npx or npm exec)
   */
  private async connectViaNodePackage(preference: 'npx' | 'npm-exec'): Promise<void> {
    if (!this.config.command) {
      throw new Error(`${preference} transport requires command`);
    }

    const runner = resolveNodePackageRunner(preference);
    const args = [...runner.args, this.config.command, ...(this.config.args || [])];

    this.process = spawn(runner.command, args, {
      env: { ...process.env, ...this.config.env },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    this.setupProcessHandlers();
    await this.waitForReady(this.config.timeout);
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
        'Accept': 'application/json, text/event-stream',  // Required for SSE-capable servers like Smithery
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
          params: {
            protocolVersion: '2024-11-05',
            capabilities: {},
            clientInfo: {
              name: 'simple-rpc-ai-backend-remote-client',
              version: '1.0.0'
            }
          }
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP connection failed: ${response.status} ${response.statusText}`);
      }

      // MCP spec requires sending notifications/initialized after successful initialize
      // This is a notification (no id, no response expected)
      await fetch(this.config.url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'notifications/initialized',
          params: {}
        })
      }).catch(() => {
        // Ignore errors from notification - it's fire-and-forget
      });
    } catch (error) {
      throw new Error(`Failed to connect to ${this.config.url}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Connect via SSE (Server-Sent Events)
   * Used for stateful HTTP-based MCP servers like Smithery
   */
  private async connectViaSSE(): Promise<void> {
    if (!this.config.url) {
      throw new Error('SSE transport requires url');
    }

    console.log(`🔌 [SSE ${this.config.name}] Starting connection to ${this.config.url}`);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',  // Must accept both
        ...(this.config.headers || {})
      };

      console.log(`📋 [SSE ${this.config.name}] Headers:`, Object.keys(headers));

      if (this.config.auth) {
        if (this.config.auth.type === 'bearer' && this.config.auth.token) {
          headers['Authorization'] = `Bearer ${this.config.auth.token}`;
        } else if (this.config.auth.type === 'basic' && this.config.auth.username && this.config.auth.password) {
          const credentials = Buffer.from(`${this.config.auth.username}:${this.config.auth.password}`).toString('base64');
          headers['Authorization'] = `Basic ${credentials}`;
        }
      }

      // Create abort controller for connection management
      this.sseAbortController = new AbortController();

      console.log(`📤 [SSE ${this.config.name}] Sending initialize request...`);

      // Send initialize request and establish SSE stream
      const response = await fetch(this.config.url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: ++this.messageId,  // Use messageId counter to avoid collisions
          method: 'initialize',
          params: {
            protocolVersion: '2024-11-05',
            capabilities: {},
            clientInfo: {
              name: 'simple-rpc-ai-backend-remote-client',
              version: '1.0.0'
            }
          }
        }),
        signal: this.sseAbortController.signal
      });

      console.log(`📥 [SSE ${this.config.name}] Response status: ${response.status} ${response.statusText}`);

      if (!response.ok) {
        const errorBody = await response.text().catch(() => '(unable to read body)');
        console.error(`❌ [SSE ${this.config.name}] Connection failed:`, errorBody);
        throw new Error(`SSE connection failed: ${response.status} ${response.statusText}`);
      }

      // Check if response is SSE stream
      const contentType = response.headers.get('content-type');
      console.log(`📄 [SSE ${this.config.name}] Content-Type: ${contentType}`);

      if (!contentType || !contentType.includes('text/event-stream')) {
        throw new Error(`Expected SSE stream, got: ${contentType}`);
      }

      console.log(`🌊 [SSE ${this.config.name}] Starting SSE stream processing...`);

      // Process the SSE stream
      this.setupSSEStream(response);

      // Wait for initialize response
      console.log(`⏳ [SSE ${this.config.name}] Waiting for initialization...`);
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          console.error(`⏱️ [SSE ${this.config.name}] Initialization timeout`);
          reject(new Error('SSE initialization timeout'));
        }, this.config.timeout || 30000);

        const checkInit = () => {
          if (this.sseInitialized) {
            clearTimeout(timeout);
            console.log(`✅ [SSE ${this.config.name}] Initialized successfully`);
            resolve(undefined);
          } else {
            setTimeout(checkInit, 100);
          }
        };
        checkInit();
      });

    } catch (error) {
      if (this.sseAbortController) {
        this.sseAbortController.abort();
        this.sseAbortController = null;
      }
      console.error(`❌ [SSE ${this.config.name}] Connection error:`, error);
      throw new Error(`Failed to connect via SSE to ${this.config.url}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Setup SSE stream processing
   */
  private async setupSSEStream(response: Response): Promise<void> {
    if (!response.body) {
      throw new Error('No response body for SSE stream');
    }

    const reader = response.body.getReader();
    this.ssePersistentReader = reader;  // Store for persistent connection
    console.log(`💾 [SSE ${this.config.name}] Persistent stream reader stored`);
    const decoder = new TextDecoder();
    let buffer = '';

    const processStream = async () => {
      try {
        console.log(`🔄 [SSE ${this.config.name}] Stream processing started`);
        let eventCount = 0;

        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            console.log(`🛑 [SSE ${this.config.name}] Stream ended (${eventCount} events processed)`);
            this.ssePersistentReader = null;
            this.connected = false;
            this.emit('disconnected');
            break;
          }

          buffer += decoder.decode(value, { stream: true });

          // Process SSE events (format: "data: {json}\n\n")
          const events = buffer.split('\n\n');
          buffer = events.pop() || '';

          for (const event of events) {
            if (!event.trim()) continue;

            eventCount++;

            // Parse SSE data line
            const dataMatch = event.match(/^data: (.+)$/m);
            if (dataMatch) {
              try {
                const message: MCPMessage = JSON.parse(dataMatch[1]);
                console.log(`📨 [SSE ${this.config.name}] Received message:`, {
                  id: message.id,
                  method: message.method,
                  hasError: !!message.error,
                  hasResult: !!message.result
                });

                // Handle initialize response specially
                if (message.result && message.result.serverInfo && !this.sseInitialized) {
                  console.log(`🎯 [SSE ${this.config.name}] Initialize response received, sending notifications/initialized`);
                  this.sseInitialized = true;
                  // Send notifications/initialized
                  await this.sendSSERequest({
                    jsonrpc: '2.0',
                    method: 'notifications/initialized',
                    params: {}
                  });
                }

                this.handleMessage(message);
              } catch (parseError) {
                console.error(`❌ [SSE ${this.config.name}] Failed to parse SSE message:`, dataMatch[1]);
                this.emit('error', new Error(`Failed to parse SSE message: ${dataMatch[1]}`));
              }
            } else {
              console.warn(`⚠️ [SSE ${this.config.name}] Non-data event:`, event.substring(0, 100));
            }
          }
        }
      } catch (error) {
        if (error instanceof Error && error.name !== 'AbortError') {
          console.error(`❌ [SSE ${this.config.name}] Stream error:`, error);
          this.emit('error', error);
          this.connected = false;
          this.emit('disconnected');
        }
      }
    };

    // Start processing stream in background
    processStream();
  }

  /**
   * Send request via SSE (POST to same URL, response via persistent stream)
   */
  private async sendSSERequest(message: MCPMessage): Promise<any> {
    if (!this.config.url) {
      throw new Error('No URL configured for SSE');
    }

    console.log(`📤 [SSE ${this.config.name}] Sending request:`, { method: message.method, id: message.id });

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

    // For notifications (no id), just send and don't wait for response
    if (!message.id) {
      console.log(`📨 [SSE ${this.config.name}] Sending notification (no response expected)`);
      await fetch(this.config.url, {
        method: 'POST',
        headers,
        body: JSON.stringify(message)
      });
      return;
    }

    // For requests with id: POST and wait for response via persistent SSE stream
    console.log(`⏳ [SSE ${this.config.name}] Waiting for response on persistent stream for id=${message.id}`);
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(message.id!);
        reject(new Error('SSE request timeout'));
      }, this.config.timeout || 30000);

      this.pendingRequests.set(message.id!, { resolve, reject, timeout });

      // Send request - response will come via persistent SSE stream (handled in setupSSEStream)
      fetch(this.config.url!, {
        method: 'POST',
        headers,
        body: JSON.stringify(message)
      }).catch(err => {
        this.pendingRequests.delete(message.id!);
        clearTimeout(timeout);
        reject(err);
      });
    });
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
    } else if (this.config.transport === 'sse') {
      return this.sendSSERequest(message);
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
      'Accept': 'application/json, text/event-stream',  // Required for SSE-capable servers like Smithery
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

    if (this.sseAbortController) {
      this.sseAbortController.abort();
      this.sseAbortController = null;
    }

    this.sseInitialized = false;
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
