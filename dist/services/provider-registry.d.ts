/**
 * Provider Registry Service
 *
 * Integrates with @anolilab/ai-model-registry to provide curated AI provider information
 * filtered to only the providers configured in serviceProviders and byokProviders.
 */
export interface ProviderConfig {
    name: string;
    displayName: string;
    models: ModelConfig[];
    priority: number;
    isServiceProvider: boolean;
    isByokProvider: boolean;
    pricing?: PricingInfo;
    metadata?: {
        description?: string;
        website?: string;
        apiKeyRequired: boolean;
        supportedFeatures: string[];
    };
}
export interface ModelConfig {
    id: string;
    name: string;
    description?: string;
    contextLength: number;
    inputCostPer1k?: number;
    outputCostPer1k?: number;
    capabilities: string[];
}
export interface PricingInfo {
    input: number;
    output: number;
    inputCacheHit?: number;
    currency: string;
    lastUpdated: string;
}
export interface PricingOverride {
    provider: string;
    model?: string;
    pricing: Partial<PricingInfo>;
    reason: string;
    appliedAt: string;
}
export declare class ProviderRegistryService {
    private serviceProviders;
    private byokProviders;
    private pricingOverrides;
    private lastRegistryUpdate;
    constructor(serviceProviders?: string[], byokProviders?: string[]);
    /**
     * Get filtered providers based on configuration
     */
    getConfiguredProviders(type?: 'service' | 'byok' | 'all'): Promise<ProviderConfig[]>;
    /**
     * Get models for a specific provider
     */
    private getProviderModels;
    /**
     * Get display name for provider
     */
    private getProviderDisplayName;
    /**
     * Get fallback models when registry is unavailable
     */
    private getFallbackModels;
    /**
     * Calculate provider priority (service providers get higher priority)
     */
    private calculatePriority;
    /**
     * Add pricing override for incorrect registry data
     */
    addPricingOverride(override: Omit<PricingOverride, 'appliedAt'>): void;
    /**
     * Get overridden price if available
     */
    private getOverriddenPrice;
    /**
     * Fallback providers when registry is unavailable
     */
    private getFallbackProviders;
    /**
     * Check for pricing changes and warn
     */
    checkForPricingChanges(): Promise<{
        hasChanges: boolean;
        changes: string[];
    }>;
    /**
     * Update configuration
     */
    updateConfiguration(serviceProviders: string[], byokProviders: string[]): void;
}
//# sourceMappingURL=provider-registry.d.ts.map