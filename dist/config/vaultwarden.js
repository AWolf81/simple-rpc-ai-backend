/**
 * Vaultwarden Configuration
 *
 * Configuration for Vaultwarden secret management integration
 */
// Load configuration from environment
export function loadVaultwardenConfig() {
    const requiredVars = [
        'VW_SERVICE_EMAIL',
        'VW_SERVICE_PASSWORD',
        'VW_DB_PASS'
    ];
    // Check required environment variables
    for (const varName of requiredVars) {
        if (!process.env[varName]) {
            throw new Error(`Missing required environment variable: ${varName}`);
        }
    }
    return {
        serverUrl: process.env.VAULTWARDEN_URL || process.env.VW_DOMAIN || 'http://localhost:8080',
        serviceEmail: process.env.VW_SERVICE_EMAIL,
        servicePassword: process.env.VW_SERVICE_PASSWORD,
        organizationId: process.env.SIMPLE_RPC_ORG_ID || '',
        adminToken: process.env.VW_ADMIN_TOKEN,
        database: {
            host: process.env.VW_DB_HOST || 'localhost',
            port: parseInt(process.env.VW_DB_PORT || '5432'),
            database: process.env.VW_DB_NAME || 'vaultwarden',
            username: process.env.VW_DB_USER || 'vaultwarden_user',
            password: process.env.VW_DB_PASS,
        },
        redis: {
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT || '6379'),
            password: process.env.REDIS_PASSWORD,
        },
        apiTokens: {
            enabled: process.env.ENABLE_API_TOKENS === 'true',
            defaultLimit: parseInt(process.env.API_TOKEN_DEFAULT_LIMIT || '5'),
            requiresPro: process.env.API_TOKEN_REQUIRES_PRO !== 'false',
            maxTokensPerUser: parseInt(process.env.API_TOKEN_MAX_PER_USER || '10'),
        },
    };
}
export function loadExternalAccessConfig() {
    return {
        enabled: process.env.ALLOW_EXTERNAL_KEY_ACCESS === 'true',
        allowedOrigins: process.env.EXTERNAL_ALLOWED_ORIGINS?.split(',') || [],
        requireDeviceAuth: process.env.EXTERNAL_REQUIRE_AUTH !== 'false',
        rateLimits: {
            requestsPerHour: parseInt(process.env.EXTERNAL_RATE_LIMIT_HOUR || '100'),
            keysPerUser: parseInt(process.env.EXTERNAL_KEY_LIMIT_USER || '10'),
        },
        allowedMethods: process.env.EXTERNAL_ALLOWED_METHODS?.split(',') ||
            ['get', 'list'],
    };
}
// Validate configuration
export function validateVaultwardenConfig(config) {
    if (!config.organizationId && process.env.NODE_ENV !== 'development') {
        console.warn('⚠️  SIMPLE_RPC_ORG_ID not set. Please run setup script first.');
    }
    if (config.serverUrl.includes('localhost') && process.env.NODE_ENV === 'production') {
        throw new Error('Production environment cannot use localhost Vaultwarden URL');
    }
    if (config.servicePassword.length < 12) {
        throw new Error('Service password must be at least 12 characters long');
    }
}
// Default configuration for development
export const defaultVaultwardenConfig = {
    serverUrl: 'http://localhost:8080',
    database: {
        host: 'localhost',
        port: 5432,
        database: 'vaultwarden',
        username: 'vaultwarden_user',
        password: '', // Must be set via environment
    },
    redis: {
        host: 'localhost',
        port: 6379,
    },
    apiTokens: {
        enabled: true,
        defaultLimit: 5,
        requiresPro: false, // Allow in development
        maxTokensPerUser: 10,
    },
};
export const vaultwardenConfig = loadVaultwardenConfig();
//# sourceMappingURL=vaultwarden.js.map