/**
 * Interactive Approval Callback
 *
 * Integration helper that uses the user-interaction skill for approval dialogs
 */
import type { ApprovalRequest, ApprovalResponse } from './approval-manager';
import type { SkillManager } from '../manager';
export interface InteractiveApprovalOptions {
    /**
     * Skill manager instance for executing user-interaction scripts
     * Optional - will be injected by the server if not provided
     */
    skillManager?: SkillManager;
    /**
     * Custom options for approval dialog
     * Default: ["Yes", "Yes (always ask)", "No", "Other"]
     */
    approvalOptions?: string[];
    /**
     * Allow custom rejection reasons
     * Default: true
     */
    allowCustomReason?: boolean;
    /**
     * Timeout in milliseconds (0 = no timeout)
     * Default: 0
     */
    timeout?: number;
}
/**
 * Internal function to set the global skill manager
 * Called by the server during skills initialization
 */
export declare function _setGlobalSkillManager(manager: SkillManager): void;
/**
 * Create an interactive approval callback using the user-interaction skill
 *
 * @param options Configuration options (skillManager is optional and auto-injected)
 * @returns Approval callback function
 */
export declare function createInteractiveApprovalCallback(options?: InteractiveApprovalOptions): (request: ApprovalRequest) => Promise<ApprovalResponse>;
/**
 * Create a simple yes/no confirmation callback
 *
 * @param skillManager Skill manager instance (optional, uses global if not provided)
 * @returns Confirmation callback
 */
export declare function createConfirmationCallback(skillManager?: SkillManager): (request: ApprovalRequest) => Promise<ApprovalResponse>;
