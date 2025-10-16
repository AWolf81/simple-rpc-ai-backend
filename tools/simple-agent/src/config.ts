/**
 * Configuration Manager for simple-agent
 *
 * Manages configuration file in ~/.simple-agent/config.json
 */

import Conf from 'conf';
import os from 'os';
import path from 'path';
import fs from 'fs';

export interface AgentConfig {
  // Server configuration
  server?: {
    port?: number;
    host?: string;
    autoStart?: boolean;
  };

  // Provider configuration
  provider?: {
    default?: 'openrouter' | 'anthropic' | 'openai' | 'google';
    openrouter?: {
      apiKey?: string;
      model?: string;
    };
    anthropic?: {
      apiKey?: string;
      model?: string;
    };
    openai?: {
      apiKey?: string;
      model?: string;
    };
    google?: {
      apiKey?: string;
      model?: string;
    };
  };

  // Agent configuration
  agent?: {
    defaultSDK?: 'claude-code' | 'openai';
    enableSkills?: boolean;
    skillsDirectory?: string;
  };

  // MCP configuration
  mcp?: {
    enabled?: boolean;
    servers?: Array<{
      name: string;
      command: string;
      args?: string[];
      env?: Record<string, string>;
    }>;
  };

  // UI preferences
  ui?: {
    theme?: 'light' | 'dark';
    verbose?: boolean;
  };
}

export class ConfigManager {
  private config: Conf<AgentConfig>;
  private configDir: string;

  constructor() {
    this.configDir = path.join(os.homedir(), '.simple-agent');

    // Ensure config directory exists
    if (!fs.existsSync(this.configDir)) {
      fs.mkdirSync(this.configDir, { recursive: true });
    }

    this.config = new Conf<AgentConfig>({
      projectName: 'simple-agent',
      cwd: this.configDir,
      defaults: this.getDefaults()
    });
  }

  private getDefaults(): AgentConfig {
    return {
      server: {
        port: 8000,
        host: 'localhost',
        autoStart: true
      },
      provider: {
        default: 'openrouter',
        openrouter: {
          model: 'qwen/qwen-2.5-coder-32b-instruct:free'
        }
      },
      agent: {
        defaultSDK: 'claude-code',
        enableSkills: true
      },
      mcp: {
        enabled: false,
        servers: []
      },
      ui: {
        theme: 'dark',
        verbose: false
      }
    };
  }

  /**
   * Get configuration value
   */
  get<K extends keyof AgentConfig>(key: K): AgentConfig[K] {
    return this.config.get(key);
  }

  /**
   * Set configuration value
   */
  set<K extends keyof AgentConfig>(key: K, value: AgentConfig[K]): void {
    this.config.set(key, value);
  }

  /**
   * Get all configuration
   */
  getAll(): AgentConfig {
    return this.config.store;
  }

  /**
   * Reset to defaults
   */
  reset(): void {
    this.config.clear();
  }

  /**
   * Get configuration file path
   */
  getConfigPath(): string {
    return this.config.path;
  }

  /**
   * Get configuration directory
   */
  getConfigDir(): string {
    return this.configDir;
  }

  /**
   * Auto-detect API keys from environment
   */
  detectProviders(): {
    provider: 'openrouter' | 'anthropic' | 'openai' | 'google';
    apiKey: string;
    model?: string;
  }[] {
    const detected: ReturnType<ConfigManager['detectProviders']> = [];

    // Check for API keys in environment
    if (process.env.OPENROUTER_API_KEY) {
      detected.push({
        provider: 'openrouter',
        apiKey: process.env.OPENROUTER_API_KEY,
        model: 'qwen/qwen-2.5-coder-32b-instruct:free'
      });
    }

    if (process.env.ANTHROPIC_API_KEY) {
      detected.push({
        provider: 'anthropic',
        apiKey: process.env.ANTHROPIC_API_KEY,
        model: 'claude-3-5-sonnet-20241022'
      });
    }

    if (process.env.OPENAI_API_KEY) {
      detected.push({
        provider: 'openai',
        apiKey: process.env.OPENAI_API_KEY,
        model: 'gpt-4o'
      });
    }

    if (process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      detected.push({
        provider: 'google',
        apiKey: process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY!,
        model: 'gemini-2.0-flash'
      });
    }

    return detected;
  }

  /**
   * Get best available provider
   * Priority: Environment variables > Configured provider > Default (qwen-coder:free via OpenRouter)
   */
  getBestProvider(): {
    provider: 'openrouter' | 'anthropic' | 'openai' | 'google';
    apiKey: string;
    model: string;
  } {
    // First, check environment for API keys
    const detected = this.detectProviders();
    if (detected.length > 0) {
      return detected[0] as any;
    }

    // Then check configured provider
    const configuredProvider = this.get('provider');
    if (configuredProvider?.default) {
      const providerConfig = configuredProvider[configuredProvider.default];
      if (providerConfig?.apiKey) {
        return {
          provider: configuredProvider.default,
          apiKey: providerConfig.apiKey,
          model: providerConfig.model || this.getDefaults().provider!.openrouter!.model!
        };
      }
    }

    // Default to qwen-coder:free (no API key needed)
    return {
      provider: 'openrouter',
      apiKey: '', // Free model doesn't require API key
      model: 'qwen/qwen-2.5-coder-32b-instruct:free'
    };
  }

  /**
   * Register MCP server
   */
  registerMCPServer(config: {
    name: string;
    command: string;
    args?: string[];
    env?: Record<string, string>;
  }): void {
    const mcp = this.get('mcp') || { enabled: false, servers: [] };

    // Check if server already registered
    const existing = mcp.servers?.findIndex(s => s.name === config.name);
    if (existing !== undefined && existing >= 0) {
      mcp.servers![existing] = config;
    } else {
      mcp.servers = mcp.servers || [];
      mcp.servers.push(config);
    }

    this.set('mcp', mcp);
  }

  /**
   * Unregister MCP server
   */
  unregisterMCPServer(name: string): void {
    const mcp = this.get('mcp');
    if (mcp?.servers) {
      mcp.servers = mcp.servers.filter(s => s.name !== name);
      this.set('mcp', mcp);
    }
  }

  /**
   * List MCP servers
   */
  listMCPServers(): Array<{
    name: string;
    command: string;
    args?: string[];
    env?: Record<string, string>;
  }> {
    return this.get('mcp')?.servers || [];
  }
}

// Singleton instance
export const configManager = new ConfigManager();
