/**
 * Approval Manager
 *
 * Manages approval callbacks and permission requests for skill execution.
 * Integrates with permission allowlist and safety validator.
 */

import { SafetyValidator, SafetyValidationResult } from './safety-validator';
import { PermissionAllowlist, PermissionCheck, PermissionConfig } from './permission-allowlist';
import { logger } from '../../../../utils/logger';

export interface ApprovalRequest {
  id: string;
  type: 'skill-execution' | 'network-operation' | 'file-operation';
  scriptName?: string;
  command?: string;
  args?: string[];
  url?: string;
  method?: string;
  safetyValidation?: SafetyValidationResult;
  permissionCheck?: PermissionCheck;
  timestamp: Date;
}

export interface ApprovalResponse {
  requestId: string;
  approved: boolean;
  rememberChoice?: boolean;
  timestamp: Date;
}

export type ApprovalCallback = (request: ApprovalRequest) => Promise<ApprovalResponse>;

export class ApprovalManager {
  private permissionAllowlist?: PermissionAllowlist;
  private approvalCallback?: ApprovalCallback;
  private rememberedChoices = new Map<string, boolean>();

  constructor(
    permissionConfig?: PermissionConfig,
    approvalCallback?: ApprovalCallback
  ) {
    if (permissionConfig) {
      this.permissionAllowlist = new PermissionAllowlist(permissionConfig);
    }
    this.approvalCallback = approvalCallback;
  }

  /**
   * Set the approval callback
   */
  setApprovalCallback(callback: ApprovalCallback): void {
    this.approvalCallback = callback;
  }

  /**
   * Update permission configuration
   */
  updatePermissions(config: PermissionConfig): void {
    this.permissionAllowlist = new PermissionAllowlist(config);
  }

  /**
   * Request approval for skill execution
   */
  async requestSkillExecutionApproval(
    scriptName: string,
    args: string[],
    safetyValidation: SafetyValidationResult,
    cwd?: string
  ): Promise<boolean> {
    // Check if already blocked by safety validator
    if (safetyValidation.blocked) {
      logger.warn(`Skill execution blocked by safety validator: ${scriptName}`, {
        reason: safetyValidation.reason
      });
      return false;
    }

    // Build permission string
    const command = `${scriptName} ${args.join(' ')}`;
    const permission = PermissionAllowlist.buildPermission('Bash', command);

    // Check permission allowlist
    const permissionCheck = this.permissionAllowlist?.check(permission);

    if (permissionCheck) {
      // Explicitly denied
      if (permissionCheck.result === 'deny') {
        logger.warn(`Skill execution denied by permission allowlist: ${scriptName}`, {
          matchedPattern: permissionCheck.matchedPattern
        });
        return false;
      }

      // Explicitly allowed and no safety warnings
      if (permissionCheck.result === 'allow' && !safetyValidation.requiresApproval) {
        logger.debug(`Skill execution auto-approved: ${scriptName}`, {
          matchedPattern: permissionCheck.matchedPattern
        });
        return true;
      }
    }

    // Check remembered choices
    const rememberKey = this.buildRememberKey('skill', scriptName, args);
    if (this.rememberedChoices.has(rememberKey)) {
      const approved = this.rememberedChoices.get(rememberKey)!;
      logger.debug(`Using remembered choice for ${scriptName}: ${approved ? 'approved' : 'denied'}`);
      return approved;
    }

    // Requires approval - check if callback is available
    if (!this.approvalCallback) {
      logger.error(`Approval required but no callback configured for: ${scriptName}`);
      throw new Error(
        `Approval required for "${scriptName}" but no approval callback configured.\n` +
        SafetyValidator.formatApprovalPrompt(scriptName, args, safetyValidation, cwd)
      );
    }

    // Request approval from callback
    const request: ApprovalRequest = {
      id: this.generateRequestId(),
      type: 'skill-execution',
      scriptName,
      command,
      args,
      safetyValidation,
      permissionCheck,
      timestamp: new Date()
    };

    logger.info(`Requesting approval for skill execution: ${scriptName}`);

    const response = await this.approvalCallback(request);

    // Remember choice if requested
    if (response.rememberChoice) {
      this.rememberedChoices.set(rememberKey, response.approved);
      logger.debug(`Remembered choice for ${scriptName}: ${response.approved ? 'approved' : 'denied'}`);
    }

    logger.info(`Approval ${response.approved ? 'granted' : 'denied'} for ${scriptName}`);

    return response.approved;
  }

  /**
   * Request approval for network operation
   */
  async requestNetworkOperationApproval(
    method: string,
    url: string,
    requireApprovalForMutations: boolean = true
  ): Promise<boolean> {
    // Validate network operation
    const safetyValidation = SafetyValidator.validateNetworkOperation(
      method,
      url,
      requireApprovalForMutations
    );

    // Safe operations (GET, HEAD, OPTIONS) don't need approval
    if (!safetyValidation.requiresApproval) {
      return true;
    }

    // Build permission string
    const urlObj = new URL(url);
    const permission = PermissionAllowlist.buildPermission(
      'WebFetch',
      `domain:${urlObj.hostname}`
    );

    // Check permission allowlist
    const permissionCheck = this.permissionAllowlist?.check(permission);

    if (permissionCheck) {
      if (permissionCheck.result === 'deny') {
        logger.warn(`Network operation denied by permission allowlist: ${method} ${url}`);
        return false;
      }

      // For mutation operations, still require approval even if in allowlist
      // This is extra safety for POST/PUT/PATCH/DELETE
      if (permissionCheck.result === 'allow' && method.toUpperCase() === 'GET') {
        return true;
      }
    }

    // Check remembered choices
    const rememberKey = this.buildRememberKey('network', method, [url]);
    if (this.rememberedChoices.has(rememberKey)) {
      return this.rememberedChoices.get(rememberKey)!;
    }

    // Requires approval
    if (!this.approvalCallback) {
      throw new Error(
        `Approval required for network operation: ${method} ${url}\n` +
        `Reason: ${safetyValidation.warnings.join('\n')}`
      );
    }

    const request: ApprovalRequest = {
      id: this.generateRequestId(),
      type: 'network-operation',
      method,
      url,
      safetyValidation,
      permissionCheck,
      timestamp: new Date()
    };

    logger.info(`Requesting approval for network operation: ${method} ${url}`);

    const response = await this.approvalCallback(request);

    if (response.rememberChoice) {
      this.rememberedChoices.set(rememberKey, response.approved);
    }

    return response.approved;
  }

  /**
   * Clear remembered choices
   */
  clearRememberedChoices(): void {
    this.rememberedChoices.clear();
    logger.debug('Cleared all remembered approval choices');
  }

  /**
   * Get current permission configuration
   */
  getPermissionConfig(): PermissionConfig | null {
    return this.permissionAllowlist?.getConfig() || null;
  }

  /**
   * Add permission pattern dynamically
   */
  addPermission(type: 'allow' | 'deny' | 'ask', pattern: string): void {
    if (!this.permissionAllowlist) {
      this.permissionAllowlist = new PermissionAllowlist({
        allow: [],
        deny: [],
        ask: []
      });
    }

    switch (type) {
      case 'allow':
        this.permissionAllowlist.addAllowPattern(pattern);
        break;
      case 'deny':
        this.permissionAllowlist.addDenyPattern(pattern);
        break;
      case 'ask':
        this.permissionAllowlist.addAskPattern(pattern);
        break;
    }

    logger.debug(`Added ${type} permission pattern: ${pattern}`);
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `approval-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Build remember key for caching decisions
   */
  private buildRememberKey(type: string, name: string, args: string[]): string {
    return `${type}:${name}:${args.join(':')}`;
  }

  /**
   * Format approval prompt for display
   */
  static formatApprovalPrompt(request: ApprovalRequest): string {
    const lines: string[] = [
      '╔═══════════════════════════════════════════════════════════╗',
      '║              ⚠️  APPROVAL REQUIRED                        ║',
      '╚═══════════════════════════════════════════════════════════╝',
      ''
    ];

    if (request.type === 'skill-execution' && request.scriptName && request.args) {
      return SafetyValidator.formatApprovalPrompt(
        request.scriptName,
        request.args,
        request.safetyValidation!
      );
    }

    if (request.type === 'network-operation' && request.method && request.url) {
      lines.push(
        `🌐 Network Operation`,
        `📤 Method: ${request.method}`,
        `🔗 URL: ${request.url}`,
        ''
      );

      if (request.safetyValidation?.warnings) {
        lines.push('⚠️  Warnings:');
        request.safetyValidation.warnings.forEach(w => lines.push(`   ${w}`));
        lines.push('');
      }

      lines.push(
        '─────────────────────────────────────────────────────────────',
        '❓ Do you want to proceed with this operation?',
        '─────────────────────────────────────────────────────────────'
      );
    }

    return lines.join('\n');
  }
}
