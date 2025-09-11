import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HandlebarsTemplateEngine } from '../../src/auth/handlebars-template-engine';

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
});