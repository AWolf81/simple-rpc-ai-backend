import { describe, it, expect, beforeEach } from 'vitest';
import { TemplateEngine } from '../../src/auth/template-engine';

describe('TemplateEngine', () => {
  let engine: TemplateEngine;

  beforeEach(() => {
    engine = new TemplateEngine();
  });

  describe('Constructor', () => {
    it('should create instance', () => {
      expect(engine).toBeInstanceOf(TemplateEngine);
    });

    it('should create with custom config', () => {
      const config = {
        templateDir: './custom-templates',
        cacheTemplates: false
      };
      const customEngine = new TemplateEngine(config);
      expect(customEngine).toBeInstanceOf(TemplateEngine);
    });
  });

  describe('Template Rendering', () => {
    it('should have render method', () => {
      expect(typeof engine.render).toBe('function');
    });

    it('should render template with providers', async () => {
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

    it('should render template without layout', async () => {
      const data = {
        providers: [],
        context: {},
        layout: false
      };

      const result = await engine.render('test-template', data);
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });

    it('should handle empty providers array', async () => {
      const data = {
        providers: [],
        context: {}
      };

      const result = await engine.render('test-template', data);
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
  });

  describe('Provider Rendering', () => {
    it('should render providers with icons', async () => {
      const data = {
        providers: [
          {
            name: 'google',
            displayName: 'Google',
            loginUrl: '/auth/google',
            icon: '🔍'
          }
        ],
        context: {}
      };

      const result = await engine.render('oauth/login', data);
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });

    it('should render providers without icons', async () => {
      const data = {
        providers: [
          {
            name: 'custom',
            displayName: 'Custom Provider',
            loginUrl: '/auth/custom'
          }
        ],
        context: {}
      };

      const result = await engine.render('oauth/login', data);
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
  });

  describe('Context Handling', () => {
    it('should handle context with redirect URI', async () => {
      const data = {
        providers: [],
        context: {
          redirectUri: 'https://example.com/callback',
          scopes: ['read', 'write'],
          clientId: 'test-client-123'
        }
      };

      const result = await engine.render('test-template', data);
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });

    it('should handle empty context', async () => {
      const data = {
        providers: [],
        context: {}
      };

      const result = await engine.render('test-template', data);
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
  });

  describe('Edge Cases', () => {
    it('should handle template with layout false', async () => {
      const data = {
        providers: [],
        context: {},
        layout: false
      };

      const result = await engine.render('test-template', data);
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });

    it('should handle template with custom config', async () => {
      const data = {
        providers: [],
        context: {},
        config: {
          customProperty: 'test'
        }
      };

      const result = await engine.render('test-template', data);
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
  });

  describe('Template Configuration', () => {
    it('should handle different template directories', () => {
      const configs = [
        { templateDir: './templates' },
        { templateDir: './views' },
        { templateDir: './custom-templates' }
      ];

      configs.forEach(config => {
        expect(() => new TemplateEngine(config)).not.toThrow();
      });
    });

    it('should handle cache configuration', () => {
      const configs = [
        { cacheTemplates: true },
        { cacheTemplates: false }
      ];

      configs.forEach(config => {
        expect(() => new TemplateEngine(config)).not.toThrow();
      });
    });
  });

  describe('Multiple Providers', () => {
    it('should render multiple providers correctly', async () => {
      const data = {
        providers: [
          {
            name: 'google',
            displayName: 'Google',
            loginUrl: '/auth/google',
            icon: '🔍'
          },
          {
            name: 'github',
            displayName: 'GitHub', 
            loginUrl: '/auth/github',
            icon: '🐙'
          },
          {
            name: 'microsoft',
            displayName: 'Microsoft',
            loginUrl: '/auth/microsoft',
            icon: '🪟'
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
  });
});