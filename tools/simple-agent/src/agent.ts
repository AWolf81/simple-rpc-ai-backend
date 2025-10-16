/**
 * Agent Interface for simple-agent
 *
 * Handles communication with the agent backend
 */

import { configManager } from './config.js';

interface AgentMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface AgentResponse {
  content: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model: string;
  provider: string;
}

class AgentClient {
  private serverUrl: string;
  private conversationHistory: AgentMessage[] = [];

  constructor(serverUrl?: string) {
    const serverConfig = configManager.get('server');
    this.serverUrl = serverUrl || `http://${serverConfig?.host || 'localhost'}:${serverConfig?.port || 8000}`;
  }

  /**
   * Send a message to the agent
   */
  async sendMessage(message: string, systemPrompt?: string): Promise<AgentResponse> {
    const provider = configManager.getBestProvider();

    // Add user message to history
    this.conversationHistory.push({
      role: 'user',
      content: message
    });

    try {
      const response = await fetch(`${this.serverUrl}/rpc`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'agents.execute',
          params: {
            prompt: message,
            systemPrompt: systemPrompt || 'You are a helpful AI coding assistant. Provide clear, concise, and accurate answers.',
            messages: this.conversationHistory.slice(0, -1), // Don't include the current message
            sdk: 'claude-code',
            provider: provider.provider,
            model: provider.model
          },
          id: Date.now()
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error.message || 'Agent request failed');
      }

      const result = data.result;

      // Add assistant response to history
      this.conversationHistory.push({
        role: 'assistant',
        content: result.content
      });

      return {
        content: result.content,
        usage: result.usage,
        model: result.model,
        provider: result.provider
      };
    } catch (error) {
      console.error('Failed to send message to agent:', error);
      throw error;
    }
  }

  /**
   * Clear conversation history
   */
  clearHistory(): void {
    this.conversationHistory = [];
  }

  /**
   * Get conversation history
   */
  getHistory(): AgentMessage[] {
    return [...this.conversationHistory];
  }

  /**
   * Test connection to server
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.serverUrl}/health`);
      return response.ok;
    } catch {
      return false;
    }
  }
}

export { AgentClient, AgentMessage, AgentResponse };
