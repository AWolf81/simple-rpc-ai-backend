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
export function validateMCPParameters(
  context: any,
  parameterSchema: Record<string, MCPParameter>
): ParameterValidationResult {
  // System metadata properties to ignore
  const systemProperties = ['user', 'timestamp', 'auth', 'session'];

  // Extract user-provided parameters only
  const userProvidedKeys = context ? Object.keys(context).filter(key => !systemProperties.includes(key)) : [];
  const userParams = userProvidedKeys.reduce((acc, key) => {
    acc[key] = context[key];
    return acc;
  }, {} as Record<string, any>);

  // Check for missing required parameters
  const missingRequired: string[] = [];
  for (const [name, param] of Object.entries(parameterSchema)) {
    if (param.required && !(name in userParams)) {
      missingRequired.push(name);
    }
  }

  // Show help if any required parameters are missing
  // This provides helpful guidance instead of cryptic errors
  const showHelp = missingRequired.length > 0;

  return {
    showHelp,
    missingRequired,
    userParams
  };
}

/**
 * Generate comprehensive help text for an MCP resource
 */
export function generateMCPHelpText(helpConfig: MCPResourceHelp): string {
  const { id, name, description, parameters, additionalData = {} } = helpConfig;

  // Generate URI template
  const paramNames = Object.keys(parameters);
  const uriTemplate = paramNames.length > 0
    ? `mcp://internal/${id}{?${paramNames.join(',')}}`
    : `mcp://internal/${id}`;

  // Generate example URL
  const exampleParams: string[] = [];
  for (const [paramName, param] of Object.entries(parameters)) {
    if (param.required || param.default !== undefined) {
      let exampleValue = param.default;
      if (exampleValue === undefined) {
        switch (param.type) {
          case 'string':
            if (param.enum) {
              exampleValue = param.enum[0];
            } else if (param.availableValues) {
              exampleValue = param.availableValues[0];
            } else {
              exampleValue = 'example-value';
            }
            break;
          case 'number':
            exampleValue = param.min || 1;
            break;
          case 'boolean':
            exampleValue = true;
            break;
          default:
            exampleValue = 'example';
        }
      }
      exampleParams.push(`${paramName}=${exampleValue}`);
    }
  }

  const exampleUrl = exampleParams.length > 0
    ? `mcp://internal/${id}?${exampleParams.join('&')}`
    : `mcp://internal/${id}`;

  // Generate MCP tool call example
  const exampleArgs: Record<string, any> = {};
  for (const [paramName, param] of Object.entries(parameters)) {
    if (param.required || param.default !== undefined) {
      let exampleValue = param.default;
      if (exampleValue === undefined) {
        switch (param.type) {
          case 'string':
            if (param.enum) {
              exampleValue = param.enum[0];
            } else if (param.availableValues) {
              exampleValue = param.availableValues[0];
            } else {
              exampleValue = 'example-value';
            }
            break;
          case 'number':
            exampleValue = param.min || 1;
            break;
          case 'boolean':
            exampleValue = true;
            break;
          default:
            exampleValue = 'example';
        }
      }
      exampleArgs[paramName] = exampleValue;
    }
  }

  const helpContent = {
    name,
    description,
    notice: '⚠️ This resource requires parameters and cannot be accessed directly through the MCP Inspector.',
    usage: {
      resourceAccess: 'Resource templates support both direct resource access with parameters and MCP tool calls',
      directAccess: {
        description: 'Access this resource with URL parameters',
        url: uriTemplate,
        example: exampleUrl
      },
      mcpTools: {
        description: 'Use MCP tools for easier parameter handling',
        method: 'tools/call',
        example: {
          jsonrpc: '2.0',
          method: 'tools/call',
          params: {
            name: id,
            arguments: exampleArgs
          }
        }
      }
    },
    parameters: Object.fromEntries(
      Object.entries(parameters).map(([name, param]) => [
        name,
        {
          type: param.type,
          description: param.description,
          required: param.required || false,
          default: param.default,
          enum: param.enum,
          availableValues: param.availableValues,
          constraints: {
            min: param.min,
            max: param.max
          }
        }
      ])
    ),
    ...additionalData,
    additionalInfo: '💡 Resource templates can be used by both MCP tools and direct resource access with parameters. MCP tools provide easier parameter handling and validation.'
  };

  return JSON.stringify(helpContent, null, 2);
}

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
export function handleMCPResourceParameters(
  context: any,
  helpConfig: MCPResourceHelp
): {
  showHelp: boolean;
  helpText: string;
  userParams: Record<string, any>;
  missingRequired: string[];
} {
  const validation = validateMCPParameters(context, helpConfig.parameters);

  return {
    showHelp: validation.showHelp,
    helpText: validation.showHelp ? generateMCPHelpText(helpConfig) : '',
    userParams: validation.userParams,
    missingRequired: validation.missingRequired
  };
}

/**
 * Utility to create consistent error messages for missing parameters
 */
export function createMissingParameterError(missingParams: string[]): Error {
  const paramList = missingParams.join(', ');
  const message = missingParams.length === 1
    ? `Required parameter missing: ${paramList}`
    : `Required parameters missing: ${paramList}`;

  return new Error(message);
}

/**
 * Quick helper for simple parameter validation with automatic help text
 */
export function createMCPResourceHandler(
  helpConfig: MCPResourceHelp,
  implementation: (params: Record<string, any>) => Promise<string> | string
) {
  return async (resourceId: string, context: any): Promise<string> => {
    const result = handleMCPResourceParameters(context, helpConfig);

    // Show help if any required parameters are missing
    if (result.showHelp) {
      return result.helpText;
    }

    // At this point, all required parameters are present
    return await implementation(result.userParams);
  };
}