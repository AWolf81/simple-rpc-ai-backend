/**
 * Vaultwarden Organization Validator
 *
 * Validates organization access during server startup
 */
import * as winston from 'winston';
export interface VaultwardenConfig {
    serverUrl: string;
    clientId: string;
    clientSecret: string;
    masterPassword: string;
    organizationId: string;
    serviceEmail: string;
}
export declare class VaultwardenOrgValidator {
    private logger;
    constructor(logger?: winston.Logger);
    /**
     * Validate Vaultwarden organization access during server startup
     */
    validateOrganizationAccess(config: VaultwardenConfig): Promise<{
        isValid: boolean;
        organizationName?: string;
        error?: string;
    }>;
    /**
     * Auto-setup guidance if validation fails
     */
    provideSetupGuidance(config: VaultwardenConfig): Promise<void>;
    /**
     * Get organization configuration from environment
     */
    static getConfigFromEnv(): VaultwardenConfig;
}
export default VaultwardenOrgValidator;
//# sourceMappingURL=VaultwardenOrgValidator.d.ts.map