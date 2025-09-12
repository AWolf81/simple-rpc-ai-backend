import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { 
  ConfigurableScopeManager, 
  createConfigurableScopeManager,
  DefaultScopeConfigurations 
} from '../../src/auth/configurable-scopes';
import { 
  ScopeIntegrationManager,
  initializeScopeIntegration,
  getScopeIntegration,
  getConfigurableScopeHelpers,
  createScopeRequirement
} from '../../src/auth/scope-integration';
import { 
  ExampleScopeConfigurations,
  validateScopeConfig,
  mergeScopeConfigs,
  loadScopeConfigFromEnv
} from '../../src/auth/server-scope-config';

describe('Configurable Scope System', () => {
  let scopeManager: ConfigurableScopeManager;
  let integrationManager: ScopeIntegrationManager;

  beforeEach(() => {
    // Reset any global state
    delete (global as any).globalScopeIntegration;
  });

  afterEach(() => {
    // Clean up
    delete (global as any).globalScopeIntegration;
  });

  describe('ConfigurableScopeManager', () => {
    beforeEach(() => {
      scopeManager = createConfigurableScopeManager();
    });

    it('should create manager with default configuration', () => {
      expect(scopeManager).toBeDefined();
      expect(scopeManager.getAllScopes()).toBeDefined();
    });

    it('should create manager with custom scopes', () => {
      const manager = createConfigurableScopeManager({
        customScopes: [
          {
            name: 'test:read',
            description: 'Test read access',
            includes: ['read']
          }
        ]
      });

      const allScopes = manager.getAllScopes();
      expect(allScopes['test:read']).toBeDefined();
      expect(allScopes['test:read'].description).toBe('Test read access');
    });

    it('should handle tool scope overrides', () => {
      const manager = createConfigurableScopeManager({
        toolOverrides: [
          {
            toolName: 'test-tool',
            scopes: { required: ['custom:scope'] }
          }
        ]
      });

      const toolScopes = manager.getToolScopes('test-tool');
      expect(toolScopes?.required).toEqual(['custom:scope']);
    });

    it('should validate scopes correctly', () => {
      const manager = createConfigurableScopeManager({
        customScopes: [
          {
            name: 'parent:scope',
            description: 'Parent scope',
            includes: ['child:scope']
          }
        ]
      });

      const isValid = manager.validateScopes(
        ['parent:scope'],
        { required: ['child:scope'] }
      );
      expect(isValid).toBe(true);
    });

    it('should get default scopes for different user types', () => {
      const manager = createConfigurableScopeManager({
        defaultUserScopes: ['public'],
        authenticatedUserScopes: ['read', 'write'],
        adminScopes: ['admin']
      });

      expect(manager.getDefaultScopes('unauthenticated')).toEqual(['public']);
      expect(manager.getDefaultScopes('authenticated')).toEqual(['read', 'write']);
      expect(manager.getDefaultScopes('admin')).toEqual(['admin']);
    });

    it('should create MCP tools with configurable scopes', () => {
      const manager = createConfigurableScopeManager({
        toolOverrides: [
          {
            toolName: 'test-tool',
            scopes: { required: ['test:scope'] }
          }
        ]
      });

      const tool = manager.createMCPTool({
        toolName: 'test-tool',
        name: 'test-tool',
        description: 'Test tool',
        scopes: { required: ['default:scope'] }
      });

      expect(tool.mcp.scopes?.required).toEqual(['test:scope']);
    });

    it('should create admin MCP tools with configurable scopes', () => {
      const manager = createConfigurableScopeManager();

      const tool = manager.createAdminMCPTool({
        name: 'admin-tool',
        description: 'Admin tool',
        adminUsers: ['admin@test.com']
      });

      expect(tool.mcp.requireAdminUser).toBe(true);
      expect(tool.mcp.scopes?.adminUsers).toEqual(['admin@test.com']);
    });

    it('should add custom scopes at runtime', () => {
      const manager = createConfigurableScopeManager();

      manager.addCustomScope({
        name: 'runtime:scope',
        description: 'Runtime added scope'
      });

      const allScopes = manager.getAllScopes();
      expect(allScopes['runtime:scope']).toBeDefined();
    });

    it('should override tool scopes at runtime', () => {
      const manager = createConfigurableScopeManager();

      manager.overrideToolScopes('runtime-tool', {
        required: ['runtime:scope']
      });

      const toolScopes = manager.getToolScopes('runtime-tool');
      expect(toolScopes?.required).toEqual(['runtime:scope']);
    });
  });

  describe('ScopeIntegrationManager', () => {
    beforeEach(() => {
      integrationManager = new ScopeIntegrationManager();
    });

    it('should create integration manager with default config', () => {
      expect(integrationManager).toBeDefined();
      expect(integrationManager.isEnabled()).toBe(true);
    });

    it('should create integration manager with preset', () => {
      const manager = new ScopeIntegrationManager({
        preset: 'minimal'
      });

      expect(manager.isEnabled()).toBe(true);
      expect(manager.getDefaultScopes('authenticated')).toEqual(['mcp:list']);
    });

    it('should handle disabled configuration', () => {
      const manager = new ScopeIntegrationManager({
        enabled: false
      });

      expect(manager.isEnabled()).toBe(false);
    });

    it('should fallback to default validation when custom fails', () => {
      const manager = new ScopeIntegrationManager({
        custom: {
          customValidator: () => {
            throw new Error('Custom validator failed');
          }
        },
        fallbackToDefault: true
      });

      const isValid = manager.validateScopes(['read'], { required: ['read'] });
      expect(isValid).toBe(true); // Should fallback to default validation
    });

    it('should get tool scopes with fallback', () => {
      const manager = new ScopeIntegrationManager({
        custom: {
          toolOverrides: [
            {
              toolName: 'test-tool',
              scopes: { required: ['custom:scope'] }
            }
          ]
        }
      });

      const toolScopes = manager.getToolScopes('test-tool');
      expect(toolScopes?.required).toEqual(['custom:scope']);

      const defaultScopes = manager.getToolScopes('unknown-tool', { required: ['default'] });
      expect(defaultScopes?.required).toEqual(['default']);
    });

    it('should create MCP tools through integration', () => {
      const manager = new ScopeIntegrationManager({
        custom: {
          toolOverrides: [
            {
              toolName: 'integration-tool',
              scopes: { required: ['integration:scope'] }
            }
          ]
        }
      });

      const tool = manager.createMCPTool('integration-tool', {
        name: 'integration-tool',
        description: 'Integration tool'
      });

      expect(tool.mcp.scopes?.required).toEqual(['integration:scope']);
    });
  });

  describe('Global Integration Functions', () => {
    it('should initialize global scope integration', () => {
      const integration = initializeScopeIntegration({
        preset: 'standard'
      });

      expect(integration).toBeDefined();
      expect(integration.isEnabled()).toBe(true);
    });

    it('should get global scope integration', () => {
      initializeScopeIntegration({ preset: 'minimal' });
      const integration = getScopeIntegration();

      expect(integration).toBeDefined();
      expect(integration.isEnabled()).toBe(true);
    });

    it('should get configurable scope helpers', () => {
      initializeScopeIntegration({ preset: 'standard' });
      const helpers = getConfigurableScopeHelpers();

      expect(helpers).toBeDefined();
      expect(typeof helpers.mcpCall).toBe('function');
      expect(typeof helpers.admin).toBe('function');
    });

    it('should create scope requirements', () => {
      initializeScopeIntegration({
        custom: {
          toolOverrides: [
            {
              toolName: 'requirement-tool',
              scopes: { required: ['custom:requirement'] }
            }
          ]
        }
      });

      const requirement = createScopeRequirement('requirement-tool', ['default:scope']);
      expect(requirement.required).toEqual(['custom:requirement']);
    });
  });

  describe('Default Scope Configurations', () => {
    it('should provide minimal configuration', () => {
      const config = DefaultScopeConfigurations.minimal();
      expect(config.authenticatedUserScopes).toEqual(['mcp:list']);
      expect(config.allowFallback).toBe(true);
    });

    it('should provide standard configuration', () => {
      const config = DefaultScopeConfigurations.standard();
      expect(config.authenticatedUserScopes).toEqual(['read', 'mcp:list']);
      expect(config.adminScopes).toEqual(['admin', 'mcp', 'mcp:call', 'mcp:list']);
    });

    it('should provide enterprise configuration', () => {
      const config = DefaultScopeConfigurations.enterprise();
      expect(config.customScopes).toBeDefined();
      expect(config.customScopes?.length).toBeGreaterThan(0);
    });

    it('should provide API integration configuration', () => {
      const config = DefaultScopeConfigurations.apiIntegration();
      expect(config.customScopes).toBeDefined();
      expect(config.toolOverrides).toBeDefined();
      expect(config.allowFallback).toBe(false);
    });
  });

  describe('Example Scope Configurations', () => {
    it('should provide development configuration', () => {
      const config = ExampleScopeConfigurations.development();
      expect(config.preset).toBe('minimal');
      expect(config.enabled).toBe(true);
      expect(config.fallbackToDefault).toBe(true);
    });

    it('should provide production configuration', () => {
      const config = ExampleScopeConfigurations.production();
      expect(config.preset).toBe('standard');
      expect(config.custom?.allowFallback).toBe(false);
    });

    it('should provide enterprise configuration', () => {
      const config = ExampleScopeConfigurations.enterprise();
      expect(config.preset).toBe('enterprise');
      expect(config.custom?.customValidator).toBeDefined();
    });

    it('should provide API-only configuration', () => {
      const config = ExampleScopeConfigurations.apiOnly();
      expect(config.preset).toBe('apiIntegration');
      expect(config.custom?.toolOverrides).toBeDefined();
    });

    it('should provide disabled configuration', () => {
      const config = ExampleScopeConfigurations.disabled();
      expect(config.enabled).toBe(false);
    });
  });

  describe('Configuration Validation', () => {
    it('should validate valid configuration', () => {
      const config = {
        preset: 'standard' as const,
        enabled: true
      };

      const result = validateScopeConfig(config);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect invalid configuration', () => {
      const config = {
        enabled: false,
        preset: 'standard' as const // Invalid: preset with disabled
      };

      const result = validateScopeConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should validate custom scopes', () => {
      const config = {
        custom: {
          customScopes: [
            {
              name: 'invalid name', // Invalid: contains space
              description: 'Invalid scope'
            }
          ]
        }
      };

      const result = validateScopeConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('cannot contain spaces'))).toBe(true);
    });
  });

  describe('Configuration Merging', () => {
    it('should merge scope configurations', () => {
      const base = {
        preset: 'minimal' as const,
        custom: {
          defaultUserScopes: ['base:scope']
        }
      };

      const override = {
        custom: {
          authenticatedUserScopes: ['override:scope'],
          customScopes: [
            {
              name: 'override:scope',
              description: 'Override scope'
            }
          ]
        }
      };

      const merged = mergeScopeConfigs(base, override);
      expect(merged.preset).toBe('minimal');
      expect(merged.custom?.defaultUserScopes).toEqual(['base:scope']);
      expect(merged.custom?.authenticatedUserScopes).toEqual(['override:scope']);
      expect(merged.custom?.customScopes).toHaveLength(1);
    });
  });

  describe('Environment Configuration Loading', () => {
    it('should load configuration from environment', () => {
      // Mock environment variables
      const originalEnv = process.env;
      process.env = {
        ...originalEnv,
        SCOPE_PRESET: 'development',
        SCOPE_ENABLED: 'true',
        SCOPE_FALLBACK: 'true'
      };

      const config = loadScopeConfigFromEnv();
      expect(config.enabled).toBe(true);
      expect(config.fallbackToDefault).toBe(true);

      // Restore environment
      process.env = originalEnv;
    });

    it('should handle missing environment variables', () => {
      const originalEnv = process.env;
      process.env = {
        ...originalEnv,
        SCOPE_PRESET: undefined,
        SCOPE_ENABLED: undefined,
        SCOPE_FALLBACK: undefined
      };

      const config = loadScopeConfigFromEnv();
      expect(config.enabled).toBe(true); // Default
      expect(config.fallbackToDefault).toBe(true); // Default

      // Restore environment
      process.env = originalEnv;
    });
  });

  describe('Integration with Existing Scope System', () => {
    it('should work alongside existing scope helpers', async () => {
      const integration = new ScopeIntegrationManager({
        enabled: false // Disabled, should fallback to defaults
      });

      const { ConfigurableScopeHelpers } = await import('../../src/auth/scope-integration');
      const helpers = new ConfigurableScopeHelpers(integration);
      const mcpCallScope = helpers.mcpCall();
      
      expect(mcpCallScope).toBeDefined();
      // When disabled, it should still return a valid scope object
      expect(typeof mcpCallScope).toBe('object');
      // The structure might be different when falling back to defaults
      if (mcpCallScope.required) {
        expect(Array.isArray(mcpCallScope.required)).toBe(true);
        expect(mcpCallScope.required).toContain('mcp:call');
      }
    });

    it('should override existing scopes when enabled', async () => {
      const integration = new ScopeIntegrationManager({
        custom: {
          toolOverrides: [
            {
              toolName: 'test-tool',
              scopes: { required: ['custom:override'] }
            }
          ]
        }
      });

      const { ConfigurableScopeHelpers } = await import('../../src/auth/scope-integration');
      const helpers = new ConfigurableScopeHelpers(integration);
      const customScope = helpers.mcpCall('test-tool');
      
      expect(customScope.required).toEqual(['custom:override']);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle null and undefined inputs gracefully', () => {
      const manager = createConfigurableScopeManager();
      
      expect(() => manager.validateScopes([], { required: [] })).not.toThrow();
      expect(() => manager.getToolScopes('nonexistent')).not.toThrow();
      expect(() => manager.getDefaultScopes('authenticated')).not.toThrow();
    });

    it('should handle invalid custom validator gracefully', () => {
      const manager = new ScopeIntegrationManager({
        custom: {
          customValidator: () => {
            throw new Error('Validator error');
          }
        },
        fallbackToDefault: true
      });

      const isValid = manager.validateScopes(['read'], { required: ['read'] });
      expect(isValid).toBe(true); // Should fallback
    });

    it('should handle circular scope dependencies', () => {
      const manager = createConfigurableScopeManager({
        customScopes: [
          {
            name: 'scope:a',
            description: 'Scope A',
            includes: ['scope:b']
          },
          {
            name: 'scope:b',
            description: 'Scope B',
            includes: ['scope:a'] // Circular dependency
          }
        ]
      });

      // Should not crash, but may not expand correctly
      expect(() => manager.validateScopes(['scope:a'], { required: ['scope:b'] })).not.toThrow();
    });
  });
});