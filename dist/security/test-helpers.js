/**
 * Test helpers for disabling security features during testing
 * Provides simple flags to disable rate limiting and security logging
 */
/**
 * Disabled rate limiting configuration for tests
 */
export const DISABLED_RATE_LIMITING = {
    enabled: false,
    // Set very high limits as backup
    global: {
        windowMs: 60000, // 1 minute
        max: 999999 // Very high limit
    },
    authenticated: {
        windowMs: 60000, // 1 minute  
        max: 999999 // Very high limit
    },
    admin: {
        windowMs: 60000, // 1 minute
        max: 999999 // Very high limit
    },
    toolLimits: {}, // Empty object - no specific tool limits
    burst: {
        enabled: false,
        windowMs: 1000, // 1 second
        max: 999999 // Very high limit
    },
    adaptive: {
        enabled: false,
        cpuThreshold: 90,
        memoryThreshold: 90,
        throttleMultiplier: 1.0
    }
};
/**
 * Disabled auth enforcement configuration for tests
 */
export const DISABLED_AUTH_ENFORCEMENT = {
    enabled: false,
    strictMode: false,
    allowedAnonymousEndpoints: ['*'], // Allow all endpoints
    requireEmailVerification: false,
    requireActiveSubscription: false,
    tokenValidation: {
        checkExpiration: false,
        checkAudience: false,
        checkIssuer: false,
        allowedIssuers: [],
        clockSkewTolerance: 999999
    },
    resourceTracking: {
        enabled: false,
        trackAllRequests: false,
        aggregationInterval: 999999,
        retentionDays: 0
    },
    quotaEnforcement: {
        enabled: false,
        checkOnRequest: false,
        quotaBufferPercent: 100,
        gracePeriodHours: 999999
    },
    performanceTracking: {
        enabled: false,
        trackResponseTimes: false,
        trackResourceConsumption: false,
        alertSlowRequests: false,
        slowRequestThresholdMs: 999999
    }
};
/**
 * Disabled security logging configuration for tests
 */
export const DISABLED_SECURITY_LOGGING = {
    enabled: false,
    logLevel: 'error',
    logFile: '/dev/null', // Discard logs on Unix systems
    maxFileSize: '1MB',
    maxFiles: 1,
    siem: {
        enabled: false,
        format: 'json'
    },
    alerts: {
        enabled: false,
        thresholds: {
            low: 999999,
            medium: 999999,
            high: 999999,
            critical: 999999
        }
    },
    networkFilter: {
        enabled: false,
        ipWhitelist: ['0.0.0.0/0'], // Allow all IPs
        ipBlacklist: [],
        countryBlacklist: [],
        countryWhitelist: [],
        blockTor: false,
        blockVPN: false,
        blockProxies: false,
        autoBlockThreshold: 999999,
        autoBlockDuration: 0,
        customRules: []
    },
    anomalyDetection: {
        enabled: false,
        windowMinutes: 60,
        thresholds: {
            requestsPerMinute: 999999,
            uniqueUserAgents: 999999,
            distinctEndpoints: 999999,
            errorRate: 100
        }
    }
};
/**
 * Create a test-friendly MCP configuration with security features disabled
 */
export function createTestMCPConfig(overrides) {
    return {
        enableMCP: true,
        transports: {
            http: true,
            stdio: false,
            sse: false
        },
        auth: {
            requireAuthForToolsList: false,
            requireAuthForToolsCall: true,
            publicTools: ['greeting'],
            authType: 'oauth', // Default to OAuth for backward compatibility
            oauth: {
                enabled: true,
                requireValidSession: true
            },
            jwt: {
                enabled: false,
                requireValidSignature: true,
                requiredScopes: ['mcp'],
                allowExpiredTokens: false
            }
        },
        rateLimiting: DISABLED_RATE_LIMITING,
        securityLogging: DISABLED_SECURITY_LOGGING,
        authEnforcement: DISABLED_AUTH_ENFORCEMENT,
        ...overrides
    };
}
/**
 * Create MCP config for JWT-only authentication
 */
export function createJWTMCPConfig(overrides) {
    return createTestMCPConfig({
        auth: {
            requireAuthForToolsList: true,
            requireAuthForToolsCall: true,
            publicTools: [],
            authType: 'jwt',
            jwt: {
                enabled: true,
                requireValidSignature: true,
                requiredScopes: ['mcp'],
                allowExpiredTokens: false
            },
            oauth: {
                enabled: false
            }
        },
        ...overrides
    });
}
/**
 * Create MCP config for OAuth-only authentication
 */
export function createOAuthMCPConfig(overrides) {
    return createTestMCPConfig({
        auth: {
            requireAuthForToolsList: true,
            requireAuthForToolsCall: true,
            publicTools: [],
            authType: 'oauth',
            oauth: {
                enabled: true,
                requireValidSession: true
            },
            jwt: {
                enabled: false
            }
        },
        ...overrides
    });
}
/**
 * Create MCP config for both JWT and OAuth authentication (JWT first, OAuth fallback)
 */
export function createBothAuthMCPConfig(overrides) {
    return createTestMCPConfig({
        auth: {
            requireAuthForToolsList: true,
            requireAuthForToolsCall: true,
            publicTools: [],
            authType: 'both',
            jwt: {
                enabled: true,
                requireValidSignature: true,
                requiredScopes: ['mcp'],
                allowExpiredTokens: false
            },
            oauth: {
                enabled: true,
                requireValidSession: true
            }
        },
        ...overrides
    });
}
/**
 * Environment variable to check if we're in test mode
 */
export function isTestEnvironment() {
    return process.env.NODE_ENV === 'test' ||
        process.env.VITEST === 'true' ||
        process.env.JEST_WORKER_ID !== undefined ||
        process.argv.some(arg => arg.includes('vitest') || arg.includes('jest'));
}
/**
 * Check if security features should be disabled via environment variables
 */
export function shouldDisableSecurity() {
    return process.env.DISABLE_MCP_SECURITY === 'true' ||
        process.env.DISABLE_RATE_LIMITING === 'true' ||
        process.env.DISABLE_SECURITY_LOGGING === 'true';
}
/**
 * Auto-disable security features if in test environment or explicitly disabled
 */
export function getTestSafeConfig(config) {
    if (isTestEnvironment() || shouldDisableSecurity()) {
        console.log('🧪 Test mode detected: Disabling ALL security features (rate limiting & security logging)');
        return {
            ...config,
            // Disable Express-level rate limiting
            rateLimit: {
                windowMs: 15 * 60 * 1000,
                max: 0, // Disable rate limiting by setting max to 0
                ...config?.rateLimit
            },
            mcp: {
                ...config?.mcp,
                rateLimiting: DISABLED_RATE_LIMITING,
                securityLogging: DISABLED_SECURITY_LOGGING,
                authEnforcement: DISABLED_AUTH_ENFORCEMENT
            }
        };
    }
    return config;
}
