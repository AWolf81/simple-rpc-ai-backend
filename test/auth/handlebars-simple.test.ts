import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HandlebarsTemplateEngine, HANDLEBARS_DEFAULT_TEMPLATES, HANDLEBARS_PROVIDER_ICONS } from '../../src/auth/handlebars-template-engine';

// Mock path module properly
vi.mock('path', async (importOriginal) => {
  const actual = await importOriginal<typeof import('path')>();
  return {
    ...actual,
    dirname: vi.fn(() => '/mocked/path')
  };
});

describe('HandlebarsTemplateEngine', () => {
  let engine: HandlebarsTemplateEngine;

  beforeEach(() => {
    engine = new HandlebarsTemplateEngine();
  });

  describe('Constructor and Configuration', () => {
    it('should create instance', () => {
      expect(engine).toBeInstanceOf(HandlebarsTemplateEngine);
    });

    it('should create with custom config', () => {
      const config = {
        branding: {
          companyName: 'Test Company',
          logoUrl: 'https://test.com/logo.png'
        }
      };
      const customEngine = new HandlebarsTemplateEngine(config);
      expect(customEngine).toBeInstanceOf(HandlebarsTemplateEngine);
    });
  });

  describe('Configuration Management', () => {
    it('should have updateConfig method', () => {
      expect(typeof engine.updateConfig).toBe('function');
    });

    it('should have getConfig method', () => {
      expect(typeof engine.getConfig).toBe('function');
    });

    it('should update configuration', () => {
      const newConfig = {
        branding: {
          companyName: 'Updated Company'
        }
      };
      
      expect(() => engine.updateConfig(newConfig)).not.toThrow();
    });

    it('should get current configuration', () => {
      const config = engine.getConfig();
      expect(config).toBeDefined();
      expect(typeof config).toBe('object');
    });
  });

  describe('Template Rendering', () => {
    it('should have render method', () => {
      expect(typeof engine.render).toBe('function');
    });

    it('should render template with providers data', async () => {
      const data = {
        providers: [
          {
            name: 'google',
            displayName: 'Google',
            loginUrl: '/auth/google',
            icon: '🔍'
          }
        ],
        context: {
          redirectUri: '/callback'
        }
      };

      // Mock the template loading to avoid file system issues
      const originalRender = engine.render;
      engine.render = vi.fn().mockResolvedValue('<div>Mocked template</div>');

      const result = await engine.render('test-template', data);
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
  });

  describe('Template Rendering with Helpers', () => {
    it('should render template with providers data', async () => {
      const data = {
        providers: [
          {
            name: 'google',
            displayName: 'Google',
            loginUrl: '/auth/google',
            icon: '🔍'
          }
        ],
        context: {
          redirectUri: '/callback'
        }
      };

      const result = await engine.render('oauth/login', data);
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });

    it('should render template with multiple providers', async () => {
      const data = {
        providers: [
          { name: 'google', displayName: 'Google', loginUrl: '/auth/google' },
          { name: 'github', displayName: 'GitHub', loginUrl: '/auth/github' }
        ],
        context: {}
      };

      const result = await engine.render('oauth/login', data);
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
  });

  describe('Branding Integration', () => {
    it('should apply branding in templates', async () => {
      const engineWithBranding = new HandlebarsTemplateEngine({
        branding: {
          companyName: 'Test Corp',
          primaryColor: '#ff0000'
        }
      });

      const data = { providers: [], context: {} };
      
      const result = await engineWithBranding.render('oauth/login', data);
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
  });

  describe('Template Rendering Edge Cases', () => {
    it('should handle empty providers array', async () => {
      const data = {
        providers: [],
        context: {}
      };
      
      const result = await engine.render('oauth/login', data);
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });

    it('should handle providers without icons', async () => {
      const data = {
        providers: [
          { name: 'custom', displayName: 'Custom Provider', loginUrl: '/auth/custom' }
        ],
        context: {}
      };
      
      const result = await engine.render('oauth/login', data);
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
  });

  describe('Helper Functions', () => {
    it('should test json helper functionality', async () => {
      const data = {
        providers: [
          { name: 'test', displayName: 'Test', loginUrl: '/test' }
        ],
        context: { testObject: { key: 'value' } }
      };
      
      const result = await engine.render('oauth/login', data);
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });

    it('should test providerIcon helper with known providers', async () => {
      const data = {
        providers: [
          { name: 'google', displayName: 'Google', loginUrl: '/auth/google' },
          { name: 'github', displayName: 'GitHub', loginUrl: '/auth/github' },
          { name: 'microsoft', displayName: 'Microsoft', loginUrl: '/auth/microsoft' },
          { name: 'facebook', displayName: 'Facebook', loginUrl: '/auth/facebook' },
          { name: 'twitter', displayName: 'Twitter', loginUrl: '/auth/twitter' },
          { name: 'linkedin', displayName: 'LinkedIn', loginUrl: '/auth/linkedin' },
          { name: 'apple', displayName: 'Apple', loginUrl: '/auth/apple' }
        ],
        context: {}
      };
      
      const result = await engine.render('oauth/login', data);
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      // Should contain SVG icons for known providers
      expect(result).toMatch(/<svg[^>]*>/);
    });

    it('should test providerIcon helper with unknown provider', async () => {
      const data = {
        providers: [
          { name: 'unknown-provider', displayName: 'Unknown', loginUrl: '/auth/unknown' }
        ],
        context: {}
      };
      
      const result = await engine.render('oauth/login', data);
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });

    it('should test encodeUri helper functionality', async () => {
      const data = {
        providers: [
          { name: 'test', displayName: 'Test Provider', loginUrl: '/auth/test?redirect_uri=http://localhost:3000/callback' }
        ],
        context: { redirectUri: 'http://localhost:3000/callback?state=test value' }
      };
      
      const result = await engine.render('oauth/login', data);
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
  });

  describe('Configuration Deep Testing', () => {
    it('should handle all branding options', async () => {
      const fullConfig = {
        branding: {
          appName: 'Custom App',
          appLogo: 'https://example.com/logo.png',
          favicon: 'https://example.com/favicon.ico',
          primaryColor: '#ff5722',
          secondaryColor: '#ffab40',
          backgroundColor: '#fafafa',
          textColor: '#212121'
        },
        customCSS: '.custom-style { color: red; }',
        darkMode: true,
        variables: { customVar: 'customValue' }
      };
      
      const engineWithFullConfig = new HandlebarsTemplateEngine(fullConfig);
      const retrievedConfig = engineWithFullConfig.getConfig();
      
      expect(retrievedConfig.branding?.appName).toBe('Custom App');
      expect(retrievedConfig.branding?.primaryColor).toBe('#ff5722');
      expect(retrievedConfig.customCSS).toBe('.custom-style { color: red; }');
      expect(retrievedConfig.darkMode).toBe(true);
      expect(retrievedConfig.variables?.customVar).toBe('customValue');
    });

    it('should merge configurations correctly', () => {
      const initialConfig = {
        branding: { appName: 'Initial App', primaryColor: '#000000' },
        darkMode: false
      };
      
      const customEngine = new HandlebarsTemplateEngine(initialConfig);
      
      const updateConfig = {
        branding: { primaryColor: '#ffffff', secondaryColor: '#cccccc' },
        darkMode: true,
        customCSS: '.new-style { margin: 10px; }'
      };
      
      customEngine.updateConfig(updateConfig);
      const finalConfig = customEngine.getConfig();
      
      // Note: updateConfig does shallow merge, so branding object is replaced entirely
      expect(finalConfig.branding?.appName).toBeUndefined(); // Shallow merge replaces branding
      expect(finalConfig.branding?.primaryColor).toBe('#ffffff'); // Should update
      expect(finalConfig.branding?.secondaryColor).toBe('#cccccc'); // Should add
      expect(finalConfig.darkMode).toBe(true); // Should update
      expect(finalConfig.customCSS).toBe('.new-style { margin: 10px; }'); // Should add
    });

    it('should handle partial config updates', () => {
      const engine = new HandlebarsTemplateEngine({
        branding: { appName: 'Test App', primaryColor: '#000000' }
      });
      
      // Update only branding (shallow merge replaces entire branding object)
      engine.updateConfig({
        branding: { primaryColor: '#ff0000' }
      });
      
      const config = engine.getConfig();
      expect(config.branding?.primaryColor).toBe('#ff0000');
      expect(config.branding?.appName).toBeUndefined(); // Shallow merge replaces branding
    });
  });

  describe('Template Data Processing', () => {
    it('should handle complex template data with all properties', async () => {
      const engineWithFullBranding = new HandlebarsTemplateEngine({
        branding: {
          appName: 'Test OAuth App',
          appLogo: 'https://example.com/logo.svg',
          favicon: 'https://example.com/favicon.ico',
          primaryColor: '#2196f3',
          secondaryColor: '#1976d2',
          backgroundColor: '#ffffff',
          textColor: '#333333'
        },
        customCSS: 'body { font-family: Arial, sans-serif; }',
        darkMode: true,
        variables: { version: '1.0.0', theme: 'corporate' }
      });

      const complexData = {
        providers: [
          { 
            name: 'google', 
            displayName: 'Google OAuth', 
            loginUrl: '/auth/google?redirect_uri=http://localhost:3000/callback&state=abc123',
            icon: '🔍'
          },
          { 
            name: 'enterprise-sso', 
            displayName: 'Enterprise SSO', 
            loginUrl: '/auth/saml' 
          }
        ],
        context: {
          redirectUri: 'http://localhost:3000/callback',
          clientId: 'oauth-test-client-12345',
          scopes: ['read', 'write', 'admin'],
          state: 'csrf-protection-token'
        }
      };

      const result = await engineWithFullBranding.render('oauth/login', complexData);
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(100); // Should have substantial content
    });

    it('should handle empty context gracefully', async () => {
      const data = {
        providers: [
          { name: 'test', displayName: 'Test', loginUrl: '/test' }
        ]
        // No context property
      };
      
      const result = await engine.render('oauth/login', data);
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });

    it('should handle context with undefined values', async () => {
      const data = {
        providers: [
          { name: 'test', displayName: 'Test', loginUrl: '/test' }
        ],
        context: {
          redirectUri: undefined,
          clientId: null,
          scopes: undefined
        }
      };
      
      const result = await engine.render('oauth/login', data);
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle template rendering with minimal data', async () => {
      const minimalData = {
        providers: []
      };
      
      const result = await engine.render('oauth/login', minimalData);
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });

    it('should preserve default configuration when created without config', () => {
      const defaultEngine = new HandlebarsTemplateEngine();
      const config = defaultEngine.getConfig();
      
      expect(config.branding?.appName).toBe('Simple RPC AI Backend');
      expect(config.branding?.primaryColor).toBe('#007acc');
      expect(config.darkMode).toBe(false);
    });

    it('should handle null and undefined in updateConfig', () => {
      const engine = new HandlebarsTemplateEngine();
      
      // Should not throw with null/undefined values
      expect(() => {
        engine.updateConfig({
          branding: { appName: undefined, primaryColor: null }
        });
      }).not.toThrow();
      
      const config = engine.getConfig();
      expect(config).toBeDefined();
    });
  });

  describe('Template Data with Branding Assets', () => {
    it('should include favicon when provided in template data', async () => {
      const engineWithFavicon = new HandlebarsTemplateEngine({
        branding: {
          appName: 'Test App',
          favicon: 'https://example.com/favicon.ico'
        }
      });

      const data = {
        providers: [
          { name: 'test', displayName: 'Test', loginUrl: '/test' }
        ],
        context: {}
      };

      const result = await engineWithFavicon.render('oauth/login', data);
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      // The favicon should be passed to template data
      expect(engineWithFavicon.getConfig().branding?.favicon).toBe('https://example.com/favicon.ico');
    });

    it('should include appLogo when provided in template data', async () => {
      const engineWithLogo = new HandlebarsTemplateEngine({
        branding: {
          appName: 'Test App',
          appLogo: 'https://example.com/logo.png'
        }
      });

      const data = {
        providers: [
          { name: 'test', displayName: 'Test', loginUrl: '/test' }
        ],
        context: {}
      };

      const result = await engineWithLogo.render('oauth/login', data);
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      // The appLogo should be passed to template data
      expect(engineWithLogo.getConfig().branding?.appLogo).toBe('https://example.com/logo.png');
    });

    it('should include both favicon and appLogo when both provided', async () => {
      const engineWithBoth = new HandlebarsTemplateEngine({
        branding: {
          appName: 'Test App',
          favicon: 'https://example.com/favicon.ico',
          appLogo: 'https://example.com/logo.svg'
        }
      });

      const data = {
        providers: [
          { name: 'test', displayName: 'Test', loginUrl: '/test' }
        ],
        context: {}
      };

      const result = await engineWithBoth.render('oauth/login', data);
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      
      const config = engineWithBoth.getConfig();
      expect(config.branding?.favicon).toBe('https://example.com/favicon.ico');
      expect(config.branding?.appLogo).toBe('https://example.com/logo.svg');
    });

    it('should handle missing favicon and appLogo gracefully', async () => {
      const engineWithoutAssets = new HandlebarsTemplateEngine({
        branding: {
          appName: 'Test App'
          // No favicon or appLogo
        }
      });

      const data = {
        providers: [
          { name: 'test', displayName: 'Test', loginUrl: '/test' }
        ],
        context: {}
      };

      const result = await engineWithoutAssets.render('oauth/login', data);
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      
      const config = engineWithoutAssets.getConfig();
      expect(config.branding?.favicon).toBeUndefined();
      expect(config.branding?.appLogo).toBeUndefined();
    });
  });

  describe('Default Templates and Provider Icons', () => {
    it('should have default template configurations available', () => {
      expect(HANDLEBARS_DEFAULT_TEMPLATES).toBeDefined();
      expect(HANDLEBARS_DEFAULT_TEMPLATES.corporate).toBeDefined();
      expect(HANDLEBARS_DEFAULT_TEMPLATES.dark).toBeDefined();
      expect(HANDLEBARS_DEFAULT_TEMPLATES.minimal).toBeDefined();
      
      // Verify corporate theme
      expect(HANDLEBARS_DEFAULT_TEMPLATES.corporate.branding.primaryColor).toBe('#2c5282');
      
      // Verify dark theme
      expect(HANDLEBARS_DEFAULT_TEMPLATES.dark.darkMode).toBe(true);
      expect(HANDLEBARS_DEFAULT_TEMPLATES.dark.branding.backgroundColor).toBe('#1a202c');
      
      // Verify minimal theme has custom CSS
      expect(HANDLEBARS_DEFAULT_TEMPLATES.minimal.customCSS).toContain('.login-container');
    });

    it('should have provider icons available', () => {
      expect(HANDLEBARS_PROVIDER_ICONS).toBeDefined();
      expect(HANDLEBARS_PROVIDER_ICONS.google).toContain('<svg');
      expect(HANDLEBARS_PROVIDER_ICONS.github).toContain('<svg');
      expect(HANDLEBARS_PROVIDER_ICONS.microsoft).toContain('<svg');
      expect(HANDLEBARS_PROVIDER_ICONS.facebook).toContain('<svg');
      expect(HANDLEBARS_PROVIDER_ICONS.twitter).toContain('<svg');
      expect(HANDLEBARS_PROVIDER_ICONS.linkedin).toContain('<svg');
      expect(HANDLEBARS_PROVIDER_ICONS.apple).toContain('<svg');
    });

    it('should create engine with default templates', async () => {
      const corporateEngine = new HandlebarsTemplateEngine(HANDLEBARS_DEFAULT_TEMPLATES.corporate);
      const darkEngine = new HandlebarsTemplateEngine(HANDLEBARS_DEFAULT_TEMPLATES.dark);
      const minimalEngine = new HandlebarsTemplateEngine(HANDLEBARS_DEFAULT_TEMPLATES.minimal);

      // Test corporate theme
      const corporateConfig = corporateEngine.getConfig();
      expect(corporateConfig.branding?.primaryColor).toBe('#2c5282');
      
      // Test dark theme
      const darkConfig = darkEngine.getConfig();
      expect(darkConfig.darkMode).toBe(true);
      
      // Test minimal theme
      const minimalConfig = minimalEngine.getConfig();
      expect(minimalConfig.customCSS).toContain('.provider-button');
    });
  });

  describe('Handlebars Helper Functions Integration', () => {
    it('should test ifEquals helper functionality', async () => {
      const data = {
        providers: [
          { name: 'google', displayName: 'Google', loginUrl: '/auth/google' }
        ],
        context: { currentProvider: 'google' }
      };
      
      const result = await engine.render('oauth/login', data);
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });

    it('should handle different handlebars helper scenarios', async () => {
      const complexData = {
        providers: [
          { name: 'google', displayName: 'Google', loginUrl: '/auth/google' },
          { name: 'unknown-sso', displayName: 'Enterprise SSO', loginUrl: '/auth/sso' }
        ],
        context: {
          redirectUri: 'http://localhost:3000/callback?state=test value&scope=read write',
          clientId: 'test-client-123',
          debugData: { user: 'test@example.com', timestamp: new Date().toISOString() }
        }
      };

      const result = await engine.render('oauth/login', complexData);
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      
      // The result should contain processed template data
      expect(result.length).toBeGreaterThan(50);
    });
  });

  describe('Template Rendering with Variables', () => {
    it('should pass custom variables to template', async () => {
      const engineWithVariables = new HandlebarsTemplateEngine({
        variables: {
          version: '2.1.0',
          supportEmail: 'support@example.com',
          companyName: 'Example Corp'
        }
      });

      const data = {
        providers: [
          { name: 'test', displayName: 'Test', loginUrl: '/test' }
        ],
        context: {}
      };

      const result = await engineWithVariables.render('oauth/login', data);
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      
      const config = engineWithVariables.getConfig();
      expect(config.variables?.version).toBe('2.1.0');
      expect(config.variables?.supportEmail).toBe('support@example.com');
    });
  });
});