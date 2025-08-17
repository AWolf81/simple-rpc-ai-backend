/**
 * Provider Registry Service
 * 
 * Integrates with @anolilab/ai-model-registry to provide curated AI provider information
 * filtered to only the providers configured in serviceProviders and byokProviders.
 */

// Import AI model registry with fallback for type safety
type RegistryProvider = {
  name: string;
  displayName?: string;
  description?: string;
  website?: string;
  apiKeyRequired?: boolean;
  supportedFeatures?: string[];
};

type RegistryModel = {
  id: string;
  name?: string;
  description?: string;
  contextLength?: number;
  pricing?: {
    input?: number;
    output?: number;
    inputCacheHit?: number;
  };
  capabilities?: string[];
};

// Registry integration helpers (with fallback for build compatibility)
let registryAvailable: boolean | undefined;

async function getRegistryProviders(): Promise<string[]> {
  if (registryAvailable === false) {
    return [];
  }
  
  try {
    // Use eval to avoid TypeScript module resolution issues at build time
    const registryModule = '@anolilab/ai-model-registry';
    const registry = await eval('import')(registryModule);
    registryAvailable = true;
    return registry.getProviders?.() || [];
  } catch (error) {
    registryAvailable = false;
    console.warn('AI model registry not available, using fallback');
    return [];
  }
}

async function getRegistryModels(options: { provider: string }): Promise<RegistryModel[]> {
  if (registryAvailable === false) {
    return [];
  }
  
  try {
    // Use eval to avoid TypeScript module resolution issues at build time
    const registryModule = '@anolilab/ai-model-registry';
    const registry = await eval('import')(registryModule);
    registryAvailable = true;
    return registry.getModels?.(options) || [];
  } catch (error) {
    registryAvailable = false;
    console.warn(`Models not available for ${options.provider}, using fallback`);
    return [];
  }
}

export interface ProviderConfig {
  name: string;
  displayName: string;
  models: ModelConfig[];
  priority: number;
  isServiceProvider: boolean;
  isByokProvider: boolean;
  pricing?: PricingInfo;
  metadata?: {
    description?: string;
    website?: string;
    apiKeyRequired: boolean;
    supportedFeatures: string[];
  };
}

export interface ModelConfig {
  id: string;
  name: string;
  description?: string;
  contextLength: number;
  inputCostPer1k?: number;
  outputCostPer1k?: number;
  capabilities: string[];
}

export interface PricingInfo {
  input: number;
  output: number;
  inputCacheHit?: number;
  currency: string;
  lastUpdated: string;
}

export interface PricingOverride {
  provider: string;
  model?: string;
  pricing: Partial<PricingInfo>;
  reason: string;
  appliedAt: string;
}

export class ProviderRegistryService {
  private serviceProviders: string[];
  private byokProviders: string[];
  private pricingOverrides: Map<string, PricingOverride[]> = new Map();
  private lastRegistryUpdate: Date | null = null;

  constructor(serviceProviders: string[] = [], byokProviders: string[] = []) {
    this.serviceProviders = serviceProviders;
    this.byokProviders = byokProviders;
  }

  /**
   * Get filtered providers based on configuration
   */
  async getConfiguredProviders(type: 'service' | 'byok' | 'all' = 'all'): Promise<ProviderConfig[]> {
    try {
      // Get all providers from registry
      const registryProviders = await getRegistryProviders();
      const filteredProviders: ProviderConfig[] = [];

      // Get all unique configured providers
      const allConfiguredProviders = [...new Set([...this.serviceProviders, ...this.byokProviders])];

      for (const providerName of allConfiguredProviders) {
        const isServiceProvider = this.serviceProviders.includes(providerName);
        const isByokProvider = this.byokProviders.includes(providerName);

        // Filter by type if specified
        if (type === 'service' && !isServiceProvider) continue;
        if (type === 'byok' && !isByokProvider) continue;

        // Get models for this provider
        const models = await this.getProviderModels(providerName);
        
        const providerConfig: ProviderConfig = {
          name: providerName,
          displayName: this.getProviderDisplayName(providerName),
          models,
          priority: this.calculatePriority(providerName, isServiceProvider),
          isServiceProvider,
          isByokProvider,
          metadata: {
            description: `AI provider: ${providerName}`,
            website: `https://${providerName}.com`,
            apiKeyRequired: true,
            supportedFeatures: ['text-generation', 'chat']
          }
        };

        filteredProviders.push(providerConfig);
      }

      // Sort by priority
      return filteredProviders.sort((a, b) => a.priority - b.priority);
    } catch (error) {
      console.warn('Failed to fetch providers from registry, falling back to default:', error);
      return this.getFallbackProviders(type);
    }
  }

  /**
   * Get models for a specific provider
   */
  private async getProviderModels(providerName: string): Promise<ModelConfig[]> {
    try {
      const models = await getRegistryModels({ provider: providerName });
      
      return models.map((model: RegistryModel) => ({
        id: model.id,
        name: model.name || model.id,
        description: model.description,
        contextLength: model.contextLength || 4096,
        inputCostPer1k: this.getOverriddenPrice(providerName, model.id, 'input') ?? model.pricing?.input,
        outputCostPer1k: this.getOverriddenPrice(providerName, model.id, 'output') ?? model.pricing?.output,
        capabilities: model.capabilities || []
      }));
    } catch (error) {
      console.warn(`Failed to fetch models for ${providerName}:`, error);
      return this.getFallbackModels(providerName);
    }
  }

  /**
   * Get display name for provider
   */
  private getProviderDisplayName(providerName: string): string {
    const displayNames: Record<string, string> = {
      'anthropic': 'Anthropic',
      'openai': 'OpenAI',
      'google': 'Google',
      'meta': 'Meta',
      'groq': 'Groq',
      'deepseek': 'DeepSeek'
    };
    return displayNames[providerName] || providerName.charAt(0).toUpperCase() + providerName.slice(1);
  }

  /**
   * Get fallback models when registry is unavailable
   */
  private getFallbackModels(providerName: string): ModelConfig[] {
    const fallbackModels: Record<string, ModelConfig[]> = {
      'anthropic': [
        {
          id: 'claude-3-5-sonnet-20241022',
          name: 'Claude 3.5 Sonnet',
          contextLength: 200000,
          capabilities: ['text', 'reasoning', 'code']
        },
        {
          id: 'claude-3-haiku-20240307',
          name: 'Claude 3 Haiku',
          contextLength: 200000,
          capabilities: ['text', 'speed']
        }
      ],
      'openai': [
        {
          id: 'gpt-4o',
          name: 'GPT-4o',
          contextLength: 128000,
          capabilities: ['text', 'vision', 'reasoning']
        },
        {
          id: 'gpt-4o-mini',
          name: 'GPT-4o Mini',
          contextLength: 128000,
          capabilities: ['text', 'speed', 'cost-effective']
        }
      ],
      'google': [
        {
          id: 'gemini-1.5-pro',
          name: 'Gemini 1.5 Pro',
          contextLength: 2000000,
          capabilities: ['text', 'vision', 'large-context']
        },
        {
          id: 'gemini-1.5-flash',
          name: 'Gemini 1.5 Flash',
          contextLength: 1000000,
          capabilities: ['text', 'speed', 'large-context']
        }
      ]
    };

    return fallbackModels[providerName] || [];
  }

  /**
   * Calculate provider priority (service providers get higher priority)
   */
  private calculatePriority(providerName: string, isServiceProvider: boolean): number {
    const basePriority = isServiceProvider ? 100 : 200;
    const providerIndex = [...this.serviceProviders, ...this.byokProviders].indexOf(providerName);
    return basePriority + providerIndex;
  }

  /**
   * Add pricing override for incorrect registry data
   */
  addPricingOverride(override: Omit<PricingOverride, 'appliedAt'>): void {
    const key = override.model ? `${override.provider}:${override.model}` : override.provider;
    const fullOverride: PricingOverride = {
      ...override,
      appliedAt: new Date().toISOString()
    };

    if (!this.pricingOverrides.has(key)) {
      this.pricingOverrides.set(key, []);
    }
    this.pricingOverrides.get(key)!.push(fullOverride);

    console.info(`Applied pricing override for ${key}:`, fullOverride);
  }

  /**
   * Get overridden price if available
   */
  private getOverriddenPrice(provider: string, model: string, type: 'input' | 'output'): number | undefined {
    // Check model-specific override first
    const modelKey = `${provider}:${model}`;
    const modelOverrides = this.pricingOverrides.get(modelKey);
    if (modelOverrides && modelOverrides.length > 0) {
      const latest = modelOverrides[modelOverrides.length - 1];
      return latest.pricing[type];
    }

    // Check provider-level override
    const providerOverrides = this.pricingOverrides.get(provider);
    if (providerOverrides && providerOverrides.length > 0) {
      const latest = providerOverrides[providerOverrides.length - 1];
      return latest.pricing[type];
    }

    return undefined;
  }

  /**
   * Fallback providers when registry is unavailable
   */
  private getFallbackProviders(type: 'service' | 'byok' | 'all'): ProviderConfig[] {
    const fallbackData = [
      {
        name: 'anthropic',
        displayName: 'Anthropic',
        models: [
          {
            id: 'claude-3-5-sonnet-20241022',
            name: 'Claude 3.5 Sonnet',
            contextLength: 200000,
            capabilities: ['text', 'reasoning', 'code']
          },
          {
            id: 'claude-3-haiku-20240307',
            name: 'Claude 3 Haiku',
            contextLength: 200000,
            capabilities: ['text', 'speed']
          }
        ],
        priority: 1,
        isServiceProvider: this.serviceProviders.includes('anthropic'),
        isByokProvider: this.byokProviders.includes('anthropic')
      },
      {
        name: 'openai',
        displayName: 'OpenAI',
        models: [
          {
            id: 'gpt-4o',
            name: 'GPT-4o',
            contextLength: 128000,
            capabilities: ['text', 'vision', 'reasoning']
          },
          {
            id: 'gpt-4o-mini',
            name: 'GPT-4o Mini',
            contextLength: 128000,
            capabilities: ['text', 'speed', 'cost-effective']
          }
        ],
        priority: 2,
        isServiceProvider: this.serviceProviders.includes('openai'),
        isByokProvider: this.byokProviders.includes('openai')
      },
      {
        name: 'google',
        displayName: 'Google',
        models: [
          {
            id: 'gemini-1.5-pro',
            name: 'Gemini 1.5 Pro',
            contextLength: 2000000,
            capabilities: ['text', 'vision', 'large-context']
          },
          {
            id: 'gemini-1.5-flash',
            name: 'Gemini 1.5 Flash',
            contextLength: 1000000,
            capabilities: ['text', 'speed', 'large-context']
          }
        ],
        priority: 3,
        isServiceProvider: this.serviceProviders.includes('google'),
        isByokProvider: this.byokProviders.includes('google')
      }
    ];

    return fallbackData.filter(provider => {
      if (type === 'service') return provider.isServiceProvider;
      if (type === 'byok') return provider.isByokProvider;
      return provider.isServiceProvider || provider.isByokProvider;
    }) as ProviderConfig[];
  }

  /**
   * Check for pricing changes and warn
   */
  async checkForPricingChanges(): Promise<{ hasChanges: boolean; changes: string[] }> {
    // This would be called during re-aggregation
    // Implementation depends on how the registry tracks changes
    const changes: string[] = [];
    
    // TODO: Implement actual change detection
    // This is a placeholder for the warning system mentioned in the spec
    
    return {
      hasChanges: changes.length > 0,
      changes
    };
  }

  /**
   * Update configuration
   */
  updateConfiguration(serviceProviders: string[], byokProviders: string[]): void {
    this.serviceProviders = serviceProviders;
    this.byokProviders = byokProviders;
  }
}