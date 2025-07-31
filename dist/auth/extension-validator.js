/**
 * Extension Validator Service
 *
 * Validates VS Code extension authenticity through:
 * - Cryptographic signature verification
 * - VS Code Marketplace API validation (optional)
 * - Publisher and extension ID whitelisting
 */
import { createVerify } from 'crypto';
import axios from 'axios';
export class ExtensionValidator {
    config;
    constructor(config) {
        this.config = {
            marketplaceTimeout: 5000,
            ...config
        };
        if (!this.config.publicKeyPem) {
            throw new Error('Public key PEM is required for extension validation');
        }
    }
    /**
     * Validate extension authentication with signature verification
     */
    async validateExtension(extensionId, version, nonce, signature) {
        // 1. Parse extension ID
        const extensionInfo = this.parseExtensionId(extensionId);
        if (!extensionInfo) {
            return {
                isValid: false,
                reason: 'Invalid extension ID format. Expected: publisher.extension-name'
            };
        }
        // 2. Check whitelist
        const whitelistResult = this.checkWhitelist(extensionInfo);
        if (!whitelistResult.isValid) {
            return whitelistResult;
        }
        // 3. Verify cryptographic signature
        const signatureValid = this.verifySignature(nonce, signature);
        if (!signatureValid) {
            return {
                isValid: false,
                reason: 'Invalid cryptographic signature'
            };
        }
        // 4. Optional: Verify with VS Code Marketplace
        let marketplaceVerified = false;
        if (!this.config.disableMarketplaceCheck) {
            try {
                marketplaceVerified = await this.verifyWithMarketplace(extensionInfo, version);
                if (!marketplaceVerified) {
                    return {
                        isValid: false,
                        reason: 'Extension not found or invalid in VS Code Marketplace',
                        extensionInfo
                    };
                }
            }
            catch (error) {
                console.warn(`⚠️ Marketplace verification failed: ${error.message}`);
                // Continue without marketplace verification in case of API issues
            }
        }
        return {
            isValid: true,
            extensionInfo,
            marketplaceVerified
        };
    }
    /**
     * Parse extension ID into components
     */
    parseExtensionId(extensionId) {
        const match = extensionId.match(/^([a-zA-Z0-9-_]+)\.([a-zA-Z0-9-_]+)$/);
        if (!match) {
            return null;
        }
        return {
            extensionId,
            publisherName: match[1],
            extensionName: match[2],
            version: '' // Will be set later
        };
    }
    /**
     * Check extension against whitelist
     */
    checkWhitelist(extensionInfo) {
        // Check publisher whitelist
        if (this.config.allowedPublishers && this.config.allowedPublishers.length > 0) {
            const publisherAllowed = this.config.allowedPublishers.includes(extensionInfo.publisherName);
            if (!publisherAllowed) {
                return {
                    isValid: false,
                    reason: `Publisher '${extensionInfo.publisherName}' not in allowed publishers list`,
                    extensionInfo
                };
            }
        }
        // Check extension whitelist with pattern matching
        if (this.config.allowedExtensions && this.config.allowedExtensions.length > 0) {
            const extensionAllowed = this.config.allowedExtensions.some(pattern => {
                // Convert glob patterns to regex
                if (pattern.includes('*')) {
                    const regexPattern = pattern
                        .replace(/\./g, '\\.')
                        .replace(/\*/g, '.*');
                    return new RegExp(`^${regexPattern}$`).test(extensionInfo.extensionId);
                }
                return pattern === extensionInfo.extensionId;
            });
            if (!extensionAllowed) {
                return {
                    isValid: false,
                    reason: `Extension '${extensionInfo.extensionId}' not in allowed extensions list`,
                    extensionInfo
                };
            }
        }
        return { isValid: true, extensionInfo };
    }
    /**
     * Verify cryptographic signature using public key
     */
    verifySignature(nonce, signature) {
        try {
            const verifier = createVerify('SHA256');
            verifier.update(nonce);
            verifier.end();
            const signatureBuffer = Buffer.from(signature, 'base64');
            return verifier.verify(this.config.publicKeyPem, signatureBuffer);
        }
        catch (error) {
            console.warn(`⚠️ Signature verification error: ${error.message}`);
            return false;
        }
    }
    /**
     * Verify extension with VS Code Marketplace API
     */
    async verifyWithMarketplace(extensionInfo, version) {
        try {
            const marketplaceUrl = 'https://marketplace.visualstudio.com/_apis/public/gallery/extensionquery';
            const requestBody = {
                filters: [{
                        criteria: [{
                                filterType: 7,
                                value: extensionInfo.extensionId
                            }],
                        pageNumber: 1,
                        pageSize: 1,
                        sortBy: 0,
                        sortOrder: 0
                    }],
                assetTypes: [],
                flags: 914
            };
            const response = await axios.post(marketplaceUrl, requestBody, {
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json;api-version=3.0-preview.1',
                    'User-Agent': 'simple-rpc-ai-backend/1.0.0'
                },
                timeout: this.config.marketplaceTimeout
            });
            if (response.data?.results?.[0]?.extensions?.length > 0) {
                const extension = response.data.results[0].extensions[0];
                // Verify publisher and extension name match
                const publisherMatch = extension.publisher?.publisherName === extensionInfo.publisherName;
                const nameMatch = extension.extensionName === extensionInfo.extensionName;
                if (publisherMatch && nameMatch) {
                    // Optional: Verify specific version exists
                    if (version) {
                        const versionExists = extension.versions?.some((v) => v.version === version);
                        return versionExists;
                    }
                    return true;
                }
            }
            return false;
        }
        catch (error) {
            console.warn(`⚠️ Marketplace API error: ${error.message}`);
            throw error; // Re-throw to allow caller to handle
        }
    }
    /**
     * Get extension information from marketplace (for debugging)
     */
    async getExtensionInfo(extensionId) {
        if (this.config.disableMarketplaceCheck) {
            return null;
        }
        const extensionInfo = this.parseExtensionId(extensionId);
        if (!extensionInfo) {
            return null;
        }
        try {
            const marketplaceUrl = 'https://marketplace.visualstudio.com/_apis/public/gallery/extensionquery';
            const requestBody = {
                filters: [{
                        criteria: [{
                                filterType: 7,
                                value: extensionId
                            }],
                        pageNumber: 1,
                        pageSize: 1,
                        sortBy: 0,
                        sortOrder: 0
                    }],
                assetTypes: [],
                flags: 914
            };
            const response = await axios.post(marketplaceUrl, requestBody, {
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json;api-version=3.0-preview.1',
                    'User-Agent': 'simple-rpc-ai-backend/1.0.0'
                },
                timeout: this.config.marketplaceTimeout
            });
            return response.data?.results?.[0]?.extensions?.[0] || null;
        }
        catch (error) {
            console.warn(`⚠️ Failed to get extension info: ${error.message}`);
            return null;
        }
    }
    /**
     * Test signature verification with sample data (for setup validation)
     */
    testSignatureVerification(testNonce, testSignature) {
        return this.verifySignature(testNonce, testSignature);
    }
    /**
     * Validate configuration
     */
    validateConfig() {
        const errors = [];
        if (!this.config.publicKeyPem) {
            errors.push('Public key PEM is required');
        }
        else {
            // Test if public key is valid PEM format
            try {
                const testVerifier = createVerify('SHA256');
                testVerifier.update('test');
                testVerifier.end();
                // This will throw if PEM is invalid
                testVerifier.verify(this.config.publicKeyPem, Buffer.from('test', 'base64'));
            }
            catch (error) {
                if (!error.message.includes('bad signature')) {
                    errors.push(`Invalid public key PEM format: ${error.message}`);
                }
            }
        }
        if (this.config.allowedExtensions) {
            for (const pattern of this.config.allowedExtensions) {
                if (!pattern.includes('.')) {
                    errors.push(`Invalid extension pattern '${pattern}': must include publisher name`);
                }
            }
        }
        return {
            isValid: errors.length === 0,
            errors
        };
    }
}
//# sourceMappingURL=extension-validator.js.map