/**
 * Reusable Template Engine for MCP Resources
 *
 * This module provides a flexible, easy-to-use API for creating
 * dynamic MCP resource templates with parameters, validation, and
 * multiple output formats.
 */

export interface TemplateParameter {
  type: 'string' | 'number' | 'boolean' | 'array';
  enum?: string[] | number[];
  description?: string;
  required?: boolean;
  default?: any;
  min?: number;
  max?: number;
  pattern?: string;
}

export interface TemplateConfig {
  /** Resource ID */
  id: string;
  /** Display name */
  name: string;
  /** Resource description */
  description: string;
  /** Base MIME type (can be overridden by format parameter) */
  mimeType?: string;
  /** Template parameters schema */
  parameters?: Record<string, TemplateParameter>;
  /** URI template pattern (RFC 6570) */
  uriTemplate?: string;
  /** Whether authentication is required */
  requireAuth?: boolean;
  /** Resource category */
  category?: string;
}

export interface ContentResult {
  content: string;
  mimeType?: string;
}

export type ContentGenerator = (params: any) => ContentResult | Promise<ContentResult>;

export interface FormatHandler {
  mimeType: string;
  generator: ContentGenerator;
}

/**
 * Template Engine Builder
 *
 * Provides a fluent API for creating reusable resource templates
 */
export class TemplateBuilder {
  private config: TemplateConfig;
  private baseGenerator?: ContentGenerator;
  private formatHandlers: Map<string, FormatHandler> = new Map();

  constructor(id: string) {
    this.config = { id, name: '', description: '' };
  }

  /**
   * Set template metadata
   */
  name(name: string): this {
    this.config.name = name;
    return this;
  }

  description(description: string): this {
    this.config.description = description;
    return this;
  }

  mimeType(mimeType: string): this {
    this.config.mimeType = mimeType;
    return this;
  }

  category(category: string): this {
    this.config.category = category;
    return this;
  }

  requireAuth(required: boolean = true): this {
    this.config.requireAuth = required;
    return this;
  }

  /**
   * Add a parameter with validation
   */
  parameter(name: string, config: TemplateParameter): this {
    if (!this.config.parameters) {
      this.config.parameters = {};
    }
    this.config.parameters[name] = config;
    return this;
  }

  /**
   * Add enum parameter (common case)
   */
  enumParameter(name: string, values: string[], description?: string, required: boolean = false): this {
    return this.parameter(name, {
      type: 'string',
      enum: values,
      description,
      required,
      default: values[0]
    });
  }

  /**
   * Add string parameter
   */
  stringParameter(name: string, description?: string, required: boolean = false, defaultValue?: string): this {
    return this.parameter(name, {
      type: 'string',
      description,
      required,
      default: defaultValue
    });
  }

  /**
   * Add number parameter
   */
  numberParameter(name: string, description?: string, min?: number, max?: number, defaultValue?: number): this {
    return this.parameter(name, {
      type: 'number',
      description,
      min,
      max,
      default: defaultValue
    });
  }

  /**
   * Set the base content generator
   */
  generator(generator: ContentGenerator): this {
    this.baseGenerator = generator;
    return this;
  }

  /**
   * Add format-specific handler
   */
  format(formatValue: string, mimeType: string, generator: ContentGenerator): this {
    this.formatHandlers.set(formatValue, { mimeType, generator });
    return this;
  }

  /**
   * Add common format handlers
   */
  markdown(generator: ContentGenerator): this {
    return this.format('md', 'text/markdown', generator);
  }

  xml(generator: ContentGenerator): this {
    return this.format('xml', 'application/xml', generator);
  }

  json(generator: ContentGenerator): this {
    return this.format('json', 'application/json', generator);
  }

  html(generator: ContentGenerator): this {
    return this.format('html', 'text/html', generator);
  }

  /**
   * Build the template configuration
   */
  build(): {
    config: TemplateConfig;
    provider: (resourceId: string, context: any) => Promise<ContentResult>;
  } {
    // Generate URI template
    if (this.config.parameters && Object.keys(this.config.parameters).length > 0) {
      const paramNames = Object.keys(this.config.parameters);
      this.config.uriTemplate = `mcp://internal/${this.config.id}{?${paramNames.join(',')}}`;
    }

    // Create provider function
    const provider = async (resourceId: string, context: any = {}): Promise<ContentResult> => {
      // Validate parameters
      const validatedParams = this.validateParameters(context);

      // Check if we should show help text
      if (validatedParams.__showHelpText) {
        return this.generateHelpText();
      }

      // Check for format-specific handler
      const format = validatedParams.format || 'default';
      const formatHandler = this.formatHandlers.get(format);

      if (formatHandler) {
        const result = await formatHandler.generator(validatedParams);
        return {
          content: result.content,
          mimeType: result.mimeType || formatHandler.mimeType
        };
      }

      // Use base generator
      if (this.baseGenerator) {
        const result = await this.baseGenerator(validatedParams);
        return {
          content: result.content,
          mimeType: result.mimeType || this.config.mimeType || 'text/plain'
        };
      }

      throw new Error(`No generator found for format: ${format}`);
    };

    return { config: this.config, provider };
  }

  /**
   * Validate and apply defaults to parameters
   */
  private validateParameters(context: any): any {
    if (!this.config.parameters) {
      return context;
    }

    const result: any = { ...context };

    // Check if context is empty/null and there are required parameters
    // If so, return a special flag to trigger help text instead of throwing error
    const hasAnyRequiredParams = Object.values(this.config.parameters).some(param => param.required);

    // Ignore system metadata properties when checking if context is empty
    const systemProperties = ['user', 'timestamp', 'auth', 'session'];
    const userProvidedKeys = context ? Object.keys(context).filter(key => !systemProperties.includes(key)) : [];
    const hasNoUserContext = userProvidedKeys.length === 0;

    if (hasAnyRequiredParams && hasNoUserContext) {
      // Return special marker that triggers help text generation
      return { __showHelpText: true };
    }

    for (const [name, param] of Object.entries(this.config.parameters!)) {
      const value = context[name];

      // Apply defaults
      if (value === undefined && param.default !== undefined) {
        result[name] = param.default;
        continue;
      }

      // Check required
      if (param.required && (value === undefined || value === null)) {
        throw new Error(`Required parameter missing: ${name}`);
      }

      // Validate enum
      if (param.enum && value !== undefined && !(param.enum as any[]).includes(value)) {
        throw new Error(`Invalid value for ${name}. Must be one of: ${param.enum.join(', ')}`);
      }

      // Validate type
      if (value !== undefined) {
        const actualType = Array.isArray(value) ? 'array' : typeof value;
        if (actualType !== param.type) {
          throw new Error(`Invalid type for ${name}. Expected ${param.type}, got ${actualType}`);
        }
      }

      // Validate range for numbers
      if (param.type === 'number' && value !== undefined) {
        if (param.min !== undefined && value < param.min) {
          throw new Error(`${name} must be >= ${param.min}`);
        }
        if (param.max !== undefined && value > param.max) {
          throw new Error(`${name} must be <= ${param.max}`);
        }
      }
    }

    return result;
  }

  /**
   * Generate comprehensive help text for this resource template
   */
  private generateHelpText(): ContentResult {
    const helpContent = {
      name: this.config.name,
      description: this.config.description,
      notice: "⚠️ This resource requires parameters and cannot be accessed directly through the MCP Inspector.",
      usage: {
        resourceAccess: "Resource templates support both direct resource access with parameters and MCP tool calls",
        directAccess: {
          description: "Access this resource with URL parameters",
          url: this.config.uriTemplate || `mcp://internal/${this.config.id}`,
          example: this.generateExampleUrl()
        },
        mcpTools: {
          description: "Use MCP tools for easier parameter handling",
          method: "tools/call",
          example: this.generateMCPExample()
        }
      },
      parameters: this.config.parameters ? this.formatParameterHelp() : {},
      additionalInfo: "💡 Resource templates can be used by both MCP tools and direct resource access with parameters. MCP tools provide easier parameter handling and validation."
    };

    return {
      content: JSON.stringify(helpContent, null, 2),
      mimeType: 'application/json'
    };
  }

  /**
   * Generate example URL with parameters
   */
  private generateExampleUrl(): string {
    if (!this.config.parameters) {
      return this.config.uriTemplate || `mcp://internal/${this.config.id}`;
    }

    const examples: string[] = [];
    for (const [name, param] of Object.entries(this.config.parameters)) {
      if (param.required || param.default !== undefined) {
        let exampleValue = param.default;

        if (exampleValue === undefined) {
          switch (param.type) {
            case 'string':
              exampleValue = param.enum ? param.enum[0] : 'example-value';
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

        examples.push(`${name}=${exampleValue}`);
      }
    }

    const baseUri = `mcp://internal/${this.config.id}`;
    return examples.length > 0 ? `${baseUri}?${examples.join('&')}` : baseUri;
  }

  /**
   * Generate MCP tool call example
   */
  private generateMCPExample(): any {
    if (!this.config.parameters) {
      return {
        jsonrpc: "2.0",
        method: "tools/call",
        params: {
          name: this.config.id,
          arguments: {}
        }
      };
    }

    const exampleArgs: any = {};
    for (const [name, param] of Object.entries(this.config.parameters)) {
      if (param.required || param.default !== undefined) {
        let exampleValue = param.default;

        if (exampleValue === undefined) {
          switch (param.type) {
            case 'string':
              exampleValue = param.enum ? param.enum[0] : 'example-value';
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

        exampleArgs[name] = exampleValue;
      }
    }

    return {
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        name: this.config.id,
        arguments: exampleArgs
      }
    };
  }

  /**
   * Format parameter help information
   */
  private formatParameterHelp(): any {
    if (!this.config.parameters) return {};

    const paramHelp: any = {};
    for (const [name, param] of Object.entries(this.config.parameters)) {
      paramHelp[name] = {
        type: param.type || 'string',
        description: param.description || `Parameter: ${name}`,
        required: param.required || false,
        default: param.default,
        enum: param.enum,
        constraints: {
          min: param.min,
          max: param.max
        }
      };
    }

    return paramHelp;
  }
}

/**
 * Quick Template Builders for Common Use Cases
 */
export class QuickTemplates {
  /**
   * File-based template with path and format parameters
   */
  static fileTemplate(id: string, name: string, description: string): TemplateBuilder {
    return new TemplateBuilder(id)
      .name(name)
      .description(description)
      .stringParameter('path', 'File path relative to root folder', true)
      .enumParameter('format', ['raw', 'json', 'base64'], 'Output format')
      .generator(async (params) => {
        const { path, format = 'raw' } = params;
        // This would integrate with file system
        return {
          content: `File content for: ${path} (format: ${format})`,
          mimeType: format === 'json' ? 'application/json' : 'text/plain'
        };
      });
  }

  /**
   * Database template with table and format parameters
   */
  static databaseTemplate(id: string, name: string, description: string): TemplateBuilder {
    return new TemplateBuilder(id)
      .name(name)
      .description(description)
      .enumParameter('table', ['users', 'orders', 'products'], 'Database table', true)
      .enumParameter('format', ['json', 'csv', 'xml'], 'Output format')
      .numberParameter('limit', 'Maximum number of records', 1, 1000, 100)
      .numberParameter('offset', 'Record offset for pagination', 0, undefined, 0)
      .json(async (params) => {
        const { table, limit, offset } = params;
        return {
          content: JSON.stringify({
            table,
            records: `${limit} records from ${table} starting at ${offset}`,
            format: 'json'
          }, null, 2)
        };
      })
      .format('csv', 'text/csv', async (params) => {
        const { table, limit, offset } = params;
        return {
          content: `table,limit,offset\n${table},${limit},${offset}`
        };
      })
      .xml(async (params) => {
        const { table, limit, offset } = params;
        return {
          content: `<?xml version="1.0"?>\n<query table="${table}" limit="${limit}" offset="${offset}"/>`
        };
      });
  }

  /**
   * API documentation template
   */
  static apiDocsTemplate(id: string, name: string, description: string): TemplateBuilder {
    return new TemplateBuilder(id)
      .name(name)
      .description(description)
      .enumParameter('version', ['v1', 'v2', 'latest'], 'API version')
      .enumParameter('format', ['openapi', 'markdown', 'html'], 'Documentation format')
      .enumParameter('section', ['overview', 'endpoints', 'schemas'], 'Documentation section')
      .format('openapi', 'application/json', async (params) => {
        return {
          content: JSON.stringify({
            openapi: '3.0.0',
            info: { title: 'API', version: params.version },
            section: params.section
          }, null, 2)
        };
      })
      .markdown(async (params) => {
        return {
          content: `# API Documentation (${params.version})\n\n## ${params.section}\n\nDocumentation content here...`
        };
      })
      .html(async (params) => {
        return {
          content: `<html><head><title>API ${params.version}</title></head><body><h1>${params.section}</h1></body></html>`
        };
      });
  }
}

/**
 * Registry Helper for Easy Template Registration
 */
export class TemplateRegistry {
  private templates: Map<string, { config: TemplateConfig; provider: any }> = new Map();

  /**
   * Register a template
   */
  register(template: TemplateBuilder): this {
    const { config, provider } = template.build();
    this.templates.set(config.id, { config, provider });
    return this;
  }

  /**
   * Register multiple templates
   */
  registerMany(...templates: TemplateBuilder[]): this {
    templates.forEach(template => this.register(template));
    return this;
  }

  /**
   * Get all template configurations (for MCP resource registration)
   */
  getAllConfigs(): TemplateConfig[] {
    return Array.from(this.templates.values()).map(t => t.config);
  }

  /**
   * Get provider for a specific template
   */
  getProvider(id: string): any {
    return this.templates.get(id)?.provider;
  }

  /**
   * Get template configuration
   */
  getConfig(id: string): TemplateConfig | undefined {
    return this.templates.get(id)?.config;
  }

  /**
   * Apply all templates to an MCP resource registry
   */
  applyTo(mcpRegistry: any): void {
    for (const [id, { config, provider }] of this.templates) {
      // Register resource
      mcpRegistry.registerResource({
        id: config.id,
        name: config.name,
        description: config.description,
        mimeType: config.mimeType || 'text/plain',
        category: config.category || 'custom',
        requireAuth: config.requireAuth || false,
        builtin: false
      });

      // Register provider
      mcpRegistry.registerProvider(config.id, {
        generateContent: provider
      });

      // Register template for URI template support
      if (config.uriTemplate) {
        mcpRegistry.registerTemplate(config.id, {
          template: `Dynamic template for ${config.name}`,
          uriTemplate: config.uriTemplate,
          parameters: config.parameters
        });
      }
    }
  }
}

// Export convenience function
export function createTemplate(id: string): TemplateBuilder {
  return new TemplateBuilder(id);
}