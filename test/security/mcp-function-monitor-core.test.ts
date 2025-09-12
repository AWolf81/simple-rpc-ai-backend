/**
 * Core functionality tests for MCP Function Monitor
 * Focuses on the change detection logic rather than complex router mocking
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import { MCPFunctionMonitor, SchemaChangeAnalysis } from '../../src/security/mcp-function-monitor';
import { SecurityLogger, SecurityEventType, SecuritySeverity } from '../../src/security/security-logger';

// Mock SecurityLogger
const mockSecurityLogger = {
  logSecurityEvent: vi.fn().mockResolvedValue(undefined)
} as unknown as SecurityLogger;

describe('MCPFunctionMonitor - Core Change Detection', () => {
  let monitor: MCPFunctionMonitor;

  beforeEach(() => {
    vi.clearAllMocks();
    monitor = new MCPFunctionMonitor(mockSecurityLogger, {
      changeDetectionLevel: 'moderate',
      monitoringIntervalMs: 1000,
      persistSchemas: false
    });
  });

  afterEach(() => {
    monitor.stopMonitoring();
  });

  describe('Schema Analysis', () => {
    test('should create proper schema snapshots', () => {
      const testProcedure = {
        _def: {
          inputs: [{
            parse: () => ({}),
            _def: {
              typeName: 'ZodObject',
              shape: () => ({
                name: { _def: { typeName: 'ZodString' } },
                age: { _def: { typeName: 'ZodNumber' } }
              })
            }
          }]
        },
        meta: {
          mcp: {
            description: 'Test tool',
            category: 'test'
          }
        }
      };

      // Access private method for testing
      const snapshot = (monitor as any).createSchemaSnapshot('testTool', testProcedure);
      
      expect(snapshot.toolName).toBe('testTool');
      expect(snapshot.schemaHash).toBeDefined();
      expect(snapshot.metadata).toBeDefined();
    });

    test('should detect hash changes between snapshots', () => {
      const schema1 = { properties: { name: { type: 'string' } }, required: ['name'] };
      const schema2 = { properties: { name: { type: 'string' }, age: { type: 'number' } }, required: ['name', 'age'] };

      const hash1 = (monitor as any).hashSchema(schema1);
      const hash2 = (monitor as any).hashSchema(schema2);

      expect(hash1).not.toBe(hash2);
    });

    test('should produce consistent hashes for identical schemas', () => {
      const schema = { properties: { name: { type: 'string' }, age: { type: 'number' } } };
      
      const hash1 = (monitor as any).hashSchema(schema);
      const hash2 = (monitor as any).hashSchema(schema);

      expect(hash1).toBe(hash2);
    });
  });

  describe('Risk Assessment', () => {
    test('should assess parameter addition impact correctly', () => {
      // Test critical system parameter
      const criticalImpact = (monitor as any).assessAdditionImpact('execCommand', { type: 'string' });
      expect(criticalImpact).toBe('critical');

      // Test file parameter
      const highImpact = (monitor as any).assessAdditionImpact('filePath', { type: 'string' });
      expect(highImpact).toBe('high');

      // Test regular parameter
      const lowImpact = (monitor as any).assessAdditionImpact('displayName', { type: 'string' });
      expect(lowImpact).toBe('low');
    });

    test('should assess parameter removal impact correctly', () => {
      // Test critical system parameter removal
      const criticalImpact = (monitor as any).assessRemovalImpact('commandPath', { required: true });
      expect(criticalImpact).toBe('critical');

      // Test required parameter removal
      const highImpact = (monitor as any).assessRemovalImpact('userId', { required: true, type: 'object' });
      expect(highImpact).toBe('high');

      // Test optional parameter removal
      const mediumImpact = (monitor as any).assessRemovalImpact('displayName', { required: false });
      expect(mediumImpact).toBe('medium');
    });

    test('should calculate risk scores appropriately', () => {
      const changes = [
        { type: 'parameter_added', field: 'execCommand', impact: 'critical' },
        { type: 'parameter_added', field: 'name', impact: 'low' }
      ];
      
      const metadata = {
        hasSystemAccess: true,
        hasFileInputs: false,
        requiredParameterCount: 3
      };

      const riskScore = (monitor as any).calculateRiskScore(changes, metadata);
      expect(riskScore).toBeGreaterThan(5); // Should be high due to critical change + system access
    });
  });

  describe('Severity Calculation', () => {
    test('should assign critical severity for critical changes', () => {
      const changes = [
        { type: 'parameter_added', field: 'execCommand', impact: 'critical' }
      ];
      
      const severity = (monitor as any).calculateSeverity(changes, 25);
      expect(severity).toBe(SecuritySeverity.CRITICAL);
    });

    test('should assign high severity for multiple high-impact changes', () => {
      const changes = [
        { type: 'parameter_added', field: 'filePath', impact: 'high' },
        { type: 'parameter_removed', field: 'userId', impact: 'high' }
      ];
      
      const severity = (monitor as any).calculateSeverity(changes, 40);
      expect(severity).toBe(SecuritySeverity.HIGH);
    });

    test('should assign low severity for minor changes', () => {
      const changes = [
        { type: 'description_changed', field: 'name', impact: 'low' }
      ];
      
      const severity = (monitor as any).calculateSeverity(changes, 10);
      expect(severity).toBe(SecuritySeverity.LOW);
    });
  });

  describe('Configuration Handling', () => {
    test('should handle strict configuration', () => {
      const strictMonitor = new MCPFunctionMonitor(mockSecurityLogger, {
        changeDetectionLevel: 'strict'
      });

      const stats = strictMonitor.getMonitoringStats();
      expect(stats.config.changeDetectionLevel).toBe('strict');
      expect(stats.config.changeThresholds.strict).toBe(0);
      
      strictMonitor.stopMonitoring();
    });

    test('should handle loose configuration', () => {
      const looseMonitor = new MCPFunctionMonitor(mockSecurityLogger, {
        changeDetectionLevel: 'loose'
      });

      const stats = looseMonitor.getMonitoringStats();
      expect(stats.config.changeDetectionLevel).toBe('loose');
      expect(stats.config.changeThresholds.loose).toBe(60);
      
      looseMonitor.stopMonitoring();
    });
  });

  describe('Tool Management', () => {
    test('should handle tool enablement correctly', () => {
      // Add tool to disabled set first
      (monitor as any).disabledTools.add('testTool');
      
      const initialCount = monitor.getMonitoringStats().disabledTools;
      expect(initialCount).toBe(1);
      
      // Enable the tool
      monitor.enableTool('testTool', 'admin');
      
      const finalCount = monitor.getMonitoringStats().disabledTools;
      expect(finalCount).toBe(0);
      
      // Should have logged the event
      expect(mockSecurityLogger.logSecurityEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: SecurityEventType.ADMIN_ACTION
        })
      );
    });

    test('should handle schema change approval', () => {
      const initialChangesCount = monitor.getMonitoringStats().config.allowedChanges.length;
      
      monitor.approveSchemaChange('testTool', ['parameter_added:newField'], 7, 'admin');
      
      const finalChangesCount = monitor.getMonitoringStats().config.allowedChanges.length;
      expect(finalChangesCount).toBe(initialChangesCount + 1);
      
      const allowedChange = monitor.getMonitoringStats().config.allowedChanges[finalChangesCount - 1];
      expect(allowedChange.toolName).toBe('testTool');
      expect(allowedChange.expectedChanges).toContain('parameter_added:newField');
      expect(allowedChange.approvedBy).toBe('admin');
    });
  });

  describe('Change Analysis Logic', () => {
    test('should identify parameter additions correctly', () => {
      const oldSchema = {
        properties: {
          name: { type: 'string', description: 'User name' }
        },
        required: ['name']
      };
      
      const newSchema = {
        properties: {
          name: { type: 'string', description: 'User name' },
          age: { type: 'number', description: 'User age' }
        },
        required: ['name']
      };

      const oldSnapshot = {
        toolName: 'test',
        timestamp: new Date().toISOString(),
        schemaHash: 'old-hash',
        jsonSchema: oldSchema,
        metadata: { inputParameterCount: 1, requiredParameterCount: 1, hasFileInputs: false, hasSystemAccess: false }
      };

      const newSnapshot = {
        toolName: 'test',
        timestamp: new Date().toISOString(),
        schemaHash: 'new-hash',
        jsonSchema: newSchema,
        metadata: { inputParameterCount: 2, requiredParameterCount: 1, hasFileInputs: false, hasSystemAccess: false }
      };

      // This would be called internally by analyzeSchemaChange
      const hasChanged = (monitor as any).hasSchemaChanged(oldSnapshot, newSnapshot);
      expect(hasChanged).toBe(true);
    });
  });
});