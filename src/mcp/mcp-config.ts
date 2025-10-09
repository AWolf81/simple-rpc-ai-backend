/**
 * MCP Configuration Interface
 * Allows customization of prompts and resources in Simple RPC AI Backend
 */

import { MCPPrompt, MCPPromptTemplate } from './default-prompts';
import { MCPResource, MCPResourceHandler } from './default-resources';

export interface MCPPromptsConfig {
  /**
   * Custom prompts to add
   */
  customPrompts?: MCPPrompt[];

  /**
   * Custom prompt templates for prompts/get
   */
  customTemplates?: Record<string, MCPPromptTemplate>;
}

export interface MCPResourceTemplate {
  name: string;
  description: string;
  uriTemplate: string;
  arguments: {
    name: string;
    description: string;
    required: boolean;
  }[];
  mimeType: string;
}

export interface MCPResourcesConfig {
  /**
   * Custom resources to add
   */
  customResources?: MCPResource[];

  /**
   * Custom resource handlers for resources/read
   */
  customHandlers?: Record<string, MCPResourceHandler>;

  /**
   * Custom resource templates for parameterized resources
   */
  customTemplates?: MCPResourceTemplate[];

  /**
   * Custom template handlers for resource template execution
   */
  templateHandlers?: Record<string, (args: any) => any>;
}

export interface MCPExtensionConfig {
  /**
   * Prompts configuration
   */
  prompts?: MCPPromptsConfig;

  /**
   * Resources configuration
   */
  resources?: MCPResourcesConfig;
}

/**
 * MCP Extension Manager
 * Handles merging of default and custom prompts/resources
 */
export class MCPExtensionManager {
  private promptsConfig: MCPPromptsConfig;
  private resourcesConfig: MCPResourcesConfig;

  constructor(config: MCPExtensionConfig = {}) {
    this.promptsConfig = {
      customPrompts: [],
      customTemplates: {},
      ...config.prompts
    };

    this.resourcesConfig = {
      customResources: [],
      customHandlers: {},
      customTemplates: [],
      templateHandlers: {},
      ...config.resources
    };
  }

  /**
   * Get merged prompts list
   */
  getPrompts(defaultPrompts: MCPPrompt[]): MCPPrompt[] {
    // Only include custom prompts - no defaults
    return this.promptsConfig.customPrompts || [];
  }

  /**
   * Get merged prompt templates
   */
  getPromptTemplates(defaultTemplates: Record<string, MCPPromptTemplate>): Record<string, MCPPromptTemplate> {
    // Only include custom templates - no defaults
    return this.promptsConfig.customTemplates || {};
  }

  /**
   * Get merged resources list
   */
  getResources(defaultResources: MCPResource[]): MCPResource[] {
    // Only include custom resources - no defaults
    return this.resourcesConfig.customResources || [];
  }

  /**
   * Get merged resource handlers
   */
  getResourceHandlers(defaultHandlers: Record<string, MCPResourceHandler>): Record<string, MCPResourceHandler> {
    // Only include custom handlers - no defaults
    return this.resourcesConfig.customHandlers || {};
  }

  /**
   * Get merged resource templates list
   */
  getResourceTemplates(defaultTemplates: MCPResourceTemplate[] = []): MCPResourceTemplate[] {
    // Only include custom templates - no defaults
    return this.resourcesConfig.customTemplates || [];
  }

  /**
   * Get merged resource template handlers
   */
  getResourceTemplateHandlers(defaultHandlers: Record<string, (args: any) => any> = {}): Record<string, (args: any) => any> {
    // Only include custom template handlers - no defaults
    return this.resourcesConfig.templateHandlers || {};
  }
}