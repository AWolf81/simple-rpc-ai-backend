/**
 * Infisical Secret Manager
 *
 * Multi-tenant API key storage using Infisical
 * Provides proper user isolation with per-user projects
 * Replaces TokenBasedVaultManager with true multi-tenancy
 */
import * as winston from 'winston';
export interface InfisicalConfig {
    baseUrl: string;
    adminEmail: string;
    adminPassword: string;
    organizationName: string;
    enableSignup?: boolean;
}
export interface UserProjectInfo {
    userId: string;
    email: string;
    projectId: string;
    projectSlug: string;
    workspaceKey: string;
    createdAt: Date;
    lastUsedAt: Date;
}
export interface SecretOperationResult {
    success: boolean;
    secretId?: string;
    secretKey?: string;
    error?: string;
}
export interface HealthStatus {
    status: 'healthy' | 'unhealthy';
    message: string;
    details: {
        infisicalConnected: boolean;
        totalProjects: number;
        totalSecrets: number;
        lastCheck: Date;
    };
}
/**
 * Infisical Secret Manager with Multi-Tenant User Isolation
 */
export declare class InfisicalSecretManager {
    private config;
    private logger;
    private apiClient;
    private adminToken;
    private userProjects;
    private organizationId;
    constructor(config: InfisicalConfig, logger?: winston.Logger);
    /**
     * Initialize the Infisical Secret Manager
     */
    initialize(): Promise<void>;
    /**
     * Provision a new user with their own isolated project
     */
    provisionUser(userId: string, email: string): Promise<UserProjectInfo>;
    /**
     * Store a secret for a specific user in their isolated project
     */
    storeUserSecret(userId: string, secretKey: string, secretValue: string, description?: string): Promise<SecretOperationResult>;
    /**
     * Retrieve a secret for a specific user from their isolated project
     */
    getUserSecret(userId: string, secretKey: string): Promise<SecretOperationResult>;
    /**
     * Delete a user's secret from their isolated project
     */
    deleteUserSecret(userId: string, secretKey: string): Promise<SecretOperationResult>;
    /**
     * Get health status of the secret manager
     */
    getHealthStatus(): Promise<HealthStatus>;
    /**
     * Clean up resources
     */
    cleanup(): Promise<void>;
    private checkConnection;
    private authenticateAdmin;
    private createAdminUser;
    private ensureOrganization;
    private createInfisicalUser;
    private createUserProject;
    private addUserToProject;
    private createProjectSecret;
    private getProjectSecret;
    private deleteProjectSecret;
    private listProjectSecrets;
}
//# sourceMappingURL=InfisicalSecretManager.d.ts.map