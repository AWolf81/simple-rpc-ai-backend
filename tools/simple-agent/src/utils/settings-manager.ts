/**
 * Settings Manager for Simple Agent
 *
 * Manages persistent user settings including approval permissions.
 * Settings are stored in ~/.simple-agent/settings.json
 */

import fs from 'fs';
import path from 'path';
import os from 'os';

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
}

const DEFAULT_SETTINGS: AgentSettings = {
  version: '1.0.0',
  approvalPermissions: [],
  preferences: {
    autoApproveReadOperations: false,
    confirmDestructiveActions: true
  }
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
  }

  /**
   * Load settings from disk
   */
  private loadSettings(): AgentSettings {
    try {
      if (fs.existsSync(this.settingsPath)) {
        const data = fs.readFileSync(this.settingsPath, 'utf-8');
        const loaded = JSON.parse(data) as AgentSettings;

        // Clean up expired permissions
        loaded.approvalPermissions = loaded.approvalPermissions.filter(p => {
          if (!p.expiresAt) return true;
          return p.expiresAt > Date.now();
        });

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
   * Add or update an approval permission
   */
  addApprovalPermission(
    skillName: string,
    scriptPath: string,
    args: string[],
    approved: boolean,
    expiresInMs?: number
  ): void {
    // Remove any existing permission for this exact combination
    this.settings.approvalPermissions = this.settings.approvalPermissions.filter(
      p => !(p.skillName === skillName &&
             p.scriptPath === scriptPath &&
             JSON.stringify(p.args) === JSON.stringify(args))
    );

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
      p => p.skillName === skillName &&
           p.scriptPath === scriptPath &&
           JSON.stringify(p.args) === JSON.stringify(args)
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
