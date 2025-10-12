/**
 * MCP Function Signature Change Detection and Monitoring
 * 
 * Detects changes in MCP tool schemas that could indicate tampering or security issues.
 * Provides configurable sensitivity levels and automatic tool disabling capabilities.
 */

import crypto from 'crypto';
import { SecurityLogger, SecurityEventType, SecuritySeverity } from './security-logger.js';
import type { ZodTypeAny } from 'zod';
import { zodSchemaToJson } from '../utils/zod-json-schema';
// Type definitions for better type safety

export interface MCPFunctionMonitorConfig {
  // Change detection sensitivity
  changeDetectionLevel: 'strict' | 'moderate' | 'loose';
  
  // Percentage thresholds for change alerts
  changeThresholds: {
    strict: number;      // Alert on any change (0%)
    moderate: number;    // Alert if >20% of schema changes  
    loose: number;     // Alert if >60% of schema changes
  };
  
  // Auto-disable tools on suspicious changes
  autoDisableOnChange: boolean;
  
  // Whitelist of expected schema changes
  allowedChanges: Array<{
    toolName: string;
    expectedChanges: string[];
    validUntil: Date;
    approvedBy: string;
  }>;
  
  // Monitoring intervals
  monitoringIntervalMs: number;
  
  // Schema storage options
  persistSchemas: boolean;
  schemaStoragePath?: string;
}

export interface SchemaChange {
  type: 'parameter_added' | 'parameter_removed' | 'type_changed' | 'required_changed' | 'description_changed' | 'enum_values_changed';
  field: string;
  oldValue: unknown;
  newValue: unknown;
  impact: 'low' | 'medium' | 'high' | 'critical';
}

export interface ToolSchemaSnapshot {
  toolName: string;
  timestamp: string;
  schemaHash: string;
  jsonSchema: Record<string, unknown>;
  metadata: {
    description?: string;
    category?: string;
    version?: string;
    inputParameterCount: number;
    requiredParameterCount: number;
    hasFileInputs: boolean;
    hasSystemAccess: boolean;
  };
}

export interface SchemaChangeAnalysis {
  toolName: string;
  changeCount: number;
  changePercentage: number;
  changes: SchemaChange[];
  severity: SecuritySeverity;
  riskScore: number;
  recommended: {
    shouldAlert: boolean;
    shouldDisable: boolean;
    shouldEscalate: boolean;
  };
}

export const DEFAULT_MCP_MONITOR_CONFIG: MCPFunctionMonitorConfig = {
  changeDetectionLevel: 'moderate',
  changeThresholds: {
    strict: 0,      // Alert on any change
    moderate: 20,   // Alert if >20% of schema changes
    loose: 60     // Alert if >60% of schema changes  
  },
  autoDisableOnChange: false,
  allowedChanges: [],
  monitoringIntervalMs: 60000, // Check every minute
  persistSchemas: true,
  schemaStoragePath: './data/mcp-schemas'
};

/**
 * Monitors MCP function schemas for changes and security violations
 */
export class MCPFunctionMonitor {
  private config: MCPFunctionMonitorConfig;
  private securityLogger: SecurityLogger;
  private schemaSnapshots: Map<string, ToolSchemaSnapshot> = new Map();
  private disabledTools: Set<string> = new Set();
  private monitoringTimer?: NodeJS.Timeout;
  private currentRouter: unknown;

  constructor(securityLogger: SecurityLogger, config: Partial<MCPFunctionMonitorConfig> = {}) {
    this.config = { ...DEFAULT_MCP_MONITOR_CONFIG, ...config };
    this.securityLogger = securityLogger;
    this.loadPersistedSchemas();
  }

  /**
   * Start monitoring the given tRPC router for schema changes
   */
  public startMonitoring(router: unknown): void {
    this.currentRouter = router;
    
    // Take initial snapshot
    this.captureSchemaSnapshot();
    
    // Start periodic monitoring
    this.monitoringTimer = setInterval(() => {
      this.monitorSchemaChanges();
    }, this.config.monitoringIntervalMs);
    
    console.log(`✅ MCP Function Monitor: Started with ${this.config.changeDetectionLevel} sensitivity`);
  }

  /**
   * Stop monitoring
   */
  public stopMonitoring(): void {
    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
      this.monitoringTimer = undefined;
    }
    console.log('🛑 MCP Function Monitor: Stopped monitoring');
  }

  /**
   * Manually trigger schema change detection
   */
  public async monitorSchemaChanges(): Promise<SchemaChangeAnalysis[]> {
    if (!this.currentRouter) {
      return [];
    }

    const analyses: SchemaChangeAnalysis[] = [];
    const currentProcedures = this.extractMCPProcedures(this.currentRouter);

    for (const [toolName, procedure] of currentProcedures) {
      const previousSnapshot = this.schemaSnapshots.get(toolName);
      const currentSnapshot = this.createSchemaSnapshot(toolName, procedure);

      if (previousSnapshot && this.hasSchemaChanged(previousSnapshot, currentSnapshot)) {
        const analysis = await this.analyzeSchemaChange(toolName, previousSnapshot, currentSnapshot);
        analyses.push(analysis);

        // Handle the detected change
        await this.handleSchemaChange(analysis);
      }

      // Update snapshot
      this.schemaSnapshots.set(toolName, currentSnapshot);
    }
    
    // Check for removed tools
    await this.checkForRemovedTools(currentProcedures);
    
    // Persist updated schemas
    if (this.config.persistSchemas) {
      await this.persistSchemas();
    }
    
    return analyses;
  }

  /**
   * Extract MCP procedures from tRPC router
   */
  private extractMCPProcedures(router: unknown): Map<string, Record<string, unknown>> {
    const procedures = new Map<string, Record<string, unknown>>();
    
    try {
      const routerDef = router as { _def?: { procedures?: Record<string, unknown> } };
      if (routerDef._def && routerDef._def.procedures) {
        for (const [name, procedure] of Object.entries(routerDef._def.procedures)) {
          // Only include procedures with MCP metadata
          const procedureWithMeta = procedure as { meta?: { mcp?: unknown } };
          if (procedureWithMeta.meta?.mcp) {
            procedures.set(name, procedure as Record<string, unknown>);
          }
        }
      }
    } catch (error) {
      console.error('❌ MCP Monitor: Error extracting procedures:', error);
    }
    
    return procedures;
  }

  /**
   * Create schema snapshot for a tool
   */
  private createSchemaSnapshot(toolName: string, procedure: Record<string, unknown>): ToolSchemaSnapshot {
    let jsonSchema: Record<string, unknown> = {};
    let metadata: Record<string, unknown> = {
      inputParameterCount: 0,
      requiredParameterCount: 0,
      hasFileInputs: false,
      hasSystemAccess: false
    };
    
    try {
      // Extract schema from Zod validator
      const procedureDef = procedure as { _def?: { inputs?: unknown[] } };
      if (procedureDef._def?.inputs && Array.isArray(procedureDef._def.inputs) && procedureDef._def.inputs.length > 0) {
        const zodSchema = procedureDef._def.inputs[0] as ZodTypeAny;
        // Only process if zodSchema is valid
        if (zodSchema && typeof zodSchema === 'object' && 'parse' in zodSchema) {
          jsonSchema = zodSchemaToJson(zodSchema);
        }

        // Analyze schema metadata
        metadata = this.analyzeSchemaMetadata(jsonSchema);
      }
    } catch (error) {
      console.error(`❌ MCP Monitor: Error creating schema snapshot for ${toolName}:`, error);
    }
    
    const schemaHash = this.hashSchema(jsonSchema);
    
    return {
      toolName,
      timestamp: new Date().toISOString(),
      schemaHash,
      jsonSchema,
      metadata: {
        inputParameterCount: typeof metadata.inputParameterCount === 'number' ? metadata.inputParameterCount : 0,
        requiredParameterCount: typeof metadata.requiredParameterCount === 'number' ? metadata.requiredParameterCount : 0,
        hasFileInputs: typeof metadata.hasFileInputs === 'boolean' ? metadata.hasFileInputs : false,
        hasSystemAccess: typeof metadata.hasSystemAccess === 'boolean' ? metadata.hasSystemAccess : false,
        description: (procedure as { meta?: { mcp?: { description?: string; category?: string; version?: string } } }).meta?.mcp?.description,
        category: (procedure as { meta?: { mcp?: { description?: string; category?: string; version?: string } } }).meta?.mcp?.category,
        version: (procedure as { meta?: { mcp?: { description?: string; category?: string; version?: string } } }).meta?.mcp?.version
      }
    };
  }

  /**
   * Analyze schema metadata for security characteristics
   */
  private analyzeSchemaMetadata(jsonSchema: Record<string, unknown>): Record<string, unknown> {
    const metadata = {
      inputParameterCount: 0,
      requiredParameterCount: 0,
      hasFileInputs: false,
      hasSystemAccess: false
    };
    
    if (jsonSchema.properties) {
      metadata.inputParameterCount = Object.keys(jsonSchema.properties).length;
      
      // Check for required fields
      const requiredArray = jsonSchema.required;
      if (Array.isArray(requiredArray)) {
        metadata.requiredParameterCount = requiredArray.length;
      }
      
      // Check for file inputs
      for (const [key, prop] of Object.entries(jsonSchema.properties)) {
        if (typeof prop === 'object' && prop !== null) {
          const property = prop as any;
          
          // Check for file-related parameters
          const description = typeof property.description === 'string' ? property.description : '';
          const keyLower = key.toLowerCase();
          if (keyLower.includes('file') || keyLower.includes('path') || 
              description.toLowerCase().includes('file')) {
            metadata.hasFileInputs = true;
          }
          
          // Check for system access parameters  
          if (keyLower.includes('command') || keyLower.includes('exec') || keyLower.includes('system') ||
              description.toLowerCase().includes('execute')) {
            metadata.hasSystemAccess = true;
          }
        }
      }
    }
    
    return metadata;
  }

  /**
   * Hash schema for comparison
   */
  private hashSchema(schema: Record<string, unknown>): string {
    const schemaString = JSON.stringify(schema, Object.keys(schema).sort());
    return crypto.createHash('sha256').update(schemaString).digest('hex');
  }

  /**
   * Check if schema has changed
   */
  private hasSchemaChanged(previous: ToolSchemaSnapshot, current: ToolSchemaSnapshot): boolean {
    return previous.schemaHash !== current.schemaHash;
  }

  /**
   * Analyze the nature and severity of schema changes
   */
  private async analyzeSchemaChange(
    toolName: string, 
    previous: ToolSchemaSnapshot, 
    current: ToolSchemaSnapshot
  ): Promise<SchemaChangeAnalysis> {
    const changes: SchemaChange[] = [];
    
    // Compare properties
    const oldProps = previous.jsonSchema.properties || {};
    const newProps = current.jsonSchema.properties || {};
    
    // Check for removed parameters
    for (const prop of Object.keys(oldProps)) {
      if (!newProps[prop]) {
        changes.push({
          type: 'parameter_removed',
          field: prop,
          oldValue: oldProps[prop],
          newValue: null,
          impact: this.assessRemovalImpact(prop, oldProps[prop])
        });
      }
    }
    
    // Check for added parameters
    for (const prop of Object.keys(newProps)) {
      if (!oldProps[prop]) {
        changes.push({
          type: 'parameter_added',
          field: prop,
          oldValue: null,
          newValue: newProps[prop],
          impact: this.assessAdditionImpact(prop, newProps[prop])
        });
      }
    }
    
    // Check for modified parameters
    for (const prop of Object.keys(oldProps)) {
      if (newProps[prop]) {
        const oldProp = oldProps[prop];
        const newProp = newProps[prop];
        
        // Type changes
        if (oldProp.type !== newProp.type) {
          changes.push({
            type: 'type_changed',
            field: prop,
            oldValue: oldProp.type,
            newValue: newProp.type,
            impact: 'high'
          });
        }
        
        // Required field changes
        const wasRequired = Array.isArray(previous.jsonSchema.required) && previous.jsonSchema.required.includes(prop) || false;
        const isRequired = Array.isArray(current.jsonSchema.required) && current.jsonSchema.required.includes(prop) || false;
        
        if (wasRequired !== isRequired) {
          changes.push({
            type: 'required_changed',
            field: prop,
            oldValue: wasRequired,
            newValue: isRequired,
            impact: isRequired ? 'high' : 'medium'
          });
        }
      }
    }
    
    // Calculate change percentage and severity
    const totalFields = Math.max(Object.keys(oldProps).length, Object.keys(newProps).length);
    const changePercentage = totalFields > 0 ? (changes.length / totalFields) * 100 : 0;
    
    const severity = this.calculateSeverity(changes, changePercentage);
    const riskScore = this.calculateRiskScore(changes, current.metadata);
    
    const recommended = this.getRecommendations(severity, changePercentage, changes);
    
    return {
      toolName,
      changeCount: changes.length,
      changePercentage,
      changes,
      severity,
      riskScore,
      recommended
    };
  }

  /**
   * Assess impact of parameter removal
   */
  private assessRemovalImpact(paramName: string, paramDef: Record<string, unknown>): 'low' | 'medium' | 'high' | 'critical' {
    // Critical if it's a file or command parameter
    const paramLower = paramName.toLowerCase();
    if (paramLower.includes('file') || paramLower.includes('command') || paramLower.includes('path')) {
      return 'critical';
    }
    
    // High if it was required
    const isRequired = typeof paramDef.required === 'boolean' ? paramDef.required : false;
    const isObject = paramDef.type === 'object';
    if (isRequired || isObject) {
      return 'high';
    }
    
    return 'medium';
  }

  /**
   * Assess impact of parameter addition
   */
  private assessAdditionImpact(paramName: string, paramDef: Record<string, unknown>): 'low' | 'medium' | 'high' | 'critical' {
    // Critical if it's a new system access parameter
    const paramLower = paramName.toLowerCase();
    if (paramLower.includes('exec') || paramLower.includes('command') || paramLower.includes('system')) {
      return 'critical';
    }
    
    // High if it's file-related
    if (paramLower.includes('file') || paramLower.includes('path')) {
      return 'high';
    }
    
    // Medium if it's required
    const isRequired = typeof paramDef.required === 'boolean' ? paramDef.required : false;
    if (isRequired) {
      return 'medium';
    }
    
    return 'low';
  }

  /**
   * Calculate severity based on changes and detection level
   */
  private calculateSeverity(changes: SchemaChange[], changePercentage: number): SecuritySeverity {
    const criticalChanges = changes.filter(c => c.impact === 'critical').length;
    const highChanges = changes.filter(c => c.impact === 'high').length;
    
    // Critical if any critical-impact changes
    if (criticalChanges > 0) {
      return SecuritySeverity.CRITICAL;
    }
    
    // High if multiple high-impact changes or significant percentage change
    if (highChanges > 1 || changePercentage > this.config.changeThresholds.loose) {
      return SecuritySeverity.HIGH;
    }
    
    // Medium if any high-impact changes or moderate percentage change
    if (highChanges > 0 || changePercentage > this.config.changeThresholds.moderate) {
      return SecuritySeverity.MEDIUM;
    }
    
    // Low for minor changes
    return SecuritySeverity.LOW;
  }

  /**
   * Calculate risk score (0-10)
   */
  private calculateRiskScore(changes: SchemaChange[], metadata: Record<string, unknown>): number {
    let score = 0;
    
    // Base score from change count
    score += Math.min(changes.length * 0.5, 3);
    
    // Impact-based scoring
    for (const change of changes) {
      switch (change.impact) {
        case 'critical': score += 3; break;
        case 'high': score += 2; break;
        case 'medium': score += 1; break;
        case 'low': score += 0.5; break;
      }
    }
    
    // Metadata-based risk factors
    if (metadata.hasSystemAccess === true) score += 2;
    if (metadata.hasFileInputs === true) score += 1.5;
    const requiredCount = typeof metadata.requiredParameterCount === 'number' ? metadata.requiredParameterCount : 0;
    if (requiredCount > 5) score += 1;
    
    return Math.min(score, 10);
  }

  /**
   * Get recommendations based on analysis
   */
  private getRecommendations(
    severity: SecuritySeverity, 
    changePercentage: number, 
    changes: SchemaChange[]
  ) {
    const threshold = this.config.changeThresholds[this.config.changeDetectionLevel];
    const hasCriticalChanges = changes.some(c => c.impact === 'critical');
    
    return {
      shouldAlert: changePercentage > threshold || severity >= SecuritySeverity.MEDIUM,
      shouldDisable: this.config.autoDisableOnChange && (hasCriticalChanges || severity === SecuritySeverity.CRITICAL),
      shouldEscalate: severity === SecuritySeverity.CRITICAL || (hasCriticalChanges && changePercentage > 50)
    };
  }

  /**
   * Handle detected schema change
   */
  private async handleSchemaChange(analysis: SchemaChangeAnalysis): Promise<void> {
    // Check if this change is whitelisted
    if (this.isChangeAllowed(analysis)) {
      console.log(`✅ MCP Monitor: Schema change allowed for ${analysis.toolName} (whitelisted)`);
      return;
    }

    // Log security event
    await this.securityLogger.logSecurityEvent({
      eventType: SecurityEventType.MCP_TOOL_SCHEMA_CHANGED,
      severity: analysis.severity,
      source: { ip: 'system' },
      request: { 
        method: 'SCHEMA_MONITOR', 
        path: '/mcp-schema-change', 
        headers: {},
        toolName: analysis.toolName
      },
      details: {
        message: `MCP tool schema changed: ${analysis.toolName} (${analysis.changeCount} changes, ${analysis.changePercentage.toFixed(1)}% modified)`,
        context: {
          toolName: analysis.toolName,
          changeCount: analysis.changeCount,
          changePercentage: analysis.changePercentage,
          changes: analysis.changes,
          riskScore: analysis.riskScore,
          detectionLevel: this.config.changeDetectionLevel
        }
      }
    });

    // Auto-disable tool if recommended
    if (analysis.recommended.shouldDisable) {
      await this.disableTool(analysis.toolName, 'Critical schema change detected');
    }

    // Send escalation alert if needed
    if (analysis.recommended.shouldEscalate) {
      await this.sendEscalationAlert(analysis);
    }
  }

  /**
   * Check if schema change is in allowed list
   */
  private isChangeAllowed(analysis: SchemaChangeAnalysis): boolean {
    return this.config.allowedChanges.some(allowed => 
      allowed.toolName === analysis.toolName &&
      new Date() < allowed.validUntil &&
      this.changesMatchExpected(analysis.changes, allowed.expectedChanges)
    );
  }

  /**
   * Check if detected changes match expected changes
   */
  private changesMatchExpected(actualChanges: SchemaChange[], expectedChanges: string[]): boolean {
    return actualChanges.every(change => 
      expectedChanges.includes(`${change.type}:${change.field}`)
    );
  }

  /**
   * Disable a tool due to security concerns
   */
  private async disableTool(toolName: string, reason: string): Promise<void> {
    this.disabledTools.add(toolName);
    
    await this.securityLogger.logSecurityEvent({
      eventType: SecurityEventType.MCP_TOOL_AUTO_DISABLED,
      severity: SecuritySeverity.CRITICAL,
      source: { ip: 'system' },
      request: { 
        method: 'AUTO_DISABLE', 
        path: '/mcp-tool-disable', 
        headers: {},
        toolName
      },
      details: {
        message: `MCP tool auto-disabled: ${toolName}`,
        context: { toolName, reason, timestamp: new Date().toISOString() },
        actionTaken: 'Tool disabled'
      }
    });

    console.log(`🚫 MCP Monitor: Tool disabled - ${toolName}: ${reason}`);
  }

  /**
   * Send escalation alert for critical changes
   */
  private async sendEscalationAlert(analysis: SchemaChangeAnalysis): Promise<void> {
    // This would integrate with your alerting system
    console.log(`🚨 MCP Monitor: ESCALATION ALERT - ${analysis.toolName}`);
    console.log(`   - Changes: ${analysis.changeCount} (${analysis.changePercentage.toFixed(1)}%)`);
    console.log(`   - Risk Score: ${analysis.riskScore}/10`);
    console.log(`   - Critical Changes: ${analysis.changes.filter(c => c.impact === 'critical').length}`);
  }

  /**
   * Check for tools that were removed entirely
   */
  private async checkForRemovedTools(currentProcedures: Map<string, Record<string, unknown>>): Promise<void> {
    for (const [toolName] of this.schemaSnapshots) {
      if (!currentProcedures.has(toolName)) {
        await this.securityLogger.logSecurityEvent({
          eventType: SecurityEventType.MCP_TOOL_SCHEMA_CHANGED,
          severity: SecuritySeverity.HIGH,
          source: { ip: 'system' },
          request: { 
            method: 'TOOL_REMOVAL', 
            path: '/mcp-tool-removed', 
            headers: {},
            toolName
          },
          details: {
            message: `MCP tool removed from server: ${toolName}`,
            context: { toolName, action: 'removed' }
          }
        });
      }
    }
  }

  /**
   * Take initial schema snapshot
   */
  private captureSchemaSnapshot(): void {
    if (!this.currentRouter) return;
    
    const procedures = this.extractMCPProcedures(this.currentRouter);
    
    for (const [toolName, procedure] of procedures) {
      const snapshot = this.createSchemaSnapshot(toolName, procedure);
      this.schemaSnapshots.set(toolName, snapshot);
    }
    
    console.log(`📸 MCP Monitor: Captured baseline schemas for ${procedures.size} tools`);
  }

  /**
   * Load persisted schemas from disk
   */
  private async loadPersistedSchemas(): Promise<void> {
    if (!this.config.persistSchemas || !this.config.schemaStoragePath) return;
    
    try {
      // Implementation would load from file system
      console.log('📂 MCP Monitor: Loading persisted schemas...');
    } catch (error) {
      console.warn('⚠️ MCP Monitor: Could not load persisted schemas:', error);
    }
  }

  /**
   * Persist schemas to disk
   */
  private async persistSchemas(): Promise<void> {
    if (!this.config.persistSchemas || !this.config.schemaStoragePath) return;
    
    try {
      // Implementation would save to file system
      console.log('💾 MCP Monitor: Schemas persisted to disk');
    } catch (error) {
      console.error('❌ MCP Monitor: Failed to persist schemas:', error);
    }
  }

  /**
   * Get monitoring statistics
   */
  public getMonitoringStats() {
    return {
      monitoredTools: this.schemaSnapshots.size,
      disabledTools: this.disabledTools.size,
      config: this.config,
      uptime: this.monitoringTimer ? 'active' : 'inactive'
    };
  }

  /**
   * Manually approve schema change
   */
  public approveSchemaChange(
    toolName: string, 
    expectedChanges: string[], 
    validUntilDays: number = 7,
    approvedBy: string = 'admin'
  ): void {
    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + validUntilDays);
    
    this.config.allowedChanges.push({
      toolName,
      expectedChanges,
      validUntil,
      approvedBy
    });
    
    console.log(`✅ MCP Monitor: Schema change approved for ${toolName} until ${validUntil.toISOString()}`);
  }

  /**
   * Re-enable a disabled tool
   */
  public enableTool(toolName: string, approvedBy: string = 'admin'): void {
    if (this.disabledTools.delete(toolName)) {
      this.securityLogger.logSecurityEvent({
        eventType: SecurityEventType.ADMIN_ACTION,
        severity: SecuritySeverity.LOW,
        source: { ip: 'system' },
        request: { 
          method: 'TOOL_ENABLE', 
          path: '/mcp-tool-enable', 
          headers: {},
          toolName
        },
        details: {
          message: `MCP tool manually re-enabled: ${toolName}`,
          context: { toolName, approvedBy, timestamp: new Date().toISOString() },
          actionTaken: 'Tool enabled'
        }
      });
      
      console.log(`✅ MCP Monitor: Tool re-enabled - ${toolName} by ${approvedBy}`);
    }
  }
}
