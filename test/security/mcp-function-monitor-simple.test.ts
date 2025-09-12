/**
 * Simplified tests for MCP Function Signature Monitor
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import { MCPFunctionMonitor } from '../../src/security/mcp-function-monitor';
import { SecurityLogger, SecurityEventType } from '../../src/security/security-logger';

// Mock SecurityLogger
const mockSecurityLogger = {
  logSecurityEvent: vi.fn().mockResolvedValue(undefined)
} as unknown as SecurityLogger;

describe('MCPFunctionMonitor - Core Functionality', () => {
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
    // Clean up monitoring
    monitor.stopMonitoring();
  });

  test('should initialize with correct configuration', () => {
    const stats = monitor.getMonitoringStats();
    expect(stats.config.changeDetectionLevel).toBe('moderate');
    expect(stats.uptime).toBe('inactive');
  });

  test('should handle empty router gracefully', () => {
    const emptyRouter = { _def: { procedures: {} } };
    monitor.startMonitoring(emptyRouter);
    
    const stats = monitor.getMonitoringStats();
    expect(stats.monitoredTools).toBe(0);
    expect(stats.uptime).toBe('active');
    
    monitor.stopMonitoring();
  });

  test('should track approved schema changes', () => {
    const testDate = new Date();
    testDate.setDate(testDate.getDate() + 7);
    
    monitor.approveSchemaChange('testTool', ['parameter_added:newParam'], 7, 'admin');
    
    const config = monitor.getMonitoringStats().config;
    expect(config.allowedChanges).toHaveLength(1);
    expect(config.allowedChanges[0].toolName).toBe('testTool');
    expect(config.allowedChanges[0].expectedChanges).toContain('parameter_added:newParam');
    expect(config.allowedChanges[0].approvedBy).toBe('admin');
  });

  test('should log tool enable events when tool was disabled', () => {
    // First add the tool to disabled set (simulate it being disabled)
    (monitor as any).disabledTools.add('testTool');
    
    monitor.enableTool('testTool', 'admin');
    
    expect(mockSecurityLogger.logSecurityEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: SecurityEventType.ADMIN_ACTION,
        details: expect.objectContaining({
          message: expect.stringContaining('MCP tool manually re-enabled: testTool')
        })
      })
    );
  });

  test('should not log when enabling non-disabled tool', () => {
    // Clear any previous calls
    vi.clearAllMocks();
    
    // Tool is not in disabled set
    monitor.enableTool('testTool', 'admin');
    
    // Should not log because tool wasn't actually disabled
    expect(mockSecurityLogger.logSecurityEvent).not.toHaveBeenCalled();
  });

  test('should track disabled tools correctly', () => {
    const stats = monitor.getMonitoringStats();
    const initialDisabledCount = stats.disabledTools;
    
    // Add a tool to disabled set
    (monitor as any).disabledTools.add('testTool');
    
    const statsAfterDisable = monitor.getMonitoringStats();
    expect(statsAfterDisable.disabledTools).toBe(initialDisabledCount + 1);
    
    // Enable the tool
    monitor.enableTool('testTool', 'admin');
    
    const statsAfterEnable = monitor.getMonitoringStats();
    expect(statsAfterEnable.disabledTools).toBe(initialDisabledCount);
  });

  test('should provide monitoring statistics', () => {
    const stats = monitor.getMonitoringStats();
    
    expect(stats).toHaveProperty('monitoredTools');
    expect(stats).toHaveProperty('disabledTools');
    expect(stats).toHaveProperty('config');
    expect(stats).toHaveProperty('uptime');
    expect(typeof stats.monitoredTools).toBe('number');
    expect(typeof stats.disabledTools).toBe('number');
  });

  test('should stop monitoring cleanly', () => {
    monitor.startMonitoring({ _def: { procedures: {} } });
    expect(monitor.getMonitoringStats().uptime).toBe('active');
    
    monitor.stopMonitoring();
    expect(monitor.getMonitoringStats().uptime).toBe('inactive');
  });

  test('should handle different sensitivity levels', () => {
    const strictMonitor = new MCPFunctionMonitor(mockSecurityLogger, {
      changeDetectionLevel: 'strict'
    });
    
    const looseMonitor = new MCPFunctionMonitor(mockSecurityLogger, {
      changeDetectionLevel: 'loose'
    });
    
    expect(strictMonitor.getMonitoringStats().config.changeDetectionLevel).toBe('strict');
    expect(looseMonitor.getMonitoringStats().config.changeDetectionLevel).toBe('loose');
  });

  test('should support auto-disable configuration', () => {
    const autoDisableMonitor = new MCPFunctionMonitor(mockSecurityLogger, {
      autoDisableOnChange: true
    });
    
    expect(autoDisableMonitor.getMonitoringStats().config.autoDisableOnChange).toBe(true);
  });
});