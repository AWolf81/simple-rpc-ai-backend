/**
 * Interactive Approval Callback
 *
 * Integration helper that uses the user-interaction skill for approval dialogs
 */

import type { ApprovalRequest, ApprovalResponse } from './approval-manager';
import type { SkillManager } from '../manager';
// import { SafetyValidator } from './safety-validator';
import { extractInteractionXML, parseInteractionXML } from './xml-interaction-parser';

export interface InteractiveApprovalOptions {
  /**
   * Skill manager instance for executing user-interaction scripts
   * Optional - will be injected by the server if not provided
   */
  skillManager?: SkillManager;

  /**
   * Custom options for approval dialog
   * Default: ["Allow", "Allow (don't ask again)", "Deny", "Custom response"]
   */
  approvalOptions?: string[];

  /**
   * Allow custom responses with AI interpretation
   * Default: true
   */
  allowCustomReason?: boolean;

  /**
   * Timeout in milliseconds (0 = no timeout)
   * Default: 0
   */
  timeout?: number;
}

// Global skill manager reference (set by server during initialization)
let _globalSkillManager: SkillManager | undefined;

/**
 * Internal function to set the global skill manager
 * Called by the server during skills initialization
 */
export function _setGlobalSkillManager(manager: SkillManager): void {
  _globalSkillManager = manager;
}

/**
 * Create an interactive approval callback using the user-interaction skill
 *
 * @param options Configuration options (skillManager is optional and auto-injected)
 * @returns Approval callback function
 */
export function createInteractiveApprovalCallback(
  options: InteractiveApprovalOptions = {}
): (request: ApprovalRequest) => Promise<ApprovalResponse> {
  const {
    skillManager: providedSkillManager,
    approvalOptions = ['Allow', 'Allow (don\'t ask again)', 'Deny (don\'t ask again)', 'Deny', 'Custom response'],
    allowCustomReason = true,
    timeout = 0
  } = options;

  return async (request: ApprovalRequest): Promise<ApprovalResponse> => {
    console.error(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.error(`[APPROVAL] Callback invoked for: ${request.type}`);

    // Get skill manager (from provided option or global)
    const skillManager = providedSkillManager || _globalSkillManager;

    console.error(`[APPROVAL] skillManager: ${!!skillManager} (provided: ${!!providedSkillManager}, global: ${!!_globalSkillManager})`);

    if (!skillManager) {
      console.error('[APPROVAL] ERROR: No skillManager available!');
      throw new Error(
        'SkillManager not available. Either pass skillManager option or ensure ' +
        'the server has initialized the skills system.'
      );
    }

    console.error('[APPROVAL] Executing user-interaction skill...');

    // Format the approval message and title
    let message = '';
    let title = '🤔 Confirm Action';  // Default user-friendly title

    if (request.type === 'skill-execution') {
      message = formatSkillExecutionMessage(request);

      // Customize title based on operation type
      const scriptName = request.scriptName || '';
      if (scriptName.includes('delete.ts')) {
        title = '🗑️  Confirm Deletion';
      } else if (scriptName.includes('write.ts')) {
        title = '✏️  Confirm File Write';
      } else if (scriptName.includes('read.ts')) {
        title = '📖 Confirm File Read';
      }
    } else if (request.type === 'network-operation') {
      message = formatNetworkOperationMessage(request);
      title = '🌐 Confirm Network Request';
    } else if (request.type === 'file-operation') {
      message = formatFileOperationMessage(request);
      title = '📁 Confirm File Operation';
    } else {
      message = `Operation: ${request.command || 'Unknown'}\n`;
      if (request.safetyValidation?.warnings) {
        message += '\nWarnings:\n' + request.safetyValidation.warnings.map(w => `  ${w}`).join('\n');
      }
    }

    // Execute approval dialog
    const executePromise = skillManager.executeScript('user-interaction', {
      scriptName: 'scripts/approval-dialog.ts',
      args: [
        title,
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
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Approval timeout')), timeout)
        )
      ]);
    } else {
      result = await executePromise;
    }

    // Check if stdout contains XML interaction marker
    // approval-dialog.ts outputs XML when user interaction is needed
    if (result && result.stdout) {
      const xml = extractInteractionXML(result.stdout);
      if (xml) {
        const interaction = parseInteractionXML(xml);
        if (interaction) {
          console.error('[APPROVAL] Interaction XML detected in approval dialog - creating marker');
          // Create and return interaction marker
          // This will be caught by ApprovalManager -> SkillManager -> AIService
          return {
            __interaction_required__: true,
            interaction,
            toolName: 'approval-dialog',
            originalResult: result
          } as any;
        }
      }
    }

    // Parse result as JSON for normal approval responses
    let output: Record<string, any> = {};
    try {
      output = JSON.parse(result.stdout);
    } catch (error) {
      const trimmed = (result.stdout || '').trim();
      if (trimmed.startsWith('{"choice"') || trimmed.startsWith('{\"choice\"')) {
        try {
          output = JSON.parse(trimmed.replace(/\\"/g, '"'));
        } catch {
          output = { choice: trimmed };
        }
      } else {
        output = { choice: trimmed };
      }
    }

    // Determine if we should remember the choice based on the option selected
    const choice = (output.choice || output.selection || output.selected || output.json?.choice || output.json?.selection || '').toString();
    const choiceLower = choice.toLowerCase();
    const normalizedChoice = choiceLower.replace(/’/g, "'");

    // Handle different response types:
    // 1. "Allow (don't ask again)" = remember as approved
    // 2. "Allow" = approved (no remember)
    // 3. "Deny" = denied (no remember)
    // 4. "Custom response" = needs AI interpretation (returned as custom text)

    const rememberChoice = normalizedChoice.includes("don't ask again") ||
                          normalizedChoice.includes("don't ask") ||
                          normalizedChoice.includes('always');

    const rememberScope: 'exact' | 'all' | undefined = rememberChoice ?
      (normalizedChoice.includes('always') || normalizedChoice.includes("don't ask") ? 'all' : 'exact') :
      undefined;

    // Approved if choice contains "allow"
    const approved = normalizedChoice.includes('allow');

    // If custom response, include the custom text for AI interpretation
    const customResponse = output.customResponse || output.json?.customResponse || '';

    return {
      requestId: request.id,
      approved,
      rememberChoice,
      rememberScope,
      customResponse: customResponse || undefined,  // Include custom text if provided
      timestamp: new Date()
    };
  };
}

/**
 * Format message for skill execution approval
 */
function formatSkillExecutionMessage(request: ApprovalRequest): string {
  // Create user-friendly message based on the script being executed
  const scriptName = request.scriptName || '';
  const args = request.args || [];

  // Map script names to user-friendly descriptions
  if (scriptName.includes('delete.ts') && args.length > 0) {
    const filePath = args[0];
    return `Delete file: ${filePath}`;
  }

  if (scriptName.includes('write.ts') && args.length > 0) {
    const filePath = args[0];
    return `Create or modify file: ${filePath}`;
  }

  if (scriptName.includes('read.ts') && args.length > 0) {
    const filePath = args[0];
    return `Read file: ${filePath}`;
  }

  // For unknown operations, show more details but still user-friendly
  const operation = scriptName.replace('scripts/', '').replace('.ts', '').replace(/-/g, ' ');
  if (args.length > 0) {
    return `${operation}: ${args.join(' ')}`;
  }

  return operation || 'Execute operation';
}

/**
 * Format message for network operation approval
 */
function formatNetworkOperationMessage(request: ApprovalRequest): string {
  const lines: string[] = [];

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
function formatFileOperationMessage(request: ApprovalRequest): string {
  const lines: string[] = [];

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
export function createConfirmationCallback(
  skillManager?: SkillManager
): (request: ApprovalRequest) => Promise<ApprovalResponse> {
  return async (request: ApprovalRequest): Promise<ApprovalResponse> => {
    // Get skill manager (from provided option or global)
    const manager = skillManager || _globalSkillManager;

    if (!manager) {
      throw new Error(
        'SkillManager not available. Either pass skillManager parameter or ensure ' +
        'the server has initialized the skills system.'
      );
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
