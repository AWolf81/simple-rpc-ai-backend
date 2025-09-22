/**
 * Shared types and configurations for AI router
 */
// Predefined configurations for common use cases
// ⚠️ IMPORTANT: These are suggested defaults. Always validate against:
//   - Your AI provider's token limits (Claude: 200k, GPT-4: 8k-128k, Gemini: 1M)
//   - Your cost budget and usage patterns
//   - Your application's specific requirements
export const AI_LIMIT_PRESETS = {
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
export const DEFAULT_CONFIG = {
    content: {
        maxLength: AI_LIMIT_PRESETS.standard.content.maxLength,
        minLength: AI_LIMIT_PRESETS.standard.content.minLength,
    },
    tokens: {
        defaultMaxTokens: AI_LIMIT_PRESETS.standard.tokens.defaultMaxTokens,
        maxTokenLimit: AI_LIMIT_PRESETS.standard.tokens.maxTokenLimit,
        minTokens: AI_LIMIT_PRESETS.standard.tokens.minTokens,
    },
    systemPrompt: {
        maxLength: AI_LIMIT_PRESETS.standard.systemPrompt.maxLength,
        minLength: AI_LIMIT_PRESETS.standard.systemPrompt.minLength,
    },
};
// Helper to create service providers config from MCP provider configuration
export function createMCPServiceProvidersConfig(mcpProviders) {
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
export function createServiceProvidersConfig(providers) {
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
        }
        config[provider] = {
            priority: index + 1,
            ...(apiKey && { apiKey })
        };
    });
    return config;
}
