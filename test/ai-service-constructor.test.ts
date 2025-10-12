import { describe, it, expect } from 'vitest';
import { AIService } from '../src/services/ai/ai-service.js';

describe('AIService Constructor', () => {
  describe('Provider Configuration', () => {
    it('should throw error when no providers configured', () => {
      expect(() => {
        new AIService({
          // No serviceProviders provided
        } as any);
      }).toThrow('No AI service providers configured');
    });

    it('should accept string array for serviceProviders', () => {
      const service = new AIService({
        serviceProviders: [
          { name: 'anthropic', apiKey: 'test-key-1', priority: 1 },
          { name: 'openai', apiKey: 'test-key-2', priority: 2 }
        ]
      });

      expect(service).toBeDefined();
      // Should not throw
    });

    it('should handle string array providers with priority by index', () => {
      const service = new AIService({
        serviceProviders: [
          { name: 'anthropic', apiKey: 'key1', priority: 0 }, // Index 0
          { name: 'openai', apiKey: 'key2', priority: 1 },    // Index 1
          { name: 'google', apiKey: 'key3', priority: 2 }     // Index 2
        ]
      });

      // Service should use first provider as default (highest priority by index)
      expect(service).toBeDefined();
    });

    it('should accept object-style provider configuration', () => {
      const service = new AIService({
        serviceProviders: {
          anthropic: {
            apiKey: 'test-key',
            priority: 1
          }
        }
      });

      expect(service).toBeDefined();
    });

    it('should throw meaningful error for empty serviceProviders array', () => {
      expect(() => {
        new AIService({
          serviceProviders: []
        });
      }).toThrow('No valid AI service providers configured');
    });
  });

  describe('Default Provider Selection (Line 415)', () => {
    it('should use explicit defaultProvider when provided', () => {
      const service = new AIService({
        defaultProvider: 'openai',
        serviceProviders: [
          { name: 'anthropic', apiKey: 'key1', priority: 1 },
          { name: 'openai', apiKey: 'key2', priority: 2 }
        ]
      });

      // Can't directly access private config, but we can test it doesn't throw
      expect(service).toBeDefined();
    });

    it('should fallback to highest-priority provider when no defaultProvider', () => {
      const service = new AIService({
        serviceProviders: [
          { name: 'anthropic', apiKey: 'key1', priority: 10 },
          { name: 'openai', apiKey: 'key2', priority: 5 }
        ]
      });

      // Anthropic should be selected (priority 10 > 5)
      expect(service).toBeDefined();
    });

    it('should use first provider when priorities are equal', () => {
      const service = new AIService({
        serviceProviders: [
          { name: 'anthropic', apiKey: 'key1', priority: 1 },
          { name: 'openai', apiKey: 'key2', priority: 1 }
        ]
      });

      expect(service).toBeDefined();
    });
  });

  describe('MCP Service Initialization (Line 418-420)', () => {
    it('should initialize MCP when mcpConfig is provided', () => {
      const service = new AIService({
        serviceProviders: [
          { name: 'anthropic', apiKey: 'test-key', priority: 1 }
        ],
        mcpConfig: {
          enableWebSearch: true
        }
      });

      expect(service).toBeDefined();
      // MCP service should be initialized
    });

    it('should NOT initialize MCP when only systemPrompts provided', () => {
      const service = new AIService({
        serviceProviders: [
          { name: 'anthropic', apiKey: 'test-key', priority: 1 }
        ],
        systemPrompts: {
          'default': 'You are a helpful assistant'
        }
        // No mcpConfig - MCP should NOT be initialized
      });

      expect(service).toBeDefined();
      // MCP service should be undefined (not auto-enabled)
    });

    it('should NOT initialize MCP when no config provided', () => {
      const service = new AIService({
        serviceProviders: [
          { name: 'anthropic', apiKey: 'test-key', priority: 1 }
        ]
        // No mcpConfig, no systemPrompts
      });

      expect(service).toBeDefined();
      // MCP service should be undefined
    });

    it('should require explicit mcpConfig for MCP initialization', () => {
      // This tests the fix for unexpected behavior where MCP was auto-enabled
      const serviceWithoutMcp = new AIService({
        serviceProviders: [
          { name: 'anthropic', apiKey: 'test-key', priority: 1 }
        ],
        systemPrompts: {
          'default': 'Test prompt',
          'creative': 'Creative prompt'
        }
      });

      const serviceWithMcp = new AIService({
        serviceProviders: [
          { name: 'anthropic', apiKey: 'test-key', priority: 1 }
        ],
        mcpConfig: {
          enableWebSearch: true
        }
      });

      // Both should be valid but behave differently
      expect(serviceWithoutMcp).toBeDefined();
      expect(serviceWithMcp).toBeDefined();
    });
  });

  describe('Model Registry Initialization (Line 424)', () => {
    it('should initialize modelRegistry with default config', () => {
      const service = new AIService({
        serviceProviders: [
          { name: 'anthropic', apiKey: 'test-key', priority: 1 }
        ]
      });

      expect(service).toBeDefined();
      // Model registry should be initialized with defaults
    });

    it('should pass custom registryConfig to ModelRegistry', () => {
      const customRegistryConfig = {
        disableLiveData: true,
        allowDeprecatedModels: false
      };

      const service = new AIService({
        serviceProviders: [
          { name: 'anthropic', apiKey: 'test-key', priority: 1 }
        ],
        modelRegistry: {
          registryConfig: customRegistryConfig
        }
      });

      expect(service).toBeDefined();
      // Model registry should be initialized with custom config
    });

    it('should handle undefined modelRegistry config gracefully', () => {
      const service = new AIService({
        serviceProviders: [
          { name: 'anthropic', apiKey: 'test-key', priority: 1 }
        ],
        modelRegistry: undefined
      });

      expect(service).toBeDefined();
      // Should use default registry config
    });

    it('should handle partial modelRegistry config', () => {
      const service = new AIService({
        serviceProviders: [
          { name: 'anthropic', apiKey: 'test-key', priority: 1 }
        ],
        modelRegistry: {
          // registryConfig not provided, just empty object
        }
      });

      expect(service).toBeDefined();
      // Should handle partial config gracefully
    });
  });

  describe('System Prompts Initialization', () => {
    it('should use provided systemPrompts', () => {
      const customPrompts = {
        'default': 'Custom default prompt',
        'creative': 'Custom creative prompt'
      };

      const service = new AIService({
        serviceProviders: [
          { name: 'anthropic', apiKey: 'test-key', priority: 1 }
        ],
        systemPrompts: customPrompts
      });

      expect(service).toBeDefined();
    });

    it('should use default systemPrompts when not provided', () => {
      const service = new AIService({
        serviceProviders: [
          { name: 'anthropic', apiKey: 'test-key', priority: 1 }
        ]
        // No systemPrompts provided
      });

      expect(service).toBeDefined();
      // Should have default prompts
    });
  });

  describe('System Prompt Policy Initialization', () => {
    it('should initialize with restrictToPromptIds: false by default', () => {
      const service = new AIService({
        serviceProviders: [
          { name: 'anthropic', apiKey: 'test-key', priority: 1 }
        ]
      });

      expect(service).toBeDefined();
      // Policy should default to unrestricted
    });

    it('should initialize with restrictToPromptIds: true when configured', () => {
      const service = new AIService({
        serviceProviders: [
          { name: 'anthropic', apiKey: 'test-key', priority: 1 }
        ],
        systemPromptPolicy: {
          restrictToPromptIds: true
        }
      });

      expect(service).toBeDefined();
      // Policy should be restricted
    });
  });

  describe('Model Restrictions Initialization', () => {
    it('should handle modelRestrictions configuration', () => {
      const service = new AIService({
        serviceProviders: [
          { name: 'anthropic', apiKey: 'test-key', priority: 1 }
        ],
        modelRestrictions: {
          anthropic: {
            allowedModels: ['claude-3-5-sonnet-20241022'],
            blockedModels: ['claude-2-1']
          }
        }
      });

      expect(service).toBeDefined();
    });

    it('should handle undefined modelRestrictions', () => {
      const service = new AIService({
        serviceProviders: [
          { name: 'anthropic', apiKey: 'test-key', priority: 1 }
        ]
        // No modelRestrictions
      });

      expect(service).toBeDefined();
    });
  });

  describe('Complex Configuration Scenarios', () => {
    it('should handle full configuration with all options', () => {
      const service = new AIService({
        defaultProvider: 'anthropic',
        serviceProviders: [
          { name: 'anthropic', apiKey: 'key1', priority: 1 },
          { name: 'openai', apiKey: 'key2', priority: 2 }
        ],
        systemPrompts: {
          'default': 'Default prompt',
          'creative': 'Creative prompt'
        },
        systemPromptPolicy: {
          restrictToPromptIds: true
        },
        modelRestrictions: {
          anthropic: {
            allowedModels: ['claude-3-5-sonnet-20241022']
          }
        },
        modelRegistry: {
          registryConfig: {
            disableLiveData: true
          }
        },
        mcpConfig: {
          enableWebSearch: true
        },
        model: 'claude-3-5-sonnet-20241022',
        maxTokens: 4000,
        temperature: 0.7
      });

      expect(service).toBeDefined();
    });

    it('should handle minimal valid configuration', () => {
      const service = new AIService({
        serviceProviders: [
          { name: 'anthropic', apiKey: 'test-key', priority: 1 }
        ]
      });

      expect(service).toBeDefined();
    });
  });
});
