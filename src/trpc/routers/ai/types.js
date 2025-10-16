"use strict";
/**
 * Shared types and configurations for AI router
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_CONFIG = exports.AI_LIMIT_PRESETS = void 0;
exports.createMCPServiceProvidersConfig = createMCPServiceProvidersConfig;
exports.createServiceProvidersConfig = createServiceProvidersConfig;
// Predefined configurations for common use cases
// ⚠️ IMPORTANT: These are suggested defaults. Always validate against:
//   - Your AI provider's token limits (Claude: 200k, GPT-4: 8k-128k, Gemini: 1M)
//   - Your cost budget and usage patterns
//   - Your application's specific requirements
exports.AI_LIMIT_PRESETS = {
    // Conservative limits for production environments
    conservative: {
        content: { maxLength: 100_000, minLength: 1 }, // 100KB (~20k words)
        tokens: {
            defaultMaxTokens: 2048,
            maxTokenLimit: 8_192,
            minTokens: 1
        },
        systemPrompt: { maxLength: 10_000, minLength: 1 } // 10KB system prompts
    },
    // Balanced limits for most applications
    standard: {
        content: { maxLength: 500_000, minLength: 1 }, // 500KB (~100k words)
        tokens: {
            defaultMaxTokens: 4096,
            maxTokenLimit: 32_000,
            minTokens: 1
        },
        systemPrompt: { maxLength: 25_000, minLength: 1 } // 25KB system prompts
    },
    // Generous limits for development and large documents
    generous: {
        content: { maxLength: 2_000_000, minLength: 1 }, // 2MB (~400k words)
        tokens: {
            defaultMaxTokens: 8192,
            maxTokenLimit: 100_000,
            minTokens: 1
        },
        systemPrompt: { maxLength: 50_000, minLength: 1 } // 50KB system prompts
    },
    // Maximum limits for specialized use cases
    maximum: {
        content: { maxLength: 10_000_000, minLength: 1 }, // 10MB (~2M words)
        tokens: {
            defaultMaxTokens: 16384,
            maxTokenLimit: 1_000_000,
            minTokens: 1
        },
        systemPrompt: { maxLength: 100_000, minLength: 1 } // 100KB system prompts
    },
};
// Default configuration (same as standard)
exports.DEFAULT_CONFIG = {
    content: {
        maxLength: exports.AI_LIMIT_PRESETS.standard.content.maxLength,
        minLength: exports.AI_LIMIT_PRESETS.standard.content.minLength,
    },
    tokens: {
        defaultMaxTokens: exports.AI_LIMIT_PRESETS.standard.tokens.defaultMaxTokens,
        maxTokenLimit: exports.AI_LIMIT_PRESETS.standard.tokens.maxTokenLimit,
        minTokens: exports.AI_LIMIT_PRESETS.standard.tokens.minTokens,
    },
    systemPrompt: {
        maxLength: exports.AI_LIMIT_PRESETS.standard.systemPrompt.maxLength,
        minLength: exports.AI_LIMIT_PRESETS.standard.systemPrompt.minLength,
    },
};
// Helper to create service providers config from MCP provider configuration
function createMCPServiceProvidersConfig(mcpProviders) {
    const config = {};
    let defaultPriority = 1;
    Object.entries(mcpProviders).forEach(([provider, settings]) => {
        if (settings.enabled !== false) {
            config[provider] = {
                priority: settings.priority || defaultPriority++,
                apiKey: settings.apiKey
            };
        }
    });
    return config;
}
// Helper to create service providers config from array
function createServiceProvidersConfig(providers) {
    const config = {};
    providers.forEach((provider, index) => {
        // Get API key from environment variables for built-in providers
        let apiKey;
        switch (provider) {
            case 'anthropic':
                apiKey = process.env.ANTHROPIC_API_KEY;
                break;
            case 'openai':
                apiKey = process.env.OPENAI_API_KEY;
                break;
            case 'google':
                apiKey = process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
                break;
            case 'openrouter':
                apiKey = process.env.OPENROUTER_API_KEY;
                break;
            case 'huggingface':
                apiKey = process.env.HUGGINGFACE_API_KEY;
                break;
        }
        config[provider] = {
            priority: index + 1,
            ...(apiKey && { apiKey })
        };
    });
    return config;
}
//# sourceMappingURL=types.js.map