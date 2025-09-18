/**
 * Model Registry Safety Configuration
 *
 * Defines safety levels for different environments to prevent
 * financial and operational risks from external model registries.
 */
export const ModelSafetySettings = {
    // Production safety - conservative approach
    production: {
        useRegistry: false, // Use cached/validated data only
        allowPriceUpdates: false, // Never auto-update pricing in production
        requireManualApproval: true, // All changes need approval
        maxPriceChange: 0.1, // 10% max price change
        validationInterval: 24 * 60 * 60 * 1000, // Check daily
        fallbackToStatic: true, // Always have fallback
        validationMode: 'strict',
    },
    // Development default - flexible for easy setup
    development: {
        useRegistry: true, // Live registry data for latest models
        allowPriceUpdates: true, // Can use live pricing for testing
        requireManualApproval: false, // No approval needed in dev
        maxPriceChange: 2.0, // More lenient for testing (200%)
        validationInterval: 60 * 60 * 1000, // Check hourly in dev
        fallbackToStatic: true, // Still have fallback for reliability
        validationMode: 'warn',
    },
    // Test environment - most predictable
    test: {
        useRegistry: false, // Use static data for predictable tests
        allowPriceUpdates: false, // No external calls in tests
        requireManualApproval: false,
        maxPriceChange: 10.0, // Very lenient for test scenarios
        validationInterval: Infinity, // Never auto-update in tests
        fallbackToStatic: true, // Always use fallback
        validationMode: 'off',
    }
};
/**
 * Get safety configuration based on environment
 */
export function getModelSafetyConfig() {
    const env = process.env.NODE_ENV || 'development';
    const mode = process.env.MODEL_REGISTRY_MODE;
    // Allow explicit mode override
    if (mode === 'production') {
        return ModelSafetySettings.production;
    }
    if (mode === 'development') {
        return ModelSafetySettings.development;
    }
    // Default to development settings for ease of use
    switch (env) {
        case 'production':
            return ModelSafetySettings.production;
        case 'test':
            return ModelSafetySettings.test;
        case 'development':
        default:
            return ModelSafetySettings.development;
    }
}
/**
 * Override safety settings (for enterprise deployments)
 */
export function createCustomSafetyConfig(overrides) {
    const base = getModelSafetyConfig();
    return { ...base, ...overrides };
}
/**
 * Validation helpers
 */
export class ModelValidator {
    static validateModelData(models) {
        const errors = [];
        for (const model of models) {
            // Required fields check
            if (!model.id && !model.name) {
                errors.push(`Model missing required id/name: ${JSON.stringify(model)}`);
                continue;
            }
            // Price sanity checks
            if (model.pricing) {
                if (model.pricing.input > 50 || model.pricing.input < 0.001) {
                    errors.push(`Suspicious input pricing for ${model.id || model.name}: ${model.pricing.input}`);
                }
                if (model.pricing.output > 100 || model.pricing.output < 0.001) {
                    errors.push(`Suspicious output pricing for ${model.id || model.name}: ${model.pricing.output}`);
                }
            }
        }
        return { valid: errors.length === 0, errors };
    }
    static validatePriceChange(oldPrice, newPrice, maxChange) {
        if (!oldPrice || !newPrice)
            return true; // Skip validation if no pricing data
        const changeRatio = Math.abs(newPrice - oldPrice) / oldPrice;
        return changeRatio <= maxChange;
    }
}
