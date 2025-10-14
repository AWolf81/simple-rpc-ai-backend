/**
 * AI Service using Vercel AI SDK
 * 
 * Simple wrapper around Vercel AI SDK for RPC backend services.
 * Handles multiple providers (Anthropic, OpenAI, Google, etc.) seamlessly.
 */

import { generateText } from 'ai';
import { createAnthropic, anthropic } from '@ai-sdk/anthropic';
import { createOpenAI, openai } from '@ai-sdk/openai';
import { createGoogleGenerativeAI, google } from '@ai-sdk/google';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { InferenceClient } from '@huggingface/inference';
import crypto from 'crypto';
import { LanguageModel } from 'ai';
import { MCPService, MCPServiceConfig } from '../mcp/mcp-service';
import { ModelRegistry } from './model-registry.js';
import { hybridRegistry } from './hybrid-model-registry.js';
import type { ModelInfo } from './model-registry.js';
import { TimingLogger } from '../../utils/timing.js';
import { logger } from '../../utils/logger.js';

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
              console.log('🔄 Switching to chat completion API for model:', modelId);
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
  mcpConfig?: MCPServiceConfig; // MCP service configuration for web search
  
  // Model Registry Configuration
  modelRegistry?: {
    registryConfig?: Partial<import('../../config/model-safety.js').ModelSafetyConfig>;
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
      console.log("service", this.mcpService)
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
      executionConfig
    );
    let t3 = timing.checkpoint('Prepared AI execution', t2);

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

      console.log('🚀 About to call generateText with:');
      console.log(`   Model type: ${typeof model}`);
      console.log(`   Model constructor: ${model.constructor?.name}`);
      console.log(`   Model ID: ${(model as any)?.modelId || 'unknown'}`);
      console.log(`   Model spec:`, (model as any)?.specificationVersion);
      console.log(`   Model provider: ${(model as any)?.provider}`);
      console.log(`   Generate options keys: ${Object.keys(generateOptions)}`);
      console.log(`   Max tokens: ${generateOptions.maxTokens}`);

      let t4 = timing.checkpoint('Calling generateText (Vercel AI SDK)', t3);
      const result = await generateText(generateOptions);
      let t5 = timing.checkpoint('generateText completed', t4);

      // Handle tool calls if present (only for MCP tools, not provider-native)
      if (result.toolCalls && result.toolCalls.length > 0 && executionConfig.webSearchPreference !== 'ai-web-search') {
        logger.debug(`🔧 AI requested ${result.toolCalls.length} MCP tool calls`);
        
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

      timing.end();

      const promptTokens = result.usage.inputTokens ?? (result.usage as any).promptTokens ?? 0;
      const completionTokens = result.usage.outputTokens ?? (result.usage as any).completionTokens ?? 0;
      const totalTokens = result.usage.totalTokens ?? (promptTokens + completionTokens);

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
        finishReason: result.finishReason
      };

    } catch (error: any) {
      // Simplified unified error handling for all providers
      const provider = executionConfig.provider;
      const modelForError = resolvedModelName || executionConfig.model || 'default';
      const statusCode = error.statusCode || error.status;
      
      // Log detailed error for debugging
      console.error(`🚨 ${provider.toUpperCase()} API Error:`, {
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
      
      throw new Error(errorMessage);
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
      console.log(`🌐 Using OpenRouter web search model: ${modelName}`);
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
      console.log(`🕐 Search initiated at: ${new Date().toISOString()}`);

      // For now, we'll implement a simple HTTP client to the MCP server
      // Later this can be integrated with the MCP service directly
      const searchResult = await this.callMCPWebSearchServer(query);

      if (!searchResult || !searchResult.length) {
        logger.debug('🔍 No search results found');
        return '';
      }

      logger.debug(`🔍 Formatting ${searchResult.length} search results...`);
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
  private async executeToolCalls(toolCalls: any[]): Promise<any[]> {
    const toolResults: any[] = [];
    
    for (const toolCall of toolCalls) {
      // Privacy: Don't log user input - only log tool name
      logger.debug(`🔧 Executing tool: ${toolCall.toolName}`);
      
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
    const promptTokens = result.usage.inputTokens ?? (result.usage as any).promptTokens ?? 0;
    const completionTokens = result.usage.outputTokens ?? (result.usage as any).completionTokens ?? 0;
    const totalTokens = result.usage.totalTokens ?? (promptTokens + completionTokens);

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
   * Registry has "gemini-1-5-flash" but Google SDK expects "models/gemini-1.5-flash"
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
      console.warn(`⚠️ Unknown Google model '${modelName}', using default 'models/gemini-2.0-flash'`);
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
      console.warn('Failed to resolve production model id', {
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
    
    const regex = new RegExp(`^${regexPattern}$`);
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
