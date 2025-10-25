/**
 * Conversation State Manager
 *
 * Manages agent conversation state for pause-resume interactions.
 * Tracks pending user interactions and conversation context.
 */

import { InteractionData } from './skills/utils/xml-interaction-parser.js';

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ToolCall {
  name: string;
  arguments: Record<string, any>;
}

export interface ConversationState {
  id: string;
  messages: Message[];
  pendingInteraction?: {
    toolName: string;
    toolCall: ToolCall;
    interaction: InteractionData;
    timestamp: number;
  };
  model: string;
  provider?: string;
  systemPrompt?: string;
  createdAt: number;
  lastAccessedAt: number;
}

export interface CreateConversationParams {
  messages?: Message[];
  model: string;
  provider?: string;
  systemPrompt?: string;
}

/**
 * Manages conversation state with TTL-based cleanup
 */
export class ConversationStateManager {
  private states = new Map<string, ConversationState>();
  private cleanupIntervals = new Map<string, NodeJS.Timeout>();
  private readonly defaultTTL = 30 * 60 * 1000; // 30 minutes

  /**
   * Create a new conversation state
   */
  create(params: CreateConversationParams): ConversationState {
    const id = this.generateId();
    const now = Date.now();

    const state: ConversationState = {
      id,
      messages: params.messages || [],
      model: params.model,
      provider: params.provider,
      systemPrompt: params.systemPrompt,
      createdAt: now,
      lastAccessedAt: now
    };

    this.states.set(id, state);
    this.scheduleCleanup(id);

    return state;
  }

  /**
   * Get conversation state by ID
   */
  get(id: string): ConversationState | null {
    const state = this.states.get(id);
    if (state) {
      state.lastAccessedAt = Date.now();
      this.rescheduleCleanup(id); // Extend TTL on access
    }
    return state || null;
  }

  /**
   * Update conversation messages
   */
  updateMessages(id: string, messages: Message[]): boolean {
    const state = this.states.get(id);
    if (!state) return false;

    state.messages = messages;
    state.lastAccessedAt = Date.now();
    return true;
  }

  /**
   * Add message to conversation
   */
  addMessage(id: string, message: Message): boolean {
    const state = this.states.get(id);
    if (!state) return false;

    state.messages.push(message);
    state.lastAccessedAt = Date.now();
    return true;
  }

  /**
   * Pause conversation with pending interaction
   */
  pause(id: string, interaction: InteractionData, toolCall: ToolCall): boolean {
    const state = this.states.get(id);
    if (!state) return false;

    state.pendingInteraction = {
      toolName: toolCall.name,
      toolCall,
      interaction,
      timestamp: Date.now()
    };

    state.lastAccessedAt = Date.now();
    return true;
  }

  /**
   * Resume conversation with user response
   */
  resume(id: string, response: string | string[]): ConversationState | null {
    const state = this.states.get(id);
    if (!state?.pendingInteraction) {
      return null;
    }

    // Clear pending interaction
    state.pendingInteraction = undefined;
    state.lastAccessedAt = Date.now();

    return state;
  }

  /**
   * Check if conversation has pending interaction
   */
  hasPendingInteraction(id: string): boolean {
    const state = this.states.get(id);
    return !!state?.pendingInteraction;
  }

  /**
   * Get pending interaction for conversation
   */
  getPendingInteraction(id: string): ConversationState['pendingInteraction'] | null {
    const state = this.states.get(id);
    return state?.pendingInteraction || null;
  }

  /**
   * Delete conversation state
   */
  delete(id: string): boolean {
    const existed = this.states.delete(id);
    this.cancelCleanup(id);
    return existed;
  }

  /**
   * Get all conversation IDs
   */
  getAllIds(): string[] {
    return Array.from(this.states.keys());
  }

  /**
   * Get conversation count
   */
  count(): number {
    return this.states.size;
  }

  /**
   * Clear all conversations
   */
  clear(): void {
    for (const id of this.states.keys()) {
      this.cancelCleanup(id);
    }
    this.states.clear();
  }

  /**
   * Clean up expired conversations
   */
  cleanupExpired(maxAge: number = this.defaultTTL): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [id, state] of this.states.entries()) {
      if (now - state.lastAccessedAt > maxAge) {
        this.delete(id);
        cleaned++;
      }
    }

    return cleaned;
  }

  /**
   * Generate unique conversation ID
   */
  private generateId(): string {
    return `conv_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }

  /**
   * Schedule cleanup for conversation
   */
  private scheduleCleanup(id: string): void {
    const timeout = setTimeout(() => {
      this.delete(id);
    }, this.defaultTTL);

    this.cleanupIntervals.set(id, timeout);
  }

  /**
   * Reschedule cleanup (extend TTL)
   */
  private rescheduleCleanup(id: string): void {
    this.cancelCleanup(id);
    this.scheduleCleanup(id);
  }

  /**
   * Cancel scheduled cleanup
   */
  private cancelCleanup(id: string): void {
    const timeout = this.cleanupIntervals.get(id);
    if (timeout) {
      clearTimeout(timeout);
      this.cleanupIntervals.delete(id);
    }
  }
}

// Singleton instance
let instance: ConversationStateManager | null = null;

/**
 * Get singleton conversation state manager
 */
export function getConversationStateManager(): ConversationStateManager {
  if (!instance) {
    instance = new ConversationStateManager();
  }
  return instance;
}

/**
 * Reset singleton (for testing)
 */
export function resetConversationStateManager(): void {
  if (instance) {
    instance.clear();
  }
  instance = null;
}
