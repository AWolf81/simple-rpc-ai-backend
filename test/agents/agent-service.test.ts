import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AgentService } from '../../src/services/agents/agent-service';
import type { AIService } from '../../src/services/ai/ai-service';
import type { AgentSkill, AgentTool } from '../../src/services/agents/types';

const createMockAIService = () => {
  const execute = vi.fn().mockResolvedValue({
    content: 'mock-response',
    usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
    model: 'mock-model',
    provider: 'anthropic',
    finishReason: 'stop',
    requestId: 'test-request',
    toolCalls: []
  });

  return { execute } as Pick<AIService, 'execute'> as AIService;
};

describe('AgentService (ai-agent SDK)', () => {
  let aiService: AIService;
  let agentService: AgentService;

  beforeEach(async () => {
    aiService = createMockAIService();
    agentService = new AgentService(aiService, {
      defaultSDK: 'ai-agent',
      agent: {
        enableSkills: true
      }
    });

    await agentService.initialize();
  });

  afterEach(async () => {
    await agentService.dispose();
  });

  describe('Initialization', () => {
    it('initializes with the internal ai-agent adapter', () => {
      const sdks = agentService.getAvailableSDKs();
      expect(sdks).toEqual(['ai-agent']);
    });

    it('uses ai-agent as the default SDK', () => {
      expect(agentService.getConfig().defaultSDK).toBe('ai-agent');
    });
  });

  describe('Tool Management', () => {
    const testTool: AgentTool = {
      name: 'test_tool',
      description: 'A test tool',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string' }
        },
        required: ['query']
      },
      execute: async (args: any) => ({ result: `Processed: ${args.query}` })
    };

    it('adds a tool', () => {
      agentService.addTool(testTool);
      expect(agentService.getTools()).toHaveLength(1);
    });

    it('removes a tool', () => {
      agentService.addTool(testTool);
      agentService.removeTool('test_tool');
      expect(agentService.getTools()).toHaveLength(0);
    });
  });

  describe('Skill Management', () => {
    const testSkill: AgentSkill = {
      id: 'test-skill',
      name: 'Test Skill',
      description: 'A test skill for demonstration',
      level: 2,
      instructions: 'This is a test skill that demonstrates the skills system.'
    };

    it('adds and lists skills', () => {
      agentService.addSkill(testSkill);
      expect(agentService.getSkills()).toEqual([testSkill]);
    });

    it('removes skills', () => {
      agentService.addSkill(testSkill);
      agentService.removeSkill(testSkill.id);
      expect(agentService.getSkills()).toHaveLength(0);
    });

    it('validates skills on add', () => {
      const invalidSkill = {
        id: 'invalid',
        name: 'A'.repeat(100),
        description: 'Test',
        level: 2
      } as AgentSkill;

      expect(() => agentService.addSkill(invalidSkill)).toThrow();
    });
  });

  describe('Agent Execution', () => {
    it('executes with mocked AI service', async () => {
      const result = await agentService.execute({
        prompt: 'Say hello in one word',
        systemPrompt: 'Respond with exactly one word.',
        sdk: 'ai-agent'
      });

      expect(result.content).toBe('mock-response');
      expect(result.sdk).toBe('ai-agent');
      expect(result.usage.totalTokens).toBe(2);
    });

    it('passes skill context through execution', async () => {
      const skill: AgentSkill = {
        id: 'code-review',
        name: 'Code Review',
        description: 'Review code for issues',
        level: 2,
        instructions: 'Provide a detailed review.'
      };

      agentService.addSkill(skill);

      const result = await agentService.execute({
        prompt: 'Review this code: const x = 5;',
        systemPrompt: 'You are a code reviewer.',
        sdk: 'ai-agent'
      });

      expect(result.content).toBe('mock-response');
    });
  });

  describe('SDK Availability', () => {
    it('reports ai-agent availability only', () => {
      expect(agentService.isSDKAvailable('ai-agent')).toBe(true);
      expect(agentService.isSDKAvailable('openai')).toBe(false);
    });
  });
});
