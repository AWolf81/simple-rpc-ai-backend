/**
 * AI Service using Vercel AI SDK
 * 
 * Simple wrapper around Vercel AI SDK for RPC backend services.
 * Handles multiple providers (Anthropic, OpenAI, Google, etc.) seamlessly.
 */

import { generateText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { openai } from '@ai-sdk/openai';
import { google } from '@ai-sdk/google';

export interface AIServiceConfig {
  provider?: 'anthropic' | 'openai' | 'google'; // selected in constructor & used 
  defaultProvider?: 'anthropic' | 'openai' | 'google'; // default provider optional, defaults to serviceProvider with highest priority
  serviceProviders?: ServiceProvidersConfig;
  apiKey?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface ExecuteRequest {
  content: string;
  systemPrompt: string;
  metadata?: {
    name?: string;
    type?: string;
    [key: string]: any;
  };
  options?: {
    model?: string;
    maxTokens?: number;
    temperature?: number;
  };
}

export interface ExecuteResult {
  content: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model: string;
  finishReason?: string;
}

interface ServiceProvider {
  name: 'anthropic' | 'openai' | 'google';
  apiKey: string;
  priority: number;
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

// Allow either an object mapping provider names to partial config,
// or an array of full ServiceProvider entries
export type ServiceProvidersConfig =
  | {
      anthropic?: Partial<Omit<ServiceProvider, 'name' | 'priority'>> & { priority?: number };
      openai?: Partial<Omit<ServiceProvider, 'name' | 'priority'>> & { priority?: number };
      google?: Partial<Omit<ServiceProvider, 'name' | 'priority'>> & { priority?: number };
    }
  | ServiceProvider[];

type ModelType = Parameters<typeof generateText>[0]['model'];

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
    });
  }

  return providers;
}

/**
 * Simple AI service using Vercel AI SDK
 */
export class AIService {
  private config: AIServiceConfig;

  private providers: ServiceProvider[] = [];

  constructor(config: AIServiceConfig) {
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
  }
  /**
   * Execute AI request with system prompt using Vercel AI SDK
   */
  async execute(request: ExecuteRequest): Promise<ExecuteResult> {
    const { content, systemPrompt, metadata = {}, options = {} } = request;

    // Get the AI model provider
    const model = this.getModel(options.model) as Parameters<typeof generateText>[0]['model'];
    
    // Create the user prompt from content
    const userPrompt = content;

    try {
      const result = await generateText({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        maxTokens: options.maxTokens || this.config.maxTokens || 4000,
        temperature: options.temperature || this.config.temperature || 0.3,
      });

      return {
        content: result.text,
        usage: {
          promptTokens: result.usage.promptTokens,
          completionTokens: result.usage.completionTokens,
          totalTokens: result.usage.totalTokens
        },
        model: model.modelId, //: result.model, // why was it result.model? we can use model
        finishReason: result.finishReason
      };

    } catch (error: any) {
      throw new Error(`AI execution failed: ${error.message}`);
    }
  }

  private getModel(modelOverride?: string) {
    const modelName = modelOverride || this.config.model || this.getDefaultModel();

    const models: Record<ServiceProvider['name'], (model: string) => unknown>  = {
      anthropic: (name) => anthropic.messages(name),
      openai: (name) => openai.chat(name),
      google: (name) => google.generativeAI(name)
    };
    const getModelFn = models[this.config.provider as keyof typeof models];
    if (getModelFn === undefined) {
      throw new Error(`Unsupported AI provider: ${this.config.provider}`);
    }

    return getModelFn(modelName);
  }

  private getDefaultModel(): string {
    switch (this.config.provider) {
      case 'anthropic':
        return 'claude-3-5-sonnet-20241022';
      case 'openai':
        return 'gpt-4o';
      case 'google':
        return 'gemini-1.5-pro';
      default:
        return 'unknown-model';
    }
  }


  private getLanguageFromFileName(fileName: string): string {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    const languageMap: { [key: string]: string } = {
      'js': 'javascript',
      'ts': 'typescript', 
      'jsx': 'javascript',
      'tsx': 'typescript',
      'py': 'python',
      'java': 'java',
      'cs': 'csharp',
      'go': 'go',
      'rs': 'rust',
      'cpp': 'cpp',
      'c': 'c',
      'php': 'php',
      'rb': 'ruby',
      'swift': 'swift',
      'kt': 'kotlin'
    };
    return languageMap[ext] || ext;
  }

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
   * Get available models for current provider
   */
  getAvailableModels(): string[] {
    switch (this.config.provider) {
      case 'anthropic':
        return [
          'claude-3-5-sonnet-20241022',
          'claude-3-5-haiku-20241022', 
          'claude-3-opus-20240229'
        ];
      case 'openai':
        return [
          'gpt-4o',
          'gpt-4o-mini',
          'gpt-4-turbo',
          'gpt-3.5-turbo'
        ];
      case 'google':
        return [
          'gemini-1.5-pro',
          'gemini-1.5-flash',
          'gemini-1.0-pro'
        ];
      default:
        return [];
    }
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
      availableModels: this.getAvailableModels()
    };
  }
}

export default AIService;