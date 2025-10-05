import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FunctionRegistry } from '../src/services/ai/function-registry.js';
import { PromptManager } from '../src/services/ai/prompt-manager.js';
import { AIService } from '../src/services/ai/ai-service.js';

// Mock the AI service
vi.mock('../src/services/ai/ai-service.js', () => ({
  AIService: vi.fn().mockImplementation(() => ({
    execute: vi.fn()
  }))
}));

describe.skip('Custom Functions System (REMOVED FEATURE - FunctionRegistry and PromptManager removed)', () => {
  let functionRegistry: FunctionRegistry;
  let promptManager: PromptManager;
  let mockAIService: any;

  beforeEach(() => {
    mockAIService = new AIService({});
    functionRegistry = new FunctionRegistry(mockAIService);
    promptManager = new PromptManager();
    
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('PromptManager', () => {
    it('should register and retrieve prompts', () => {
      const testPrompt = {
        id: 'test-prompt',
        name: 'Test Prompt',
        description: 'A test prompt',
        systemPrompt: 'You are a {type} assistant.',
        variables: ['type']
      };

      promptManager.registerPrompt(testPrompt);
      
      const retrieved = promptManager.getPrompt('test-prompt', { type: 'helpful' });
      expect(retrieved).toBe('You are a helpful assistant.');
    });

    it('should interpolate multiple variables', () => {
      const promptWithVars = {
        id: 'multi-var',
        name: 'Multi Variable',
        description: 'Multiple variables',
        systemPrompt: 'You are a {type} {role} who specializes in {domain}.',
        variables: ['type', 'role', 'domain']
      };

      promptManager.registerPrompt(promptWithVars);
      
      const result = promptManager.getPrompt('multi-var', {
        type: 'senior',
        role: 'developer',
        domain: 'TypeScript'
      });
      
      expect(result).toBe('You are a senior developer who specializes in TypeScript.');
    });

    it('should throw error for unknown prompt', () => {
      expect(() => {
        promptManager.getPrompt('nonexistent');
      }).toThrow('Prompt template \'nonexistent\' not found');
    });

    it('should list prompts without exposing content', () => {
      const prompts = promptManager.listPrompts();
      expect(Array.isArray(prompts)).toBe(true);
      
      if (prompts.length > 0) {
        expect(prompts[0]).not.toHaveProperty('systemPrompt');
        expect(prompts[0]).toHaveProperty('id');
        expect(prompts[0]).toHaveProperty('name');
      }
    });
  });

  describe('FunctionRegistry', () => {
    it('should list default functions', () => {
      const functions = functionRegistry.listFunctions();
      
      expect(Array.isArray(functions)).toBe(true);
      expect(functions.length).toBeGreaterThan(0);
      
      // Check for expected default functions
      const functionNames = functions.map(f => f.name);
      expect(functionNames).toContain('analyzeCode');
      expect(functionNames).toContain('generateTests');
      expect(functionNames).toContain('securityReview');
    });

    it.skip('should register custom function', () => {
      // First register a prompt
      promptManager.registerPrompt({
        id: 'custom-test',
        name: 'Custom Test',
        description: 'Custom test prompt',
        systemPrompt: 'Test prompt for {task}',
        variables: ['task']
      });

      const customFunction = {
        name: 'testFunction',
        description: 'A test function',
        promptId: 'custom-test',
        parameters: [
          {
            name: 'content',
            type: 'string' as const,
            description: 'Test content',
            required: true
          }
        ]
      };

      expect(() => {
        functionRegistry.registerFunction(customFunction);
      }).not.toThrow();

      expect(functionRegistry.hasFunction('testFunction')).toBe(true);
    });

    it.skip('should execute custom function', async () => {
      // Mock AI service response
      mockAIService.execute.mockResolvedValueOnce({
        content: 'Test analysis result',
        usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
        model: 'test-model',
        finishReason: 'stop'
      });

      const result = await functionRegistry.executeFunction('analyzeCode', {
        content: 'function test() { return true; }',
        language: 'javascript'
      });

      expect(mockAIService.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          content: 'function test() { return true; }',
          systemPrompt: expect.any(String),
          metadata: expect.objectContaining({
            functionName: 'analyzeCode'
          })
        })
      );

      expect(result).toEqual({
        content: 'Test analysis result',
        usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
        model: 'test-model',
        finishReason: 'stop',
        functionName: 'analyzeCode',
        promptUsed: 'analyze-code'
      });
    });

    it('should validate required parameters', async () => {
      await expect(
        functionRegistry.executeFunction('analyzeCode', {
          // Missing required 'content' parameter
          language: 'javascript'
        })
      ).rejects.toThrow();
    });

    it('should validate parameter types', async () => {
      await expect(
        functionRegistry.executeFunction('analyzeCode', {
          content: 123, // Should be string
          language: 'javascript'
        })
      ).rejects.toThrow();
    });

    it('should throw error for unknown function', async () => {
      await expect(
        functionRegistry.executeFunction('unknownFunction', {})
      ).rejects.toThrow('Function \'unknownFunction\' not found');
    });

    it('should get function definition', () => {
      const definition = functionRegistry.getFunction('analyzeCode');
      
      expect(definition).toBeDefined();
      expect(definition?.name).toBe('analyzeCode');
      expect(definition?.promptId).toBe('analyze-code');
      expect(definition?.parameters).toBeDefined();
    });
  });

  describe('Function Parameter Validation', () => {
    it.skip('should accept valid parameters', async () => {
      mockAIService.execute.mockResolvedValueOnce({
        content: 'Test result',
        usage: { promptTokens: 5, completionTokens: 10, totalTokens: 15 },
        model: 'test-model'
      });

      const params = {
        content: 'test code',
        language: 'javascript'
      };

      await expect(
        functionRegistry.executeFunction('analyzeCode', params)
      ).resolves.toBeDefined();
    });

    it.skip('should use default values for optional parameters', async () => {
      mockAIService.execute.mockResolvedValueOnce({
        content: 'Test result',
        usage: { promptTokens: 5, completionTokens: 10, totalTokens: 15 },
        model: 'test-model'
      });

      // Only provide required parameter, should use defaults
      await functionRegistry.executeFunction('analyzeCode', {
        content: 'test code'
        // language should default to 'javascript'
      });

      // Verify the prompt was called with default language
      const call = mockAIService.execute.mock.calls[0][0];
      expect(call.systemPrompt).toContain('javascript'); // Default language
    });

    it.skip('should handle boolean parameters', async () => {
      // Register a function with boolean parameter for testing
      promptManager.registerPrompt({
        id: 'test-bool',
        name: 'Test Boolean',
        description: 'Test boolean params',
        systemPrompt: 'Test prompt',
        variables: []
      });

      functionRegistry.registerFunction({
        name: 'testBoolFunction',
        description: 'Test function with boolean',
        promptId: 'test-bool',
        parameters: [
          {
            name: 'content',
            type: 'string',
            description: 'Content',
            required: true
          },
          {
            name: 'includeComments',
            type: 'boolean',
            description: 'Include comments',
            required: false
          }
        ]
      });

      mockAIService.execute.mockResolvedValueOnce({
        content: 'Test result',
        usage: { promptTokens: 5, completionTokens: 10, totalTokens: 15 },
        model: 'test-model'
      });

      await expect(
        functionRegistry.executeFunction('testBoolFunction', {
          content: 'test',
          includeComments: true
        })
      ).resolves.toBeDefined();

      // Test invalid boolean
      await expect(
        functionRegistry.executeFunction('testBoolFunction', {
          content: 'test',
          includeComments: 'yes' // Should be boolean
        })
      ).rejects.toThrow();
    });
  });
});