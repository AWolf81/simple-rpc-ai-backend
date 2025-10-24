/**
 * Configuration Discovery and Loading
 *
 * Implements hierarchical .env file discovery following best practices:
 * 1. Command-line arguments (highest priority)
 * 2. Current working directory .env
 * 3. User config directory ~/.simple-agent/.env
 * 4. System defaults (lowest priority)
 *
 * Inspired by:
 * - AWS CLI configuration discovery
 * - Git configuration hierarchy
 * - Docker context discovery
 */

import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { join, resolve } from 'path';

export interface AgentConfig {
  // Server connection
  serverUrl?: string;
  serverPort?: number;

  // AI provider
  provider?: 'anthropic' | 'openai' | 'google' | 'openrouter';
  model?: string;

  // API keys
  anthropicApiKey?: string;
  openaiApiKey?: string;
  googleApiKey?: string;
  openrouterApiKey?: string;

  // CLI behavior
  silent?: boolean;
  logLevel?: 'debug' | 'info' | 'warn' | 'error' | 'silent';

  // Features
  enablePlugins?: boolean;
  enableSkills?: boolean;
}

interface ConfigSource {
  name: string;
  path: string;
  exists: boolean;
  priority: number;
}

/**
 * Best practices for config file locations
 */
export const CONFIG_LOCATIONS = {
  // 1. Project-specific (highest priority for overrides)
  PROJECT: '.env',

  // 1b. Project root (for monorepo/tools subdirectory usage)
  PROJECT_ROOT: join(process.cwd(), '../../.env'),

  // 2. User-specific config directory
  USER_CONFIG_DIR: join(homedir(), '.simple-agent'),
  USER_ENV: join(homedir(), '.simple-agent', '.env'),
  USER_CONFIG: join(homedir(), '.simple-agent', 'config.json'),

  // 3. Alternative locations (for compatibility)
  USER_HOME_ENV: join(homedir(), '.simple-agent.env'),

  // 4. System-wide (lowest priority)
  SYSTEM_CONFIG: '/etc/simple-agent/config.json'
} as const;

/**
 * Load environment variables from .env file
 */
function loadEnvFile(path: string): Record<string, string> {
  if (!existsSync(path)) {
    return {};
  }

  const content = readFileSync(path, 'utf-8');
  const env: Record<string, string> = {};

  // Parse .env format (KEY=value)
  content.split('\n').forEach(line => {
    // Skip comments and empty lines
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      return;
    }

    // Parse KEY=value
    const match = trimmed.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      let value = match[2].trim();

      // Remove quotes if present
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }

      env[key] = value;
    }
  });

  return env;
}

/**
 * Load JSON config file
 */
function loadJsonConfig(path: string): Partial<AgentConfig> {
  if (!existsSync(path)) {
    return {};
  }

  try {
    const content = readFileSync(path, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.warn(`⚠️  Failed to parse config file ${path}:`, error);
    return {};
  }
}

/**
 * Discover all config file locations
 */
export function discoverConfigSources(cwd: string = process.cwd()): ConfigSource[] {
  const sources: ConfigSource[] = [
    {
      name: 'Project .env',
      path: resolve(cwd, CONFIG_LOCATIONS.PROJECT),
      exists: existsSync(resolve(cwd, CONFIG_LOCATIONS.PROJECT)),
      priority: 1
    },
    {
      name: 'Project root .env',
      path: CONFIG_LOCATIONS.PROJECT_ROOT,
      exists: existsSync(CONFIG_LOCATIONS.PROJECT_ROOT),
      priority: 2
    },
    {
      name: 'User config directory',
      path: CONFIG_LOCATIONS.USER_ENV,
      exists: existsSync(CONFIG_LOCATIONS.USER_ENV),
      priority: 3
    },
    {
      name: 'User home .env',
      path: CONFIG_LOCATIONS.USER_HOME_ENV,
      exists: existsSync(CONFIG_LOCATIONS.USER_HOME_ENV),
      priority: 4
    }
  ];

  return sources;
}

/**
 * Load configuration from all sources with proper precedence
 */
export function loadConfig(cwd: string = process.cwd()): AgentConfig {
  const config: AgentConfig = {};

  // 1. Load from environment variables (highest priority)
  if (process.env.ANTHROPIC_API_KEY) {
    config.anthropicApiKey = process.env.ANTHROPIC_API_KEY;
  }
  if (process.env.OPENAI_API_KEY) {
    config.openaiApiKey = process.env.OPENAI_API_KEY;
  }
  if (process.env.GOOGLE_API_KEY) {
    config.googleApiKey = process.env.GOOGLE_API_KEY;
  }
  if (process.env.OPENROUTER_API_KEY) {
    config.openrouterApiKey = process.env.OPENROUTER_API_KEY;
  }
  if (process.env.AI_PROVIDER) {
    config.provider = process.env.AI_PROVIDER as AgentConfig['provider'];
  }
  if (process.env.AI_MODEL) {
    config.model = process.env.AI_MODEL;
  }
  if (process.env.LOG_LEVEL) {
    config.logLevel = process.env.LOG_LEVEL as AgentConfig['logLevel'];
  }

  // 2. Load from user config JSON (if exists)
  const userJsonConfig = loadJsonConfig(CONFIG_LOCATIONS.USER_CONFIG);
  Object.assign(config, userJsonConfig);

  // 3. Load from user .env files (in order of priority)
  const userHomeEnv = loadEnvFile(CONFIG_LOCATIONS.USER_HOME_ENV);
  applyEnvToConfig(config, userHomeEnv);

  const userEnv = loadEnvFile(CONFIG_LOCATIONS.USER_ENV);
  applyEnvToConfig(config, userEnv);

  // 4. Load from project root .env (for monorepo/tools subdirectory)
  const projectRootEnv = loadEnvFile(CONFIG_LOCATIONS.PROJECT_ROOT);
  applyEnvToConfig(config, projectRootEnv);

  // 5. Load from project .env (highest priority for overrides)
  const projectEnv = loadEnvFile(resolve(cwd, CONFIG_LOCATIONS.PROJECT));
  applyEnvToConfig(config, projectEnv);

  return config;
}

/**
 * Apply environment variables to config
 */
function applyEnvToConfig(config: AgentConfig, env: Record<string, string>): void {
  if (env.ANTHROPIC_API_KEY && !config.anthropicApiKey) {
    config.anthropicApiKey = env.ANTHROPIC_API_KEY;
  }
  if (env.OPENAI_API_KEY && !config.openaiApiKey) {
    config.openaiApiKey = env.OPENAI_API_KEY;
  }
  if (env.GOOGLE_API_KEY && !config.googleApiKey) {
    config.googleApiKey = env.GOOGLE_API_KEY;
  }
  if (env.OPENROUTER_API_KEY && !config.openrouterApiKey) {
    config.openrouterApiKey = env.OPENROUTER_API_KEY;
  }
  if (env.AI_PROVIDER && !config.provider) {
    config.provider = env.AI_PROVIDER as AgentConfig['provider'];
  }
  if (env.AI_MODEL && !config.model) {
    config.model = env.AI_MODEL;
  }
  if (env.SERVER_URL && !config.serverUrl) {
    config.serverUrl = env.SERVER_URL;
  }
  if (env.SERVER_PORT && !config.serverPort) {
    config.serverPort = parseInt(env.SERVER_PORT);
  }
  if (env.LOG_LEVEL && !config.logLevel) {
    config.logLevel = env.LOG_LEVEL as AgentConfig['logLevel'];
  }
}

/**
 * Print configuration discovery information (for --verbose)
 */
export function printConfigDiscovery(cwd: string = process.cwd()): void {
  console.log('\n📁 Configuration Discovery:\n');

  const sources = discoverConfigSources(cwd);
  sources.forEach(source => {
    const status = source.exists ? '✅' : '❌';
    console.log(`  ${status} [Priority ${source.priority}] ${source.name}`);
    console.log(`     ${source.path}`);
  });

  // User config directory info
  const userConfigDirExists = existsSync(CONFIG_LOCATIONS.USER_CONFIG_DIR);
  console.log(`\n📂 User Config Directory: ${CONFIG_LOCATIONS.USER_CONFIG_DIR}`);
  console.log(`   ${userConfigDirExists ? '✅ Exists' : '❌ Not created'}`);

  if (!userConfigDirExists) {
    console.log('\n💡 Tip: Create user config directory:');
    console.log(`   mkdir -p ${CONFIG_LOCATIONS.USER_CONFIG_DIR}`);
    console.log(`   echo "OPENROUTER_API_KEY=your_key" > ${CONFIG_LOCATIONS.USER_ENV}`);
  }

  console.log('\n📋 Configuration Precedence (highest to lowest):');
  console.log('   1. Command-line arguments (e.g., --port 8000)');
  console.log('   2. Environment variables (e.g., export ANTHROPIC_API_KEY=...)');
  console.log('   3. Project .env file (current directory)');
  console.log('   4. User config ~/.simple-agent/.env');
  console.log('   5. User home ~/.simple-agent.env');
  console.log('   6. System defaults\n');
}

/**
 * Validate configuration and provide helpful error messages
 */
export function validateConfig(config: AgentConfig, skipApiKeyCheck: boolean = false): { valid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check if at least one AI provider is configured (unless using free model)
  const hasAnyApiKey =
    config.anthropicApiKey ||
    config.openaiApiKey ||
    config.googleApiKey ||
    config.openrouterApiKey ||
    process.env.ANTHROPIC_API_KEY ||
    process.env.OPENAI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.OPENROUTER_API_KEY;

  // Check if using free model
  const usingFreeModel = config.provider === 'openrouter' &&
    (config.model?.includes(':free') || config.model === 'qwen/qwen-2.5-coder-32b-instruct');

  if (!hasAnyApiKey && !skipApiKeyCheck && !usingFreeModel) {
    errors.push(
      '\n❌ No AI Provider API Key Found\n\n' +
      '┌─────────────────────────────────────────────────────────────┐\n' +
      '│  Simple Agent requires an AI provider to interpret your    │\n' +
      '│  natural language requests.                                 │\n' +
      '└─────────────────────────────────────────────────────────────┘\n\n' +
      '🔑 Quick Setup Options:\n\n' +
      '  Option 1: Recommended (OpenRouter + Claude Sonnet)\n' +
      '  ────────────────────────────────────────────────\n' +
      '  $ simple-agent init\n' +
      '  $ nano ~/.simple-agent/.env\n' +
      '  (set OPENROUTER_API_KEY=your-key — https://openrouter.ai/keys)\n' +
      '  $ simple-agent\n\n' +
      '  Option 2: Direct Anthropic API key\n' +
      '  ──────────────────────────────────\n' +
      '  $ export ANTHROPIC_API_KEY=your_key\n' +
      '  $ simple-agent\n\n' +
      '  Option 3: Other providers (OpenAI, Google)\n' +
      '  ──────────────────────────────────────\n' +
      '  $ export OPENAI_API_KEY=your_key\n' +
      '  $ simple-agent\n\n' +
      '📚 Supported Providers:\n' +
      '  • OpenRouter (recommended) - OPENROUTER_API_KEY\n' +
      '  • Anthropic Claude - ANTHROPIC_API_KEY\n' +
      '  • OpenAI GPT - OPENAI_API_KEY\n' +
      '  • Google Gemini - GOOGLE_API_KEY\n\n' +
      '💡 For detailed configuration help:\n' +
      '  $ simple-agent help-config\n'
    );
  } else if (usingFreeModel && !hasAnyApiKey) {
    warnings.push(
      '⚠️  OpenRouter API key required\n' +
      '   Get a free key at: https://openrouter.ai/keys\n' +
      '   Then: export OPENROUTER_API_KEY=your-key\n' +
      '   Model: ' + config.model
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Create default user config directory and files
 */
export function initializeUserConfig(): boolean {
  try {
    // Create directory if it doesn't exist
    if (!existsSync(CONFIG_LOCATIONS.USER_CONFIG_DIR)) {
      mkdirSync(CONFIG_LOCATIONS.USER_CONFIG_DIR, { recursive: true });
      console.log(`✅ Created config directory: ${CONFIG_LOCATIONS.USER_CONFIG_DIR}`);
    }

    // Create example .env file if it doesn't exist
    if (!existsSync(CONFIG_LOCATIONS.USER_ENV)) {
      const exampleEnv = `# Simple Agent Configuration
# Default setup: Anthropic Claude 3.7 Sonnet via OpenRouter
OPENROUTER_API_KEY=
AI_PROVIDER=openrouter
AI_MODEL=anthropic/claude-3-7-sonnet

# ──────────────────────────────────────────────────────────────────
# Optional: Additional providers (uncomment and add your key/model)
# ──────────────────────────────────────────────────────────────────
# ANTHROPIC_API_KEY=sk-ant-...
# OPENAI_API_KEY=sk-...
# GOOGLE_API_KEY=...

# ──────────────────────────────────────────────────────────────────
# Server Connection (optional - auto-detects localhost:8000)
# ──────────────────────────────────────────────────────────────────
# SERVER_URL=http://localhost:8000
# SERVER_PORT=8000

# ──────────────────────────────────────────────────────────────────
# Logging
# ──────────────────────────────────────────────────────────────────
# LOG_LEVEL=info  # Options: debug, info, warn, error, silent
`;

      writeFileSync(CONFIG_LOCATIONS.USER_ENV, exampleEnv);
      console.log(`✅ Created example config: ${CONFIG_LOCATIONS.USER_ENV}`);
      console.log('\n📝 Edit this file to add your API keys');
    }

    return true;
  } catch (error) {
    console.error('❌ Failed to initialize user config:', error);
    return false;
  }
}

/**
 * Get effective configuration summary (for debugging)
 */
export function getConfigSummary(config: AgentConfig, resolvedDefaults?: { provider?: string; model?: string }): string {
  // Determine effective provider
  let effectiveProvider = config.provider || resolvedDefaults?.provider || '(not set)';
  if (effectiveProvider === '(not set)') {
    // Auto-detect from available keys
    if (config.anthropicApiKey || process.env.ANTHROPIC_API_KEY) {
      effectiveProvider = 'anthropic (auto-detected)';
    } else if (config.openaiApiKey || process.env.OPENAI_API_KEY) {
      effectiveProvider = 'openai (auto-detected)';
    } else if (config.googleApiKey || process.env.GOOGLE_API_KEY) {
      effectiveProvider = 'google (auto-detected)';
    } else if (config.openrouterApiKey || process.env.OPENROUTER_API_KEY) {
      effectiveProvider = 'openrouter (auto-detected)';
    } else {
      effectiveProvider = 'openrouter (free model fallback)';
    }
  }

  // Determine effective model
  let effectiveModel = config.model || resolvedDefaults?.model || '(not set)';
  if (effectiveModel === '(not set)') {
    if (effectiveProvider.includes('anthropic')) {
      effectiveModel = 'claude-sonnet-3-7 (default)';
    } else if (effectiveProvider.includes('openai')) {
      effectiveModel = 'gpt-4 (default)';
    } else if (effectiveProvider.includes('google')) {
      effectiveModel = 'gemini-pro (default)';
    } else if (effectiveProvider.includes('openrouter')) {
      effectiveModel = 'anthropic/claude-3-7-sonnet (default)';
    }
  }

  return `
📊 Effective Configuration:

  AI Provider: ${effectiveProvider}
  AI Model: ${effectiveModel}

  API Keys:
    Anthropic: ${config.anthropicApiKey || process.env.ANTHROPIC_API_KEY ? '✅ Set' : '❌ Not set'}
    OpenAI: ${config.openaiApiKey || process.env.OPENAI_API_KEY ? '✅ Set' : '❌ Not set'}
    Google: ${config.googleApiKey || process.env.GOOGLE_API_KEY ? '✅ Set' : '❌ Not set'}
    OpenRouter: ${config.openrouterApiKey || process.env.OPENROUTER_API_KEY ? '✅ Set' : '❌ Not set'}

  Server:
    URL: ${config.serverUrl || '(will auto-detect localhost)'}
    Port: ${config.serverPort || '8000 (default)'}

  Logging: ${config.logLevel || 'info (default)'}
`;
}
