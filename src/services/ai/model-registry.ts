/**
 * Model Registry Service
 * 
 * Integrates @anolilab/ai-model-registry with validation,
 * caching, and fallback mechanisms for production safety.
 */

import { getModelSafetyConfig, ModelValidator, type ModelSafetyConfig } from '../../config/model-safety.js';
import { fileURLToPath } from 'url';
import path from 'path';
import { logger } from '../../utils/logger.js';

// Get the directory of this file for proper path resolution
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import model data with fallbacks for GitHub installs
let openaiModelsData: any = {};
let huggingfaceModelsData: any = {};

// Load data synchronously using createRequire for ES modules
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

try {
  // Use absolute path resolution relative to this file
  // src/services/ai/ -> ../../data/ to reach src/data/
  const openaiDataPath = path.resolve(__dirname, '../../data/openai-models.json');
  openaiModelsData = require(openaiDataPath);
} catch (error) {
  console.warn('OpenAI models data not found, using empty fallback');
  openaiModelsData = {};
}

try {
  // Use absolute path resolution relative to this file
  // src/services/ai/ -> ../../data/ to reach src/data/
  const huggingfaceDataPath = path.resolve(__dirname, '../../data/huggingface-models.json');
  huggingfaceModelsData = require(huggingfaceDataPath);
} catch (error) {
  console.warn('HuggingFace models data not found, using empty fallback');
  huggingfaceModelsData = {};
}

export interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  pricing?: {
    input: number;
    output: number;
  };
  contextWindow?: number;
  capabilities?: string[];
  source: 'registry' | 'fallback' | 'cache' | 'extension';
}

export class ModelRegistry {
  private cache = new Map<string, { data: any; timestamp: number }>();
  private config: ModelSafetyConfig;
  private lastRegistryCheck = 0;
  
  constructor(registryConfig?: Partial<ModelSafetyConfig>) {
    this.config = registryConfig ? { ...getModelSafetyConfig(), ...registryConfig } : getModelSafetyConfig();
    this.logConfiguration();
  }
  
  private logConfiguration() {
    const env = process.env.NODE_ENV || 'development';
    const mode = this.config.useRegistry ? '📡 Live Registry' : '🔒 Cached Models';

    logger.debug(`
🤖 AI Model Registry Configuration:
   Mode: ${mode}
   Environment: ${env}
   Price Updates: ${this.config.allowPriceUpdates ? '✅ Enabled' : '🔒 Disabled'}
   Validation: ${this.config.validationMode}

${this.config.useRegistry ? `
   💡 Using live models from @anolilab/ai-model-registry
   ${env === 'development' ? '🔒 For production, set: MODEL_REGISTRY_MODE=production' : ''}
` : `
   🔒 Using cached/validated models for safety
   📦 Update cached data by editing src/data/* or bumping @anolilab/ai-model-registry
`}
    `.trim());
  }
  
  async getDefaultModel(provider: string): Promise<string> {
    try {
      if (this.config.useRegistry) {
        return await this.getLiveDefaultModel(provider);
      } else {
        return await this.getCachedDefaultModel(provider);
      }
    } catch (error) {
      console.warn('Failed to get default model for ' + provider + ':', error instanceof Error ? error.message : String(error));
      return this.getFallbackDefaultModel(provider);
    }
  }
  
  async getModelsByProvider(provider: string): Promise<ModelInfo[]> {
    try {
      if (this.config.useRegistry) {
        return await this.getLiveModels(provider);
      } else {
        return await this.getCachedModels(provider);
      }
    } catch (error) {
      console.warn('Failed to get models for ' + provider + ':', error instanceof Error ? error.message : String(error));
      return this.getFallbackModels(provider);
    }
  }
  
  private async getLiveDefaultModel(provider: string): Promise<string> {
    try {
      const registry = await import('@anolilab/ai-model-registry' as any);
      const providerName = this.mapProviderName(provider);
      const models = registry.getModelsByProvider?.(providerName) || [];
      
      if (models.length > 0) {
        const validation = ModelValidator.validateModelData(models);
        
        if (!validation.valid && this.config.validationMode === 'strict') {
          throw new Error('Model validation failed: ' + validation.errors.join(', '));
        }
        
        if (!validation.valid && this.config.validationMode === 'warn') {
          console.warn('⚠️ Model validation warnings for ' + provider + ':', validation.errors);
        }
        
        // Special handling for Google - curated models with stable versions added
        if (provider === 'google') {
          // Google models are curated to include stable versions missing from registry
          const curatedModels = await this.getCuratedGoogleModels(models);
          if (curatedModels.length > 0) {
            const selectedModel = curatedModels[0]; // Already sorted by priority
            console.log('📡 Using curated Google model from registry: google/' + selectedModel);
            return selectedModel;
          }
          
          // If no curated models found, use fallback
          console.log('📡 No curated Google models found, using fallback: google/gemini-2.0-flash');
          return 'gemini-2.0-flash';
        }
        
        // Special handling for Anthropic - convert simplified IDs to proper format
        if (provider === 'anthropic') {
          // Registry returns simplified IDs like "claude-haiku-3" instead of full model names
          // Use the release date to construct the proper model ID
          const properModelId = await this.convertAnthropicModelId(models);
          if (properModelId) {
            console.log('📡 Converted Anthropic model ID using release date:', properModelId);
            return properModelId;
          } else {
            throw new Error('Could not convert Anthropic model ID from registry - no fallback available');
          }
        }
        
        // Special handling for OpenAI - curated chat-compatible models
        if (provider === 'openai') {
          // OpenAI models are stable, but we curate to exclude deprecated/incompatible models
          const curatedModels = await this.getCuratedOpenAIModels(models);
          if (curatedModels.length > 0) {
            const selectedModel = curatedModels[0]; // Already sorted by priority
            console.log('📡 Using curated OpenAI model from registry: openai/' + selectedModel);
            return selectedModel;
          }
          
          // If no curated models found, use fallback
          console.log('📡 No curated OpenAI models found, using fallback: openai/gpt-4o');
          return 'gpt-4o';
        }
        
        // Special handling for Hugging Face - curated models with extension support
        if (provider === 'huggingface') {
          const curatedModels = await this.getCuratedHuggingFaceModels(models);
          if (curatedModels.length > 0) {
            const selectedModel = curatedModels[0]; // Already sorted by priority
            console.log('📡 Using curated Hugging Face model: huggingface/' + selectedModel);
            return selectedModel;
          }

          // If no curated models found, use fallback
          console.log('📡 No curated Hugging Face models found, using fallback: huggingface/qwen-qwen-2-5-14b-instruct');
          return 'qwen-qwen-2-5-14b-instruct';
        }

        // Special handling for OpenRouter - prefer Claude 3.7 Sonnet for best cost/performance
        if (provider === 'openrouter') {
          // Look for Claude 3.7 Sonnet models first (registry uses dots, not hyphens)
          const preferredModels = [
            'anthropic/claude-3.7-sonnet',
            'anthropic/claude-3.5-sonnet',
            'anthropic/claude-3-opus'
          ];

          for (const preferred of preferredModels) {
            const found = models.find(m => (m.id || m.name) === preferred);
            if (found) {
              const selectedModel = found.id || found.name;
              console.log('📡 Using preferred OpenRouter model: openrouter/' + selectedModel);
              return selectedModel;
            }
          }

          // If no Claude 3.7 Sonnet found, use first available model
          const defaultModel = models[0]?.id || models[0]?.name;
          console.log('📡 Using first available OpenRouter model: openrouter/' + defaultModel);
          return defaultModel;
        }
        
        // For other providers, use the first model
        const defaultModel = models[0]?.id || models[0]?.name;
        console.log('📡 Using live model from registry: ' + provider + '/' + defaultModel);
        return defaultModel;
      }
    } catch (error) {
      console.warn('Registry unavailable for ' + provider + ', using fallback:', error instanceof Error ? error.message : String(error));
    }
    
    return this.getFallbackDefaultModel(provider);
  }
  
  private async getCachedDefaultModel(provider: string): Promise<string> {
    const cacheKey = 'default-' + provider;
    const cached = this.cache.get(cacheKey);

    if (cached && this.isCacheValid(cached.timestamp)) {
      return cached.data;
    }

    // Special handling for Anthropic - use hybrid registry with production models
    if (provider === 'anthropic') {
      try {
        const { HybridModelRegistry } = await import('./hybrid-model-registry.js');
        const hybridRegistry = new HybridModelRegistry({
          productionMode: true,  // Always use production mode for cached/test
          fallbackToAliases: false
        });
        const productionModel = await hybridRegistry.getProductionModel('anthropic', 'balanced');
        logger.debug(`📦 Cached Anthropic model: ${productionModel.productionId}`);

        // Cache the result
        this.cache.set(cacheKey, { data: productionModel.productionId, timestamp: Date.now() });
        return productionModel.productionId;
      } catch (error) {
        console.warn('⚠️ Failed to get cached Anthropic model from hybrid registry:', error instanceof Error ? error.message : String(error));
        throw new Error('Anthropic models require hybrid registry - cache miss and no fallback available');
      }
    }

    return this.getFallbackDefaultModel(provider);
  }
  
  private getFallbackDefaultModel(provider: string): string {
    // Simple built-in fallbacks without external dependency
    // Note: Anthropic no longer uses fallbacks - uses registry conversion instead
    const fallbacks: Record<string, string> = {
      'openai': 'gpt-4o',
      'google': 'gemini-2.0-flash',
      'openrouter': 'anthropic/claude-3.7-sonnet',  // Registry uses dots, not hyphens
      'huggingface': 'google/flan-t5-base'  // Free tier model available on HF Inference API
    };

    // Anthropic should not reach this point - it uses registry-based conversion
    if (provider === 'anthropic') {
      throw new Error('Anthropic models should use registry-based conversion, not fallbacks');
    }

    const fallback = fallbacks[provider] || 'unknown-model';
    console.log('🔄 Using built-in fallback model: ' + provider + '/' + fallback);
    return fallback;
  }
  
  private async getLiveModels(provider: string): Promise<ModelInfo[]> {
    try {
      const registry = await import('@anolilab/ai-model-registry' as any);
      const providerName = this.mapProviderName(provider);

      console.log('🔍 Fetching live models for provider:', providerName);
      const models = registry.getModelsByProvider?.(providerName) || [];
      console.log('📊 Found', models.length, 'models for', providerName);

      // Special handling for Hugging Face - use curation system even with live models
      if (provider === 'huggingface') {
        return await this.getCuratedHuggingFaceModelsDetailed(models);
      }

      if (models.length === 0) {
        console.warn('⚠️ No models found for', providerName, '- falling back to built-in models');
        return this.getFallbackModels(provider);
      }
      
      const mappedModels = models
        .filter((model: any) => {
          const id = model.id || model.name;
          if (typeof id !== 'string') return false;
          
          // Use positive filtering: only include actual model IDs based on provider patterns
          if (provider === 'google') {
            // Google models start with gemini- or are specific Google model names
            return id.startsWith('gemini-') || id.startsWith('google/') || 
                   id.includes('flash') || id.includes('pro') || id.includes('ultra');
          }
          
          if (provider === 'anthropic') {
            // Anthropic models start with claude-
            return id.startsWith('claude-') || id.startsWith('anthropic/');
          }
          
          if (provider === 'openai') {
            // OpenAI models: gpt-, text-, davinci-, etc.
            return id.startsWith('gpt-') || id.startsWith('text-') || 
                   id.startsWith('davinci-') || id.startsWith('openai/') ||
                   id.includes('turbo') || id.includes('instruct');
          }
          
          if (provider === 'openrouter') {
            // OpenRouter uses provider/model format or known model patterns
            return id.includes('/') || id.startsWith('claude-') || 
                   id.startsWith('gpt-') || id.startsWith('llama-') ||
                   id.startsWith('mistral-') || id.startsWith('gemini-');
          }
          
          // For other providers, exclude obvious metadata patterns
          const isMetadata = id.includes('-versions') ||
            id.includes('-deprecation-date') ||
            id.includes('-latest-update') ||
            id.includes('-knowledge-cutoff') ||
            id.includes('capabilities') ||
            id.includes('calendar-month') ||
            id.includes('handyman-') ||
            id.includes('[*]');
          
          return !isMetadata;
        })
        .map((model: any) => ({
          id: model.id || model.name,
          name: model.name || model.id,
          provider,
          pricing: model.pricing ? {
            input: model.pricing.input || 0,
            output: model.pricing.output || 0
          } : undefined,
          contextWindow: model.contextLength,
          capabilities: model.capabilities,
          source: 'registry' as const
        }));
      
      console.log('📡 Using live models from registry for', provider);
      return mappedModels;
    } catch (error) {
      console.warn('❌ Error fetching live models for', provider + ':', error instanceof Error ? error.message : String(error));
      return this.getFallbackModels(provider);
    }
  }
  
  private async getCachedModels(provider: string): Promise<ModelInfo[]> {
    return this.getFallbackModels(provider);
  }
  
  private getFallbackModels(provider: string): ModelInfo[] {
    // Simple built-in fallback models
    // Note: Anthropic no longer uses fallbacks - uses registry conversion instead

    // Anthropic should not reach this point - it uses registry-based conversion
    if (provider === 'anthropic') {
      throw new Error('Anthropic models should use registry-based conversion, not fallbacks');
    }

    const fallbacks: Record<string, ModelInfo[]> = {
      'openai': [{
        id: 'gpt-4o',
        name: 'GPT-4o',
        provider: 'openai',
        contextWindow: 128000,
        capabilities: ['text', 'vision', 'reasoning'],
        source: 'fallback' as const
      }],
      'google': [{
        id: 'gemini-2.0-flash',
        name: 'Gemini 2.0 Flash',
        provider: 'google',
        contextWindow: 1048576,
        capabilities: ['text', 'vision', 'reasoning'],
        source: 'fallback' as const
      }],
      'huggingface': [
        // Latest coding-specialized models (2025)
        {
          id: 'mistralai/Mistral-Small-2507',
          name: 'Mistral Small 2507 (Devstral)',
          provider: 'huggingface',
          contextWindow: 32768,
          capabilities: ['text', 'code', 'reasoning', 'agentic'],
          source: 'fallback' as const
        },
        {
          id: 'Qwen/Qwen3-235B-A22B-Instruct',
          name: 'Qwen3 235B-A22B Instruct',
          provider: 'huggingface',
          contextWindow: 32768,
          capabilities: ['text', 'code', 'reasoning', 'large-scale'],
          source: 'fallback' as const
        },
        {
          id: 'Qwen/Qwen3-Coder-480B-A35B-Instruct',
          name: 'Qwen3 Coder 480B-A35B Instruct',
          provider: 'huggingface',
          contextWindow: 32768,
          capabilities: ['text', 'code', 'specialized-coding'],
          source: 'fallback' as const
        },
        {
          id: 'deepseek-ai/DeepSeek-V3',
          name: 'DeepSeek-V3',
          provider: 'huggingface',
          contextWindow: 64000,
          capabilities: ['text', 'code', 'reasoning', 'high-performance'],
          source: 'fallback' as const
        },
        {
          id: 'mistralai/Codestral-Mamba-7B-v0.1',
          name: 'Codestral Mamba 7B',
          provider: 'huggingface',
          contextWindow: 32768,
          capabilities: ['text', 'code', 'efficiency', 'mamba-architecture'],
          source: 'fallback' as const
        },
        // Multimodal models for visual development tasks
        {
          id: 'microsoft/Phi-3.5-vision-instruct',
          name: 'Phi-3.5 Vision Instruct',
          provider: 'huggingface',
          contextWindow: 131072,
          capabilities: ['text', 'vision', 'code', 'multimodal'],
          source: 'fallback' as const
        },
        {
          id: 'Qwen/Qwen2-VL-72B-Instruct',
          name: 'Qwen2-VL 72B Instruct',
          provider: 'huggingface',
          contextWindow: 32768,
          capabilities: ['text', 'vision', 'code', 'multimodal', 'large-scale'],
          source: 'fallback' as const
        },
        // Legacy stable models for compatibility
        {
          id: 'meta-llama/Llama-3.1-70B-Instruct',
          name: 'Llama 3.1 70B Instruct',
          provider: 'huggingface',
          contextWindow: 131072,
          capabilities: ['text', 'code', 'reasoning'],
          source: 'fallback' as const
        },
        {
          id: 'mistralai/Mixtral-8x7B-Instruct-v0.1',
          name: 'Mixtral 8x7B Instruct',
          provider: 'huggingface',
          contextWindow: 32768,
          capabilities: ['text', 'code', 'mixture-of-experts'],
          source: 'fallback' as const
        }
      ]
    };

    console.log('🔄 Using built-in fallback models for ' + provider);
    return fallbacks[provider] || [];
  }
  
  private mapProviderName(provider: string): string {
    const providerNameMap: Record<string, string> = {
      'anthropic': 'Anthropic',
      'openai': 'OpenAI',
      'google': 'Google',
      'openrouter': 'OpenRouter',
      'meta': 'Meta',
      'groq': 'Groq',
      'huggingface': 'Hugging Face'  // External registry uses "Hugging Face" with space
    };

    return providerNameMap[provider] ||
      provider.charAt(0).toUpperCase() + provider.slice(1);
  }
  
  private isCacheValid(timestamp: number): boolean {
    return (Date.now() - timestamp) < this.config.validationInterval;
  }
  
  /**
   * Select the best Anthropic model using hybrid registry
   * Returns production-safe versioned model ID for consistent behavior
   */
  private async convertAnthropicModelId(models: any[]): Promise<string | null> {
    console.log('🔄 Using hybrid registry for production-safe model selection');
    
    try {
      // Use hybrid registry for production-safe model selection
      const { HybridModelRegistry } = await import('./hybrid-model-registry.js');
      const hybridRegistry = new HybridModelRegistry({
        productionMode: process.env.NODE_ENV === 'production',
        fallbackToAliases: false  // Never fallback to aliases - only use models with production mappings
      });
      
      const productionModel = await hybridRegistry.getProductionModel('anthropic', 'balanced');
      
      console.log(`📡 Selected hybrid model: "${productionModel.id}" → "${productionModel.productionId}"`);
      console.log(`📅 Release: ${productionModel.production.releaseDate}, Status: ${productionModel.production.status}`);
      
      return productionModel.productionId;
      
    } catch (error) {
      console.warn('⚠️ Hybrid registry fallback failed, using legacy selection:', error.message);
      
      // Fallback to legacy logic - only look for models we have production mappings for
      const preferredModel = models.find(m => 
        m.id === 'claude-opus-4-1' && !m.id.includes('deprecated')
      ) || models.find(m => 
        m.id === 'claude-sonnet-4' && !m.id.includes('deprecated')
      ) || models.find(m => 
        m.id === 'claude-sonnet-3-7' && !m.id.includes('deprecated')
      ) || models.find(m => 
        m.id === 'claude-haiku-3-5' && !m.id.includes('deprecated')
      ) || models.find(m => 
        m.id === 'claude-haiku-3' && !m.id.includes('deprecated')
      ) || models.find(m => 
        m.id === 'claude-sonnet-3-5' && !m.id.includes('deprecated')  // Add as last resort (deprecated)
      ) || models[0];
      
      if (!preferredModel) {
        throw new Error('No Anthropic models found in registry');
      }
      
      const cleanId = preferredModel.id.replace('-(deprecated)', '');
      console.log(`📡 Legacy fallback: "${cleanId}"`);
      return cleanId;
    }
    
    // TODO: Remove override when registry is updated with current models
    // Original logic (kept for reference):
    /*
    // Look for the best current model (Claude 3.5 Sonnet non-deprecated)
    const preferredModel = models.find(m => 
      m.id === 'claude-sonnet-3-5' && !m.id.includes('deprecated')
    );
    
    if (preferredModel && preferredModel.releaseDate) {
      const modelId = this.formatAnthropicModelId(preferredModel.id, preferredModel.releaseDate);
      if (modelId) return modelId;
    }
    
    // Fallback: try any Claude 3.5 Sonnet
    const sonnetModel = models.find(m => 
      m.id && m.id.includes('sonnet') && m.releaseDate
    );
    
    if (sonnetModel) {
      const modelId = this.formatAnthropicModelId(sonnetModel.id, sonnetModel.releaseDate);
      if (modelId) return modelId;
    }
    
    // Last resort: try any model with a release date
    const modelWithDate = models.find(m => m.releaseDate);
    
    if (modelWithDate) {
      return this.formatAnthropicModelId(modelWithDate.id, modelWithDate.releaseDate);
    }
    
    return null;
    */
  }

  /**
   * Get curated OpenAI models sorted by priority
   * Filters out deprecated/incompatible models and sorts by preference
   */
  private async getCuratedOpenAIModels(models: any[]): Promise<string[]> {
    const openaiConfig = openaiModelsData;
    
    if (!openaiConfig) {
      console.warn('⚠️ No OpenAI curation config found, using fallback logic');
      return models
        .filter(m => {
          const id = m.id || m.name || '';
          return ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo'].includes(id);
        })
        .map(m => m.id || m.name);
    }

    // Filter registry models to only include curated ones
    const curatedModels: Array<{id: string, priority: number}> = [];
    
    for (const registryModel of models) {
      const modelId = registryModel.id || registryModel.name;
      const curatedModel = openaiConfig.models[modelId];
      
      if (curatedModel) {
        curatedModels.push({
          id: modelId,
          priority: curatedModel.priority || 999
        });
      } else {
        // Check if it's in excluded models
        const isExcluded = openaiConfig.excludedModels?.[modelId];
        if (isExcluded) {
          console.warn(`🚫 Excluding OpenAI model "${modelId}": ${isExcluded.reason}`);
        }
      }
    }

    // Sort by priority (lower number = higher priority)
    const sortedModels = curatedModels
      .sort((a, b) => a.priority - b.priority)
      .map(m => m.id);

    console.log(`📋 Curated OpenAI models (${sortedModels.length}):`, sortedModels.slice(0, 3).join(', ') + '...');
    return sortedModels;
  }

  /**
   * Get curated Hugging Face models sorted by priority
   * Combines registry models with extension models and excludes deprecated/unsuitable models
   */
  private async getCuratedHuggingFaceModels(models: any[]): Promise<string[]> {
    const huggingfaceConfig = huggingfaceModelsData;

    if (!huggingfaceConfig) {
      console.warn('⚠️ No Hugging Face curation config found, using fallback logic');
      return models
        .filter(m => {
          const id = m.id || m.name || '';
          return ['qwen-qwen-2-5-14b-instruct', 'qwen-qwen-3-8b', 'qwen-qwen-2-5-7b-instruct'].includes(id);
        })
        .map(m => m.id || m.name);
    }

    const curatedModels: Array<{id: string, priority: number, source: string}> = [];

    // Add models from registry that are in our curated list
    for (const registryModel of models) {
      const modelId = registryModel.id || registryModel.name;
      const curatedModel = huggingfaceConfig.models[modelId];

      if (curatedModel) {
        curatedModels.push({
          id: modelId,
          priority: curatedModel.priority || 999,
          source: 'registry'
        });
      } else {
        // Check if it's in excluded models
        const isExcluded = huggingfaceConfig.excludedModels?.[modelId];
        if (isExcluded) {
          console.warn(`🚫 Excluding Hugging Face model "${modelId}": ${isExcluded.reason}`);
        }
      }
    }

    // Add extension models (models not in external registry but in our curated list)
    for (const [modelId, curatedModel] of Object.entries(huggingfaceConfig.models)) {
      const modelConfig = curatedModel as any;
      if (modelConfig.source === 'extension') {
        // Only add if not already in registry
        const alreadyAdded = curatedModels.find(m => m.id === modelId);
        if (!alreadyAdded) {
          curatedModels.push({
            id: modelId,
            priority: modelConfig.priority || 999,
            source: 'extension'
          });
          console.log(`➕ Adding extension Hugging Face model: ${modelId} (priority ${modelConfig.priority})`);
        }
      }
    }

    // Sort by priority (lower number = higher priority)
    const sortedModels = curatedModels
      .sort((a, b) => a.priority - b.priority)
      .map(m => m.id);

    console.log(`📋 Curated Hugging Face models (${sortedModels.length}):`, sortedModels.slice(0, 3).join(', ') + '...');
    console.log(`🔧 Extension models: ${curatedModels.filter(m => m.source === 'extension').length}`);
    console.log(`📡 Registry models: ${curatedModels.filter(m => m.source === 'registry').length}`);

    return sortedModels;
  }

  /**
   * Get curated Hugging Face models with detailed ModelInfo objects
   * Combines registry models with extension models and creates proper ModelInfo objects
   */
  private async getCuratedHuggingFaceModelsDetailed(models: any[]): Promise<ModelInfo[]> {
    const huggingfaceConfig = huggingfaceModelsData;
    const curatedModelIds = await this.getCuratedHuggingFaceModels(models);

    const detailedModels: ModelInfo[] = [];

    for (const modelId of curatedModelIds) {
      const registryModel = models.find(m => (m.id || m.name) === modelId);
      const configModel = huggingfaceConfig?.models[modelId] as any;

      if (registryModel) {
        // Model exists in external registry
        detailedModels.push({
          id: modelId,
          name: registryModel.name || modelId,
          provider: 'huggingface',
          pricing: registryModel.pricing ? {
            input: registryModel.pricing.input || 0,
            output: registryModel.pricing.output || 0
          } : undefined,
          contextWindow: registryModel.contextLength,
          capabilities: configModel?.capabilities || ['chat'],
          source: 'registry' as const
        });
      } else if (configModel && configModel.source === 'extension') {
        // Extension model not in registry
        detailedModels.push({
          id: modelId,
          name: configModel.productionId || modelId,
          provider: 'huggingface',
          capabilities: configModel.capabilities || ['chat', 'code'],
          source: 'extension' as const
        });
      }
    }

    console.log(`📋 Created ${detailedModels.length} detailed Hugging Face models`);
    return detailedModels;
  }

  /**
   * Get curated Google models with stable versions added where missing
   * Extends registry models by adding stable equivalents of experimental models
   */
  private async getCuratedGoogleModels(models: any[]): Promise<string[]> {
    // Google curated models - prioritize stable over experimental
    const curatedGoogleModels = {
      'gemini-2.0-flash': { priority: 1, source: 'stable' },
      'gemini-2-0-flash': { priority: 2, source: 'stable' },
      'gemini-2.0-pro': { priority: 3, source: 'stable' },
      'gemini-2-0-pro': { priority: 4, source: 'stable' },
      'gemini-2-0-flash-exp': { priority: 10, source: 'experimental', stableEquivalent: 'gemini-2.0-flash' },
      'gemini-1-5-flash': { priority: 20, source: 'legacy' },
      'gemini-1-5-pro': { priority: 21, source: 'legacy' }
    };

    const curatedModels: Array<{id: string, priority: number}> = [];
    
    // First, add models that exist in registry
    for (const registryModel of models) {
      const modelId = registryModel.id || registryModel.name;
      const curatedInfo = curatedGoogleModels[modelId as keyof typeof curatedGoogleModels];
      
      if (curatedInfo) {
        // If it's experimental and has a stable equivalent, add the stable one instead
        if (curatedInfo.source === 'experimental' && 'stableEquivalent' in curatedInfo && curatedInfo.stableEquivalent) {
          console.log(`🔄 Adding stable equivalent for experimental model: ${modelId} → ${curatedInfo.stableEquivalent}`);
          curatedModels.push({
            id: curatedInfo.stableEquivalent,
            priority: curatedInfo.priority - 5 // Give stable version higher priority
          });
        } else {
          curatedModels.push({
            id: modelId,
            priority: curatedInfo.priority
          });
        }
      }
    }
    
    // Add any missing stable models that aren't in the registry
    const missingStableModels = ['gemini-2.0-flash', 'gemini-2-0-flash'];
    for (const stableModel of missingStableModels) {
      const exists = curatedModels.some(m => m.id === stableModel);
      if (!exists) {
        const curatedInfo = curatedGoogleModels[stableModel as keyof typeof curatedGoogleModels];
        if (curatedInfo) {
          console.log(`➕ Adding missing stable Google model: ${stableModel}`);
          curatedModels.push({
            id: stableModel,
            priority: curatedInfo.priority
          });
        }
      }
    }

    // Sort by priority (lower number = higher priority)
    const sortedModels = curatedModels
      .sort((a, b) => a.priority - b.priority)
      .map(m => m.id);

    console.log(`📋 Curated Google models (${sortedModels.length}):`, sortedModels.slice(0, 3).join(', ') + '...');
    return sortedModels;
  }
  
  /**
   * Format Anthropic model ID from registry format to SDK format
   * "claude-sonnet-3-5" + "2024-03-04" -> "claude-3-5-sonnet-20240304"
   */
  private formatAnthropicModelId(registryId: string, releaseDate: string | Date): string | null {
    try {
      // Parse the release date
      const date = new Date(releaseDate);
      if (isNaN(date.getTime())) {
        console.warn('Invalid release date for Anthropic model:', releaseDate);
        return null;
      }
      
      // Format date as YYYYMMDD (no hyphens)
      const formattedDate = date.toISOString().slice(0, 10).replace(/-/g, '');
      
      // Convert registry format to SDK format
      // Only includes models we have production mappings for
      // "claude-sonnet-3-5" -> "claude-3-5-sonnet"
      // "claude-haiku-3" -> "claude-3-haiku"
      // "claude-opus-4-1" -> "claude-4-1-opus"
      
      const idMappings: Record<string, string> = {
        'claude-sonnet-3-5': 'claude-3-5-sonnet',
        'claude-sonnet-3-7': 'claude-3-7-sonnet',
        'claude-sonnet-4': 'claude-4-sonnet',
        'claude-haiku-3': 'claude-3-haiku',
        'claude-haiku-3-5': 'claude-3-5-haiku',
        'claude-opus-4-1': 'claude-4-1-opus'
      };
      
      // Remove deprecated suffix if present
      const cleanId = registryId.replace('-(deprecated)', '');
      const sdkFormat = idMappings[cleanId];
      
      if (sdkFormat) {
        return `${sdkFormat}-${formattedDate}`;
      } else {
        console.warn('Unknown Anthropic model format:', registryId);
        return null;
      }
      
    } catch (error) {
      console.warn('Error formatting Anthropic model ID:', error);
      return null;
    }
  }
  
  async checkForUpdates(): Promise<{ hasUpdates: boolean; changes: any[] }> {
    try {
      const registry = await import('@anolilab/ai-model-registry' as any);
      const providers = ['anthropic', 'openai', 'google', 'openrouter'];
      const changes: any[] = [];
      
      for (const provider of providers) {
        // Get current models that the system would return
        const currentModels = await this.getModelsByProvider(provider);
        
        // Get fresh models from registry
        const registryProviderName = this.mapProviderName(provider);
        const liveModels = registry.getModelsByProvider?.(registryProviderName) || [];
        
        // Convert registry models to our format for comparison
        const liveModelInfos = liveModels.map((model: any) => ({
          id: model.id || model.name,
          name: model.name || model.id,
          provider,
          pricing: model.pricing,
          contextWindow: model.contextLength,
          capabilities: model.capabilities,
          source: 'registry' as const
        }));
        
        // Compare counts and detect changes
        if (liveModelInfos.length !== currentModels.length) {
          changes.push({
            provider: provider.charAt(0).toUpperCase() + provider.slice(1),
            type: 'model_count',
            old: currentModels.length,
            new: liveModelInfos.length
          });
        }
        
        // TODO: Add pricing change detection here
      }
      
      return {
        hasUpdates: changes.length > 0,
        changes
      };
    } catch (error) {
      console.error('Failed to check for updates:', error);
      return { hasUpdates: false, changes: [] };
    }
  }
  
  async getHealthStatus() {
    try {
      const registry = await import('@anolilab/ai-model-registry' as any);
      const providers = registry.getProviders?.() || [];
      const models = registry.getAllModels?.() || [];
      
      return {
        status: 'healthy',
        providers: providers.length,
        models: models.length,
        config: this.config,
        lastCheck: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : String(error),
        config: this.config,
        lastCheck: new Date().toISOString()
      };
    }
  }
  
  // Legacy method compatibility
  checkModelDeprecation(provider: string, model: string): { deprecated: boolean; warning?: string } {
    // TODO: Implement deprecation checking from registry
    return { deprecated: false };
  }
  
  getWebSearchCapabilities(provider: string) {
    // Return basic web search capabilities - this will be enhanced later
    return {
      supportsNative: true,
      recommendedPreference: 'ai-web-search' as const,
      description: 'Web search support'
    };
  }
  
  // Alias for compatibility
  async getModelsForProvider(provider: string): Promise<ModelInfo[]> {
    return await this.getModelsByProvider(provider);
  }
  
  async findModelsByCapability(capability: string, provider?: string): Promise<ModelInfo[]> {
    const models = await this.getModelsByProvider(provider || 'anthropic');
    return models.filter(m => m.capabilities?.includes(capability));
  }
  
  getDeprecatedModels(provider: string): ModelInfo[] {
    // TODO: Implement deprecated models tracking
    return [];
  }
  
  async getAllActiveModels(): Promise<ModelInfo[]> {
    const providers = ['anthropic', 'openai', 'google'];
    const allModels: ModelInfo[] = [];
    
    for (const provider of providers) {
      const models = await this.getModelsByProvider(provider);
      allModels.push(...models);
    }
    
    return allModels;
  }
}
