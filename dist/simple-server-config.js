/**
 * Simplified Server Configuration
 *
 * Provides simple, opinionated defaults for common use cases while still allowing
 * access to the full configuration when needed.
 */
/**
 * Create a complete server configuration from simple inputs
 */
export function createSimpleServerConfig(simple = {}) {
    const { port = 8000, preset = 'development', providers = ['anthropic'], useEnvConfig = true, enableMCP = true, auth = { type: 'none' }, database, rootFolders, advanced = {} } = simple;
    // Base configuration with sensible defaults
    const baseConfig = {
        port,
        // AI configuration
        serverProviders: providers,
        byokProviders: providers,
        // Protocol support - enable both by default
        protocols: {
            jsonRpc: true,
            tRpc: true
        },
        // MCP configuration
        mcp: enableMCP ? {
            enabled: true,
            enableMCP: true,
            transports: {
                http: true,
                stdio: false
            },
            auth: {
                requireAuthForToolsList: false,
                requireAuthForToolsCall: auth.type !== 'none',
                publicTools: auth.type === 'none' ? ['*'] : []
            },
            adminUsers: auth.adminUsers || ['admin@company.com']
        } : {
            enabled: false
        },
        // CORS - permissive for development, restrictive for production
        cors: {
            origin: preset === 'development' ? '*' : false,
            credentials: true
        },
        // Rate limiting based on preset
        rateLimit: {
            windowMs: preset === 'development' ? 15 * 60 * 1000 : 15 * 60 * 1000, // 15 minutes
            max: preset === 'development' ? 1000 : 100 // requests per window
        }
    };
    // Preset-specific configurations
    switch (preset) {
        case 'development':
            baseConfig.trustProxy = false;
            baseConfig.rateLimit.max = 1000;
            break;
        case 'production':
            baseConfig.trustProxy = true;
            baseConfig.cors.origin = false; // Must be explicitly configured
            baseConfig.rateLimit.max = 100;
            break;
        case 'demo':
            baseConfig.cors.origin = '*';
            baseConfig.rateLimit.max = 200;
            baseConfig.mcp.auth.requireAuthForToolsCall = false; // Demo mode - no auth required
            break;
        case 'enterprise':
            baseConfig.trustProxy = true;
            baseConfig.rateLimit.max = 500;
            baseConfig.mcp.auth.requireAuthForToolsCall = true;
            break;
    }
    // Authentication configuration
    if (auth.type !== 'none') {
        if (auth.type === 'jwt' || auth.type === 'both') {
            if (useEnvConfig) {
                baseConfig.jwt = {
                    secret: process.env.JWT_SECRET,
                    issuer: process.env.JWT_ISSUER,
                    audience: process.env.JWT_AUDIENCE
                };
            }
        }
        if (auth.type === 'oauth' || auth.type === 'both') {
            if (useEnvConfig) {
                baseConfig.oauth = {
                    enabled: true,
                    googleClientId: process.env.GOOGLE_CLIENT_ID,
                    googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,
                    encryptionKey: process.env.OAUTH_ENCRYPTION_KEY || process.env.JWT_SECRET,
                    sessionStorage: {
                        type: 'memory' // Simple default
                    }
                };
            }
        }
    }
    // Database configuration
    if (database) {
        if (database.enableTokenTracking) {
            baseConfig.tokenTracking = {
                enabled: true,
                databaseUrl: database.url || process.env.DATABASE_URL,
                platformFeePercent: 25
            };
        }
        if (database.enableSecretManager) {
            // Parse database URL or use environment variables
            const dbUrl = database.url || process.env.DATABASE_URL;
            if (dbUrl) {
                try {
                    const url = new URL(dbUrl);
                    baseConfig.secretManager = {
                        type: 'postgresql',
                        host: url.hostname,
                        port: parseInt(url.port) || 5432,
                        database: url.pathname.slice(1),
                        user: url.username,
                        password: url.password,
                        encryptionKey: process.env.SECRET_MANAGER_ENCRYPTION_KEY || process.env.JWT_SECRET
                    };
                }
                catch (error) {
                    console.warn('Invalid database URL provided, skipping secret manager configuration');
                }
            }
        }
    }
    // Root folder configuration
    if (rootFolders === undefined || rootFolders.enabled !== false) {
        const rootManagerConfig = {};
        // Configure default root
        if (rootFolders?.defaultRoot || rootFolders?.enabled !== false) {
            const defaultRoot = rootFolders?.defaultRoot || {};
            rootManagerConfig.defaultRoot = {
                path: defaultRoot.path || process.cwd(),
                name: 'Project Root',
                description: 'Default project root folder',
                readOnly: defaultRoot.readOnly ?? false,
                allowedExtensions: defaultRoot.allowedExtensions || ['ts', 'js', 'json', 'md', 'txt', 'yml', 'yaml'],
                blockedExtensions: ['exe', 'bin', 'so', 'dll'],
                maxFileSize: 10 * 1024 * 1024, // 10MB
                followSymlinks: false,
                enableWatching: preset === 'development'
            };
        }
        // Configure additional roots
        if (rootFolders?.additionalRoots) {
            rootManagerConfig.roots = {};
            for (const [id, rootConfig] of Object.entries(rootFolders.additionalRoots)) {
                rootManagerConfig.roots[id] = {
                    path: rootConfig.path,
                    name: rootConfig.name || id,
                    description: rootConfig.description,
                    readOnly: rootConfig.readOnly ?? false,
                    allowedExtensions: rootConfig.allowedExtensions,
                    blockedExtensions: rootConfig.blockedExtensions || ['exe', 'bin', 'so', 'dll'],
                    maxFileSize: rootConfig.maxFileSize || 10 * 1024 * 1024,
                    followSymlinks: false,
                    enableWatching: preset === 'development'
                };
            }
        }
        // Security settings based on preset
        rootManagerConfig.security = {
            maxTotalFileSize: preset === 'development' ? 100 * 1024 * 1024 : 50 * 1024 * 1024, // 100MB dev, 50MB prod
            maxFilesPerOperation: preset === 'development' ? 1000 : 100,
            strictPathValidation: preset !== 'development',
            allowedProtocols: ['file', 'mcp']
        };
        baseConfig.rootManager = rootManagerConfig;
    }
    // Merge with advanced configuration override
    return mergeConfigs(baseConfig, advanced);
}
/**
 * Deep merge two configuration objects
 */
function mergeConfigs(base, override) {
    const result = { ...base };
    for (const [key, value] of Object.entries(override)) {
        if (value && typeof value === 'object' && !Array.isArray(value)) {
            result[key] = {
                ...result[key],
                ...value
            };
        }
        else {
            result[key] = value;
        }
    }
    return result;
}
/**
 * Quick configuration helpers for common scenarios
 */
export const simpleConfigs = {
    // Minimal development server
    dev: () => ({
        preset: 'development',
        providers: ['anthropic'],
        enableMCP: true,
        auth: { type: 'none' }
    }),
    // Production server with authentication
    prod: () => ({
        preset: 'production',
        providers: ['anthropic', 'openai', 'google'],
        enableMCP: true,
        auth: {
            type: 'both',
            adminUsers: ['admin@company.com']
        },
        database: {
            enableTokenTracking: true,
            enableSecretManager: true
        }
    }),
    // Demo server (public access)
    demo: () => ({
        preset: 'demo',
        providers: ['anthropic'],
        enableMCP: true,
        auth: { type: 'none' }
    }),
    // Enterprise server (secure)
    enterprise: () => ({
        preset: 'enterprise',
        providers: ['anthropic', 'openai', 'google'],
        enableMCP: true,
        auth: {
            type: 'both',
            adminUsers: ['admin@company.com', 'ops@company.com']
        },
        database: {
            enableTokenTracking: true,
            enableSecretManager: true
        }
    })
};
/**
 * Environment-based configuration
 * Automatically selects configuration based on NODE_ENV
 */
export function createEnvBasedConfig(overrides = {}) {
    const env = process.env.NODE_ENV || 'development';
    let baseConfig;
    switch (env) {
        case 'production':
            baseConfig = simpleConfigs.prod();
            break;
        case 'demo':
            baseConfig = simpleConfigs.demo();
            break;
        case 'test':
            baseConfig = simpleConfigs.dev();
            baseConfig.port = 0; // Random port for tests
            break;
        default:
            baseConfig = simpleConfigs.dev();
    }
    return mergeConfigs(baseConfig, overrides);
}
