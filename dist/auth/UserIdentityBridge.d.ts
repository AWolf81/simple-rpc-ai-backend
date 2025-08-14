/**
 * User Identity Bridge
 *
 * Maps OpenSaaS user identities to Vaultwarden users for secure API key storage
 * Handles the bridge between billing/auth system and secret management system
 */
import { BitwardenConfig } from './BitwardenCLI.js';
import * as winston from 'winston';
export interface UserIdentityMapping {
    opensaasUserId: string;
    email: string;
    vaultwardenUserId: string;
    subscriptionTier: string;
    organizationId?: string;
    createdAt: Date;
    lastSync: Date;
    isActive: boolean;
}
export interface OpenSaaSJWTPayload {
    userId: string;
    email: string;
    organizationId?: string;
    subscriptionTier: string;
    monthlyTokenQuota: number;
    rpmLimit: number;
    tpmLimit: number;
    features: string[];
    iat: number;
    exp: number;
    iss: string;
    aud: string;
}
export declare class UserIdentityBridge {
    private config;
    private logger;
    private mappings;
    private bitwarden?;
    constructor(config: BitwardenConfig, logger?: winston.Logger);
    /**
     * Initialize connection to Vaultwarden
     */
    initialize(): Promise<void>;
    /**
     * Get or create user mapping from OpenSaaS JWT payload
     */
    getUserMapping(jwtPayload: OpenSaaSJWTPayload): Promise<UserIdentityMapping>;
    /**
     * Generate stable Vaultwarden user ID
     * Options: use email, UUID, or deterministic hash
     */
    private generateVaultwardenUserId;
    /**
     * Ensure user exists in Vaultwarden system
     */
    private ensureVaultwardenUser;
    /**
     * Get Vaultwarden user ID from OpenSaaS user ID
     */
    getVaultwardenUserId(opensaasUserId: string): Promise<string | null>;
    /**
     * Get user's subscription tier for quota enforcement
     */
    getUserTier(opensaasUserId: string): Promise<string | null>;
    /**
     * Validate JWT and extract user info
     */
    validateJWT(token: string): OpenSaaSJWTPayload;
    /**
     * Clean up resources
     */
    cleanup(): Promise<void>;
    /**
     * Get all active mappings (for debugging/admin)
     */
    getAllMappings(): UserIdentityMapping[];
    /**
     * Health check
     */
    healthCheck(): Promise<{
        status: 'healthy' | 'unhealthy';
        details: any;
    }>;
}
export default UserIdentityBridge;
//# sourceMappingURL=UserIdentityBridge.d.ts.map