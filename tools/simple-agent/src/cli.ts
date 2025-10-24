#!/usr/bin/env node

/**
 * Simple Agent CLI - Lightweight AI agent with reactive UI
 *
 * Core features:
 * - Ink-based reactive terminal UI
 * - Plugin system for slash commands
 * - Streaming agent responses
 * - tRPC tool integration
 * - Skill system support
 */

import React from 'react';
import { render } from 'ink';
import { Command } from 'commander';
import App from './components/App.js';
import { startServer } from './core/server.js';
import {
  loadConfig,
  validateConfig,
  printConfigDiscovery,
  initializeUserConfig,
  getConfigSummary,
  CONFIG_LOCATIONS
} from './core/config.js';
import { RpcAiServer } from 'dist/rpc-ai-server.js';

const program = new Command();

program
  .name('agent')
  .description('AI agent CLI with reactive UI and plugin system')
  .version('1.0.0');

program
  .command('chat', { isDefault: true })
  .description('Start interactive chat session')
  .option('-m, --model <model>', 'AI model to use')
  .option('-p, --provider <provider>', 'AI provider (anthropic, openai, google)')
  .option('-s, --silent', 'Silent server mode (no logs)', false)
  .option('--port <port>', 'Connect to server on port (default: 8000)', '8000')
  .option('--url <url>', 'Connect to external server URL (e.g., http://localhost:8000)')
  .option('-v, --verbose', 'Show configuration discovery details', false)
  .action(async (options) => {
    // Load configuration from all sources
    const config = loadConfig();

    // Command-line options override config files
    if (options.model) config.model = options.model;
    if (options.provider) config.provider = options.provider;
    if (options.silent) config.logLevel = 'silent';

    // Default logging: info normally, debug when verbose
    if (!config.logLevel) {
      config.logLevel = options.verbose ? 'debug' : 'info';
    }

    // Show verbose config info if requested (before resolution)
    if (options.verbose) {
      printConfigDiscovery();
      // Will show resolved config after provider determination
    }

    // Validate configuration
    const validation = validateConfig(config);

    // Show warnings (non-fatal)
    if (validation.warnings.length > 0 && !options.silent) {
      validation.warnings.forEach(warning => console.log('\n' + warning));
    }

    // Show errors (fatal)
    if (!validation.valid) {
      validation.errors.forEach(error => console.error(error));
      process.exit(1);
    }

    // Set environment from config
    if (config.anthropicApiKey) process.env.ANTHROPIC_API_KEY = config.anthropicApiKey;
    if (config.openaiApiKey) process.env.OPENAI_API_KEY = config.openaiApiKey;
    if (config.googleApiKey) process.env.GOOGLE_API_KEY = config.googleApiKey;
    if (config.openrouterApiKey) process.env.OPENROUTER_API_KEY = config.openrouterApiKey;
    if (config.logLevel) process.env.LOG_LEVEL = config.logLevel;

    // Determine server URL
    let serverUrl: string;
    // server may be started during runtime - allow a proper server type or null
    let server: { stop?: () => Promise<void> } | null = null;
    let isRemoteServer = false; // Track if we're using a remote server

    if (options.url) {
      // Use external server URL
      serverUrl = options.url;
      isRemoteServer = !serverUrl.includes('localhost') && !serverUrl.includes('127.0.0.1');
      console.log(`🔗 Connecting to external server: ${serverUrl}`);
    } else {
      // Check if port is default (8000) or custom
      const port = parseInt(options.port);

      if (port === 8000) {
        // Try to connect to existing server on default port
        serverUrl = `http://localhost:${port}`;

        // Check if server is already running
        const { checkServerHealth } = await import('./core/server.js');
        const isRunning = await checkServerHealth(serverUrl);

        if (!isRunning) {
          // ⚠️  No server found on port ${port}, starting internal server on port 8001...
          server = await startServer();
          serverUrl = 'http://localhost:8001';
        } else {
          console.log(`✅ Connected to existing server on port ${port}`);
        }
      } else {
        // Custom port specified - try to connect
        serverUrl = `http://localhost:${port}`;
        console.log(`🔗 Connecting to server on port ${port}`);
      }
    }

    // Determine defaults based on available API keys
    let defaultProvider = config.provider;
    let defaultModel = config.model ?? '';

    if (!defaultProvider) {
      // Check for API keys in order of preference
      if (process.env.OPENROUTER_API_KEY) {
        defaultProvider = 'openrouter';
        defaultModel = defaultModel || 'anthropic/claude-3-7-sonnet';
      } else if (config.anthropicApiKey || process.env.ANTHROPIC_API_KEY) {
        defaultProvider = 'anthropic';
        defaultModel = defaultModel || 'claude-3-7-sonnet-20250219';
      } else if (config.openaiApiKey || process.env.OPENAI_API_KEY) {
        defaultProvider = 'openai';
        defaultModel = defaultModel || 'gpt-4o';
      } else if (config.googleApiKey || process.env.GOOGLE_API_KEY) {
        defaultProvider = 'google';
        defaultModel = defaultModel || 'gemini-1.5-flash';
      } else {
        // No API key found - default to OpenRouter but show setup message
        defaultProvider = 'openrouter';
        defaultModel = 'anthropic/claude-3-7-sonnet';
        if (!options.silent && !options.verbose) {
          console.log('\n⚠️  No API key detected');
          console.log('   To get started, create a free OpenRouter account and API key:');
          console.log('   1. Visit https://openrouter.ai/keys');
          console.log('   2. Add to your .env: OPENROUTER_API_KEY=your-key');
          console.log('   3. Run: simple-agent\n');
        }
      }
    }

    // Show resolved configuration in verbose mode
    if (options.verbose) {
      console.log(getConfigSummary(config, { provider: defaultProvider, model: defaultModel }));
    }

    // Check if stdin supports raw mode (required for Ink)
    // Ink requires a TTY with raw mode support for interactive input
    const isRawModeSupported = process.stdin.isTTY && typeof process.stdin.setRawMode === 'function';

    if (!isRawModeSupported) {
      console.error('❌ Error: This CLI requires a TTY (interactive terminal) with raw mode support.');
      console.error('   Current environment does not support interactive input.');
      console.error('');
      console.error('   Common causes:');
      console.error('   - Running in a non-interactive environment (CI/CD, background process)');
      console.error('   - Stdin is redirected from a file or pipe');
      console.error('   - Running in an unsupported terminal emulator');
      console.error('');
      console.error('   Solutions:');
      console.error('   - Run in a real terminal (bash, zsh, etc.)');
      console.error('   - Use `simple-agent exec "your prompt"` for non-interactive use');
      console.error('   - Ensure stdin is connected to a TTY');
      process.exit(1);
    }

    // Render Ink UI
    const { waitUntilExit } = render(
      React.createElement(App, {
        serverUrl,
        model: defaultModel,
        provider: defaultProvider,
        server: server,
        enableFileProxy: isRemoteServer,
        workspaceDir: process.cwd(),
        verbose: options.verbose
      })
    );

    // Wait for the Ink app to exit, then cleanup
    await waitUntilExit();

    // Cleanup server if we started it
    if (server && typeof server.stop === 'function') {
      console.log('🛑 Shutting down server...');
      await server.stop();
    }

    process.exit(0);
  });

program
  .command('exec <prompt>')
  .description('Execute single prompt and exit')
  .option('-m, --model <model>', 'AI model to use')
  .option('--port <port>', 'Connect to server on port (default: 8000)', '8000')
  .option('--url <url>', 'Connect to external server URL')
  .action(async (prompt, options) => {
    process.env.LOG_LEVEL = 'silent';

    // Determine server URL
    let serverUrl: string;
    let server:(RpcAiServer|null) = null;

    if (options.url) {
      serverUrl = options.url;
    } else {
      const port = parseInt(options.port);
      serverUrl = `http://localhost:${port}`;

      // If default port, check if server is running, otherwise start one
      if (port === 8000) {
        const { checkServerHealth } = await import('./core/server.js');
        const isRunning = await checkServerHealth(serverUrl);

        if (!isRunning) {
          server = await startServer();
          serverUrl = 'http://localhost:8001';
        }
      }
    }

    const { RPCClient } = await import('simple-rpc-ai-backend/client');
    const client = new RPCClient(serverUrl);

    const result = await client.request('agents.execute', {
      prompt,
      context: {
        modelName: options.model || 'claude-sonnet-3-7'
      }
    });

    console.log(result.content);

    if (server && typeof server.stop === 'function') {
      await server.stop();
    }
    process.exit(0);
  });

program
  .command('plugins')
  .description('List available plugins')
  .action(async () => {
    const { loadPlugins } = await import('./core/plugin-manager.js');
    const plugins = await loadPlugins();

    console.log('\n📦 Available Plugins:\n');
    plugins.forEach((plugin: any) => {
      console.log(`  /${plugin.command} - ${plugin.description}`);
    });
    console.log();
    process.exit(0);
  });

program
  .command('init')
  .description('Initialize user configuration directory')
  .action(() => {
    console.log('\n🔧 Initializing Simple Agent Configuration...\n');
    const success = initializeUserConfig();

    if (success) {
      console.log('\n✅ Configuration initialized successfully!');
      console.log(`\n📝 Next steps:`);
      console.log(`   1. Edit ${CONFIG_LOCATIONS.USER_ENV}`);
      console.log(`   2. Paste your OpenRouter API key (OPENROUTER_API_KEY=...)`);
      console.log(`   3. Run: simple-agent\n`);
    }

    process.exit(success ? 0 : 1);
  });

program
  .command('config')
  .description('Show configuration discovery and current settings')
  .option('--show-keys', 'Show API key values (security warning!)', false)
  .action((options) => {
    printConfigDiscovery();

    const config = loadConfig();

    // Determine resolved defaults (same logic as chat command)
    let resolvedProvider = config.provider;
    let resolvedModel = config.model;

    if (!resolvedProvider) {
      if (config.anthropicApiKey || process.env.ANTHROPIC_API_KEY) {
        resolvedProvider = 'anthropic';
        resolvedModel = resolvedModel || 'claude-sonnet-3-7';
      } else if (config.openaiApiKey || process.env.OPENAI_API_KEY) {
        resolvedProvider = 'openai';
        resolvedModel = resolvedModel || 'gpt-4';
      } else if (config.googleApiKey || process.env.GOOGLE_API_KEY) {
        resolvedProvider = 'google';
        resolvedModel = resolvedModel || 'gemini-pro';
      } else {
        resolvedProvider = 'openrouter';
        resolvedModel = 'anthropic/claude-3-7-sonnet';
      }
    }

    console.log(getConfigSummary(config, { provider: resolvedProvider, model: resolvedModel }));

    if (options.showKeys) {
      console.log('⚠️  API Key Values (DO NOT SHARE):');
      console.log(`  ANTHROPIC_API_KEY: ${config.anthropicApiKey || process.env.ANTHROPIC_API_KEY || '(not set)'}`);
      console.log(`  OPENAI_API_KEY: ${config.openaiApiKey || process.env.OPENAI_API_KEY || '(not set)'}`);
      console.log(`  GOOGLE_API_KEY: ${config.googleApiKey || process.env.GOOGLE_API_KEY || '(not set)'}`);
      console.log(`  OPENROUTER_API_KEY: ${config.openrouterApiKey || process.env.OPENROUTER_API_KEY || '(not set)'}`);
      console.log();
    }

    const validation = validateConfig(config);
    if (!validation.valid) {
      console.error('\n❌ Configuration Issues:\n');
      validation.errors.forEach(error => console.error(error));
      process.exit(1);
    } else {
      console.log('✅ Configuration is valid\n');
    }

    process.exit(0);
  });

program
  .command('help-config')
  .description('Show detailed configuration help')
  .action(() => {
    console.log(`
╔════════════════════════════════════════════════════════════════╗
║          Simple Agent - Configuration Guide                    ║
╚════════════════════════════════════════════════════════════════╝

📁 Configuration File Locations (in order of precedence):

  1. Command-line arguments (highest priority)
     Example: simple-agent --model gpt-4 --provider openai

  2. Environment variables
     Example: export ANTHROPIC_API_KEY=sk-ant-...

  3. Project .env file (current directory)
     ${process.cwd()}/.env

  4. User config directory
     ${CONFIG_LOCATIONS.USER_ENV}

  5. User home .env
     ${CONFIG_LOCATIONS.USER_HOME_ENV}

🔑 Required Configuration:

  At least ONE AI provider API key is required:

  - ANTHROPIC_API_KEY  (for Claude models)
  - OPENAI_API_KEY     (for GPT models)
  - GOOGLE_API_KEY     (for Gemini models)

📝 Getting Started:

  1. Initialize configuration:
     $ simple-agent init

  2. Add your API key to ~/.simple-agent/.env:
     $ echo "ANTHROPIC_API_KEY=your_key_here" >> ~/.simple-agent/.env

  3. Run simple-agent:
     $ simple-agent

🔍 Debugging Configuration:

  Show current configuration:
  $ simple-agent config

  Show verbose discovery info:
  $ simple-agent --verbose

  Show API key values (security warning!):
  $ simple-agent config --show-keys

💡 Best Practices:

  ✅ DO: Use ~/.simple-agent/.env for personal API keys
  ✅ DO: Use project .env for project-specific settings
  ✅ DO: Add .env to .gitignore
  ❌ DON'T: Commit API keys to version control
  ❌ DON'T: Share API keys in plain text

📖 More Information:

  Full documentation: https://github.com/your-repo/simple-rpc-ai-backend
  Report issues: https://github.com/your-repo/simple-rpc-ai-backend/issues

`);
    process.exit(0);
  });

program.parse();
