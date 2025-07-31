/**
 * Context Manager for Platform-Agnostic AI Requests
 *
 * Provides unified context handling across platforms with rich metadata support.
 * Supports VS Code, web apps, CLI tools, and API services.
 */
export class ContextManager {
    conversations = new Map();
    maxHistoryLength = 50;
    maxTokens = 100000;
    /**
     * Create context from VS Code selection
     */
    static fromVSCodeSelection(editor, selection) {
        const document = editor.document;
        const activeSelection = selection || editor.selection;
        return {
            type: 'selection',
            content: document.getText(activeSelection),
            metadata: {
                fileName: document.fileName,
                filePath: document.uri.fsPath,
                language: document.languageId,
                lineNumbers: [
                    activeSelection.start.line + 1,
                    activeSelection.end.line + 1
                ],
                selectionRange: {
                    start: {
                        line: activeSelection.start.line,
                        character: activeSelection.start.character
                    },
                    end: {
                        line: activeSelection.end.line,
                        character: activeSelection.end.character
                    }
                },
                platform: 'vscode',
                timestamp: new Date(),
                responseFormat: 'xml' // Default to XML for streaming
            }
        };
    }
    /**
     * Create context from web application input
     */
    static fromWebInput(content, metadata = {}) {
        return {
            type: 'manual',
            content,
            metadata: {
                platform: 'web',
                timestamp: new Date(),
                responseFormat: 'json', // Web prefers JSON
                streaming: false,
                ...metadata
            }
        };
    }
    /**
     * Create context from file system
     */
    static fromFile(filePath, content, metadata = {}) {
        const fileName = filePath.split(/[/\\]/).pop() || '';
        const language = this.detectLanguage(fileName);
        return {
            type: 'file',
            content,
            metadata: {
                fileName,
                filePath,
                language,
                platform: 'cli',
                timestamp: new Date(),
                responseFormat: 'xml', // CLI can handle streaming XML
                streaming: true,
                ...metadata
            }
        };
    }
    /**
     * Create context from URL content
     */
    static fromURL(url, content, metadata = {}) {
        return {
            type: 'url',
            content,
            metadata: {
                url,
                platform: 'api',
                timestamp: new Date(),
                responseFormat: 'json', // API prefers JSON
                ...metadata
            }
        };
    }
    /**
     * Create context for streaming responses
     */
    static fromStream(content, metadata = {}) {
        return {
            type: 'stream',
            content,
            metadata: {
                streaming: true,
                responseFormat: 'xml', // XML better for streaming
                timestamp: new Date(),
                ...metadata
            }
        };
    }
    /**
     * Add context to conversation history
     */
    addToConversation(conversationId, role, content, context, tokenCount = 0) {
        if (!this.conversations.has(conversationId)) {
            this.conversations.set(conversationId, {
                messages: [],
                totalTokens: 0,
                maxContextWindow: this.maxTokens
            });
        }
        const conversation = this.conversations.get(conversationId);
        const message = {
            id: this.generateMessageId(),
            role,
            content,
            context,
            timestamp: new Date(),
            metadata: {
                tokenCount,
                conversationLength: conversation.messages.length
            }
        };
        conversation.messages.push(message);
        conversation.totalTokens += tokenCount;
        // Trim conversation if too long
        this.trimConversation(conversationId);
    }
    /**
     * Get conversation history with context
     */
    getConversationHistory(conversationId) {
        return this.conversations.get(conversationId) || null;
    }
    /**
     * Get conversation context for AI request
     */
    getConversationContext(conversationId, includeLastN = 10) {
        const conversation = this.conversations.get(conversationId);
        if (!conversation) {
            return {
                type: 'conversation',
                content: '',
                metadata: {
                    conversationId,
                    timestamp: new Date()
                }
            };
        }
        const recentMessages = conversation.messages.slice(-includeLastN);
        const contextContent = recentMessages
            .map(msg => `${msg.role}: ${msg.content}`)
            .join('\n\n');
        return {
            type: 'conversation',
            content: contextContent,
            metadata: {
                conversationId,
                messageCount: recentMessages.length,
                totalTokens: conversation.totalTokens,
                timestamp: new Date(),
                responseFormat: 'xml' // Conversation context works well with XML
            }
        };
    }
    /**
     * Merge multiple contexts
     */
    static mergeContexts(contexts) {
        if (contexts.length === 0) {
            throw new Error('No contexts to merge');
        }
        if (contexts.length === 1) {
            return contexts[0];
        }
        const merged = {
            type: 'manual',
            content: contexts.map(ctx => ctx.content).join('\n---\n'),
            metadata: {
                mergedFrom: contexts.map(ctx => ctx.type),
                mergedAt: new Date(),
                responseFormat: contexts[0].metadata?.responseFormat || 'xml'
            }
        };
        // Merge metadata from all contexts
        contexts.forEach((ctx, index) => {
            if (ctx.metadata) {
                Object.entries(ctx.metadata).forEach(([key, value]) => {
                    const prefixedKey = `context${index}_${key}`;
                    merged.metadata[prefixedKey] = value;
                });
            }
        });
        return merged;
    }
    /**
     * Detect programming language from file name
     */
    static detectLanguage(fileName) {
        const ext = fileName.split('.').pop()?.toLowerCase() || '';
        const languageMap = {
            'js': 'javascript',
            'ts': 'typescript',
            'jsx': 'javascript',
            'tsx': 'typescript',
            'py': 'python',
            'java': 'java',
            'cs': 'csharp',
            'go': 'go',
            'rs': 'rust',
            'cpp': 'cpp',
            'c': 'c',
            'php': 'php',
            'rb': 'ruby',
            'swift': 'swift',
            'kt': 'kotlin',
            'xml': 'xml',
            'json': 'json',
            'md': 'markdown',
            'html': 'html',
            'css': 'css',
            'sql': 'sql',
            'yaml': 'yaml',
            'yml': 'yaml'
        };
        return languageMap[ext] || ext || 'text';
    }
    /**
     * Trim conversation to stay within limits
     */
    trimConversation(conversationId) {
        const conversation = this.conversations.get(conversationId);
        // Remove old messages if too many
        while (conversation.messages.length > this.maxHistoryLength) {
            const removed = conversation.messages.shift();
            conversation.totalTokens -= removed.metadata?.tokenCount || 0;
        }
        // Remove old messages if too many tokens
        while (conversation.totalTokens > this.maxTokens && conversation.messages.length > 1) {
            const removed = conversation.messages.shift();
            conversation.totalTokens -= removed.metadata?.tokenCount || 0;
        }
    }
    /**
     * Generate unique message ID
     */
    generateMessageId() {
        return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    /**
     * Clear conversation history
     */
    clearConversation(conversationId) {
        this.conversations.delete(conversationId);
    }
    /**
     * Get all active conversation IDs
     */
    getActiveConversations() {
        return Array.from(this.conversations.keys());
    }
    /**
     * Export conversation for analysis
     */
    exportConversation(conversationId) {
        const conversation = this.conversations.get(conversationId);
        if (!conversation)
            return null;
        return {
            conversationId,
            exportedAt: new Date().toISOString(),
            messages: conversation.messages,
            totalTokens: conversation.totalTokens,
            messageCount: conversation.messages.length
        };
    }
}
export default ContextManager;
//# sourceMappingURL=context-manager.js.map