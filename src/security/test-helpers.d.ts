/**
 * Test helpers for disabling security features during testing
 * Provides simple flags to disable rate limiting and security logging
 */
import { MCPRateLimitConfig } from './rate-limiter';
import { SecurityLoggerConfig } from './security-logger';
import { AuthEnforcementConfig } from './auth-enforcer';
/**
 * Disabled rate limiting configuration for tests
 */
export declare const DISABLED_RATE_LIMITING: MCPRateLimitConfig;
/**
 * Disabled auth enforcement configuration for tests
 */
export declare const DISABLED_AUTH_ENFORCEMENT: AuthEnforcementConfig;
/**
 * Disabled security logging configuration for tests
 */
export declare const DISABLED_SECURITY_LOGGING: SecurityLoggerConfig;
/**
 * Create a test-friendly MCP configuration with security features disabled
 */
export declare function createTestMCPConfig(overrides?: any): any;
/**
 * Create MCP config for JWT-only authentication
 */
export declare function createJWTMCPConfig(overrides?: any): any;
/**
 * Create MCP config for OAuth-only authentication
 */
export declare function createOAuthMCPConfig(overrides?: any): any;
/**
 * Create MCP config for both JWT and OAuth authentication (JWT first, OAuth fallback)
 */
export declare function createBothAuthMCPConfig(overrides?: any): any;
/**
 * Environment variable to check if we're in test mode
 */
export declare function isTestEnvironment(): boolean;
/**
 * Check if security features should be disabled via environment variables
 */
export declare function shouldDisableSecurity(): boolean;
/**
 * Auto-disable security features if in test environment or explicitly disabled
 */
export declare function getTestSafeConfig(config?: any): any;
//# sourceMappingURL=test-helpers.d.ts.map