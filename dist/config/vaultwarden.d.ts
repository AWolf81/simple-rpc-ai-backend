/**
 * Vaultwarden Configuration
 *
 * Configuration for Vaultwarden secret management integration
 */
export interface VaultwardenConfig {
    serverUrl: string;
    serviceEmail: string;
    servicePassword: string;
    organizationId: string;
    adminToken?: string;
    database: {
        host: string;
        port: number;
        database: string;
        username: string;
        password: string;
    };
    redis: {
        host: string;
        port: number;
        password?: string;
    };
    apiTokens: {
        enabled: boolean;
        defaultLimit: number;
        requiresPro: boolean;
        maxTokensPerUser: number;
    };
}
export interface ExternalAccessConfig {
    enabled: boolean;
    allowedOrigins: string[];
    requireDeviceAuth: boolean;
    rateLimits: {
        requestsPerHour: number;
        keysPerUser: number;
    };
    allowedMethods: ('get' | 'store' | 'delete' | 'list' | 'rotate')[];
}
export declare function loadVaultwardenConfig(): VaultwardenConfig;
export declare function loadExternalAccessConfig(): ExternalAccessConfig;
export declare function validateVaultwardenConfig(config: VaultwardenConfig): void;
export declare const defaultVaultwardenConfig: Partial<VaultwardenConfig>;
export declare const vaultwardenConfig: VaultwardenConfig;
//# sourceMappingURL=vaultwarden.d.ts.map