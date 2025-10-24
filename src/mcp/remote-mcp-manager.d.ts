/**
 * Remote MCP Server Manager
 *
 * Manages connections to multiple remote MCP servers and proxies requests.
 */
import { EventEmitter } from 'events';
import { RemoteMCPClient, RemoteMCPServerConfig } from './remote-mcp-client';
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
export declare class RemoteMCPManager extends EventEmitter {
    private clients;
    private config;
    private serverStatus;
    constructor(config: RemoteMCPManagerConfig);
    /**
     * Initialize and connect to all configured servers
     */
    initialize(): Promise<void>;
    /**
     * Add a remote MCP server
     */
    addServer(config: RemoteMCPServerConfig): Promise<void>;
    /**
     * Remove a remote MCP server
     */
    removeServer(name: string): Promise<void>;
    /**
     * Reconnect to a server
     */
    private reconnectServer;
    /**
     * Update server status
     */
    private updateServerStatus;
    /**
     * Get status of all servers
     */
    getServerStatus(): RemoteServerStatus[];
    /**
     * Get a specific server client
     */
    getServer(name: string): RemoteMCPClient | undefined;
    /**
     * Call a tool on a specific server
     */
    callTool(serverName: string, toolName: string, args: any): Promise<any>;
    /**
     * List all available tools across all servers
     */
    listAllTools(): Promise<Map<string, any[]>>;
    /**
     * Disconnect from all servers
     */
    shutdown(): Promise<void>;
    /**
     * Get all connected servers
     */
    getConnectedServers(): string[];
    /**
     * Check if a server is connected
     */
    isServerConnected(name: string): boolean;
}
/**
 * Create a remote MCP manager
 */
export declare function createRemoteMCPManager(config: RemoteMCPManagerConfig): RemoteMCPManager;
//# sourceMappingURL=remote-mcp-manager.d.ts.map