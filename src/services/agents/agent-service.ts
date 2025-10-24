/**
 * Agent Service - Unified agent management
 *
 * Provides abstraction over AI Agent SDK and OpenAI Agents SDK,
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
import { AIAgentAdapter } from './adapters/ai-agent-adapter';
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
      defaultSDK: config.defaultSDK || 'ai-agent',
      enabled: config.enabled !== false,
      ...config
    };

    this.adapters = new Map();
    this.defaultTools = config.defaultTools || [];
    this.defaultSkills = config.agent?.defaultSkills || [];
  }

  /**
   * Initialize agent service and adapters
   */
  async initialize(): Promise<void> {
    logger.debug('🤖 Initializing AgentService...');

    // Initialize AI Agent adapter if enabled
    if (this.config.enabled) {
      const vercelAdapter = new AIAgentAdapter(
        this.aiService,
        this.config.agent
      );
      await vercelAdapter.initialize();

      // Add default tools and skills
      this.defaultTools.forEach(tool => vercelAdapter.addTool(tool));
      this.defaultSkills.forEach(skill => vercelAdapter.addSkill?.(skill));

      this.adapters.set('ai-agent', vercelAdapter);
      logger.debug('✅ AI Agent adapter initialized');
    }

    if (this.adapters.size === 0) {
      throw new Error('No agent adapters initialized. Set agents.enabled = true.');
    }

    logger.debug(`🤖 AgentService initialized with ${this.adapters.size} adapter(s)`);
  }

  /**
   * Execute agent request using specified or default SDK
   */
  async execute(request: AgentExecuteRequest, skillTools?: any[]): Promise<AgentExecuteResult> {
    const sdkType = request.sdk || this.config.defaultSDK || 'ai-agent';

    const adapter = this.adapters.get(sdkType);
    if (!adapter) {
      throw new Error(`Agent adapter '${sdkType}' not available. Check configuration.`);
    }

    logger.debug(`🤖 Executing agent request with ${sdkType} SDK`);

    try {
      // Pass skillTools through the request for the adapter to use
      const enhancedRequest: any = {
        ...request,
        skillTools // Add skillTools to request
      };

      const result = await adapter.execute(enhancedRequest);

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
   * Add a skill (AI Agent only)
   */
  addSkill(skill: AgentSkill): void {
    const claudeAdapter = this.adapters.get('ai-agent');
    if (!claudeAdapter?.supportsSkills()) {
      throw new Error('AI Agent adapter not available or does not support skills');
    }

    this.defaultSkills.push(skill);
    claudeAdapter.addSkill?.(skill);
    logger.debug(`📚 Skill '${skill.name}' added to AI Agent adapter`);
  }

  /**
   * Remove a skill (AI Agent only)
   */
  removeSkill(skillId: string): void {
    const claudeAdapter = this.adapters.get('ai-agent');
    if (!claudeAdapter?.supportsSkills()) {
      throw new Error('AI Agent adapter not available or does not support skills');
    }

    this.defaultSkills = this.defaultSkills.filter(s => s.id !== skillId);
    claudeAdapter.removeSkill?.(skillId);
    logger.debug(`📚 Skill '${skillId}' removed from AI Agent adapter`);
  }

  /**
   * Get available skills (AI Agent only)
   */
  getSkills(): AgentSkill[] {
    const claudeAdapter = this.adapters.get('ai-agent');
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
