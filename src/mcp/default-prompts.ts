/**
 * MCP Prompt interfaces for Simple RPC AI Backend
 * No default prompts are provided - users should define their own via customPrompts
 */

export interface MCPPrompt {
  name: string;
  description: string;
  arguments?: Array<{
    name: string;
    description: string;
    required?: boolean;
  }>;
}

export interface MCPPromptTemplate {
  name: string;
  description: string;
  messages: Array<{
    role: 'user' | 'assistant' | 'system';
    content: {
      type: 'text';
      text: string;
    };
  }>;
}