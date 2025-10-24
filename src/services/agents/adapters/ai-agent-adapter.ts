/**
 * AI Agent Agent Adapter
 *
 * Implements agent functionality using AI Agent SDK with skills support
 * Follows the progressive disclosure model from agent skills architecture
 * Compatible with AI Agent skills but built entirely on AI Agent SDK
 */

import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { AIService } from '../../ai/ai-service';
import {
  IAgentAdapter,
  AgentExecuteRequest,
  AgentExecuteResult,
  AgentTool,
  AgentSkill,
  AgentSDKType
} from '../types';
import { logger } from '../../../utils/logger';
import { SkillsToolConverter } from '../skills/tools-converter';

interface AIAgentConfig {
  enableSkills?: boolean;
  defaultSkills?: AgentSkill[];
  skillsDirectory?: string;
}

export class AIAgentAdapter implements IAgentAdapter {
  readonly sdkType: AgentSDKType = 'ai-agent';

  private aiService: AIService;
  private config: AIAgentConfig;
  private tools: Map<string, AgentTool>;
  private skills: Map<string, AgentSkill>;
  private initialized: boolean = false;

  constructor(aiService: AIService, config?: AIAgentConfig) {
    this.aiService = aiService;
    this.config = config || {};
    this.tools = new Map();
    this.skills = new Map();
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    logger.debug('🔧 Initializing AI Agent agent adapter...');

    // Load default skills if provided
    if (this.config.defaultSkills) {
      this.config.defaultSkills.forEach(skill => {
        this.skills.set(skill.id, skill);
      });
      logger.debug(`📚 Loaded ${this.config.defaultSkills.length} default skills`);
    }

    // Load skills from directory if specified
    if (this.config.skillsDirectory) {
      await this.loadSkillsFromDirectory(this.config.skillsDirectory);
    }

    this.initialized = true;
    logger.debug('✅ AI Agent adapter initialized');
  }

  async execute(request: AgentExecuteRequest & { skillTools?: any[] }): Promise<AgentExecuteResult> {
    if (!this.initialized) {
      throw new Error('AI Agent adapter not initialized');
    }

    const requestId = crypto.randomUUID();

    // Build system prompt with progressive skill disclosure
    const systemPrompt = this.buildSystemPromptWithSkills(
      request.systemPrompt || 'You are a helpful AI assistant with specialized skills.',
      request.context?.skills
    );

    // Combine all tools: agent tools, context tools, and skill tools
    const agentTools = Array.from(this.tools.values());
    const contextTools = request.context?.tools || [];
    const skillTools = request.skillTools || [];

    logger.info(`🔧 Tool sources: agent=${agentTools.length}, context=${contextTools.length}, skills=${skillTools.length}`);
    if (skillTools.length > 0) {
      logger.info(`   Skill tools: ${skillTools.map((t: any) => t.name).join(', ')}`);
    }

    const allTools = [
      ...agentTools,
      ...contextTools,
      ...skillTools // Add skill tools from SkillsToolConverter
    ];

    // Convert tools to Claude tool format (but we'll pass them directly to AIService)
    const claudeTools = this.convertToolsToClaudeFormat(allTools);

    // Build conversation messages from history (but don't add current prompt yet - AIService will do that)
    const conversationHistory: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> = [];

    // Add conversation history if provided
    if (request.messages) {
      request.messages.forEach(m => {
        conversationHistory.push({
          role: m.role as 'user' | 'assistant' | 'system',
          content: m.content
        });
      });
    }

    // Execute AI request
    logger.debug(`🤖 Executing AI Agent agent request (${requestId}) with ${allTools.length} tools`);
    logger.debug(`   Conversation history: ${conversationHistory.length} messages`);

    // Convert tools to AIService format (inputSchema -> parameters)
    // Filter out any invalid tools and convert format
    const aiServiceTools = allTools
      .filter(tool => {
        if (!tool || !tool.name || !tool.description) {
          logger.warn(`⚠️  Filtering out invalid tool: ${tool?.name || 'unnamed'}`);
          return false;
        }
        return true;
      })
      .map(tool => {
        const schema = tool.inputSchema || tool.parameters;
        if (!schema || !schema.type || schema.type !== 'object') {
          logger.warn(`⚠️  Tool ${tool.name} has invalid schema, using default`);
        }
        return {
          name: tool.name,
          description: tool.description,
          parameters: schema && schema.type === 'object' ? schema : { type: 'object', properties: {}, required: [] },
          execute: tool.execute
        };
      });

    logger.debug(`🔧 Converted ${allTools.length} tools to ${aiServiceTools.length} AIService tools`);
    logger.info(`📋 Available tools (${aiServiceTools.length} total):`);
    if (aiServiceTools.length > 0) {
      aiServiceTools.forEach((tool, i) => {
        logger.info(`   [${i}] ${tool.name}: ${tool.description.substring(0, 60)}...`);
        logger.debug(`       Schema: type=${tool.parameters?.type}, props=${Object.keys(tool.parameters?.properties || {}).length}`);
      });
    } else {
      logger.warn(`⚠️  No tools available for AI agent execution!`);
    }

    try {
      const result = await this.aiService.execute({
        content: request.prompt,
        systemPrompt: systemPrompt,
        messages: conversationHistory, // Pass cleaned conversation history (AIService will append current prompt)
        tools: aiServiceTools.length > 0 ? aiServiceTools : undefined, // Pass all tools (skills, agent tools, context tools)
        metadata: {
          provider: request.provider || 'anthropic', // AI Agent uses Anthropic
          model: request.model,
          maxTokens: request.maxTokens,
          temperature: request.temperature
        },
        options: {
          model: request.model,
          maxTokens: request.maxTokens,
          temperature: request.temperature
        }
      });

      // Track which skills were potentially triggered
      const skillsTriggered = this.detectTriggeredSkills(result.content);

      return {
        content: result.content,
        usage: {
          promptTokens: result.usage.promptTokens,
          completionTokens: result.usage.completionTokens,
          totalTokens: result.usage.totalTokens
        },
        model: result.model,
        provider: result.provider || 'anthropic',
        sdk: this.sdkType,
        skillsTriggered,
        finishReason: result.finishReason,
        requestId,
        toolCalls: result.toolCalls // Pass through tool execution details
      };
    } catch (error) {
      logger.error('❌ AI Agent execution failed:', error);
      throw error;
    }
  }

  addTool(tool: AgentTool): void {
    this.tools.set(tool.name, tool);
    logger.debug(`🔧 Tool '${tool.name}' added to AI Agent adapter`);
  }

  removeTool(toolName: string): void {
    this.tools.delete(toolName);
    logger.debug(`🔧 Tool '${toolName}' removed from AI Agent adapter`);
  }

  getTools(): AgentTool[] {
    return Array.from(this.tools.values());
  }

  supportsSkills(): boolean {
    return this.config.enableSkills !== false;
  }

  addSkill(skill: AgentSkill): void {
    if (!this.supportsSkills()) {
      throw new Error('Skills are not enabled for this adapter');
    }

    // Validate skill structure
    this.validateSkill(skill);

    this.skills.set(skill.id, skill);
    logger.debug(`📚 Skill '${skill.name}' (${skill.id}) added`);
  }

  removeSkill(skillId: string): void {
    this.skills.delete(skillId);
    logger.debug(`📚 Skill '${skillId}' removed`);
  }

  getSkills(): AgentSkill[] {
    return Array.from(this.skills.values());
  }

  async dispose(): Promise<void> {
    this.tools.clear();
    this.skills.clear();
    this.initialized = false;
    logger.debug('✅ AI Agent adapter disposed');
  }

  /**
   * Build system prompt with progressive skill disclosure
   * Follows Claude's agent skills architecture
   */
  private buildSystemPromptWithSkills(
    basePrompt: string,
    contextSkills?: AgentSkill[]
  ): string {
    const skillsToUse = contextSkills || Array.from(this.skills.values());

    if (skillsToUse.length === 0) {
      return basePrompt;
    }

    // Level 1: Metadata disclosure (~100 tokens)
    const level1Skills = skillsToUse.map(skill =>
      `- **${skill.name}**: ${skill.description}`
    ).join('\n');

    // Level 2: Instructions (loaded when skill is triggered)
    const level2Skills = skillsToUse
      .filter(skill => skill.level >= 2 && skill.instructions)
      .map(skill => `
## Skill: ${skill.name}

${skill.instructions}
`).join('\n');

    // Build enhanced prompt
    return `${basePrompt}

## Available Skills

You have access to the following specialized skills:

${level1Skills}

When you need to use a skill, reference it by name and follow its specific guidelines.

${level2Skills ? `\n${level2Skills}` : ''}

### Skill Usage Guidelines

- Skills are modular capabilities that extend your functionality
- Trigger skills when the task matches their description
- Follow skill-specific instructions carefully
- Skills may include scripts and resources - reference them as needed
- Think from the skill's perspective when using it
`;
  }

  /**
   * Convert tools to Claude-compatible format
   */
  private convertToolsToClaudeFormat(tools: AgentTool[]): any[] {
    return tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.inputSchema
    }));
  }

  /**
   * Detect which skills were triggered in the response
   */
  private detectTriggeredSkills(content: string): string[] {
    const triggered: string[] = [];

    for (const skill of this.skills.values()) {
      // Simple detection: check if skill name or ID is mentioned
      if (content.includes(skill.name) || content.includes(skill.id)) {
        triggered.push(skill.id);
      }
    }

    return triggered;
  }

  /**
   * Validate skill structure according to Claude's requirements
   */
  private validateSkill(skill: AgentSkill): void {
    if (!skill.id || !skill.name || !skill.description) {
      throw new Error('Skill must have id, name, and description');
    }

    if (skill.name.length > 64) {
      throw new Error('Skill name must be 64 characters or less');
    }

    if (skill.description.length > 1024) {
      throw new Error('Skill description must be 1024 characters or less');
    }

    if (skill.level < 1 || skill.level > 3) {
      throw new Error('Skill level must be 1, 2, or 3');
    }

    // Level 2 instructions should be under 5k tokens (~20k chars)
    if (skill.level >= 2 && skill.instructions && skill.instructions.length > 20000) {
      logger.warn(`⚠️ Skill '${skill.name}' has instructions exceeding recommended 5k token limit`);
    }
  }

  /**
   * Load skills from a directory
   * Looks for SKILL.md files following Claude's skill structure
   */
  private async loadSkillsFromDirectory(directory: string): Promise<void> {
    try {
      const entries = await fs.readdir(directory, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const skillPath = path.join(directory, entry.name, 'SKILL.md');
          try {
            await this.loadSkillFromFile(skillPath, entry.name);
          } catch (error) {
            logger.debug(`⚠️ Could not load skill from ${entry.name}: ${error}`);
          }
        }
      }

      logger.debug(`📚 Loaded skills from directory: ${directory}`);
    } catch (error) {
      logger.warn(`⚠️ Could not load skills directory '${directory}':`, error);
    }
  }

  /**
   * Load a single skill from a SKILL.md file
   */
  private async loadSkillFromFile(skillPath: string, skillId: string): Promise<void> {
    const content = await fs.readFile(skillPath, 'utf-8');

    // Parse YAML frontmatter and markdown content
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);

    if (!frontmatterMatch) {
      throw new Error('Invalid SKILL.md format: missing frontmatter');
    }

    const [, frontmatter, instructions] = frontmatterMatch;

    // Parse YAML frontmatter (simple parsing)
    const metadata: Record<string, any> = {};
    frontmatter.split('\n').forEach(line => {
      const [key, ...valueParts] = line.split(':');
      if (key && valueParts.length > 0) {
        metadata[key.trim()] = valueParts.join(':').trim();
      }
    });

    const skill: AgentSkill = {
      id: skillId,
      name: metadata.name || skillId,
      description: metadata.description || '',
      level: parseInt(metadata.level || '2') as 1 | 2 | 3,
      metadata,
      instructions: instructions.trim()
    };

    this.addSkill(skill);
  }
}
