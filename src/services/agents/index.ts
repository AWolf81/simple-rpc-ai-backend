/**
 * Agent Services - Unified exports
 */

export { AgentService } from './agent-service';
export { AIAgentAdapter } from './adapters/ai-agent-adapter';
export { OpenAIAgentAdapter } from './adapters/openai-agent-adapter';
export { loadMainAgentSkill } from './builtin/index';

import type { ModelDefinition, ModelCapability } from '../ai/ai-service';

export type {
  AgentConfig,
  AgentSDKType,
  AgentSkill,
  AgentTool,
  AgentContext,
  AgentMessage,
  AgentExecuteRequest,
  AgentExecuteResult,
  IAgentAdapter,
} from './types';

// Export types imported from other modules
export type { ModelDefinition, ModelCapability };

export {
  AgentSkillSchema,
  AgentToolSchema,
  AgentExecuteRequestSchema
} from './types';
