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
    originalToolName?: string; // The actual tool that triggered this (e.g. file_handling_delete)
    toolCall: ToolCall;
    interaction: InteractionData;
    timestamp: number;
    skillId?: string;
    scriptName?: string;
    scriptArgs?: string[];
    stdin?: string;
    cwd?: string;
    toolArguments?: Record<string, any>;
  };
  approvedTools?: Set<string>; // Track approved tool+args combinations
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
  pause(
    id: string,
    interaction: InteractionData,
    toolCall: ToolCall,
    originalToolName?: string,
    metadata?: {
      skillId?: string;
      scriptName?: string;
      scriptArgs?: string[];
      stdin?: string;
      cwd?: string;
      toolArguments?: Record<string, any>;
    }
  ): boolean {
    const state = this.states.get(id);
    if (!state) return false;

    // DEBUG: Log what we're storing
    console.log('💾 PAUSE: Storing pending interaction');
    console.log('   Tool name:', toolCall.name);
    console.log('   Original tool:', originalToolName);
    console.log('   Tool arguments:', JSON.stringify(toolCall.arguments, null, 2));
    if (metadata) {
      console.log('   Metadata:', JSON.stringify(metadata, null, 2));
    }

    state.pendingInteraction = {
      toolName: toolCall.name,
      originalToolName: originalToolName || toolCall.name, // Store the original tool that triggered this
      toolCall,
      interaction,
      timestamp: Date.now(),
      skillId: metadata?.skillId,
      scriptName: metadata?.scriptName,
      scriptArgs: metadata?.scriptArgs,
      stdin: metadata?.stdin,
      cwd: metadata?.cwd,
      toolArguments: metadata?.toolArguments ?? toolCall.arguments
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

    // If user approved, remember this tool+args combination
    const responseText = Array.isArray(response) ? response.join('') : response;
    if (responseText.toLowerCase().includes('allow') || responseText.toLowerCase().includes('yes')) {
      // Use the original tool name (the one that triggered the approval), not the wrapper
      const toolName = state.pendingInteraction.originalToolName || state.pendingInteraction.toolName;
      const toolKey = this.generateToolKey(
        toolName,
        state.pendingInteraction.toolCall.arguments
      );

      if (!state.approvedTools) {
        state.approvedTools = new Set();
      }
      state.approvedTools.add(toolKey);
    }

    // Clear pending interaction
    state.pendingInteraction = undefined;
    state.lastAccessedAt = Date.now();

    return state;
  }

  /**
   * Check if a tool+args combination has been approved
   */
  isToolApproved(id: string, toolName: string, args: Record<string, any>): boolean {
    const state = this.states.get(id);
    if (!state?.approvedTools) return false;

    const toolKey = this.generateToolKey(toolName, args);
    return state.approvedTools.has(toolKey);
  }

  /**
   * Generate unique key for tool+args combination
   */
  private generateToolKey(toolName: string, args: Record<string, any>): string {
    const sortedArgs = Object.keys(args || {}).sort().reduce((acc, key) => {
      acc[key] = args[key];
      return acc;
    }, {} as Record<string, any>);
    return `${toolName}:${JSON.stringify(sortedArgs)}`;
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
