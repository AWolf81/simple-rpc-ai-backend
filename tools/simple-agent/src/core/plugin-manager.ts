/**
 * Plugin Manager - Dynamic slash command loading
 *
 * Plugins extend the CLI with custom slash commands.
 * Each plugin exports:
 * - command: The slash command trigger (e.g., "review")
 * - description: What the command does
 * - handler: async function(args, context) => void
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PLUGINS_DIR = path.join(__dirname, '../../plugins');

/**
 * Load all plugins from the plugins directory
 */
export async function loadPlugins() {
  const plugins = [];

  try {
    const files = await fs.readdir(PLUGINS_DIR);

    for (const file of files) {
      if (file.endsWith('.js') || file.endsWith('.mjs')) {
        const pluginPath = path.join(PLUGINS_DIR, file);
        const plugin = await import(`file://${pluginPath}`);

        if (plugin.default && plugin.default.command && plugin.default.handler) {
          plugins.push(plugin.default);
        }
      }
    }
  } catch (error) {
    // Plugins directory doesn't exist or is empty - that's ok
    if (error.code !== 'ENOENT') {
      console.error('Error loading plugins:', error);
    }
  }

  return plugins;
}

/**
 * Execute a plugin command
 */
export async function executePlugin(command, args, context) {
  const plugins = await loadPlugins();
  const plugin = plugins.find(p => p.command === command);

  if (!plugin) {
    throw new Error(`Unknown command: /${command}`);
  }

  return await plugin.handler(args, context);
}

/**
 * Check if a message is a slash command
 */
export function isSlashCommand(message) {
  return message.trim().startsWith('/');
}

/**
 * Parse a slash command message
 */
export function parseSlashCommand(message) {
  const trimmed = message.trim();
  const parts = trimmed.slice(1).split(/\s+/);
  const command = parts[0];
  const args = parts.slice(1);

  return { command, args };
}
