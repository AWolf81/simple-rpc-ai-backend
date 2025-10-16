/**
 * MCP Configuration Interface
 * Allows customization of prompts and resources in Simple RPC AI Backend
 */
/**
 * MCP Extension Manager
 * Handles merging of default and custom prompts/resources
 */
export class MCPExtensionManager {
    promptsConfig;
    resourcesConfig;
    constructor(config = {}) {
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
    getPrompts(defaultPrompts) {
        // Only include custom prompts - no defaults
        return this.promptsConfig.customPrompts || [];
    }
    /**
     * Get merged prompt templates
     */
    getPromptTemplates(defaultTemplates) {
        // Only include custom templates - no defaults
        return this.promptsConfig.customTemplates || {};
    }
    /**
     * Get merged resources list
     */
    getResources(defaultResources) {
        // Only include custom resources - no defaults
        return this.resourcesConfig.customResources || [];
    }
    /**
     * Get merged resource handlers
     */
    getResourceHandlers(defaultHandlers) {
        // Only include custom handlers - no defaults
        return this.resourcesConfig.customHandlers || {};
    }
    /**
     * Get merged resource templates list
     */
    getResourceTemplates(defaultTemplates = []) {
        // Only include custom templates - no defaults
        return this.resourcesConfig.customTemplates || [];
    }
    /**
     * Get merged resource template handlers
     */
    getResourceTemplateHandlers(defaultHandlers = {}) {
        // Only include custom template handlers - no defaults
        return this.resourcesConfig.templateHandlers || {};
    }
}
//# sourceMappingURL=mcp-config.js.map