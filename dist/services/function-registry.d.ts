/**
 * Custom RPC Function Registry
 *
 * Allows registration of custom AI-powered functions that can be called
 * via JSON-RPC with centralized system prompts.
 */
import { type PromptContext } from './prompt-manager.js';
import { AIService, type ExecuteResult } from './ai-service.js';
export interface CustomFunctionDefinition {
    name: string;
    description: string;
    promptId: string;
    parameters: {
        name: string;
        type: 'string' | 'number' | 'boolean' | 'object';
        description: string;
        required?: boolean;
        default?: any;
    }[];
    promptContext?: PromptContext;
    category?: string;
    version?: string;
}
export interface CustomFunctionRequest {
    [key: string]: any;
}
export interface CustomFunctionResult extends ExecuteResult {
    functionName: string;
    promptUsed: string;
}
export declare class FunctionRegistry {
    private functions;
    private aiService;
    constructor(aiService: AIService);
    /**
     * Register a custom function
     */
    registerFunction(definition: CustomFunctionDefinition): void;
    /**
     * Execute a custom function
     */
    executeFunction(functionName: string, parameters: CustomFunctionRequest, aiOptions?: {
        model?: string;
        maxTokens?: number;
        temperature?: number;
    }): Promise<CustomFunctionResult>;
    /**
     * List available functions (without exposing prompts)
     */
    listFunctions(): Omit<CustomFunctionDefinition, 'promptId' | 'promptContext'>[];
    /**
     * Get function definition by name
     */
    getFunction(name: string): CustomFunctionDefinition | undefined;
    /**
     * Check if a function exists
     */
    hasFunction(name: string): boolean;
    /**
     * Validate function parameters
     */
    private validateParameters;
    /**
     * Simple type validation
     */
    private isValidType;
    /**
     * Load default custom functions
     */
    private loadDefaultFunctions;
}
//# sourceMappingURL=function-registry.d.ts.map