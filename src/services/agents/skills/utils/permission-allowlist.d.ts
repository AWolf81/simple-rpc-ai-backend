/**
 * Permission Allowlist System
 *
 * Claude Code-style permission system for skill execution.
 * Supports patterns like:
 * - Bash(command:*)
 * - WebFetch(domain:example.com)
 * - Read(/path/to/**)
 */
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
export declare class PermissionAllowlist {
    private allowPatterns;
    private denyPatterns;
    private askPatterns;
    constructor(config: PermissionConfig);
    /**
     * Check if a permission is allowed
     *
     * Format examples:
     * - Bash(rm:*) - Allow rm with any arguments
     * - Bash(rm -rf *) - Allow exact command
     * - WebFetch(domain:github.com) - Allow specific domain
     * - Read(/tmp/**) - Allow reading from /tmp
     */
    check(permission: string): PermissionCheck;
    /**
     * Build permission string from components
     */
    static buildPermission(type: 'Bash' | 'WebFetch' | 'Read' | 'Write' | 'NetworkOp', value: string): string;
    /**
     * Parse permission string into components
     */
    static parsePermission(permission: string): {
        type: string;
        value: string;
    } | null;
    /**
     * Normalize permission for matching
     */
    private normalizePermission;
    /**
     * Match permission against pattern
     *
     * Supports:
     * - Exact match: "Bash(rm -rf /tmp/test)"
     * - Wildcard: "Bash(rm:*)" matches "Bash(rm:any args)"
     * - Glob: "Read(/tmp/**)" matches "Read(/tmp/foo/bar)"
     */
    private matchesPattern;
    /**
     * Add patterns dynamically
     */
    addAllowPattern(pattern: string): void;
    addDenyPattern(pattern: string): void;
    addAskPattern(pattern: string): void;
    /**
     * Get current configuration
     */
    getConfig(): PermissionConfig;
}
