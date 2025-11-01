/**
 * Approval Manager
 *
 * Manages approval callbacks and permission requests for skill execution.
 * Integrates with permission allowlist and safety validator.
 */

import { SafetyValidator, SafetyValidationResult } from './safety-validator';
import { PermissionAllowlist, PermissionCheck, PermissionConfig } from './permission-allowlist';
import { logger } from '../../../../utils/logger';
import { getSettingsManager } from '../../../../utils/settings-manager';

export interface ApprovalRequest {
  id: string;
  type: 'skill-execution' | 'network-operation' | 'file-operation';
  skillId?: string;
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
  customResponse?: string;  // Custom user response for AI interpretation
  rememberScope?: 'exact' | 'all';
  timestamp: Date;
}

export type ApprovalCallback = (request: ApprovalRequest) => Promise<ApprovalResponse>;

export class ApprovalManager {
  private permissionAllowlist?: PermissionAllowlist;
  private approvalCallback?: ApprovalCallback;
  private rememberedChoices = new Map<string, boolean>();
  private settingsManager = getSettingsManager();
  private persistentChoicesLoaded = false;
  private static readonly GLOBAL_SKILL_ID = '__global__';
  private static readonly FILE_SCRIPT_MAPPINGS: Record<string, 'read' | 'write' | 'delete'> = {
    'scripts/read.ts': 'read',
    'scripts/safe-read.ts': 'read',
    'scripts/search-files.ts': 'read',
    'scripts/write.ts': 'write',
    'scripts/delete.ts': 'delete',
    'scripts/validate-path.ts': 'read'
  };

  constructor(
    permissionConfig?: PermissionConfig,
    approvalCallback?: ApprovalCallback
  ) {
    if (permissionConfig) {
      this.permissionAllowlist = new PermissionAllowlist(permissionConfig);
    }
    this.approvalCallback = approvalCallback;
    this.loadPersistentChoices();
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
    cwd?: string,
    conversationId?: string,
    skillId?: string
  ): Promise<boolean> {
    // Check if already blocked by safety validator
    if (safetyValidation.blocked) {
      logger.warn(`Skill execution blocked by safety validator: ${scriptName}`, {
        reason: safetyValidation.reason
      });
      return false;
    }

    // Check remembered choices FIRST (before permission allowlist)
    // This allows users to "remember" their choices globally
    const effectiveSkillId = skillId || ApprovalManager.GLOBAL_SKILL_ID;
    const rememberKey = this.buildRememberKey(
      'skill',
      this.buildSkillKey(effectiveSkillId, scriptName),
      args
    );
    logger.info(`🔍 Checking remembered choices for key: ${rememberKey}`);
    logger.info(`   Total remembered choices: ${this.rememberedChoices.size}`);
    logger.info(`   All keys:`, Array.from(this.rememberedChoices.keys()));

    if (this.rememberedChoices.has(rememberKey)) {
      const approved = this.rememberedChoices.get(rememberKey)!;
      logger.info(`✅ Using remembered choice for ${scriptName}: ${approved ? 'approved' : 'denied'}`);
      return approved;
    }

    const wildcardKey = this.buildRememberKey(
      'skill',
      this.buildSkillKey(effectiveSkillId, scriptName),
      ['*']
    );
    if (this.rememberedChoices.has(wildcardKey)) {
      const approved = this.rememberedChoices.get(wildcardKey)!;
      logger.info(`✅ Using wildcard remembered choice for ${scriptName}: ${approved ? 'approved' : 'denied'}`);
      return approved;
    }

    // Check persistent store if not already cached in memory
    const persistedApproval = this.lookupPersistentApproval(effectiveSkillId, scriptName, args);
    if (persistedApproval !== undefined) {
      logger.info(`💾 Using persisted approval for ${scriptName}: ${persistedApproval ? 'approved' : 'denied'}`);
      this.rememberedChoices.set(rememberKey, persistedApproval);
      return persistedApproval;
    }

    const policyDecision = this.evaluatePolicyDecision(scriptName, args);
    if (policyDecision === 'deny') {
      logger.warn(`🚫 Operation denied by policy for ${scriptName}`);
      return false;
    }
    if (policyDecision === 'allow') {
      logger.info(`✅ Operation auto-approved by policy for ${scriptName}`);
      this.rememberedChoices.set(rememberKey, true);
      return true;
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

    logger.info(`❌ No remembered choice found - proceeding to approval request`);

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
      skillId: effectiveSkillId,
      scriptName,
      command,
      args,
      safetyValidation,
      permissionCheck,
      timestamp: new Date()
    };

    logger.info(`Requesting approval for skill execution: ${scriptName}`);

    const response = await this.approvalCallback(request);

    // Check if response is an interaction marker (from interactive approval callback)
    if (response && typeof response === 'object' && (response as any).__interaction_required__) {
      logger.info(`Approval callback returned interaction marker - propagating to caller`);
      // Throw the interaction marker so it propagates up to SkillManager
      throw response;
    }

    // Remember choice if requested
    if (response.rememberChoice) {
      this.rememberChoice(
        scriptName,
        args,
        response.approved,
        {
          skillId: effectiveSkillId,
          persist: true,
          applyToAllArgs: response.rememberScope === 'all'
        }
      );
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
   * Manually remember a choice for a specific operation
   */
  rememberChoice(
    scriptName: string,
    args: string[],
    approved: boolean,
    options?: {
      skillId?: string;
      persist?: boolean;
      expiresInMs?: number;
      applyToAllArgs?: boolean;
    }
  ): void {
    const effectiveSkillId = options?.skillId || ApprovalManager.GLOBAL_SKILL_ID;
    const keyArgs = options?.applyToAllArgs ? ['*'] : args;
    const rememberKey = this.buildRememberKey(
      'skill',
      this.buildSkillKey(effectiveSkillId, scriptName),
      keyArgs
    );
    this.rememberedChoices.set(rememberKey, approved);
    logger.info(`💾 Remembered choice for ${scriptName}: ${approved ? 'approved' : 'denied'}`);
    logger.info(`   Key: ${rememberKey}`);
    logger.info(`   Total remembered: ${this.rememberedChoices.size}`);

    if (options?.persist) {
      this.persistApproval(
        effectiveSkillId,
        scriptName,
        keyArgs,
        approved,
        options.expiresInMs
      );
    }
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

  private buildSkillKey(skillId: string, scriptName: string): string {
    return `${skillId}::${scriptName}`;
  }

  private loadPersistentChoices(): void {
    if (this.persistentChoicesLoaded) {
      return;
    }

    try {
      const permissions = this.settingsManager.getAllPermissions();
      for (const permission of permissions) {
        const skillKey = this.buildSkillKey(permission.skillName, permission.scriptPath);
        const rememberKey = this.buildRememberKey('skill', skillKey, permission.args);
        if (!this.rememberedChoices.has(rememberKey)) {
          this.rememberedChoices.set(rememberKey, permission.approved);
        }
      }
      this.persistentChoicesLoaded = true;
      logger.info(`Loaded ${permissions.length} persisted approval choices`);
    } catch (error) {
      logger.warn('Failed to load persisted approval choices', { error });
    }
  }

  private lookupPersistentApproval(
    skillId: string,
    scriptName: string,
    args: string[]
  ): boolean | undefined {
    try {
      const direct = this.settingsManager.hasApprovalPermission(skillId, scriptName, args);
      if (direct !== undefined) {
        return direct;
      }

      if (skillId !== ApprovalManager.GLOBAL_SKILL_ID) {
        return this.settingsManager.hasApprovalPermission(
          ApprovalManager.GLOBAL_SKILL_ID,
          scriptName,
          args
        );
      }
    } catch (error) {
      logger.warn('Failed to read persisted approval choice', {
        skillId,
        scriptName,
        error
      });
    }

    return undefined;
  }

  private persistApproval(
    skillId: string,
    scriptName: string,
    args: string[],
    approved: boolean,
    expiresInMs?: number
  ): void {
    try {
      this.settingsManager.addApprovalPermission(
        skillId,
        scriptName,
        args,
        approved,
        expiresInMs
      );
    } catch (error) {
      logger.warn('Failed to persist approval choice', {
        skillId,
        scriptName,
        args,
        approved,
        error
      });
    }
  }

  private evaluatePolicyDecision(
    scriptName: string,
    args: string[]
  ): 'allow' | 'deny' | 'prompt' {
    const action = this.getFileOperationAction(scriptName);
    if (!action) {
      return 'prompt';
    }

    const targetPath = this.extractPathArgument(args);
    if (!targetPath) {
      return 'prompt';
    }

    // Check autoApproveReadOperations preference
    const preferences = this.settingsManager.getPreferences();
    if (action === 'read' && preferences.autoApproveReadOperations === false) {
      logger.info(`🔒 Read operation requires approval (autoApproveReadOperations: false): ${scriptName}`);
      return 'prompt';
    }

    const decision = this.settingsManager.evaluateFileSystemPermission(action, targetPath);
    if (decision === 'allow') {
      return 'allow';
    }
    if (decision === 'deny') {
      return 'deny';
    }
    return 'prompt';
  }

  private getFileOperationAction(scriptName: string): 'read' | 'write' | 'delete' | null {
    const normalized = scriptName.toLowerCase();
    const mapping = ApprovalManager.FILE_SCRIPT_MAPPINGS[normalized];
    if (mapping) {
      return mapping;
    }

    if (normalized.includes('read')) return 'read';
    if (normalized.includes('write')) return 'write';
    if (normalized.includes('delete') || normalized.includes('remove')) return 'delete';

    return null;
  }

  private extractPathArgument(args: string[]): string | undefined {
    for (const arg of args) {
      if (!arg) continue;
      if (arg.startsWith('-')) {
        continue;
      }
      return arg;
    }
    return undefined;
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
