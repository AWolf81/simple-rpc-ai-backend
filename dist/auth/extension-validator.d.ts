/**
 * Extension Validator Service
 *
 * Validates VS Code extension authenticity through:
 * - Cryptographic signature verification
 * - VS Code Marketplace API validation (optional)
 * - Publisher and extension ID whitelisting
 */
export interface ExtensionValidationConfig {
    publicKeyPem: string;
    allowedExtensions?: string[];
    allowedPublishers?: string[];
    disableMarketplaceCheck?: boolean;
    marketplaceTimeout?: number;
}
export interface ExtensionInfo {
    extensionId: string;
    publisherName: string;
    extensionName: string;
    version: string;
}
export interface ValidationResult {
    isValid: boolean;
    reason?: string;
    extensionInfo?: ExtensionInfo;
    marketplaceVerified?: boolean;
}
export declare class ExtensionValidator {
    private config;
    constructor(config: ExtensionValidationConfig);
    /**
     * Validate extension authentication with signature verification
     */
    validateExtension(extensionId: string, version: string, nonce: string, signature: string): Promise<ValidationResult>;
    /**
     * Parse extension ID into components
     */
    private parseExtensionId;
    /**
     * Check extension against whitelist
     */
    private checkWhitelist;
    /**
     * Verify cryptographic signature using public key
     */
    private verifySignature;
    /**
     * Verify extension with VS Code Marketplace API
     */
    private verifyWithMarketplace;
    /**
     * Get extension information from marketplace (for debugging)
     */
    getExtensionInfo(extensionId: string): Promise<any>;
    /**
     * Test signature verification with sample data (for setup validation)
     */
    testSignatureVerification(testNonce: string, testSignature: string): boolean;
    /**
     * Validate configuration
     */
    validateConfig(): {
        isValid: boolean;
        errors: string[];
    };
}
//# sourceMappingURL=extension-validator.d.ts.map