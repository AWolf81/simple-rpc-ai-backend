/**
 * Safety Validator
 *
 * Validates script execution requests against safety rules to prevent
 * destructive operations like rm -rf / or fork bombs.
 */
import type { SkillMetadata } from '../types';
export type SafetyLevel = 'low' | 'medium' | 'high' | 'critical';
export interface ScriptSafetyConfig {
    level: SafetyLevel;
    requiresApproval: boolean;
    blockPatterns?: string[];
    warnPatterns?: string[];
    dangerousArgs?: string[];
    maxTargets?: number;
}
export interface SafetyValidationResult {
    allowed: boolean;
    requiresApproval: boolean;
    blocked: boolean;
    reason?: string;
    warnings: string[];
    safetyLevel: SafetyLevel;
    matchedBlockPattern?: string;
    matchedWarnPattern?: string;
}
export declare class SafetyValidator {
    /**
     * CRITICAL BLOCK PATTERNS - These should NEVER execute
     *
     * These patterns protect against:
     * - System destruction (rm -rf /)
     * - Fork bombs
     * - Disk wiping
     * - Dangerous permission changes
     */
    private static CRITICAL_BLOCK_PATTERNS;
    /**
     * WARNING PATTERNS - These require explicit approval
     *
     * Not immediately dangerous but potentially destructive
     */
    private static WARNING_PATTERNS;
    /**
     * Validate a script execution request
     */
    static validate(scriptPath: string, args: string[], scriptConfig?: ScriptSafetyConfig, skillSafetyChecks?: SkillMetadata['safetyChecks']): SafetyValidationResult;
    /**
     * Format approval prompt for user
     */
    static formatApprovalPrompt(scriptName: string, args: string[], validation: SafetyValidationResult, cwd?: string): string;
    /**
     * Validate network operation safety
     * POST/PUT/PATCH/DELETE require approval, GET is safe
     */
    static validateNetworkOperation(method: string, url: string, requireApprovalForMutations?: boolean): SafetyValidationResult;
}
