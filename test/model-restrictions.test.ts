import { describe, it, expect, vi, beforeEach } from 'vitest';
import AIService from '../src/services/ai/ai-service.js';

// Mock the AI SDK modules
vi.mock('@ai-sdk/anthropic', () => ({
  anthropic: vi.fn(),
  Anthropic: vi.fn()
}));

vi.mock('@ai-sdk/openai', () => ({
  openai: vi.fn(),
  OpenAI: vi.fn()
}));

vi.mock('@ai-sdk/google', () => ({
  google: vi.fn(),
  Google: vi.fn()
}));

vi.mock('ai', () => ({
  generateText: vi.fn()
}));

// Mock the model registry
vi.mock('../src/services/model-registry.js', () => ({
  ModelRegistry: vi.fn().mockImplementation(() => ({
    getModelsForProvider: vi.fn().mockImplementation((provider) => {
      const models = {
        anthropic: [
          { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet' },
          { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku' },
          { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus' }
        ],
        openai: [
          { id: 'gpt-4o', name: 'GPT-4o' },
          { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' }
        ],
        openrouter: [
          { id: 'anthropic/claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet via OpenRouter' },
          { id: 'openai/gpt-4o', name: 'GPT-4o via OpenRouter' },
          { id: 'meta-llama/llama-3.1-70b', name: 'Llama 3.1 70B' },
          { id: 'mistralai/mistral-large', name: 'Mistral Large' }
        ]
      };
      return Promise.resolve(models[provider] || []);
    }),
    getModelInfo: vi.fn(),
    getProviders: vi.fn().mockReturnValue(['anthropic', 'openai', 'google', 'openrouter'])
  }))
}));

describe.skip('Model Restrictions', () => {
  let aiService: AIService;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('No Restrictions', () => {
    beforeEach(() => {
      aiService = new AIService({
        serviceProviders: {
          anthropic: { apiKey: 'test-key', priority: 1 },
          openai: { apiKey: 'test-key', priority: 2 }
        }
        // No modelRestrictions specified
      });
    });

    it('should allow all models when no restrictions are configured', async () => {
      const models = await aiService.getAllowedModels('anthropic');
      expect(models).toContain('claude-3-5-sonnet-20241022');
      expect(models).toContain('claude-3-haiku-20240307');
      expect(models).toContain('claude-3-opus-20240229');
    });

    it('should allow all models for all providers when no restrictions', async () => {
      const models = await aiService.getAllowedModels();
      expect(models.length).toBeGreaterThan(0);
      expect(models).toContain('claude-3-5-sonnet-20241022');
      expect(models).toContain('gpt-4o');
    });
  });

  describe('Allowed Models (Exact Match)', () => {
    beforeEach(() => {
      aiService = new AIService({
        serviceProviders: {
          anthropic: { apiKey: 'test-key', priority: 1 },
          openai: { apiKey: 'test-key', priority: 2 }
        },
        modelRestrictions: {
          anthropic: {
            allowedModels: ['claude-3-5-sonnet-20241022', 'claude-3-haiku-20240307']
          },
          openai: {
            allowedModels: ['gpt-4o']
          }
        }
      });
    });

    it('should only allow explicitly listed models', async () => {
      const anthropicModels = await aiService.getAllowedModels('anthropic');
      expect(anthropicModels).toHaveLength(2);
      expect(anthropicModels).toContain('claude-3-5-sonnet-20241022');
      expect(anthropicModels).toContain('claude-3-haiku-20240307');
      expect(anthropicModels).not.toContain('claude-3-opus-20240229');
    });

    it('should filter models correctly for different providers', async () => {
      const openaiModels = await aiService.getAllowedModels('openai');
      expect(openaiModels).toHaveLength(1);
      expect(openaiModels).toContain('gpt-4o');
      expect(openaiModels).not.toContain('gpt-3.5-turbo');
    });
  });

  describe('Allowed Patterns (Glob Matching)', () => {
    beforeEach(() => {
      aiService = new AIService({
        serviceProviders: {
          openrouter: { apiKey: 'test-key', priority: 1 }
        },
        modelRestrictions: {
          openrouter: {
            allowedPatterns: ['anthropic/*', 'openai/*']
          }
        }
      });
    });

    it('should filter models based on patterns', async () => {
      const models = await aiService.getAllowedModels('openrouter');
      expect(models).toContain('anthropic/claude-3-5-sonnet-20241022');
      expect(models).toContain('openai/gpt-4o');
      expect(models).not.toContain('meta-llama/llama-3.1-70b');
      expect(models).not.toContain('mistralai/mistral-large');
    });
  });

  describe('Blocked Models', () => {
    beforeEach(() => {
      aiService = new AIService({
        serviceProviders: {
          openrouter: { apiKey: 'test-key', priority: 1 }
        },
        modelRestrictions: {
          openrouter: {
            allowedPatterns: ['*'], // Allow all by default
            blockedModels: ['meta-llama/llama-3.1-70b', 'mistralai/mistral-large']
          }
        }
      });
    });

    it('should exclude blocked models', async () => {
      const models = await aiService.getAllowedModels('openrouter');
      expect(models).toContain('anthropic/claude-3-5-sonnet-20241022');
      expect(models).toContain('openai/gpt-4o');
      expect(models).not.toContain('meta-llama/llama-3.1-70b');
      expect(models).not.toContain('mistralai/mistral-large');
    });
  });

  describe('Complex Restrictions', () => {
    beforeEach(() => {
      aiService = new AIService({
        serviceProviders: {
          openrouter: { apiKey: 'test-key', priority: 1 },
          anthropic: { apiKey: 'test-key', priority: 2 }
        },
        modelRestrictions: {
          openrouter: {
            allowedPatterns: ['anthropic/*', 'openai/*'],
            blockedModels: ['anthropic/claude-3-5-sonnet-20241022'] // Block specific model
          },
          // anthropic provider has no restrictions
        }
      });
    });

    it('should handle combination of patterns and blocked models', async () => {
      const models = await aiService.getAllowedModels('openrouter');
      
      // Should include openai models (matches pattern, not blocked)
      expect(models).toContain('openai/gpt-4o');
      
      // Should exclude the blocked anthropic model even though it matches pattern
      expect(models).not.toContain('anthropic/claude-3-5-sonnet-20241022');
      
      // Should exclude models that don't match patterns
      expect(models).not.toContain('meta-llama/llama-3.1-70b');
    });

    it('should have no restrictions for providers without config', async () => {
      const anthropicModels = await aiService.getAllowedModels('anthropic');
      
      // anthropic provider has no restrictions, so all models should be allowed
      expect(anthropicModels).toContain('claude-3-5-sonnet-20241022');
      expect(anthropicModels).toContain('claude-3-haiku-20240307');
      expect(anthropicModels).toContain('claude-3-opus-20240229');
    });
  });

  describe('Pattern Matching Logic', () => {
    let service: AIService;

    beforeEach(() => {
      service = new AIService({
        serviceProviders: {
          anthropic: { apiKey: 'test-key', priority: 1 }
        },
        modelRestrictions: {
          anthropic: {
            allowedPatterns: ['claude-*', 'gpt-?.?', '*.5-*']
          }
        }
      });
    });

    it('should test pattern matching directly', () => {
      // Test the private method using type assertion
      const matchesPattern = (service as any).matchesPattern.bind(service);
      
      // Test asterisk wildcards
      expect(matchesPattern('claude-3-5-sonnet', 'claude-*')).toBe(true);
      expect(matchesPattern('claude-anything', 'claude-*')).toBe(true);
      expect(matchesPattern('gpt-4o', 'claude-*')).toBe(false);
      
      // Test question mark wildcards
      expect(matchesPattern('gpt-4.0', 'gpt-?.?')).toBe(true);
      expect(matchesPattern('gpt-3.5', 'gpt-?.?')).toBe(true);
      expect(matchesPattern('gpt-40', 'gpt-?.?')).toBe(false);
      
      // Test complex patterns
      expect(matchesPattern('gemini-1.5-flash', '*.5-*')).toBe(true);
      expect(matchesPattern('claude-3.5-sonnet', '*.5-*')).toBe(true);
      expect(matchesPattern('gpt-4.0-turbo', '*.5-*')).toBe(false);
    });
  });

  describe('Validation Logic', () => {
    let service: AIService;

    beforeEach(() => {
      service = new AIService({
        serviceProviders: {
          anthropic: { apiKey: 'test-key', priority: 1 }
        },
        modelRestrictions: {
          anthropic: {
            allowedModels: ['model-a', 'model-b'],
            allowedPatterns: ['pattern-*'],
            blockedModels: ['blocked-model']
          }
        }
      });
    });

    it('should test validation logic directly', () => {
      // Test the private method using type assertion
      const validateModelRestrictions = (service as any).validateModelRestrictions.bind(service);
      
      // Test allowed models
      expect(validateModelRestrictions('anthropic', 'model-a')).toEqual({
        allowed: true
      });
      
      // Test blocked models (should be blocked even if in allowed list)
      expect(validateModelRestrictions('anthropic', 'blocked-model')).toEqual({
        allowed: false,
        error: "Model 'blocked-model' is blocked for provider 'anthropic'",
        suggestions: ['model-a', 'model-b']
      });
      
      // Test pattern matching
      expect(validateModelRestrictions('anthropic', 'pattern-xyz')).toEqual({
        allowed: true
      });
      
      // Test rejected models
      const result = validateModelRestrictions('anthropic', 'invalid-model');
      expect(result.allowed).toBe(false);
      expect(result.error).toContain("Model 'invalid-model' not allowed for provider 'anthropic'");
      expect(result.suggestions).toEqual(['model-a', 'model-b']);
    });

    it('should allow all models when no restrictions exist', () => {
      const noRestrictionsService = new AIService({
        serviceProviders: {
          anthropic: { apiKey: 'test-key', priority: 1 }
        }
        // No modelRestrictions
      });
      
      const validateModelRestrictions = (noRestrictionsService as any).validateModelRestrictions.bind(noRestrictionsService);
      
      expect(validateModelRestrictions('anthropic', 'any-model')).toEqual({
        allowed: true
      });
    });
  });

  describe('getAllowedModels Method', () => {
    beforeEach(() => {
      aiService = new AIService({
        serviceProviders: {
          anthropic: { apiKey: 'test-key', priority: 1 },
          openai: { apiKey: 'test-key', priority: 2 },
          openrouter: { apiKey: 'test-key', priority: 3 }
        },
        modelRestrictions: {
          anthropic: {
            allowedModels: ['claude-3-5-sonnet-20241022']
          },
          openrouter: {
            allowedPatterns: ['anthropic/*'],
            blockedModels: ['anthropic/claude-3-5-sonnet-20241022']
          }
          // openai has no restrictions
        }
      });
    });

    it('should return filtered models for specific provider', async () => {
      const anthropicModels = await aiService.getAllowedModels('anthropic');
      expect(anthropicModels).toHaveLength(1);
      expect(anthropicModels).toContain('claude-3-5-sonnet-20241022');
    });

    it('should return all models for provider without restrictions', async () => {
      const openaiModels = await aiService.getAllowedModels('openai');
      expect(openaiModels.length).toBeGreaterThan(1);
      expect(openaiModels).toContain('gpt-4o');
      expect(openaiModels).toContain('gpt-3.5-turbo');
    });

    it('should return combined filtered models for all providers when no provider specified', async () => {
      const allModels = await aiService.getAllowedModels();
      
      // Should include anthropic's allowed model
      expect(allModels).toContain('claude-3-5-sonnet-20241022');
      
      // Should include openai models (no restrictions)
      expect(allModels).toContain('gpt-4o');
      
      // Should NOT include the blocked openrouter model
      // (openrouter has pattern anthropic/* but blocks anthropic/claude-3-5-sonnet-20241022)
      expect(allModels.filter(m => m === 'anthropic/claude-3-5-sonnet-20241022')).toHaveLength(0);
    });
  });
});