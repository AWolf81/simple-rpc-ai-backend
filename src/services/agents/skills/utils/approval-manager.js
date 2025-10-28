/**
 * Approval Manager
 *
 * Manages approval callbacks and permission requests for skill execution.
 * Integrates with permission allowlist and safety validator.
 */

import { SafetyValidator } from './safety-validator';
import { PermissionAllowlist } from './permission-allowlist';
import { logger } from '../../../../utils/logger';
import { getSettingsManager } from '../../../../utils/settings-manager';

export class ApprovalManager {
    permissionAllowlist;
    approvalCallback;
    rememberedChoices = new Map();
    settingsManager = getSettingsManager();
    persistentChoicesLoaded = false;
    static GLOBAL_SKILL_ID = '__global__';
    constructor(permissionConfig, approvalCallback) {
        if (permissionConfig) {
            this.permissionAllowlist = new PermissionAllowlist(permissionConfig);
        }
        this.approvalCallback = approvalCallback;
        this.loadPersistentChoices();
    }
    /**
     * Set the approval callback
     */
    setApprovalCallback(callback) {
        this.approvalCallback = callback;
    }
    /**
     * Update permission configuration
     */
    updatePermissions(config) {
        this.permissionAllowlist = new PermissionAllowlist(config);
    }
    /**
     * Request approval for skill execution
     */
    async requestSkillExecutionApproval(scriptName, args, safetyValidation, cwd, conversationId, skillId) {
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
        const rememberKey = this.buildRememberKey('skill', this.buildSkillKey(effectiveSkillId, scriptName), args);
        logger.info(`🔍 Checking remembered choices for key: ${rememberKey}`);
        logger.info(`   Total remembered choices: ${this.rememberedChoices.size}`);
        logger.info(`   All keys:`, Array.from(this.rememberedChoices.keys()));
        if (this.rememberedChoices.has(rememberKey)) {
            const approved = this.rememberedChoices.get(rememberKey);
            logger.info(`✅ Using remembered choice for ${scriptName}: ${approved ? 'approved' : 'denied'}`);
            return approved;
        }
        // Check persistent settings store if not already cached
        const persistedApproval = this.lookupPersistentApproval(effectiveSkillId, scriptName, args);
        if (persistedApproval !== undefined) {
            logger.info(`💾 Using persisted approval for ${scriptName}: ${persistedApproval ? 'approved' : 'denied'}`);
            this.rememberedChoices.set(rememberKey, persistedApproval);
            return persistedApproval;
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
            throw new Error(`Approval required for "${scriptName}" but no approval callback configured.\n` +
                SafetyValidator.formatApprovalPrompt(scriptName, args, safetyValidation, cwd));
        }
        // Request approval from callback
        const request = {
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
        if (response && typeof response === 'object' && response.__interaction_required__) {
            logger.info(`Approval callback returned interaction marker - propagating to caller`);
            throw response;
        }
        // Remember choice if requested
        if (response.rememberChoice) {
            this.rememberChoice(scriptName, args, response.approved, {
                skillId: effectiveSkillId,
                persist: true
            });
            logger.debug(`Remembered choice for ${scriptName}: ${response.approved ? 'approved' : 'denied'}`);
        }
        logger.info(`Approval ${response.approved ? 'granted' : 'denied'} for ${scriptName}`);
        return response.approved;
    }
    /**
     * Request approval for network operation
     */
    async requestNetworkOperationApproval(method, url, requireApprovalForMutations = true) {
        // Validate network operation
        const safetyValidation = SafetyValidator.validateNetworkOperation(method, url, requireApprovalForMutations);
        // Safe operations (GET, HEAD, OPTIONS) don't need approval
        if (!safetyValidation.requiresApproval) {
            return true;
        }
        // Build permission string
        const urlObj = new URL(url);
        const permission = PermissionAllowlist.buildPermission('WebFetch', `domain:${urlObj.hostname}`);
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
            return this.rememberedChoices.get(rememberKey);
        }
        // Requires approval
        if (!this.approvalCallback) {
            throw new Error(`Approval required for network operation: ${method} ${url}\n` +
                `Reason: ${safetyValidation.warnings.join('\n')}`);
        }
        const request = {
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
    rememberChoice(scriptName, args, approved, options = {}) {
        const effectiveSkillId = options.skillId || ApprovalManager.GLOBAL_SKILL_ID;
        const rememberKey = this.buildRememberKey('skill', this.buildSkillKey(effectiveSkillId, scriptName), args);
        this.rememberedChoices.set(rememberKey, approved);
        logger.info(`💾 Remembered choice for ${scriptName}: ${approved ? 'approved' : 'denied'}`);
        logger.info(`   Key: ${rememberKey}`);
        logger.info(`   Total remembered: ${this.rememberedChoices.size}`);
        if (options.persist) {
            this.persistApproval(effectiveSkillId, scriptName, args, approved, options.expiresInMs);
        }
    }
    /**
     * Clear remembered choices
     */
    clearRememberedChoices() {
        this.rememberedChoices.clear();
        logger.debug('Cleared all remembered approval choices');
    }
    /**
     * Get current permission configuration
     */
    getPermissionConfig() {
        return this.permissionAllowlist?.getConfig() || null;
    }
    /**
     * Add permission pattern dynamically
     */
    addPermission(type, pattern) {
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
    generateRequestId() {
        return `approval-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    /**
     * Build remember key for caching decisions
     */
    buildRememberKey(type, name, args) {
        return `${type}:${name}:${args.join(':')}`;
    }
    buildSkillKey(skillId, scriptName) {
        return `${skillId}::${scriptName}`;
    }
    loadPersistentChoices() {
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
        }
        catch (error) {
            logger.warn('Failed to load persisted approval choices', { error });
        }
    }
    lookupPersistentApproval(skillId, scriptName, args) {
        try {
            const direct = this.settingsManager.hasApprovalPermission(skillId, scriptName, args);
            if (direct !== undefined) {
                return direct;
            }
            if (skillId !== ApprovalManager.GLOBAL_SKILL_ID) {
                return this.settingsManager.hasApprovalPermission(ApprovalManager.GLOBAL_SKILL_ID, scriptName, args);
            }
        }
        catch (error) {
            logger.warn('Failed to read persisted approval choice', {
                skillId,
                scriptName,
                error
            });
        }
        return undefined;
    }
    persistApproval(skillId, scriptName, args, approved, expiresInMs) {
        try {
            this.settingsManager.addApprovalPermission(skillId, scriptName, args, approved, expiresInMs);
        }
        catch (error) {
            logger.warn('Failed to persist approval choice', {
                skillId,
                scriptName,
                args,
                approved,
                error
            });
        }
    }
    /**
     * Format approval prompt for display
     */
    static formatApprovalPrompt(request) {
        const lines = [
            '╔═══════════════════════════════════════════════════════════╗',
            '║              ⚠️  APPROVAL REQUIRED                        ║',
            '╚═══════════════════════════════════════════════════════════╝',
            ''
        ];
        if (request.type === 'skill-execution' && request.scriptName && request.args) {
            return SafetyValidator.formatApprovalPrompt(request.scriptName, request.args, request.safetyValidation);
        }
        if (request.type === 'network-operation' && request.method && request.url) {
            lines.push(`🌐 Network Operation`, `📤 Method: ${request.method}`, `🔗 URL: ${request.url}`, '');
            if (request.safetyValidation?.warnings) {
                lines.push('⚠️  Warnings:');
                request.safetyValidation.warnings.forEach(w => lines.push(`   ${w}`));
                lines.push('');
            }
            lines.push('─────────────────────────────────────────────────────────────', '❓ Do you want to proceed with this operation?', '─────────────────────────────────────────────────────────────');
        }
        return lines.join('\n');
    }
}
