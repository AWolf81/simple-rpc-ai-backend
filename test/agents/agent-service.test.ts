/**
 * Agent Service Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AIService } from '../../src/services/ai/ai-service';
import { AgentService } from '../../src/services/agents/agent-service';
import { AgentSkill, AgentTool } from '../../src/services/agents/types';

describe('AgentService', () => {
  let aiService: AIService;
  let agentService: AgentService;

  beforeEach(async () => {
    // Initialize AI service with test configuration
    aiService = new AIService({
      serviceProviders: {
        anthropic: {
          apiKey: process.env.ANTHROPIC_API_KEY || 'test-key',
          priority: 1
        }
      }
    });

    // Initialize agent service
    agentService = new AgentService(aiService, {
      defaultSDK: 'claude-code',
      enableClaudeCode: true,
      enableOpenAI: false // Disable OpenAI for basic tests
    });

    await agentService.initialize();
  });

  afterEach(async () => {
    await agentService.dispose();
  });

  describe('Initialization', () => {
    it('should initialize with Claude Code adapter', () => {
      const sdks = agentService.getAvailableSDKs();
      expect(sdks).toContain('claude-code');
    });

    it('should have default SDK set to claude-code', () => {
      const config = agentService.getConfig();
      expect(config.defaultSDK).toBe('claude-code');
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

    it('should add a tool', () => {
      agentService.addTool(testTool);
      const tools = agentService.getTools();
      expect(tools).toHaveLength(1);
      expect(tools[0].name).toBe('test_tool');
    });

    it('should remove a tool', () => {
      agentService.addTool(testTool);
      agentService.removeTool('test_tool');
      const tools = agentService.getTools();
      expect(tools).toHaveLength(0);
    });
  });

  describe('Skill Management (Claude Code)', () => {
    const testSkill: AgentSkill = {
      id: 'test-skill',
      name: 'Test Skill',
      description: 'A test skill for demonstration',
      level: 2,
      instructions: 'This is a test skill that demonstrates the skills system.'
    };

    it('should add a skill', () => {
      agentService.addSkill(testSkill);
      const skills = agentService.getSkills();
      expect(skills).toHaveLength(1);
      expect(skills[0].id).toBe('test-skill');
    });

    it('should remove a skill', () => {
      agentService.addSkill(testSkill);
      agentService.removeSkill('test-skill');
      const skills = agentService.getSkills();
      expect(skills).toHaveLength(0);
    });

    it('should validate skill structure', () => {
      const invalidSkill = {
        id: 'invalid',
        name: 'A'.repeat(100), // Too long (>64 chars)
        description: 'Test',
        level: 2
      } as AgentSkill;

      expect(() => agentService.addSkill(invalidSkill)).toThrow();
    });
  });

  describe('Agent Execution', () => {
    it('should execute a basic agent request', async () => {
      // Skip if no API key
      if (!process.env.ANTHROPIC_API_KEY) {
        console.log('⏭️  Skipping agent execution test (no ANTHROPIC_API_KEY)');
        return;
      }

      const result = await agentService.execute({
        prompt: 'Say hello in one word',
        systemPrompt: 'You are a helpful assistant. Respond with exactly one word.',
        sdk: 'claude-code'
      });

      expect(result.content).toBeTruthy();
      expect(result.sdk).toBe('claude-code');
      expect(result.usage.totalTokens).toBeGreaterThan(0);
    });

    it('should execute with skills context', async () => {
      // Skip if no API key
      if (!process.env.ANTHROPIC_API_KEY) {
        console.log('⏭️  Skipping skills test (no ANTHROPIC_API_KEY)');
        return;
      }

      const codeReviewSkill: AgentSkill = {
        id: 'code-review',
        name: 'Code Review',
        description: 'Expert code reviewer skill',
        level: 2,
        instructions: 'Analyze code for best practices, bugs, and security issues.'
      };

      agentService.addSkill(codeReviewSkill);

      const result = await agentService.execute({
        prompt: 'Review this code: const x = 5;',
        systemPrompt: 'You are a code reviewer. Use your Code Review skill.',
        sdk: 'claude-code'
      });

      expect(result.content).toBeTruthy();
      expect(result.sdk).toBe('claude-code');
    });
  });

  describe('SDK Availability', () => {
    it('should check if SDK is available', () => {
      expect(agentService.isSDKAvailable('claude-code')).toBe(true);
      expect(agentService.isSDKAvailable('openai')).toBe(false);
    });

    it('should return available SDKs', () => {
      const sdks = agentService.getAvailableSDKs();
      expect(sdks).toBeInstanceOf(Array);
      expect(sdks.length).toBeGreaterThan(0);
    });
  });
});

describe('AgentService with both SDKs', () => {
  let aiService: AIService;
  let agentService: AgentService;

  beforeEach(async () => {
    aiService = new AIService({
      serviceProviders: {
        anthropic: {
          apiKey: process.env.ANTHROPIC_API_KEY || 'test-key-anthropic',
          priority: 1
        },
        openai: {
          apiKey: process.env.OPENAI_API_KEY || 'test-key-openai',
          priority: 2
        }
      }
    });

    agentService = new AgentService(aiService, {
      defaultSDK: 'claude-code',
      enableClaudeCode: true,
      enableOpenAI: true
    });

    await agentService.initialize();
  });

  afterEach(async () => {
    await agentService.dispose();
  });

  it('should have both SDKs available', () => {
    const sdks = agentService.getAvailableSDKs();
    expect(sdks).toContain('claude-code');
    expect(sdks).toContain('openai');
  });

  it('should execute with OpenAI SDK', async () => {
    // Skip if no API key
    if (!process.env.OPENAI_API_KEY) {
      console.log('⏭️  Skipping OpenAI test (no OPENAI_API_KEY)');
      return;
    }

    const result = await agentService.execute({
      prompt: 'Say hello in one word',
      systemPrompt: 'Respond with exactly one word.',
      sdk: 'openai'
    });

    expect(result.content).toBeTruthy();
    expect(result.sdk).toBe('openai');
    expect(result.usage.totalTokens).toBeGreaterThan(0);
  });
});
