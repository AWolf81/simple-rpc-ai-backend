/**
 * Interactive Approval Callback
 *
 * Integration helper that uses the user-interaction skill for approval dialogs
 */
// Global skill manager reference (set by server during initialization)
let _globalSkillManager;
/**
 * Internal function to set the global skill manager
 * Called by the server during skills initialization
 */
export function _setGlobalSkillManager(manager) {
    _globalSkillManager = manager;
}
/**
 * Create an interactive approval callback using the user-interaction skill
 *
 * @param options Configuration options (skillManager is optional and auto-injected)
 * @returns Approval callback function
 */
export function createInteractiveApprovalCallback(options = {}) {
    const { skillManager: providedSkillManager, approvalOptions = ['Yes', 'Yes (always ask)', 'No', 'Other'], allowCustomReason = true, timeout = 0 } = options;
    return async (request) => {
        // Get skill manager (from provided option or global)
        const skillManager = providedSkillManager || _globalSkillManager;
        if (!skillManager) {
            throw new Error('SkillManager not available. Either pass skillManager option or ensure ' +
                'the server has initialized the skills system.');
        }
        // Format the approval message
        let message = '';
        if (request.type === 'skill-execution') {
            message = formatSkillExecutionMessage(request);
        }
        else if (request.type === 'network-operation') {
            message = formatNetworkOperationMessage(request);
        }
        else if (request.type === 'file-operation') {
            message = formatFileOperationMessage(request);
        }
        else {
            message = `Operation: ${request.command || 'Unknown'}\n`;
            if (request.safetyValidation?.warnings) {
                message += '\nWarnings:\n' + request.safetyValidation.warnings.map(w => `  ${w}`).join('\n');
            }
        }
        // Execute approval dialog
        const executePromise = skillManager.executeScript('user-interaction', {
            scriptName: 'scripts/approval-dialog.ts',
            args: [
                '⚠️  Approval Required',
                message,
                JSON.stringify(approvalOptions),
                ...(allowCustomReason ? ['--allow-custom'] : [])
            ]
        });
        let result;
        if (timeout > 0) {
            // Add timeout
            result = await Promise.race([
                executePromise,
                new Promise((_, reject) => setTimeout(() => reject(new Error('Approval timeout')), timeout))
            ]);
        }
        else {
            result = await executePromise;
        }
        // Parse result
        const output = JSON.parse(result.stdout);
        // Determine if we should remember the choice
        // "Yes (always ask)" means we approve but DON'T remember
        const rememberChoice = output.choice === 'Yes (always ask)' ? false : output.approved;
        return {
            requestId: request.id,
            approved: output.approved,
            rememberChoice,
            timestamp: new Date()
        };
    };
}
/**
 * Format message for skill execution approval
 */
function formatSkillExecutionMessage(request) {
    const lines = [];
    lines.push(`Script: ${request.scriptName}`);
    if (request.args && request.args.length > 0) {
        lines.push(`Arguments: ${request.args.join(' ')}`);
    }
    if (request.command) {
        lines.push(`Command: ${request.command}`);
    }
    if (request.safetyValidation) {
        lines.push(`Safety Level: ${request.safetyValidation.safetyLevel.toUpperCase()}`);
        if (request.safetyValidation.warnings.length > 0) {
            lines.push('\nWarnings:');
            request.safetyValidation.warnings.forEach(w => {
                lines.push(`  ${w}`);
            });
        }
    }
    return lines.join('\n');
}
/**
 * Format message for network operation approval
 */
function formatNetworkOperationMessage(request) {
    const lines = [];
    lines.push(`Network Operation: ${request.method} ${request.url}`);
    if (request.safetyValidation?.warnings.length) {
        lines.push('\nWarnings:');
        request.safetyValidation.warnings.forEach(w => {
            lines.push(`  ${w}`);
        });
    }
    return lines.join('\n');
}
/**
 * Format message for file operation approval
 */
function formatFileOperationMessage(request) {
    const lines = [];
    lines.push(`File Operation: ${request.command || 'Unknown'}`);
    if (request.safetyValidation?.warnings.length) {
        lines.push('\nWarnings:');
        request.safetyValidation.warnings.forEach(w => {
            lines.push(`  ${w}`);
        });
    }
    return lines.join('\n');
}
/**
 * Create a simple yes/no confirmation callback
 *
 * @param skillManager Skill manager instance (optional, uses global if not provided)
 * @returns Confirmation callback
 */
export function createConfirmationCallback(skillManager) {
    return async (request) => {
        // Get skill manager (from provided option or global)
        const manager = skillManager || _globalSkillManager;
        if (!manager) {
            throw new Error('SkillManager not available. Either pass skillManager parameter or ensure ' +
                'the server has initialized the skills system.');
        }
        const message = `Allow: ${request.command || request.scriptName || 'this operation'}?`;
        const result = await manager.executeScript('user-interaction', {
            scriptName: 'scripts/confirm.ts',
            args: [message, '--default', 'no']
        });
        const output = JSON.parse(result.stdout);
        return {
            requestId: request.id,
            approved: output.confirmed,
            rememberChoice: false,
            timestamp: new Date()
        };
    };
}
