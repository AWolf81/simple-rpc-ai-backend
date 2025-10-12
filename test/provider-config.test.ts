import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { parseProviders, validateProviderConfig, getProviderConfig, mergeProviderConfig } from '../src/config/provider-parser.js';
import type { ParsedProvider } from '../src/config/provider-parser.js';
import type { ProviderConfig } from '../src/rpc-ai-server.js';

describe('Provider Configuration Parser', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('parseProviders - Simple String Form', () => {
    it('should parse single provider with env var', () => {
      process.env.ANTHROPIC_API_KEY = 'test-key-123';

      const result = parseProviders(['anthropic']);

      expect(result.errors).toHaveLength(0);
      expect(result.providers).toHaveLength(1);
      expect(result.providers[0]).toMatchObject({
        name: 'anthropic',
        apiKey: 'test-key-123',
        isCustom: false,
        isByok: false
      });
    });

    it('should parse multiple providers with env vars', () => {
      process.env.ANTHROPIC_API_KEY = 'anthropic-key';
      process.env.OPENAI_API_KEY = 'openai-key';
      process.env.GOOGLE_API_KEY = 'google-key';

      const result = parseProviders(['anthropic', 'openai', 'google']);

      expect(result.errors).toHaveLength(0);
      expect(result.providers).toHaveLength(3);
      expect(result.providers[0].name).toBe('anthropic');
      expect(result.providers[1].name).toBe('openai');
      expect(result.providers[2].name).toBe('google');
    });

    it('should warn when provider has no API key', () => {
      delete process.env.ANTHROPIC_API_KEY;

      const result = parseProviders(['anthropic']);

      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toContain('ANTHROPIC_API_KEY');
      expect(result.providers[0]).toMatchObject({
        name: 'anthropic',
        apiKey: undefined
      });
    });

    it('should normalize provider names to lowercase', () => {
      process.env.OPENAI_API_KEY = 'test-key';

      const result = parseProviders(['OpenAI', 'ANTHROPIC']);

      expect(result.providers[0].name).toBe('openai');
      expect(result.providers[1].name).toBe('anthropic');
    });
  });

  describe('parseProviders - Extended Object Form', () => {
    it('should parse provider with explicit API key', () => {
      const config: ProviderConfig = {
        name: 'anthropic',
        apiKey: 'explicit-key-123',
        defaultModel: 'claude-3-5-sonnet-20241022'
      };

      const result = parseProviders([config]);

      expect(result.errors).toHaveLength(0);
      expect(result.providers[0]).toMatchObject({
        name: 'anthropic',
        apiKey: 'explicit-key-123',
        defaultModel: 'claude-3-5-sonnet-20241022',
        isCustom: false,
        isByok: false
      });
    });

    it('should parse provider with model restrictions', () => {
      const config: ProviderConfig = {
        name: 'anthropic',
        apiKey: 'test-key',
        modelRestrictions: {
          allowedModels: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022'],
          blockedModels: ['claude-3-opus-20240229']
        }
      };

      const result = parseProviders([config]);

      expect(result.errors).toHaveLength(0);
      expect(result.providers[0].modelRestrictions).toEqual({
        allowedModels: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022'],
        blockedModels: ['claude-3-opus-20240229']
      });
    });

    it('should parse provider with system prompts', () => {
      const config: ProviderConfig = {
        name: 'openai',
        apiKey: 'test-key',
        systemPrompts: {
          'creative': 'You are a creative writing assistant',
          'technical': 'You are a technical documentation expert'
        }
      };

      const result = parseProviders([config]);

      expect(result.errors).toHaveLength(0);
      expect(result.providers[0].systemPrompts).toEqual({
        'creative': 'You are a creative writing assistant',
        'technical': 'You are a technical documentation expert'
      });
    });

    it('should parse custom provider with type and baseUrl', () => {
      const config: ProviderConfig = {
        name: 'custom-openai',
        type: 'openai',
        baseUrl: 'https://custom.openai.com/v1',
        apiKey: 'custom-key',
        apiKeyHeader: 'X-API-Key',
        apiKeyPrefix: 'Token '
      };

      const result = parseProviders([config]);

      expect(result.errors).toHaveLength(0);
      expect(result.providers[0]).toMatchObject({
        name: 'custom-openai',
        type: 'openai',
        baseUrl: 'https://custom.openai.com/v1',
        apiKey: 'custom-key',
        apiKeyHeader: 'X-API-Key',
        apiKeyPrefix: 'Token ',
        isCustom: true
      });
    });

    it('should error on custom provider without type', () => {
      const config: ProviderConfig = {
        name: 'my-provider',
        apiKey: 'test-key'
      };

      const result = parseProviders([config]);

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain("must specify 'type'");
    });

    it('should error on custom provider with baseUrl but no type', () => {
      const config: ProviderConfig = {
        name: 'my-provider',
        baseUrl: 'https://api.example.com',
        apiKey: 'test-key'
      };

      const result = parseProviders([config]);

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain("must specify 'type'");
    });

    it('should fallback to env var if apiKey not provided', () => {
      process.env.GOOGLE_API_KEY = 'env-google-key';

      const config: ProviderConfig = {
        name: 'google',
        defaultModel: 'gemini-1.5-flash'
      };

      const result = parseProviders([config]);

      expect(result.errors).toHaveLength(0);
      expect(result.providers[0]).toMatchObject({
        name: 'google',
        apiKey: 'env-google-key',
        defaultModel: 'gemini-1.5-flash'
      });
    });
  });

  describe('parseProviders - Mixed Configuration', () => {
    it('should parse mix of string and object configs', () => {
      process.env.ANTHROPIC_API_KEY = 'env-anthropic-key';

      const configs: (string | ProviderConfig)[] = [
        'anthropic',
        {
          name: 'openai',
          apiKey: 'explicit-openai-key',
          defaultModel: 'gpt-4o'
        },
        'google'
      ];

      const result = parseProviders(configs);

      expect(result.errors).toHaveLength(0);
      expect(result.providers).toHaveLength(3);
      expect(result.providers[0]).toMatchObject({
        name: 'anthropic',
        apiKey: 'env-anthropic-key'
      });
      expect(result.providers[1]).toMatchObject({
        name: 'openai',
        apiKey: 'explicit-openai-key',
        defaultModel: 'gpt-4o'
      });
      expect(result.providers[2]).toMatchObject({
        name: 'google'
      });
    });
  });

  describe('parseProviders - Legacy API (serverProviders + byokProviders)', () => {
    it('should parse legacy serverProviders', () => {
      process.env.ANTHROPIC_API_KEY = 'test-key';
      process.env.OPENAI_API_KEY = 'test-key-2';

      const result = parseProviders(undefined, ['anthropic', 'openai']);

      expect(result.errors).toHaveLength(0);
      expect(result.providers).toHaveLength(2);
      expect(result.providers[0]).toMatchObject({
        name: 'anthropic',
        isByok: false
      });
      expect(result.providers[1]).toMatchObject({
        name: 'openai',
        isByok: false
      });
    });

    it('should parse legacy byokProviders', () => {
      const result = parseProviders(undefined, undefined, ['anthropic', 'openai']);

      expect(result.providers).toHaveLength(2);
      expect(result.providers[0]).toMatchObject({
        name: 'anthropic',
        isByok: true
      });
      expect(result.providers[1]).toMatchObject({
        name: 'openai',
        isByok: true
      });
    });

    it('should combine serverProviders and byokProviders without duplicates', () => {
      process.env.ANTHROPIC_API_KEY = 'test-key';

      const result = parseProviders(
        undefined,
        ['anthropic', 'openai'],
        ['anthropic', 'google']
      );

      expect(result.providers).toHaveLength(3);
      expect(result.providers.map(p => p.name)).toEqual(['anthropic', 'openai', 'google']);
      expect(result.providers[0].isByok).toBe(false); // anthropic from serverProviders
      expect(result.providers[1].isByok).toBe(false); // openai from serverProviders
      expect(result.providers[2].isByok).toBe(true);  // google from byokProviders only
    });
  });

  describe('parseProviders - Validation', () => {
    it('should detect duplicate provider names', () => {
      process.env.ANTHROPIC_API_KEY = 'key1';

      const result = parseProviders(['anthropic', 'anthropic']);

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Duplicate provider');
      expect(result.providers).toHaveLength(2);
    });

    it('should handle invalid configuration types', () => {
      const result = parseProviders([null as any, undefined as any, 123 as any]);

      expect(result.errors.length).toBeGreaterThanOrEqual(1);
      expect(result.errors.some(e => e.includes('Invalid provider configuration'))).toBe(true);
    });

    it('should handle empty providers array', () => {
      const result = parseProviders([]);

      expect(result.errors).toHaveLength(0);
      expect(result.providers).toHaveLength(0);
    });
  });

  describe('validateProviderConfig', () => {
    it('should validate existing provider with API key', () => {
      const providers: ParsedProvider[] = [{
        name: 'anthropic',
        apiKey: 'test-key',
        isCustom: false,
        isByok: false
      }];

      const validation = validateProviderConfig('anthropic', providers);

      expect(validation.valid).toBe(true);
      expect(validation.error).toBeUndefined();
    });

    it('should validate BYOK provider without API key', () => {
      const providers: ParsedProvider[] = [{
        name: 'anthropic',
        apiKey: undefined,
        isCustom: false,
        isByok: true
      }];

      const validation = validateProviderConfig('anthropic', providers);

      expect(validation.valid).toBe(true);
      expect(validation.error).toBeUndefined();
    });

    it('should reject provider not in configuration', () => {
      const providers: ParsedProvider[] = [{
        name: 'anthropic',
        apiKey: 'test-key',
        isCustom: false,
        isByok: false
      }];

      const validation = validateProviderConfig('openai', providers);

      expect(validation.valid).toBe(false);
      expect(validation.error).toContain('not found in configuration');
      expect(validation.error).toContain('anthropic');
    });

    it('should reject non-BYOK provider without API key', () => {
      const providers: ParsedProvider[] = [{
        name: 'anthropic',
        apiKey: undefined,
        isCustom: false,
        isByok: false
      }];

      const validation = validateProviderConfig('anthropic', providers);

      expect(validation.valid).toBe(false);
      expect(validation.error).toContain('no API key configured');
    });
  });

  describe('getProviderConfig', () => {
    it('should retrieve provider by name', () => {
      const providers: ParsedProvider[] = [
        { name: 'anthropic', apiKey: 'key1', isCustom: false, isByok: false },
        { name: 'openai', apiKey: 'key2', isCustom: false, isByok: false }
      ];

      const provider = getProviderConfig('openai', providers);

      expect(provider).toBeDefined();
      expect(provider?.name).toBe('openai');
      expect(provider?.apiKey).toBe('key2');
    });

    it('should return undefined for non-existent provider', () => {
      const providers: ParsedProvider[] = [
        { name: 'anthropic', apiKey: 'key1', isCustom: false, isByok: false }
      ];

      const provider = getProviderConfig('openai', providers);

      expect(provider).toBeUndefined();
    });
  });

  describe('mergeProviderConfig', () => {
    it('should merge global system prompts with provider-specific ones', () => {
      const provider: ParsedProvider = {
        name: 'anthropic',
        apiKey: 'test-key',
        systemPrompts: {
          'specific': 'Provider-specific prompt'
        },
        isCustom: false,
        isByok: false
      };

      const globalPrompts = {
        'default': 'Global default prompt',
        'creative': 'Global creative prompt'
      };

      const merged = mergeProviderConfig(provider, globalPrompts);

      expect(merged.systemPrompts).toEqual({
        'default': 'Global default prompt',
        'creative': 'Global creative prompt',
        'specific': 'Provider-specific prompt'
      });
    });

    it('should prioritize provider-specific prompts over global ones', () => {
      const provider: ParsedProvider = {
        name: 'anthropic',
        apiKey: 'test-key',
        systemPrompts: {
          'default': 'Provider-specific default'
        },
        isCustom: false,
        isByok: false
      };

      const globalPrompts = {
        'default': 'Global default prompt'
      };

      const merged = mergeProviderConfig(provider, globalPrompts);

      expect(merged.systemPrompts?.['default']).toBe('Provider-specific default');
    });

    it('should merge global model restrictions with provider-specific ones', () => {
      const provider: ParsedProvider = {
        name: 'anthropic',
        apiKey: 'test-key',
        modelRestrictions: {
          allowedModels: ['claude-3-5-haiku-20241022']
        },
        isCustom: false,
        isByok: false
      };

      const globalRestrictions = {
        'anthropic': {
          allowedPatterns: ['claude-3-*'],
          blockedModels: ['claude-2-*']
        }
      };

      const merged = mergeProviderConfig(provider, undefined, globalRestrictions);

      expect(merged.modelRestrictions).toEqual({
        allowedPatterns: ['claude-3-*'],
        blockedModels: ['claude-2-*'],
        allowedModels: ['claude-3-5-haiku-20241022']
      });
    });

    it('should prioritize provider-specific restrictions over global ones', () => {
      const provider: ParsedProvider = {
        name: 'anthropic',
        apiKey: 'test-key',
        modelRestrictions: {
          allowedModels: ['claude-3-5-sonnet-20241022'],
          blockedModels: ['claude-3-opus-20240229']
        },
        isCustom: false,
        isByok: false
      };

      const globalRestrictions = {
        'anthropic': {
          allowedModels: ['claude-2-1'],
          blockedModels: ['claude-instant-1']
        }
      };

      const merged = mergeProviderConfig(provider, undefined, globalRestrictions);

      expect(merged.modelRestrictions?.allowedModels).toEqual(['claude-3-5-sonnet-20241022']);
      expect(merged.modelRestrictions?.blockedModels).toEqual(['claude-3-opus-20240229']);
    });
  });

  describe('Real-World Configuration Scenarios', () => {
    it('should handle minimal production config', () => {
      process.env.ANTHROPIC_API_KEY = 'prod-key';

      const result = parseProviders(['anthropic']);

      expect(result.errors).toHaveLength(0);
      expect(result.providers).toHaveLength(1);
      expect(result.providers[0].name).toBe('anthropic');
    });

    it('should handle multi-provider with restrictions', () => {
      process.env.ANTHROPIC_API_KEY = 'key1';
      process.env.OPENAI_API_KEY = 'key2';

      const configs: ProviderConfig[] = [
        {
          name: 'anthropic',
          modelRestrictions: {
            allowedModels: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022']
          }
        },
        {
          name: 'openai',
          defaultModel: 'gpt-4o-mini',
          modelRestrictions: {
            blockedModels: ['gpt-4o']
          }
        }
      ];

      const result = parseProviders(configs);

      expect(result.errors).toHaveLength(0);
      expect(result.providers).toHaveLength(2);
      expect(result.providers[0].modelRestrictions?.allowedModels).toContain('claude-3-5-sonnet-20241022');
      expect(result.providers[1].modelRestrictions?.blockedModels).toContain('gpt-4o');
    });

    it('should handle custom OpenAI-compatible provider', () => {
      const config: ProviderConfig = {
        name: 'azure-openai',
        type: 'openai',
        baseUrl: 'https://myaccount.openai.azure.com/openai/deployments/my-deployment',
        apiKey: 'azure-key',
        apiKeyHeader: 'api-key',
        defaultModel: 'gpt-4'
      };

      const result = parseProviders([config]);

      expect(result.errors).toHaveLength(0);
      expect(result.providers[0]).toMatchObject({
        name: 'azure-openai',
        type: 'openai',
        baseUrl: 'https://myaccount.openai.azure.com/openai/deployments/my-deployment',
        isCustom: true
      });
    });

    it('should enforce only configured providers are available', () => {
      process.env.ANTHROPIC_API_KEY = 'key1';
      process.env.OPENAI_API_KEY = 'key2';
      process.env.GOOGLE_API_KEY = 'key3';

      // Only allow anthropic and openai
      const result = parseProviders(['anthropic', 'openai']);

      expect(result.providers).toHaveLength(2);
      expect(result.providers.map(p => p.name)).toEqual(['anthropic', 'openai']);

      // Validate that google is not available
      const googleValidation = validateProviderConfig('google', result.providers);
      expect(googleValidation.valid).toBe(false);
      expect(googleValidation.error).toContain('not found in configuration');
    });

    it('should handle empty config (no providers allowed)', () => {
      process.env.ANTHROPIC_API_KEY = 'key1';

      const result = parseProviders([]);

      expect(result.providers).toHaveLength(0);

      // Validate that no provider is available
      const validation = validateProviderConfig('anthropic', result.providers);
      expect(validation.valid).toBe(false);
    });

    it('should handle BYOK-only configuration', () => {
      // No server API keys in env
      delete process.env.ANTHROPIC_API_KEY;
      delete process.env.OPENAI_API_KEY;

      const result = parseProviders(undefined, undefined, ['anthropic', 'openai']);

      expect(result.providers).toHaveLength(2);
      expect(result.providers[0].isByok).toBe(true);
      expect(result.providers[1].isByok).toBe(true);

      // BYOK providers are valid even without API keys
      const validation = validateProviderConfig('anthropic', result.providers);
      expect(validation.valid).toBe(true);
    });

    it('should support per-provider system prompt override', () => {
      process.env.ANTHROPIC_API_KEY = 'key1';
      process.env.OPENAI_API_KEY = 'key2';

      const configs: ProviderConfig[] = [
        {
          name: 'anthropic',
          systemPrompts: {
            'default': 'You are Claude, created by Anthropic',
            'coding': 'You are an expert programmer focused on clean code'
          }
        },
        {
          name: 'openai',
          systemPrompts: {
            'default': 'You are ChatGPT, created by OpenAI',
            'coding': 'You are a software engineer with deep knowledge of algorithms'
          }
        }
      ];

      const result = parseProviders(configs);

      expect(result.errors).toHaveLength(0);
      expect(result.providers).toHaveLength(2);

      // Check Anthropic prompts
      expect(result.providers[0].systemPrompts).toEqual({
        'default': 'You are Claude, created by Anthropic',
        'coding': 'You are an expert programmer focused on clean code'
      });

      // Check OpenAI prompts
      expect(result.providers[1].systemPrompts).toEqual({
        'default': 'You are ChatGPT, created by OpenAI',
        'coding': 'You are a software engineer with deep knowledge of algorithms'
      });

      // Verify prompts are different per provider
      expect(result.providers[0].systemPrompts?.['default'])
        .not.toBe(result.providers[1].systemPrompts?.['default']);
    });
  });

  describe('Provider Access Control Integration', () => {
    it('should block unlisted provider even when API key exists in environment', () => {
      // Setup: All three providers have API keys
      process.env.ANTHROPIC_API_KEY = 'anthropic-key';
      process.env.OPENAI_API_KEY = 'openai-key';
      process.env.GOOGLE_API_KEY = 'google-key';

      // Configure: Only allow anthropic and google
      const result = parseProviders(['anthropic', 'google']);

      expect(result.providers).toHaveLength(2);
      expect(result.providers.map(p => p.name)).toEqual(['anthropic', 'google']);

      // Test: OpenAI should be blocked even though OPENAI_API_KEY exists
      const openaiValidation = validateProviderConfig('openai', result.providers);
      expect(openaiValidation.valid).toBe(false);
      expect(openaiValidation.error).toContain('not found in configuration');
      expect(openaiValidation.error).toContain('Available: anthropic, google');
    });

    it('should allow only explicitly configured providers', () => {
      // All providers have keys
      process.env.ANTHROPIC_API_KEY = 'key1';
      process.env.OPENAI_API_KEY = 'key2';
      process.env.GOOGLE_API_KEY = 'key3';
      process.env.HUGGINGFACE_API_KEY = 'key4';

      // Only configure anthropic
      const result = parseProviders(['anthropic']);

      expect(result.providers).toHaveLength(1);
      expect(result.providers[0].name).toBe('anthropic');

      // Anthropic should be valid
      expect(validateProviderConfig('anthropic', result.providers).valid).toBe(true);

      // All others should be blocked
      expect(validateProviderConfig('openai', result.providers).valid).toBe(false);
      expect(validateProviderConfig('google', result.providers).valid).toBe(false);
      expect(validateProviderConfig('huggingface', result.providers).valid).toBe(false);
    });

    it('should enforce allowlist even with extended config and env vars', () => {
      // Setup environment
      process.env.ANTHROPIC_API_KEY = 'env-anthropic-key';
      process.env.OPENAI_API_KEY = 'env-openai-key';
      process.env.GOOGLE_API_KEY = 'env-google-key';

      // Configure with extended object form
      const configs: ProviderConfig[] = [
        {
          name: 'anthropic',
          defaultModel: 'claude-3-5-sonnet-20241022'
        }
        // Note: openai and google NOT in config, even though env vars exist
      ];

      const result = parseProviders(configs);

      expect(result.providers).toHaveLength(1);
      expect(result.providers[0].name).toBe('anthropic');

      // Only anthropic allowed
      expect(validateProviderConfig('anthropic', result.providers).valid).toBe(true);

      // OpenAI and Google blocked despite env vars
      const openaiValidation = validateProviderConfig('openai', result.providers);
      expect(openaiValidation.valid).toBe(false);
      expect(openaiValidation.error).toContain('not found in configuration');

      const googleValidation = validateProviderConfig('google', result.providers);
      expect(googleValidation.valid).toBe(false);
      expect(googleValidation.error).toContain('not found in configuration');
    });

    it('should prevent provider access when empty providers array is set', () => {
      // Even with keys, empty array blocks all
      process.env.ANTHROPIC_API_KEY = 'key1';
      process.env.OPENAI_API_KEY = 'key2';

      const result = parseProviders([]);

      expect(result.providers).toHaveLength(0);

      // All providers blocked
      expect(validateProviderConfig('anthropic', result.providers).valid).toBe(false);
      expect(validateProviderConfig('openai', result.providers).valid).toBe(false);
      expect(validateProviderConfig('google', result.providers).valid).toBe(false);
    });

    it('should validate provider allowlist with mixed string and object configs', () => {
      process.env.ANTHROPIC_API_KEY = 'key1';
      process.env.OPENAI_API_KEY = 'key2';
      process.env.GOOGLE_API_KEY = 'key3';

      const configs: (string | ProviderConfig)[] = [
        'anthropic',
        {
          name: 'openai',
          defaultModel: 'gpt-4o-mini'
        }
        // google not configured
      ];

      const result = parseProviders(configs);

      expect(result.providers).toHaveLength(2);

      // Anthropic and OpenAI allowed
      expect(validateProviderConfig('anthropic', result.providers).valid).toBe(true);
      expect(validateProviderConfig('openai', result.providers).valid).toBe(true);

      // Google blocked
      const googleValidation = validateProviderConfig('google', result.providers);
      expect(googleValidation.valid).toBe(false);
      expect(googleValidation.error).toContain('not found in configuration');
    });
  });
});
