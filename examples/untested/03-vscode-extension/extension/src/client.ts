/**
 * MCP Client for VS Code Extension
 * 
 * Handles communication with the MCP server using tRPC and MCP protocols.
 */

import { createTRPCClient, httpBatchLink } from '@trpc/client';
import type { AppRouter } from 'simple-rpc-ai-backend';
import type { AuthManager } from './auth';

export class MCPClient {
    private trpcClient: any;
    private mcpEndpoint: string;
    
    constructor(
        private serverUrl: string,
        private authManager: AuthManager
    ) {
        this.mcpEndpoint = `${serverUrl}/mcp`;
        this.initializeTRPCClient();
    }
    
    private initializeTRPCClient() {
        this.trpcClient = createTRPCClient<AppRouter>({
            links: [
                httpBatchLink({
                    url: `${this.serverUrl}/trpc`,
                    headers: async () => {
                        const token = await this.authManager.getToken();
                        return token ? { authorization: `Bearer ${token}` } : {};
                    }
                })
            ]
        });
    }
    
    /**
     * Execute AI request via tRPC
     */
    async executeAI(params: {
        content: string;
        provider?: string;
        maxTokens?: number;
        stream?: boolean;
    }, cancellationToken?: any) {
        // Check for cancellation
        if (cancellationToken?.isCancellationRequested) {
            throw new Error('Request cancelled');
        }
        
        return await this.trpcClient.ai.generateText.mutate({
            content: params.content,
            provider: params.provider || 'anthropic',
            options: {
                maxTokens: params.maxTokens,
                stream: params.stream
            }
        });
    }
    
    /**
     * List available MCP tools
     */
    async listTools() {
        const response = await this.mcpRequest('tools/list', {});
        return response.tools || [];
    }
    
    /**
     * Call an MCP tool
     */
    async callTool(name: string, args: any) {
        return await this.mcpRequest('tools/call', {
            name,
            arguments: args
        });
    }
    
    /**
     * Get token usage statistics
     */
    async getTokenUsage() {
        return await this.trpcClient.ai.getUsageStats.query();
    }
    
    /**
     * Get available AI providers
     */
    async getProviders() {
        return await this.trpcClient.ai.listProviders.query();
    }
    
    /**
     * Make a raw MCP protocol request
     */
    private async mcpRequest(method: string, params: any) {
        const token = await this.authManager.getToken();
        
        const response = await fetch(this.mcpEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { 'Authorization': `Bearer ${token}` } : {})
            },
            body: JSON.stringify({
                jsonrpc: '2.0',
                method,
                params,
                id: Date.now()
            })
        });
        
        if (!response.ok) {
            throw new Error(`MCP request failed: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (data.error) {
            throw new Error(data.error.message || 'MCP request failed');
        }
        
        return data.result;
    }
    
    /**
     * Stream AI response (for future implementation)
     */
    async *streamAI(params: {
        content: string;
        provider?: string;
        maxTokens?: number;
    }) {
        // This would use SSE or WebSocket for streaming
        // For now, just return the full response
        const response = await this.executeAI({ ...params, stream: false });
        yield response.content;
    }
}