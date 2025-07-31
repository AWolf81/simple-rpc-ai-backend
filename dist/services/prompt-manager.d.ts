/**
 * Centralized System Prompt Management
 *
 * Manages system prompts for custom RPC functions, providing a secure way
 * to store and retrieve prompts without exposing them to clients.
 */
export interface PromptTemplate {
    id: string;
    name: string;
    description: string;
    systemPrompt: string;
    variables?: string[];
    category?: string;
    version?: string;
}
export interface PromptContext {
    [key: string]: string | number | boolean;
}
export declare class PromptManager {
    private prompts;
    constructor();
    /**
     * Register a new prompt template
     */
    registerPrompt(template: PromptTemplate): void;
    /**
     * Get a prompt by ID with variable substitution
     */
    getPrompt(id: string, context?: PromptContext): string;
    /**
     * List available prompts (without exposing actual content)
     */
    listPrompts(): Omit<PromptTemplate, 'systemPrompt'>[];
    /**
     * Check if a prompt exists
     */
    hasPrompt(id: string): boolean;
    /**
     * Replace variables in prompt template
     */
    private interpolatePrompt;
    /**
     * Load default system prompts for common use cases
     */
    private loadDefaultPrompts;
}
export declare const promptManager: PromptManager;
//# sourceMappingURL=prompt-manager.d.ts.map