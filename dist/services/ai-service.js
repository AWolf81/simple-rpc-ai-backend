/**
 * AI Service using Vercel AI SDK
 *
 * Simple wrapper around Vercel AI SDK for RPC backend services.
 * Handles multiple providers (Anthropic, OpenAI, Google, etc.) seamlessly.
 */
import { generateText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { openai } from '@ai-sdk/openai';
import { google } from '@ai-sdk/google';
import crypto from 'crypto';
function normalizeServiceProviders(spConfig) {
    if (!spConfig)
        return [];
    if (Array.isArray(spConfig)) {
        return spConfig;
    }
    const providers = [];
    if (spConfig.anthropic) {
        providers.push({
            name: 'anthropic',
            apiKey: spConfig.anthropic.apiKey ?? '',
            priority: spConfig.anthropic.priority ?? 0,
            model: spConfig.anthropic.model,
            maxTokens: spConfig.anthropic.maxTokens,
            temperature: spConfig.anthropic.temperature,
        });
    }
    if (spConfig.openai) {
        providers.push({
            name: 'openai',
            apiKey: spConfig.openai.apiKey ?? '',
            priority: spConfig.openai.priority ?? 0,
            model: spConfig.openai.model,
            maxTokens: spConfig.openai.maxTokens,
            temperature: spConfig.openai.temperature,
        });
    }
    if (spConfig.google) {
        providers.push({
            name: 'google',
            apiKey: spConfig.google.apiKey ?? '',
            priority: spConfig.google.priority ?? 0,
            model: spConfig.google.model,
            maxTokens: spConfig.google.maxTokens,
            temperature: spConfig.google.temperature,
        });
    }
    return providers;
}
/**
 * Simple AI service using Vercel AI SDK
 */
export class AIService {
    config;
    providers = [];
    constructor(config) {
        if (config.serviceProviders) {
            this.providers = normalizeServiceProviders(config.serviceProviders);
            if (this.providers.length === 0) {
                throw new Error('No valid AI service providers configured.');
            }
            // If providers came from an array, assign priority by array index:
            if (Array.isArray(config.serviceProviders)) {
                const serviceProvidersArray = config.serviceProviders;
                this.providers.forEach((p) => {
                    p.priority = serviceProvidersArray.findIndex(sp => sp.name === p.name);
                });
            }
            // Sort by priority descending (higher first)
            this.providers.sort((a, b) => b.priority - a.priority);
        }
        else {
            throw new Error('No AI service providers configured. Please set ANTHROPIC_API_KEY environment variable or configure serviceProviders.');
        }
        this.config = config;
        // Use explicit defaultProvider or fall back to highest-priority provider
        this.config.provider = config.defaultProvider || this.providers[0]?.name;
    }
    /**
     * Execute AI request with system prompt using Vercel AI SDK
     */
    async execute(request) {
        const { content, systemPrompt, metadata = {}, options = {} } = request;
        // Debug logging
        console.log('🔍 AI Execute Debug:');
        console.log(`   System Prompt: ${systemPrompt ? `"${systemPrompt.substring(0, 100)}..."` : 'MISSING'}`);
        console.log(`   User Content: ${content ? `"${content.substring(0, 100)}..."` : 'MISSING'}`);
        console.log(`   Provider: ${this.config.provider}`);
        // Get the AI model provider
        const model = this.getModel(options.model);
        // Create the user prompt from content
        const userPrompt = content;
        try {
            const result = await generateText({
                model,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                maxTokens: options.maxTokens || this.config.maxTokens || 4000,
                temperature: options.temperature || this.config.temperature || 0.3,
            });
            return {
                content: result.text,
                usage: {
                    promptTokens: result.usage.promptTokens,
                    completionTokens: result.usage.completionTokens,
                    totalTokens: result.usage.totalTokens
                },
                model: model.modelId,
                provider: this.config.provider,
                requestId: crypto.randomUUID(),
                finishReason: result.finishReason
            };
        }
        catch (error) {
            throw new Error(`AI execution failed: ${error.message}`);
        }
    }
    getModel(modelOverride) {
        const modelName = modelOverride || this.config.model || this.getDefaultModel();
        const models = {
            anthropic: (name) => anthropic.messages(name),
            openai: (name) => openai.chat(name),
            google: (name) => google.generativeAI(name)
        };
        const getModelFn = models[this.config.provider];
        if (getModelFn === undefined) {
            throw new Error(`Unsupported AI provider: ${this.config.provider}`);
        }
        return getModelFn(modelName);
    }
    getDefaultModel() {
        switch (this.config.provider) {
            case 'anthropic':
                return 'claude-3-5-sonnet-20241022';
            case 'openai':
                return 'gpt-4o';
            case 'google':
                return 'gemini-1.5-pro';
            default:
                return 'unknown-model';
        }
    }
    getLanguageFromFileName(fileName) {
        const ext = fileName.split('.').pop()?.toLowerCase() || '';
        const languageMap = {
            'js': 'javascript',
            'ts': 'typescript',
            'jsx': 'javascript',
            'tsx': 'typescript',
            'py': 'python',
            'java': 'java',
            'cs': 'csharp',
            'go': 'go',
            'rs': 'rust',
            'cpp': 'cpp',
            'c': 'c',
            'php': 'php',
            'rb': 'ruby',
            'swift': 'swift',
            'kt': 'kotlin'
        };
        return languageMap[ext] || ext;
    }
    /**
     * Test AI service connectivity
     */
    async testConnection() {
        try {
            const testResponse = await this.execute({
                content: 'console.log("test");',
                systemPrompt: 'Briefly analyze this code in one sentence.',
                metadata: { name: 'test.js' },
                options: { maxTokens: 50 }
            });
            return {
                connected: true,
                provider: this.config.provider ?? 'unknown',
                model: testResponse.model
            };
        }
        catch (error) {
            return {
                connected: false,
                provider: this.config.provider ?? 'unknown',
                model: this.getDefaultModel(),
                error: error.message
            };
        }
    }
    /**
     * Get available models for current provider
     */
    getAvailableModels() {
        switch (this.config.provider) {
            case 'anthropic':
                return [
                    'claude-3-5-sonnet-20241022',
                    'claude-3-5-haiku-20241022',
                    'claude-3-opus-20240229'
                ];
            case 'openai':
                return [
                    'gpt-4o',
                    'gpt-4o-mini',
                    'gpt-4-turbo',
                    'gpt-3.5-turbo'
                ];
            case 'google':
                return [
                    'gemini-1.5-pro',
                    'gemini-1.5-flash',
                    'gemini-1.0-pro'
                ];
            default:
                return [];
        }
    }
    /**
     * Get current configuration (without API key)
     */
    getConfig() {
        return {
            provider: this.config.provider,
            model: this.config.model || this.getDefaultModel(),
            maxTokens: this.config.maxTokens,
            temperature: this.config.temperature,
            availableModels: this.getAvailableModels()
        };
    }
}
export default AIService;
//# sourceMappingURL=ai-service.js.map