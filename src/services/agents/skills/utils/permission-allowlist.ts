/**
 * Permission Allowlist System
 *
 * Claude Code-style permission system for skill execution.
 * Supports patterns like:
 * - Bash(command:*)
 * - WebFetch(domain:example.com)
 * - Read(/path/to/**)
 */

import minimatch from 'minimatch';

export interface PermissionConfig {
  allow: string[];
  deny: string[];
  ask: string[];
}

export type PermissionResult = 'allow' | 'deny' | 'ask';

export interface PermissionCheck {
  result: PermissionResult;
  matched: boolean;
  matchedPattern?: string;
  reason?: string;
}

export class PermissionAllowlist {
  private allowPatterns: string[];
  private denyPatterns: string[];
  private askPatterns: string[];

  constructor(config: PermissionConfig) {
    this.allowPatterns = config.allow || [];
    this.denyPatterns = config.deny || [];
    this.askPatterns = config.ask || [];
  }

  /**
   * Check if a permission is allowed
   *
   * Format examples:
   * - Bash(rm:*) - Allow rm with any arguments
   * - Bash(rm -rf *) - Allow exact command
   * - WebFetch(domain:github.com) - Allow specific domain
   * - Read(/tmp/**) - Allow reading from /tmp
   */
  check(permission: string): PermissionCheck {
    // Normalize permission string
    const normalized = this.normalizePermission(permission);

    // Check deny list first (highest priority)
    for (const pattern of this.denyPatterns) {
      if (this.matchesPattern(normalized, pattern)) {
        return {
          result: 'deny',
          matched: true,
          matchedPattern: pattern,
          reason: 'Explicitly denied by permission configuration'
        };
      }
    }

    // Check ask list (requires user approval)
    for (const pattern of this.askPatterns) {
      if (this.matchesPattern(normalized, pattern)) {
        return {
          result: 'ask',
          matched: true,
          matchedPattern: pattern,
          reason: 'Requires user approval'
        };
      }
    }

    // Check allow list
    for (const pattern of this.allowPatterns) {
      if (this.matchesPattern(normalized, pattern)) {
        return {
          result: 'allow',
          matched: true,
          matchedPattern: pattern
        };
      }
    }

    // Default: not matched - requires approval
    return {
      result: 'ask',
      matched: false,
      reason: 'No matching permission found - requires approval'
    };
  }

  /**
   * Build permission string from components
   */
  static buildPermission(
    type: 'Bash' | 'WebFetch' | 'Read' | 'Write' | 'NetworkOp',
    value: string
  ): string {
    return `${type}(${value})`;
  }

  /**
   * Parse permission string into components
   */
  static parsePermission(permission: string): {
    type: string;
    value: string;
  } | null {
    const match = permission.match(/^(\w+)\((.+)\)$/);
    if (!match) {
      return null;
    }

    return {
      type: match[1],
      value: match[2]
    };
  }

  /**
   * Normalize permission for matching
   */
  private normalizePermission(permission: string): string {
    return permission.trim();
  }

  /**
   * Match permission against pattern
   *
   * Supports:
   * - Exact match: "Bash(rm -rf /tmp/test)"
   * - Wildcard: "Bash(rm:*)" matches "Bash(rm:any args)"
   * - Glob: "Read(/tmp/**)" matches "Read(/tmp/foo/bar)"
   */
  private matchesPattern(permission: string, pattern: string): boolean {
    const permParsed = PermissionAllowlist.parsePermission(permission);
    const patternParsed = PermissionAllowlist.parsePermission(pattern);

    if (!permParsed || !patternParsed) {
      // Fallback to exact match
      return permission === pattern;
    }

    // Type must match
    if (permParsed.type !== patternParsed.type) {
      return false;
    }

    // Check value with minimatch for glob support
    return minimatch(permParsed.value, patternParsed.value, {
      dot: true, // Match dotfiles
      nocase: false // Case sensitive
    });
  }

  /**
   * Add patterns dynamically
   */
  addAllowPattern(pattern: string): void {
    if (!this.allowPatterns.includes(pattern)) {
      this.allowPatterns.push(pattern);
    }
  }

  addDenyPattern(pattern: string): void {
    if (!this.denyPatterns.includes(pattern)) {
      this.denyPatterns.push(pattern);
    }
  }

  addAskPattern(pattern: string): void {
    if (!this.askPatterns.includes(pattern)) {
      this.askPatterns.push(pattern);
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): PermissionConfig {
    return {
      allow: [...this.allowPatterns],
      deny: [...this.denyPatterns],
      ask: [...this.askPatterns]
    };
  }
}
