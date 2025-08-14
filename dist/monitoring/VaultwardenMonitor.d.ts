/**
 * Vaultwarden Health Monitoring
 *
 * Comprehensive health monitoring for Vaultwarden infrastructure
 * Monitors API connectivity, database health, and service availability
 */
import { VaultwardenSecretManager } from '../services/VaultwardenSecretManager.js';
import { APITokenManager } from '../services/APITokenManager.js';
import { VaultwardenConfig } from '../config/vaultwarden.js';
import * as winston from 'winston';
export interface HealthCheckResult {
    status: 'healthy' | 'degraded' | 'unhealthy';
    checks: Record<string, any>;
    timestamp: string;
    overallScore: number;
}
export interface ComponentHealth {
    status: 'healthy' | 'degraded' | 'unhealthy';
    responseTime?: number;
    error?: string;
    details?: any;
    lastChecked: string;
}
export declare class VaultwardenMonitor {
    private config;
    private secretManager?;
    private tokenManager?;
    private logger;
    private healthCache;
    private readonly CACHE_TTL;
    constructor(config: VaultwardenConfig, secretManager?: VaultwardenSecretManager, tokenManager?: APITokenManager | undefined, logger?: winston.Logger);
    /**
     * Perform comprehensive health check
     */
    performHealthCheck(): Promise<HealthCheckResult>;
    /**
     * Check Vaultwarden API connectivity
     */
    private checkVaultwardenAPI;
    /**
     * Check PostgreSQL database health
     */
    private checkDatabaseHealth;
    /**
     * Check Redis connectivity
     */
    private checkRedisHealth;
    /**
     * Check Secret Manager health
     */
    private checkSecretManager;
    /**
     * Check Token Manager health
     */
    private checkTokenManager;
    /**
     * Get cached health result if still valid
     */
    private getCachedHealth;
    /**
     * Cache health result
     */
    private setCachedHealth;
    /**
     * Convert health status to numeric score
     */
    private getHealthScore;
    /**
     * Determine overall status from individual checks
     */
    private determineOverallStatus;
    /**
     * Get metrics for monitoring systems
     */
    getMetrics(): Promise<{
        vaultwarden_up: number;
        database_up: number;
        redis_up: number;
        secret_manager_up: number;
        overall_health_score: number;
        response_times: Record<string, number>;
    }>;
    /**
     * Clear health cache (force fresh checks)
     */
    clearCache(): void;
}
//# sourceMappingURL=VaultwardenMonitor.d.ts.map