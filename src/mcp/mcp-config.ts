/**
 * MCP Configuration Interface
 * Allows customization of prompts and resources in Simple RPC AI Backend
 */

import { MCPPrompt, MCPPromptTemplate } from './default-prompts.js';
import { MCPResource, MCPResourceHandler } from './default-resources.js';

export interface MCPPromptsConfig {
  /**
   * Whether to include default prompts
   * @default true
   */
  includeDefaults?: boolean;

  /**
   * Custom prompts to add (merged with defaults if includeDefaults is true)
   */
  customPrompts?: MCPPrompt[];

  /**
   * Custom prompt templates for prompts/get
   */
  customTemplates?: Record<string, MCPPromptTemplate>;

  /**
   * Prompts to exclude from defaults (by name)
   */
  excludeDefaults?: string[];
}

export interface MCPResourcesConfig {
  /**
   * Whether to include default resources
   * @default true
   */
  includeDefaults?: boolean;

  /**
   * Custom resources to add (merged with defaults if includeDefaults is true)
   */
  customResources?: MCPResource[];

  /**
   * Custom resource handlers for resources/read
   */
  customHandlers?: Record<string, MCPResourceHandler>;

  /**
   * Resources to exclude from defaults (by URI)
   */
  excludeDefaults?: string[];
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
      includeDefaults: true,
      customPrompts: [],
      customTemplates: {},
      excludeDefaults: [],
      ...config.prompts
    };

    this.resourcesConfig = {
      includeDefaults: true,
      customResources: [],
      customHandlers: {},
      excludeDefaults: [],
      ...config.resources
    };
  }

  /**
   * Get merged prompts list
   */
  getPrompts(defaultPrompts: MCPPrompt[]): MCPPrompt[] {
    let prompts: MCPPrompt[] = [];

    // Add defaults if enabled
    if (this.promptsConfig.includeDefaults) {
      prompts = defaultPrompts.filter(p => 
        !this.promptsConfig.excludeDefaults?.includes(p.name)
      );
    }

    // Add custom prompts
    if (this.promptsConfig.customPrompts) {
      prompts = [...prompts, ...this.promptsConfig.customPrompts];
    }

    return prompts;
  }

  /**
   * Get merged prompt templates
   */
  getPromptTemplates(defaultTemplates: Record<string, MCPPromptTemplate>): Record<string, MCPPromptTemplate> {
    let templates: Record<string, MCPPromptTemplate> = {};

    // Add defaults if enabled
    if (this.promptsConfig.includeDefaults) {
      templates = { ...defaultTemplates };
      
      // Remove excluded defaults
      this.promptsConfig.excludeDefaults?.forEach(name => {
        delete templates[name];
      });
    }

    // Add custom templates
    if (this.promptsConfig.customTemplates) {
      templates = { ...templates, ...this.promptsConfig.customTemplates };
    }

    return templates;
  }

  /**
   * Get merged resources list
   */
  getResources(defaultResources: MCPResource[]): MCPResource[] {
    let resources: MCPResource[] = [];

    // Add defaults if enabled
    if (this.resourcesConfig.includeDefaults) {
      resources = defaultResources.filter(r => 
        !this.resourcesConfig.excludeDefaults?.includes(r.uri)
      );
    }

    // Add custom resources
    if (this.resourcesConfig.customResources) {
      resources = [...resources, ...this.resourcesConfig.customResources];
    }

    return resources;
  }

  /**
   * Get merged resource handlers
   */
  getResourceHandlers(defaultHandlers: Record<string, MCPResourceHandler>): Record<string, MCPResourceHandler> {
    let handlers: Record<string, MCPResourceHandler> = {};

    // Add defaults if enabled
    if (this.resourcesConfig.includeDefaults) {
      handlers = { ...defaultHandlers };
      
      // Remove excluded defaults (by resource name from URI)
      this.resourcesConfig.excludeDefaults?.forEach(uri => {
        const resourceName = uri.replace('file://', '');
        delete handlers[resourceName];
      });
    }

    // Add custom handlers
    if (this.resourcesConfig.customHandlers) {
      handlers = { ...handlers, ...this.resourcesConfig.customHandlers };
    }

    return handlers;
  }
}