/**
 * Settings Manager for Simple Agent
 *
 * Manages persistent user settings including approval permissions.
 * Settings are stored in ~/.simple-agent/settings.json
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import micromatch from 'micromatch';

export interface ApprovalPermission {
  skillName: string;
  scriptPath: string;
  args: string[];
  approved: boolean;
  timestamp: number;
  expiresAt?: number; // Optional expiration timestamp
}

export interface AgentSettings {
  version: string;
  approvalPermissions: ApprovalPermission[];
  preferences: {
    autoApproveReadOperations?: boolean;
    confirmDestructiveActions?: boolean;
  };
  permissions: PermissionSettings;
}

export interface PermissionSettings {
  fileSystem?: {
    read?: PermissionRuleSet;
    write?: PermissionRuleSet;
    delete?: PermissionRuleSet;
  };
}

export interface PermissionRuleSet {
  allow?: string[];
  deny?: string[];
}

const DEFAULT_SETTINGS: AgentSettings = {
  version: '1.0.0',
  approvalPermissions: [],
  preferences: {
    autoApproveReadOperations: true,  // Auto-approve reads by default for better UX
    confirmDestructiveActions: true
  },
  permissions: {}
};

export class SettingsManager {
  private settingsPath: string;
  private settings: AgentSettings;

  constructor(customPath?: string) {
    const configDir = customPath || path.join(os.homedir(), '.simple-agent');
    this.settingsPath = path.join(configDir, 'settings.json');

    // Ensure config directory exists
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    this.settings = this.loadSettings();
    this.ensureSettingsFile();
  }

  /**
   * Load settings from disk
   */
  private loadSettings(): AgentSettings {
    try {
      if (fs.existsSync(this.settingsPath)) {
        const data = fs.readFileSync(this.settingsPath, 'utf-8');
        const loaded = JSON.parse(data) as AgentSettings;

        loaded.approvalPermissions = (loaded.approvalPermissions || []).filter(p => {
          if (!p.expiresAt) return true;
          return p.expiresAt > Date.now();
        });

        loaded.preferences = {
          ...DEFAULT_SETTINGS.preferences,
          ...loaded.preferences
        };

        loaded.permissions = loaded.permissions || { ...DEFAULT_SETTINGS.permissions };

        return loaded;
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }

    return { ...DEFAULT_SETTINGS };
  }

  /**
   * Save settings to disk
   */
  private saveSettings(): void {
    try {
      fs.writeFileSync(
        this.settingsPath,
        JSON.stringify(this.settings, null, 2),
        'utf-8'
      );
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  }

  /**
   * Ensure settings file exists on disk
   */
  private ensureSettingsFile(): void {
    if (!fs.existsSync(this.settingsPath)) {
      this.saveSettings();
    }
  }

  /**
   * Add or update an approval permission
   */
  addApprovalPermission(
    skillName: string,
    scriptPath: string,
    args: string[],
    approved: boolean,
    expiresInMs?: number
  ): void {
    const isWildcard = args.length === 1 && args[0] === '*';

    this.settings.approvalPermissions = this.settings.approvalPermissions.filter(p => {
      if (p.skillName !== skillName || p.scriptPath !== scriptPath) {
        return true;
      }

      if (isWildcard) {
        // Replace all existing entries for this script with the wildcard
        return false;
      }

      const existingIsWildcard = p.args.length === 1 && p.args[0] === '*';
      if (existingIsWildcard) {
        // Wildcard already covers all args – keep it and skip adding duplicates
        return true;
      }

      return JSON.stringify(p.args) !== JSON.stringify(args);
    });

    // If a wildcard already exists, no need to add duplicates
    if (!isWildcard) {
      const hasWildcard = this.settings.approvalPermissions.some(p =>
        p.skillName === skillName &&
        p.scriptPath === scriptPath &&
        p.args.length === 1 &&
        p.args[0] === '*'
      );

      if (hasWildcard) {
        this.saveSettings();
        return;
      }
    }

    // Add new permission
    const permission: ApprovalPermission = {
      skillName,
      scriptPath,
      args,
      approved,
      timestamp: Date.now(),
      expiresAt: expiresInMs ? Date.now() + expiresInMs : undefined
    };

    this.settings.approvalPermissions.push(permission);
    this.saveSettings();
  }

  /**
   * Check if an operation has a remembered permission
   */
  hasApprovalPermission(
    skillName: string,
    scriptPath: string,
    args: string[]
  ): boolean | undefined {
    const permission = this.settings.approvalPermissions.find(
      p =>
        p.skillName === skillName &&
        p.scriptPath === scriptPath &&
        this.argsMatch(p.args, args)
    );

    if (!permission) return undefined;

    // Check if expired
    if (permission.expiresAt && permission.expiresAt < Date.now()) {
      this.removeApprovalPermission(skillName, scriptPath, args);
      return undefined;
    }

    return permission.approved;
  }

  /**
   * Remove an approval permission
   */
  removeApprovalPermission(
    skillName: string,
    scriptPath: string,
    args: string[]
  ): void {
    this.settings.approvalPermissions = this.settings.approvalPermissions.filter(
      p => !(p.skillName === skillName &&
             p.scriptPath === scriptPath &&
             JSON.stringify(p.args) === JSON.stringify(args))
    );
    this.saveSettings();
  }

  /**
   * Clear all approval permissions
   */
  clearAllPermissions(): void {
    this.settings.approvalPermissions = [];
    this.saveSettings();
  }

  /**
   * Get all approval permissions
   */
  getAllPermissions(): ApprovalPermission[] {
    return [...this.settings.approvalPermissions];
  }

  /**
   * Update preferences
   */
  updatePreferences(preferences: Partial<AgentSettings['preferences']>): void {
    this.settings.preferences = {
      ...this.settings.preferences,
      ...preferences
    };
    this.saveSettings();
  }

  /**
   * Get current preferences
   */
  getPreferences(): AgentSettings['preferences'] {
    return { ...this.settings.preferences };
  }

  /**
   * Get settings file path
   */
  getSettingsPath(): string {
    return this.settingsPath;
  }

  /**
   * Update permission rules
   */
  updatePermissions(permissions: Partial<PermissionSettings>): void {
    this.settings.permissions = {
      ...this.settings.permissions,
      ...permissions
    };
    this.saveSettings();
  }

  /**
   * Get permission rules
   */
  getPermissions(): PermissionSettings {
    return {
      fileSystem: {
        ...this.settings.permissions.fileSystem
      }
    };
  }

  /**
   * Evaluate file-system permission for a path
   */
  evaluateFileSystemPermission(
    action: 'read' | 'write' | 'delete',
    targetPath: string
  ): 'allow' | 'deny' | 'unknown' {
    const fileSystem = this.settings.permissions.fileSystem;
    if (!fileSystem) {
      return 'unknown';
    }

    const ruleSet = fileSystem[action];
    if (!ruleSet) {
      return 'unknown';
    }

    const normalizedPath = this.normalizePath(targetPath);

    if (ruleSet.deny && this.matchesAny(ruleSet.deny, normalizedPath)) {
      return 'deny';
    }

    if (ruleSet.allow && ruleSet.allow.length > 0 && this.matchesAny(ruleSet.allow, normalizedPath)) {
      return 'allow';
    }

    return 'unknown';
  }

  private argsMatch(storedArgs: string[], actualArgs: string[]): boolean {
    if (storedArgs.length === 1 && storedArgs[0] === '*') {
      return true;
    }

    if (storedArgs.length !== actualArgs.length) {
      return false;
    }

    for (let i = 0; i < storedArgs.length; i += 1) {
      const expected = storedArgs[i];
      const actual = actualArgs[i];

      if (this.isGlobPattern(expected)) {
        if (!micromatch.isMatch(actual, expected)) {
          return false;
        }
      } else if (expected !== actual) {
        return false;
      }
    }

    return true;
  }

  private matchesAny(patterns: string[], value: string): boolean {
    if (!patterns || patterns.length === 0) {
      return false;
    }
    return micromatch.isMatch(value, patterns, { nocase: true });
  }

  private isGlobPattern(value: string): boolean {
    return /[*?[\]{}()!+@]/.test(value);
  }

  private normalizePath(targetPath: string): string {
    if (!targetPath) return targetPath;
    try {
      return path.resolve(targetPath);
    } catch {
      return targetPath;
    }
  }
}

// Singleton instance
let instance: SettingsManager | null = null;

/**
 * Get singleton settings manager
 */
export function getSettingsManager(customPath?: string): SettingsManager {
  if (!instance) {
    instance = new SettingsManager(customPath);
  }
  return instance;
}

/**
 * Reset singleton (for testing)
 */
export function resetSettingsManager(): void {
  instance = null;
}
