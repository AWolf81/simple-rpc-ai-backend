/**
 * MCP Helper Functions for Simplified Configuration
 * Provides easy-to-use abstractions for MCP server setup
 */

import { MCPExtensionConfig, MCPPromptsConfig, MCPResourcesConfig } from './mcp-config';
import { MCPPrompt, MCPPromptTemplate } from './default-prompts';
import { MCPResource, MCPResourceHandler } from './default-resources';

// Global handler registry for reusable handlers
export const GlobalHandlers = {
  resources: new Map<string, MCPResourceHandler>(),
  templates: new Map<string, (args: any) => any>(),
  prompts: new Map<string, MCPPromptTemplate>()
};

/**
 * Resource Template with Handler
 */
export interface MCPResourceTemplateWithHandler {
  name: string;
  description: string;
  uriTemplate: string;
  arguments: {
    name: string;
    description: string;
    required: boolean;
  }[];
  mimeType: string;
  handler: (args: any) => any;
}

/**
 * Simplified MCP Configuration Builder
 */
export class MCPConfigBuilder {
  private config: MCPExtensionConfig = {};

  /**
   * Add a static resource with handler
   */
  addResource(uri: string, name: string, description: string, handler: MCPResourceHandler, mimeType = 'application/json'): MCPConfigBuilder {
    if (!this.config.resources) {
      this.config.resources = { customResources: [], customHandlers: {} };
    }

    // Add resource definition
    this.config.resources.customResources = this.config.resources.customResources || [];
    this.config.resources.customResources.push({
      uri,
      name,
      description,
      mimeType
    });

    // Add resource handler
    this.config.resources.customHandlers = this.config.resources.customHandlers || {};
    const resourceName = uri.replace(/^file:\/\//, '').replace(/^https?:\/\/[^\/]+\//, '');
    this.config.resources.customHandlers[resourceName] = handler;

    return this;
  }

  /**
   * Add a resource template with handler
   */
  addResourceTemplate(template: MCPResourceTemplateWithHandler): MCPConfigBuilder {
    if (!this.config.resources) {
      this.config.resources = { customTemplates: [], templateHandlers: {} };
    }

    // Add template definition
    this.config.resources.customTemplates = this.config.resources.customTemplates || [];
    this.config.resources.customTemplates.push({
      name: template.name,
      description: template.description,
      uriTemplate: template.uriTemplate,
      arguments: template.arguments,
      mimeType: template.mimeType
    });

    // Add template handler
    this.config.resources.templateHandlers = this.config.resources.templateHandlers || {};
    this.config.resources.templateHandlers[template.name] = template.handler;

    return this;
  }

  /**
   * Add a prompt with template
   */
  addPrompt(name: string, description: string, template: MCPPromptTemplate, arguments_?: any[]): MCPConfigBuilder {
    if (!this.config.prompts) {
      this.config.prompts = { customPrompts: [], customTemplates: {} };
    }

    // Add prompt definition
    this.config.prompts.customPrompts = this.config.prompts.customPrompts || [];
    this.config.prompts.customPrompts.push({
      name,
      description,
      arguments: arguments_ || []
    });

    // Add prompt template
    this.config.prompts.customTemplates = this.config.prompts.customTemplates || {};
    this.config.prompts.customTemplates[name] = template;

    return this;
  }

  /**
   * Use a global handler for resource templates
   */
  useGlobalHandler(handlerName: string, templateName: string): MCPConfigBuilder {
    const handler = GlobalHandlers.templates.get(handlerName);
    if (!handler) {
      throw new Error(`Global handler '${handlerName}' not found. Register it first with registerGlobalHandler()`);
    }

    if (!this.config.resources) {
      this.config.resources = { templateHandlers: {} };
    }

    this.config.resources.templateHandlers = this.config.resources.templateHandlers || {};
    this.config.resources.templateHandlers[templateName] = handler;

    return this;
  }

  /**
   * Configure defaults
   */
  defaults(includePrompts = true, includeResources = true): MCPConfigBuilder {
    if (!this.config.prompts) this.config.prompts = {};
    if (!this.config.resources) this.config.resources = {};

    // includeDefaults removed - only custom prompts/resources are supported now
    // Users should explicitly add prompts/resources they want via customPrompts/customResources

    return this;
  }

  /**
   * Build the final configuration
   */
  build(): MCPExtensionConfig {
    return this.config;
  }
}

/**
 * Register a global handler that can be reused across templates
 */
export function registerGlobalHandler(name: string, handler: (args: any) => any): void {
  GlobalHandlers.templates.set(name, handler);
}

/**
 * Register a global resource handler
 */
export function registerGlobalResourceHandler(name: string, handler: MCPResourceHandler): void {
  GlobalHandlers.resources.set(name, handler);
}

/**
 * Register a global prompt template
 */
export function registerGlobalPromptTemplate(name: string, template: MCPPromptTemplate): void {
  GlobalHandlers.prompts.set(name, template);
}

/**
 * Create a new MCP configuration builder
 */
export function createMCPConfig(): MCPConfigBuilder {
  return new MCPConfigBuilder();
}

/**
 * Built-in global handlers
 */

// File reader handler
registerGlobalHandler('file-reader', async (args: any) => {
  const { filePath, encoding = 'utf8' } = args;
  const { promises: fs } = await import('fs');
  const path = await import('path');

  try {
    const currentDir = process.cwd();
    const safePath = path.resolve(currentDir, filePath);

    if (!safePath.startsWith(currentDir)) {
      throw new Error('Access denied: Path outside of allowed directory');
    }

    await fs.access(safePath);
    const content = await fs.readFile(safePath, encoding);
    const stats = await fs.stat(safePath);

    return {
      filePath: safePath,
      size: content.length,
      encoding,
      content,
      lastModified: stats.mtime.toISOString()
    };
  } catch (error: any) {
    return {
      error: `Failed to read file: ${error.message}`,
      filePath: filePath,
      encoding
    };
  }
});

// Directory listing handler
registerGlobalHandler('directory-list', async (args: any) => {
  const { dirPath = '.', includeHidden = false } = args;
  const { promises: fs } = await import('fs');
  const path = await import('path');

  try {
    const currentDir = process.cwd();
    const safePath = path.resolve(currentDir, dirPath);

    if (!safePath.startsWith(currentDir)) {
      throw new Error('Access denied: Path outside of allowed directory');
    }

    const entries = await fs.readdir(safePath, { withFileTypes: true });
    const files = [];

    for (const entry of entries) {
      if (!includeHidden && entry.name.startsWith('.')) continue;

      const stats = await fs.stat(path.join(safePath, entry.name));
      files.push({
        name: entry.name,
        type: entry.isDirectory() ? 'directory' : 'file',
        size: stats.size,
        lastModified: stats.mtime.toISOString()
      });
    }

    return {
      directory: safePath,
      files: files.sort((a, b) => a.name.localeCompare(b.name))
    };
  } catch (error: any) {
    return {
      error: `Failed to list directory: ${error.message}`,
      directory: dirPath
    };
  }
});

// User profile generator
registerGlobalHandler('user-profile', (args: any) => {
  const { userId, includePrivate = false } = args;
  return {
    userId,
    name: `User ${userId}`,
    email: `user${userId}@company.com`,
    department: 'Engineering',
    role: 'Developer',
    lastLogin: new Date().toISOString(),
    ...(includePrivate && {
      salary: 75000,
      socialSecurity: '***-**-1234',
      address: '123 Main St, City, State'
    })
  };
});

// Configuration generator
registerGlobalHandler('config-generator', (args: any) => {
  const { environment, service, format = 'yml' } = args;
  const config = {
    service: {
      name: service,
      environment,
      replicas: environment === 'production' ? 3 : 1,
      resources: {
        cpu: environment === 'production' ? '500m' : '100m',
        memory: environment === 'production' ? '1Gi' : '256Mi'
      },
      database: {
        host: `${service}-db-${environment}.company.com`,
        port: 5432,
        ssl: environment === 'production'
      }
    }
  };

  if (format === 'json') {
    return JSON.stringify(config, null, 2);
  } else if (format === 'env') {
    return `SERVICE_NAME=${service}\nENVIRONMENT=${environment}\nREPLICAS=${config.service.replicas}`;
  }

  // Default YAML format
  return `service:
  name: ${service}
  environment: ${environment}
  replicas: ${config.service.replicas}
  resources:
    cpu: ${config.service.resources.cpu}
    memory: ${config.service.resources.memory}
  database:
    host: ${config.service.database.host}
    port: ${config.service.database.port}
    ssl: ${config.service.database.ssl}`;
});

/**
 * Sampling and Elicitation Support
 */

export interface SamplingRequest {
  id: string;
  prompt: string;
  options?: {
    temperature?: number;
    max_tokens?: number;
    model?: string;
  };
  metadata?: any;
}

export interface ElicitationRequest {
  id: string;
  question: string;
  options?: string[];
  defaultOption?: string;
  metadata?: any;
}

export interface SamplingResponse {
  id: string;
  approved: boolean;
  result?: string;
  error?: string;
}

export interface ElicitationResponse {
  id: string;
  response: string;
  metadata?: any;
}

// Global storage for pending requests
export const PendingRequests = {
  sampling: new Map<string, SamplingRequest>(),
  elicitation: new Map<string, ElicitationRequest>()
};

/**
 * Create a sampling request
 */
export function createSamplingRequest(prompt: string, options?: SamplingRequest['options'], metadata?: any): string {
  const id = `sampling-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const request: SamplingRequest = {
    id,
    prompt,
    options,
    metadata
  };

  PendingRequests.sampling.set(id, request);
  return id;
}

/**
 * Create an elicitation request
 */
export function createElicitationRequest(question: string, options?: string[], defaultOption?: string, metadata?: any): string {
  const id = `elicitation-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const request: ElicitationRequest = {
    id,
    question,
    options,
    defaultOption,
    metadata
  };

  PendingRequests.elicitation.set(id, request);
  return id;
}

/**
 * Get pending sampling requests
 */
export function getPendingSamplingRequests(): SamplingRequest[] {
  return Array.from(PendingRequests.sampling.values());
}

/**
 * Get pending elicitation requests
 */
export function getPendingElicitationRequests(): ElicitationRequest[] {
  return Array.from(PendingRequests.elicitation.values());
}

/**
 * Respond to a sampling request
 */
export function respondToSampling(id: string, approved: boolean, result?: string, error?: string): boolean {
  const request = PendingRequests.sampling.get(id);
  if (!request) return false;

  PendingRequests.sampling.delete(id);

  // In a real implementation, this would notify the original requester
  console.log(`📤 Sampling response for ${id}:`, { approved, result, error });

  return true;
}

/**
 * Respond to an elicitation request
 */
export function respondToElicitation(id: string, response: string, metadata?: any): boolean {
  const request = PendingRequests.elicitation.get(id);
  if (!request) return false;

  PendingRequests.elicitation.delete(id);

  // In a real implementation, this would notify the original requester
  console.log(`📤 Elicitation response for ${id}:`, { response, metadata });

  return true;
}