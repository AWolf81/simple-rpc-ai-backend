/**
 * Context Manager for Platform-Agnostic AI Requests
 *
 * Provides unified context handling across platforms with rich metadata support.
 * Supports VS Code, web apps, CLI tools, and API services.
 */
export type ContextType = 'file' | 'selection' | 'manual' | 'url' | 'clipboard' | 'stream' | 'conversation';
export interface AIRequestContext {
    type: ContextType;
    content: string;
    metadata?: {
        fileName?: string;
        filePath?: string;
        language?: string;
        lineNumbers?: [number, number];
        selectionRange?: {
            start: {
                line: number;
                character: number;
            };
            end: {
                line: number;
                character: number;
            };
        };
        sessionId?: string;
        conversationId?: string;
        messageId?: string;
        url?: string;
        urlTitle?: string;
        platform?: 'vscode' | 'web' | 'cli' | 'api' | 'mobile';
        deviceId?: string;
        timestamp?: Date;
        timezone?: string;
        responseFormat?: 'xml' | 'json' | 'text';
        streaming?: boolean;
        [key: string]: any;
    };
}
export interface ConversationHistory {
    messages: Array<{
        id: string;
        role: 'user' | 'assistant' | 'system';
        content: string;
        context?: AIRequestContext;
        timestamp: Date;
        metadata?: any;
    }>;
    totalTokens: number;
    maxContextWindow: number;
}
export declare class ContextManager {
    private conversations;
    private maxHistoryLength;
    private maxTokens;
    /**
     * Create context from VS Code selection
     */
    static fromVSCodeSelection(editor: any, selection?: any): AIRequestContext;
    /**
     * Create context from web application input
     */
    static fromWebInput(content: string, metadata?: any): AIRequestContext;
    /**
     * Create context from file system
     */
    static fromFile(filePath: string, content: string, metadata?: any): AIRequestContext;
    /**
     * Create context from URL content
     */
    static fromURL(url: string, content: string, metadata?: any): AIRequestContext;
    /**
     * Create context for streaming responses
     */
    static fromStream(content: string, metadata?: any): AIRequestContext;
    /**
     * Add context to conversation history
     */
    addToConversation(conversationId: string, role: 'user' | 'assistant' | 'system', content: string, context?: AIRequestContext, tokenCount?: number): void;
    /**
     * Get conversation history with context
     */
    getConversationHistory(conversationId: string): ConversationHistory | null;
    /**
     * Get conversation context for AI request
     */
    getConversationContext(conversationId: string, includeLastN?: number): AIRequestContext;
    /**
     * Merge multiple contexts
     */
    static mergeContexts(contexts: AIRequestContext[]): AIRequestContext;
    /**
     * Detect programming language from file name
     */
    private static detectLanguage;
    /**
     * Trim conversation to stay within limits
     */
    private trimConversation;
    /**
     * Generate unique message ID
     */
    private generateMessageId;
    /**
     * Clear conversation history
     */
    clearConversation(conversationId: string): void;
    /**
     * Get all active conversation IDs
     */
    getActiveConversations(): string[];
    /**
     * Export conversation for analysis
     */
    exportConversation(conversationId: string): any;
}
export default ContextManager;
//# sourceMappingURL=context-manager.d.ts.map