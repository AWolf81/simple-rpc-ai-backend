"use strict";
/**
 * AI Provider Key Validator
 *
 * Validates API keys by making test calls to AI providers
 * Supports Anthropic, OpenAI, and Google AI
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AIKeyValidator = void 0;
class AIKeyValidator {
    constructor(config = {}) {
        this.config = {
            timeout: 10000, // 10 seconds
            retries: 2,
            testPrompt: 'Hello, this is a test. Please respond with just "OK".',
            maxTokens: 10,
            ...config
        };
    }
    /**
     * Validate API key by making a test call to the provider
     */
    async validateKey(provider, apiKey) {
        if (!apiKey || apiKey.trim().length === 0) {
            return {
                isValid: false,
                error: 'API key is empty',
                provider
            };
        }
        try {
            switch (provider) {
                case 'anthropic':
                    return await this.validateAnthropicKey(apiKey);
                case 'openai':
                    return await this.validateOpenAIKey(apiKey);
                case 'google':
                    return await this.validateGoogleKey(apiKey);
                default:
                    return {
                        isValid: false,
                        error: `Unsupported provider: ${provider}`,
                        provider
                    };
            }
        }
        catch (error) {
            return {
                isValid: false,
                error: error.message || 'Validation failed',
                provider
            };
        }
    }
    /**
     * Validate Anthropic API key
     */
    async validateAnthropicKey(apiKey) {
        if (!apiKey.startsWith('sk-ant-')) {
            return {
                isValid: false,
                error: 'Invalid Anthropic API key format (should start with sk-ant-)',
                provider: 'anthropic'
            };
        }
        try {
            const response = await this.makeHTTPRequest('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': apiKey,
                    'anthropic-version': '2023-06-01'
                },
                body: JSON.stringify({
                    model: 'claude-3-haiku-20240307',
                    max_tokens: this.config.maxTokens,
                    messages: [{
                            role: 'user',
                            content: this.config.testPrompt
                        }]
                })
            });
            if (response.ok) {
                const data = await response.json();
                return {
                    isValid: true,
                    provider: 'anthropic',
                    model: data.model || 'claude-3-haiku-20240307'
                };
            }
            else {
                const errorData = await response.json().catch(() => ({}));
                return {
                    isValid: false,
                    error: errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`,
                    provider: 'anthropic'
                };
            }
        }
        catch (error) {
            return {
                isValid: false,
                error: this.parseNetworkError(error),
                provider: 'anthropic'
            };
        }
    }
    /**
     * Validate OpenAI API key
     */
    async validateOpenAIKey(apiKey) {
        if (!apiKey.startsWith('sk-')) {
            return {
                isValid: false,
                error: 'Invalid OpenAI API key format (should start with sk-)',
                provider: 'openai'
            };
        }
        try {
            const response = await this.makeHTTPRequest('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: 'gpt-3.5-turbo',
                    messages: [{
                            role: 'user',
                            content: this.config.testPrompt
                        }],
                    max_tokens: this.config.maxTokens,
                    temperature: 0
                })
            });
            if (response.ok) {
                const data = await response.json();
                return {
                    isValid: true,
                    provider: 'openai',
                    model: data.model || 'gpt-3.5-turbo'
                };
            }
            else {
                const errorData = await response.json().catch(() => ({}));
                return {
                    isValid: false,
                    error: errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`,
                    provider: 'openai'
                };
            }
        }
        catch (error) {
            return {
                isValid: false,
                error: this.parseNetworkError(error),
                provider: 'openai'
            };
        }
    }
    /**
     * Validate Google AI API key
     */
    async validateGoogleKey(apiKey) {
        try {
            const response = await this.makeHTTPRequest(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    contents: [{
                            parts: [{
                                    text: this.config.testPrompt
                                }]
                        }],
                    generationConfig: {
                        maxOutputTokens: this.config.maxTokens,
                        temperature: 0
                    }
                })
            });
            if (response.ok) {
                const data = await response.json();
                return {
                    isValid: true,
                    provider: 'google',
                    model: 'gemini-pro'
                };
            }
            else {
                const errorData = await response.json().catch(() => ({}));
                return {
                    isValid: false,
                    error: errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`,
                    provider: 'google'
                };
            }
        }
        catch (error) {
            return {
                isValid: false,
                error: this.parseNetworkError(error),
                provider: 'google'
            };
        }
    }
    /**
     * Make HTTP request with timeout and retries
     */
    async makeHTTPRequest(url, options) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);
        try {
            const response = await fetch(url, {
                ...options,
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            return response;
        }
        catch (error) {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') {
                throw new Error(`Request timeout after ${this.config.timeout}ms`);
            }
            throw error;
        }
    }
    /**
     * Parse network errors into user-friendly messages
     */
    parseNetworkError(error) {
        if (error.code === 'ENOTFOUND') {
            return 'Network error: Unable to reach AI provider. Check your internet connection.';
        }
        if (error.code === 'ECONNREFUSED') {
            return 'Network error: Connection refused by AI provider.';
        }
        if (error.code === 'ETIMEDOUT') {
            return 'Network error: Request timed out.';
        }
        if (error.name === 'AbortError') {
            return 'Request timeout: AI provider took too long to respond.';
        }
        if (error.message) {
            return error.message;
        }
        return 'Unknown validation error occurred.';
    }
    /**
     * Validate multiple keys in parallel
     */
    async validateMultipleKeys(keys) {
        const validationPromises = keys.map(({ provider, apiKey }) => this.validateKey(provider, apiKey));
        return await Promise.all(validationPromises);
    }
    /**
     * Check if provider is supported
     */
    isProviderSupported(provider) {
        return ['anthropic', 'openai', 'google'].includes(provider);
    }
    /**
     * Get expected API key format for provider
     */
    getKeyFormat(provider) {
        switch (provider) {
            case 'anthropic':
                return 'sk-ant-...';
            case 'openai':
                return 'sk-...';
            case 'google':
                return 'AI...';
            default:
                return 'Unknown format';
        }
    }
    /**
     * Get provider documentation URL
     */
    getProviderDocsUrl(provider) {
        switch (provider) {
            case 'anthropic':
                return 'https://docs.anthropic.com/claude/reference/getting-started-with-the-api';
            case 'openai':
                return 'https://platform.openai.com/docs/quickstart';
            case 'google':
                return 'https://ai.google.dev/docs';
            default:
                return '';
        }
    }
}
exports.AIKeyValidator = AIKeyValidator;
//# sourceMappingURL=ai-validator.js.map