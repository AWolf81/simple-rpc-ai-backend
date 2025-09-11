import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  DISABLED_RATE_LIMITING,
  DISABLED_AUTH_ENFORCEMENT,
  DISABLED_SECURITY_LOGGING,
  createTestMCPConfig,
  isTestEnvironment,
  shouldDisableSecurity,
  getTestSafeConfig
} from '../../dist/security/test-helpers.js';
import { MCPRateLimitConfig } from '../../dist/security/rate-limiter.js';
import { SecurityLoggerConfig } from '../../dist/security/security-logger.js';
import { AuthEnforcementConfig } from '../../dist/security/auth-enforcer.js';

describe('Test Helpers - Security Configuration', () => {
  let originalEnv: NodeJS.ProcessEnv;
  let originalArgv: string[];

  beforeEach(() => {
    // Save original environment and arguments
    originalEnv = { ...process.env };
    originalArgv = [...process.argv];
    
    // Clear security-related environment variables
    delete process.env.NODE_ENV;
    delete process.env.VITEST;
    delete process.env.JEST_WORKER_ID;
    delete process.env.DISABLE_MCP_SECURITY;
    delete process.env.DISABLE_RATE_LIMITING;
    delete process.env.DISABLE_SECURITY_LOGGING;
    
    // Reset process.argv
    process.argv = ['node', 'script.js'];
  });

  afterEach(() => {
    // Restore original environment and arguments
    process.env = originalEnv;
    process.argv = originalArgv;
  });

  describe('Disabled Rate Limiting Configuration', () => {
    it('should disable rate limiting completely', () => {
      expect(DISABLED_RATE_LIMITING.enabled).toBe(false);
      expect(DISABLED_RATE_LIMITING.adaptive.enabled).toBe(false);
      expect(DISABLED_RATE_LIMITING.burst.enabled).toBe(false);
    });

    it('should have very high limits as backup', () => {
      expect(DISABLED_RATE_LIMITING.global.max).toBe(999999);
      expect(DISABLED_RATE_LIMITING.authenticated.max).toBe(999999);
      expect(DISABLED_RATE_LIMITING.admin.max).toBe(999999);
      expect(DISABLED_RATE_LIMITING.burst.max).toBe(999999);
    });

    it('should have permissive adaptive settings', () => {
      expect(DISABLED_RATE_LIMITING.adaptive.cpuThreshold).toBe(90);
      expect(DISABLED_RATE_LIMITING.adaptive.memoryThreshold).toBe(90);
      expect(DISABLED_RATE_LIMITING.adaptive.throttleMultiplier).toBe(1.0);
    });

    it('should have empty tool limits', () => {
      expect(DISABLED_RATE_LIMITING.toolLimits).toEqual({});
    });

    it('should conform to MCPRateLimitConfig interface', () => {
      // Type check - this will fail at compile time if interface doesn't match
      const config: MCPRateLimitConfig = DISABLED_RATE_LIMITING;
      expect(config).toBeDefined();
    });
  });

  describe('Disabled Auth Enforcement Configuration', () => {
    it('should disable authentication enforcement', () => {
      expect(DISABLED_AUTH_ENFORCEMENT.enabled).toBe(false);
      expect(DISABLED_AUTH_ENFORCEMENT.strictMode).toBe(false);
      expect(DISABLED_AUTH_ENFORCEMENT.requireEmailVerification).toBe(false);
      expect(DISABLED_AUTH_ENFORCEMENT.requireActiveSubscription).toBe(false);
    });

    it('should allow all anonymous endpoints', () => {
      expect(DISABLED_AUTH_ENFORCEMENT.allowedAnonymousEndpoints).toContain('*');
    });

    it('should disable token validation', () => {
      const tokenValidation = DISABLED_AUTH_ENFORCEMENT.tokenValidation;
      expect(tokenValidation.checkExpiration).toBe(false);
      expect(tokenValidation.checkAudience).toBe(false);
      expect(tokenValidation.checkIssuer).toBe(false);
      expect(tokenValidation.clockSkewTolerance).toBe(999999);
    });

    it('should disable resource tracking', () => {
      const resourceTracking = DISABLED_AUTH_ENFORCEMENT.resourceTracking;
      expect(resourceTracking.enabled).toBe(false);
      expect(resourceTracking.trackAllRequests).toBe(false);
      expect(resourceTracking.retentionDays).toBe(0);
    });

    it('should disable quota enforcement', () => {
      const quotaEnforcement = DISABLED_AUTH_ENFORCEMENT.quotaEnforcement;
      expect(quotaEnforcement.enabled).toBe(false);
      expect(quotaEnforcement.checkOnRequest).toBe(false);
      expect(quotaEnforcement.quotaBufferPercent).toBe(100);
    });

    it('should disable performance tracking', () => {
      const performanceTracking = DISABLED_AUTH_ENFORCEMENT.performanceTracking;
      expect(performanceTracking.enabled).toBe(false);
      expect(performanceTracking.trackResponseTimes).toBe(false);
      expect(performanceTracking.trackResourceConsumption).toBe(false);
      expect(performanceTracking.alertSlowRequests).toBe(false);
    });

    it('should conform to AuthEnforcementConfig interface', () => {
      // Type check - this will fail at compile time if interface doesn't match
      const config: AuthEnforcementConfig = DISABLED_AUTH_ENFORCEMENT;
      expect(config).toBeDefined();
    });
  });

  describe('Disabled Security Logging Configuration', () => {
    it('should disable security logging', () => {
      expect(DISABLED_SECURITY_LOGGING.enabled).toBe(false);
      expect(DISABLED_SECURITY_LOGGING.siem.enabled).toBe(false);
      expect(DISABLED_SECURITY_LOGGING.alerts.enabled).toBe(false);
    });

    it('should have permissive network filtering', () => {
      const networkFilter = DISABLED_SECURITY_LOGGING.networkFilter;
      expect(networkFilter.enabled).toBe(false);
      expect(networkFilter.ipWhitelist).toContain('0.0.0.0/0');
      expect(networkFilter.ipBlacklist).toEqual([]);
      expect(networkFilter.blockTor).toBe(false);
      expect(networkFilter.blockVPN).toBe(false);
      expect(networkFilter.blockProxies).toBe(false);
    });

    it('should have very high alert thresholds', () => {
      const thresholds = DISABLED_SECURITY_LOGGING.alerts.thresholds;
      expect(thresholds.low).toBe(999999);
      expect(thresholds.medium).toBe(999999);
      expect(thresholds.high).toBe(999999);
      expect(thresholds.critical).toBe(999999);
    });

    it('should disable anomaly detection', () => {
      const anomalyDetection = DISABLED_SECURITY_LOGGING.anomalyDetection;
      expect(anomalyDetection.enabled).toBe(false);
      expect(anomalyDetection.thresholds.requestsPerMinute).toBe(999999);
      expect(anomalyDetection.thresholds.uniqueUserAgents).toBe(999999);
      expect(anomalyDetection.thresholds.distinctEndpoints).toBe(999999);
      expect(anomalyDetection.thresholds.errorRate).toBe(100);
    });

    it('should use minimal logging settings', () => {
      expect(DISABLED_SECURITY_LOGGING.logLevel).toBe('error');
      expect(DISABLED_SECURITY_LOGGING.logFile).toBe('/dev/null');
      expect(DISABLED_SECURITY_LOGGING.maxFiles).toBe(1);
    });

    it('should conform to SecurityLoggerConfig interface', () => {
      // Type check - this will fail at compile time if interface doesn't match
      const config: SecurityLoggerConfig = DISABLED_SECURITY_LOGGING;
      expect(config).toBeDefined();
    });
  });

  describe('Test MCP Configuration Creator', () => {
    it('should create test-friendly MCP configuration', () => {
      const config = createTestMCPConfig();
      
      expect(config).toEqual({
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
        authEnforcement: DISABLED_AUTH_ENFORCEMENT
      });
    });

    it('should merge custom overrides', () => {
      const overrides = {
        enableMCP: false,
        customProperty: 'test-value',
        auth: {
          publicTools: ['custom-tool']
        }
      };
      
      const config = createTestMCPConfig(overrides);
      
      expect(config.enableMCP).toBe(false);
      expect(config.customProperty).toBe('test-value');
      expect(config.auth.publicTools).toEqual(['custom-tool']);
      expect(config.rateLimiting).toEqual(DISABLED_RATE_LIMITING);
    });

    it.skip('should maintain security disabled configurations even with overrides', () => {
      const overrides = {
        rateLimiting: { enabled: true }, // This should still be overridden
        securityLogging: { enabled: true } // This should still be overridden
      };
      
      const config = createTestMCPConfig(overrides);
      
      // Security configs should remain disabled
      expect(config.rateLimiting).toEqual(DISABLED_RATE_LIMITING);
      expect(config.securityLogging).toEqual(DISABLED_SECURITY_LOGGING);
    });
  });

  describe('Test Environment Detection', () => {
    describe('NODE_ENV detection', () => {
      it('should detect test environment via NODE_ENV', () => {
        process.env.NODE_ENV = 'test';
        expect(isTestEnvironment()).toBe(true);
      });

      it('should not detect production environment', () => {
        process.env.NODE_ENV = 'production';
        expect(isTestEnvironment()).toBe(false);
      });

      it('should not detect development environment', () => {
        process.env.NODE_ENV = 'development';
        expect(isTestEnvironment()).toBe(false);
      });
    });

    describe('VITEST detection', () => {
      it('should detect Vitest environment', () => {
        process.env.VITEST = 'true';
        expect(isTestEnvironment()).toBe(true);
      });

      it('should not detect when VITEST is false', () => {
        process.env.VITEST = 'false';
        expect(isTestEnvironment()).toBe(false);
      });
    });

    describe('Jest detection', () => {
      it('should detect Jest environment', () => {
        process.env.JEST_WORKER_ID = '1';
        expect(isTestEnvironment()).toBe(true);
      });
    });

    describe('Command line detection', () => {
      it('should detect vitest in command line arguments', () => {
        process.argv = ['node', 'node_modules/.bin/vitest'];
        expect(isTestEnvironment()).toBe(true);
      });

      it('should detect jest in command line arguments', () => {
        process.argv = ['node', 'node_modules/.bin/jest'];
        expect(isTestEnvironment()).toBe(true);
      });

      it('should detect vitest with run command', () => {
        process.argv = ['node', 'script.js', '--', 'vitest', 'run'];
        expect(isTestEnvironment()).toBe(true);
      });

      it('should not detect normal script execution', () => {
        process.argv = ['node', 'src/server.js'];
        expect(isTestEnvironment()).toBe(false);
      });
    });

    describe('Multiple environment indicators', () => {
      it('should detect when multiple test indicators are present', () => {
        process.env.NODE_ENV = 'test';
        process.env.VITEST = 'true';
        process.argv = ['node', 'vitest'];
        
        expect(isTestEnvironment()).toBe(true);
      });

      it('should return false when no test indicators are present', () => {
        process.env.NODE_ENV = 'production';
        process.env.VITEST = 'false';
        process.argv = ['node', 'server.js'];
        
        expect(isTestEnvironment()).toBe(false);
      });
    });
  });

  describe('Security Disable Detection', () => {
    it('should detect when MCP security is explicitly disabled', () => {
      process.env.DISABLE_MCP_SECURITY = 'true';
      expect(shouldDisableSecurity()).toBe(true);
    });

    it('should detect when rate limiting is explicitly disabled', () => {
      process.env.DISABLE_RATE_LIMITING = 'true';
      expect(shouldDisableSecurity()).toBe(true);
    });

    it('should detect when security logging is explicitly disabled', () => {
      process.env.DISABLE_SECURITY_LOGGING = 'true';
      expect(shouldDisableSecurity()).toBe(true);
    });

    it('should not disable when environment variables are false', () => {
      process.env.DISABLE_MCP_SECURITY = 'false';
      process.env.DISABLE_RATE_LIMITING = 'false';
      process.env.DISABLE_SECURITY_LOGGING = 'false';
      expect(shouldDisableSecurity()).toBe(false);
    });

    it('should not disable when environment variables are undefined', () => {
      expect(shouldDisableSecurity()).toBe(false);
    });

    it('should detect any security disable flag', () => {
      process.env.DISABLE_MCP_SECURITY = 'false';
      process.env.DISABLE_RATE_LIMITING = 'true';  // This one is true
      process.env.DISABLE_SECURITY_LOGGING = 'false';
      
      expect(shouldDisableSecurity()).toBe(true);
    });
  });

  describe('Test Safe Configuration', () => {
    let consoleSpy: any;

    beforeEach(() => {
      consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
      consoleSpy.mockRestore();
    });

    it.skip('should return disabled configuration in test environment', () => {
      process.env.NODE_ENV = 'test';
      
      const config = { 
        someProperty: 'value',
        rateLimit: { windowMs: 60000, max: 100 }
      };
      
      const result = getTestSafeConfig(config);
      
      expect(result.someProperty).toBe('value');
      expect(result.rateLimit.max).toBe(0); // Disabled
      expect(result.mcp.rateLimiting).toEqual(DISABLED_RATE_LIMITING);
      expect(result.mcp.securityLogging).toEqual(DISABLED_SECURITY_LOGGING);
      expect(result.mcp.authEnforcement).toEqual(DISABLED_AUTH_ENFORCEMENT);
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('🧪 Test mode detected: Disabling ALL security features')
      );
    });

    it('should return disabled configuration when explicitly disabled', () => {
      process.env.DISABLE_MCP_SECURITY = 'true';
      
      const config = { someProperty: 'value' };
      const result = getTestSafeConfig(config);
      
      expect(result.mcp.rateLimiting).toEqual(DISABLED_RATE_LIMITING);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('🧪 Test mode detected: Disabling ALL security features')
      );
    });

    it('should return original configuration in production environment', () => {
      process.env.NODE_ENV = 'production';
      
      const config = { 
        someProperty: 'value',
        rateLimit: { windowMs: 60000, max: 100 }
      };
      
      const result = getTestSafeConfig(config);
      
      expect(result).toBe(config); // Should return original config unchanged
      expect(consoleSpy).not.toHaveBeenCalled();
    });

    it('should handle undefined config gracefully', () => {
      process.env.NODE_ENV = 'test';
      
      const result = getTestSafeConfig(undefined);
      
      expect(result).toBeDefined();
      expect(result.mcp).toBeDefined();
      expect(result.mcp.rateLimiting).toEqual(DISABLED_RATE_LIMITING);
    });

    it('should handle empty config gracefully', () => {
      process.env.NODE_ENV = 'test';
      
      const result = getTestSafeConfig({});
      
      expect(result).toBeDefined();
      expect(result.mcp).toBeDefined();
      expect(result.mcp.rateLimiting).toEqual(DISABLED_RATE_LIMITING);
    });

    it('should merge with existing MCP config', () => {
      process.env.NODE_ENV = 'test';
      
      const config = {
        mcp: {
          enableMCP: false,
          customSetting: 'test'
        }
      };
      
      const result = getTestSafeConfig(config);
      
      expect(result.mcp.enableMCP).toBe(false); // Original setting preserved
      expect(result.mcp.customSetting).toBe('test'); // Original setting preserved
      expect(result.mcp.rateLimiting).toEqual(DISABLED_RATE_LIMITING); // Security disabled
    });

    it('should preserve existing rate limit config in production', () => {
      process.env.NODE_ENV = 'production';
      
      const config = {
        rateLimit: {
          windowMs: 30000,
          max: 50,
          customSetting: 'preserve'
        }
      };
      
      const result = getTestSafeConfig(config);
      
      expect(result.rateLimit.windowMs).toBe(30000);
      expect(result.rateLimit.max).toBe(50);
      expect(result.rateLimit.customSetting).toBe('preserve');
    });
  });

  describe('Integration Tests', () => {
    it.skip('should work with Vitest environment', () => {
      // This test is running in Vitest, so it should be detected
      expect(isTestEnvironment()).toBe(true);
    });

    it.skip('should provide consistent disabled configurations', () => {
      const mcpConfig = createTestMCPConfig();
      const safeConfig = getTestSafeConfig({});
      
      // Both should provide the same disabled configurations
      expect(mcpConfig.rateLimiting).toEqual(safeConfig.mcp.rateLimiting);
      expect(mcpConfig.securityLogging).toEqual(safeConfig.mcp.securityLogging);
      expect(mcpConfig.authEnforcement).toEqual(safeConfig.mcp.authEnforcement);
    });

    it.skip('should handle complex configuration scenarios', () => {
      process.env.NODE_ENV = 'test';
      
      const complexConfig = {
        server: {
          port: 8000,
          host: 'localhost'
        },
        database: {
          url: 'postgresql://localhost:5432/testdb'
        },
        rateLimit: {
          windowMs: 60000,
          max: 100,
          message: 'Too many requests'
        },
        mcp: {
          enableMCP: true,
          existingConfig: 'preserve'
        }
      };
      
      const result = getTestSafeConfig(complexConfig);
      
      // Server and database config should be preserved
      expect(result.server).toEqual(complexConfig.server);
      expect(result.database).toEqual(complexConfig.database);
      
      // Rate limiting should be disabled
      expect(result.rateLimit.max).toBe(0);
      
      // MCP security should be disabled but existing settings preserved
      expect(result.mcp.enableMCP).toBe(true);
      expect(result.mcp.existingConfig).toBe('preserve');
      expect(result.mcp.rateLimiting.enabled).toBe(false);
      expect(result.mcp.securityLogging.enabled).toBe(false);
      expect(result.mcp.authEnforcement.enabled).toBe(false);
    });
  });
});