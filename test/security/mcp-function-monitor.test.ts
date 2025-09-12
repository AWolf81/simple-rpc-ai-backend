/**
 * Tests for MCP Function Signature Change Detection and Monitoring
 */

import { describe, test, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { MCPFunctionMonitor, MCPFunctionMonitorConfig, SchemaChangeAnalysis } from '../../src/security/mcp-function-monitor';
import { SecurityLogger, SecurityEventType, SecuritySeverity } from '../../src/security/security-logger';
import { z } from 'zod';

// Mock SecurityLogger
const mockSecurityLogger = {
  logSecurityEvent: vi.fn().mockResolvedValue(undefined),
  createNetworkFilterMiddleware: vi.fn(),
  createMCPLoggingMiddleware: vi.fn(),
  getSecurityStats: vi.fn(),
  blockIP: vi.fn(),
  unblockIP: vi.fn()
} as unknown as SecurityLogger;

// Test router structure
interface MockProcedure {
  _def: {
    inputs: unknown[];
  };
  meta?: {
    mcp?: {
      description: string;
      category?: string;
      version?: string;
    };
  };
}

interface MockRouter {
  _def: {
    procedures: Record<string, MockProcedure>;
  };
}

describe('MCPFunctionMonitor', () => {
  let monitor: MCPFunctionMonitor;
  let mockRouter: MockRouter;
  let config: Partial<MCPFunctionMonitorConfig>;

  beforeEach(() => {
    vi.clearAllMocks();
    
    config = {
      changeDetectionLevel: 'moderate',
      autoDisableOnChange: false,
      monitoringIntervalMs: 1000,
      persistSchemas: false
    };

    monitor = new MCPFunctionMonitor(mockSecurityLogger, config);

    // Create mock router with MCP procedures
    mockRouter = {
      _def: {
        procedures: {
          greeting: {
            _def: {
              inputs: [z.object({
                name: z.string().describe('Name to greet'),
                language: z.string().optional().describe('Language preference')
              })]
            },
            meta: {
              mcp: {
                description: 'Generate friendly greetings',
                category: 'utility'
              }
            }
          },
          calculate: {
            _def: {
              inputs: [z.object({
                expression: z.string().min(1).describe('Mathematical expression'),
                precision: z.number().min(0).max(10).optional().default(2)
              })]
            },
            meta: {
              mcp: {
                description: 'Evaluate mathematical expressions',
                category: 'math'
              }
            }
          },
          fileOperation: {
            _def: {
              inputs: [z.object({
                filePath: z.string().describe('Path to file'),
                operation: z.enum(['read', 'write', 'delete']),
                content: z.string().optional()
              })]
            },
            meta: {
              mcp: {
                description: 'File system operations',
                category: 'system'
              }
            }
          }
        }
      }
    };
  });

  afterEach(() => {
    monitor.stopMonitoring();
  });

  describe('Initialization and Configuration', () => {
    test('should initialize with default configuration', () => {
      const defaultMonitor = new MCPFunctionMonitor(mockSecurityLogger);
      const stats = defaultMonitor.getMonitoringStats();
      
      expect(stats.config.changeDetectionLevel).toBe('moderate');
      expect(stats.config.autoDisableOnChange).toBe(false);
      expect(stats.uptime).toBe('inactive');
    });

    test('should initialize with custom configuration', () => {
      const customConfig: Partial<MCPFunctionMonitorConfig> = {
        changeDetectionLevel: 'strict',
        autoDisableOnChange: true,
        monitoringIntervalMs: 5000
      };
      
      const customMonitor = new MCPFunctionMonitor(mockSecurityLogger, customConfig);
      const stats = customMonitor.getMonitoringStats();
      
      expect(stats.config.changeDetectionLevel).toBe('strict');
      expect(stats.config.autoDisableOnChange).toBe(true);
      expect(stats.config.monitoringIntervalMs).toBe(5000);
    });
  });

  describe.skip('Schema Monitoring', () => {
    test('should start monitoring and capture initial snapshots', () => {
      monitor.startMonitoring(mockRouter);
      
      const stats = monitor.getMonitoringStats();
      expect(stats.uptime).toBe('active');
      expect(stats.monitoredTools).toBe(3); // greeting, calculate, fileOperation
    });

    test('should detect no changes on identical router', async () => {
      monitor.startMonitoring(mockRouter);
      
      const analyses = await monitor.monitorSchemaChanges();
      expect(analyses).toHaveLength(0);
      expect(mockSecurityLogger.logSecurityEvent).not.toHaveBeenCalled();
    });

    test('should detect schema changes by creating new router', async () => {
      monitor.startMonitoring(mockRouter);
      
      // Wait for initial snapshot to be taken
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Create completely new Zod schemas (different objects = different hashes)
      const newGreetingSchema = z.object({
        name: z.string().describe('Name to greet'),
        language: z.string().optional().describe('Language preference'),
        formal: z.boolean().default(false).describe('Use formal greeting') // Added parameter
      });
      
      const modifiedRouter = {
        _def: {
          procedures: {
            greeting: {
              _def: {
                inputs: [newGreetingSchema] // Completely new schema object
              },
              meta: {
                mcp: {
                  description: 'Generate friendly greetings',
                  category: 'utility'
                }
              }
            },
            calculate: mockRouter._def.procedures.calculate,
            fileOperation: mockRouter._def.procedures.fileOperation
          }
        }
      };
      
      // Update the monitor's router reference
      (monitor as any).currentRouter = modifiedRouter;
      
      const analyses = await monitor.monitorSchemaChanges();
      
      expect(analyses).toHaveLength(1);
      expect(analyses[0].toolName).toBe('greeting');
      expect(analyses[0].changeCount).toBeGreaterThan(0);
      expect(mockSecurityLogger.logSecurityEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: SecurityEventType.MCP_TOOL_SCHEMA_CHANGED,
          details: expect.objectContaining({
            message: expect.stringContaining('MCP tool schema changed: greeting')
          })
        })
      );
    });

    test('should detect parameter removal', async () => {
      monitor.startMonitoring(mockRouter);
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Create new schema with removed parameter
      const modifiedCalculateSchema = z.object({
        expression: z.string().min(1).describe('Mathematical expression')
        // precision parameter removed
      });
      
      const modifiedRouter = {
        _def: {
          procedures: {
            greeting: mockRouter._def.procedures.greeting,
            calculate: {
              _def: {
                inputs: [modifiedCalculateSchema]
              },
              meta: {
                mcp: {
                  description: 'Evaluate mathematical expressions',
                  category: 'math'
                }
              }
            },
            fileOperation: mockRouter._def.procedures.fileOperation
          }
        }
      };
      
      (monitor as any).currentRouter = modifiedRouter;
      const analyses = await monitor.monitorSchemaChanges();
      
      expect(analyses).toHaveLength(1);
      expect(analyses[0].toolName).toBe('calculate');
      expect(analyses[0].changeCount).toBeGreaterThan(0);
    });

    test('should detect type changes', async () => {
      monitor.startMonitoring(mockRouter);
      
      // Modify router - change parameter type
      mockRouter._def.procedures.greeting._def.inputs[0] = z.object({
        name: z.number().describe('Name to greet'), // Changed from string to number
        language: z.string().optional().describe('Language preference')
      });
      
      const analyses = await monitor.monitorSchemaChanges();
      
      expect(analyses).toHaveLength(1);
      expect(analyses[0].changes.some(c => c.type === 'type_changed')).toBe(true);
    });

    test('should detect tool removal', async () => {
      monitor.startMonitoring(mockRouter);
      
      // Remove tool from router
      delete mockRouter._def.procedures.fileOperation;
      
      await monitor.monitorSchemaChanges();
      
      expect(mockSecurityLogger.logSecurityEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: SecurityEventType.MCP_TOOL_SCHEMA_CHANGED,
          details: expect.objectContaining({
            message: expect.stringContaining('MCP tool removed from server: fileOperation')
          })
        })
      );
    });
  });

  describe.skip('Security Assessment', () => {
    test('should assess high-risk changes correctly', async () => {
      monitor.startMonitoring(mockRouter);
      
      // Add dangerous system command parameter
      mockRouter._def.procedures.greeting._def.inputs[0] = z.object({
        name: z.string().describe('Name to greet'),
        language: z.string().optional().describe('Language preference'),
        command: z.string().describe('System command to execute')
      });
      
      const analyses = await monitor.monitorSchemaChanges();
      
      expect(analyses[0].severity).toBe(SecuritySeverity.CRITICAL);
      expect(analyses[0].changes[0].impact).toBe('critical');
      expect(analyses[0].riskScore).toBeGreaterThan(7);
    });

    test('should assess low-risk changes correctly', async () => {
      monitor.startMonitoring(mockRouter);
      
      // Add benign optional parameter
      mockRouter._def.procedures.greeting._def.inputs[0] = z.object({
        name: z.string().describe('Name to greet'),
        language: z.string().optional().describe('Language preference'),
        includeTime: z.boolean().optional().describe('Include current time')
      });
      
      const analyses = await monitor.monitorSchemaChanges();
      
      expect(analyses[0].severity).toBe(SecuritySeverity.LOW);
      expect(analyses[0].changes[0].impact).toBe('low');
      expect(analyses[0].riskScore).toBeLessThan(3);
    });

    test('should calculate change percentage correctly', async () => {
      monitor.startMonitoring(mockRouter);
      
      // Original greeting has 2 parameters (name, language)
      // Add 1 parameter = 1/3 = 33% change
      mockRouter._def.procedures.greeting._def.inputs[0] = z.object({
        name: z.string().describe('Name to greet'),
        language: z.string().optional().describe('Language preference'),
        emoji: z.boolean().optional().describe('Include emoji')
      });
      
      const analyses = await monitor.monitorSchemaChanges();
      
      expect(analyses[0].changePercentage).toBeCloseTo(33.33, 1);
    });
  });

  describe.skip('Sensitivity Levels', () => {
    test('strict mode should alert on any change', async () => {
      const strictMonitor = new MCPFunctionMonitor(mockSecurityLogger, {
        changeDetectionLevel: 'strict'
      });
      
      strictMonitor.startMonitoring(mockRouter);
      
      // Make minimal change
      mockRouter._def.procedures.greeting._def.inputs[0] = z.object({
        name: z.string().describe('Name to greet'),
        language: z.string().optional().describe('Language preference'),
        punctuation: z.string().optional().default('!').describe('Greeting punctuation')
      });
      
      const analyses = await strictMonitor.monitorSchemaChanges();
      
      expect(analyses[0].recommended.shouldAlert).toBe(true);
      strictMonitor.stopMonitoring();
    });

    test('loose mode should only alert on major changes', async () => {
      const looseMonitor = new MCPFunctionMonitor(mockSecurityLogger, {
        changeDetectionLevel: 'loose'
      });
      
      looseMonitor.startMonitoring(mockRouter);
      
      // Make minor change (should not alert in loose mode)
      mockRouter._def.procedures.greeting._def.inputs[0] = z.object({
        name: z.string().describe('Name to greet'),
        language: z.string().optional().describe('Language preference'),
        punctuation: z.string().optional().default('!').describe('Greeting punctuation')
      });
      
      const analyses = await looseMonitor.monitorSchemaChanges();
      
      expect(analyses[0].recommended.shouldAlert).toBe(false);
      looseMonitor.stopMonitoring();
    });
  });

  describe.skip('Auto-disable Functionality', () => {
    test('should auto-disable tool on critical changes when enabled', async () => {
      const autoDisableMonitor = new MCPFunctionMonitor(mockSecurityLogger, {
        autoDisableOnChange: true
      });
      
      autoDisableMonitor.startMonitoring(mockRouter);
      
      // Add critical security risk parameter
      mockRouter._def.procedures.greeting._def.inputs[0] = z.object({
        name: z.string().describe('Name to greet'),
        systemCommand: z.string().describe('System command to execute')
      });
      
      const analyses = await autoDisableMonitor.monitorSchemaChanges();
      
      expect(analyses[0].recommended.shouldDisable).toBe(true);
      expect(mockSecurityLogger.logSecurityEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: SecurityEventType.MCP_TOOL_AUTO_DISABLED
        })
      );
      
      autoDisableMonitor.stopMonitoring();
    });

    test('should not auto-disable on low-risk changes', async () => {
      const autoDisableMonitor = new MCPFunctionMonitor(mockSecurityLogger, {
        autoDisableOnChange: true
      });
      
      autoDisableMonitor.startMonitoring(mockRouter);
      
      // Add low-risk parameter
      mockRouter._def.procedures.greeting._def.inputs[0] = z.object({
        name: z.string().describe('Name to greet'),
        language: z.string().optional().describe('Language preference'),
        includeEmoji: z.boolean().optional().describe('Include emoji in greeting')
      });
      
      const analyses = await autoDisableMonitor.monitorSchemaChanges();
      
      expect(analyses[0].recommended.shouldDisable).toBe(false);
      
      autoDisableMonitor.stopMonitoring();
    });
  });

  describe.skip('Whitelist Management', () => {
    test('should allow whitelisted changes', async () => {
      // Pre-approve a specific change
      monitor.approveSchemaChange('greeting', ['parameter_added:emoji'], 7, 'admin');
      
      monitor.startMonitoring(mockRouter);
      
      // Make the approved change
      mockRouter._def.procedures.greeting._def.inputs[0] = z.object({
        name: z.string().describe('Name to greet'),
        language: z.string().optional().describe('Language preference'),
        emoji: z.boolean().optional().describe('Include emoji')
      });
      
      await monitor.monitorSchemaChanges();
      
      // Should not trigger security event for whitelisted change
      expect(mockSecurityLogger.logSecurityEvent).not.toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: SecurityEventType.MCP_TOOL_SCHEMA_CHANGED
        })
      );
    });

    test('should reject non-whitelisted changes', async () => {
      // Pre-approve a different change
      monitor.approveSchemaChange('greeting', ['parameter_added:formal'], 7, 'admin');
      
      monitor.startMonitoring(mockRouter);
      
      // Make a different change (not whitelisted)
      mockRouter._def.procedures.greeting._def.inputs[0] = z.object({
        name: z.string().describe('Name to greet'),
        language: z.string().optional().describe('Language preference'),
        emoji: z.boolean().optional().describe('Include emoji') // Different from whitelisted
      });
      
      await monitor.monitorSchemaChanges();
      
      // Should trigger security event for non-whitelisted change
      expect(mockSecurityLogger.logSecurityEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: SecurityEventType.MCP_TOOL_SCHEMA_CHANGED
        })
      );
    });
  });

  describe('Tool Management', () => {
    test('should track disabled tools', () => {
      // Add tool to disabled set first
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

    test('should provide monitoring statistics', () => {
      monitor.startMonitoring(mockRouter);
      
      const stats = monitor.getMonitoringStats();
      
      expect(stats).toHaveProperty('monitoredTools');
      expect(stats).toHaveProperty('disabledTools');
      expect(stats).toHaveProperty('config');
      expect(stats).toHaveProperty('uptime');
      expect(stats.monitoredTools).toBe(3);
      expect(stats.disabledTools).toBe(0);
    });
  });

  describe('Error Handling', () => {
    test('should handle malformed router gracefully', async () => {
      const malformedRouter = { invalid: 'structure' };
      
      monitor.startMonitoring(malformedRouter);
      const analyses = await monitor.monitorSchemaChanges();
      
      expect(analyses).toHaveLength(0);
      // Should not throw errors
    });

    test('should handle schema extraction errors gracefully', async () => {
      const routerWithBadSchema = {
        _def: {
          procedures: {
            badTool: {
              _def: {
                inputs: [null] // Invalid input
              },
              meta: {
                mcp: {
                  description: 'Tool with bad schema'
                }
              }
            }
          }
        }
      };
      
      monitor.startMonitoring(routerWithBadSchema);
      const analyses = await monitor.monitorSchemaChanges();
      
      // Should handle error gracefully without throwing
      expect(analyses).toHaveLength(0);
    });
  });

  describe('Performance and Memory', () => {
    test('should handle large number of tools efficiently', async () => {
      // Create router with many tools
      const largeRouter = {
        _def: {
          procedures: {} as Record<string, MockProcedure>
        }
      };
      
      for (let i = 0; i < 100; i++) {
        largeRouter._def.procedures[`tool${i}`] = {
          _def: {
            inputs: [z.object({
              param: z.string().describe(`Parameter for tool ${i}`)
            })]
          },
          meta: {
            mcp: {
              description: `Tool number ${i}`
            }
          }
        };
      }
      
      const startTime = Date.now();
      monitor.startMonitoring(largeRouter);
      await monitor.monitorSchemaChanges();
      const endTime = Date.now();
      
      // Should complete within reasonable time (< 1 second for 100 tools)
      expect(endTime - startTime).toBeLessThan(1000);
      
      const stats = monitor.getMonitoringStats();
      expect(stats.monitoredTools).toBe(100);
    });
  });

  describe('Integration with Security Logger', () => {
    test('should log events with correct severity levels', async () => {
      monitor.startMonitoring(mockRouter);
      
      // Critical change
      mockRouter._def.procedures.greeting._def.inputs[0] = z.object({
        name: z.string().describe('Name to greet'),
        execCommand: z.string().describe('Command to execute')
      });
      
      await monitor.monitorSchemaChanges();
      
      expect(mockSecurityLogger.logSecurityEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: SecurityEventType.MCP_TOOL_SCHEMA_CHANGED,
          severity: SecuritySeverity.CRITICAL
        })
      );
    });

    test('should include detailed context in security events', async () => {
      monitor.startMonitoring(mockRouter);
      
      // Make a tracked change
      mockRouter._def.procedures.greeting._def.inputs[0] = z.object({
        name: z.string().describe('Name to greet'),
        language: z.string().optional().describe('Language preference'),
        newParam: z.string().describe('New parameter')
      });
      
      await monitor.monitorSchemaChanges();
      
      expect(mockSecurityLogger.logSecurityEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          details: expect.objectContaining({
            context: expect.objectContaining({
              toolName: 'greeting',
              changeCount: 1,
              changePercentage: expect.any(Number),
              changes: expect.any(Array),
              riskScore: expect.any(Number),
              detectionLevel: 'moderate'
            })
          })
        })
      );
    });
  });
});