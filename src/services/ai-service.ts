/**
 * AI Service using Vercel AI SDK
 * 
 * Simple wrapper around Vercel AI SDK for RPC backend services.
 * Handles multiple providers (Anthropic, OpenAI, Google, etc.) seamlessly.
 */

import { generateText } from 'ai';
import { anthropic, Anthropic } from '@ai-sdk/anthropic';
import { openai, OpenAI } from '@ai-sdk/openai';
import { google, Google } from '@ai-sdk/google';
import crypto from 'crypto';
import { MCPService, MCPServiceConfig } from './mcp-service';
import { ModelRegistryManager, modelRegistry, ModelDefinition, ProviderModelRegistry, ModelCapability } from './model-registry';

export interface AIServiceConfig {
  provider?: 'anthropic' | 'openai' | 'google' | 'openrouter'; // selected in constructor & used 
  defaultProvider?: 'anthropic' | 'openai' | 'google' | 'openrouter'; // default provider optional, defaults to serviceProvider with highest priority
  serviceProviders?: ServiceProvidersConfig;
  systemPrompts?: Record<string, string>; // Custom system prompt definitions
  apiKey?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  mcpConfig?: MCPServiceConfig; // MCP service configuration for web search
  
  // Model Management Configuration
  modelRegistry?: {
    useCustomRegistry?: boolean; // If true, ignore defaults and use only custom
    additionalProviders?: ProviderModelRegistry[]; // Add new providers
    extendProviders?: { // Extend existing providers with more models
      [provider: string]: {
        models: ModelDefinition[];
        newDefaultModel?: string;
      };
    };
    replaceProviders?: { // Replace models for existing providers
      [provider: string]: {
        models: ModelDefinition[];
        newDefaultModel?: string;
      };
    };
    customModelRegistry?: ModelRegistryManager; // Use completely custom registry instance
  };
}

export interface ExecuteRequest {
  content: string;
  promptId?: string; // Can be a key (like "code_review") or direct text
  systemPrompt?: string; // Legacy - for backward compatibility
  metadata?: {
    name?: string;
    type?: string;
    provider?: string;
    model?: string;
    maxTokens?: number;
    temperature?: number;
    useWebSearch?: boolean;
    webSearchPreference?: 'duckduckgo' | 'mcp' | 'ai-web-search' | 'never';
    maxWebSearches?: number;
    allowedDomains?: string[];
    blockedDomains?: string[];
    userLocation?: {
      type: 'approximate';
      city?: string;
      region?: string;
      country?: string;
      timezone?: string;
    };
    [key: string]: any;
  };
  options?: {
    model?: string;
    maxTokens?: number;
    temperature?: number;
  };
  apiKey?: string; // For BYOK users
}

export interface ExecuteResult {
  content: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model: string;
  provider?: string;
  requestId?: string;
  finishReason?: string;
}

export interface SearchResult {
  title: string;
  url: string;
  description?: string;
  snippet?: string;
}

interface ServiceProvider {
  name: 'anthropic' | 'openai' | 'google' | 'openrouter';
  apiKey: string;
  priority: number;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  baseURL?: string; // For OpenRouter and custom endpoints
}

// Allow either an object mapping provider names to partial config,
// or an array of full ServiceProvider entries
export type ServiceProvidersConfig =
  | {
      anthropic?: Partial<Omit<ServiceProvider, 'name' | 'priority'>> & { priority?: number };
      openai?: Partial<Omit<ServiceProvider, 'name' | 'priority'>> & { priority?: number };
      google?: Partial<Omit<ServiceProvider, 'name' | 'priority'>> & { priority?: number };
      openrouter?: Partial<Omit<ServiceProvider, 'name' | 'priority'>> & { priority?: number };
    }
  | ServiceProvider[];

// ModelType removed - no longer needed

function normalizeServiceProviders(
  spConfig: ServiceProvidersConfig | undefined
): ServiceProvider[] {
  if (!spConfig) return [];

  if (Array.isArray(spConfig)) {
    return spConfig;
  }

  const providers: ServiceProvider[] = [];

  if (spConfig.anthropic) {
    providers.push({
      name: 'anthropic',
      apiKey: spConfig.anthropic.apiKey ?? '',
      priority: spConfig.anthropic.priority ?? 0,
      model: spConfig.anthropic.model,
      maxTokens: spConfig.anthropic.maxTokens,
      temperature: spConfig.anthropic.temperature,
    });
  }

  if (spConfig.openai) {
    providers.push({
      name: 'openai',
      apiKey: spConfig.openai.apiKey ?? '',
      priority: spConfig.openai.priority ?? 0,
      model: spConfig.openai.model,
      maxTokens: spConfig.openai.maxTokens,
      temperature: spConfig.openai.temperature,
    });
  }

  if (spConfig.google) {
    providers.push({
      name: 'google',
      apiKey: spConfig.google.apiKey ?? '',
      priority: spConfig.google.priority ?? 0,
      model: spConfig.google.model,
      maxTokens: spConfig.google.maxTokens,
      temperature: spConfig.google.temperature,
      baseURL: spConfig.google.baseURL,
    });
  }

  if (spConfig.openrouter) {
    providers.push({
      name: 'openrouter',
      apiKey: spConfig.openrouter.apiKey ?? '',
      priority: spConfig.openrouter.priority ?? 0,
      model: spConfig.openrouter.model,
      maxTokens: spConfig.openrouter.maxTokens,
      temperature: spConfig.openrouter.temperature,
      baseURL: spConfig.openrouter.baseURL ?? 'https://openrouter.ai/api/v1',
    });
  }

  return providers;
}

/**
 * Simple AI service using Vercel AI SDK
 */
export class AIService {
  private config: AIServiceConfig;
  private systemPrompts: Record<string, string>;
  private providers: ServiceProvider[] = [];
  private mcpService?: MCPService; // MCP service for web search tools
  private modelRegistry: ModelRegistryManager;

  constructor(config: AIServiceConfig) {
    // Initialize system prompts from config or use defaults
    this.systemPrompts = config.systemPrompts || this.getDefaultSystemPrompts();
    if(config.serviceProviders) {
      this.providers = normalizeServiceProviders(config.serviceProviders);
      if (this.providers.length === 0) {
        throw new Error('No valid AI service providers configured.');
      }

      // If providers came from an array, assign priority by array index:
      if (Array.isArray(config.serviceProviders)) {
        const serviceProvidersArray = config.serviceProviders as ServiceProvider[];
        this.providers.forEach((p) => {
          p.priority = serviceProvidersArray.findIndex(sp => sp.name === p.name);
        });
      }
      // Sort by priority descending (higher first)
      this.providers.sort((a, b) => b.priority - a.priority);
    } else {
      throw new Error('No AI service providers configured. Please set ANTHROPIC_API_KEY environment variable or configure serviceProviders.');
    }
    this.config = config;

    // Use explicit defaultProvider or fall back to highest-priority provider
    this.config.provider = config.defaultProvider || this.providers[0]?.name;
    
    // Initialize MCP service if web search config is provided
    if (config.mcpConfig) {
      this.mcpService = new MCPService(config.mcpConfig);
      console.log("service", this.mcpService)
    } else if (config.systemPrompts) {
      // If system prompts are configured, enable MCP for potential web search
      this.mcpService = new MCPService({ enableWebSearch: true });
    }

    // Initialize model registry
    this.modelRegistry = this.initializeModelRegistry(config.modelRegistry);
  }
  /**
   * Execute AI request with system prompt using Vercel AI SDK
   */
  async execute(request: ExecuteRequest): Promise<ExecuteResult> {
    const { content, promptId, systemPrompt: legacySystemPrompt, metadata = {}, options = {}, apiKey } = request;

    // Support both promptId (new) and systemPrompt (legacy) for backwards compatibility
    const actualPromptId = promptId || legacySystemPrompt;
    if (!actualPromptId) {
      throw new Error('Either promptId or systemPrompt must be provided');
    }

    // Check for model deprecation warnings
    const modelToUse = metadata.model || options.model || this.config.model;
    const providerToUse = metadata.provider || this.config.provider;
    if (modelToUse && providerToUse) {
      const deprecationCheck = this.modelRegistry.checkModelDeprecation(providerToUse, modelToUse);
      if (deprecationCheck.deprecated && deprecationCheck.warning) {
        console.warn(deprecationCheck.warning);
      }
    }

    // Resolve promptId to actual system prompt text
    const systemPrompt = this.resolveSystemPrompt(actualPromptId);

    // Merge metadata into execution options (metadata takes precedence)
    const executionConfig = {
      provider: metadata.provider || this.config.provider,
      model: metadata.model || options.model,
      maxTokens: metadata.maxTokens || options.maxTokens,
      temperature: metadata.temperature || options.temperature,
      useWebSearch: metadata.useWebSearch || false,
      webSearchPreference: metadata.webSearchPreference || 'duckduckgo'
    };

    // Debug logging
    console.log('🔍 AI Execute Debug:');
    console.log(`   System Prompt: ${systemPrompt ? `"${systemPrompt.substring(0, 100)}..."` : 'MISSING'}`);
    console.log(`   User Content: ${content ? `"${content.substring(0, 100)}..."` : 'MISSING'}`);
    console.log(`   Provider: ${executionConfig.provider} ${metadata.provider ? '(from metadata)' : '(default)'}`);
    console.log(`   Model: ${executionConfig.model || 'default'}`);
    console.log(`   Using BYOK: ${apiKey ? 'YES' : 'NO'}`);
    console.log(`   Web Search: ${executionConfig.useWebSearch ? executionConfig.webSearchPreference : 'DISABLED'}`);

    // Get the AI model provider (with user's API key if provided)
    const model = this.getModel(
      executionConfig.model, 
      apiKey, 
      executionConfig.provider,
      executionConfig.useWebSearch
    ) as Parameters<typeof generateText>[0]['model'];
    
    // Prepare tools and enhanced system prompt
    const { enhancedSystemPrompt, availableTools } = await this.prepareAIExecution(
      systemPrompt, 
      executionConfig
    );

    // Create the user prompt from content
    const userPrompt = content;

    try {
      const generateOptions: any = {
        model,
        messages: [
          { role: 'system', content: enhancedSystemPrompt },
          { role: 'user', content: userPrompt }
        ],
        maxTokens: executionConfig.maxTokens || this.config.maxTokens || 4000,
        temperature: executionConfig.temperature || this.config.temperature || 0.3,
      };

      // Add tools if available
      if (availableTools.length > 0) {
        if (executionConfig.webSearchPreference === 'ai-web-search') {
          // For provider-native tools, pass them directly to the AI SDK
          generateOptions.tools = availableTools;
          // Don't set toolChoice for native tools - let provider handle it
        } else {
          // For MCP tools, use our custom tool execution pipeline
          generateOptions.tools = availableTools;
          generateOptions.toolChoice = 'auto'; // Let AI decide when to use tools
        }
      }

      const result = await generateText(generateOptions);

      // Handle tool calls if present (only for MCP tools, not provider-native)
      if (result.toolCalls && result.toolCalls.length > 0 && executionConfig.webSearchPreference !== 'ai-web-search') {
        console.log(`🔧 AI requested ${result.toolCalls.length} MCP tool calls`);
        
        // Execute tool calls via MCP
        const toolResults = await this.executeToolCalls(result.toolCalls);
        
        // Continue conversation with tool results
        const finalResult = await this.continueWithToolResults(
          generateOptions,
          result,
          toolResults
        );
        
        return this.formatExecuteResult(finalResult, executionConfig);
      }

      return {
        content: result.text,
        usage: {
          promptTokens: result.usage.promptTokens,
          completionTokens: result.usage.completionTokens,
          totalTokens: result.usage.totalTokens
        },
        model: model.modelId,
        provider: executionConfig.provider,
        requestId: crypto.randomUUID(),
        finishReason: result.finishReason
      };

    } catch (error: any) {
      throw new Error(`AI execution failed: ${error.message}`);
    }
  }

  private getModel(modelOverride?: string, apiKey?: string, providerOverride?: string, enableWebSearch?: boolean) {
    const provider = providerOverride || this.config.provider;
    let modelName = modelOverride || this.config.model || this.getDefaultModel(provider);
    
    // For OpenRouter, modify model name to enable web search if requested
    if (provider === 'openrouter' && enableWebSearch) {
      modelName = this.getOpenRouterWebSearchModel(modelName, true);
      console.log(`🌐 Using OpenRouter web search model: ${modelName}`);
    }

    // If user provides API key (BYOK), create provider instance with their key
    if (apiKey) {
      const models: Record<ServiceProvider['name'], (model: string, key: string) => unknown> = {
        anthropic: (name, key) => new Anthropic({ apiKey: key }).messages(name),
        openai: (name, key) => new OpenAI({ apiKey: key }).chat(name),
        google: (name, key) => new Google({ apiKey: key }).generativeAI(name),
        openrouter: (name, key) => new OpenAI({ 
          apiKey: key, 
          baseUrl: 'https://openrouter.ai/api/v1' 
        }).chat(name)
      };
      const getModelFn = models[provider as keyof typeof models];
      if (getModelFn === undefined) {
        throw new Error(`Unsupported AI provider: ${provider}`);
      }
      return getModelFn(modelName, apiKey);
    }

    // Use default server-side configuration
    const models: Record<ServiceProvider['name'], (model: string) => unknown> = {
      anthropic: (name) => anthropic.messages(name),
      openai: (name) => openai.chat(name),
      google: (name) => google.generativeAI(name),
      openrouter: (name) => openai.chat(name) // OpenRouter uses OpenAI-compatible interface
    };
    const getModelFn = models[provider as keyof typeof models];
    if (getModelFn === undefined) {
      throw new Error(`Unsupported AI provider: ${provider}`);
    }

    return getModelFn(modelName);
  }

  private getDefaultModel(provider?: string): string {
    const targetProvider = provider || this.config.provider;
    if (!targetProvider) return 'unknown-model';
    
    const defaultModel = this.modelRegistry.getDefaultModel(targetProvider);
    return defaultModel || 'unknown-model';
  }

  /**
   * Perform MCP web search using open-webSearch server
   */
  private async performMCPWebSearch(query: string): Promise<string> {
    try {
      console.log(`🔍 Starting MCP web search with query: "${query}"`);
      console.log(`🕐 Search initiated at: ${new Date().toISOString()}`);
      
      // For now, we'll implement a simple HTTP client to the MCP server
      // Later this can be integrated with the MCP service directly
      const searchResult = await this.callMCPWebSearchServer(query);
      
      if (!searchResult || !searchResult.length) {
        console.log('🔍 No search results found');
        return '';
      }
      
      console.log(`🔍 Formatting ${searchResult.length} search results...`);
      const formattedResults = this.formatMCPSearchResults(query, searchResult);
      console.log(`✅ MCP web search completed successfully with ${formattedResults.length} characters of context`);
      return formattedResults;
      
    } catch (error: any) {
      console.error('🚨 MCP web search failed:', {
        message: error.message,
        name: error.name
      });
      return ''; // Return empty string on failure
    }
  }

  /**
   * Call MCP web search server using the open-webSearch repository
   * This method communicates with the MCP server to perform web searches
   */
  private async callMCPWebSearchServer(query: string): Promise<SearchResult[]> {
    try {
      console.log(`📡 Calling MCP web search server with query: "${query}"`);
      
      if (!this.mcpService) {
        throw new Error('MCP service not initialized for web search');
      }
      
      // Initialize MCP service if not already done
      await this.mcpService.initialize();
      
      // Find available web search tools
      const tools = this.mcpService.getAvailableToolsForAI();
      const webSearchTool = tools.find((tool: any) => 
        tool.name.includes('search') || 
        tool.name.includes('web') ||
        tool.name.toLowerCase().includes('query')
      );
      
      if (!webSearchTool) {
        console.warn('No web search tool found in MCP servers');
        return [];
      }
      
      console.log(`🔍 Using MCP tool: ${webSearchTool.name}`);
      
      // Execute the web search tool
      const toolResponse = await this.mcpService.executeToolForAI({
        name: webSearchTool.name,
        arguments: {
          query: query,
          max_results: 5,
          safe_search: 'moderate'
        }
      });
      
      if (!toolResponse.success) {
        throw new Error(`Web search tool failed: ${toolResponse.error}`);
      }
      
      // Convert MCP tool response to SearchResult format
      const results = this.convertMCPResultsToSearchResults(toolResponse.result);
      console.log(`📡 MCP server returned ${results.length} results`);
      return results;
      
    } catch (error: any) {
      console.error('📡 MCP web search server call failed:', {
        message: error.message,
        name: error.name
      });
      // Return empty results instead of throwing to not break AI requests
      return [];
    }
  }

  /**
   * Format MCP search results for AI context
   */
  private formatMCPSearchResults(query: string, results: SearchResult[]): string {
    console.log(`🔍 Formatting ${results.length} MCP search results for query: "${query}"`);
    
    let formattedResults = `Web Search Results for "${query}":\n\n`;
    
    // Take top 5 results to avoid token limit issues
    const topResults = results.slice(0, 5);
    
    topResults.forEach((result, index) => {
      formattedResults += `${index + 1}. **${result.title}**\n`;
      formattedResults += `   URL: ${result.url}\n`;
      
      // Use description first, then snippet as fallback
      const content = result.description || result.snippet || '';
      if (content) {
        // Limit content length to avoid excessive tokens
        const truncatedContent = content.length > 300 
          ? content.substring(0, 300) + '...' 
          : content;
        formattedResults += `   ${truncatedContent}\n`;
      }
      formattedResults += '\n';
    });
    
    console.log(`✅ Formatted ${topResults.length} MCP search results`);
    return formattedResults;
  }

  /**
   * Prepare AI execution with tools and enhanced system prompt
   */
  private async prepareAIExecution(
    systemPrompt: string, 
    executionConfig: any
  ): Promise<{ enhancedSystemPrompt: string; availableTools: any[] }> {
    let enhancedSystemPrompt = systemPrompt;
    let availableTools: any[] = [];

    // Handle different web search preferences
    if (executionConfig.useWebSearch && executionConfig.webSearchPreference !== 'never') {
      if (executionConfig.webSearchPreference === 'ai-web-search') {
        // Use AI provider's native web search capabilities
        console.log('🌐 Using AI provider native web search');
        const webSearchConfig = {
          maxSearches: executionConfig.maxWebSearches || 5,
          allowedDomains: executionConfig.allowedDomains,
          blockedDomains: executionConfig.blockedDomains,
          userLocation: executionConfig.userLocation
        };
        availableTools = this.getProviderNativeTools(executionConfig.provider, webSearchConfig);
        enhancedSystemPrompt = this.enhanceSystemPromptWithProviderTools(systemPrompt, availableTools);
        
      } else if (executionConfig.webSearchPreference === 'duckduckgo' || executionConfig.webSearchPreference === 'mcp') {
        // Use MCP web search tools
        console.log('🔍 Using MCP web search tools');
        if (this.mcpService) {
          await this.mcpService.initialize();
          const mcpTools = this.mcpService.getAvailableToolsForAI();
          const webSearchTools = mcpTools.filter(tool => 
            tool.name.includes('search') || 
            tool.name.includes('web') ||
            tool.name.toLowerCase().includes('query')
          );
          
          if (webSearchTools.length > 0) {
            availableTools = this.convertMCPToolsToAISDKFormat(webSearchTools);
            enhancedSystemPrompt = this.enhanceSystemPromptWithMCPTools(systemPrompt, webSearchTools);
          }
        }
      }
    }

    return { enhancedSystemPrompt, availableTools };
  }

  /**
   * Get native tools for AI providers (like Claude's web search)
   */
  private getProviderNativeTools(provider?: string, config?: any): any[] {
    switch (provider) {
      case 'anthropic':
        // Claude has native web search tool
        return [{
          type: "web_search_20250305",
          name: "web_search",
          max_uses: config?.maxSearches || 5,
          ...(config?.allowedDomains && { allowed_domains: config.allowedDomains }),
          ...(config?.blockedDomains && { blocked_domains: config.blockedDomains }),
          ...(config?.userLocation && { user_location: config.userLocation })
        }];
      case 'openai':
        // OpenAI web search tool format (update with actual format from docs)
        return [{
          type: "web_search", // Update with actual type from OpenAI docs
          name: "web_search",
          ...(config?.maxSearches && { max_searches: config.maxSearches }),
          ...(config?.allowedDomains && { allowed_domains: config.allowedDomains }),
          ...(config?.blockedDomains && { blocked_domains: config.blockedDomains })
        }]; // TODO: Update with exact OpenAI web search tool format
      case 'google':
        // Google Gemini search grounding tool
        return [{
          googleSearch: {} // Simple Google Search tool - no complex parameters needed
        }];
      case 'openrouter':
        // OpenRouter has universal web search support via :online suffix or web plugin
        // Uses Exa.ai for web search across all 400+ models
        return [{
          type: "web_search",
          name: "web_search", 
          provider: "exa", // OpenRouter uses Exa.ai for web search
          max_results: config?.maxSearches || 5,
          pricing: "$4 per 1000 results"
        }];
      default:
        return [];
    }
  }

  /**
   * Enhance system prompt to explain provider-native tools
   */
  private enhanceSystemPromptWithProviderTools(systemPrompt: string, tools: any[]): string {
    if (tools.length === 0) {
      return `${systemPrompt}

You have access to web search capabilities. When you need to find current information or verify facts, you can search the web. Use this capability judiciously when the user's question would benefit from up-to-date information.`;
    }
    
    const toolDescriptions = tools.map(tool => {
      if (tool.type === 'web_search_20250305') {
        return `- **${tool.name}**: Native web search with up to ${tool.max_uses || 5} searches per request`;
      }
      return `- **${tool.name}**: ${tool.description || 'Provider-native tool'}`;
    }).join('\n');

    return `${systemPrompt}

## Available Native Tools

You have access to the following provider-native tools:

${toolDescriptions}

### Usage Guidelines:
- Use web search when you need current information, recent news, facts, or data that may have changed
- Search intelligently - you can perform multiple searches to gather comprehensive information
- These are native capabilities that execute seamlessly within the AI provider's infrastructure
- Always prioritize accuracy and provide sources when using search results`;
  }

  /**
   * Enhance system prompt to explain MCP tools
   */
  private enhanceSystemPromptWithMCPTools(systemPrompt: string, tools: any[]): string {
    if (tools.length === 0) return systemPrompt;

    const toolDescriptions = tools.map(tool => 
      `- **${tool.name}**: ${tool.description}`
    ).join('\n');

    return `${systemPrompt}

## Available Tools

You have access to the following tools that can help provide better responses:

${toolDescriptions}

### When to Use Tools:
- Use web search tools when you need current information, recent news, or to verify facts
- Only call tools when they would genuinely improve your response quality
- If a tool call fails, continue with your best knowledge-based response

### How to Use Tools:
The tools will be available during our conversation. Call them when needed to gather information that would help answer the user's question more accurately.`;
  }

  /**
   * Convert MCP tools to AI SDK tool format
   */
  private convertMCPToolsToAISDKFormat(mcpTools: any[]): any[] {
    return mcpTools.map(tool => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters || {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query'
          }
        },
        required: ['query']
      }
    }));
  }

  /**
   * Execute tool calls requested by the AI
   */
  private async executeToolCalls(toolCalls: any[]): Promise<any[]> {
    const toolResults: any[] = [];
    
    for (const toolCall of toolCalls) {
      console.log(`🔧 Executing tool: ${toolCall.toolName} with args:`, toolCall.args);
      
      try {
        let result;
        
        if (this.mcpService) {
          // Execute via MCP service
          const mcpResult = await this.mcpService.executeToolForAI({
            name: toolCall.toolName,
            arguments: toolCall.args
          });
          
          result = mcpResult.success ? mcpResult.result : { error: mcpResult.error };
        } else {
          // No MCP service available
          result = { error: 'MCP service not available' };
        }
        
        toolResults.push({
          toolCallId: toolCall.toolCallId,
          toolName: toolCall.toolName,
          result: result,
          success: !result.error
        });
        
      } catch (error) {
        console.error(`🚨 Tool execution failed for ${toolCall.toolName}:`, error);
        toolResults.push({
          toolCallId: toolCall.toolCallId,
          toolName: toolCall.toolName,
          result: { error: error instanceof Error ? error.message : 'Unknown error' },
          success: false
        });
      }
    }
    
    return toolResults;
  }

  /**
   * Continue conversation with tool results
   */
  private async continueWithToolResults(
    originalOptions: any,
    initialResult: any,
    toolResults: any[]
  ): Promise<any> {
    // Build updated messages including tool results
    const messages = [...originalOptions.messages];
    
    // Add AI's initial response (with tool calls)
    messages.push({
      role: 'assistant',
      content: initialResult.text,
      toolCalls: initialResult.toolCalls
    });
    
    // Add tool results
    for (const toolResult of toolResults) {
      messages.push({
        role: 'tool',
        content: JSON.stringify(toolResult.result),
        toolCallId: toolResult.toolCallId
      });
    }
    
    // Generate final response with tool results
    const finalResult = await generateText({
      ...originalOptions,
      messages,
      tools: [], // Don't allow more tool calls in the final response
      toolChoice: 'none'
    });
    
    return finalResult;
  }

  /**
   * Format execute result with tool call information
   */
  private formatExecuteResult(result: any, executionConfig: any): ExecuteResult {
    return {
      content: result.text,
      usage: {
        promptTokens: result.usage.promptTokens,
        completionTokens: result.usage.completionTokens,
        totalTokens: result.usage.totalTokens
      },
      model: result.model || 'unknown',
      provider: executionConfig.provider,
      requestId: crypto.randomUUID(),
      finishReason: result.finishReason
    };
  }

  /**
   * Convert MCP tool results to SearchResult format
   */
  private convertMCPResultsToSearchResults(mcpResults: any): SearchResult[] {
    if (!mcpResults) return [];
    
    // Handle different possible MCP result formats
    let results: any[] = [];
    
    if (Array.isArray(mcpResults)) {
      results = mcpResults;
    } else if (mcpResults.results && Array.isArray(mcpResults.results)) {
      results = mcpResults.results;
    } else if (mcpResults.data && Array.isArray(mcpResults.data)) {
      results = mcpResults.data;
    } else {
      console.warn('Unexpected MCP results format:', mcpResults);
      return [];
    }
    
    return results.map((result: any) => ({
      title: result.title || result.name || 'Untitled',
      url: result.url || result.link || '',
      description: result.description || result.snippet || result.content || '',
      snippet: result.snippet || result.summary || result.description || ''
    }));
  }

  /**
   * Get default system prompts (fallback when not configured)
   */
  private getDefaultSystemPrompts(): Record<string, string> {
    return {
      'code_review': 'You are an expert code reviewer. Analyze the provided code for best practices, potential bugs, security issues, and maintainability. Provide constructive feedback with specific suggestions for improvement.',
      'security_review': 'You are a security expert. Review the provided code for security vulnerabilities, potential attack vectors, and security best practices. Focus on authentication, authorization, input validation, and data protection.',
      'architecture_review': 'You are a software architect. Analyze the provided code for architectural patterns, design principles, scalability concerns, and overall system design. Suggest improvements for better structure and maintainability.',
      'performance_review': 'You are a performance optimization expert. Analyze the provided code for performance bottlenecks, memory usage, algorithm efficiency, and optimization opportunities.',
      'accessibility_review': 'You are an accessibility expert. Review the provided code for accessibility compliance, WCAG guidelines, and inclusive design practices.',
      'documentation_review': 'You are a technical writer. Review the provided code and suggest improvements for documentation, comments, and code clarity.'
    };
  }

  /**
   * Resolve promptId to actual system prompt text
   * First tries to find it in configured prompts, falls back to using as direct text
   */
  private resolveSystemPrompt(promptId: string): string {
    // Try to find in configured system prompts
    const configuredPrompt = this.systemPrompts[promptId.toLowerCase()];
    if (configuredPrompt) {
      console.log(`📋 Using configured prompt: ${promptId}`);
      return configuredPrompt;
    }

    // Fall back to using promptId as direct system prompt text
    console.log(`📝 Using direct system prompt (${promptId.length} chars)`);
    return promptId;
  }


  // getLanguageFromFileName method removed - no longer needed

  /**
   * Test AI service connectivity
   */
  async testConnection(): Promise<{ connected: boolean; provider: string; model: string; error?: string }> {
    try {
      const testResponse = await this.execute({
        content: 'console.log("test");',
        systemPrompt: 'Briefly analyze this code in one sentence.',
        metadata: { name: 'test.js' },
        options: { maxTokens: 50 }
      });

      return {
        connected: true,
        provider: this.config.provider ?? 'unknown',
        model: testResponse.model
      };
    } catch (error: any) {
      return {
        connected: false,
        provider: this.config.provider ?? 'unknown',
        model: this.getDefaultModel(),
        error: error.message
      };
    }
  }

  /**
   * Initialize model registry based on configuration
   */
  private initializeModelRegistry(config?: AIServiceConfig['modelRegistry']): ModelRegistryManager {
    // If custom registry provided, use it directly
    if (config?.customModelRegistry) {
      return config.customModelRegistry;
    }

    // Create registry based on configuration
    const useDefaults = !config?.useCustomRegistry;
    const registry = new ModelRegistryManager(useDefaults);

    // Add additional providers
    if (config?.additionalProviders) {
      for (const provider of config.additionalProviders) {
        registry.addProviderRegistry(provider);
      }
    }

    // Extend existing providers
    if (config?.extendProviders) {
      for (const [provider, extension] of Object.entries(config.extendProviders)) {
        registry.extendProvider(provider, extension.models, extension.newDefaultModel);
      }
    }

    // Replace provider models
    if (config?.replaceProviders) {
      for (const [provider, replacement] of Object.entries(config.replaceProviders)) {
        registry.replaceProviderModels(provider, replacement.models, replacement.newDefaultModel);
      }
    }

    return registry;
  }

  /**
   * Check if a specific OpenRouter model supports web search
   */
  private checkOpenRouterModelWebSearch(model: string): boolean {
    // OpenRouter supports web search via :online suffix for any model
    // But some models may have it enabled by default or have better performance
    const webSearchOptimizedModels = [
      // Models known to work well with web search
      'anthropic/claude-3.5-sonnet',
      'anthropic/claude-3-opus', 
      'openai/gpt-4o',
      'openai/gpt-4-turbo',
      'google/gemini-pro',
      'perplexity/llama-3.1-sonar-large-128k-online', // Already has online in name
      'perplexity/llama-3.1-sonar-small-128k-online',
    ];
    
    // All OpenRouter models support web search via :online suffix
    // But some are already optimized or have online capabilities built-in
    return true; // Universal support via Exa.ai
  }

  /**
   * Get the appropriate model name for web search on OpenRouter
   */
  private getOpenRouterWebSearchModel(model: string, enableWebSearch: boolean): string {
    if (!enableWebSearch) return model;
    
    // If model already has :online suffix, don't add it again
    if (model.includes(':online')) return model;
    
    // For Perplexity online models, they already have web search built-in
    if (model.includes('sonar') && model.includes('online')) return model;
    
    // Add :online suffix to enable web search via Exa.ai
    return `${model}:online`;
  }

  /**
   * Check if provider supports native web search
   */
  supportsNativeWebSearch(provider?: string, model?: string): boolean {
    const targetProvider = provider || this.config.provider;
    switch (targetProvider) {
      case 'anthropic':
        return true; // Claude has web_search_20250305
      case 'openai':
        return true; // GPT-4 has native web search
      case 'google':
        return true; // Gemini has googleSearch grounding
      case 'openrouter':
        return true; // Universal web search via Exa.ai across 400+ models
      default:
        return false;
    }
  }

  /**
   * Get web search capability info for current provider
   */
  getWebSearchCapabilities(provider?: string): {
    supportsNative: boolean;
    supportsMCP: boolean;
    recommendedPreference: 'ai-web-search' | 'mcp' | 'never';
    description: string;
  } {
    const targetProvider = provider || this.config.provider;
    if (!targetProvider) {
      return {
        supportsNative: false,
        supportsMCP: true,
        recommendedPreference: 'mcp',
        description: 'No provider configured'
      };
    }
    
    const capabilities = this.modelRegistry.getWebSearchCapabilities(targetProvider);
    if (capabilities) {
      return {
        supportsNative: capabilities.supportsNative,
        supportsMCP: true, // All providers support MCP
        recommendedPreference: capabilities.recommendedPreference,
        description: capabilities.description
      };
    }

    // Fallback for unknown providers
    return {
      supportsNative: false,
      supportsMCP: true,
      recommendedPreference: 'mcp',
      description: 'Uses MCP tools for web search capabilities'
    };
  }

  /**
   * Get available models for current provider
   */
  getAvailableModels(): string[] {
    if (!this.config.provider) return [];
    
    const models = this.modelRegistry.getModelsForProvider(this.config.provider);
    return models.map(model => model.id);
  }

  /**
   * Get detailed model information for current provider
   */
  getAvailableModelsDetailed(): ModelDefinition[] {
    if (!this.config.provider) return [];
    
    return this.modelRegistry.getModelsForProvider(this.config.provider);
  }

  /**
   * Get models by capability
   */
  getModelsByCapability(capability: ModelCapability, provider?: string): ModelDefinition[] {
    return this.modelRegistry.findModelsByCapability(capability, provider || this.config.provider);
  }

  /**
   * Get deprecated models with warnings
   */
  getDeprecatedModels(provider?: string): Array<ModelDefinition & { warning: string }> {
    return this.modelRegistry.getDeprecatedModels(provider || this.config.provider);
  }

  /**
   * Get current configuration (without API key)
   */
  getConfig() {
    return {
      provider: this.config.provider,
      model: this.config.model || this.getDefaultModel(),
      maxTokens: this.config.maxTokens,
      temperature: this.config.temperature,
      availableModels: this.getAvailableModels(),
      availableModelsDetailed: this.getAvailableModelsDetailed(),
      webSearchCapabilities: this.getWebSearchCapabilities(),
      deprecatedModels: this.getDeprecatedModels(),
      modelRegistry: {
        totalModels: this.modelRegistry.getAllActiveModels().length,
        webSearchModels: this.getModelsByCapability('web-search').length
      }
    };
  }

  /**
   * Get model registry for advanced operations
   */
  getModelRegistry(): ModelRegistryManager {
    return this.modelRegistry;
  }
}

export default AIService;