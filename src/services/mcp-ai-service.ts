/**
 * MCP-Enhanced AI Service
 * 
 * Extends the basic AI service to support MCP (Model Context Protocol) tools,
 * enabling AI systems to access documentation, file systems, and other external tools.
 */

import { AIService, AIServiceConfig, ExecuteRequest, ExecuteResult } from './ai-service.js';
import { MCPService, MCPServiceConfig, AIToolRequest, MCPToolDefinition } from './mcp-service.js';
import { generateText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { openai } from '@ai-sdk/openai';
import { google } from '@ai-sdk/google';

export interface MCPAIServiceConfig extends AIServiceConfig {
  mcp?: MCPServiceConfig;
  enableMCPTools?: boolean;
  maxToolCalls?: number;
  toolCallTimeout?: number;
}

export interface EnhancedExecuteRequest extends ExecuteRequest {
  tools?: {
    enabled?: boolean;
    whitelist?: string[]; // Only allow specific tools
    blacklist?: string[]; // Disallow specific tools
  };
}

export interface EnhancedExecuteResult extends ExecuteResult {
  toolCalls?: {
    name: string;
    arguments: any;
    result: any;
    duration: number;
    success: boolean;
    error?: string;
  }[];
  totalToolCalls?: number;
}

/**
 * Enhanced AI Service with MCP tool integration
 * 
 * This service extends the basic AI service to support MCP tools,
 * allowing AI models to call external tools for enhanced functionality.
 */
export class MCPAIService {
  private aiService: AIService;
  private mcpService: MCPService | null = null;
  private mcpConfig: MCPAIServiceConfig & {
    enableMCPTools: boolean;
    maxToolCalls: number;
    toolCallTimeout: number;
  };

  constructor(config: MCPAIServiceConfig = {}) {
    this.aiService = new AIService(config);
    
    this.mcpConfig = {
      ...config,
      enableMCPTools: config.enableMCPTools ?? true,
      maxToolCalls: config.maxToolCalls ?? 5,
      toolCallTimeout: config.toolCallTimeout ?? 30000,
      mcp: config.mcp || {}
    };

    console.log("mcp config", this.mcpConfig)
    if (this.mcpConfig.enableMCPTools) {
      this.mcpService = new MCPService(this.mcpConfig.mcp);
    }
  }

  /**
   * Initialize the MCP service
   */
  async initialize(): Promise<void> {
    if (this.mcpService) {
      await this.mcpService.initialize();
    }
  }

  /**
   * Execute AI request with optional MCP tool support
   */
  async execute(request: EnhancedExecuteRequest): Promise<EnhancedExecuteResult> {
    // If MCP tools are disabled or not requested, use the base implementation
    if (!this.mcpConfig.enableMCPTools || !this.mcpService || !request.tools?.enabled) {
      const result = await this.aiService.execute(request);
      return result as EnhancedExecuteResult;
    }

    return this.executeWithTools(request);
  }

  /**
   * Execute AI request with MCP tools enabled
   */
  private async executeWithTools(request: EnhancedExecuteRequest): Promise<EnhancedExecuteResult> {
    const { content, systemPrompt, metadata = {}, options = {} } = request;
    
    // Get available tools
    const availableTools = this.getFilteredTools(request.tools);
    
    // Create enhanced system prompt with tool information
    const enhancedSystemPrompt = this.createToolAwareSystemPrompt(systemPrompt || '', availableTools);
    
    // For now, use basic AI service and add tool information to system prompt
    // TODO: Implement proper tool calling when AI SDK supports it better
    const enhancedRequest = {
      ...request,
      systemPrompt: enhancedSystemPrompt
    };

    const result = await this.aiService.execute(enhancedRequest);
    
    return {
      ...result,
      toolCalls: [], // No actual tool calls for now
      totalToolCalls: 0
    };
  }

  /**
   * Get filtered tools based on whitelist/blacklist
   */
  private getFilteredTools(toolsConfig?: EnhancedExecuteRequest['tools']): MCPToolDefinition[] {
    if (!this.mcpService) return [];

    let tools = this.mcpService.getAvailableToolsForAI();

    if (toolsConfig?.whitelist) {
      tools = tools.filter(tool => toolsConfig.whitelist!.includes(tool.name));
    }

    if (toolsConfig?.blacklist) {
      tools = tools.filter(tool => !toolsConfig.blacklist!.includes(tool.name));
    }

    return tools;
  }

  /**
   * Create a system prompt that includes tool information
   */
  private createToolAwareSystemPrompt(basePrompt: string, tools: MCPToolDefinition[]): string {
    if (tools.length === 0) {
      return basePrompt;
    }

    const toolDescriptions = tools.map(tool => 
      `- ${tool.name}: ${tool.description}`
    ).join('\n');

    return `${basePrompt}

You have access to the following tools that can help you provide better responses:

${toolDescriptions}

Use these tools when they would be helpful for answering the user's question. For example:
- Use ref_search_documentation to find relevant documentation
- Use ref_read_url to fetch and analyze web content
- Use filesystem tools to read or analyze files (if enabled)

Only call tools when they would genuinely improve your response.`;
  }

  /**
   * Generate a unique request ID
   */
  private generateRequestId(): string {
    return `mcp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get MCP service health status
   */
  getMCPHealthStatus() {
    return this.mcpService?.getHealthStatus() || {
      initialized: false,
      serversCount: 0,
      connectedServers: 0,
      availableTools: 0,
      servers: []
    };
  }

  /**
   * Get available MCP tools
   */
  getAvailableMCPTools(): MCPToolDefinition[] {
    return this.mcpService?.getAvailableToolsForAI() || [];
  }

  /**
   * Add a custom MCP server
   */
  async addMCPServer(config: any): Promise<void> {
    if (!this.mcpService) {
      throw new Error('MCP service is not enabled');
    }
    await this.mcpService.addServer(config);
  }

  /**
   * Remove an MCP server
   */
  async removeMCPServer(serverId: string): Promise<void> {
    if (!this.mcpService) {
      throw new Error('MCP service is not enabled');
    }
    await this.mcpService.removeServer(serverId);
  }

  /**
   * Test a specific MCP tool
   */
  async testMCPTool(toolName: string, args: Record<string, any> = {}): Promise<any> {
    if (!this.mcpService) {
      throw new Error('MCP service is not enabled');
    }

    const toolRequest: AIToolRequest = {
      name: toolName,
      arguments: args
    };

    return await this.mcpService.executeToolForAI(toolRequest);
  }

  /**
   * Shutdown MCP services
   */
  async shutdown(): Promise<void> {
    if (this.mcpService) {
      await this.mcpService.shutdown();
    }
  }
}