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

const program = new Command();

program
  .name('agent')
  .description('AI agent CLI with reactive UI and plugin system')
  .version('1.0.0');

program
  .command('chat', { isDefault: true })
  .description('Start interactive chat session')
  .option('-m, --model <model>', 'AI model to use', 'claude-sonnet-3-7')
  .option('-p, --provider <provider>', 'AI provider', 'anthropic')
  .option('-s, --silent', 'Silent server mode (no logs)', false)
  .action(async (options) => {
    // Set silent mode if requested
    if (options.silent) {
      process.env.LOG_LEVEL = 'silent';
    }

    // Start the backend server
    const server = await startServer();

    // Render Ink UI
    render(
      React.createElement(App, {
        serverUrl: 'http://localhost:8001',
        model: options.model,
        provider: options.provider,
        server: server
      })
    );
  });

program
  .command('exec <prompt>')
  .description('Execute single prompt and exit')
  .option('-m, --model <model>', 'AI model to use')
  .action(async (prompt, options) => {
    //process.env.LOG_LEVEL = 'silent';
    const server = await startServer();

    const { RPCClient } = await import('simple-rpc-ai-backend/client');
    const client = new RPCClient('http://localhost:8001');

    const result = await client.request('agents.execute', {
      prompt,
      model: options.model,
      sdk: 'claude-code'
    });

    console.log(result.content);
    await server.stop();
    process.exit(0);
  });

program
  .command('plugins')
  .description('List available plugins')
  .action(async () => {
    const { loadPlugins } = await import('./core/plugin-manager.js');
    const plugins = await loadPlugins();

    console.log('\n📦 Available Plugins:\n');
    plugins.forEach(plugin => {
      console.log(`  /${plugin.command} - ${plugin.description}`);
    });
    console.log();
    process.exit(0);
  });

program.parse();
