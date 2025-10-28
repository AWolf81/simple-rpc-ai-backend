/**
 * AI Service using Vercel AI SDK
 *
 * Simple wrapper around Vercel AI SDK for RPC backend services.
 * Handles multiple providers (Anthropic, OpenAI, Google, etc.) seamlessly.
 *
 * TODO: REFACTORING NEEDED - File has grown to 2000+ lines
 *
 * Proposed refactoring plan:
 * - Extract tool execution logic into separate ToolExecutionService class
 *   - executeToolCalls, executeToolCallsWithCustomTools, executeSingleToolCall
 *   - deduplicateToolCalls, formatToolResultForAI
 *   - Tool execution tracking and history management
 *
 * - Extract model management into separate ModelService class
 *   - getModel, getDefaultModel, listAvailableModels
 *   - Provider initialization and configuration
 *   - Model restrictions and validation
 *
 * - Extract conversation continuation into ConversationService class
 *   - continueWithToolResults, formatExecuteResult
 *   - Message formatting and conversion
 *   - Multi-step iteration loop logic
 *
 * - Keep AIService as orchestrator with core execute/executeStream methods
 *   - Coordinate between ModelService, ToolExecutionService, ConversationService
 *   - Maintain backward compatibility with existing API
 */

import { generateText, streamText, tool as createTool, convertToModelMessages, jsonSchema } from 'ai';
import { createAnthropic, anthropic } from '@ai-sdk/anthropic';
import { createOpenAI, openai } from '@ai-sdk/openai';
import { createGoogleGenerativeAI, google } from '@ai-sdk/google';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { InferenceClient } from '@huggingface/inference';
import crypto from 'crypto';
import { LanguageModel } from 'ai';
import { MCPService, MCPServiceConfig } from '../mcp/mcp-service';
import { ModelRegistry } from './model-registry';
import { hybridRegistry } from './hybrid-model-registry';
import type { ModelInfo } from './model-registry';
import { TimingLogger } from '../../utils/timing';
import { logger } from '../../utils/logger';
import type { Tool as ProviderTool } from '@ai-sdk/provider-utils';
import type { UIMessage } from 'ai';
import yaml from 'js-yaml';

/**
 * Configuration options for Hugging Face model adapter
 */
interface HuggingFaceModelConfig {
  apiKey: string;
  /**
   * Method to use for text generation:
   * - 'auto': Try textGeneration first, fallback to chatCompletion on error
   * - 'textGeneration': Use textGeneration API only
   * - 'chatCompletion': Use chatCompletion API only
   */
  method?: 'auto' | 'textGeneration' | 'chatCompletion';
  /**
   * Whether to enable automatic fallback between methods (only for 'auto' mode)
   */
  enableFallback?: boolean;
}

/**
 * Create a Hugging Face model adapter for Vercel AI SDK
 */
function createHuggingFaceModel(modelId: string, config: string | HuggingFaceModelConfig): LanguageModel {
  // Support both string (backward compatibility) and config object
  const apiKey = typeof config === 'string' ? config : config.apiKey;
  const method = typeof config === 'object' ? (config.method || 'auto') : 'auto';
  const enableFallback = typeof config === 'object' ? (config.enableFallback !== false) : true;
  const hf = new InferenceClient(apiKey);

  return {
    specificationVersion: 'v2',
    modelId,
    provider: 'huggingface',
    supportedUrls: {},
    async doGenerate(options) {
      try {
        // Convert messages to HF format
        const prompt = options.prompt
          ?.map(msg => {
            if (msg.role === 'system') {
              return `System: ${msg.content}`;
            } else if (msg.role === 'user') {
              return `User: ${msg.content}`;
            } else if (msg.role === 'assistant') {
              return `Assistant: ${msg.content}`;
            }
            return msg.content;
          })
          .join('\n\n') || '';

        let response;
        let text;

        // Helper function for text generation
        const tryTextGeneration = async () => {
          response = await hf.textGeneration({
            model: modelId,
            inputs: prompt,
            parameters: {
              max_new_tokens: (options as any).maxTokens || 4000,
              temperature: (options as any).temperature || 0.7,
              return_full_text: false,
            },
          });
          return typeof response === 'string' ? response : response.generated_text;
        };

        // Helper function for chat completion
        const tryChatCompletion = async () => {
          const messages = options.prompt?.map(msg => ({
            role: msg.role as 'user' | 'assistant' | 'system',
            content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)
          })) || [{ role: 'user' as const, content: prompt }];

          response = await hf.chatCompletion({
            model: modelId,
            messages: messages,
            max_tokens: (options as any).maxTokens || 4000,
            temperature: (options as any).temperature || 0.7,
          });

          return response.choices?.[0]?.message?.content || '';
        };

        // Execute based on configured method
        if (method === 'textGeneration') {
          // Use textGeneration API only
          text = await tryTextGeneration();
        } else if (method === 'chatCompletion') {
          // Use chatCompletion API only
          text = await tryChatCompletion();
        } else {
          // Auto mode: try textGeneration first, fallback to chatCompletion
          try {
            text = await tryTextGeneration();
          } catch (textGenError: any) {
            if (enableFallback && textGenError.message?.includes('conversational')) {
              logger.debug('🔄 Switching to chat completion API for model:', modelId);
              text = await tryChatCompletion();
            } else {
              throw textGenError;
            }
          }
        }

        const generatedText = text || '';
        const inputTokens = Math.ceil(prompt.length / 4);
        const outputTokens = Math.ceil(generatedText.length / 4);
        const totalTokens = inputTokens + outputTokens;

        return {
          content: generatedText
            ? [{ type: 'text' as const, text: generatedText }]
            : [],
          finishReason: 'stop' as const,
          usage: {
            inputTokens,
            outputTokens,
            totalTokens,
          },
          providerMetadata: undefined,
          response: {
            modelId,
          },
          warnings: [],
        };
      } catch (error: any) {
        throw new Error(`Hugging Face API error: ${error.message}`);
      }
    },
    async doStream() {
      throw new Error('Streaming not yet implemented for Hugging Face provider');
    },
  };
}

// Type exports for external usage
export type ModelDefinition = ModelInfo;
export type ModelCapability = string;

export interface AIServiceConfig {
  provider?: 'anthropic' | 'openai' | 'google' | 'openrouter' | 'huggingface'; // selected in constructor & used
  defaultProvider?: 'anthropic' | 'openai' | 'google' | 'openrouter' | 'huggingface'; // default provider optional, defaults to serviceProvider with highest priority
  serviceProviders?: ServiceProvidersConfig;
  systemPrompts?: Record<string, string>; // Custom system prompt definitions
  apiKey?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  maxToolIterations?: number;
  mcpConfig?: MCPServiceConfig; // MCP service configuration for web search
  
  // Model Registry Configuration
  modelRegistry?: {
    registryConfig?: Partial<import('../../config/model-safety').ModelSafetyConfig>;
  };
  
  // Model Restrictions Configuration
  modelRestrictions?: Record<string, {
    allowedModels?: string[];
    allowedPatterns?: string[];
    blockedModels?: string[];
  }>;
}

export interface ExecuteRequest {
  content: string;
  promptId?: string; // Can be a key (like "code_review") or direct text
  systemPrompt?: string; // Legacy - for backward compatibility
  messages?: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>; // Conversation history
  tools?: Array<{
    name: string;
    description: string;
    parameters: any; // JSON Schema
    execute?: (args: any) => Promise<any>; // Optional execution function for custom tools
  }>;
  metadata?: {
    name?: string;
    type?: string;
    provider?: string;
    model?: string;
    maxTokens?: number;
    temperature?: number;
    maxToolIterations?: number;
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
  toolCalls?: Array<{
    name: string;
    arguments: any;
    result: any;
  }>;
  progressMessages?: string[];
}

export interface SearchResult {
  title: string;
  url: string;
  description?: string;
  snippet?: string;
}

interface ServiceProvider {
  name: 'anthropic' | 'openai' | 'google' | 'openrouter' | 'huggingface';
  apiKey: string;
  priority: number;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  baseURL?: string; // For OpenRouter, Hugging Face, and custom endpoints
  // Hugging Face specific options
  huggingfaceMethod?: 'auto' | 'textGeneration' | 'chatCompletion';
  huggingfaceEnableFallback?: boolean;
}

// Allow either an object mapping provider names to partial config,
// or an array of full ServiceProvider entries
export type ServiceProvidersConfig =
  | {
      anthropic?: Partial<Omit<ServiceProvider, 'name' | 'priority'>> & { priority?: number };
      openai?: Partial<Omit<ServiceProvider, 'name' | 'priority'>> & { priority?: number };
      google?: Partial<Omit<ServiceProvider, 'name' | 'priority'>> & { priority?: number };
      openrouter?: Partial<Omit<ServiceProvider, 'name' | 'priority'>> & { priority?: number };
      huggingface?: Partial<Omit<ServiceProvider, 'name' | 'priority'>> & { priority?: number };
    }
  | ServiceProvider[];

// ModelType removed - no longer needed

function normalizeServiceProviders(
  spConfig: ServiceProvidersConfig | undefined
): ServiceProvider[] {
  if (!spConfig) return [];

  if (Array.isArray(spConfig)) {
    // Convert string array to ServiceProvider array
    return spConfig.map((provider, index) => {
      if (typeof provider === 'string') {
        return {
          name: provider as 'anthropic' | 'openai' | 'google' | 'openrouter' | 'huggingface',
          apiKey: '',
          priority: index,
          model: undefined,
          maxTokens: undefined,
          temperature: undefined,
        };
      } else {
        // Already a ServiceProvider object
        return provider;
      }
    });
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

  if (spConfig.huggingface) {
    providers.push({
      name: 'huggingface',
      apiKey: spConfig.huggingface.apiKey ?? '',
      priority: spConfig.huggingface.priority ?? 0,
      model: spConfig.huggingface.model,
      maxTokens: spConfig.huggingface.maxTokens,
      temperature: spConfig.huggingface.temperature,
      baseURL: spConfig.huggingface.baseURL ?? 'https://api-inference.huggingface.co',
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
  private modelRegistry: ModelRegistry; // Unified registry with safety features
  private modelRestrictions?: Record<string, {
    allowedModels?: string[];
    allowedPatterns?: string[];
    blockedModels?: string[];
  }>;
  private toolExecutionTracker = new Map<string, Promise<any>>(); // Track ongoing tool executions by ID to prevent duplicates

  constructor(config: AIServiceConfig) {
    // Initialize system prompts from config or use defaults
    this.systemPrompts = config.systemPrompts || this.getDefaultSystemPrompts();
    // Initialize model restrictions
    this.modelRestrictions = config.modelRestrictions;
    if(config.serviceProviders) {
      logger.debug(`🔍 AIService received serviceProviders config:`, JSON.stringify(config.serviceProviders, null, 2));
      this.providers = normalizeServiceProviders(config.serviceProviders);
      logger.debug(`🔍 Normalized providers:`, this.providers.map(p => `${p.name} (hasKey: ${!!p.apiKey})`));
      if (this.providers.length === 0) {
        throw new Error('No valid AI service providers configured.');
      }

      // If providers came from an array, assign priority by array index:
      if (Array.isArray(config.serviceProviders)) {
        const serviceProvidersArray = config.serviceProviders;
        this.providers.forEach((p) => {
          // Handle both string arrays and ServiceProvider arrays
          const priority = serviceProvidersArray.findIndex(sp => 
            typeof sp === 'string' ? sp === p.name : sp.name === p.name
          );
          p.priority = priority >= 0 ? priority : 999; // Default low priority if not found
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
      logger.debug("service", this.mcpService)
    } else if (config.systemPrompts) {
      // If system prompts are configured, enable MCP for potential web search
      this.mcpService = new MCPService({ enableWebSearch: true });
    }

    // Initialize model registry
    // Initialize unified model registry
    this.modelRegistry = new ModelRegistry(config.modelRegistry?.registryConfig);
  }
  /**
   * Execute AI request with system prompt using Vercel AI SDK
   */
  async execute(request: ExecuteRequest): Promise<ExecuteResult> {
    const timing = new TimingLogger('SERVICE');

    const { content, promptId, systemPrompt: legacySystemPrompt, metadata = {}, options = {}, apiKey } = request;

    // Support both promptId (new) and systemPrompt (legacy) for backwards compatibility
    const actualPromptId = promptId || legacySystemPrompt;
    if (!actualPromptId) {
      throw new Error('Either promptId or systemPrompt must be provided');
    }
    let t1 = timing.checkpoint('Request validation');

    // Check for model deprecation warnings
    const modelToUse = metadata.model || options.model || this.config.model;
    const providerToUse = metadata.provider || this.config.provider;
    if (modelToUse && providerToUse) {
      const deprecationCheck = this.modelRegistry.checkModelDeprecation(providerToUse, modelToUse);
      if (deprecationCheck.deprecated && deprecationCheck.warning) {
        logger.warn(deprecationCheck.warning);
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
      maxToolIterations: metadata.maxToolIterations ?? this.config.maxToolIterations ?? 4,
      useWebSearch: metadata.useWebSearch || false,
      webSearchPreference: metadata.webSearchPreference || 'duckduckgo'
    };

    // Debug logging (privacy-safe - no user content)
    logger.debug('🔍 AI Execute Debug:');
    logger.debug(`   System Prompt: ${systemPrompt ? `[${systemPrompt.length} chars]` : 'MISSING'}`);
    logger.debug(`   User Content: ${content ? `[${content.length} chars]` : 'MISSING'}`);
    logger.debug(`   Raw metadata: ${JSON.stringify(metadata)}`);
    logger.debug(`   Raw options.model: ${options.model}`);
    logger.debug(`   Raw this.config.provider: ${this.config.provider}`);
    logger.debug(`   Provider calculation: metadata.provider='${metadata.provider}' || this.config.provider='${this.config.provider}'`);
    logger.debug(`   Provider: ${executionConfig.provider} ${metadata.provider ? '(from metadata)' : '(default)'}`);
    logger.debug(`   executionConfig.model raw value: ${executionConfig.model}`);
    logger.debug(`   Model: ${executionConfig.model || 'default'}`);
    logger.debug(`   API Key: ${apiKey ? 'Provided' : 'None'}`);
    logger.debug(`   Web Search: ${executionConfig.useWebSearch ? executionConfig.webSearchPreference : 'DISABLED'}`);
    logger.debug(`   Max tool iterations: ${executionConfig.maxToolIterations}`);

    // Debug model creation
    logger.debug(`🔧 Model Debug: Creating model for provider=${executionConfig.provider}, model=${executionConfig.model || 'default'}`);

    // Get the AI model provider (with user's API key if provided)
    const modelResult = await this.getModel(
      executionConfig.model,
      apiKey,
      executionConfig.provider,
      executionConfig.useWebSearch
    );
    const model = modelResult as Parameters<typeof generateText>[0]['model'];
    let t2 = timing.checkpoint('Model retrieved', t1);

    // Track the resolved model name for error reporting
    const resolvedModelName = (model as any).modelId || (model as any).model || 'unknown';

    // Prepare tools and enhanced system prompt
    const { enhancedSystemPrompt, availableTools } = await this.prepareAIExecution(
      systemPrompt,
      executionConfig,
      request.tools // Pass custom tools (skills, agent tools, etc.)
    );
    let t3 = timing.checkpoint('Prepared AI execution', t2);

    // Create the user prompt from content
    const userPrompt = content;

    // Build messages array - use provided messages or create new one
    let conversationMessages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
    if (request.messages && request.messages.length > 0) {
      // Check if current message is already in the history to avoid duplicates
      const lastMessage = request.messages[request.messages.length - 1];
      const isDuplicate = lastMessage && lastMessage.role === 'user' && lastMessage.content === userPrompt;

      if (isDuplicate) {
        // Current message already in history, just use the provided messages
        conversationMessages = [...request.messages];
        logger.debug(`📝 Current message already in history, skipping duplicate`);
      } else {
        // Append current message to history
        conversationMessages = [
          ...request.messages,
          { role: 'user', content: userPrompt }
        ];
        logger.debug(`📝 Appended current message to conversation history`);
      }
    } else {
      // Simple single-message case
      conversationMessages = [
        { role: 'user', content: userPrompt }
      ];
    }

    try {
      const normalizedMessages = conversationMessages.map(msg => ({
        role: msg.role,
        parts: [{
          type: 'text' as const,
          text: msg.content
        }]
      })) as Array<Omit<UIMessage, 'id'>>;

      const modelMessages = convertToModelMessages(normalizedMessages);

      let generateOptions: any = {
        model,
        system: enhancedSystemPrompt,  // System prompt is separate, not in messages array
        messages: modelMessages,
        maxTokens: executionConfig.maxTokens || this.config.maxTokens || 4000,
        temperature: executionConfig.temperature || this.config.temperature || 0.3,
      };

      // Add tools if available
      const hasTools = Array.isArray(availableTools) ? availableTools.length > 0 : Object.keys(availableTools).length > 0;
      if (hasTools) {
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

      logger.debug('🚀 About to call generateText with:');
      logger.debug(`   Model type: ${typeof model}`);
      logger.debug(`   Model constructor: ${model.constructor?.name}`);
      logger.debug(`   Model ID: ${(model as any)?.modelId || 'unknown'}`);
      logger.debug(`   Model spec:`, (model as any)?.specificationVersion);
      logger.debug(`   Model provider: ${(model as any)?.provider}`);
      logger.debug(`   Generate options keys: ${Object.keys(generateOptions)}`);
      logger.debug(`   Max tokens: ${generateOptions.maxTokens}`);
      logger.debug(`   Messages count: ${normalizedMessages.length}`);
      logger.debug(`   Has tools: ${hasTools}`);
      if (hasTools) {
        const toolNames = Object.keys(availableTools);
        logger.debug(`   Tool names: ${toolNames.join(', ')}`);
        toolNames.forEach(name => {
          const tool = availableTools[name];
          logger.debug(`   Tool ${name}:`, {
            hasDescription: !!tool.description,
            hasExecute: !!tool.execute,
            inputSchemaKeys: tool.parameters ? Object.keys(tool.parameters) : 'none'
          });
        });
      }
      logger.debug(`   Messages:`, JSON.stringify(normalizedMessages, null, 2));

      let t4 = timing.checkpoint('Calling generateText (Vercel AI SDK)', t3);
      let result = await generateText(generateOptions);
      let t5 = timing.checkpoint('generateText completed', t4);

      const allToolHistory: Array<{ name: string; arguments: any; result: any }> = [];
      const progressMessages: string[] = [];
      const progressCallback = (message: string) => {
        progressMessages.push(message);
        logger.info(`[progress] ${message}`);
      };

      // Execute tool calls if present and tools are available - with iteration loop
      if (executionConfig.webSearchPreference !== 'ai-web-search' && hasTools && result.toolCalls && result.toolCalls.length > 0) {
        const maxSteps = typeof executionConfig.maxToolIterations === 'number'
          ? Math.max(1, executionConfig.maxToolIterations)
          : 4;

        logger.info(`🔧 AI requested ${result.toolCalls.length} tool call(s), max steps: ${maxSteps}`);

        try {
          let currentResult = result;
          let currentOptions = generateOptions;
          let stepCount = 0;
          const cachedResultsBySignature = new Map<string, { result: any; success: boolean }>();
          const executedToolCallIds = new Set<string>();

          // Loop until no more tool calls or max steps reached
          while (currentResult.toolCalls && currentResult.toolCalls.length > 0 && stepCount < maxSteps) {
            stepCount++;
            logger.info(`🔄 Tool iteration ${stepCount}/${maxSteps}...`);

            // Deduplicate tool calls - prevent AI from calling same tool with same args multiple times in one turn
            logger.info(`🔍 Checking ${currentResult.toolCalls.length} tool calls for duplicates...`);
            currentResult.toolCalls.forEach((tc: any, idx: number) => {
              logger.info(`   [${idx}] ${tc.toolName} with args: ${JSON.stringify(tc.args || {})}`);
            });

            const seenToolSignatures = new Set<string>();
            const deduplicatedToolCalls = currentResult.toolCalls.filter((tc: any) => {
              const signature = `${tc.toolName}:${JSON.stringify(tc.args || {})}`;
              if (seenToolSignatures.has(signature)) {
                logger.warn(`⚠️  SKIPPING DUPLICATE: ${tc.toolName} with args ${JSON.stringify(tc.args)}`);
                return false;
              }
              seenToolSignatures.add(signature);
              return true;
            });

            if (deduplicatedToolCalls.length < currentResult.toolCalls.length) {
              logger.warn(`🔧 DEDUPLICATION ACTIVE: Reduced ${currentResult.toolCalls.length} tool calls down to ${deduplicatedToolCalls.length}`);
            } else {
              logger.info(`✅ No duplicates detected in this turn`);
            }

            // Use deduplicated tool calls for execution
            const toolCallsToExecute = deduplicatedToolCalls.length < currentResult.toolCalls.length
              ? deduplicatedToolCalls
              : currentResult.toolCalls;

            // Execute the requested tool calls
            const toolCallResults = await this.executeToolCallsWithCustomTools(
              toolCallsToExecute,
              request.tools,
              progressCallback,
              executedToolCallIds,
              cachedResultsBySignature
            );

            // Check for interaction marker
            if (toolCallResults.__interaction_required__) {
              logger.info(`🔔 Interaction detected - pausing agent execution`);
              logger.info(`   Looking for tool: ${toolCallResults.toolName}`);
              logger.info(`   Available tool calls: ${currentResult.toolCalls.map((tc: any) => tc.toolName).join(', ')}`);

              // Find the original tool call to get arguments
              const originalToolCall: any = currentResult.toolCalls.find(
                (tc: any) => tc.toolName === toolCallResults.toolName
              );

              logger.info(`   Found original tool call: ${!!originalToolCall}`);
              if (originalToolCall) {
                logger.info(`   Original tool call structure:`, JSON.stringify(originalToolCall, null, 2));
              }

              // Extract arguments properly using our extraction method
              const toolArguments = originalToolCall ? this.extractToolArguments(originalToolCall) : {};
              logger.info(`   Extracted tool arguments:`, JSON.stringify(toolArguments, null, 2));

              return {
                type: 'interaction_required',
                interaction: toolCallResults.interaction,
                toolName: toolCallResults.toolName,
                originalToolName: toolCallResults.originalToolName || toolCallResults.toolName,
                toolCallId: toolCallResults.toolCallId,
                toolArguments,  // Use properly extracted tool arguments
                scriptArgs: toolCallResults.scriptArgs,
                stdin: toolCallResults.stdin,
                cwd: toolCallResults.cwd,
                skillId: toolCallResults.skillId,
                scriptName: toolCallResults.scriptName,
                partialContent: currentResult.text || '',
                toolCalls: allToolHistory,
                usage: {
                  promptTokens: currentResult.usage.inputTokens || 0,
                  completionTokens: currentResult.usage.outputTokens || 0,
                  totalTokens: currentResult.usage.totalTokens || 0
                }
              } as any;
            }

            // Track the tool executions in history (only deduplicated ones that were actually executed)
            toolCallsToExecute.forEach((tc) => {
              const toolCallId = (tc as any).toolCallId;
              allToolHistory.push({
                name: (tc as any).toolName,
                arguments: this.extractToolArguments(tc),
                result: toolCallResults[toolCallId]?.result || {}
              });
            });

            logger.info(`✅ Tool execution completed: ${allToolHistory.length} total tool call(s) executed`);

            // Continue conversation with tool results
            // Allow further tool calls only if we haven't reached max steps
            const allowMoreTools = stepCount < maxSteps;
            logger.info(`🔄 Continuing conversation with tool results (allow more tools: ${allowMoreTools})...`);

            const continuationResult = await this.continueWithToolResults(
              currentOptions,
              currentResult,
              Object.values(toolCallResults),
              allowMoreTools
            );

            // Update for next iteration
            currentResult = continuationResult.result;
            currentOptions = continuationResult.options;

            // If no more tool calls or finish reason is stop, we're done
            if (!currentResult.toolCalls || currentResult.toolCalls.length === 0 || currentResult.finishReason === 'stop') {
              logger.info(`✅ Tool iteration completed - finishReason: ${currentResult.finishReason}`);
              break;
            }
          }

          // Update final result
          result = currentResult;

          if (stepCount >= maxSteps && result.toolCalls && result.toolCalls.length > 0) {
            logger.warn(`⚠️  Reached max tool iterations (${maxSteps}), stopping even though AI wants more tool calls`);
          }

          logger.info(`✅ All tool executions completed: ${allToolHistory.length} total call(s) in ${stepCount} iteration(s)`);
        } catch (agentError) {
          logger.error(`❌ Tool execution failed:`, agentError);
          logger.error(`   Error details:`, agentError);
          // Fall back to using the initial result
          logger.warn(`⚠️  Falling back to initial result without tool execution`);
        }
      }

      timing.end();

      const promptTokens = result.usage.inputTokens ?? (result.usage as any).promptTokens ?? 0;
      const completionTokens = result.usage.outputTokens ?? (result.usage as any).completionTokens ?? 0;
      const totalTokens = result.usage.totalTokens ?? (promptTokens + completionTokens);

      // If there were tool calls processed, include the tool history in the response
      if (allToolHistory.length > 0) {
        return this.formatExecuteResult(result, executionConfig, undefined, undefined, allToolHistory, progressMessages);
      }

      return {
        content: result.text,
        usage: {
          promptTokens,
          completionTokens,
          totalTokens
        },
        model: typeof model === 'string' ? model : model.modelId,
        provider: executionConfig.provider,
        requestId: crypto.randomUUID(),
        finishReason: result.finishReason,
        progressMessages
      };

    } catch (error: any) {
      // Simplified unified error handling for all providers
      const provider = executionConfig.provider;
      const modelForError = resolvedModelName || executionConfig.model || 'default';
      const statusCode = error.statusCode || error.status;
      
      // Log detailed error for debugging
      logger.error(`🚨 ${provider.toUpperCase()} API Error:`, {
        provider,
        model: modelForError,
        originalModel: executionConfig.model,
        resolvedModel: resolvedModelName,
        message: error.message,
        statusCode,
        responseBody: error.responseBody || error.body || 'N/A',
        responseText: typeof error.text === 'string' ? error.text.substring(0, 500) : 'N/A'
      });
      
      // Generate user-friendly error message
      let errorMessage = `${provider} API error`;
      if (statusCode === 401) {
        errorMessage += `: Invalid API key (401)`;
      } else if (statusCode === 403) {
        errorMessage += `: Access forbidden - API key may not support model "${modelForError}" (403)`;
      } else if (statusCode === 404 || error.message === 'Not Found') {
        errorMessage += `: Model "${modelForError}" not found or API key invalid (404)`;
      } else {
        errorMessage += `: ${error.message}`;
      }
      
      // Instead of throwing, return a proper error response that can be handled by the caller
      return {
        content: `Error: ${errorMessage}`,
        usage: {
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0
        },
        model: modelForError,
        provider: provider,
        requestId: crypto.randomUUID(),
        finishReason: 'error',
        progressMessages: [`❌ ${errorMessage}`]
      };
    }
  }

  /**
   * Execute AI request with streaming support
   * Returns an async generator that yields text chunks as they arrive
   */
  async *executeStream(request: ExecuteRequest): AsyncGenerator<string, void, unknown> {
    const { content, promptId, systemPrompt: legacySystemPrompt, metadata = {}, options = {}, apiKey } = request;

    // Support both promptId (new) and systemPrompt (legacy)
    const actualPromptId = promptId || legacySystemPrompt;
    if (!actualPromptId) {
      throw new Error('Either promptId or systemPrompt must be provided');
    }

    // Resolve promptId to actual system prompt text
    const systemPrompt = this.resolveSystemPrompt(actualPromptId);

    // Merge metadata into execution options
    const executionConfig = {
      provider: metadata.provider || this.config.provider,
      model: metadata.model || options.model,
      maxTokens: metadata.maxTokens || options.maxTokens,
      temperature: metadata.temperature || options.temperature,
      useWebSearch: metadata.useWebSearch || false,
      webSearchPreference: metadata.webSearchPreference || 'duckduckgo'
    };

    logger.debug('🌊 AI Stream Execute:');
    logger.debug(`   Provider: ${executionConfig.provider}`);
    logger.debug(`   Model: ${executionConfig.model || 'default'}`);

    // Get the AI model provider
    const modelResult = await this.getModel(
      executionConfig.model,
      apiKey,
      executionConfig.provider,
      executionConfig.useWebSearch
    );
    const model = modelResult as Parameters<typeof streamText>[0]['model'];

    // Prepare tools and enhanced system prompt
    const { enhancedSystemPrompt, availableTools } = await this.prepareAIExecution(
      systemPrompt,
      executionConfig,
      request.tools // Pass custom tools (skills, agent tools, etc.)
    );

    const userPrompt = content;

    try {
      const streamOptions: any = {
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
        streamOptions.tools = availableTools;
        streamOptions.toolChoice = 'auto';
      }

      logger.debug('🌊 Starting stream with model:', (model as any).modelId || 'unknown');

      const result = await streamText(streamOptions);

      // Stream text chunks as they arrive
      for await (const textPart of result.textStream) {
        yield textPart;
      }

    } catch (error: any) {
      logger.error('Stream execution error:', error);
      throw new Error(`Stream execution failed: ${error.message}`);
    }
  }

  private async getModel(modelOverride?: string, apiKey?: string, providerOverride?: string, enableWebSearch?: boolean) {
    const provider = providerOverride || this.config.provider;

    // Debug logging to see what we receive
    logger.debug(`🔧 getModel() called with: modelOverride='${modelOverride}', provider='${provider}'`);
    logger.debug(`🔧 apiKey parameter: ${apiKey ? 'provided' : 'none'}`);
    logger.debug(`🔧 Available providers: ${JSON.stringify(this.providers.map(p => ({ name: p.name, hasKey: !!p.apiKey })))}`);

    // Handle 'auto' and 'default' as special cases that should trigger default model selection
    let modelName: string;
    if (!modelOverride || modelOverride === 'auto' || modelOverride === 'default' || modelOverride === 'undefined') {
      logger.debug(`🔧 Triggering default model selection (modelOverride was '${modelOverride}')`);
      modelName = this.config.model || await this.getDefaultModel(provider);
      logger.debug(`🔧 Resolved to default model: ${modelName}`);
    } else {
      logger.debug(`🔧 Using explicit model: ${modelOverride}`);
      modelName = modelOverride;
    }
    
    // Validate model restrictions
    const validation = this.validateModelRestrictions(provider!, modelName);
    if (!validation.allowed) {
      const errorMessage = validation.error || `Model ${modelName} not allowed for provider ${provider}`;
      const suggestionText = validation.suggestions?.length 
        ? ` Allowed models: ${validation.suggestions.join(', ')}`
        : '';
      throw new Error(`${errorMessage}.${suggestionText}`);
    }
    
    // Fix Google model names that come from the registry
    // Registry has "gemini-1-5-flash" but Google SDK expects "gemini-1.5-flash"
    if (provider === 'google') {
      modelName = this.normalizeGoogleModelName(modelName);
      logger.debug(`🔧 Normalized Google model name: ${modelName}`);
    }
    
    // For OpenRouter, modify model name to enable web search if requested
    if (provider === 'openrouter' && enableWebSearch) {
      modelName = this.getOpenRouterWebSearchModel(modelName, true);
      logger.debug(`🌐 Using OpenRouter web search model: ${modelName}`);
    }

    // If user provides API key (BYOK), create provider instance with their key
    if (apiKey) {
      const models: Record<ServiceProvider['name'], (model: string, key: string) => unknown> = {
        anthropic: (name, key) => createAnthropic({ apiKey: key })(name),
        openai: (name, key) => createOpenAI({ apiKey: key })(name),
        google: (name, key) => createGoogleGenerativeAI({ apiKey: key })(name),
        openrouter: (name, key) => createOpenRouter({
          apiKey: key
        })(name),
        huggingface: (name, key) => createHuggingFaceModel(name, key)
      };
      const getModelFn = models[provider as keyof typeof models];
      if (getModelFn === undefined) {
        throw new Error(`Unsupported AI provider: ${provider}`);
      }
      return getModelFn(modelName, apiKey);
    }

    // Use default server-side configuration
    // For ALL providers, check if we have API keys from provider config first
    const currentProvider = this.providers.find(p => p.name === provider);
    const providerApiKey = currentProvider?.apiKey;

    if (providerApiKey) {
      logger.debug(`🔧 [FIXED VERSION] Using ${provider} API key from provider configuration (key length: ${providerApiKey.length})`);
      // Create provider instances with explicit API keys
      const modelsWithApiKey: Record<ServiceProvider['name'], (model: string) => unknown> = {
        anthropic: (name) => createAnthropic({ apiKey: providerApiKey })(name),
        openai: (name) => createOpenAI({ apiKey: providerApiKey })(name),
        google: (name) => createGoogleGenerativeAI({ apiKey: providerApiKey })(name),
        openrouter: (name) => createOpenRouter({
          apiKey: providerApiKey
        })(name),
        huggingface: (name) => createHuggingFaceModel(name, {
          apiKey: providerApiKey,
          method: currentProvider?.huggingfaceMethod || 'auto',
          enableFallback: currentProvider?.huggingfaceEnableFallback !== false
        })
      };

      const getModelFn = modelsWithApiKey[provider as keyof typeof modelsWithApiKey];
      if (getModelFn) {
        return getModelFn(modelName);
      }
    }
    
    // Fallback to environment variables for helper functions
    // Ensure Google environment variable mapping
    if (provider === 'google') {
      if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY && process.env.GOOGLE_API_KEY) {
        process.env.GOOGLE_GENERATIVE_AI_API_KEY = process.env.GOOGLE_API_KEY;
        logger.debug('🔧 Mapped GOOGLE_API_KEY to GOOGLE_GENERATIVE_AI_API_KEY for Vercel AI SDK');
      }
    }

    logger.debug(`🔧 Using ${provider} helper function with environment variables`);
    const models: Record<ServiceProvider['name'], (model: string) => unknown> = {
      anthropic: (name) => anthropic(name),
      openai: (name) => openai(name),
      google: (name) => google(name),
      openrouter: (name) => {
        const openrouterApiKey = process.env.OPENROUTER_API_KEY;
        if (!openrouterApiKey) {
          throw new Error('OPENROUTER_API_KEY environment variable is required for OpenRouter provider');
        }
        return createOpenRouter({
          apiKey: openrouterApiKey
        })(name);
      },
      huggingface: (name) => {
        const hfApiKey = process.env.HUGGINGFACE_API_KEY || process.env.HF_TOKEN;
        if (!hfApiKey) {
          throw new Error('HUGGINGFACE_API_KEY or HF_TOKEN environment variable is required for Hugging Face provider');
        }
        return createHuggingFaceModel(name, hfApiKey);
      }
    };
    const getModelFn = models[provider as keyof typeof models];
    if (getModelFn === undefined) {
      throw new Error(`Unsupported AI provider: ${provider}`);
    }

    return getModelFn(modelName);
  }

  private async getDefaultModel(provider?: string): Promise<string> {
    const targetProvider = provider || this.config.provider;
    if (!targetProvider) return 'unknown-model';

    // For Hugging Face, provide a sensible default until model registry supports it
    if (targetProvider === 'huggingface') {
      return 'meta-llama/Llama-2-7b-chat-hf'; // Popular free chat model
    }

    return await this.modelRegistry.getDefaultModel(targetProvider);
  }

  /**
   * Perform MCP web search using open-webSearch server
   */
  private async performMCPWebSearch(query: string): Promise<string> {
    try {
      logger.debug(`🔍 Starting MCP web search with query: "${query}"`);
      logger.debug(`🕐 Search initiated at: ${new Date().toISOString()}`);

      // For now, we'll implement a simple HTTP client to the MCP server
      // Later this can be integrated with the MCP service directly
      const searchResult = await this.callMCPWebSearchServer(query);

      if (!searchResult || !searchResult.length) {
        logger.debug('🔍 No search results found');
        return '';
      }

      logger.debug(`🔍 Formatting ${searchResult.length} search results...`);
      const formattedResults = this.formatMCPSearchResults(query, searchResult);
      logger.debug(`✅ MCP web search completed successfully with ${formattedResults.length} characters of context`);
      return formattedResults;
      
    } catch (error: any) {
      logger.error('🚨 MCP web search failed:', {
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
      logger.debug(`📡 Calling MCP web search server with query: "${query}"`);
      
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
        logger.warn('No web search tool found in MCP servers');
        return [];
      }

      logger.debug(`🔍 Using MCP tool: ${webSearchTool.name}`);
      
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
      logger.debug(`📡 MCP server returned ${results.length} results`);
      return results;
      
    } catch (error: any) {
      logger.error('📡 MCP web search server call failed:', {
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
    logger.debug(`🔍 Formatting ${results.length} MCP search results for query: "${query}"`);
    
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

    logger.debug(`✅ Formatted ${topResults.length} MCP search results`);
    return formattedResults;
  }

  /**
   * Prepare AI execution with tools and enhanced system prompt
   */
  private async prepareAIExecution(
    systemPrompt: string,
    executionConfig: any,
    customTools?: any[]
  ): Promise<{ enhancedSystemPrompt: string; availableTools: any }> {
    let enhancedSystemPrompt = systemPrompt;
    let availableTools: any = {}; // Tools can be object or array

    // Include custom tools first (skills, agent tools, etc.)
    if (customTools && customTools.length > 0) {
      // Convert tools to Vercel AI SDK format
      // Tools should be an object with tool names as keys
      const toolsObject: Record<string, any> = {};

      customTools.forEach(tool => {
        const params = tool.parameters || { type: 'object', properties: {}, required: [] };
        logger.debug(`🔧 Converting tool: ${tool.name}, schema type: ${params.type}, schema:`, JSON.stringify(params, null, 2));

        // Validate that params has required 'type' field
        if (!params.type) {
          logger.warn(`⚠️  Tool ${tool.name} parameters missing 'type' field, adding it`);
          params.type = 'object';
        }

        // Get execute function
        let executeFunction: ((args: any) => Promise<any>) | undefined;
        if (typeof tool.execute === 'function') {
          executeFunction = async (args: any) => {
            return await tool.execute(args);
          };
        } else if (typeof tool.run === 'function') {
          executeFunction = async (args: any) => {
            return await tool.run(args);
          };
        }

        // Use the tool() helper from Vercel AI SDK for proper format
        // The AI SDK v5 tool() function expects: { description?, inputSchema, execute? }
        // Note: Use inputSchema (camelCase) for AI SDK v5+, not parameters
        // Note: inputSchema must be wrapped in jsonSchema() helper for plain JSON schemas
        const createdTool = createTool({
          description: tool.description || `Execute ${tool.name}`,
          inputSchema: jsonSchema(params), // Wrap JSON schema with jsonSchema() helper
          execute: executeFunction
        });

        // Add to tools object
        toolsObject[tool.name] = createdTool;
      });

      // AI SDK v5+ expects tools as a Record<string, Tool>, not an array
      // Keep as Record for proper tool registration
      availableTools = toolsObject;
      logger.debug(`✅ Converted ${customTools.length} custom tools to AI SDK format (as Record)`);
    }

    // Handle different web search preferences
    if (executionConfig.useWebSearch && executionConfig.webSearchPreference !== 'never') {
      if (executionConfig.webSearchPreference === 'ai-web-search') {
        // Use AI provider's native web search capabilities
        logger.debug('🌐 Using AI provider native web search');
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
        logger.debug('🔍 Using MCP web search tools');
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
  private async executeToolCalls(
    toolCalls: any[],
    customTools?: any[],
    progressCallback?: (message: string) => void
  ): Promise<any[]> {
    const toolResults: any[] = [];

    // Note: Deduplication now happens at a higher level (before this method is called)
    // Helper function to create friendly progress messages
    const formatWithPrefix = (tool: string, message: string): string =>
      `🛠️ ${tool}: ${message}`;

    const createProgressMessage = (toolName: string, args: any, status: 'starting' | 'done' | 'failed'): string => {
      // Extract common arguments
      const filePath = args?.['file-path'] || args?.filePath || args?.path || args?.file;
      const pattern = args?.pattern;
      const content = args?.content;
      const scriptArgs = args?.args;

      // Detect operation type from tool name
      const isWrite = toolName.includes('write');
      const isRead = toolName.includes('read');
      const isSearch = toolName.includes('search');
      const isDelete = toolName.includes('delete');
      const isScriptCaller = toolName.includes('script_caller');

      if (status === 'starting') {
        // File operations
        if (isWrite && filePath) {
          return formatWithPrefix(
            toolName,
            content ? `Writing to ${filePath}` : `Creating ${filePath}`
          );
        }
        if (isRead && filePath) {
          return formatWithPrefix(toolName, `Reading ${filePath}`);
        }
        if (isDelete && filePath) {
          return formatWithPrefix(toolName, `Deleting ${filePath}`);
        }
        if (isSearch && pattern) {
          return formatWithPrefix(toolName, `Searching for ${pattern}`);
        }
        if (isSearch && filePath) {
          return formatWithPrefix(toolName, `Looking for ${filePath}`);
        }

        // Script execution
        if (isScriptCaller && scriptArgs) {
          const cmd = Array.isArray(scriptArgs) ? scriptArgs[0] : scriptArgs;
          return formatWithPrefix(toolName, `Running ${cmd}`);
        }

        // Generic fallback with friendly name
        const friendlyName = toolName
          .replace(/file_handling_/g, '')
          .replace(/script_caller_/g, '')
          .replace(/_/g, ' ');
        return formatWithPrefix(toolName, `Working on ${friendlyName}`);

      } else if (status === 'done') {
        // Completed operations
        if (isWrite && filePath) {
          return formatWithPrefix(toolName, `✓ Wrote ${filePath}`);
        }
        if (isRead && filePath) {
          return formatWithPrefix(toolName, `✓ Read ${filePath}`);
        }
        if (isDelete && filePath) {
          return formatWithPrefix(toolName, `✓ Deleted ${filePath}`);
        }
        if (isSearch && (pattern || filePath)) {
          return formatWithPrefix(toolName, '✓ Search complete');
        }
        if (isScriptCaller && scriptArgs) {
          const cmd = Array.isArray(scriptArgs) ? scriptArgs[0] : scriptArgs;
          return formatWithPrefix(toolName, `✓ Ran ${cmd}`);
        }

        // Generic success
        const friendlyName = toolName
          .replace(/file_handling_/g, '')
          .replace(/script_caller_/g, '')
          .replace(/_/g, ' ');
        return formatWithPrefix(toolName, `✓ ${friendlyName}`);

      } else {
        // Failed operations
        const friendlyName = toolName
          .replace(/file_handling_/g, '')
          .replace(/script_caller_/g, '')
          .replace(/_/g, ' ');
        return formatWithPrefix(toolName, `⚠️ ${friendlyName} failed`);
      }
    };

    // This method executes the already-deduplicated tool calls
    for (const toolCall of toolCalls) {
      logger.info('🧾 Raw tool call payload:', JSON.stringify(toolCall, null, 2));
      progressCallback?.(createProgressMessage(toolCall.toolName, toolCall.args, 'starting'));

      // Check if this tool call ID is already being executed to prevent concurrent duplicates
      if (this.toolExecutionTracker.has(toolCall.toolCallId)) {
        logger.warn(`⚠️  Tool call ID already in progress: ${toolCall.toolCallId} for tool ${toolCall.toolName}`);
        // Wait for the existing execution to complete and reuse its result
        const existingResult = await this.toolExecutionTracker.get(toolCall.toolCallId);
        toolResults.push({
          ...existingResult,
          toolCallId: toolCall.toolCallId  // Ensure correct ID
        });
        continue; // Skip duplicate execution
      }
      
      // Privacy: Don't log user input - only log tool name
      logger.debug(`🔧 Executing tool: ${toolCall.toolName} (ID: ${toolCall.toolCallId})`);

      try {
        // Create a promise for the tool execution and track it
        const executionPromise = this.executeSingleToolCall(toolCall, customTools);

        // Track the execution by toolCallId to prevent concurrent duplicate executions
        this.toolExecutionTracker.set(toolCall.toolCallId, executionPromise);

        const result = await executionPromise;
        if (!result?.error) {
          progressCallback?.(createProgressMessage(toolCall.toolName, toolCall.args, 'done'));
        }

        // Check for user interaction IMMEDIATELY after each tool
        if (result && typeof result === 'object' && result.__interaction_required__) {
          logger.info(`🔔 User interaction detected in ${toolCall.toolName} - stopping tool execution`);
          // Return early with just this one result - don't execute remaining tools
          return [{
            toolCallId: toolCall.toolCallId,
            toolName: toolCall.toolName,
            result
          }];
        }

        toolResults.push({
          toolCallId: toolCall.toolCallId,
          toolName: toolCall.toolName,
          result: result,
          success: !result.error
        });
        
      } catch (error) {
        logger.error(`🚨 Tool execution failed for ${toolCall.toolName}:`, error);
        progressCallback?.(createProgressMessage(toolCall.toolName, toolCall.args, 'failed') + `: ${error instanceof Error ? error.message : 'Unknown error'}`);
        toolResults.push({
          toolCallId: toolCall.toolCallId,
          toolName: toolCall.toolName,
          result: { error: error instanceof Error ? error.message : 'Unknown error' },
          success: false
        });
      } finally {
        // Clean up the tracker after execution completes
        this.toolExecutionTracker.delete(toolCall.toolCallId);
      }
    }
    
    // Ensure tracker is fully cleared between requests
    this.toolExecutionTracker.clear();

    return toolResults;
  }

  /**
   * Execute tool calls and return results as a Map indexed by toolCallId
   */
  private async executeToolCallsWithCustomTools(
    toolCalls: any[],
    customTools?: any[],
    progressCallback?: (message: string) => void,
    executedToolCallIds?: Set<string>,
    cachedResultsBySignature?: Map<string, { result: any; success: boolean }>
  ): Promise<Record<string, any>> {
    const {
      uniqueToolCalls,
      allToolCallIds,
      signatureByToolCallId
    } = this.deduplicateToolCalls(toolCalls);

    if (uniqueToolCalls.length !== toolCalls.length) {
      logger.info(`🔁 Deduplicated tool calls: received ${toolCalls.length}, executing ${uniqueToolCalls.length}`);
    }

    const executedIds = executedToolCallIds ?? new Set<string>();
    const cachedBySignature = cachedResultsBySignature ?? new Map<string, { result: any; success: boolean }>();
    const uniqueResults: Array<{ toolCallId: string; toolName: string; result: any; success: boolean }> = [];

    const callsToExecute: any[] = [];

    for (const toolCall of uniqueToolCalls) {
      const signature = signatureByToolCallId.get(toolCall.toolCallId);
      const alreadyExecuted = executedIds.has(toolCall.toolCallId);

      if (alreadyExecuted && signature && cachedBySignature.has(signature)) {
        const cached = cachedBySignature.get(signature)!;
        logger.info(`🔁 Skipping re-execution of ${toolCall.toolName} (toolCallId=${toolCall.toolCallId}) - already executed in this iteration`);
        uniqueResults.push({
          toolCallId: toolCall.toolCallId,
          toolName: toolCall.toolName,
          result: cached.result,
          success: cached.success
        });
        logger.debug(`🧠 Reusing cached result for tool ${toolCall.toolName} (signature: ${signature})`);
        continue;
      }

      if (signature && cachedBySignature.has(signature)) {
        const cached = cachedBySignature.get(signature)!;
        executedIds.add(toolCall.toolCallId);
        logger.info(`♻️ Reusing cached result for ${toolCall.toolName} (signature=${signature})`);
        uniqueResults.push({
          toolCallId: toolCall.toolCallId,
          toolName: toolCall.toolName,
          result: cached.result,
          success: cached.success
        });
        logger.debug(`🧠 Using cached result for repeated tool ${toolCall.toolName} (signature: ${signature})`);
        continue;
      }

      callsToExecute.push(toolCall);
    }

    const freshResults = await this.executeToolCalls(callsToExecute, customTools, progressCallback);
    freshResults.forEach(result => {
      if (result.toolCallId) {
        executedIds.add(result.toolCallId);
        const signature = signatureByToolCallId.get(result.toolCallId);
        if (signature) {
          cachedBySignature.set(signature, {
            result: result.result,
            success: result.success !== false
          });
        }
      }
    });

    uniqueResults.push(...freshResults);

    // Check for interaction markers in results
    for (const result of uniqueResults) {
      if (result.result && typeof result.result === 'object' && result.result.__interaction_required__) {
        logger.info(`🔔 User interaction required - detected in tool ${result.toolName}`);
        const marker = result.result as any;
        // Return special marker that will be detected by execute()
        return {
          __interaction_required__: true,
          interaction: marker.interaction,
          toolName: marker.toolName || result.toolName,
          originalToolName: marker.originalToolName || marker.toolName || result.toolName,
          toolCallId: result.toolCallId,
          toolArguments: marker.toolArguments,
          scriptArgs: marker.scriptArgs,
          stdin: marker.stdin,
          cwd: marker.cwd,
          skillId: marker.skillId,
          scriptName: marker.scriptName,
          originalResults: uniqueResults
        } as any;
      }
    }

    const mappedResults = this.mapResultsToAllIds(uniqueResults, allToolCallIds);

    // Convert array to Record indexed by toolCallId
    const resultsMap: Record<string, any> = {};
    mappedResults.forEach(result => {
      resultsMap[result.toolCallId] = result;
    });

    return resultsMap;
  }

  /**
   * Execute a single tool call
   */
  private async executeSingleToolCall(toolCall: any, customTools?: any[]) {
    try {
      let result;

      // Check if it's a custom tool first (skills, agent tools)
      const customTool = customTools?.find(t => t.name === toolCall.toolName);
      const rawArgs = this.extractToolArguments(toolCall);

      if (customTool && customTool.execute) {
        logger.info(`🎯 Executing custom tool: ${toolCall.toolName}`);
        logger.info(`   Raw args type: ${typeof rawArgs}`, typeof rawArgs === 'string' ? rawArgs : JSON.stringify(rawArgs, null, 2));
        const parsedArgs = this.parseToolArguments(rawArgs);
        logger.info(`   Parsed args:`, typeof parsedArgs === 'string' ? parsedArgs : JSON.stringify(parsedArgs, null, 2));
        result = await customTool.execute(parsedArgs);
      } else if (this.mcpService) {
        // Execute via MCP service
        logger.info(`🔌 Executing MCP tool: ${toolCall.toolName}`);
        logger.info(`   Raw args type: ${typeof rawArgs}`, typeof rawArgs === 'string' ? rawArgs : JSON.stringify(rawArgs, null, 2));
        const parsedArgs = this.parseToolArguments(rawArgs);
        logger.info(`   Parsed args:`, typeof parsedArgs === 'string' ? parsedArgs : JSON.stringify(parsedArgs, null, 2));
        const mcpResult = await this.mcpService.executeToolForAI({
          name: toolCall.toolName,
          arguments: parsedArgs
        });

        result = mcpResult.success ? mcpResult.result : { error: mcpResult.error };
      } else {
        // Attempt numeric fallback (LLMs sometimes reply with menu numbers)
        const availableCustomTools = customTools?.map(t => t.name) || [];
        const numericMatch = typeof toolCall.toolName === 'string' && /^\d+$/.test(toolCall.toolName);
        if (numericMatch && availableCustomTools.length > 0) {
          const numericIndex = parseInt(toolCall.toolName, 10) - 1; // LLMs tend to use 1-based numbering
          const fallbackTool = customTools?.[numericIndex];
          if (fallbackTool && fallbackTool.execute) {
            logger.warn(`⚠️  Tool name "${toolCall.toolName}" is numeric. Using fallback tool "${fallbackTool.name}" at index ${numericIndex + 1}.`);
            logger.info(`   Raw args type: ${typeof rawArgs}`, typeof rawArgs === 'string' ? rawArgs : JSON.stringify(rawArgs, null, 2));
            const parsedArgs = this.parseToolArguments(rawArgs);
            logger.info(`   Parsed args:`, typeof parsedArgs === 'string' ? parsedArgs : JSON.stringify(parsedArgs, null, 2));
            result = await fallbackTool.execute(parsedArgs);
          } else {
            logger.warn(`⚠️  Numeric tool index "${toolCall.toolName}" did not map to a known tool. Available tools: ${availableCustomTools.join(', ') || 'none'}`);
            result = { error: 'MCP service not available' };
          }
        } else {
          // No MCP service available / tool not found
          logger.warn(`⚠️  Custom tool not found: ${toolCall.toolName}. Available tools: ${availableCustomTools.join(', ') || 'none'}`);
          result = { error: 'MCP service not available' };
        }
      }
      
      return result;
    } catch (error) {
      logger.error(`🚨 Tool execution failed for ${toolCall.toolName}:`, error);
      return { error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Extract raw arguments from various tool call formats returned by providers.
   */
  private extractToolArguments(toolCall: any): unknown {
    if (!toolCall) {
      return undefined;
    }

    if (toolCall.args !== undefined) {
      return toolCall.args;
    }

    if (toolCall.arguments !== undefined) {
      return toolCall.arguments;
    }

    if (toolCall.input !== undefined) {
      return toolCall.input;
    }

    if (Array.isArray(toolCall.content)) {
      const inputJsonPart = toolCall.content.find((part: any) => part?.type === 'input_json' && part?.input_json !== undefined);
      if (inputJsonPart) {
        return inputJsonPart.input_json;
      }

      const textPart = toolCall.content.find((part: any) => part?.type === 'text' && typeof part?.text === 'string');
      if (textPart) {
        return textPart.text;
      }
    }

    if (typeof toolCall.argsText === 'string') {
      return toolCall.argsText;
    }

    // As a last resort, log the unexpected shape for debugging
    logger.warn('⚠️  Unable to determine tool call arguments from payload:', toolCall);

    return undefined;
  }

  /**
   * Normalize tool arguments from AI SDK responses.
   * Some providers return JSON strings; parse those into objects when possible.
   */
  private parseToolArguments(rawArgs: unknown): unknown {
    if (typeof rawArgs !== 'string') {
      return rawArgs;
    }

    const trimmed = rawArgs.trim();
    if (
      (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
      (trimmed.startsWith('[') && trimmed.endsWith(']'))
    ) {
      try {
        const parsed = JSON.parse(trimmed);
        logger.info('✅ Parsed tool arguments from JSON string.', typeof parsed === 'string' ? parsed : JSON.stringify(parsed, null, 2));
        return parsed;
      } catch (error) {
        logger.warn('Failed to parse tool arguments as JSON, using raw string:', {
          error: error instanceof Error ? error.message : error,
          rawArgs
        });
        try {
          const yamlParsed = yaml.load(trimmed);
          if (yamlParsed !== undefined) {
            logger.info('✅ Parsed tool arguments via YAML loader.', typeof yamlParsed === 'string' ? yamlParsed : JSON.stringify(yamlParsed, null, 2));
            return yamlParsed;
          }
        } catch (yamlError) {
          logger.warn('Failed to parse tool arguments via YAML loader:', {
            error: yamlError instanceof Error ? yamlError.message : yamlError,
            rawArgs
          });
        }
      }
    }

    return rawArgs;
  }

  /**
   * Deduplicate tool calls based on tool name and arguments
   * Returns unique calls and a mapping of all IDs to their canonical call
   */
  private deduplicateToolCalls(toolCalls: any[]): {
    uniqueToolCalls: any[];
    allToolCallIds: Map<string, string>; // all IDs -> canonical ID
    signatureByToolCallId: Map<string, string>;
  } {
    const signatureToCanonical = new Map<string, any>();
    const allToolCallIds = new Map<string, string>();
    const uniqueToolCalls: any[] = [];
    const signatureByToolCallId = new Map<string, string>();

    for (const toolCall of toolCalls) {
      const toolCallId = toolCall.toolCallId || toolCall.id || crypto.randomUUID();
      if (!toolCall.toolCallId) {
        toolCall.toolCallId = toolCallId;
      }

      // Create signature based on tool name and arguments
      const args = this.extractToolArguments(toolCall);
      const signatureArgs = this.stableStringifyForSignature(args);
      const signature = `${toolCall.toolName}(${signatureArgs})`;

      if (signatureToCanonical.has(signature)) {
        // Duplicate - map this ID to canonical ID
        const canonicalCall = signatureToCanonical.get(signature)!;
        allToolCallIds.set(toolCallId, canonicalCall.toolCallId);
        logger.debug(`   🔄 Duplicate detected: ${toolCallId} → ${canonicalCall.toolCallId}`);
      } else {
        // First occurrence - this is canonical
        const canonicalToolCall = {
          ...toolCall,
          toolCallId
        };
        signatureToCanonical.set(signature, canonicalToolCall);
        allToolCallIds.set(toolCallId, toolCallId);
        uniqueToolCalls.push(canonicalToolCall);
      }

      signatureByToolCallId.set(toolCallId, signature);
    }

    return { uniqueToolCalls, allToolCallIds, signatureByToolCallId };
  }

  /**
   * Produce a stable string representation of tool arguments for deduplication.
   */
  private stableStringifyForSignature(value: unknown): string {
    if (value === null) {
      return 'null';
    }
    if (value === undefined) {
      return 'undefined';
    }
    if (typeof value === 'string') {
      return JSON.stringify(value);
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      return JSON.stringify(value);
    }
    if (Array.isArray(value)) {
      return `[${value.map(item => this.stableStringifyForSignature(item)).join(',')}]`;
    }
    if (typeof value === 'object') {
      const entries = Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, val]) => `${JSON.stringify(key)}:${this.stableStringifyForSignature(val)}`);
      return `{${entries.join(',')}}`;
    }
    return JSON.stringify(value);
  }

  /**
   * Map execution results from unique calls to all original tool call IDs
   */
  private mapResultsToAllIds(
    uniqueResults: any[],
    allToolCallIds: Map<string, string>
  ): any[] {
    // Build map of canonical ID -> result
    const canonicalResults = new Map<string, any>();
    uniqueResults.forEach(result => {
      canonicalResults.set(result.toolCallId, result);
    });

    // Map results to all original IDs
    const allResults: any[] = [];
    allToolCallIds.forEach((canonicalId, originalId) => {
      const result = canonicalResults.get(canonicalId);
      if (result) {
        allResults.push({
          ...result,
          toolCallId: originalId // Use original ID for proper conversation tracking
        });
      } else {
        logger.warn(`⚠️  No result found for canonical ID: ${canonicalId}`);
        allResults.push({
          toolCallId: originalId,
          result: { error: 'Result not found' },
          success: false
        });
      }
    });

    return allResults;
  }

  /**
   * Format tool result for AI consumption
   * Extracts the meaningful content from tool execution results
   * Limits output to ~25k tokens (100k chars) to prevent context overflow
   */
  private formatToolResultForAI(result: any): any {
    // If result is null or undefined, return as-is
    if (result == null) {
      return result;
    }

    let formattedResult: any;

    // If result has a success/exitCode structure (from skill tools)
    if (typeof result === 'object' && 'success' in result) {
      // If successful, return the actual output
      if (result.success) {
        // Prefer stdout if available (most tool output goes here)
        if (result.stdout && typeof result.stdout === 'string' && result.stdout.trim()) {
          formattedResult = result.stdout;
        }
        // Fall back to stderr if stdout is empty
        else if (result.stderr && typeof result.stderr === 'string' && result.stderr.trim()) {
          formattedResult = result.stderr;
        }
        // If both are empty, return a success message
        else {
          formattedResult = 'Operation completed successfully';
        }
      } else {
        // If failed, return error information
        const errorMsg = result.stderr || result.error || 'Operation failed';
        formattedResult = `Error: ${errorMsg}`;
      }
    } else {
      // For other results, use as-is
      formattedResult = result;
    }

    // Limit size to ~25k tokens (approximately 100k characters)
    // Using 4 chars per token as rough estimate
    const MAX_TOKENS = 25000;
    const MAX_CHARS = MAX_TOKENS * 4; // 100k characters

    if (typeof formattedResult === 'string' && formattedResult.length > MAX_CHARS) {
      const truncated = formattedResult.substring(0, MAX_CHARS);
      const removedChars = formattedResult.length - MAX_CHARS;
      return `${truncated}\n\n... [Output truncated: ${removedChars} characters removed to stay within token limits]`;
    }

    return formattedResult;
  }

  /**
   * Continue conversation with tool results
   * Properly formats messages for Vercel AI SDK v5+ to understand tool execution
   */
  private async continueWithToolResults(
    originalOptions: any,
    initialResult: any,
    toolResults: any[],
    allowFurtherTools: boolean
  ): Promise<{ options: any; result: any }> {
    // Deduplicate tool results by toolCallId
    const uniqueToolResults = new Map();
    toolResults.forEach(toolResult => {
      if (!uniqueToolResults.has(toolResult.toolCallId)) {
        uniqueToolResults.set(toolResult.toolCallId, toolResult);
      } else {
        logger.warn(`⚠️  Duplicate tool result detected for ID: ${toolResult.toolCallId}, ignoring`);
      }
    });

    const toolCallResults: Record<string, any> = {};
    uniqueToolResults.forEach((toolResult, toolCallId) => {
      // Format tool result for AI consumption
      const formattedResult = this.formatToolResultForAI(toolResult.result);
      toolCallResults[toolCallId] = formattedResult;

      // Log what we're passing to the AI
      logger.debug(`📤 Formatted tool result for AI (ID: ${toolCallId}):`);
      logger.debug(`   Raw result type: ${typeof toolResult.result}`);
      logger.debug(`   Formatted result type: ${typeof formattedResult}`);
      logger.debug(`   Formatted result (first 200 chars): ${typeof formattedResult === 'string' ? formattedResult.substring(0, 200) : JSON.stringify(formattedResult).substring(0, 200)}`);
    });

    // CRITICAL FIX: Properly construct message array for AI SDK v5+
    // Build tool invocations with results embedded in assistant message
    const existingMessages = Array.isArray(originalOptions.messages)
      ? [...originalOptions.messages]
      : [];

    // Ensure we have valid tool calls array
    if (!initialResult.toolCalls || !Array.isArray(initialResult.toolCalls)) {
      logger.error('❌ Invalid toolCalls in initialResult:', initialResult);
      throw new Error('Invalid tool calls structure');
    }

    // Normalize existing messages to UIMessage format
    // They might have 'content' instead of 'parts'
    const normalizedExisting = existingMessages.map((msg: any) => {
      if (msg.parts) {
        // Already in UIMessage format
        return msg;
      }
      // Convert from ModelMessage format (has 'content') to UIMessage format (has 'parts')
      if (msg.content) {
        return {
          role: msg.role,
          parts: Array.isArray(msg.content) ? msg.content : [{
            type: 'text' as const,
            text: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)
          }]
        };
      }
      // Fallback - assume it's already correct
      return msg;
    });

    // Build UIMessages with tool invocations that include results
    const toolInvocations = initialResult.toolCalls.map((tc: any) => {
      const args = this.extractToolArguments(tc);
      const result = toolCallResults[tc.toolCallId];

      return {
        state: 'result' as const,
        toolCallId: tc.toolCallId,
        toolName: tc.toolName,
        args: args !== undefined ? args : {},
        result: result !== undefined ? result : null
      };
    });

    // Add assistant message with tool results to accumulate conversation history
    const assistantWithToolResults: any = {
      role: 'assistant' as const,
      parts: [
        {
          type: 'text' as const,
          text: initialResult.text || ''
        }
      ],
      toolInvocations: toolInvocations.length > 0 ? toolInvocations : undefined
    };

    // ALSO add a user message that explicitly describes the tool results
    // This helps models that don't properly handle toolInvocations
    const toolResultsSummary = toolInvocations.map(inv => {
      const resultText = typeof inv.result === 'string'
        ? inv.result.substring(0, 1000)  // Limit length
        : JSON.stringify(inv.result).substring(0, 1000);
      return `Tool ${inv.toolName} returned:\n${resultText}`;
    }).join('\n\n');

    const userPromptWithResults: Omit<UIMessage, 'id'> = {
      role: 'user' as const,
      parts: [
        {
          type: 'text' as const,
          text: `The tool(s) have been executed. Here are the results:\n\n${toolResultsSummary}\n\nIMPORTANT: Use these tool results to complete the original task. If the results show file paths or partial information, call additional tools as needed to fully answer the question. Do not just acknowledge the tool execution - use the information to provide a complete answer.`
        }
      ]
    };

    const uiMessages: Array<Omit<UIMessage, 'id'>> = [
      ...normalizedExisting,
      assistantWithToolResults,
      userPromptWithResults  // Add explicit results message
    ];

    // Convert UIMessages to ModelMessages for AI SDK
    let modelMessages;
    try {
      modelMessages = convertToModelMessages(uiMessages);
    } catch (conversionError) {
      logger.error('❌ Failed to convert UIMessages to ModelMessages:', conversionError);
      logger.debug('UIMessages:', JSON.stringify(uiMessages, null, 2));
      throw conversionError;
    }

    // CRITICAL: Update the original options with accumulated messages for next iteration
    const continueOptions = {
      ...originalOptions,
      messages: modelMessages,  // This will now include all previous messages + tool results
      tools: allowFurtherTools ? originalOptions.tools : {},  // Empty object to disable tools
      toolChoice: allowFurtherTools ? (originalOptions.toolChoice ?? 'auto') : 'none'  // Explicitly disable tool calling
    };

    logger.debug(`🔄 Continuing with ${uniqueToolResults.size} tool results`);
    logger.info(`🔍 Built ${modelMessages.length} model messages from ${uiMessages.length} UI messages`);
    
    const nextResult = await generateText(continueOptions);

    return {
      options: continueOptions,
      result: nextResult
    };
  }

  /**
   * Format execute result with tool call information
   */
  private formatExecuteResult(
    result: any,
    executionConfig: any,
    toolCalls?: any[],
    toolResults?: any[],
    toolHistory?: Array<{ name: string; arguments: any; result: any }>,
    progressMessages?: string[]
  ): ExecuteResult {
    const promptTokens = result.usage.inputTokens ?? (result.usage as any).promptTokens ?? 0;
    const completionTokens = result.usage.outputTokens ?? (result.usage as any).completionTokens ?? 0;
    const totalTokens = result.usage.totalTokens ?? (promptTokens + completionTokens);

    // Format tool executions if present
    let formattedToolCalls: Array<{ name: string; arguments: any; result: any }> | undefined;
    if (toolHistory && toolHistory.length > 0) {
      formattedToolCalls = toolHistory;
    } else if (toolCalls && toolResults) {
      formattedToolCalls = toolCalls.map((tc, index) => ({
        name: tc.toolName,
        arguments: this.extractToolArguments(tc),
        result: toolResults[index]?.result || {}
      }));
    }

    return {
      content: result.text,
      usage: {
        promptTokens,
        completionTokens,
        totalTokens
      },
      model: result.response?.modelId || executionConfig.model || 'unknown',
      provider: executionConfig.provider,
      requestId: crypto.randomUUID(),
      finishReason: result.finishReason,
      toolCalls: formattedToolCalls,
      progressMessages: progressMessages ?? []
    };
  }

  /**
   * Normalize tool call history entries for logging/serialization
   */
  private formatToolCallHistory(toolCalls: any[], toolResults: any[]): Array<{ name: string; arguments: any; result: any }> {
    if (!toolCalls || toolCalls.length === 0) {
      return [];
    }

    const resultsById = new Map<string, any>();
    toolResults.forEach(tr => {
      if (tr && tr.toolCallId) {
        resultsById.set(tr.toolCallId, tr.result);
      }
    });

    return toolCalls.map(tc => ({
      name: tc.toolName,
      arguments: this.extractToolArguments(tc),
      result: resultsById.get(tc.toolCallId) ?? {}
    }));
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
      logger.warn('Unexpected MCP results format:', mcpResults);
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
      logger.debug(`📋 Using configured prompt: ${promptId}`);
      return configuredPrompt;
    }

    // Fall back to using promptId as direct system prompt text
    logger.debug(`📝 Using direct system prompt (${promptId.length} chars)`);
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
        model: await this.getDefaultModel(),
        error: error.message
      };
    }
  }

  // Old initializeModelRegistry method removed - now using SafeModelRegistry directly

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
   * Normalize Google model names from registry format to SDK format
   * Registry has "gemini-1-5-flash" but Google SDK expects "gemini-1.5-flash"
   * All Google models require the "models/" prefix for Vercel AI SDK
   */
  private normalizeGoogleModelName(modelName: string): string {
    // Common Google model mappings - all values include required "models/" prefix
    const modelMappings: Record<string, string> = {
      // Gemini 2.5 models (latest cost-efficient)
      'gemini-2-5-flash': 'models/gemini-2.5-flash',
      'gemini-2-5-pro': 'models/gemini-2.5-pro',
      // Gemini 2.0 models
      'gemini-2-0-flash': 'models/gemini-2.0-flash',
      'gemini-2-0-flash-exp': 'models/gemini-2.0-flash',
      'gemini-2-0-pro': 'models/gemini-2.0-pro',
      // Gemini 1.5 models (stable and widely supported)
      'gemini-1-5-flash': 'models/gemini-1.5-flash',
      'gemini-1-5-flash-8b': 'models/gemini-1.5-flash-8b',
      'gemini-1-5-pro': 'models/gemini-1.5-pro',
      'gemini-1-0-pro': 'models/gemini-1.0-pro',
      'gemini-pro': 'models/gemini-pro',
      'gemini-pro-vision': 'models/gemini-pro-vision',
      // Default fallback for weird registry names (use stable model)
      '123-versions': 'models/gemini-2.0-flash',
      'calendar-month-deprecation-date': 'models/gemini-2.0-flash',
      'calendar-month-latest-update': 'models/gemini-2.0-flash',
      'cognition-2-knowledge-cutoff': 'models/gemini-2.0-flash'
    };

    // Check if we have a direct mapping
    if (modelMappings[modelName]) {
      return modelMappings[modelName];
    }

    // Try to convert pattern: gemini-X-Y-name to gemini-X.Y-name
    if (modelName.startsWith('gemini-')) {
      const normalized = modelName.replace(/gemini-(\d)-(\d)/, 'gemini-$1.$2');
      if (normalized !== modelName) {
        return normalized;
      }
    }

    // If no mapping found and it doesn't look like a valid model, use default
    if (!modelName.includes('gemini') && !modelName.includes('palm')) {
      logger.warn(`⚠️ Unknown Google model '${modelName}', using default 'models/gemini-2.0-flash'`);
      return 'models/gemini-2.0-flash';
    }

    // Ensure Google models have the required "models/" prefix for Vercel AI SDK
    const finalModel = modelName;
    if (!finalModel.startsWith('models/')) {
      logger.debug(`🔧 Adding required "models/" prefix for Google model: ${finalModel} → models/${finalModel}`);
      return `models/${finalModel}`;
    }

    return finalModel;
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
   * Get available models for specified or current provider
   */
  async getAvailableModels(provider?: string): Promise<string[]> {
    const targetProvider = provider || this.config.provider;
    if (!targetProvider) return [];

    // For Hugging Face, provide a curated list until model registry supports it
    if (targetProvider === 'huggingface') {
      return [
        'meta-llama/Llama-2-7b-chat-hf',
        'meta-llama/Llama-2-13b-chat-hf',
        'meta-llama/Meta-Llama-3-8B-Instruct',
        'meta-llama/Meta-Llama-3.1-8B-Instruct',
        'microsoft/DialoGPT-medium',
        'microsoft/DialoGPT-large',
        'tiiuae/falcon-7b-instruct',
        'tiiuae/falcon-40b-instruct',
        'mistralai/Mistral-7B-Instruct-v0.1',
        'mistralai/Mistral-7B-Instruct-v0.2',
        'mistralai/Mixtral-8x7B-Instruct-v0.1',
        'NousResearch/Nous-Hermes-2-Mixtral-8x7B-DPO',
        'openchat/openchat-3.5-1210',
        'teknium/OpenHermes-2.5-Mistral-7B',
        'HuggingFaceH4/zephyr-7b-beta'
      ];
    }

    const models = await this.modelRegistry.getModelsForProvider(targetProvider);
    return models.map(model => model.id);
  }

  /**
   * Get detailed model information for specified or current provider
   */
  async getAvailableModelsDetailed(provider?: string): Promise<ModelDefinition[]> {
    const targetProvider = provider || this.config.provider;
    if (!targetProvider) return [];

    // For Hugging Face, provide detailed model information until model registry supports it
    if (targetProvider === 'huggingface') {
      return [
        { id: 'meta-llama/Llama-2-7b-chat-hf', name: 'Llama 2 7B Chat', provider: 'huggingface', source: 'fallback', capabilities: ['chat'] },
        { id: 'meta-llama/Llama-2-13b-chat-hf', name: 'Llama 2 13B Chat', provider: 'huggingface', source: 'fallback', capabilities: ['chat'] },
        { id: 'meta-llama/Meta-Llama-3-8B-Instruct', name: 'Llama 3 8B Instruct', provider: 'huggingface', source: 'fallback', capabilities: ['chat', 'instruct'] },
        { id: 'meta-llama/Meta-Llama-3.1-8B-Instruct', name: 'Llama 3.1 8B Instruct', provider: 'huggingface', source: 'fallback', capabilities: ['chat', 'instruct'] },
        { id: 'microsoft/DialoGPT-medium', name: 'DialoGPT Medium', provider: 'huggingface', source: 'fallback', capabilities: ['chat'] },
        { id: 'microsoft/DialoGPT-large', name: 'DialoGPT Large', provider: 'huggingface', source: 'fallback', capabilities: ['chat'] },
        { id: 'tiiuae/falcon-7b-instruct', name: 'Falcon 7B Instruct', provider: 'huggingface', source: 'fallback', capabilities: ['instruct'] },
        { id: 'tiiuae/falcon-40b-instruct', name: 'Falcon 40B Instruct', provider: 'huggingface', source: 'fallback', capabilities: ['instruct'] },
        { id: 'mistralai/Mistral-7B-Instruct-v0.1', name: 'Mistral 7B Instruct v0.1', provider: 'huggingface', source: 'fallback', capabilities: ['instruct'] },
        { id: 'mistralai/Mistral-7B-Instruct-v0.2', name: 'Mistral 7B Instruct v0.2', provider: 'huggingface', source: 'fallback', capabilities: ['instruct'] },
        { id: 'mistralai/Mixtral-8x7B-Instruct-v0.1', name: 'Mixtral 8x7B Instruct', provider: 'huggingface', source: 'fallback', capabilities: ['instruct'] },
        { id: 'NousResearch/Nous-Hermes-2-Mixtral-8x7B-DPO', name: 'Nous Hermes 2 Mixtral 8x7B', provider: 'huggingface', source: 'fallback', capabilities: ['chat', 'instruct'] },
        { id: 'openchat/openchat-3.5-1210', name: 'OpenChat 3.5', provider: 'huggingface', source: 'fallback', capabilities: ['chat'] },
        { id: 'teknium/OpenHermes-2.5-Mistral-7B', name: 'OpenHermes 2.5 Mistral 7B', provider: 'huggingface', source: 'fallback', capabilities: ['chat', 'instruct'] },
        { id: 'HuggingFaceH4/zephyr-7b-beta', name: 'Zephyr 7B Beta', provider: 'huggingface', source: 'fallback', capabilities: ['chat', 'instruct'] }
      ];
    }

    return await this.modelRegistry.getModelsForProvider(targetProvider);
  }

  /**
   * Get models by capability
   */
  async getModelsByCapability(capability: ModelCapability, provider?: string): Promise<ModelDefinition[]> {
    return await this.modelRegistry.findModelsByCapability(capability, provider || this.config.provider);
  }

  /**
   * Get deprecated models with warnings
   */
  async getDeprecatedModels(provider?: string): Promise<Array<ModelDefinition & { warning: string }>> {
    const deprecatedModels = this.modelRegistry.getDeprecatedModels(provider || this.config.provider);
    return deprecatedModels.map(model => ({ ...model, warning: 'This model is deprecated' }));
  }

  /**
   * Get current configuration (without API key)
   */
  async getConfig() {
    return {
      provider: this.config.provider,
      model: this.config.model || await this.getDefaultModel(),
      maxTokens: this.config.maxTokens,
      temperature: this.config.temperature,
      availableModels: await this.getAvailableModels(),
      availableModelsDetailed: await this.getAvailableModelsDetailed(),
      webSearchCapabilities: this.getWebSearchCapabilities(),
      deprecatedModels: await this.getDeprecatedModels(),
      modelRegistry: {
        totalModels: (await this.modelRegistry.getAllActiveModels()).length,
        webSearchModels: (await this.getModelsByCapability('web-search')).length
      }
    };
  }

  /**
   * Get model registry for advanced operations
   */
  getModelRegistry(): ModelRegistry {
    return this.modelRegistry;
  }

  /**
   * Get configured AI service providers
   */
  getProviders(): Array<{ name: string; priority: number }> {
    return this.providers.map(p => ({ name: p.name, priority: p.priority }));
  }

  /**
   * Get allowed models for a provider, respecting model restrictions
   */
  async getAllowedModels(provider?: string): Promise<string[]> {
    // Get all available models first
    const allModels = await this.getAvailableModels(provider);
    
    if (!provider) {
      // If no provider specified, return all allowed models from all providers
      const allowedModels: string[] = [];
      for (const p of this.providers) {
        const providerModels = await this.getAvailableModels(p.name);
        const filtered = this.filterModelsByRestrictions(p.name, providerModels);
        allowedModels.push(...filtered);
      }
      return allowedModels;
    }
    
    // Filter models by restrictions for the specific provider
    return this.filterModelsByRestrictions(provider, allModels);
  }

  /**
   * Resolve the production-safe model identifier for a provider/model alias
   */
  getProductionModelId(provider: string, modelId: string): string {
    try {
      return hybridRegistry.getProductionModelId(modelId, provider);
    } catch (error) {
      logger.warn('Failed to resolve production model id', {
        provider,
        modelId,
        error: error instanceof Error ? error.message : String(error)
      });
      return modelId;
    }
  }

  /**
   * Filter models based on provider restrictions
   */
  private filterModelsByRestrictions(provider: string, models: string[]): string[] {
    const restrictions = this.modelRestrictions?.[provider];
    
    // No restrictions = all models allowed
    if (!restrictions) {
      return models;
    }

    return models.filter(model => {
      // Check if blocked
      if (restrictions.blockedModels?.includes(model)) {
        return false;
      }

      // If we have allowed models or patterns, model must match one
      if (restrictions.allowedModels?.length || restrictions.allowedPatterns?.length) {
        // Check exact matches
        if (restrictions.allowedModels?.includes(model)) {
          return true;
        }

        // Check pattern matches
        if (restrictions.allowedPatterns?.some(pattern => this.matchesPattern(model, pattern))) {
          return true;
        }

        // No match found
        return false;
      }

      // No specific restrictions, allow by default
      return true;
    });
  }

  /**
   * Validate if a model is allowed for the given provider
   */
  private validateModelRestrictions(provider: string, model: string): { allowed: boolean; error?: string; suggestions?: string[] } {
    const restrictions = this.modelRestrictions?.[provider];
    
    // No restrictions = all models allowed
    if (!restrictions) {
      return { allowed: true };
    }

    // Check blocked models first
    if (restrictions.blockedModels?.includes(model)) {
      return {
        allowed: false,
        error: `Model '${model}' is blocked for provider '${provider}'`,
        suggestions: restrictions.allowedModels?.slice(0, 3) || []
      };
    }

    // Check allowed models (exact match)
    if (restrictions.allowedModels?.length && restrictions.allowedModels.includes(model)) {
      return { allowed: true };
    }

    // Check allowed patterns (glob-style matching)
    if (restrictions.allowedPatterns?.length) {
      for (const pattern of restrictions.allowedPatterns) {
        if (this.matchesPattern(model, pattern)) {
          return { allowed: true };
        }
      }
    }

    // If we have restrictions but model doesn't match any, it's blocked
    if (restrictions.allowedModels?.length || restrictions.allowedPatterns?.length) {
      return {
        allowed: false,
        error: `Model '${model}' not allowed for provider '${provider}'`,
        suggestions: restrictions.allowedModels?.slice(0, 3) || this.getPatternSuggestions(restrictions.allowedPatterns || [])
      };
    }

    // No specific restrictions, allow by default
    return { allowed: true };
  }

  /**
   * Simple glob pattern matching for model names
   */
  private matchesPattern(model: string, pattern: string): boolean {
    // Convert glob pattern to regex
    const regexPattern = pattern
      .replace(/\./g, '\\.')  // Escape dots
      .replace(/\*/g, '.*')   // Convert * to .*
      .replace(/\?/g, '.');   // Convert ? to .

    const regex = new RegExp(`^${regexPattern}`);
    return regex.test(model);
  }

  /**
   * Generate suggestions from patterns
   */
  private getPatternSuggestions(patterns: string[]): string[] {
    return patterns.map(pattern => {
      // Convert patterns to example model names
      return pattern.replace(/\*/g, 'example');
    }).slice(0, 3);
  }
}

export default AIService;
