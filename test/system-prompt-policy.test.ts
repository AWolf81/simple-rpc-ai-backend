import { describe, it, expect } from 'vitest';
import { AIService } from '../src/services/ai/ai-service.js';

describe('System Prompt Policy', () => {
  describe('Unrestricted Mode (default)', () => {
    it('should allow predefined prompt IDs', async () => {
      const service = new AIService({
        serviceProviders: [
          { name: 'anthropic', apiKey: 'test-key', priority: 1 }
        ],
        systemPrompts: {
          'default': 'You are a helpful assistant',
          'creative': 'You are a creative writer'
        }
      });

      // Should not throw validation error for predefined ID
      try {
        await service.execute({
          content: 'test',
          systemPrompt: 'default'
        });
      } catch (error: any) {
        // Should NOT be a validation error about custom prompts
        expect(error.message).not.toContain('Custom system prompts are not allowed');
      }
    });

    it('should allow custom system prompts', async () => {
      const service = new AIService({
        serviceProviders: [
          { name: 'anthropic', apiKey: 'test-key', priority: 1 }
        ],
        systemPrompts: {
          'default': 'You are a helpful assistant'
        }
      });

      // Should not throw validation error for custom text
      try {
        await service.execute({
          content: 'test',
          systemPrompt: 'You are a custom AI assistant for testing'
        });
      } catch (error: any) {
        // Should NOT be a validation error about custom prompts
        expect(error.message).not.toContain('Custom system prompts are not allowed');
      }
    });

    it('should use default prompt when not provided', async () => {
      const service = new AIService({
        serviceProviders: [
          { name: 'anthropic', apiKey: 'test-key', priority: 1 }
        ],
        systemPrompts: {
          'default': 'You are a helpful assistant'
        }
      });

      // Should not throw validation error when no systemPrompt provided
      try {
        await service.execute({
          content: 'test'
        });
      } catch (error: any) {
        // Should NOT be a validation error
        expect(error.message).not.toContain('Custom system prompts are not allowed');
      }
    });
  });

  describe('Restricted Mode (restrictToPromptIds: true)', () => {
    it('should allow predefined prompt IDs', async () => {
      const service = new AIService({
        serviceProviders: [
          { name: 'anthropic', apiKey: 'test-key', priority: 1 }
        ],
        systemPrompts: {
          'default': 'You are a helpful assistant',
          'creative': 'You are a creative writer',
          'technical': 'You are a technical expert'
        },
        systemPromptPolicy: {
          restrictToPromptIds: true
        }
      });

      // Should not throw validation error for valid prompt ID
      try {
        await service.execute({
          content: 'test',
          systemPrompt: 'creative'
        });
      } catch (error: any) {
        // Should NOT be a validation error about custom prompts
        expect(error.message).not.toContain('Custom system prompts are not allowed');
      }
    });

    it('should block custom system prompts', async () => {
      const service = new AIService({
        serviceProviders: [
          { name: 'anthropic', apiKey: 'test-key', priority: 1 }
        ],
        systemPrompts: {
          'default': 'You are a helpful assistant',
          'creative': 'You are a creative writer'
        },
        systemPromptPolicy: {
          restrictToPromptIds: true
        }
      });

      // Should throw validation error immediately
      await expect(
        service.execute({
          content: 'test',
          systemPrompt: 'You are a custom AI assistant'
        })
      ).rejects.toThrow('Custom system prompts are not allowed');
    });

    it('should provide helpful error message with available IDs', async () => {
      const service = new AIService({
        serviceProviders: [
          { name: 'anthropic', apiKey: 'test-key', priority: 1 }
        ],
        systemPrompts: {
          'default': 'Default prompt',
          'creative': 'Creative prompt',
          'technical': 'Technical prompt'
        },
        systemPromptPolicy: {
          restrictToPromptIds: true
        }
      });

      try {
        await service.execute({
          content: 'test',
          systemPrompt: 'invalid-id'
        });
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).toContain('Custom system prompts are not allowed');
        expect(error.message).toContain('default');
        expect(error.message).toContain('creative');
        expect(error.message).toContain('technical');
      }
    });

    it('should use default prompt when not provided', async () => {
      const service = new AIService({
        serviceProviders: [
          { name: 'anthropic', apiKey: 'test-key', priority: 1 }
        ],
        systemPrompts: {
          'default': 'You are a helpful assistant'
        },
        systemPromptPolicy: {
          restrictToPromptIds: true
        }
      });

      // Should not throw validation error - defaults to "default"
      try {
        await service.execute({
          content: 'test'
        });
      } catch (error: any) {
        // Should NOT be a validation error about custom prompts
        expect(error.message).not.toContain('Custom system prompts are not allowed');
      }
    });

    it('should block unknown prompt IDs', async () => {
      const service = new AIService({
        serviceProviders: [
          { name: 'anthropic', apiKey: 'test-key', priority: 1 }
        ],
        systemPrompts: {
          'default': 'Default prompt',
          'approved': 'Approved prompt'
        },
        systemPromptPolicy: {
          restrictToPromptIds: true
        }
      });

      await expect(
        service.execute({
          content: 'test',
          systemPrompt: 'unapproved-id'
        })
      ).rejects.toThrow('Custom system prompts are not allowed');
    });
  });

  describe('Enterprise Use Case', () => {
    it('should enforce strict prompt control for compliance', async () => {
      // Enterprise scenario: Only pre-approved prompts allowed
      const service = new AIService({
        serviceProviders: [
          { name: 'anthropic', apiKey: 'test-key', priority: 1 }
        ],
        systemPrompts: {
          'customer-service': 'You are a professional customer service representative.',
          'technical-support': 'You are a technical support specialist.',
          'sales': 'You are a sales assistant.'
        },
        systemPromptPolicy: {
          restrictToPromptIds: true
        }
      });

      // Valid usage - approved prompt ID
      try {
        await service.execute({
          content: 'How can I help you?',
          systemPrompt: 'customer-service'
        });
      } catch (error: any) {
        // Should NOT be validation error
        expect(error.message).not.toContain('Custom system prompts are not allowed');
      }

      // Invalid usage - employee tries to use custom prompt
      await expect(
        service.execute({
          content: 'test',
          systemPrompt: 'Be super casual and use slang'
        })
      ).rejects.toThrow('Custom system prompts are not allowed');
    });

    it('should list all available compliant prompts in error', async () => {
      const service = new AIService({
        serviceProviders: [
          { name: 'anthropic', apiKey: 'test-key', priority: 1 }
        ],
        systemPrompts: {
          'compliant-prompt-1': 'Prompt 1',
          'compliant-prompt-2': 'Prompt 2',
          'compliant-prompt-3': 'Prompt 3'
        },
        systemPromptPolicy: {
          restrictToPromptIds: true
        }
      });

      try {
        await service.execute({
          content: 'test',
          systemPrompt: 'non-compliant-custom-text'
        });
        expect.fail('Should have thrown');
      } catch (error: any) {
        expect(error.message).toContain('compliant-prompt-1');
        expect(error.message).toContain('compliant-prompt-2');
        expect(error.message).toContain('compliant-prompt-3');
      }
    });
  });
});
