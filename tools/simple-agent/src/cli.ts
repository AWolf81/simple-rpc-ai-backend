#!/usr/bin/env node

/**
 * simple-agent CLI
 *
 * Terminal-based AI coding agent powered by simple-rpc-ai-backend
 */

import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import { configManager } from './config.js';
import { serverManager } from './server.js';
import { AgentClient } from './agent.js';
import * as readline from 'readline';

const program = new Command();

program
  .name('simple-agent')
  .description('Terminal-based AI coding agent')
  .version('0.1.0');

/**
 * Interactive chat mode
 */
program
  .command('chat')
  .description('Start interactive chat with the agent')
  .option('-s, --server <url>', 'Server URL')
  .option('-m, --model <model>', 'Model to use')
  .option('-p, --provider <provider>', 'Provider to use (openrouter, anthropic, openai, google)')
  .action(async (options) => {
    console.log(chalk.blue('🤖 simple-agent') + chalk.gray(' - AI Coding Assistant\n'));

    // Start server if not running
    const spinner = ora('Starting agent server...').start();

    try {
      await serverManager.initialize();
      await serverManager.start();
      spinner.succeed('Server started');
    } catch (error: any) {
      spinner.fail('Failed to start server');
      console.error(chalk.red(error.message));
      process.exit(1);
    }

    // Wait a bit for server to be ready
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Create agent client
    const agent = new AgentClient(options.server);

    // Test connection
    const connected = await agent.testConnection();
    if (!connected) {
      console.error(chalk.red('❌ Could not connect to server'));
      process.exit(1);
    }

    const provider = configManager.getBestProvider();
    console.log(chalk.green('✓') + ' Connected to agent');
    console.log(chalk.gray(`  Provider: ${provider.provider}`));
    console.log(chalk.gray(`  Model: ${provider.model}\n`));

    console.log(chalk.gray('Type your message and press Enter. Type "exit" or "quit" to leave.\n'));

    // Create readline interface
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: chalk.blue('You: ')
    });

    rl.prompt();

    rl.on('line', async (input) => {
      const message = input.trim();

      if (!message) {
        rl.prompt();
        return;
      }

      if (message.toLowerCase() === 'exit' || message.toLowerCase() === 'quit') {
        console.log(chalk.gray('\n👋 Goodbye!\n'));
        rl.close();
        await serverManager.stop();
        process.exit(0);
      }

      if (message === '/clear') {
        agent.clearHistory();
        console.log(chalk.gray('✓ Conversation history cleared\n'));
        rl.prompt();
        return;
      }

      if (message === '/help') {
        console.log(chalk.gray('\nCommands:'));
        console.log(chalk.gray('  /clear  - Clear conversation history'));
        console.log(chalk.gray('  /help   - Show this help'));
        console.log(chalk.gray('  exit    - Exit the chat\n'));
        rl.prompt();
        return;
      }

      // Show thinking indicator
      const thinkingSpinner = ora({
        text: 'Thinking...',
        color: 'cyan'
      }).start();

      try {
        const response = await agent.sendMessage(message);

        thinkingSpinner.stop();

        // Display response
        console.log(chalk.green('\nAgent: ') + response.content);
        console.log(chalk.gray(`\n(${response.usage.totalTokens} tokens used)\n`));
      } catch (error: any) {
        thinkingSpinner.fail('Error');
        console.error(chalk.red(error.message) + '\n');
      }

      rl.prompt();
    });

    rl.on('close', async () => {
      await serverManager.stop();
      process.exit(0);
    });
  });

/**
 * Execute a single command
 */
program
  .command('exec <prompt>')
  .description('Execute a single prompt')
  .option('-s, --server <url>', 'Server URL')
  .option('-m, --model <model>', 'Model to use')
  .option('-p, --provider <provider>', 'Provider to use')
  .action(async (prompt, options) => {
    const spinner = ora('Starting agent...').start();

    try {
      await serverManager.initialize();
      await serverManager.start();

      // Wait for server to be ready
      await new Promise(resolve => setTimeout(resolve, 1000));

      const agent = new AgentClient(options.server);

      spinner.text = 'Processing...';

      const response = await agent.sendMessage(prompt);

      spinner.succeed('Done');

      console.log('\n' + response.content);
      console.log(chalk.gray(`\n(${response.usage.totalTokens} tokens used)`));

      await serverManager.stop();
    } catch (error: any) {
      spinner.fail('Failed');
      console.error(chalk.red(error.message));
      await serverManager.stop();
      process.exit(1);
    }
  });

/**
 * Configuration commands
 */
const configCmd = program
  .command('config')
  .description('Manage configuration');

configCmd
  .command('show')
  .description('Show current configuration')
  .action(() => {
    const config = configManager.getAll();
    console.log(chalk.blue('Configuration:\n'));
    console.log(JSON.stringify(config, null, 2));
    console.log(chalk.gray(`\nConfig file: ${configManager.getConfigPath()}`));
  });

configCmd
  .command('set <key> <value>')
  .description('Set a configuration value')
  .action((key, value) => {
    const keys = key.split('.');
    const current = configManager.getAll();
    let obj: any = current;

    for (let i = 0; i < keys.length - 1; i++) {
      if (!obj[keys[i]]) {
        obj[keys[i]] = {};
      }
      obj = obj[keys[i]];
    }

    // Parse value if it looks like JSON
    let parsedValue: any = value;
    if (value === 'true') parsedValue = true;
    else if (value === 'false') parsedValue = false;
    else if (!isNaN(Number(value))) parsedValue = Number(value);

    obj[keys[keys.length - 1]] = parsedValue;

    // Update entire config
    configManager.set(keys[0] as any, current[keys[0] as keyof typeof current]);

    console.log(chalk.green('✓') + ` Configuration updated: ${key} = ${parsedValue}`);
  });

configCmd
  .command('reset')
  .description('Reset configuration to defaults')
  .action(async () => {
    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: 'Are you sure you want to reset configuration?',
        default: false
      }
    ]);

    if (confirm) {
      configManager.reset();
      console.log(chalk.green('✓') + ' Configuration reset to defaults');
    }
  });

/**
 * MCP commands
 */
const mcpCmd = program
  .command('mcp')
  .description('Manage MCP servers');

mcpCmd
  .command('register <name> <command>')
  .description('Register an MCP server')
  .option('-a, --args <args...>', 'Command arguments')
  .option('-e, --env <env...>', 'Environment variables (KEY=VALUE)')
  .action((name, command, options) => {
    const env: Record<string, string> = {};

    if (options.env) {
      for (const pair of options.env) {
        const [key, value] = pair.split('=');
        if (key && value) {
          env[key] = value;
        }
      }
    }

    configManager.registerMCPServer({
      name,
      command,
      args: options.args,
      env: Object.keys(env).length > 0 ? env : undefined
    });

    console.log(chalk.green('✓') + ` MCP server registered: ${name}`);
  });

mcpCmd
  .command('unregister <name>')
  .description('Unregister an MCP server')
  .action((name) => {
    configManager.unregisterMCPServer(name);
    console.log(chalk.green('✓') + ` MCP server unregistered: ${name}`);
  });

mcpCmd
  .command('list')
  .description('List registered MCP servers')
  .action(() => {
    const servers = configManager.listMCPServers();

    if (servers.length === 0) {
      console.log(chalk.gray('No MCP servers registered'));
      return;
    }

    console.log(chalk.blue('Registered MCP Servers:\n'));
    servers.forEach(server => {
      console.log(chalk.bold(server.name));
      console.log(chalk.gray(`  Command: ${server.command}`));
      if (server.args) {
        console.log(chalk.gray(`  Args: ${server.args.join(' ')}`));
      }
      if (server.env) {
        console.log(chalk.gray(`  Env: ${Object.entries(server.env).map(([k, v]) => `${k}=${v}`).join(', ')}`));
      }
      console.log();
    });
  });

/**
 * Provider detection
 */
program
  .command('providers')
  .description('Detect and show available providers')
  .action(() => {
    console.log(chalk.blue('Detected Providers:\n'));

    const detected = configManager.detectProviders();

    if (detected.length === 0) {
      console.log(chalk.gray('No providers detected from environment variables'));
      console.log(chalk.gray('\nDefault: qwen-coder:free via OpenRouter (no API key required)'));
      return;
    }

    detected.forEach((provider, index) => {
      const prefix = index === 0 ? chalk.green('✓') : ' ';
      console.log(`${prefix} ${chalk.bold(provider.provider)}`);
      console.log(chalk.gray(`  Model: ${provider.model}`));
      console.log(chalk.gray(`  API Key: ${provider.apiKey.slice(0, 8)}...`));
      if (index === 0) {
        console.log(chalk.gray('  (will be used by default)'));
      }
      console.log();
    });
  });

// Default action: show help
program.action(() => {
  program.help();
});

// Parse arguments
program.parse();
