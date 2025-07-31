/**
 * AI Provider Key Validator
 *
 * Validates API keys by making test calls to AI providers
 * Supports Anthropic, OpenAI, and Google AI
 */
import { AIProviderValidator, KeyValidationResult } from '../auth/key-manager.js';
export interface ValidationConfig {
    timeout: number;
    retries: number;
    testPrompt: string;
    maxTokens: number;
}
export declare class AIKeyValidator implements AIProviderValidator {
    private config;
    constructor(config?: Partial<ValidationConfig>);
    /**
     * Validate API key by making a test call to the provider
     */
    validateKey(provider: string, apiKey: string): Promise<KeyValidationResult>;
    /**
     * Validate Anthropic API key
     */
    private validateAnthropicKey;
    /**
     * Validate OpenAI API key
     */
    private validateOpenAIKey;
    /**
     * Validate Google AI API key
     */
    private validateGoogleKey;
    /**
     * Make HTTP request with timeout and retries
     */
    private makeHTTPRequest;
    /**
     * Parse network errors into user-friendly messages
     */
    private parseNetworkError;
    /**
     * Validate multiple keys in parallel
     */
    validateMultipleKeys(keys: {
        provider: string;
        apiKey: string;
    }[]): Promise<KeyValidationResult[]>;
    /**
     * Check if provider is supported
     */
    isProviderSupported(provider: string): boolean;
    /**
     * Get expected API key format for provider
     */
    getKeyFormat(provider: string): string;
    /**
     * Get provider documentation URL
     */
    getProviderDocsUrl(provider: string): string;
}
//# sourceMappingURL=ai-validator.d.ts.map