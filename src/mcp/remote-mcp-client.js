/**
 * Remote MCP Client - Connect to external MCP servers
 *
 * Supports multiple connection types:
 * - uvx: Python packages via UV
 * - npx: Node.js packages via npm
 * - docker: Containerized servers
 * - http/https: Remote web servers
 */
import { spawn } from 'child_process';
import { EventEmitter } from 'events';
import { resolveNodePackageRunner } from '../utils/node-package-runner.js';
export class RemoteMCPClient extends EventEmitter {
    config;
    process = null;
    connected = false;
    messageId = 0;
    pendingRequests = new Map();
    constructor(config) {
        super();
        this.config = config;
    }
    /**
     * Connect to the remote MCP server
     */
    async connect() {
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
            default:
                throw new Error(`Unsupported transport: ${this.config.transport}`);
        }
        this.connected = true;
        this.emit('connected');
    }
    /**
     * Connect via uvx (Python/UV)
     */
    async connectViaUvx() {
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
    async connectViaNodePackage(preference) {
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
        await this.waitForReady();
    }
    /**
     * Connect via Docker
     */
    async connectViaDocker() {
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
    async connectViaHttp() {
        if (!this.config.url) {
            throw new Error('http/https transport requires url');
        }
        // HTTP transport doesn't need a process
        // Validate the URL is accessible
        try {
            const headers = {
                'Content-Type': 'application/json',
                ...(this.config.headers || {})
            };
            if (this.config.auth) {
                if (this.config.auth.type === 'bearer' && this.config.auth.token) {
                    headers['Authorization'] = `Bearer ${this.config.auth.token}`;
                }
                else if (this.config.auth.type === 'basic' && this.config.auth.username && this.config.auth.password) {
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
        }
        catch (error) {
            throw new Error(`Failed to connect to ${this.config.url}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * Setup process event handlers for stdio-based transports
     */
    setupProcessHandlers() {
        if (!this.process)
            return;
        let buffer = '';
        this.process.stdout?.on('data', (data) => {
            buffer += data.toString();
            // Process complete JSON-RPC messages (line-delimited)
            const lines = buffer.split('\n');
            buffer = lines.pop() || ''; // Keep incomplete line in buffer
            for (const line of lines) {
                if (line.trim()) {
                    try {
                        const message = JSON.parse(line);
                        this.handleMessage(message);
                    }
                    catch (error) {
                        this.emit('error', new Error(`Failed to parse message: ${line}`));
                    }
                }
            }
        });
        this.process.stderr?.on('data', (data) => {
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
    handleMessage(message) {
        if (message.id !== undefined) {
            // Response to a request
            const pending = this.pendingRequests.get(message.id);
            if (pending) {
                clearTimeout(pending.timeout);
                this.pendingRequests.delete(message.id);
                if (message.error) {
                    pending.reject(new Error(message.error.message));
                }
                else {
                    pending.resolve(message.result);
                }
            }
        }
        else if (message.method) {
            // Notification or request from server
            this.emit('notification', message);
        }
    }
    /**
     * Wait for the server to be ready
     */
    async waitForReady(timeout = 10000) {
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
            }
            else {
                // For HTTP, already validated in connectViaHttp
                clearTimeout(timer);
                resolve();
            }
        });
    }
    /**
     * Send a request to the MCP server
     */
    async request(method, params) {
        if (!this.connected) {
            throw new Error('Not connected');
        }
        const id = ++this.messageId;
        const message = {
            jsonrpc: '2.0',
            id,
            method,
            params
        };
        if (this.config.transport === 'http' || this.config.transport === 'https') {
            return this.sendHttpRequest(message);
        }
        else {
            return this.sendStdioRequest(message);
        }
    }
    /**
     * Send request via HTTP
     */
    async sendHttpRequest(message) {
        const headers = {
            'Content-Type': 'application/json',
            ...(this.config.headers || {})
        };
        if (this.config.auth) {
            if (this.config.auth.type === 'bearer' && this.config.auth.token) {
                headers['Authorization'] = `Bearer ${this.config.auth.token}`;
            }
            else if (this.config.auth.type === 'basic' && this.config.auth.username && this.config.auth.password) {
                const credentials = Buffer.from(`${this.config.auth.username}:${this.config.auth.password}`).toString('base64');
                headers['Authorization'] = `Basic ${credentials}`;
            }
        }
        const response = await fetch(this.config.url, {
            method: 'POST',
            headers,
            body: JSON.stringify(message)
        });
        if (!response.ok) {
            throw new Error(`HTTP request failed: ${response.status} ${response.statusText}`);
        }
        const result = await response.json();
        if (result.error) {
            throw new Error(result.error.message);
        }
        return result.result;
    }
    /**
     * Send request via stdio
     */
    async sendStdioRequest(message) {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                this.pendingRequests.delete(message.id);
                reject(new Error('Request timeout'));
            }, this.config.timeout || 30000);
            this.pendingRequests.set(message.id, { resolve, reject, timeout });
            // Send message as line-delimited JSON
            this.process?.stdin?.write(JSON.stringify(message) + '\n');
        });
    }
    /**
     * Call an MCP tool
     */
    async callTool(name, args) {
        return this.request('tools/call', { name, arguments: args });
    }
    /**
     * List available tools
     */
    async listTools() {
        return this.request('tools/list');
    }
    /**
     * Disconnect from the server
     */
    async disconnect() {
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
    isConnected() {
        return this.connected;
    }
}
/**
 * Create a remote MCP client from config
 */
export function createRemoteMCPClient(config) {
    return new RemoteMCPClient(config);
}
//# sourceMappingURL=remote-mcp-client.js.map