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
export declare class MCPExtensionManager {
    private promptsConfig;
    private resourcesConfig;
    constructor(config?: MCPExtensionConfig);
    /**
     * Get merged prompts list
     */
    getPrompts(defaultPrompts: MCPPrompt[]): MCPPrompt[];
    /**
     * Get merged prompt templates
     */
    getPromptTemplates(defaultTemplates: Record<string, MCPPromptTemplate>): Record<string, MCPPromptTemplate>;
    /**
     * Get merged resources list
     */
    getResources(defaultResources: MCPResource[]): MCPResource[];
    /**
     * Get merged resource handlers
     */
    getResourceHandlers(defaultHandlers: Record<string, MCPResourceHandler>): Record<string, MCPResourceHandler>;
    /**
     * Get merged resource templates list
     */
    getResourceTemplates(defaultTemplates?: MCPResourceTemplate[]): MCPResourceTemplate[];
    /**
     * Get merged resource template handlers
     */
    getResourceTemplateHandlers(defaultHandlers?: Record<string, (args: any) => any>): Record<string, (args: any) => any>;
}
//# sourceMappingURL=mcp-config.d.ts.map