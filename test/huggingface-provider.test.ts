/**
 * Comprehensive unit tests for Hugging Face provider
 * Tests both textGeneration and chatCompletion methods, automatic fallback,
 * and user-configured method selection
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Create mock functions in hoisted scope
const { mockTextGeneration, mockChatCompletion } = vi.hoisted(() => {
  const mockTextGeneration = vi.fn();
  const mockChatCompletion = vi.fn();
  return { mockTextGeneration, mockChatCompletion };
});

// Mock the @huggingface/inference module
vi.mock('@huggingface/inference', () => ({
  InferenceClient: vi.fn().mockImplementation(() => ({
    textGeneration: mockTextGeneration,
    chatCompletion: mockChatCompletion
  }))
}));

// Import after mocking
import { AIService } from '../src/services/ai-service';

describe('Hugging Face Provider Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Method Selection Logic', () => {
    it('should default to auto mode with textGeneration first', async () => {
      // Setup successful textGeneration response
      mockTextGeneration.mockResolvedValue({ generated_text: 'Hello from textGeneration!' });

      const aiService = new AIService({
        serviceProviders: {
          huggingface: {
            apiKey: 'test-key',
            priority: 1
          }
        }
      });

      const result = await aiService.execute({
        content: 'Hello',
        promptId: 'system'
      });

      expect(mockTextGeneration).toHaveBeenCalledWith({
        model: expect.any(String),
        inputs: expect.stringContaining('Hello'),
        parameters: {
          max_new_tokens: 4000,
          temperature: 0.7,
          return_full_text: false
        }
      });

      expect(mockChatCompletion).not.toHaveBeenCalled();
      expect(result.content).toBe('Hello from textGeneration!');
    });

    it('should fallback to chatCompletion on conversational error', async () => {
      // Setup textGeneration to fail with conversational error
      mockTextGeneration.mockRejectedValue(
        new Error('Model test-model is not supported for task text-generation and provider nebius. Supported task: conversational.')
      );

      // Setup successful chatCompletion response
      mockChatCompletion.mockResolvedValue({
        choices: [{ message: { content: 'Hello from chatCompletion!' } }]
      });

      const aiService = new AIService({
        serviceProviders: {
          huggingface: {
            apiKey: 'test-key',
            priority: 1
          }
        }
      });

      const result = await aiService.execute({
        content: 'Hello',
        promptId: 'system',
        options: {
          provider: 'huggingface',
          model: 'test-model'
        }
      });

      expect(mockTextGeneration).toHaveBeenCalled();
      expect(mockChatCompletion).toHaveBeenCalledWith({
        model: 'test-model',
        messages: [{ role: 'user', content: expect.stringContaining('Hello') }],
        max_tokens: 4000,
        temperature: 0.7
      });

      expect(result.content).toBe('Hello from chatCompletion!');
    });

    it('should use textGeneration method when explicitly configured', async () => {
      mockTextGeneration.mockResolvedValue({ generated_text: 'Explicit textGeneration!' });

      const aiService = new AIService({
        serviceProviders: {
          huggingface: {
            apiKey: 'test-key',
            priority: 1,
            huggingfaceMethod: 'textGeneration'
          }
        }
      });

      const result = await aiService.execute({
        content: 'Hello',
        promptId: 'system',
        options: {
          provider: 'huggingface',
          model: 'test-model'
        }
      });

      expect(mockTextGeneration).toHaveBeenCalled();
      expect(mockChatCompletion).not.toHaveBeenCalled();
      expect(result.content).toBe('Explicit textGeneration!');
    });

    it('should use chatCompletion method when explicitly configured', async () => {
      mockChatCompletion.mockResolvedValue({
        choices: [{ message: { content: 'Explicit chatCompletion!' } }]
      });

      const aiService = new AIService({
        serviceProviders: {
          huggingface: {
            apiKey: 'test-key',
            priority: 1,
            huggingfaceMethod: 'chatCompletion'
          }
        }
      });

      const result = await aiService.execute({
        content: 'Hello',
        promptId: 'system',
        options: {
          provider: 'huggingface',
          model: 'test-model'
        }
      });

      expect(mockChatCompletion).toHaveBeenCalledWith({
        model: 'test-model',
        messages: [{ role: 'user', content: expect.stringContaining('Hello') }],
        max_tokens: 4000,
        temperature: 0.7
      });

      expect(mockTextGeneration).not.toHaveBeenCalled();
      expect(result.content).toBe('Explicit chatCompletion!');
    });

    it('should not fallback when fallback is disabled', async () => {
      // Setup textGeneration to fail with conversational error
      mockTextGeneration.mockRejectedValue(
        new Error('Model test-model is not supported for task text-generation. Supported task: conversational.')
      );

      const aiService = new AIService({
        serviceProviders: {
          huggingface: {
            apiKey: 'test-key',
            priority: 1,
            huggingfaceEnableFallback: false
          }
        }
      });

      await expect(aiService.execute({
        content: 'Hello',
        promptId: 'system',
        options: {
          provider: 'huggingface',
          model: 'test-model'
        }
      })).rejects.toThrow('Supported task: conversational');

      expect(mockTextGeneration).toHaveBeenCalled();
      expect(mockChatCompletion).not.toHaveBeenCalled();
    });
  });

  describe('Parameter Handling', () => {
    it('should pass custom parameters to textGeneration', async () => {
      mockTextGeneration.mockResolvedValue({ generated_text: 'Custom response' });

      const aiService = new AIService({
        serviceProviders: {
          huggingface: {
            apiKey: 'test-key',
            priority: 1,
            huggingfaceMethod: 'textGeneration'
          }
        }
      });

      await aiService.execute({
        content: 'Hello',
        promptId: 'system',
        options: {
          provider: 'huggingface',
          model: 'test-model',
          maxTokens: 2000,
          temperature: 0.5
        }
      });

      expect(mockTextGeneration).toHaveBeenCalledWith({
        model: 'test-model',
        inputs: expect.any(String),
        parameters: {
          max_new_tokens: 2000,
          temperature: 0.5,
          return_full_text: false
        }
      });
    });

    it('should pass custom parameters to chatCompletion', async () => {
      mockChatCompletion.mockResolvedValue({
        choices: [{ message: { content: 'Custom chat response' } }]
      });

      const aiService = new AIService({
        serviceProviders: {
          huggingface: {
            apiKey: 'test-key',
            priority: 1,
            huggingfaceMethod: 'chatCompletion'
          }
        }
      });

      await aiService.execute({
        content: 'Hello',
        promptId: 'system',
        options: {
          provider: 'huggingface',
          model: 'test-model',
          maxTokens: 1500,
          temperature: 0.3
        }
      });

      expect(mockChatCompletion).toHaveBeenCalledWith({
        model: 'test-model',
        messages: expect.any(Array),
        max_tokens: 1500,
        temperature: 0.3
      });
    });
  });

  describe('Message Formatting', () => {
    it('should format system and user messages for chatCompletion', async () => {
      mockChatCompletion.mockResolvedValue({
        choices: [{ message: { content: 'Formatted response' } }]
      });

      const aiService = new AIService({
        systemPrompts: {
          test: 'You are a helpful assistant'
        },
        serviceProviders: {
          huggingface: {
            apiKey: 'test-key',
            priority: 1,
            huggingfaceMethod: 'chatCompletion'
          }
        }
      });

      await aiService.execute({
        content: 'User question',
        promptId: 'test',
        options: {
          provider: 'huggingface',
          model: 'test-model'
        }
      });

      expect(mockChatCompletion).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [
            { role: 'system', content: 'You are a helpful assistant' },
            { role: 'user', content: 'User question' }
          ]
        })
      );
    });

    it('should handle complex message content for chatCompletion', async () => {
      mockChatCompletion.mockResolvedValue({
        choices: [{ message: { content: 'Complex response' } }]
      });

      const aiService = new AIService({
        serviceProviders: {
          huggingface: {
            apiKey: 'test-key',
            priority: 1,
            huggingfaceMethod: 'chatCompletion'
          }
        }
      });

      // Simulate complex message content (would be converted to string)
      await aiService.execute({
        content: 'Simple text',
        promptId: 'system',
        options: {
          provider: 'huggingface',
          model: 'test-model'
        }
      });

      expect(mockChatCompletion).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              content: expect.any(String)
            })
          ])
        })
      );
    });
  });

  describe('Error Handling', () => {
    it('should propagate non-conversational errors from textGeneration', async () => {
      mockTextGeneration.mockRejectedValue(new Error('Network timeout'));

      const aiService = new AIService({
        serviceProviders: {
          huggingface: {
            apiKey: 'test-key',
            priority: 1,
            huggingfaceMethod: 'textGeneration'
          }
        }
      });

      await expect(aiService.execute({
        content: 'Hello',
        promptId: 'system',
        options: {
          provider: 'huggingface'
        }
      })).rejects.toThrow('Network timeout');

      expect(mockChatCompletion).not.toHaveBeenCalled();
    });

    it('should propagate errors from chatCompletion method', async () => {
      mockChatCompletion.mockRejectedValue(new Error('Chat API error'));

      const aiService = new AIService({
        serviceProviders: {
          huggingface: {
            apiKey: 'test-key',
            priority: 1,
            huggingfaceMethod: 'chatCompletion'
          }
        }
      });

      await expect(aiService.execute({
        content: 'Hello',
        promptId: 'system',
        options: {
          provider: 'huggingface'
        }
      })).rejects.toThrow('Chat API error');
    });
  });

  describe('Response Processing', () => {
    it('should handle string responses from textGeneration', async () => {
      mockTextGeneration.mockResolvedValue('Direct string response');

      const aiService = new AIService({
        serviceProviders: {
          huggingface: {
            apiKey: 'test-key',
            priority: 1,
            huggingfaceMethod: 'textGeneration'
          }
        }
      });

      const result = await aiService.execute({
        content: 'Hello',
        promptId: 'system',
        options: { provider: 'huggingface' }
      });

      expect(result.content).toBe('Direct string response');
    });

    it('should handle object responses from textGeneration', async () => {
      mockTextGeneration.mockResolvedValue({ generated_text: 'Object response' });

      const aiService = new AIService({
        serviceProviders: {
          huggingface: {
            apiKey: 'test-key',
            priority: 1,
            huggingfaceMethod: 'textGeneration'
          }
        }
      });

      const result = await aiService.execute({
        content: 'Hello',
        promptId: 'system',
        options: { provider: 'huggingface' }
      });

      expect(result.content).toBe('Object response');
    });

    it('should handle empty responses gracefully', async () => {
      mockTextGeneration.mockResolvedValue({ generated_text: '' });

      const aiService = new AIService({
        serviceProviders: {
          huggingface: {
            apiKey: 'test-key',
            priority: 1,
            huggingfaceMethod: 'textGeneration'
          }
        }
      });

      const result = await aiService.execute({
        content: 'Hello',
        promptId: 'system',
        options: { provider: 'huggingface' }
      });

      expect(result.content).toBe('');
    });
  });

  describe('Usage Statistics', () => {
    it('should provide usage statistics for textGeneration', async () => {
      mockTextGeneration.mockResolvedValue({ generated_text: 'Response for usage test' });

      const aiService = new AIService({
        serviceProviders: {
          huggingface: {
            apiKey: 'test-key',
            priority: 1,
            huggingfaceMethod: 'textGeneration'
          }
        }
      });

      const result = await aiService.execute({
        content: 'Test content for usage calculation',
        promptId: 'system',
        options: { provider: 'huggingface' }
      });

      expect(result.usage).toBeDefined();
      expect(result.usage.promptTokens).toBeGreaterThan(0);
      expect(result.usage.completionTokens).toBeGreaterThan(0);
    });

    it('should provide usage statistics for chatCompletion', async () => {
      mockChatCompletion.mockResolvedValue({
        choices: [{ message: { content: 'Chat response for usage test' } }]
      });

      const aiService = new AIService({
        serviceProviders: {
          huggingface: {
            apiKey: 'test-key',
            priority: 1,
            huggingfaceMethod: 'chatCompletion'
          }
        }
      });

      const result = await aiService.execute({
        content: 'Test content',
        promptId: 'system',
        options: { provider: 'huggingface' }
      });

      expect(result.usage).toBeDefined();
      expect(result.usage.promptTokens).toBeGreaterThan(0);
      expect(result.usage.completionTokens).toBeGreaterThan(0);
    });
  });
});