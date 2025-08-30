/**
 * MCP Registry Service - Model Context Protocol Integration
 *
 * Manages MCP servers (local and external) and provides tools to AI requests.
 * Supports both stdio and HTTP MCP servers, with focus on the Ref MCP for documentation.
 */
import { EventEmitter } from 'events';
import { spawn } from 'child_process';
import fetch from 'node-fetch';
/**
 * MCP Registry Service
 *
 * Manages a collection of MCP servers and provides a unified interface
 * for tool discovery and execution.
 */
export class MCPRegistryService extends EventEmitter {
    options;
    servers = new Map();
    serverProcesses = new Map();
    serverStatus = new Map();
    toolRegistry = new Map(); // toolName -> servers that provide it
    constructor(options = {}) {
        super();
        this.options = options;
        this.options = {
            defaultTimeout: 30000,
            maxRetries: 3,
            ...options
        };
    }
    /**
     * Register a new MCP server
     */
    async registerServer(config) {
        this.servers.set(config.id, {
            timeout: this.options.defaultTimeout,
            retryAttempts: this.options.maxRetries,
            autoRestart: true,
            enabled: true,
            ...config
        });
        this.serverStatus.set(config.id, {
            id: config.id,
            status: 'disconnected'
        });
        if (config.enabled !== false) {
            await this.startServer(config.id);
        }
        this.emit('serverRegistered', { serverId: config.id, config });
    }
    /**
     * Start an MCP server
     */
    async startServer(serverId) {
        const config = this.servers.get(serverId);
        if (!config) {
            throw new Error(`Server ${serverId} not found`);
        }
        const status = this.serverStatus.get(serverId);
        status.status = 'starting';
        this.emit('serverStatusChanged', { serverId, status: status.status });
        try {
            if (config.type === 'stdio') {
                await this.startStdioServer(config);
            }
            else if (config.type === 'http') {
                await this.startHttpServer(config);
            }
            status.status = 'connected';
            status.lastSeen = new Date();
            status.error = undefined;
            // Discover tools
            await this.discoverServerTools(serverId);
            this.emit('serverConnected', { serverId });
        }
        catch (error) {
            status.status = 'error';
            status.error = error instanceof Error ? error.message : 'Unknown error';
            this.emit('serverError', { serverId, error: status.error });
            throw error;
        }
    }
    /**
     * Start a stdio-based MCP server
     */
    async startStdioServer(config) {
        if (!config.command) {
            throw new Error('Command is required for stdio servers');
        }
        const childProcess = spawn(config.command, config.args || [], {
            stdio: ['pipe', 'pipe', 'pipe'],
            env: { ...process.env, ...config.env }
        });
        this.serverProcesses.set(config.id, childProcess);
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error(`Server ${config.id} failed to start within ${config.timeout}ms`));
            }, config.timeout);
            childProcess.on('spawn', () => {
                clearTimeout(timeout);
                resolve();
            });
            childProcess.on('error', (error) => {
                clearTimeout(timeout);
                reject(error);
            });
            // Handle process output for debugging
            childProcess.stdout?.on('data', (data) => {
                this.emit('serverOutput', { serverId: config.id, output: data.toString(), stream: 'stdout' });
            });
            childProcess.stderr?.on('data', (data) => {
                this.emit('serverOutput', { serverId: config.id, output: data.toString(), stream: 'stderr' });
            });
            childProcess.on('exit', (code) => {
                this.handleServerExit(config.id, code);
            });
        });
    }
    /**
     * Start an HTTP-based MCP server
     */
    async startHttpServer(config) {
        if (!config.url) {
            throw new Error('URL is required for HTTP servers');
        }
        // Test connection with a simple health check
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), config.timeout || 30000);
            const response = await fetch(`${config.url}/health`, {
                method: 'GET',
                headers: config.headers,
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            if (!response.ok) {
                throw new Error(`HTTP server responded with ${response.status}`);
            }
        }
        catch (error) {
            throw new Error(`Failed to connect to HTTP server: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * Discover available tools from a server
     */
    async discoverServerTools(serverId) {
        const config = this.servers.get(serverId);
        if (!config)
            return;
        try {
            let tools = [];
            if (config.type === 'stdio') {
                tools = await this.discoverStdioTools(serverId);
            }
            else if (config.type === 'http') {
                tools = await this.discoverHttpTools(serverId);
            }
            // Update status with discovered tools
            const status = this.serverStatus.get(serverId);
            status.tools = tools;
            // Update tool registry
            for (const tool of tools) {
                if (!this.toolRegistry.has(tool.name)) {
                    this.toolRegistry.set(tool.name, []);
                }
                this.toolRegistry.get(tool.name).push(tool);
            }
            this.emit('toolsDiscovered', { serverId, tools });
        }
        catch (error) {
            console.warn(`Failed to discover tools for server ${serverId}:`, error);
        }
    }
    /**
     * Discover tools from stdio MCP server
     */
    async discoverStdioTools(serverId) {
        const childProcess = this.serverProcesses.get(serverId);
        if (!childProcess || !childProcess.stdin || !childProcess.stdout) {
            return [];
        }
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Tool discovery timeout'));
            }, 10000);
            // Send tools/list request
            const request = {
                jsonrpc: '2.0',
                id: Date.now(),
                method: 'tools/list',
                params: {}
            };
            let response = '';
            const onData = (data) => {
                response += data.toString();
                try {
                    const parsed = JSON.parse(response);
                    if (parsed.id === request.id) {
                        clearTimeout(timeout);
                        childProcess.stdout?.off('data', onData);
                        const tools = (parsed.result?.tools || []).map((tool) => ({
                            name: tool.name,
                            description: tool.description,
                            inputSchema: tool.inputSchema,
                            serverId
                        }));
                        resolve(tools);
                    }
                }
                catch {
                    // Response not complete yet
                }
            };
            childProcess.stdout?.on('data', onData);
            childProcess.stdin?.write(JSON.stringify(request) + '\n');
        });
    }
    /**
     * Discover tools from HTTP MCP server
     */
    async discoverHttpTools(serverId) {
        const config = this.servers.get(serverId);
        if (!config?.url)
            return [];
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), config.timeout || 30000);
            const response = await fetch(`${config.url}/tools`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...config.headers
                },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: Date.now(),
                    method: 'tools/list',
                    params: {}
                }),
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            if (!response.ok) {
                throw new Error(`HTTP request failed: ${response.status}`);
            }
            const data = await response.json();
            return (data.result?.tools || []).map((tool) => ({
                name: tool.name,
                description: tool.description,
                inputSchema: tool.inputSchema,
                serverId
            }));
        }
        catch (error) {
            console.warn(`Failed to discover HTTP tools for ${serverId}:`, error);
            return [];
        }
    }
    /**
     * Execute a tool on the appropriate MCP server
     */
    async executeTool(request) {
        const startTime = Date.now();
        // Find server to execute the tool
        let serverId = request.serverId;
        if (!serverId) {
            const toolServers = this.toolRegistry.get(request.name);
            if (!toolServers || toolServers.length === 0) {
                return {
                    success: false,
                    error: `Tool '${request.name}' not found in any server`,
                    serverId: 'unknown',
                    toolName: request.name,
                    duration: Date.now() - startTime
                };
            }
            serverId = toolServers[0].serverId; // Use first available server
        }
        const config = this.servers.get(serverId);
        const status = this.serverStatus.get(serverId);
        if (!config || !status || status.status !== 'connected') {
            return {
                success: false,
                error: `Server '${serverId}' is not available`,
                serverId,
                toolName: request.name,
                duration: Date.now() - startTime
            };
        }
        try {
            let result;
            if (config.type === 'stdio') {
                result = await this.executeStdioTool(serverId, request);
            }
            else if (config.type === 'http') {
                result = await this.executeHttpTool(serverId, request);
            }
            else {
                throw new Error(`Unsupported server type: ${config.type}`);
            }
            return {
                success: true,
                result,
                serverId,
                toolName: request.name,
                duration: Date.now() - startTime
            };
        }
        catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                serverId,
                toolName: request.name,
                duration: Date.now() - startTime
            };
        }
    }
    /**
     * Execute tool on stdio MCP server
     */
    async executeStdioTool(serverId, request) {
        const childProcess = this.serverProcesses.get(serverId);
        if (!childProcess || !childProcess.stdin || !childProcess.stdout) {
            throw new Error('Server process not available');
        }
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Tool execution timeout'));
            }, this.options.defaultTimeout);
            const rpcRequest = {
                jsonrpc: '2.0',
                id: Date.now(),
                method: 'tools/call',
                params: {
                    name: request.name,
                    arguments: request.arguments || {}
                }
            };
            let response = '';
            const onData = (data) => {
                response += data.toString();
                try {
                    const parsed = JSON.parse(response);
                    if (parsed.id === rpcRequest.id) {
                        clearTimeout(timeout);
                        childProcess.stdout?.off('data', onData);
                        if (parsed.error) {
                            reject(new Error(parsed.error.message || 'Tool execution failed'));
                        }
                        else {
                            resolve(parsed.result);
                        }
                    }
                }
                catch {
                    // Response not complete yet
                }
            };
            childProcess.stdout?.on('data', onData);
            childProcess.stdin?.write(JSON.stringify(rpcRequest) + '\n');
        });
    }
    /**
     * Execute tool on HTTP MCP server
     */
    async executeHttpTool(serverId, request) {
        const config = this.servers.get(serverId);
        if (!config?.url) {
            throw new Error('Server URL not available');
        }
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), config.timeout || 30000);
        const response = await fetch(`${config.url}/tools`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...config.headers
            },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: Date.now(),
                method: 'tools/call',
                params: {
                    name: request.name,
                    arguments: request.arguments || {}
                }
            }),
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        if (!response.ok) {
            throw new Error(`HTTP request failed: ${response.status}`);
        }
        const data = await response.json();
        if (data.error) {
            throw new Error(data.error.message || 'Tool execution failed');
        }
        return data.result;
    }
    /**
     * Handle server process exit
     */
    handleServerExit(serverId, code) {
        const status = this.serverStatus.get(serverId);
        const config = this.servers.get(serverId);
        if (status) {
            status.status = 'disconnected';
            status.error = `Process exited with code ${code}`;
        }
        this.serverProcesses.delete(serverId);
        this.emit('serverDisconnected', { serverId, exitCode: code });
        // Auto-restart if enabled
        if (config?.autoRestart && config.enabled !== false) {
            setTimeout(() => {
                this.startServer(serverId).catch(error => {
                    console.error(`Failed to restart server ${serverId}:`, error);
                });
            }, 5000);
        }
    }
    /**
     * Stop a server
     */
    async stopServer(serverId) {
        const process = this.serverProcesses.get(serverId);
        const status = this.serverStatus.get(serverId);
        if (process) {
            process.kill();
            this.serverProcesses.delete(serverId);
        }
        if (status) {
            status.status = 'disconnected';
            status.error = undefined;
        }
        // Remove tools from registry
        const serverTools = status?.tools || [];
        for (const tool of serverTools) {
            const toolServers = this.toolRegistry.get(tool.name);
            if (toolServers) {
                const filtered = toolServers.filter(t => t.serverId !== serverId);
                if (filtered.length === 0) {
                    this.toolRegistry.delete(tool.name);
                }
                else {
                    this.toolRegistry.set(tool.name, filtered);
                }
            }
        }
        this.emit('serverStopped', { serverId });
    }
    /**
     * Get all available tools
     */
    getAvailableTools() {
        const allTools = [];
        for (const tools of this.toolRegistry.values()) {
            allTools.push(...tools);
        }
        return allTools;
    }
    /**
     * Get server status
     */
    getServerStatus(serverId) {
        if (serverId) {
            const status = this.serverStatus.get(serverId);
            if (!status) {
                throw new Error(`Server ${serverId} not found`);
            }
            return status;
        }
        return Array.from(this.serverStatus.values());
    }
    /**
     * Get server configurations
     */
    getServerConfigs() {
        return Array.from(this.servers.values());
    }
    /**
     * Unregister a server
     */
    async unregisterServer(serverId) {
        await this.stopServer(serverId);
        this.servers.delete(serverId);
        this.serverStatus.delete(serverId);
        this.emit('serverUnregistered', { serverId });
    }
    /**
     * Cleanup and stop all servers
     */
    async shutdown() {
        const serverIds = Array.from(this.servers.keys());
        await Promise.all(serverIds.map(id => this.stopServer(id)));
        this.removeAllListeners();
    }
}
/**
 * Predefined MCP server configurations
 */
export const PREDEFINED_MCP_SERVERS = [
    {
        id: 'ref-tools',
        name: 'Ref Tools MCP',
        description: 'Documentation search and URL reading tools',
        type: 'stdio',
        command: 'npx',
        args: ['ref-tools-mcp@latest'],
        autoRestart: true,
        enabled: true
    },
    {
        id: 'web-search',
        name: 'Web Search MCP',
        description: 'Web search capabilities using open-webSearch',
        type: 'stdio',
        command: 'npx',
        args: ['-y', 'open-websearch@latest'],
        env: {
            // Configure search providers - can be overridden
            SEARCH_PROVIDERS: 'duckduckgo,google,bing',
            MAX_RESULTS: '10',
            SAFE_SEARCH: 'moderate'
        },
        autoRestart: true,
        enabled: true
    },
    {
        id: 'filesystem-tools',
        name: 'Filesystem Tools',
        description: 'File system access and manipulation tools',
        type: 'stdio',
        command: 'npx',
        args: ['@mcp/filesystem'],
        autoRestart: true,
        enabled: false // Disabled by default for security
    }
];
