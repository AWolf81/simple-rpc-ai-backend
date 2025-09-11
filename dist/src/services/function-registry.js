/**
 * Custom RPC Function Registry
 *
 * Allows registration of custom AI-powered functions that can be called
 * via JSON-RPC with centralized system prompts.
 */
import { promptManager } from './prompt-manager.js';
export class FunctionRegistry {
    functions = new Map();
    aiService;
    constructor(aiService) {
        this.aiService = aiService;
        this.loadDefaultFunctions();
    }
    /**
     * Register a custom function
     */
    registerFunction(definition) {
        // Validate that the prompt exists
        if (!promptManager.hasPrompt(definition.promptId)) {
            throw new Error(`Prompt '${definition.promptId}' not found for function '${definition.name}'`);
        }
        this.functions.set(definition.name, definition);
    }
    /**
     * Execute a custom function
     */
    async executeFunction(functionName, parameters, aiOptions) {
        const definition = this.functions.get(functionName);
        if (!definition) {
            throw new Error(`Function '${functionName}' not found`);
        }
        // Validate parameters
        this.validateParameters(definition, parameters);
        // Build prompt context from parameters and defaults
        const promptContext = {
            ...definition.promptContext,
            ...parameters
        };
        // Get the system prompt with variable substitution
        const systemPrompt = promptManager.getPrompt(definition.promptId, promptContext);
        // Extract the main content parameter (usually 'content', 'code', or 'text')
        const content = parameters.content || parameters.code || parameters.text || '';
        if (!content && typeof content !== 'string') {
            throw new Error(`Function '${functionName}' requires a content parameter`);
        }
        // Execute AI request
        const executeRequest = {
            content: String(content),
            systemPrompt,
            metadata: {
                functionName,
                promptId: definition.promptId,
                parameters: Object.keys(parameters)
            },
            options: aiOptions
        };
        const result = await this.aiService.execute(executeRequest);
        return {
            ...result,
            functionName,
            promptUsed: definition.promptId
        };
    }
    /**
     * List available functions (without exposing prompts)
     */
    listFunctions() {
        return Array.from(this.functions.values()).map(({ promptId, promptContext, ...info }) => info);
    }
    /**
     * Get function definition by name
     */
    getFunction(name) {
        return this.functions.get(name);
    }
    /**
     * Check if a function exists
     */
    hasFunction(name) {
        return this.functions.has(name);
    }
    /**
     * Validate function parameters
     */
    validateParameters(definition, parameters) {
        for (const param of definition.parameters) {
            const value = parameters[param.name];
            // Check required parameters
            if (param.required && value === undefined) {
                throw new Error(`Required parameter '${param.name}' missing for function '${definition.name}'`);
            }
            // Type validation
            if (value !== undefined && !this.isValidType(value, param.type)) {
                throw new Error(`Parameter '${param.name}' must be of type '${param.type}' for function '${definition.name}'`);
            }
        }
    }
    /**
     * Simple type validation
     */
    isValidType(value, expectedType) {
        switch (expectedType) {
            case 'string':
                return typeof value === 'string';
            case 'number':
                return typeof value === 'number' && !isNaN(value);
            case 'boolean':
                return typeof value === 'boolean';
            case 'object':
                return typeof value === 'object' && value !== null;
            default:
                return true;
        }
    }
    /**
     * Load default custom functions
     */
    loadDefaultFunctions() {
        // Code Analysis Function
        this.registerFunction({
            name: 'analyzeCode',
            description: 'Analyze code for quality, bugs, and improvements',
            promptId: 'analyze-code',
            parameters: [
                {
                    name: 'content',
                    type: 'string',
                    description: 'The code to analyze',
                    required: true
                },
                {
                    name: 'language',
                    type: 'string',
                    description: 'Programming language (e.g., javascript, python, java)',
                    required: false,
                    default: 'javascript'
                }
            ],
            promptContext: {
                language: 'javascript'
            },
            category: 'code-analysis',
            version: '1.0'
        });
        // Pull Request Review Function
        this.registerFunction({
            name: 'reviewPR',
            description: 'Review pull request changes for quality and compliance',
            promptId: 'review-pr',
            parameters: [
                {
                    name: 'content',
                    type: 'string',
                    description: 'The pull request diff or changes to review',
                    required: true
                },
                {
                    name: 'focus_area',
                    type: 'string',
                    description: 'Specific area to focus on (security, performance, etc.)',
                    required: false
                }
            ],
            category: 'code-review',
            version: '1.0'
        });
        // Test Generation Function
        this.registerFunction({
            name: 'generateTests',
            description: 'Generate comprehensive tests for code',
            promptId: 'generate-tests',
            parameters: [
                {
                    name: 'content',
                    type: 'string',
                    description: 'The code to generate tests for',
                    required: true
                },
                {
                    name: 'test_type',
                    type: 'string',
                    description: 'Type of tests to generate (unit, integration, e2e)',
                    required: false,
                    default: 'unit'
                },
                {
                    name: 'framework',
                    type: 'string',
                    description: 'Testing framework to use (vitest, jest, mocha)',
                    required: false,
                    default: 'vitest'
                }
            ],
            promptContext: {
                test_type: 'unit',
                framework: 'vitest'
            },
            category: 'testing',
            version: '1.0'
        });
        // Documentation Generation Function
        this.registerFunction({
            name: 'generateDocs',
            description: 'Generate comprehensive documentation for code',
            promptId: 'generate-docs',
            parameters: [
                {
                    name: 'content',
                    type: 'string',
                    description: 'The code to document',
                    required: true
                },
                {
                    name: 'format',
                    type: 'string',
                    description: 'Documentation format (markdown, jsdoc, etc.)',
                    required: false,
                    default: 'markdown'
                },
                {
                    name: 'audience',
                    type: 'string',
                    description: 'Target audience level (beginner, intermediate, advanced)',
                    required: false,
                    default: 'intermediate'
                }
            ],
            promptContext: {
                format: 'markdown',
                audience: 'intermediate'
            },
            category: 'documentation',
            version: '1.0'
        });
        // Security Review Function
        this.registerFunction({
            name: 'securityReview',
            description: 'Analyze code for security vulnerabilities',
            promptId: 'security-review',
            parameters: [
                {
                    name: 'content',
                    type: 'string',
                    description: 'The code to analyze for security issues',
                    required: true
                }
            ],
            category: 'security',
            version: '1.0'
        });
        // Performance Optimization Function
        this.registerFunction({
            name: 'optimizePerformance',
            description: 'Analyze and suggest performance improvements',
            promptId: 'optimize-performance',
            parameters: [
                {
                    name: 'content',
                    type: 'string',
                    description: 'The code to optimize',
                    required: true
                },
                {
                    name: 'platform',
                    type: 'string',
                    description: 'Target platform (node.js, browser, mobile)',
                    required: false,
                    default: 'node.js'
                }
            ],
            promptContext: {
                platform: 'node.js'
            },
            category: 'performance',
            version: '1.0'
        });
    }
}
