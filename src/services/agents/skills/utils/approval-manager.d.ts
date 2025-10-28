/**
 * Approval Manager
 *
 * Manages approval callbacks and permission requests for skill execution.
 * Integrates with permission allowlist and safety validator.
 */
import { SafetyValidationResult } from './safety-validator';
import { PermissionCheck, PermissionConfig } from './permission-allowlist';
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
    rememberScope?: 'exact' | 'all';
    customResponse?: string;
    timestamp: Date;
}
export type ApprovalCallback = (request: ApprovalRequest) => Promise<ApprovalResponse>;
export declare class ApprovalManager {
    private permissionAllowlist?;
    private approvalCallback?;
    private rememberedChoices;
    private settingsManager;
    private persistentChoicesLoaded;
    private static readonly GLOBAL_SKILL_ID;
    constructor(permissionConfig?: PermissionConfig, approvalCallback?: ApprovalCallback);
    /**
     * Set the approval callback
     */
    setApprovalCallback(callback: ApprovalCallback): void;
    /**
     * Update permission configuration
     */
    updatePermissions(config: PermissionConfig): void;
    /**
     * Request approval for skill execution
     */
    requestSkillExecutionApproval(scriptName: string, args: string[], safetyValidation: SafetyValidationResult, cwd?: string, conversationId?: string, skillId?: string): Promise<boolean>;
    /**
     * Request approval for network operation
     */
    requestNetworkOperationApproval(method: string, url: string, requireApprovalForMutations?: boolean): Promise<boolean>;
    /**
     * Manually remember a choice for a specific operation
     */
    rememberChoice(scriptName: string, args: string[], approved: boolean, options?: {
        skillId?: string;
        persist?: boolean;
        expiresInMs?: number;
        applyToAllArgs?: boolean;
    }): void;
    /**
     * Clear remembered choices
     */
    clearRememberedChoices(): void;
    /**
     * Get current permission configuration
     */
    getPermissionConfig(): PermissionConfig | null;
    /**
     * Add permission pattern dynamically
     */
    addPermission(type: 'allow' | 'deny' | 'ask', pattern: string): void;
    /**
     * Generate unique request ID
     */
    private generateRequestId;
    /**
     * Build remember key for caching decisions
     */
    private buildRememberKey;
    private buildSkillKey;
    private loadPersistentChoices;
    private lookupPersistentApproval;
    private persistApproval;
    /**
     * Format approval prompt for display
     */
    static formatApprovalPrompt(request: ApprovalRequest): string;
}
