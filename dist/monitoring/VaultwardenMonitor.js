/**
 * Vaultwarden Health Monitoring
 *
 * Comprehensive health monitoring for Vaultwarden infrastructure
 * Monitors API connectivity, database health, and service availability
 */
import { Client } from 'pg';
import Redis from 'ioredis';
import * as winston from 'winston';
import axios from 'axios';
export class VaultwardenMonitor {
    config;
    secretManager;
    tokenManager;
    logger;
    healthCache = new Map();
    CACHE_TTL = 30000; // 30 seconds
    constructor(config, secretManager, tokenManager, logger) {
        this.config = config;
        this.secretManager = secretManager;
        this.tokenManager = tokenManager;
        this.logger = logger || winston.createLogger({
            level: 'info',
            format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
            transports: [new winston.transports.Console()]
        });
    }
    /**
     * Perform comprehensive health check
     */
    async performHealthCheck() {
        const timestamp = new Date().toISOString();
        const checks = {};
        const scores = [];
        this.logger.info('Starting comprehensive health check');
        // Check Vaultwarden API connectivity
        const vaultwardenCheck = await this.checkVaultwardenAPI();
        checks.vaultwarden_api = vaultwardenCheck;
        scores.push(this.getHealthScore(vaultwardenCheck));
        // Check PostgreSQL database
        const databaseCheck = await this.checkDatabaseHealth();
        checks.database = databaseCheck;
        scores.push(this.getHealthScore(databaseCheck));
        // Check Redis connectivity
        const redisCheck = await this.checkRedisHealth();
        checks.redis = redisCheck;
        scores.push(this.getHealthScore(redisCheck));
        // Check Secret Manager
        if (this.secretManager) {
            const secretManagerCheck = await this.checkSecretManager();
            checks.secret_manager = secretManagerCheck;
            scores.push(this.getHealthScore(secretManagerCheck));
        }
        // Check Token Manager
        if (this.tokenManager) {
            const tokenManagerCheck = await this.checkTokenManager();
            checks.token_manager = tokenManagerCheck;
            scores.push(this.getHealthScore(tokenManagerCheck));
        }
        // Calculate overall status and score
        const overallScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
        const overallStatus = this.determineOverallStatus(checks);
        const result = {
            status: overallStatus,
            checks,
            timestamp,
            overallScore: Math.round(overallScore),
        };
        this.logger.info('Health check completed', {
            status: overallStatus,
            score: result.overallScore,
            componentsChecked: Object.keys(checks).length
        });
        return result;
    }
    /**
     * Check Vaultwarden API connectivity
     */
    async checkVaultwardenAPI() {
        const cacheKey = 'vaultwarden_api';
        const cached = this.getCachedHealth(cacheKey);
        if (cached)
            return cached;
        const startTime = Date.now();
        try {
            // Check if Vaultwarden is responding
            const response = await axios.get(`${this.config.serverUrl}/alive`, {
                timeout: 5000,
                headers: { 'User-Agent': 'SimpleRPC-HealthCheck' }
            });
            const responseTime = Date.now() - startTime;
            const health = {
                status: response.status === 200 ? 'healthy' : 'degraded',
                responseTime,
                details: {
                    httpStatus: response.status,
                    serverUrl: this.config.serverUrl,
                },
                lastChecked: new Date().toISOString(),
            };
            this.setCachedHealth(cacheKey, health);
            return health;
        }
        catch (error) {
            const responseTime = Date.now() - startTime;
            const health = {
                status: 'unhealthy',
                responseTime,
                error: error.message,
                details: {
                    serverUrl: this.config.serverUrl,
                    errorType: error.code || 'UNKNOWN'
                },
                lastChecked: new Date().toISOString(),
            };
            this.setCachedHealth(cacheKey, health);
            this.logger.error('Vaultwarden API health check failed', { error: error.message });
            return health;
        }
    }
    /**
     * Check PostgreSQL database health
     */
    async checkDatabaseHealth() {
        const cacheKey = 'database';
        const cached = this.getCachedHealth(cacheKey);
        if (cached)
            return cached;
        const startTime = Date.now();
        let client = null;
        try {
            client = new Client({
                host: this.config.database.host,
                port: this.config.database.port,
                database: this.config.database.database,
                user: this.config.database.username,
                password: this.config.database.password,
            });
            await client.connect();
            const result = await client.query('SELECT version(), now()');
            const responseTime = Date.now() - startTime;
            const health = {
                status: 'healthy',
                responseTime,
                details: {
                    version: result.rows[0]?.version?.split(' ')[0],
                    serverTime: result.rows[0]?.now,
                    host: this.config.database.host,
                    port: this.config.database.port,
                    database: this.config.database.database,
                },
                lastChecked: new Date().toISOString(),
            };
            this.setCachedHealth(cacheKey, health);
            return health;
        }
        catch (error) {
            const responseTime = Date.now() - startTime;
            const health = {
                status: 'unhealthy',
                responseTime,
                error: error.message,
                details: {
                    host: this.config.database.host,
                    port: this.config.database.port,
                    database: this.config.database.database,
                },
                lastChecked: new Date().toISOString(),
            };
            this.setCachedHealth(cacheKey, health);
            this.logger.error('Database health check failed', { error: error.message });
            return health;
        }
        finally {
            if (client) {
                try {
                    await client.end();
                }
                catch (error) {
                    this.logger.warn('Failed to close database connection', { error: error.message });
                }
            }
        }
    }
    /**
     * Check Redis connectivity
     */
    async checkRedisHealth() {
        const cacheKey = 'redis';
        const cached = this.getCachedHealth(cacheKey);
        if (cached)
            return cached;
        const startTime = Date.now();
        let redis = null;
        try {
            redis = new Redis({
                host: this.config.redis.host,
                port: this.config.redis.port,
                password: this.config.redis.password,
                connectTimeout: 5000,
                lazyConnect: true,
            });
            await redis.connect();
            await redis.ping();
            const info = await redis.info('server');
            const responseTime = Date.now() - startTime;
            const redisVersion = info.match(/redis_version:([^\r\n]+)/)?.[1];
            const uptime = info.match(/uptime_in_seconds:([^\r\n]+)/)?.[1];
            const health = {
                status: 'healthy',
                responseTime,
                details: {
                    version: redisVersion,
                    uptimeSeconds: uptime ? parseInt(uptime) : undefined,
                    host: this.config.redis.host,
                    port: this.config.redis.port,
                },
                lastChecked: new Date().toISOString(),
            };
            this.setCachedHealth(cacheKey, health);
            return health;
        }
        catch (error) {
            const responseTime = Date.now() - startTime;
            const health = {
                status: 'unhealthy',
                responseTime,
                error: error.message,
                details: {
                    host: this.config.redis.host,
                    port: this.config.redis.port,
                },
                lastChecked: new Date().toISOString(),
            };
            this.setCachedHealth(cacheKey, health);
            this.logger.error('Redis health check failed', { error: error.message });
            return health;
        }
        finally {
            if (redis) {
                try {
                    await redis.quit();
                }
                catch (error) {
                    this.logger.warn('Failed to close Redis connection', { error: error.message });
                }
            }
        }
    }
    /**
     * Check Secret Manager health
     */
    async checkSecretManager() {
        const cacheKey = 'secret_manager';
        const cached = this.getCachedHealth(cacheKey);
        if (cached)
            return cached;
        if (!this.secretManager) {
            return {
                status: 'unhealthy',
                error: 'Secret manager not initialized',
                lastChecked: new Date().toISOString(),
            };
        }
        const startTime = Date.now();
        try {
            const healthCheck = await this.secretManager.healthCheck();
            const responseTime = Date.now() - startTime;
            const health = {
                status: healthCheck.status === 'healthy' ? 'healthy' : 'unhealthy',
                responseTime,
                details: healthCheck.details,
                lastChecked: new Date().toISOString(),
            };
            if (healthCheck.status !== 'healthy') {
                health.error = 'Secret manager health check failed';
            }
            this.setCachedHealth(cacheKey, health);
            return health;
        }
        catch (error) {
            const responseTime = Date.now() - startTime;
            const health = {
                status: 'unhealthy',
                responseTime,
                error: error.message,
                lastChecked: new Date().toISOString(),
            };
            this.setCachedHealth(cacheKey, health);
            return health;
        }
    }
    /**
     * Check Token Manager health
     */
    async checkTokenManager() {
        const startTime = Date.now();
        try {
            // Simple health check - try to clean up expired tokens
            await this.tokenManager.cleanupExpiredTokens();
            const responseTime = Date.now() - startTime;
            return {
                status: 'healthy',
                responseTime,
                details: { service: 'token_manager' },
                lastChecked: new Date().toISOString(),
            };
        }
        catch (error) {
            const responseTime = Date.now() - startTime;
            return {
                status: 'unhealthy',
                responseTime,
                error: error.message,
                lastChecked: new Date().toISOString(),
            };
        }
    }
    /**
     * Get cached health result if still valid
     */
    getCachedHealth(key) {
        const cached = this.healthCache.get(key);
        if (cached && Date.now() < cached.expires) {
            return cached.result;
        }
        return null;
    }
    /**
     * Cache health result
     */
    setCachedHealth(key, health) {
        this.healthCache.set(key, {
            result: health,
            expires: Date.now() + this.CACHE_TTL
        });
    }
    /**
     * Convert health status to numeric score
     */
    getHealthScore(health) {
        switch (health.status) {
            case 'healthy': return 100;
            case 'degraded': return 60;
            case 'unhealthy': return 0;
            default: return 0;
        }
    }
    /**
     * Determine overall status from individual checks
     */
    determineOverallStatus(checks) {
        const statuses = Object.values(checks).map(check => check.status);
        if (statuses.includes('unhealthy')) {
            return 'unhealthy';
        }
        if (statuses.includes('degraded')) {
            return 'degraded';
        }
        return 'healthy';
    }
    /**
     * Get metrics for monitoring systems
     */
    async getMetrics() {
        const healthCheck = await this.performHealthCheck();
        const metrics = {
            vaultwarden_up: healthCheck.checks.vaultwarden_api?.status === 'healthy' ? 1 : 0,
            database_up: healthCheck.checks.database?.status === 'healthy' ? 1 : 0,
            redis_up: healthCheck.checks.redis?.status === 'healthy' ? 1 : 0,
            secret_manager_up: healthCheck.checks.secret_manager?.status === 'healthy' ? 1 : 0,
            overall_health_score: healthCheck.overallScore,
            response_times: {},
        };
        // Collect response times
        for (const [name, check] of Object.entries(healthCheck.checks)) {
            if (check.responseTime !== undefined) {
                metrics.response_times[name] = check.responseTime;
            }
        }
        return metrics;
    }
    /**
     * Clear health cache (force fresh checks)
     */
    clearCache() {
        this.healthCache.clear();
        this.logger.info('Health check cache cleared');
    }
}
//# sourceMappingURL=VaultwardenMonitor.js.map