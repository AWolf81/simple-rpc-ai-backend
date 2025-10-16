/**
 * Common Error Handlers and Utilities for MCP Resources
 *
 * This module provides reusable error handling and help text generation
 * for MCP resources, making it easy for package users to create
 * resources that provide helpful error messages instead of cryptic errors.
 */
export interface MCPParameter {
    type: 'string' | 'number' | 'boolean' | 'array';
    description: string;
    required?: boolean;
    default?: any;
    enum?: string[] | number[];
    availableValues?: string[];
    min?: number;
    max?: number;
}
export interface MCPResourceHelp {
    /** Resource ID */
    id: string;
    /** Display name */
    name: string;
    /** Resource description */
    description: string;
    /** Parameters schema */
    parameters: Record<string, MCPParameter>;
    /** Additional context-specific data */
    additionalData?: Record<string, any>;
}
export interface ParameterValidationResult {
    /** Whether help text should be shown */
    showHelp: boolean;
    /** Missing required parameters */
    missingRequired: string[];
    /** User-provided parameters (excluding system metadata) */
    userParams: Record<string, any>;
}
/**
 * Common parameter validation logic that ignores system metadata
 */
export declare function validateMCPParameters(context: any, parameterSchema: Record<string, MCPParameter>): ParameterValidationResult;
/**
 * Generate comprehensive help text for an MCP resource
 */
export declare function generateMCPHelpText(helpConfig: MCPResourceHelp): string;
/**
 * Common error handler for MCP resources that require parameters
 *
 * Use this in your resource providers to handle missing parameters gracefully:
 *
 * @example
 * ```typescript
 * mcpResourceRegistry.registerProvider('my-resource', {
 *   generateContent: async (resourceId: string, context: any) => {
 *     const result = handleMCPResourceParameters(context, {
 *       id: 'my-resource',
 *       name: 'My Resource',
 *       description: 'Description of my resource',
 *       parameters: {
 *         requiredParam: {
 *           type: 'string',
 *           description: 'A required parameter',
 *           required: true
 *         },
 *         optionalParam: {
 *           type: 'number',
 *           description: 'An optional parameter',
 *           default: 42
 *         }
 *       }
 *     });
 *
 *     if (result.showHelp) {
 *       return result.helpText;
 *     }
 *
 *     // Use result.userParams for your logic
 *     const { requiredParam, optionalParam = 42 } = result.userParams;
 *     // ... your resource implementation
 *   }
 * });
 * ```
 */
export declare function handleMCPResourceParameters(context: any, helpConfig: MCPResourceHelp): {
    showHelp: boolean;
    helpText: string;
    userParams: Record<string, any>;
    missingRequired: string[];
};
/**
 * Utility to create consistent error messages for missing parameters
 */
export declare function createMissingParameterError(missingParams: string[]): Error;
/**
 * Quick helper for simple parameter validation with automatic help text
 */
export declare function createMCPResourceHandler(helpConfig: MCPResourceHelp, implementation: (params: Record<string, any>) => Promise<string> | string): (resourceId: string, context: any) => Promise<string>;
//# sourceMappingURL=mcp-resource-helpers.d.ts.map