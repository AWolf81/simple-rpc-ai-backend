/**
 * Safety Validator
 *
 * Validates script execution requests against safety rules to prevent
 * destructive operations like rm -rf / or fork bombs.
 */

import path from 'path';
import type { SkillMetadata } from '../types';

export type SafetyLevel = 'low' | 'medium' | 'high' | 'critical';

export interface ScriptSafetyConfig {
  level: SafetyLevel;
  requiresApproval: boolean;
  blockPatterns?: string[];     // Regex patterns to block (never execute)
  warnPatterns?: string[];      // Patterns that require extra confirmation
  dangerousArgs?: string[];     // Specific arguments that are dangerous
  maxTargets?: number;          // Max files/folders affected (for rm, mv)
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

export class SafetyValidator {
  /**
   * CRITICAL BLOCK PATTERNS - These should NEVER execute
   *
   * These patterns protect against:
   * - System destruction (rm -rf /)
   * - Fork bombs
   * - Disk wiping
   * - Dangerous permission changes
   */
  private static CRITICAL_BLOCK_PATTERNS: Array<{ pattern: RegExp; description: string }> = [
    // rm -rf variations targeting root or system
    { pattern: /rm\s+(-[a-zA-Z]*r[a-zA-Z]*f[a-zA-Z]*|--recursive\s+--force)\s+(\/|\/\*)\s*$/i, description: 'Attempting to delete root filesystem' },
    { pattern: /rm\s+(-[a-zA-Z]*r[a-zA-Z]*f[a-zA-Z]*|--recursive\s+--force)\s+\/(?:bin|boot|dev|etc|lib|proc|root|sbin|sys|usr|var)/i, description: 'Attempting to delete critical system directory' },
    { pattern: /rm\s+(-[a-zA-Z]*r[a-zA-Z]*f[a-zA-Z]*|--recursive\s+--force)\s+~\s*$/i, description: 'Attempting to delete entire home directory' },

    // chmod variations that weaken security
    { pattern: /chmod\s+(-R\s+)?777\s+(\/|\/\*)\s*$/i, description: 'Attempting to make root world-writable' },
    { pattern: /chmod\s+(-R\s+)?777\s+\/(?:bin|boot|dev|etc|lib|proc|root|sbin|sys|usr|var)/i, description: 'Attempting to make system directory world-writable' },

    // Fork bombs
    { pattern: /:\(\)\s*\{\s*:\s*\|\s*:\s*&\s*\}\s*;\s*:/i, description: 'Fork bomb detected' },
    { pattern: /\$\(.*\$\(.*\$\(.*\)\.*\)\.*\)/i, description: 'Potential fork bomb or command injection' },

    // Disk wiping
    { pattern: /dd\s+if=\/dev\/(zero|random|urandom)\s+of=\/dev\/(?:sda|nvme|hd)/i, description: 'Attempting to wipe disk' },
    { pattern: /dd\s+if=\/dev\/(zero|random|urandom)\s+of=\//i, description: 'Attempting to overwrite filesystem' },

    // Kernel manipulation
    { pattern: /echo\s+.*>\s*\/proc\/sys\/kernel/i, description: 'Attempting to modify kernel parameters' },

    // Process table manipulation
    { pattern: /kill\s+-9\s+(-1|1)\s*$/i, description: 'Attempting to kill all processes or init' },
    { pattern: /pkill\s+-9\s+init/i, description: 'Attempting to kill init process' },

    // Network flooding
    { pattern: /ping\s+-f/i, description: 'Attempting flood ping' },

    // Recursive chown on root
    { pattern: /chown\s+-R\s+.*\s+(\/|\/\*)\s*$/i, description: 'Attempting to change ownership of root' },

    // Moving/copying to dangerous locations
    { pattern: /(?:mv|cp)\s+.*\s+\/(?:bin|boot|dev|etc|lib|proc|root|sbin|sys)\/[^\/]*$/i, description: 'Attempting to overwrite system files' },

    // Null byte injection (path traversal)
    { pattern: /.*\x00.*/i, description: 'Null byte injection detected' },

    // Command injection attempts
    { pattern: /[;&|`$]\s*rm\s+-/i, description: 'Command injection with rm detected' },
    { pattern: /\$\([^)]*rm\s+-/i, description: 'Command substitution with rm detected' },
  ];

  /**
   * WARNING PATTERNS - These require explicit approval
   *
   * Not immediately dangerous but potentially destructive
   */
  private static WARNING_PATTERNS: Array<{ pattern: RegExp; description: string }> = [
    // Recursive deletion in current directory
    { pattern: /rm\s+-[a-zA-Z]*r[a-zA-Z]*f?\s+\*/i, description: 'Deleting all files in current directory recursively' },
    { pattern: /rm\s+-[a-zA-Z]*r[a-zA-Z]*f?\s+\.\*/i, description: 'Deleting all hidden files recursively' },
    { pattern: /rm\s+-[a-zA-Z]*r[a-zA-Z]*f?\s+\.\//i, description: 'Deleting current directory recursively' },

    // Recursive permission changes
    { pattern: /chmod\s+-R\s+777/i, description: 'Making files world-writable recursively' },
    { pattern: /chmod\s+-R\s+[0-7]{3}/i, description: 'Recursive permission change' },

    // Deleting package management files
    { pattern: /rm\s+.*(?:node_modules|package-lock\.json|pnpm-lock\.yaml)/i, description: 'Deleting package management files' },

    // Git operations
    { pattern: /git\s+push\s+(-f|--force)/i, description: 'Force pushing to git repository' },
    { pattern: /git\s+reset\s+--hard/i, description: 'Hard reset of git repository' },
    { pattern: /git\s+clean\s+-[a-zA-Z]*f[a-zA-Z]*d/i, description: 'Force cleaning git repository' },

    // System service manipulation
    { pattern: /systemctl\s+(?:stop|disable|mask)/i, description: 'Stopping or disabling system service' },
    { pattern: /service\s+\w+\s+stop/i, description: 'Stopping system service' },

    // Firewall changes
    { pattern: /(?:iptables|ufw|firewalld)/i, description: 'Modifying firewall rules' },

    // Mass file operations
    { pattern: /find\s+.*-exec\s+rm/i, description: 'Mass file deletion with find' },
    { pattern: /xargs\s+rm/i, description: 'Mass file deletion with xargs' },
  ];

  /**
   * Validate a script execution request
   */
  static validate(
    scriptPath: string,
    args: string[],
    scriptConfig?: ScriptSafetyConfig,
    skillSafetyChecks?: SkillMetadata['safetyChecks']
  ): SafetyValidationResult {
    const result: SafetyValidationResult = {
      allowed: true,
      requiresApproval: scriptConfig?.requiresApproval || false,
      blocked: false,
      warnings: [],
      safetyLevel: scriptConfig?.level || 'low'
    };

    // Build full command string for pattern matching
    const scriptName = path.basename(scriptPath);
    const fullCommand = `${scriptName} ${args.join(' ')}`;

    // 1. Check CRITICAL block patterns (highest priority)
    for (const { pattern, description } of this.CRITICAL_BLOCK_PATTERNS) {
      if (pattern.test(fullCommand)) {
        result.allowed = false;
        result.blocked = true;
        result.matchedBlockPattern = pattern.source;
        result.reason = `🚫 BLOCKED: ${description}\nCommand: ${fullCommand}`;
        return result;
      }
    }

    // 2. Check custom skill-level block patterns
    if (skillSafetyChecks?.blockPatterns) {
      for (const patternStr of skillSafetyChecks.blockPatterns) {
        try {
          const pattern = new RegExp(patternStr, 'i');
          if (pattern.test(fullCommand)) {
            result.allowed = false;
            result.blocked = true;
            result.matchedBlockPattern = patternStr;
            result.reason = `🚫 BLOCKED by skill policy: Command matches forbidden pattern\nCommand: ${fullCommand}`;
            return result;
          }
        } catch (error) {
          console.warn(`Invalid block pattern in skill config: ${patternStr}`);
        }
      }
    }

    // 3. Check script-level block patterns
    if (scriptConfig?.blockPatterns) {
      for (const patternStr of scriptConfig.blockPatterns) {
        try {
          const pattern = new RegExp(patternStr, 'i');
          if (pattern.test(fullCommand)) {
            result.allowed = false;
            result.blocked = true;
            result.matchedBlockPattern = patternStr;
            result.reason = `🚫 BLOCKED by script policy: Command matches forbidden pattern\nCommand: ${fullCommand}`;
            return result;
          }
        } catch (error) {
          console.warn(`Invalid block pattern in script config: ${patternStr}`);
        }
      }
    }

    // 4. Check WARNING patterns (require approval)
    for (const { pattern, description } of this.WARNING_PATTERNS) {
      if (pattern.test(fullCommand)) {
        result.requiresApproval = true;
        result.matchedWarnPattern = pattern.source;
        result.warnings.push(`⚠️  ${description}`);
      }
    }

    // 5. Check custom skill-level warning patterns
    if (skillSafetyChecks?.warnPatterns) {
      for (const patternStr of skillSafetyChecks.warnPatterns) {
        try {
          const pattern = new RegExp(patternStr, 'i');
          if (pattern.test(fullCommand)) {
            result.requiresApproval = true;
            result.matchedWarnPattern = patternStr;
            result.warnings.push(`⚠️  Skill policy: Potentially dangerous operation`);
          }
        } catch (error) {
          console.warn(`Invalid warn pattern in skill config: ${patternStr}`);
        }
      }
    }

    // 6. Check script-level warning patterns
    if (scriptConfig?.warnPatterns) {
      for (const patternStr of scriptConfig.warnPatterns) {
        try {
          const pattern = new RegExp(patternStr, 'i');
          if (pattern.test(fullCommand)) {
            result.requiresApproval = true;
            result.matchedWarnPattern = patternStr;
            result.warnings.push(`⚠️  Script policy: Requires approval`);
          }
        } catch (error) {
          console.warn(`Invalid warn pattern in script config: ${patternStr}`);
        }
      }
    }

    // 7. Check dangerous arguments
    if (scriptConfig?.dangerousArgs) {
      const hasDangerousArg = args.some(arg =>
        scriptConfig.dangerousArgs!.includes(arg)
      );
      if (hasDangerousArg) {
        result.requiresApproval = true;
        result.warnings.push('⚠️  Command contains dangerous arguments');
      }
    }

    // 8. Enforce max targets for file operations
    if (scriptConfig?.maxTargets && args.length > scriptConfig.maxTargets) {
      result.requiresApproval = true;
      result.warnings.push(
        `⚠️  Operation affects ${args.length} targets (max: ${scriptConfig.maxTargets} without approval)`
      );
    }

    // 9. Safety level enforcement
    if (scriptConfig?.level === 'critical' || scriptConfig?.level === 'high') {
      result.requiresApproval = true;
      if (!result.warnings.some(w => w.includes('safety level'))) {
        result.warnings.push(`⚠️  Script safety level: ${scriptConfig.level.toUpperCase()}`);
      }
    }

    return result;
  }

  /**
   * Format approval prompt for user
   */
  static formatApprovalPrompt(
    scriptName: string,
    args: string[],
    validation: SafetyValidationResult,
    cwd?: string
  ): string {
    const lines: string[] = [
      '╔═══════════════════════════════════════════════════════════╗',
      '║           ⚠️  APPROVAL REQUIRED FOR SKILL EXECUTION       ║',
      '╚═══════════════════════════════════════════════════════════╝',
      '',
      `📜 Script: ${scriptName}`,
      `🔧 Arguments: ${args.length > 0 ? args.join(' ') : '(none)'}`,
    ];

    if (cwd) {
      lines.push(`📂 Working Directory: ${cwd}`);
    }

    lines.push(
      `🔒 Safety Level: ${validation.safetyLevel.toUpperCase()}`,
      ''
    );

    if (validation.warnings.length > 0) {
      lines.push('⚠️  Warnings:');
      validation.warnings.forEach(warning => {
        lines.push(`   ${warning}`);
      });
      lines.push('');
    }

    if (validation.matchedWarnPattern) {
      lines.push(`🎯 Matched Pattern: ${validation.matchedWarnPattern}`, '');
    }

    lines.push(
      '─────────────────────────────────────────────────────────────',
      '❓ Do you want to proceed with this operation?',
      '   Type "yes" to approve or "no" to cancel',
      '─────────────────────────────────────────────────────────────'
    );

    return lines.join('\n');
  }

  /**
   * Validate network operation safety
   * POST/PUT/PATCH/DELETE require approval, GET is safe
   */
  static validateNetworkOperation(
    method: string,
    url: string,
    requireApprovalForMutations: boolean = true
  ): SafetyValidationResult {
    const result: SafetyValidationResult = {
      allowed: true,
      requiresApproval: false,
      blocked: false,
      warnings: [],
      safetyLevel: 'low'
    };

    const normalizedMethod = method.toUpperCase();
    const mutationMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];

    if (mutationMethods.includes(normalizedMethod) && requireApprovalForMutations) {
      result.requiresApproval = true;
      result.safetyLevel = 'medium';
      result.warnings.push(
        `⚠️  ${normalizedMethod} request to external server: ${url}`,
        `⚠️  This operation may modify data on the remote server`
      );
    }

    // Check for localhost/internal IPs (generally safer)
    const isLocalhost = /^https?:\/\/(localhost|127\.0\.0\.|::1|0\.0\.0\.0)/i.test(url);
    const isPrivateIP = /^https?:\/\/(10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.)/i.test(url);

    if (!isLocalhost && !isPrivateIP && mutationMethods.includes(normalizedMethod)) {
      result.warnings.push('⚠️  Request to external (non-localhost) server');
    }

    return result;
  }
}
