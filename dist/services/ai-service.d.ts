/**
 * AI Service using Vercel AI SDK
 *
 * Simple wrapper around Vercel AI SDK for RPC backend services.
 * Handles multiple providers (Anthropic, OpenAI, Google, etc.) seamlessly.
 */
export interface AIServiceConfig {
    provider?: 'anthropic' | 'openai' | 'google';
    defaultProvider?: 'anthropic' | 'openai' | 'google';
    serviceProviders?: ServiceProvidersConfig;
    apiKey?: string;
    model?: string;
    maxTokens?: number;
    temperature?: number;
}
export interface ExecuteRequest {
    content: string;
    systemPrompt: string;
    metadata?: {
        name?: string;
        type?: string;
        [key: string]: any;
    };
    options?: {
        model?: string;
        maxTokens?: number;
        temperature?: number;
    };
}
export interface ExecuteResult {
    content: string;
    usage: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
    model: string;
    finishReason?: string;
}
interface ServiceProvider {
    name: 'anthropic' | 'openai' | 'google';
    apiKey: string;
    priority: number;
    model?: string;
    maxTokens?: number;
    temperature?: number;
}
export type ServiceProvidersConfig = {
    anthropic?: Partial<Omit<ServiceProvider, 'name' | 'priority'>> & {
        priority?: number;
    };
    openai?: Partial<Omit<ServiceProvider, 'name' | 'priority'>> & {
        priority?: number;
    };
    google?: Partial<Omit<ServiceProvider, 'name' | 'priority'>> & {
        priority?: number;
    };
} | ServiceProvider[];
/**
 * Simple AI service using Vercel AI SDK
 */
export declare class AIService {
    private config;
    private providers;
    constructor(config: AIServiceConfig);
    /**
     * Execute AI request with system prompt using Vercel AI SDK
     */
    execute(request: ExecuteRequest): Promise<ExecuteResult>;
    private getModel;
    private getDefaultModel;
    private getLanguageFromFileName;
    /**
     * Test AI service connectivity
     */
    testConnection(): Promise<{
        connected: boolean;
        provider: string;
        model: string;
        error?: string;
    }>;
    /**
     * Get available models for current provider
     */
    getAvailableModels(): string[];
    /**
     * Get current configuration (without API key)
     */
    getConfig(): {
        provider: "google" | "anthropic" | "openai" | undefined;
        model: string;
        maxTokens: number | undefined;
        temperature: number | undefined;
        availableModels: string[];
    };
}
export default AIService;
//# sourceMappingURL=ai-service.d.ts.map