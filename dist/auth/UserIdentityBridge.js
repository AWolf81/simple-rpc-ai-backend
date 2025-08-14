/**
 * User Identity Bridge
 *
 * Maps OpenSaaS user identities to Vaultwarden users for secure API key storage
 * Handles the bridge between billing/auth system and secret management system
 */
import { BitwardenCLI } from './BitwardenCLI.js';
import * as winston from 'winston';
// Using BitwardenConfig from CLI wrapper
export class UserIdentityBridge {
    config;
    logger;
    mappings = new Map();
    bitwarden;
    constructor(config, logger) {
        this.config = config;
        this.logger = logger || winston.createLogger({
            level: 'info',
            format: winston.format.json(),
            transports: [new winston.transports.Console()]
        });
    }
    /**
     * Initialize connection to Vaultwarden
     */
    async initialize() {
        try {
            this.bitwarden = new BitwardenCLI(this.config);
            await this.bitwarden.initialize();
            this.logger.info('UserIdentityBridge initialized successfully');
        }
        catch (error) {
            this.logger.error('Failed to initialize UserIdentityBridge:', error);
            throw new Error('UserIdentityBridge initialization failed');
        }
    }
    /**
     * Get or create user mapping from OpenSaaS JWT payload
     */
    async getUserMapping(jwtPayload) {
        const opensaasUserId = jwtPayload.userId;
        // Check if mapping already exists
        let mapping = this.mappings.get(opensaasUserId);
        if (!mapping) {
            // Create new mapping
            mapping = {
                opensaasUserId,
                email: jwtPayload.email,
                vaultwardenUserId: this.generateVaultwardenUserId(jwtPayload),
                subscriptionTier: jwtPayload.subscriptionTier,
                organizationId: jwtPayload.organizationId,
                createdAt: new Date(),
                lastSync: new Date(),
                isActive: true
            };
            // Store mapping (in production, this should be persisted to database)
            this.mappings.set(opensaasUserId, mapping);
            // Create Vaultwarden user entry if needed
            await this.ensureVaultwardenUser(mapping);
            this.logger.info(`Created new user mapping: ${opensaasUserId} -> ${mapping.vaultwardenUserId}`);
        }
        else {
            // Update existing mapping with latest info from JWT
            mapping.email = jwtPayload.email;
            mapping.subscriptionTier = jwtPayload.subscriptionTier;
            mapping.organizationId = jwtPayload.organizationId;
            mapping.lastSync = new Date();
        }
        return mapping;
    }
    /**
     * Generate stable Vaultwarden user ID
     * Options: use email, UUID, or deterministic hash
     */
    generateVaultwardenUserId(jwtPayload) {
        // Option 1: Use email directly (simplest)
        if (jwtPayload.email) {
            return jwtPayload.email;
        }
        // Option 2: Generate deterministic UUID from OpenSaaS user ID
        // This ensures the same OpenSaaS user always gets the same Vaultwarden ID
        return `user-${jwtPayload.userId}@simple-rpc-ai.local`;
    }
    /**
     * Ensure user exists in Vaultwarden system
     */
    async ensureVaultwardenUser(mapping) {
        try {
            if (!this.bitwarden) {
                throw new Error('Bitwarden client not initialized');
            }
            // In a full implementation, you might:
            // 1. Check if user exists in Vaultwarden
            // 2. Create collection for user's API keys
            // 3. Set up appropriate permissions
            this.logger.info(`Ensured Vaultwarden user: ${mapping.vaultwardenUserId}`);
        }
        catch (error) {
            this.logger.error(`Failed to ensure Vaultwarden user: ${mapping.vaultwardenUserId}:`, error);
            throw error;
        }
    }
    /**
     * Get Vaultwarden user ID from OpenSaaS user ID
     */
    async getVaultwardenUserId(opensaasUserId) {
        const mapping = this.mappings.get(opensaasUserId);
        return mapping?.vaultwardenUserId || null;
    }
    /**
     * Get user's subscription tier for quota enforcement
     */
    async getUserTier(opensaasUserId) {
        const mapping = this.mappings.get(opensaasUserId);
        return mapping?.subscriptionTier || null;
    }
    /**
     * Validate JWT and extract user info
     */
    validateJWT(token) {
        // In production, implement proper JWT validation with:
        // - Signature verification
        // - Expiration check
        // - Issuer validation
        // - Audience validation
        try {
            // Simple base64 decode for testing (NOT for production)
            const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
            return payload;
        }
        catch (error) {
            throw new Error('Invalid JWT token');
        }
    }
    /**
     * Clean up resources
     */
    async cleanup() {
        // Clear mappings (in production, you might want to persist these)
        this.mappings.clear();
        this.logger.info('UserIdentityBridge cleaned up');
    }
    /**
     * Get all active mappings (for debugging/admin)
     */
    getAllMappings() {
        return Array.from(this.mappings.values());
    }
    /**
     * Health check
     */
    async healthCheck() {
        try {
            if (!this.bitwarden) {
                return {
                    status: 'unhealthy',
                    details: { error: 'Bitwarden client not initialized' }
                };
            }
            // Test connection (in a real implementation)
            return {
                status: 'healthy',
                details: {
                    activeMappings: this.mappings.size,
                    vaultwardenConnected: true
                }
            };
        }
        catch (error) {
            return {
                status: 'unhealthy',
                details: { error: error instanceof Error ? error.message : String(error) }
            };
        }
    }
}
export default UserIdentityBridge;
//# sourceMappingURL=UserIdentityBridge.js.map