/**
 * Remote MCP Client - Connect to external MCP servers
 *
 * Supports multiple connection types:
 * - uvx: Python packages via UV
 * - npx: Node.js packages via npm
 * - docker: Containerized servers
 * - http/https: Remote web servers
 */
import { EventEmitter } from 'events';
export type RemoteMCPTransport = 'uvx' | 'npx' | 'npm-exec' | 'docker' | 'http' | 'https';
export interface RemoteMCPServerConfig {
    name: string;
    transport: RemoteMCPTransport;
    command?: string;
    args?: string[];
    env?: Record<string, string>;
    image?: string;
    containerArgs?: string[];
    url?: string;
    headers?: Record<string, string>;
    auth?: {
        type: 'bearer' | 'basic' | 'none';
        token?: string;
        username?: string;
        password?: string;
    };
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
export declare class RemoteMCPClient extends EventEmitter {
    private config;
    private process;
    private connected;
    private messageId;
    private pendingRequests;
    constructor(config: RemoteMCPServerConfig);
    /**
     * Connect to the remote MCP server
     */
    connect(): Promise<void>;
    /**
     * Connect via uvx (Python/UV)
     */
    private connectViaUvx;
    /**
     * Connect via Node-based package runner (npx or npm exec)
     */
    private connectViaNodePackage;
    /**
     * Connect via Docker
     */
    private connectViaDocker;
    /**
     * Connect via HTTP/HTTPS
     */
    private connectViaHttp;
    /**
     * Setup process event handlers for stdio-based transports
     */
    private setupProcessHandlers;
    /**
     * Handle incoming MCP message
     */
    private handleMessage;
    /**
     * Wait for the server to be ready
     */
    private waitForReady;
    /**
     * Send a request to the MCP server
     */
    request(method: string, params?: any): Promise<any>;
    /**
     * Send request via HTTP
     */
    private sendHttpRequest;
    /**
     * Send request via stdio
     */
    private sendStdioRequest;
    /**
     * Call an MCP tool
     */
    callTool(name: string, args: any): Promise<any>;
    /**
     * List available tools
     */
    listTools(): Promise<any>;
    /**
     * Disconnect from the server
     */
    disconnect(): Promise<void>;
    /**
     * Check if connected
     */
    isConnected(): boolean;
}
/**
 * Create a remote MCP client from config
 */
export declare function createRemoteMCPClient(config: RemoteMCPServerConfig): RemoteMCPClient;
//# sourceMappingURL=remote-mcp-client.d.ts.map