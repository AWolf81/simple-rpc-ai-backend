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
    getPrompts(defaultPrompts) {
        let prompts = [];
        // Add defaults if enabled
        if (this.promptsConfig.includeDefaults) {
            prompts = defaultPrompts.filter(p => !this.promptsConfig.excludeDefaults?.includes(p.name));
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
    getPromptTemplates(defaultTemplates) {
        let templates = {};
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
    getResources(defaultResources) {
        let resources = [];
        // Add defaults if enabled
        if (this.resourcesConfig.includeDefaults) {
            resources = defaultResources.filter(r => !this.resourcesConfig.excludeDefaults?.includes(r.uri));
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
    getResourceHandlers(defaultHandlers) {
        let handlers = {};
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
