/**
 * Agent Types and Interfaces
 *
 * Defines the agent abstraction using AI Agent SDK with optional OpenAI compatibility
 */

import { z } from 'zod';

/**
 * Agent SDK types
 */
export type AgentSDKType = 'ai-agent' | 'openai';

/**
 * Agent skill definition (progressive disclosure model)
 * Skills are modular capabilities that extend agent functionality
 */
export interface AgentSkill {
  /** Unique skill identifier */
  id: string;
  /** Display name (max 64 chars) */
  name: string;
  /** Description of what the skill does (max 1024 chars) */
  description: string;
  /** Progressive disclosure level */
  level: 1 | 2 | 3;
  /** Skill metadata content (YAML frontmatter) */
  metadata?: Record<string, any>;
  /** Instructions for the agent (Level 2, <5k tokens) */
  instructions?: string;
  /** Additional resources (Level 3, effectively unlimited) */
  resources?: Array<{
    type: 'file' | 'script' | 'reference';
    path: string;
    content?: string;
  }>;
  /** Optional executable scripts */
  scripts?: Array<{
    name: string;
    language: 'bash' | 'python' | 'javascript';
    content: string;
  }>;
}

/**
 * Agent tool definition (compatible with both SDKs)
 */
export interface AgentTool {
  /** Tool name */
  name: string;
  /** Tool description */
  description: string;
  /** Input schema (JSON Schema format) */
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
  /** Tool implementation function */
  execute: (args: any) => Promise<any>;
}

/**
 * Agent execution context
 */
export interface AgentContext {
  /** User ID for tracking */
  userId?: string;
  /** Session ID for conversation continuity */
  sessionId?: string;
  /** Agent-specific configuration */
  config?: Record<string, any>;
  /** Available tools for this execution */
  tools?: AgentTool[];
  /** Available skills (AI Agent only) */
  skills?: AgentSkill[];
}

/**
 * Agent message types
 */
export interface AgentMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata?: Record<string, any>;
}

/**
 * Agent execution request
 */
export interface AgentExecuteRequest {
  /** User prompt/query */
  prompt: string;
  /** System instructions */
  systemPrompt?: string;
  /** Conversation history */
  messages?: AgentMessage[];
  /** Agent context */
  context?: AgentContext;
  /** Agent SDK to use */
  sdk?: AgentSDKType;
  /** Model override */
  model?: string;
  /** Provider override */
  provider?: string;
  /** Maximum tokens */
  maxTokens?: number;
  /** Temperature */
  temperature?: number;
}

/**
 * Agent execution result
 */
export interface AgentExecuteResult {
  /** Generated response */
  content: string;
  /** Token usage */
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  /** Model used */
  model: string;
  /** Provider used */
  provider?: string;
  /** SDK used */
  sdk: AgentSDKType;
  /** Tool calls made during execution */
  toolCalls?: Array<{
    name: string;
    arguments: any;
    result: any;
  }>;
  /** Skills triggered during execution (AI Agent only) */
  skillsTriggered?: string[];
  /** Finish reason */
  finishReason?: string;
  /** Request ID for tracking */
  requestId: string;
}

/**
 * Agent configuration
 */
export interface AgentConfig {
  /** Enable agent system */
  enabled?: boolean;
  /** Default SDK to use */
  defaultSDK?: AgentSDKType;
  /** Agent-specific config (skills, etc.) */
  agent?: {
    /** Enable skills support */
    enableSkills?: boolean;
    /** Default skills to load */
    defaultSkills?: AgentSkill[];
    /** Skills directory path */
    skillsDirectory?: string;
  };
  /** Default tools available to agents */
  defaultTools?: AgentTool[];
  /** AI provider configuration (reuses existing AIService) */
  aiProvider?: {
    provider?: 'anthropic' | 'openai' | 'google';
    model?: string;
    maxTokens?: number;
    temperature?: number;
  };
}

/**
 * Base agent adapter interface
 */
export interface IAgentAdapter {
  /** SDK type */
  readonly sdkType: AgentSDKType;

  /** Initialize the adapter */
  initialize(): Promise<void>;

  /** Execute agent request */
  execute(request: AgentExecuteRequest): Promise<AgentExecuteResult>;

  /** Add a tool to the agent */
  addTool(tool: AgentTool): void;

  /** Remove a tool from the agent */
  removeTool(toolName: string): void;

  /** Get available tools */
  getTools(): AgentTool[];

  /** Check if adapter supports skills */
  supportsSkills(): boolean;

  /** Add a skill (AI Agent only) */
  addSkill?(skill: AgentSkill): void;

  /** Remove a skill (AI Agent only) */
  removeSkill?(skillId: string): void;

  /** Get available skills (AI Agent only) */
  getSkills?(): AgentSkill[];

  /** Cleanup resources */
  dispose(): Promise<void>;
}

/**
 * Zod schemas for validation
 */
export const AgentSkillSchema = z.object({
  id: z.string(),
  name: z.string().max(64),
  description: z.string().max(1024),
  level: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  metadata: z.record(z.string(), z.unknown()).optional(),
  instructions: z.string().optional(),
  resources: z.array(z.object({
    type: z.enum(['file', 'script', 'reference']),
    path: z.string(),
    content: z.string().optional()
  })).optional(),
  scripts: z.array(z.object({
    name: z.string(),
    language: z.enum(['bash', 'python', 'javascript']),
    content: z.string()
  })).optional()
});

export const AgentToolSchema = z.object({
  name: z.string(),
  description: z.string(),
  inputSchema: z.object({
    type: z.literal('object'),
    properties: z.record(z.string(), z.unknown()),
    required: z.array(z.string()).optional()
  })
});

export const AgentExecuteRequestSchema = z.object({
  prompt: z.string(),
  systemPrompt: z.string().optional(),
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant', 'system']),
    content: z.string(),
    metadata: z.record(z.string(), z.unknown()).optional()
  })).optional(),
  context: z.object({
    userId: z.string().optional(),
    sessionId: z.string().optional(),
    config: z.record(z.string(), z.unknown()).optional(),
    tools: z.array(AgentToolSchema).optional(),
    skills: z.array(AgentSkillSchema).optional()
  }).optional(),
  sdk: z.enum(['ai-agent', 'openai']).optional(),
  model: z.string().optional(),
  provider: z.string().optional(),
  maxTokens: z.number().optional(),
  temperature: z.number().optional()
});
