/**
 * Agent Service - Unified agent management
 *
 * Provides abstraction over Claude Code SDK and OpenAI Agents SDK,
 * reusing existing AI provider infrastructure
 */

import crypto from 'crypto';
import { AIService } from '../ai/ai-service';
import {
  AgentConfig,
  AgentExecuteRequest,
  AgentExecuteResult,
  AgentTool,
  AgentSkill,
  IAgentAdapter,
  AgentSDKType
} from './types';
import { ClaudeCodeAdapter } from './adapters/claude-code-adapter';
import { OpenAIAgentAdapter } from './adapters/openai-agent-adapter';
import { logger } from '../../utils/logger';

export class AgentService {
  private config: AgentConfig;
  private aiService: AIService;
  private adapters: Map<AgentSDKType, IAgentAdapter>;
  private defaultTools: AgentTool[];
  private defaultSkills: AgentSkill[];

  constructor(
    aiService: AIService,
    config: AgentConfig = {}
  ) {
    this.aiService = aiService;
    this.config = {
      defaultSDK: config.defaultSDK || 'claude-code',
      enableClaudeCode: config.enableClaudeCode !== false,
      enableOpenAI: config.enableOpenAI !== false,
      ...config
    };

    this.adapters = new Map();
    this.defaultTools = config.defaultTools || [];
    this.defaultSkills = config.claudeCode?.defaultSkills || [];
  }

  /**
   * Initialize agent service and adapters
   */
  async initialize(): Promise<void> {
    logger.debug('🤖 Initializing AgentService...');

    // Initialize Claude Code adapter if enabled
    if (this.config.enableClaudeCode) {
      const claudeAdapter = new ClaudeCodeAdapter(
        this.aiService,
        this.config.claudeCode
      );
      await claudeAdapter.initialize();

      // Add default tools and skills
      this.defaultTools.forEach(tool => claudeAdapter.addTool(tool));
      this.defaultSkills.forEach(skill => claudeAdapter.addSkill?.(skill));

      this.adapters.set('claude-code', claudeAdapter);
      logger.debug('✅ Claude Code adapter initialized');
    }

    // Initialize OpenAI adapter if enabled
    if (this.config.enableOpenAI) {
      const openaiAdapter = new OpenAIAgentAdapter(
        this.aiService,
        this.config.openai
      );
      await openaiAdapter.initialize();

      // Add default tools
      this.defaultTools.forEach(tool => openaiAdapter.addTool(tool));

      this.adapters.set('openai', openaiAdapter);
      logger.debug('✅ OpenAI adapter initialized');
    }

    if (this.adapters.size === 0) {
      throw new Error('No agent adapters initialized. Enable at least one SDK.');
    }

    logger.debug(`🤖 AgentService initialized with ${this.adapters.size} adapter(s)`);
  }

  /**
   * Execute agent request using specified or default SDK
   */
  async execute(request: AgentExecuteRequest): Promise<AgentExecuteResult> {
    const sdkType = request.sdk || this.config.defaultSDK || 'claude-code';

    const adapter = this.adapters.get(sdkType);
    if (!adapter) {
      throw new Error(`Agent adapter '${sdkType}' not available. Check configuration.`);
    }

    logger.debug(`🤖 Executing agent request with ${sdkType} SDK`);

    try {
      const result = await adapter.execute(request);

      logger.debug(`✅ Agent execution completed: ${result.usage.totalTokens} tokens used`);

      return result;
    } catch (error) {
      logger.error(`❌ Agent execution failed:`, error);
      throw error;
    }
  }

  /**
   * Add a tool to all adapters
   */
  addTool(tool: AgentTool): void {
    this.defaultTools.push(tool);
    this.adapters.forEach(adapter => adapter.addTool(tool));
    logger.debug(`🔧 Tool '${tool.name}' added to all adapters`);
  }

  /**
   * Remove a tool from all adapters
   */
  removeTool(toolName: string): void {
    this.defaultTools = this.defaultTools.filter(t => t.name !== toolName);
    this.adapters.forEach(adapter => adapter.removeTool(toolName));
    logger.debug(`🔧 Tool '${toolName}' removed from all adapters`);
  }

  /**
   * Get available tools for a specific SDK
   */
  getTools(sdkType?: AgentSDKType): AgentTool[] {
    if (sdkType) {
      const adapter = this.adapters.get(sdkType);
      return adapter ? adapter.getTools() : [];
    }
    return this.defaultTools;
  }

  /**
   * Add a skill (Claude Code only)
   */
  addSkill(skill: AgentSkill): void {
    const claudeAdapter = this.adapters.get('claude-code');
    if (!claudeAdapter?.supportsSkills()) {
      throw new Error('Claude Code adapter not available or does not support skills');
    }

    this.defaultSkills.push(skill);
    claudeAdapter.addSkill?.(skill);
    logger.debug(`📚 Skill '${skill.name}' added to Claude Code adapter`);
  }

  /**
   * Remove a skill (Claude Code only)
   */
  removeSkill(skillId: string): void {
    const claudeAdapter = this.adapters.get('claude-code');
    if (!claudeAdapter?.supportsSkills()) {
      throw new Error('Claude Code adapter not available or does not support skills');
    }

    this.defaultSkills = this.defaultSkills.filter(s => s.id !== skillId);
    claudeAdapter.removeSkill?.(skillId);
    logger.debug(`📚 Skill '${skillId}' removed from Claude Code adapter`);
  }

  /**
   * Get available skills (Claude Code only)
   */
  getSkills(): AgentSkill[] {
    const claudeAdapter = this.adapters.get('claude-code');
    if (!claudeAdapter?.supportsSkills()) {
      return [];
    }
    return claudeAdapter.getSkills?.() || [];
  }

  /**
   * Get available SDK adapters
   */
  getAvailableSDKs(): AgentSDKType[] {
    return Array.from(this.adapters.keys());
  }

  /**
   * Check if a specific SDK is available
   */
  isSDKAvailable(sdkType: AgentSDKType): boolean {
    return this.adapters.has(sdkType);
  }

  /**
   * Get agent configuration
   */
  getConfig(): AgentConfig {
    return { ...this.config };
  }

  /**
   * Cleanup resources
   */
  async dispose(): Promise<void> {
    logger.debug('🤖 Disposing AgentService...');

    for (const [sdkType, adapter] of this.adapters.entries()) {
      await adapter.dispose();
      logger.debug(`✅ ${sdkType} adapter disposed`);
    }

    this.adapters.clear();
    logger.debug('✅ AgentService disposed');
  }
}
